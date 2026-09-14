// Issues and authenticates expiring, stateless decoy credentials with HMAC-SHA256.
// Exports: issueToken, verifyToken; deps: Web Crypto, config, types.
import { PROBE_PATHS, TOKEN_TTL_MS } from './config';
import type { DecoyId, Ticket } from './types';

const encoder = new TextEncoder();
const PREFIX = 'sk-as-';
const MAX_TOKEN_LENGTH = 1024;

function encode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function decode(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), char => char.charCodeAt(0));
}

function signingKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function issueToken(url: URL, secret: string): Promise<{ token: string; ticket: Ticket }> {
  const ticket: Ticket = {
    id: crypto.randomUUID() as DecoyId, issuedAt: Date.now(), host: url.host, path: url.pathname,
  };
  const payload = encode(encoder.encode(JSON.stringify(ticket)));
  const signature = await crypto.subtle.sign('HMAC', await signingKey(secret), encoder.encode(payload));
  return { token: `${PREFIX}${payload}.${encode(new Uint8Array(signature))}`, ticket };
}

function isTicket(value: unknown): value is Ticket {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === 'string' && /^[0-9a-f-]{36}$/.test(item.id)
    && typeof item.issuedAt === 'number' && Number.isSafeInteger(item.issuedAt)
    && typeof item.host === 'string' && item.host.length <= 255
    && typeof item.path === 'string' && PROBE_PATHS.some(path => path === item.path);
}

export async function verifyToken(token: string, secret: string): Promise<Ticket | null> {
  if (token.length > MAX_TOKEN_LENGTH || !token.startsWith(PREFIX)) return null;
  const parts = token.slice(PREFIX.length).split('.');
  const [payload, signature] = parts;
  if (parts.length !== 2 || !payload || !signature || !/^[\w-]+$/.test(payload + signature)) return null;
  try {
    const valid = await crypto.subtle.verify('HMAC', await signingKey(secret),
      decode(signature), encoder.encode(payload));
    if (!valid) return null;
    const ticket: unknown = JSON.parse(new TextDecoder().decode(decode(payload)));
    if (!isTicket(ticket)) return null;
    const age = Date.now() - ticket.issuedAt;
    return age >= 0 && age <= TOKEN_TTL_MS ? ticket : null;
  } catch {
    return null;
  }
}
