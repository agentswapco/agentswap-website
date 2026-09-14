// Handles only configured secret probes and isolated decoy API requests; never forwards to production.
// Exports: default Worker fetch handler; deps: decoys, tokens, events and rate limit bindings.
import { API_PREFIX, PROBE_PATHS, RESPONSE_HEADERS } from './config';
import { renderDecoy } from './decoys';
import { recordEvent } from './events';
import { issueToken, verifyToken } from './tokens';
import type { Env } from './types';

function respond(request: Request, body: string, status: number, extra: Record<string, string> = {}): Response {
  return new Response(request.method === 'HEAD' ? null : body, {
    status, headers: { ...RESPONSE_HEADERS, 'content-type': 'text/plain; charset=utf-8', ...extra },
  });
}

async function callback(request: Request, url: URL, env: Env): Promise<Response> {
  const token = url.pathname.slice(API_PREFIX.length).split('/')[0] ?? '';
  const ticket = await verifyToken(token, env.HONEYPOT_SIGNING_SECRET);
  if (ticket && ticket.host === url.host) {
    const presented = request.headers.get('authorization')?.replace(/^Bearer /i, '')
      ?? request.headers.get('x-api-key') ?? request.headers.get('x-amz-security-token');
    const used = presented === token;
    recordEvent(used ? 'credential_used' : 'endpoint_visited', request, ticket);
  }
  return respond(request, '{"error":{"message":"Invalid API key","type":"authentication_error"}}',
    401, { 'content-type': 'application/json; charset=utf-8' });
}

async function handle(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const isCallback = url.pathname.startsWith(API_PREFIX);
  if (!isCallback && !PROBE_PATHS.some(path => path === url.pathname)) {
    return respond(request, 'Not found', 404);
  }
  if (!isCallback && request.method !== 'GET' && request.method !== 'HEAD') {
    return respond(request, 'Method not allowed', 405, { allow: 'GET, HEAD' });
  }
  if (!env.HONEYPOT_SIGNING_SECRET || env.HONEYPOT_SIGNING_SECRET.length < 32) {
    return respond(request, 'Not found', 404);
  }
  const limiter = isCallback ? env.CALLBACK_LIMITER : env.PROBE_LIMITER;
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  if (!(await limiter.limit({ key: ip })).success) {
    return respond(request, 'Too many requests', 429, { 'retry-after': '60' });
  }
  if (isCallback) return callback(request, url, env);
  const { token, ticket } = await issueToken(url, env.HONEYPOT_SIGNING_SECRET);
  const decoy = renderDecoy(url, token, ticket);
  recordEvent('issued', request, ticket);
  return respond(request, decoy.body, 200, { 'content-type': decoy.contentType });
}

export default { async fetch(request: Request, env: Env): Promise<Response> {
  try { return await handle(request, env); }
  catch {
    console.error('{"event":"honeypot.handler_failed"}');
    return respond(request, 'Not found', 404);
  }
} };
