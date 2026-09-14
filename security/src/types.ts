// Defines the isolated honeypot's bindings and signed credential metadata.
// Exports: DecoyId, Ticket, Env; deps: Web platform types.
export type DecoyId = string & { readonly __brand: 'DecoyId' };
export interface Ticket {
  id: DecoyId;
  issuedAt: number;
  host: string;
  path: string;
}
interface RateLimit {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}
export interface Env {
  HONEYPOT_SIGNING_SECRET: string;
  PROBE_LIMITER: RateLimit;
  CALLBACK_LIMITER: RateLimit;
}
