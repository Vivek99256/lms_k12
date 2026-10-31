import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clientIp } from './rate-limit';

const req = (headers: Record<string, string>) => new Request('http://app.test/x', { headers });

test('clientIp: the platform header wins over a caller-typed x-forwarded-for', () => {
  assert.equal(clientIp(req({ 'x-vercel-forwarded-for': '203.0.113.9', 'x-forwarded-for': '1.2.3.4, 203.0.113.9' })), '203.0.113.9');
  assert.equal(clientIp(req({ 'x-real-ip': '198.51.100.7', 'x-forwarded-for': '6.6.6.6' })), '198.51.100.7');
});

test('clientIp: without a platform header the proxy-appended last entry is used, not the first', () => {
  assert.equal(clientIp(req({ 'x-forwarded-for': 'spoofed-by-client, 203.0.113.9' })), '203.0.113.9');
});

test('clientIp: unknown when nothing is present', () => {
  assert.equal(clientIp(req({})), 'unknown');
});
