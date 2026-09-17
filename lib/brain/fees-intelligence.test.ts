import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ACADEMIC_YEAR_STORAGE_KEY } from '@/lib/academic-year';

/**
 * Fees Intelligence — the guarantees the SCREEN depends on.
 *
 * These test the contract, not the rendering: that the academic year rides on
 * every request, that the tenant comes from the signed session rather than from
 * anything the page holds, and that the drill-down narrows server-side. Those
 * three are what make the screen correct; a snapshot of the markup would not
 * catch any of them breaking.
 *
 * The Brain client is driven through a stubbed `fetch` and stubbed browser
 * storage, so nothing here touches a network or a database — which is also what
 * lets these run in the same `node --test` suite as the rest of lib/.
 */

type FetchCall = { url: string; init?: RequestInit };

/**
 * Parse the recorded request URL.
 *
 * A base is supplied because NEXT_PUBLIC_BRAIN_API_BASE_URL is unset under the
 * test runner, so the client builds a correctly-relative URL. The base is only
 * scaffolding for `URL`; what the assertions read is the path and query the
 * client actually produced.
 */
function parsed(call: FetchCall): URL {
  return new URL(call.url, 'http://brain.test');
}

/** A signed-in LMS session, as lib/brain/api.ts reads it out of localStorage. */
function installSession(options: { tenantId: string; syear: string }) {
  const store = new Map<string, string>([
    ['userData', JSON.stringify({ user_token: 'test-token', sub_institute_id: options.tenantId, id: '7' })],
    ['menuContext', JSON.stringify({})],
    [ACADEMIC_YEAR_STORAGE_KEY, options.syear],
  ]);

  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage;

  (globalThis as Record<string, unknown>).window = { addEventListener() {}, removeEventListener() {} };
  (globalThis as Record<string, unknown>).localStorage = storage;
  (globalThis as Record<string, unknown>).sessionStorage = storage;

  return store;
}

function installFetch(payload: unknown = {}): FetchCall[] {
  const calls: FetchCall[] = [];
  (globalThis as Record<string, unknown>).fetch = async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return {
      ok: true,
      status: 200,
      json: async () => payload,
    } as unknown as Response;
  };

  return calls;
}

/** Imported lazily: the module reads `window` at import time. */
async function loadClient() {
  return import('@/app/fees/intelligence/_lib/fees-intelligence-api');
}

test('every fees intelligence request carries the selected academic year', async () => {
  installSession({ tenantId: '42', syear: '2021' });
  const calls = installFetch();

  const client = await loadClient();
  await client.fetchFeesIntelligence();

  assert.equal(calls.length, 1);
  const url = parsed(calls[0]);
  // The year is the single thing that makes this screen year-correct. If it
  // ever stops riding on the request, the page silently shows another year.
  assert.equal(url.searchParams.get('syear'), '2021');
});

test('the tenant in the path comes from the session, never from the page', async () => {
  installSession({ tenantId: '42', syear: '2021' });
  const calls = installFetch();

  const client = await loadClient();
  await client.fetchFeesIntelligence();

  assert.match(calls[0].url, /\/api\/brain\/42\/fees\/intelligence/);
});

test('switching the header year changes the year on the next request', async () => {
  const store = installSession({ tenantId: '42', syear: '2021' });
  const calls = installFetch();

  const client = await loadClient();
  await client.fetchFeesIntelligence();
  store.set(ACADEMIC_YEAR_STORAGE_KEY, '2022');
  await client.fetchFeesIntelligence();

  assert.equal(parsed(calls[0]).searchParams.get('syear'), '2021');
  assert.equal(parsed(calls[1]).searchParams.get('syear'), '2022');
});

test('the class drill-down narrows server-side rather than in the browser', async () => {
  installSession({ tenantId: '42', syear: '2021' });
  const calls = installFetch();

  const client = await loadClient();
  await client.fetchFeesAccounts(0, 25, '39');

  const url = parsed(calls[0]);
  assert.equal(url.searchParams.get('standard_id'), '39');
  assert.equal(url.searchParams.get('limit'), '25');
  // Still year-scoped: a drill-down into a class must not escape the year.
  assert.equal(url.searchParams.get('syear'), '2021');
});

test('an unscoped account page sends no class filter at all', async () => {
  installSession({ tenantId: '42', syear: '2021' });
  const calls = installFetch();

  const client = await loadClient();
  await client.fetchFeesAccounts(0, 25);

  assert.equal(parsed(calls[0]).searchParams.has('standard_id'), false);
});

test('an unmeasured outcome sends no figures rather than zeros', async () => {
  installSession({ tenantId: '42', syear: '2021' });
  const calls = installFetch();

  const client = await loadClient();
  await client.recordFeesOutcome('exec-1', 'partial', 'Four families reached.');

  const body = JSON.parse(String(calls[0].init?.body));
  assert.equal(body.result, 'partial');
  // undefined, not 0 — a zero here would claim the action moved nothing.
  assert.equal(body.measured_before, undefined);
  assert.equal(body.measured_after, undefined);
});

test('a measured outcome carries both sides of the change', async () => {
  installSession({ tenantId: '42', syear: '2021' });
  const calls = installFetch();

  const client = await loadClient();
  await client.recordFeesOutcome('exec-1', 'success', 'Cleared.', {
    before: 42101,
    after: 25000,
    accountsAffected: 6,
  });

  const body = JSON.parse(String(calls[0].init?.body));
  assert.equal(body.measured_before, 42101);
  assert.equal(body.measured_after, 25000);
  assert.equal(body.accounts_affected, 6);
});

test('a request without a session fails instead of calling unauthenticated', async () => {
  installSession({ tenantId: '', syear: '2021' });
  const calls = installFetch();

  const client = await loadClient();

  // `tenantPath` refuses before the call is ever built, so this throws
  // synchronously rather than returning a rejected promise — asserting the
  // wrong one of those would let a regression through unnoticed.
  assert.throws(() => client.fetchFeesIntelligence(), /session is unavailable/i);
  // Nothing may leave the browser without a tenant to scope it to.
  assert.equal(calls.length, 0);
});
