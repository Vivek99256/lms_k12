/**
 * Characterization of LMS K12's AI API clients.
 *
 * Six clients under lib/intelligence each carry their own copy of the same transport (read the
 * session, resolve the host, send a bearer token and an optional institute header, unwrap the
 * `{success, message, data}` envelope). They agree on the request and DISAGREE on how they
 * report failure — different error classes, different messages, one honours field errors and
 * the others do not. Both halves are pinned here so that moving them onto one shared transport
 * can be checked against what each caller sees today.
 *
 * The two context-based clients (`client.ts`, `workspace.ts`) take an explicit context instead
 * of reading storage; their headers and body `meta` are pinned at the bottom.
 */
import { strict as assert } from 'node:assert';
import { afterEach, before, describe, it } from 'node:test';

import { headersOf, installBrowser, okEnvelope, stubFetch, type FakeResponse, type FetchStub, type RecordedCall } from './browser-env';

const ERP = 'https://erp-fallback.example.test';
const LOGIN = 'https://login-host.example.test';
let restoreEnv: (() => void) | null = null;
let stub: FetchStub | null = null;

afterEach(() => {
  stub?.restore();
  restoreEnv?.();
  stub = null;
  restoreEnv = null;
});

before(() => {
  process.env.NEXT_PUBLIC_APP_ENV = 'development';
  process.env.NEXT_PUBLIC_API_BASE_URL_DEV = ERP;
  delete process.env.NEXT_PUBLIC_AI_BASE_URL;
  console.error = () => undefined;
});

interface ClientCase {
  name: string;
  /** Performs one representative call against the client. */
  run: () => Promise<unknown>;
  method: string;
  path: string;
  signedOut: { message: string; status?: number };
  /** The class name `error.name` should carry, or 'Error' for a plain Error. */
  errorName: string;
  nonJson: string;
  /** Message when a failed envelope has no message of its own. */
  fallback: (status: number) => string;
  hasBody?: boolean;
}

const cases: ClientCase[] = [
  {
    name: 'ai-capabilities',
    run: async () => (await import('../../intelligence/ai-capabilities')).fetchCapabilities(),
    method: 'GET',
    path: '/api/ai/capabilities',
    signedOut: { message: 'Sign in to view AI capabilities.', status: 401 },
    errorName: 'AiCapabilityError',
    nonJson: 'The AI console returned a non-JSON response.',
    fallback: (s) => `The AI console request failed (${s}).`,
  },
  {
    name: 'ai-configuration',
    run: async () => (await import('../../intelligence/ai-configuration')).fetchAiConfigurationOptions(),
    method: 'GET',
    path: '/api/ai/configuration/options',
    signedOut: { message: 'Sign in to manage AI configuration.', status: 401 },
    errorName: 'AiConfigurationError',
    nonJson: 'The AI console returned a non-JSON response.',
    fallback: (s) => `The request failed (${s}).`,
  },
  {
    name: 'ai-policies',
    run: async () => (await import('../../intelligence/ai-policies')).fetchAiPolicyOptions(),
    method: 'GET',
    path: '/api/ai/policies/options',
    signedOut: { message: 'Sign in to manage AI policies.' },
    errorName: 'Error',
    nonJson: 'The AI console returned a non-JSON response.',
    fallback: (s) => `The request failed (${s}).`,
  },
  {
    name: 'ai-templates',
    run: async () => (await import('../../intelligence/ai-templates')).fetchTemplateOptions(),
    method: 'GET',
    path: '/api/ai/templates/options',
    signedOut: { message: 'Sign in to manage AI templates.' },
    errorName: 'Error',
    nonJson: 'The AI console returned a non-JSON response.',
    fallback: (s) => `The request failed (${s}).`,
  },
  {
    name: 'ai-module',
    run: async () => (await import('../../intelligence/ai-module')).fetchModuleUsage('fees'),
    method: 'GET',
    path: '/api/ai/modules/fees/usage',
    signedOut: { message: 'Sign in to read AI usage for this module.' },
    errorName: 'Error',
    nonJson: 'The AI console returned a non-JSON response.',
    fallback: (s) => `The request failed (${s}).`,
  },
  {
    name: 'ai-generate',
    run: async () => (await import('../../intelligence/ai-generate')).generateContent({ template_key: 'tpl', purpose: 'why' }),
    method: 'POST',
    path: '/api/ai/generate',
    signedOut: { message: 'Sign in to use AI assistance.', status: 401 },
    errorName: 'AiGenerationError',
    nonJson: 'The AI service returned a non-JSON response.',
    fallback: (s) => `Generation failed (${s}).`,
    hasBody: true,
  },
];

