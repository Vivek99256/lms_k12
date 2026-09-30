import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';

import { hitRateLimit } from './rate-limit';
import { isSafeRelayPath } from './request-guards';
import { escapeHtml, sanitizeHtml } from './sanitize-html';
import { checkSessionToken } from './session-token';
import { isTrustedBackendUrl, resolveBackendBaseUrl } from './trusted-backend';

function withEnv(values: Record<string, string | undefined>, run: () => void) {
  const saved: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(values)) {
    saved[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    run();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const b64 = (value: object | string) =>
  Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');

function jwt(payload: object, secret: string) {
  const head = b64({ typ: 'JWT', alg: 'HS256' });
  const body = b64(payload);
  const signature = createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${signature}`;
}

test('trusted backend: configured hosts pass, anything else falls back', () => {
  withEnv(
    {
      NEXT_PUBLIC_API_BASE_URL_PROD: 'https://erp.example.in',
      NEXT_PUBLIC_API_BASE_URL_DEV: 'http://127.0.0.1:8000',
      TRUSTED_BACKEND_ORIGINS: 'https://*.schools.example.in',
    },
    () => {
      assert.equal(isTrustedBackendUrl('https://erp.example.in/'), true);
      assert.equal(isTrustedBackendUrl('https://a.schools.example.in'), true);
      assert.equal(isTrustedBackendUrl('https://attacker.example.com'), false);
      assert.equal(isTrustedBackendUrl('http://169.254.169.254/latest'), false);
      assert.equal(isTrustedBackendUrl('https://user:pw@erp.example.in'), false);
      assert.equal(isTrustedBackendUrl('javascript:alert(1)'), false);
      assert.equal(resolveBackendBaseUrl('https://attacker.example.com', 'https://erp.example.in'), 'https://erp.example.in');
      assert.equal(resolveBackendBaseUrl('https://erp.example.in/', 'https://other'), 'https://erp.example.in');
      assert.equal(resolveBackendBaseUrl('', 'https://erp.example.in/'), 'https://erp.example.in');
    },
  );
});

test('session token: verified with the secret, rejected when tampered or expired', () => {
  const claims = { id: 7, sub_institute_id: 101, is_admin: 1, user_profile_id: 2 };
  withEnv({ LARAVEL_JWT_SECRET: 'test-secret' }, () => {
    const good = checkSessionToken(jwt(claims, 'test-secret'));
    assert.equal(good?.verified, true);
    assert.equal(good?.claims.sub_institute_id, '101');

    assert.equal(checkSessionToken(jwt(claims, 'wrong-secret')), null);
    const [head, , sig] = jwt(claims, 'test-secret').split('.');
    assert.equal(checkSessionToken(`${head}.${b64({ ...claims, sub_institute_id: 202 })}.${sig}`), null);
    assert.equal(checkSessionToken(jwt({ ...claims, exp: 1 }, 'test-secret')), null);
    assert.equal(checkSessionToken('not-a-token'), null);
  });
  withEnv({ LARAVEL_JWT_SECRET: undefined }, () => {
    assert.equal(checkSessionToken(jwt(claims, 'anything'))?.verified, false);
    assert.equal(checkSessionToken(''), null);
  });
});

test('rate limit: allows up to the limit, then refuses until the window resets', () => {
  const key = `test:${Math.random()}`;
  assert.equal(hitRateLimit(key, 2, 1000, 0).allowed, true);
  assert.equal(hitRateLimit(key, 2, 1000, 10).allowed, true);
  const refused = hitRateLimit(key, 2, 1000, 20);
  assert.equal(refused.allowed, false);
  assert.equal(refused.retryAfterSeconds, 1);
  assert.equal(hitRateLimit(key, 2, 1000, 1001).allowed, true);
});

test('relay paths: plain paths pass, traversal and hosts do not', () => {
  assert.equal(isSafeRelayPath('fees/collect'), true);
  assert.equal(isSafeRelayPath('/school_setup/proxy_master'), true);
  assert.equal(isSafeRelayPath('../admin'), false);
  assert.equal(isSafeRelayPath('fees/%2e%2e/admin'), false);
  assert.equal(isSafeRelayPath('//evil.example'), false);
  assert.equal(isSafeRelayPath('https://evil.example'), false);
  assert.equal(isSafeRelayPath('a\\b'), false);
});

test('sanitizeHtml keeps formatting and safe embeds, removes script', () => {
  const clean = sanitizeHtml(
    '<p style="color:red" onclick="x()">Hi<img src="x" onerror="alert(1)"><script>alert(2)</script></p>' +
      '<iframe src="https://www.youtube.com/embed/abc"></iframe><iframe src="https://evil.example/x"></iframe>' +
      '<link rel="stylesheet" href="https://cdn.example/print.css"><link rel="import" href="https://evil.example/x">' +
      '<a href="javascript:alert(1)">x</a>',
  );
  assert.match(clean, /style="color:red"/);
  assert.doesNotMatch(clean, /onclick|onerror|<script|javascript:|evil\.example/);
  assert.match(clean, /youtube\.com\/embed\/abc/);
  assert.match(clean, /print\.css/);

  const doc = sanitizeHtml('<html><head><style>h1{color:red}</style></head><body><h1>T</h1></body></html>', { document: true });
  assert.match(doc, /<style>h1\{color:red\}<\/style>/);
  assert.equal(escapeHtml('<b a="1">&</b>'), '&lt;b a=&quot;1&quot;&gt;&amp;&lt;/b&gt;');
});
