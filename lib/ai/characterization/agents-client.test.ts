/**
 * Characterization of the agents browser client (lib/agents/client.ts): what it sends to this
 * app's own `/api/agents` routes, how it reads the answers, and how it turns failures into
 * `AgentApiError`. Identity travels only in `x-*` headers, never in a request body.
 */
import { strict as assert } from 'node:assert';
import { afterEach, before, describe, it } from 'node:test';

import { headersOf, installBrowser, stubFetch, type FetchStub } from './browser-env';

const ERP = 'https://erp-fallback.example.test';
let restoreEnv: (() => void) | null = null;
let stub: FetchStub | null = null;
let client: typeof import('../../agents/client');

before(async () => {
  process.env.NEXT_PUBLIC_APP_ENV = 'development';
  process.env.NEXT_PUBLIC_API_BASE_URL_DEV = ERP;
  console.error = () => undefined;
  client = await import('../../agents/client');
});

afterEach(() => {
  stub?.restore();
  restoreEnv?.();
  stub = null;
  restoreEnv = null;
});

function signedIn(respond: Parameters<typeof stubFetch>[0]) {
  restoreEnv = installBrowser({
    local: { userData: JSON.stringify({ user_token: 'tok', sub_institute_id: '3', user_id: '6', user_name: 'Pat' }) },
  });
  stub = stubFetch(respond);
  return stub;
}

const jsonBody = (value: unknown) => ({ status: 200, body: JSON.stringify(value) });

describe('agents client requests', () => {
  it('lists agents with only the filters given, as a relative /api/agents URL', async () => {
    const s = signedIn(() => jsonBody({ data: [{ id: 'agt_1' }] }));
    assert.deepEqual(await client.fetchAgents({ module: 'fees', status: 'active' }), [{ id: 'agt_1' }]);
    assert.equal(s.calls[0]?.url, '/api/agents?module=fees&status=active');
    await client.fetchAgents();
    assert.equal(s.calls[1]?.url, '/api/agents');
    assert.equal(s.calls[0]?.init.method, 'GET');
    assert.equal(s.calls[0]?.init.cache, 'no-store');
  });

  it('lists runs with agent_id and limit', async () => {
    const s = signedIn(() => jsonBody({ data: [] }));
    await client.fetchRuns({ module: 'fees', agentId: 'agt_1', limit: 5 });
    assert.equal(s.calls[0]?.url, '/api/agents/runs?module=fees&agent_id=agt_1&limit=5');
  });

  it('identifies the caller through x-* headers and never through the body', async () => {
    const s = signedIn(() => jsonBody({ data: { id: 'agt_2' } }));
    await client.createAgent({ name: 'n', module: 'fees', tools_allowed: ['t'], instructions: 'i', description: 'd', trigger: 'manual' } as never);
    const call = s.calls[0]!;
    const headers = headersOf(call);
    assert.equal(call.init.method, 'POST');
    assert.equal(headers['content-type'], 'application/json');
    assert.equal(headers['x-laravel-token'], 'tok');
    assert.equal(headers['x-sub-institute-id'], '3');
    assert.equal(headers['x-user-id'], '6');
    const body = JSON.parse(String(call.init.body)) as Record<string, unknown>;
    for (const identity of ['token', 'sub_institute_id', 'user_id', 'tenant_id', 'created_by']) {
      assert.equal(identity in body, false, `${identity} must not be in the body`);
    }
  });

  it('updates status with PATCH on an encoded id, and runs with POST returning the run', async () => {
    const s = signedIn((call) => (call.url.endsWith('/run') ? jsonBody({ data: { run: { id: 'run_1' } } }) : jsonBody({ data: { id: 'agt/1' } })));
    await client.setAgentStatus('agt/1', 'paused');
    assert.equal(s.calls[0]?.url, '/api/agents/agt%2F1');
    assert.equal(s.calls[0]?.init.method, 'PATCH');
    assert.equal(s.calls[0]?.init.body, '{"status":"paused"}');
    assert.deepEqual(await client.runAgent('agt_1', { limit: 3 } as never), { id: 'run_1' });
    assert.equal(s.calls[1]?.url, '/api/agents/agt_1/run');
  });

  it('unwraps `data` when present and returns the payload itself otherwise', async () => {
    signedIn(() => jsonBody([{ id: 'bare' }]));
    assert.deepEqual(await client.fetchAgents(), [{ id: 'bare' }]);
  });
});

describe('agents client failures', () => {
  it('throws AgentApiError with the server message, the status, and the denied run', async () => {
    signedIn(() => ({ status: 403, body: JSON.stringify({ message: 'Not allowed.', run: { id: 'run_denied', status: 'denied' } }) }));
    await assert.rejects(
      () => client.runAgent('agt_1'),
      (error: unknown) =>
        error instanceof client.AgentApiError &&
        error.status === 403 &&
        error.message === 'Not allowed.' &&
        (error.run as { id?: string } | null)?.id === 'run_denied',
    );
  });

  it('falls back to a generic message when the error body is not JSON', async () => {
    signedIn(() => ({ status: 502, body: '<html>bad gateway</html>' }));
    await assert.rejects(
      () => client.fetchAgents(),
      (error: unknown) => error instanceof client.AgentApiError && error.status === 502 && error.message === 'Request failed (502).' && error.run === null,
    );
  });
});
