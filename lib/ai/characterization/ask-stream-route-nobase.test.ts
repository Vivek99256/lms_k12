/**
 * The chat transport route with no backend configured at all. A separate file because the route
 * reads its host constants when it is first imported, and each test file runs in its own process.
 */
import { strict as assert } from 'node:assert';
import { after, before, describe, it } from 'node:test';

import { stubFetch, type FetchStub } from './browser-env';

let stub: FetchStub | null = null;
let POST: (request: Request) => Promise<Response>;

before(async () => {
  for (const key of ['NEXT_PUBLIC_APP_ENV', 'NEXT_PUBLIC_API_BASE_URL_DEV', 'NEXT_PUBLIC_API_BASE_URL_PROD', 'NEXT_PUBLIC_AI_BASE_URL', 'AI_UPSTREAM_BASE_URL']) {
    delete process.env[key];
  }
  process.env.NEXT_PUBLIC_APP_ENV = 'development';
  console.error = () => undefined;
  ({ POST } = await import('../../../app/api/ai/ask/stream/route'));
});

after(() => stub?.restore());

describe('ask/stream route with no base URL', () => {
  it('answers 500 and calls nothing', async () => {
    stub = stubFetch(() => ({ status: 200, body: '' }));
    const response = await POST(
      new Request('http://localhost/api/ai/ask/stream', { method: 'POST', body: JSON.stringify({ question: 'Who has low attendance this week?', route: '/dashboard' }) }),
    );
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'The assistant API base URL is not configured.' });
    assert.equal(stub.calls.length, 0);
  });
});
