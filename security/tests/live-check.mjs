// Verifies deployed probe routing, inert authentication and unaffected public Pages endpoints.
// Entry point: remote Node CLI; dependencies: fetch, assert. Never prints credential bodies.
import assert from 'node:assert/strict';

assert.ok(process.env.SSH_CONNECTION, 'Run live E2E on an authorized remote SSH host');
const probes = {
  'https://app.agentswap.co': ['/build../.env', '/.aws/config', '/@fs/.env.production',
    '/gcloud-service-account.json', '/client/.env', '/config/.env.production',
    '/terraform.tfstate', '/@fs/proc/1/environ', '/wordpress/.env', '/apps/api/.env'],
  'https://agentswap.co': ['/build../.env', '/.aws/config', '/.env'],
  'https://www.agentswap.co': ['/.env'],
};
let checks = 0;
for (const [origin, paths] of Object.entries(probes)) {
  for (const path of paths) {
    const response = await fetch(origin + path);
    assert.equal(response.status, 200, origin + path);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.match(response.headers.get('x-robots-tag'), /noindex/);
    const body = await response.text();
    assert.ok(body.length < 4096 && !body.includes('<html'));
    checks++;
    if (path !== '/.env') continue;
    const token = body.match(/^OPENAI_API_KEY=(.+)$/m)?.[1];
    const endpoint = body.match(/^OPENAI_BASE_URL=(.+)$/m)?.[1];
    assert.ok(token && endpoint);
    assert.equal(new URL(endpoint).origin, origin);
    const used = await fetch(endpoint + '/models', { headers: { authorization: `Bearer ${token}` } });
    assert.equal(used.status, 401);
    const payload = JSON.parse(Buffer.from(token.slice(6).split('.')[0], 'base64url').toString());
    console.log(JSON.stringify({ host: new URL(origin).host, event: 'verified_live_replay', id: payload.id }));
    checks++;
  }
}
for (const url of ['https://agentswap.co/', 'https://app.agentswap.co/',
  'https://agentswap.co/robots.txt', 'https://app.agentswap.co/llms.txt']) {
  const response = await fetch(url);
  assert.equal(response.status, 200, url);
  assert.ok(!(await response.text()).includes('OPENAI_API_KEY=sk-as-'));
  checks++;
}
console.log(JSON.stringify({ status: 'passed', checks }));
