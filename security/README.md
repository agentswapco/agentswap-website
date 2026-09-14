# Isolated credential honeypot

This Worker serves synthetic credentials on the paths listed in `src/config.ts` for
`agentswap.co`, `www.agentswap.co` and `app.agentswap.co`. Wrangler registers only
those path prefixes and `/internal/service/v1/*`; normal Pages and trading API traffic
does not invoke the Worker. Unrecognized suffixes on reserved prefixes return 404.

Environment responses contain an OpenAI-compatible base URL on the same host and an
inert signed token. AWS configuration and JSON/state responses are decoys; they do not
grant cloud access. No real application environment or credential store is read.

The only secret binding is `HONEYPOT_SIGNING_SECRET`, an independent random HMAC key
of at least 32 characters. Tokens expire after seven days and are bound to their issuing
host. Rotating this binding invalidates existing tokens. A missing binding fails closed.

Cloudflare Workers Logs contains `honeypot.issued`, `honeypot.endpoint_visited` and
`honeypot.credential_used`. Correlate them by `id`; issuance includes the original path,
timestamp and source IP. Credential use requires presenting the token through Bearer,
`x-api-key` or `x-amz-security-token`; following a URL alone is a separate event.
No external alert integration is configured. Request headers, query strings and bodies
are not logged by application code. Automatic invocation logs are disabled.

Responses are under 4 KiB and carry `no-store` and `noindex` headers. The native rate
limit is 30 probes and 15 callback requests per IP per minute, separately. Cloudflare's
limiter is eventually consistent within each location; it is not a global cost ceiling.
All API responses deny access; request bodies are never parsed or forwarded.

## Verification and deployment

Use TypeScript strict checks against `tsconfig.json` and Wrangler's dry-run build.
Run E2E exclusively over SSH on an authorized grok box, with Node 22 and Wrangler
4.123.0 or newer on PATH:

```sh
node --test tests/honeypot.test.mjs
node tests/live-check.mjs
```

Build and inspect this Worker separately from the Pages website. Configure the signing
secret before attaching routes. Deploy with `wrangler deploy --config security/wrangler.jsonc`
from the website root. The website's existing static build allowlist excludes `security/`.
Remove this Worker's routes to roll back interception; the Pages deployments are independent.

Only explicitly listed probes are intercepted. Encoded or unlisted variants may reach
Pages; the honeypot is not an access-control boundary for real files. Public artifacts
must independently pass the global credential publication guard.