const SESSION = {
  userData: JSON.stringify({ user_token: 'tok', sub_institute_id: 3, host_name: LOGIN }),
};

function signedIn(respond: (call: RecordedCall) => FakeResponse, local: Record<string, string> = SESSION) {
  restoreEnv = installBrowser({ local });
  stub = stubFetch(respond);
  return stub;
}

for (const c of cases) {
  describe(`${c.name}: transport`, () => {
    it('is signed-out without a token: throws its own message and makes no request', async () => {
      restoreEnv = installBrowser();
      stub = stubFetch(() => okEnvelope(null));
      await assert.rejects(c.run, (error: Error & { status?: number }) => {
        assert.equal(error.message, c.signedOut.message);
        if (c.signedOut.status) assert.equal(error.status, c.signedOut.status);
        return true;
      });
      assert.equal(stub.calls.length, 0);
    });

    it('sends to the login host, with a bearer token and the institute, and unwraps data', async () => {
      const s = signedIn(() => okEnvelope({ value: 1 }));
      assert.deepEqual(await c.run(), { value: 1 });
      const call = s.calls[0] as RecordedCall;
      assert.equal(call.url, `${LOGIN}${c.path}`);
      assert.equal(call.init.method, c.method);
      assert.equal(call.init.cache, 'no-store');
      const headers = headersOf(call);
      assert.equal(headers.Authorization, 'Bearer tok');
      assert.equal(headers['X-MCP-Institute-Id'], '3');
      assert.equal(headers.Accept, 'application/json');
      assert.equal('Content-Type' in headers, Boolean(c.hasBody));
    });

    it('falls back to the configured ERP host when the login names none, and omits a blank institute', async () => {
      const s = signedIn(() => okEnvelope({}), { userData: JSON.stringify({ token: 'tok', sub_institute_id: '  ' }) });
      await c.run();
      const call = s.calls[0] as RecordedCall;
      assert.equal(call.url, `${ERP}${c.path}`);
      assert.equal('X-MCP-Institute-Id' in headersOf(call), false);
    });

    it('reports a non-JSON body and a failed envelope in its own words', async () => {
      signedIn(() => ({ status: 502, body: '<html>' }));
      await assert.rejects(c.run, (error: Error) => error.message === c.nonJson);
      stub?.restore();

      stub = stubFetch(() => ({ status: 422, body: JSON.stringify({ success: false, message: 'Rejected' }) }));
      await assert.rejects(c.run, (error: Error & { status?: number }) => {
        assert.equal(error.message, 'Rejected');
        assert.equal(error.name, c.errorName);
        return true;
      });
      stub.restore();

      stub = stubFetch(() => ({ status: 500, body: JSON.stringify({ success: false }) }));
      await assert.rejects(c.run, (error: Error) => error.message === c.fallback(500));
      stub.restore();

      stub = stubFetch(() => ({ status: 200, body: JSON.stringify({ success: false, message: 'Soft failure' }) }));
      await assert.rejects(c.run, (error: Error) => error.message === 'Soft failure');
    });
  });
}

describe('where the six clients disagree on failure', () => {
  it('ai-configuration keeps field errors; ai-capabilities and ai-generate keep only the status', async () => {
    signedIn(() => ({ status: 422, body: JSON.stringify({ success: false, message: 'Invalid', errors: { model: ['Pick a model'] } }) }));
    const { fetchAiConfigurationOptions } = await import('../../intelligence/ai-configuration');
    await assert.rejects(
      () => fetchAiConfigurationOptions(),
      (error: Error & { status?: number; fieldErrors?: Record<string, string[]> }) =>
        error.status === 422 && error.fieldErrors?.model?.[0] === 'Pick a model',
    );

    const { generateContent } = await import('../../intelligence/ai-generate');
    await assert.rejects(
      () => generateContent({ template_key: 't', purpose: 'p' }),
      (error: Error & { status?: number; detail?: unknown; refusedByPolicy?: boolean }) =>
        error.status === 422 && (error.detail as { model?: string[] }).model?.[0] === 'Pick a model' && error.refusedByPolicy === false,
    );
  });

  it('ai-templates surfaces the first validation sentence instead of the generic message', async () => {
    signedIn(() => ({ status: 422, body: JSON.stringify({ success: false, message: 'The request was not valid.', errors: { body: ['Add at least one data variable'] } }) }));
    const { fetchTemplateOptions } = await import('../../intelligence/ai-templates');
    await assert.rejects(() => fetchTemplateOptions(), /Add at least one data variable/);
  });

  it('ai-policies ignores validation detail and shows only the generic message', async () => {
    signedIn(() => ({ status: 422, body: JSON.stringify({ success: false, message: 'The request was not valid.', errors: { name: ['Name is required'] } }) }));
    const { fetchAiPolicyOptions } = await import('../../intelligence/ai-policies');
    await assert.rejects(() => fetchAiPolicyOptions(), (error: Error) => error.message === 'The request was not valid.');
  });

  it('ai-generate marks a 403 as refused by policy', async () => {
    signedIn(() => ({ status: 403, body: JSON.stringify({ success: false, message: 'Policy says no' }) }));
    const { generateContent } = await import('../../intelligence/ai-generate');
    await assert.rejects(
      () => generateContent({ template_key: 't', purpose: 'p' }),
      (error: Error & { refusedByPolicy?: boolean }) => error.refusedByPolicy === true,
    );
  });

  it('ai-generate posts its input as the JSON body', async () => {
    const s = signedIn(() => okEnvelope({}));
    const { generateContent } = await import('../../intelligence/ai-generate');
    await generateContent({ template_key: 'tpl', purpose: 'why', variables: { a: 1 } });
    assert.equal((s.calls[0] as RecordedCall).init.body, JSON.stringify({ template_key: 'tpl', purpose: 'why', variables: { a: 1 } }));
  });
});

