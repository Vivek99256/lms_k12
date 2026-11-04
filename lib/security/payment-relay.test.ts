import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { afterEach, test } from 'node:test';

process.env.NEXT_PUBLIC_API_BASE_URL_DEV = 'http://erp.test';
process.env.NEXT_PUBLIC_API_BASE_URL_PROD = 'http://erp.test';
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

const call = async (upstream: Response, gateway = 'hdfc') => {
  globalThis.fetch = (async () => upstream) as typeof fetch;
  const { POST } = await import('../../app/api/fees/online-payment/[gateway]/route');
  const form = new FormData(); form.set('token', 't'); form.set('amount', '1');
  const req = new NextRequest('http://app.test/api/fees/online-payment/' + gateway, { method: 'POST', body: form });
  return POST(req, { params: Promise.resolve({ gateway }) });
};

test('payment relay: upstream HTML is served sandboxed so it cannot reach the app origin storage', async () => {
  const res = await call(new Response('<form action="https://bank.test"></form>', { status: 200, headers: { 'content-type': 'text/html' } }));
  const csp = res.headers.get('content-security-policy') ?? '';
  assert.match(csp, /^sandbox /);
  assert.ok(!/allow-same-origin/.test(csp), 'allow-same-origin would undo the sandbox');
  assert.equal(res.headers.get('cache-control'), 'no-store');
});

test('payment relay: only an http(s) Location is passed on', async () => {
  const ok = await call(new Response(null, { status: 302, headers: { location: 'https://bank.test/pay' } }));
  assert.equal(ok.headers.get('location'), 'https://bank.test/pay');
  const bad = await call(new Response(null, { status: 302, headers: { location: 'javascript:alert(1)' } }));
  assert.equal(bad.headers.get('location'), null);
});

test('payment relay: an unknown gateway is refused', async () => {
  const res = await call(new Response('x'), 'evil');
  assert.equal(res.status, 404);
});
