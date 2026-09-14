// Exercises credential issuance, replay correlation, bounded responses and route isolation over HTTP.
// Entry point: node --test tests/honeypot.test.mjs on a remote SSH host; deps: Node and Wrangler.
// Real workerd handles crypto, rate limits and logs; no provider or browser behavior is mocked.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

assert.ok(process.env.SSH_CONNECTION, 'E2E must run on an authorized remote SSH host');
const port = Number(process.env.TEST_PORT ?? 18947);
const origin = `http://127.0.0.1:${port}`;
let worker;
let logs = '';

before(async () => {
  worker = spawn('wrangler', ['dev', '--local', '--ip', '127.0.0.1',
    '--port', String(port), '--local-upstream', `127.0.0.1:${port}`, '--var', 'HONEYPOT_SIGNING_SECRET:remote-e2e-signing-secret-not-production',
    ], {
    stdio: ['ignore', 'pipe', 'pipe'], detached: true,
  });
  worker.stdout.on('data', chunk => { logs += chunk; });
  worker.stderr.on('data', chunk => { logs += chunk; });
  for (let attempt = 0; attempt < 240; attempt++) {
    if (worker.exitCode !== null) throw new Error(logs);
    try { await fetch(origin); return; } catch { await delay(250); }
  }
  throw new Error(`Worker startup timed out: ${logs}`);
});

after(async () => {
  if (worker?.pid && worker.exitCode === null) process.kill(-worker.pid, 'SIGTERM');
  console.log(logs);
});

async function issue(path = '/client/.env', ip = '192.0.2.1') {
  const response = await fetch(`${origin}${path}`, { headers: { 'cf-connecting-ip': ip } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(response.headers.get('x-robots-tag'), /noindex/);
  const body = await response.text();
  assert.ok(body.length < 4096);
  return { body, key: body.match(/^OPENAI_API_KEY=(.+)$/m)?.[1],
    endpoint: body.match(/^OPENAI_BASE_URL=(.+)$/m)?.[1] };
}

test('issues unique inert credentials and suppresses caching for screenshot probe paths', async () => {
  for (const path of ['/build../.env', '/.aws/config', '/@fs/.env.production',
    '/gcloud-service-account.json', '/client/.env', '/config/.env.production',
    '/terraform.tfstate', '/@fs/proc/1/environ', '/wordpress/.env', '/apps/api/.env']) {
    await issue(path);
  }
  const first = await issue();
  const second = await issue();
  assert.ok(first.key && first.endpoint);
  assert.notEqual(first.key, second.key);
  assert.equal(new URL(first.endpoint).origin, origin);
  assert.ok(!first.body.includes('remote-e2e-signing-secret'));
});

test('distinguishes a link visit from credential use and logs the original probe', async () => {
  const { key, endpoint } = await issue('/client/.env', '192.0.2.2');
  assert.equal(new URL(endpoint).origin, origin);
  const visit = await fetch(`${endpoint}/models`);
  assert.equal(visit.status, 401);
  assert.ok(!logs.includes('honeypot.credential_used'));
  const used = await fetch(`${endpoint}/models`, { headers: { authorization: `Bearer ${key}` } });
  assert.equal(used.status, 401);
  for (let attempt = 0; attempt < 40 && !logs.includes('honeypot.credential_used'); attempt++) await delay(100);
  assert.match(logs, /\/client\/\.env/);
  const events = logs.split('\n').filter(line => line.startsWith('{\"event\":'));
  assert.ok(events.every(line => !line.includes(key)));
  assert.match(logs, /honeypot\.issued/);
  assert.match(logs, /honeypot\.endpoint_visited/);
  assert.match(logs, /honeypot\.credential_used/);

});

test('rejects forged credentials without reporting use or logging supplied secrets', async () => {
  const { endpoint, key } = await issue('/.env', '192.0.2.3');
  const beforeCount = logs.split('honeypot.credential_used').length;
  const forged = `${key.slice(0, -8)}00000000`;
  const response = await fetch(`${endpoint}/models`, {
    headers: { authorization: `Bearer ${forged}`, 'x-api-key': 'real-secret-must-not-be-logged' },
  });
  assert.equal(response.status, 401);
  await delay(100);
  assert.equal(logs.split('honeypot.credential_used').length, beforeCount);
  assert.ok(!logs.includes('real-secret-must-not-be-logged'));
});

test('rate limits probe bursts and rejects writes with small responses', async () => {
  for (let count = 0; count < 30; count++) await issue('/.env', '192.0.2.4');
  const limited = await fetch(`${origin}/.env`, { headers: { 'cf-connecting-ip': '192.0.2.4' } });
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('retry-after'), '60');
  const write = await fetch(`${origin}/.env`, { method: 'POST', body: 'ignored' });
  assert.equal(write.status, 405);
  assert.ok((await write.text()).length < 256);
});

test('does not catch pages, assets, trading APIs or nearby non-probe paths', async () => {
  for (const path of ['/', '/assets/app.js', '/api/intents', '/api/rpc/8453',
    '/.well-known/agent-registration.json', '/client/.environment', '/config/settings']) {
    const response = await fetch(`${origin}${path}`);
    assert.equal(response.status, 404);
    assert.equal(await response.text(), 'Not found');
  }
  const head = await fetch(`${origin}/.env`, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
});
