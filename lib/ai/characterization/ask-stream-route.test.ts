/**
 * Characterization of the chat transport route (`app/api/ai/ask/stream/route.ts`): what it
 * forwards upstream, how it falls back, how it reports failure, and what it short-circuits
 * without calling Laravel at all. This is the wire behaviour a universal `ChatEngine` adapter
 * for LMS K12 must keep producing; the route itself stays in LMS K12.
 *
 * `POST` is called directly with a real `Request`; only the upstream `fetch` is stubbed.
 */
import { strict as assert } from 'node:assert';
import { afterEach, before, describe, it } from 'node:test';

import { headersOf, stubFetch, type FetchStub, type RecordedCall } from './browser-env';

const ERP = 'https://erp-fallback.example.test';
let POST: (request: Request) => Promise<Response>;
let stub: FetchStub | null = null;

before(async () => {
  process.env.NEXT_PUBLIC_APP_ENV = 'development';
  process.env.NEXT_PUBLIC_API_BASE_URL_DEV = ERP;
  delete process.env.NEXT_PUBLIC_AI_BASE_URL;
  delete process.env.AI_UPSTREAM_BASE_URL;
  console.error = () => undefined;
  ({ POST } = await import('../../../app/api/ai/ask/stream/route'));
});

afterEach(() => {
  stub?.restore();
  stub = null;
  delete process.env.AI_UPSTREAM_BASE_URL;
});

function ask(body: unknown, headers: Record<string, string> = { authorization: 'Bearer tok', 'x-mcp-institute-id': '3' }, signal?: AbortSignal) {
  return POST(
    new Request('http://localhost/api/ai/ask/stream', {
      method: 'POST',
      headers,
      body: typeof body === 'string' ? body : JSON.stringify(body),
      signal,
    }),
  );
}

const QUESTION = { question: 'Who has low attendance this week?', route: '/dashboard', module: 'attendance' };

/** A stage and a final answer, as Laravel's `/ask/stream` frames them. */
const SSE =
  'event: stage\ndata: {"key":"conversation","order":1,"layer":"l","status":"ran","summary":"s"}\n\n' +
  'event: done\ndata: {"conversation":{"id":5,"reference":"R","turn_id":9,"turn":1},"question":"q","intent":{"key":"k","label":"L","confidence":1,"slots":{}},' +
  '"answer":{"headline":"Hello","sections":[],"actions":[],"follow_ups":[]},"trace":[],"ladder":[],"stage_counts":{},"lifecycle_trace":[],"lifecycle_stage_counts":{},' +
  '"module":{"key":"attendance","label":"Attendance","entity_key":null,"capabilities":{},"mcp_tools":[],"agent_key":null,"workflow_key":null,"case_type":null,"reaches_recommendation":false,"reaches_action":false},' +
  '"links":{},"duration_ms":1}\n\n';

const sse = (): { status: number; body: string } => ({ status: 200, body: SSE });

/** The chunk `type`s the browser would receive, in order. */
async function chunkTypes(response: Response): Promise<string[]> {
  const text = await response.text();
  return text
    .split('\n')
    .filter((line) => line.startsWith('data: ') && line !== 'data: [DONE]')
    .map((line) => (JSON.parse(line.slice(6)) as { type: string }).type);
}

describe('ask/stream route: what it forwards upstream', () => {
  it('posts the body verbatim to /api/ai/ask/stream with the caller’s token and institute', async () => {
    stub = stubFetch(sse);
    await ask(QUESTION);
    const call = stub.calls[0] as RecordedCall;
    assert.equal(call.url, `${ERP}/api/ai/ask/stream`);
    assert.equal(call.init.method, 'POST');
    assert.equal(call.init.body, JSON.stringify(QUESTION));
    const headers = headersOf(call);
    assert.equal(headers.Authorization, 'Bearer tok');
    assert.equal(headers['X-MCP-Institute-Id'], '3');
    assert.equal(headers.Accept, 'text/event-stream');
    assert.equal(headers['Content-Type'], 'application/json');
    assert.equal(call.init.cache, 'no-store');
  });

  it('adds no authority of its own: absent headers stay absent', async () => {
    stub = stubFetch(sse);
    await ask(QUESTION, {});
    const headers = headersOf(stub.calls[0] as RecordedCall);
    assert.equal('Authorization' in headers, false);
    assert.equal('X-MCP-Institute-Id' in headers, false);
  });

  it('uses the server-only upstream URL when one is set, ahead of the AI/ERP host', async () => {
    process.env.AI_UPSTREAM_BASE_URL = ' https://internal.example.test/ ';
    stub = stubFetch(sse);
    await ask(QUESTION);
    assert.equal((stub.calls[0] as RecordedCall).url, 'https://internal.example.test/api/ai/ask/stream');
  });

  it('never takes the upstream host from the request', async () => {
    stub = stubFetch(sse);
    await ask({ ...QUESTION, baseUrl: 'https://evil.example.test', upstream: 'https://evil.example.test' });
    assert.ok((stub.calls[0] as RecordedCall).url.startsWith(ERP));
  });
});

