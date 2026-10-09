/**
 * Characterization of how LMS K12 reads the signed-in session for AI calls.
 *
 * There are two readers with deliberately different rules, and both are pinned here exactly as
 * they behave today because the universal core's `AiTransportPort.session()` has to reproduce
 * LMS K12's behaviour through its adapter:
 *
 *  - `readAiSession` (lib/ai/session.ts): skips empty values, so a blank `user_token` falls
 *    through to the next candidate.
 *  - the per-client readers in lib/intelligence/ai-*.ts: use `??`, so a blank `user_token` in
 *    `userData` is a present value and wins — which yields no session at all.
 *
 * Neither is "right"; the point of this file is that a refactor cannot change one silently.
 */
import { strict as assert } from 'node:assert';
import { afterEach, before, describe, it } from 'node:test';

import { headersOf, installBrowser, installServer, okEnvelope, stubFetch, type FetchStub } from './browser-env';

const ERP = 'https://erp-fallback.example.test';
const json = (value: unknown) => JSON.stringify(value);

let restoreEnv: (() => void) | null = null;
let stub: FetchStub | null = null;

afterEach(() => {
  stub?.restore();
  stub = null;
  restoreEnv?.();
  restoreEnv = null;
});

describe('readAiSession (lib/ai/session.ts)', () => {
  let readAiSession: () => null | { token: string; instituteId: string; userId: string; baseUrl: string };

  before(async () => {
    ({ readAiSession } = await import('../session'));
  });

  it('is null on the server', () => {
    restoreEnv = installServer();
    assert.equal(readAiSession(), null);
  });

  it('is null with no token, with an empty store, and with malformed JSON', () => {
    restoreEnv = installBrowser();
    assert.equal(readAiSession(), null);
    restoreEnv();
    restoreEnv = installBrowser({ local: { userData: json({ sub_institute_id: '3' }) } });
    assert.equal(readAiSession(), null);
    restoreEnv();
    restoreEnv = installBrowser({ local: { userData: '{not json' } });
    assert.equal(readAiSession(), null);
  });

  it('takes the token from userData.user_token, then userData.token, then menuContext', () => {
    const cases: Array<[Record<string, string>, string]> = [
      [{ userData: json({ user_token: 'a', token: 'b' }), menuContext: json({ user_token: 'c' }) }, 'a'],
      [{ userData: json({ token: 'b' }), menuContext: json({ user_token: 'c' }) }, 'b'],
      [{ userData: json({}), menuContext: json({ user_token: 'c', token: 'd' }) }, 'c'],
      [{ userData: json({}), menuContext: json({ token: 'd' }) }, 'd'],
    ];
    for (const [local, expected] of cases) {
      restoreEnv = installBrowser({ local });
      assert.equal(readAiSession()?.token, expected);
      restoreEnv();
      restoreEnv = null;
    }
  });

  it('skips blank values, so an empty user_token falls through to the next candidate', () => {
    restoreEnv = installBrowser({ local: { userData: json({ user_token: '  ', token: 'b' }) } });
    assert.equal(readAiSession()?.token, 'b');
  });

  it('reads institute, user and host, preferring userData and falling back to menuContext', () => {
    restoreEnv = installBrowser({
      local: {
        userData: json({ user_token: 't', id: 7, host_name: ' https://login.example.test ' }),
        menuContext: json({ sub_institute_id: 42, user_id: 99 }),
      },
    });
    assert.deepEqual(readAiSession(), { token: 't', instituteId: '42', userId: '7', baseUrl: 'https://login.example.test' });
  });

  it('never invents a tenant: with no institute anywhere it is the empty string', () => {
    restoreEnv = installBrowser({ local: { userData: json({ user_token: 't' }) } });
    assert.equal(readAiSession()?.instituteId, '');
  });
});

