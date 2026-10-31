import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

process.env.NEXT_PUBLIC_API_BASE_URL_DEV = 'http://erp.test';
process.env.NEXT_PUBLIC_API_BASE_URL_PROD = 'http://erp.test';

const realFetch = globalThis.fetch;

describe('relayLiveChat', () => {
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('refuses a request with no Authorization header and never calls upstream', async () => {
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      return new Response('{}');
    }) as typeof fetch;
    const { relayLiveChat } = await import('./proxy');

    const res = await relayLiveChat(new Request('http://app.test/api/live-chat/session?adminQueue=1'), 'session');

    assert.equal(res.status, 401);
    assert.equal(called, false);
  });

  it('forwards the caller token, query and body to the Laravel live-chat route', async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      seen = { url, init };
      return new Response(JSON.stringify({ ok: 1 }), { status: 200 });
    }) as typeof fetch;
    const { relayLiveChat } = await import('./proxy');

    const res = await relayLiveChat(
      new Request('http://app.test/api/live-chat/messages?sessionId=s1', {
        method: 'POST',
        headers: { authorization: 'Bearer abc' },
        body: JSON.stringify({ text: 'hi' }),
      }),
      'messages',
    );

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: 1 });
    assert.equal(seen?.url, 'http://erp.test/api/live-chat/messages?sessionId=s1');
    assert.equal((seen?.init.headers as Record<string, string>).Authorization, 'Bearer abc');
    assert.equal(seen?.init.body, JSON.stringify({ text: 'hi' }));
  });

  it('passes upstream status through and does not expose upstream HTML', async () => {
    globalThis.fetch = (async () => new Response('<html>stack trace at /var/www/app</html>', { status: 500 })) as typeof fetch;
    const { relayLiveChat } = await import('./proxy');

    const res = await relayLiveChat(
      new Request('http://app.test/api/live-chat/presence', { headers: { authorization: 'Bearer abc' } }),
      'presence',
    );
    const text = JSON.stringify(await res.json());

    assert.equal(res.status, 500);
    assert.ok(!text.includes('/var/www'));
  });

  it('masks a network failure instead of leaking the internal host', async () => {
    globalThis.fetch = (async () => {
      throw new Error('connect ECONNREFUSED 10.0.0.5:443');
    }) as typeof fetch;
    const { relayLiveChat } = await import('./proxy');

    const res = await relayLiveChat(
      new Request('http://app.test/api/live-chat/slots', { headers: { authorization: 'Bearer abc' } }),
      'slots',
    );
    const text = JSON.stringify(await res.json());

    assert.equal(res.status, 502);
    assert.ok(!text.includes('10.0.0.5'));
  });
});
