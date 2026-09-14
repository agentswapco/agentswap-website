// Renders synthetic configuration without reading application secrets or filesystem contents.
// Exports: renderDecoy; deps: config, signed ticket types.
import { API_PREFIX } from './config';
import type { Ticket } from './types';

export function renderDecoy(url: URL, token: string, ticket: Ticket): { body: string; contentType: string } {
  const endpoint = `${url.origin}${API_PREFIX}${token}`;
  if (url.pathname === '/terraform.tfstate') {
    return json({ version: 4, terraform_version: '1.9.0', serial: 1, lineage: ticket.id,
      outputs: { service_endpoint: { value: endpoint, type: 'string', sensitive: false },
        service_api_key: { value: token, type: 'string', sensitive: true } }, resources: [] });
  }
  if (url.pathname.endsWith('.json')) {
    return json({ project_id: 'agentswap-production', service_endpoint: endpoint, api_key: token });
  }
  if (url.pathname.startsWith('/.aws/')) {
    return { contentType: 'text/plain; charset=utf-8', body:
      `[default]\nregion = us-east-1\nendpoint_url = ${endpoint}\n` +
      `aws_access_key_id = ASIA${ticket.id.replaceAll('-', '').slice(0, 16).toUpperCase()}\n` +
      `aws_secret_access_key = ${crypto.randomUUID().replaceAll('-', '')}\naws_session_token = ${token}\n` };
  }
  return { contentType: 'text/plain; charset=utf-8', body:
    `APP_ENV=production\nOPENAI_BASE_URL=${endpoint}\nOPENAI_API_KEY=${token}\n` +
    `SERVICE_API_URL=${endpoint}\nSERVICE_API_KEY=${token}\n` };
}

function json(value: Record<string, unknown>): { body: string; contentType: string } {
  return { body: JSON.stringify(value, null, 2), contentType: 'application/json; charset=utf-8' };
}