describe('ask/stream route: translating the stream', () => {
  it('turns Laravel SSE into UI message chunks: a stage, the answer, and a finish', async () => {
    stub = stubFetch(sse);
    const response = await ask(QUESTION);
    assert.equal(response.status, 200);
    const types = await chunkTypes(response);
    assert.ok(types.includes('data-stage'), `got ${types.join(',')}`);
    assert.ok(types.includes('data-ask'), `got ${types.join(',')}`);
    assert.equal(types.at(-1), 'finish');
  });
});

describe('ask/stream route: fallback and failure', () => {
  it('retries on /api/ai/ask as JSON when the stream route is 404 or 405', async () => {
    for (const status of [404, 405]) {
      stub = stubFetch((call) =>
        call.url.endsWith('/ask/stream')
          ? { status, body: 'not found' }
          : { status: 200, body: JSON.stringify({ success: true, data: JSON.parse(SSE.split('event: done\ndata: ')[1]!.split('\n\n')[0]!) }) },
      );
      const response = await ask(QUESTION);
      assert.equal(stub.calls.length, 2, `status ${status}`);
      assert.equal((stub.calls[1] as RecordedCall).url, `${ERP}/api/ai/ask`);
      assert.equal(headersOf(stub.calls[1] as RecordedCall).Accept, 'application/json');
      assert.ok((await chunkTypes(response)).includes('data-ask'));
      stub.restore();
    }
    stub = null;
  });

  it('answers 502 with a readable message when the fallback body is not an answer', async () => {
    stub = stubFetch((call) => (call.url.endsWith('/ask/stream') ? { status: 404, body: 'x' } : { status: 200, body: 'not json' }));
    const response = await ask(QUESTION);
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: 'The assistant returned an answer this app could not read.' });
  });

  it('passes an upstream JSON error through verbatim with its status', async () => {
    const detail = JSON.stringify({ success: false, message: 'Blocked', code: 'policy_denied' });
    stub = stubFetch(() => ({ status: 403, body: detail, headers: { 'content-type': 'application/json' } }));
    const response = await ask(QUESTION);
    assert.equal(response.status, 403);
    assert.equal(await response.text(), detail);
  });

  it('replaces a non-JSON upstream error with a JSON one that carries the status', async () => {
    stub = stubFetch(() => ({ status: 500, body: '<html>boom</html>', headers: { 'content-type': 'text/html' } }));
    const response = await ask(QUESTION);
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'The assistant API answered 500.' });
  });

  it('names the host that answered when it has no /api/ai routes (HTML 404)', async () => {
    stub = stubFetch(() => ({ status: 404, body: '<html>not found</html>' }));
    // 404 on the stream triggers the /ask fallback, which also 404s.
    const response = await ask(QUESTION);
    assert.equal(response.status, 404);
    const { error } = (await response.json()) as { error: string };
    assert.match(error, /has no \/api\/ai routes at https:\/\/erp-fallback\.example\.test/);
  });

  it('answers 502 "unreachable" when the upstream cannot be reached', async () => {
    stub = stubFetch(() => {
      throw new Error('connection refused');
    });
    const response = await ask(QUESTION);
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: 'The assistant is unreachable.' });
  });

  it('answers 499 with no body when the client has already gone away', async () => {
    const controller = new AbortController();
    controller.abort();
    stub = stubFetch(() => {
      throw new Error('aborted');
    });
    const response = await ask(QUESTION, { authorization: 'Bearer tok' }, controller.signal);
    assert.equal(response.status, 499);
  });
});

describe('ask/stream route: answers it gives without calling Laravel', () => {
  it('opens a client-resolved same-origin navigation target and makes no upstream call', async () => {
    stub = stubFetch(sse);
    const response = await ask({
      question: 'open it',
      route: '/dashboard',
      navigation: { route: '/fees/collect', headline: 'Fee collection', actionLabel: 'Open', module: { name: 'fees', label: 'Fees' } },
    });
    assert.equal(stub.calls.length, 0);
    assert.equal(response.status, 200);
    const types = await chunkTypes(response);
    assert.ok(types.includes('data-ask'));
  });

  it('refuses a navigation target that is not a same-origin path and goes upstream instead', async () => {
    for (const route of ['https://evil.example.test/x', '//evil.example.test/x', 'relative/path']) {
      stub = stubFetch(sse);
      await ask({ ...QUESTION, navigation: { route } });
      assert.equal(stub.calls.length, 1, route);
      stub.restore();
    }
    stub = null;
  });
});