describe('the per-client readers in lib/intelligence/ai-*.ts', () => {
  let fetchCapabilities: () => Promise<unknown>;

  before(async () => {
    process.env.NEXT_PUBLIC_APP_ENV = 'development';
    process.env.NEXT_PUBLIC_API_BASE_URL_DEV = ERP;
    delete process.env.NEXT_PUBLIC_AI_BASE_URL;
    console.error = () => undefined;
    ({ fetchCapabilities } = await import('../../intelligence/ai-capabilities'));
  });

  /** Runs one call and returns the single request it made, or null if none was made. */
  async function attempt(local: Record<string, string>) {
    restoreEnv = installBrowser({ local });
    stub = stubFetch(() => okEnvelope({}));
    await fetchCapabilities().catch(() => undefined);
    return stub.calls[0] ?? null;
  }

  it('uses ?? semantics: a blank userData.user_token is a value, so there is no session and no request', async () => {
    assert.equal(await attempt({ userData: json({ user_token: '', token: 'b' }) }), null);
  });

  it('falls back from userData to menuContext only when userData has no token field at all', async () => {
    const call = await attempt({ userData: json({}), menuContext: json({ token: 'from-menu' }) });
    assert.equal(headersOf(call!).Authorization, 'Bearer from-menu');
  });

  it('takes the host from userData.host_name only, never from menuContext', async () => {
    const withHost = await attempt({ userData: json({ token: 't', host_name: 'https://login.example.test' }) });
    assert.ok(withHost!.url.startsWith('https://login.example.test/api/ai/capabilities'));
    const menuHost = await attempt({ userData: json({ token: 't' }), menuContext: json({ host_name: 'https://menu.example.test' }) });
    assert.ok(menuHost!.url.startsWith(`${ERP}/api/ai/capabilities`), 'falls back to the configured ERP host');
  });

  it('sends the institute header only when the session carries one', async () => {
    const withTenant = await attempt({ userData: json({ token: 't', sub_institute_id: 3 }) });
    assert.equal(headersOf(withTenant!)['X-MCP-Institute-Id'], '3');
    const without = await attempt({ userData: json({ token: 't' }) });
    assert.equal('X-MCP-Institute-Id' in headersOf(without!), false);
    const blank = await attempt({ userData: json({ token: 't', sub_institute_id: '   ' }) });
    assert.equal('X-MCP-Institute-Id' in headersOf(blank!), false);
  });
});

describe('the agent browser session (lib/agents/client.ts)', () => {
  let client: typeof import('../../agents/client');

  before(async () => {
    process.env.NEXT_PUBLIC_APP_ENV = 'development';
    process.env.NEXT_PUBLIC_API_BASE_URL_DEV = ERP;
    console.error = () => undefined;
    client = await import('../../agents/client');
  });

  it('reads sessionStorage before localStorage, and records in a fixed key order', () => {
    restoreEnv = installBrowser({
      local: { userData: json({ token: 'local-token', sub_institute_id: '1' }) },
      session: { userData: json({ token: 'session-token' }), menuContext: json({ sub_institute_id: '2' }) },
    });
    const s = client.readAgentBrowserSession();
    assert.equal(s.token, 'session-token');
    assert.equal(s.subInstituteId, '2', 'a field missing from sessionStorage userData is taken from the next record that has it');
  });

  it('reads identifiers, accepting numbers and alternative key spellings', () => {
    restoreEnv = installBrowser({
      local: {
        userData: json({ user_token: 't', user_id: 5, first_name: 'A', user_profile_id: 9, profile_name: 'Admin', term_id: 3 }),
        sessionData: json({ syear: '2026' }),
      },
    });
    const s = client.readAgentBrowserSession();
    assert.equal(s.userId, '5');
    assert.equal(s.userName, 'A');
    assert.equal(s.userProfileId, '9');
    assert.equal(s.userProfileName, 'Admin');
    assert.equal(s.termId, '3');
    assert.equal(s.academicYear, '2026');
  });

  it('prefers a bare selectedAcademicYear over the year inside a record', () => {
    restoreEnv = installBrowser({ local: { userData: json({ token: 't', syear: '2025' }), selectedAcademicYear: '2027' } });
    assert.equal(client.readAgentBrowserSession().academicYear, '2027');
  });

  it('puts the configured ERP host ahead of the login host (the opposite of resolveAiBaseUrl)', () => {
    restoreEnv = installBrowser({ local: { userData: json({ token: 't', host_name: 'https://login.example.test/' }) } });
    assert.equal(client.readAgentBrowserSession().baseUrl, ERP);
  });

  it('returns an empty session on the server', () => {
    restoreEnv = installServer();
    const s = client.readAgentBrowserSession();
    assert.equal(s.token, '');
    assert.equal(s.baseUrl, ERP);
  });

  it('builds x-* headers only for fields that are present', () => {
    const session = { ...emptySession(), token: 'tok', subInstituteId: '3', userId: '6', baseUrl: ERP };
    const headers = client.buildSessionHeaders(session);
    assert.equal(headers.get('accept'), 'application/json');
    assert.equal(headers.get('x-laravel-token'), 'tok');
    assert.equal(headers.get('x-sub-institute-id'), '3');
    assert.equal(headers.get('x-user-id'), '6');
    assert.equal(headers.get('x-laravel-base-url'), ERP);
    assert.equal(headers.has('x-user-name'), false);
    assert.equal(headers.has('x-academic-year'), false);
    assert.equal(headers.has('content-type'), false);
    assert.equal(client.buildSessionHeaders(session, true).get('content-type'), 'application/json');
  });
});

function emptySession() {
  return {
    baseUrl: '',
    token: '',
    subInstituteId: '',
    userId: '',
    userName: '',
    userProfileId: '',
    userProfileName: '',
    academicYear: '',
    termId: '',
  };
}
