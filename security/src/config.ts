// Defines the explicitly intercepted probe paths and response limits.
// Exports: PROBE_PATHS, API_PREFIX, TOKEN_TTL_MS, RESPONSE_HEADERS; deps: none.
export const PROBE_PATHS = [
  '/.env', '/.env.local', '/.env.production', '/.env.development', '/.env.backup',
  '/.aws/config', '/.aws/credentials', '/gcloud-service-account.json', '/terraform.tfstate',
  '/build../.env', '/client/.env', '/config/.env', '/config/.env.production',
  '/wordpress/.env', '/apps/api/.env', '/api/.env', '/app/.env', '/backend/.env',
  '/server/.env', '/public/.env', '/@fs/.env', '/@fs/.env.production', '/@fs/proc/1/environ',
] as const;
export const API_PREFIX = '/internal/service/v1/';
export const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const RESPONSE_HEADERS = {
  'cache-control': 'no-store',
  'cdn-cache-control': 'no-store',
  'x-robots-tag': 'noindex, nofollow, noarchive',
  'x-content-type-options': 'nosniff',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
  'referrer-policy': 'no-referrer',
} as const;