describe('the context-based clients (client.ts, workspace.ts)', () => {
  it('client.ts: bearer and institute only when given, relative-to-host /api/ai paths, meta in POST bodies', async () => {
    restoreEnv = installBrowser();
    stub = stubFetch(() => okEnvelope({ ok: true }));
    const { listIntents, ask } = await import('../../intelligence/client');

    await listIntents({ token: 'tok', baseUrl: LOGIN, instituteId: 3 });
    const get = stub.calls[0] as RecordedCall;
    assert.equal(get.url, `${LOGIN}/api/ai/ask/intents`);
    assert.equal(headersOf(get).Authorization, 'Bearer tok');
    assert.equal(headersOf(get)['X-MCP-Institute-Id'], '3');

    await listIntents({});
    const bare = headersOf(stub.calls[1] as RecordedCall);
    assert.equal('Authorization' in bare, false);
    assert.equal('X-MCP-Institute-Id' in bare, false);
    assert.ok((stub.calls[1] as RecordedCall).url.startsWith(ERP), 'no host given: the configured ERP host');

    await ask({ token: 'tok', baseUrl: LOGIN, instituteId: '3', academicYear: 2026, termId: ' ' }, 'hello', { module: 'fees', route: '/fees' });
    const post = stub.calls[2] as RecordedCall;
    assert.equal(post.init.method, 'POST');
    assert.equal(headersOf(post)['Content-Type'], 'application/json');
    const body = JSON.parse(String(post.init.body)) as Record<string, unknown>;
    assert.deepEqual(body.meta, { institute_id: 3, academic_year: 2026 }, 'a blank term is left out');
    assert.equal(body.question, 'hello');
    assert.equal(body.module, 'fees');
    assert.equal(body.route, '/fees');
    assert.equal(body.conversation_id, null);
  });

  it('client.ts: failures are plain Errors carrying the envelope message', async () => {
    restoreEnv = installBrowser();
    stub = stubFetch(() => ({ status: 403, body: JSON.stringify({ success: false, message: 'Policy says no' }) }));
    const { listIntents } = await import('../../intelligence/client');
    await assert.rejects(() => listIntents({ token: 't', baseUrl: LOGIN }), (e: Error) => e.message === 'Policy says no');
    stub.restore();
    stub = stubFetch(() => ({ status: 500, body: '<html>' }));
    await assert.rejects(() => listIntents({ token: 't', baseUrl: LOGIN }), /non-JSON/);
  });

  it('workspace.ts: posts to /api/ai/workspace with institute, year and term as numeric meta', async () => {
    restoreEnv = installBrowser();
    stub = stubFetch(() => okEnvelope({}));
    const { fetchWorkspaceContext } = await import('../../intelligence/workspace');
    await fetchWorkspaceContext({ token: 'tok', baseUrl: LOGIN, instituteId: '3', academicYear: '2026', termId: '2' }, { route: '/fees' });
    const call = stub.calls[0] as RecordedCall;
    assert.equal(call.url, `${LOGIN}/api/ai/workspace/context`);
    assert.equal(headersOf(call)['X-MCP-Institute-Id'], '3');
    const body = JSON.parse(String(call.init.body)) as Record<string, unknown>;
    assert.equal(body.route, '/fees');
    assert.deepEqual(body.meta, { institute_id: 3, academic_year: 2026, term_id: 2 });
  });
});
