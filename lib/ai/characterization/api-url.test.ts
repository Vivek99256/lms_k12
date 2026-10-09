/**
 * Characterization of `app/components/utils/api_url.tsx` — how an LMS K12 request decides which
 * backend it talks to, locally and live.
 *
 * The module computes its constants once, at load, from `process.env` and `window`, so each case
 * runs it in a fresh Node process (`api-url-probe.ts`) under exactly the environment it wants.
 * These tests pin today's behaviour, including the order of precedence that the universal core's
 * `AiTransportPort.apiBase()` must reproduce for LMS K12.
 */
import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

interface Probe {
  API_BASE_URL: string;
  AI_API_BASE_URL: string;
  AI_API_BASE_URL_OVERRIDE: string;
  resolved: string[];
}

// The suite runs from the repository root (see the `test` script in package.json).
const PROBE = resolve(process.cwd(), 'lib/ai/characterization/api-url-probe.ts');
const MANAGED = ['NEXT_PUBLIC_APP_ENV', 'NEXT_PUBLIC_API_BASE_URL_DEV', 'NEXT_PUBLIC_API_BASE_URL_PROD', 'NEXT_PUBLIC_AI_BASE_URL', 'NODE_ENV'];

/** Runs the module in a fresh process. `hostname: null` means no `window` (a server). */
function load(env: Record<string, string>, hostname: string | null = 'localhost', hints: Array<string | null | undefined> = []): Probe {
  const childEnv: Record<string, string | undefined> = { ...process.env };
  for (const key of MANAGED) delete childEnv[key];
  Object.assign(childEnv, env);

  const out = execFileSync(process.execPath, ['--import', 'tsx', PROBE, hostname ?? 'none', JSON.stringify(hints)], {
    env: childEnv as NodeJS.ProcessEnv,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return JSON.parse(out) as Probe;
}

const DEV = 'https://dev.example.test';
const PROD = 'https://prod.example.test';
const BOTH = { NEXT_PUBLIC_API_BASE_URL_DEV: DEV, NEXT_PUBLIC_API_BASE_URL_PROD: PROD };

describe('api_url: which environment is "production"', () => {
  it('an explicit NEXT_PUBLIC_APP_ENV=production wins over a local hostname', () => {
    assert.equal(load({ ...BOTH, NEXT_PUBLIC_APP_ENV: 'production' }, 'localhost').API_BASE_URL, PROD);
  });

  it('NEXT_PUBLIC_APP_ENV=development or staging wins over a public hostname', () => {
    for (const declared of ['development', 'staging', ' Staging ']) {
      assert.equal(load({ ...BOTH, NEXT_PUBLIC_APP_ENV: declared }, 'erp.example.com').API_BASE_URL, DEV, JSON.stringify(declared));
    }
  });

  it('with nothing declared, local-looking hostnames are development', () => {
    for (const hostname of ['localhost', '127.0.0.1', '192.168.1.20', '10.0.0.5', 'box.local', 'app.test', '172.16.0.1', '172.31.9.9']) {
      assert.equal(load(BOTH, hostname).API_BASE_URL, DEV, hostname);
    }
  });

  it('with nothing declared, any other hostname is production', () => {
    for (const hostname of ['erp.example.com', '172.15.0.1', '172.32.0.1', '11.0.0.1']) {
      assert.equal(load(BOTH, hostname).API_BASE_URL, PROD, hostname);
    }
  });

  it('on the server it follows NODE_ENV', () => {
    assert.equal(load({ ...BOTH, NODE_ENV: 'production' }, null).API_BASE_URL, PROD);
    assert.equal(load({ ...BOTH, NODE_ENV: 'development' }, null).API_BASE_URL, DEV);
  });

  it('trims whitespace and one trailing slash, and is empty when unset', () => {
    assert.equal(load({ NEXT_PUBLIC_APP_ENV: 'production', NEXT_PUBLIC_API_BASE_URL_PROD: `  ${PROD}/  ` }).API_BASE_URL, PROD);
    assert.equal(load({ NEXT_PUBLIC_APP_ENV: 'production' }).API_BASE_URL, '');
  });
});

describe('api_url: where an AI call goes (resolveAiBaseUrl)', () => {
  const base = { NEXT_PUBLIC_APP_ENV: 'development', NEXT_PUBLIC_API_BASE_URL_DEV: DEV };
  const AI = 'https://ai.example.test';
  const LOGIN = 'https://login-host.example.test';

  it('an explicitly named AI host beats the session host and the ERP host', () => {
    const m = load({ ...base, NEXT_PUBLIC_AI_BASE_URL: `${AI}/` }, 'localhost', [LOGIN, null]);
    assert.deepEqual(m.resolved, [AI, AI]);
    assert.equal(m.AI_API_BASE_URL_OVERRIDE, AI);
    assert.equal(m.AI_API_BASE_URL, AI);
  });

  it('with no AI host named, the session host (trailing slash trimmed) beats the ERP host', () => {
    const m = load(base, 'localhost', [`${LOGIN}/`]);
    assert.deepEqual(m.resolved, [LOGIN]);
    assert.equal(m.AI_API_BASE_URL_OVERRIDE, '');
    assert.equal(m.AI_API_BASE_URL, DEV, 'the constant falls back to the ERP host');
  });

  it('with neither, it falls back to the ERP host; blank and missing session hosts count as neither', () => {
    const m = load(base, 'localhost', [undefined, null, '', '   ']);
    assert.deepEqual(m.resolved, [DEV, DEV, DEV, DEV]);
  });

  it('local and live resolve independently from the same code', () => {
    assert.deepEqual(load(BOTH, 'localhost', [null]).resolved, [DEV]);
    assert.deepEqual(load(BOTH, 'erp.example.com', [null]).resolved, [PROD]);
  });
});
