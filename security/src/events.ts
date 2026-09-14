// Emits bounded correlated events without logging request credentials or query strings.
// Exports: recordEvent; deps: signed ticket metadata and console logs.
import type { Ticket } from './types';

type EventKind = 'issued' | 'endpoint_visited' | 'credential_used';

export function recordEvent(kind: EventKind, request: Request, ticket: Ticket): void {
  console.log(JSON.stringify({ event: `honeypot.${kind}`, ...ticket,
    observedAt: new Date().toISOString(), method: request.method,
    ip: request.headers.get('cf-connecting-ip')?.slice(0, 64) ?? 'unknown',
    userAgent: request.headers.get('user-agent')?.slice(0, 256) ?? '',
    ray: request.headers.get('cf-ray')?.slice(0, 64) ?? '',
  }));
}
