import assert from 'node:assert/strict';
import { test } from 'node:test';

test('csp-report: logs a one-line summary, answers 204, and ignores junk', async () => {
  const { POST } = await import('../../app/api/csp-report/route');
  const lines: string[] = [];
  const realWarn = console.warn;
  console.warn = (m: string) => { lines.push(String(m)); };
  try {
    const ok = await POST(new Request('http://app.test/api/csp-report', {
      method: 'POST',
      body: JSON.stringify({ 'csp-report': { 'violated-directive': 'script-src', 'blocked-uri': 'https://evil.test/x.js\nFAKE LOG LINE', 'document-uri': 'http://app.test/p' } }),
    }));
    assert.equal(ok.status, 204);
    assert.equal(lines.length, 1);
    assert.ok(!lines[0].includes('\n'), 'a newline in the report must not forge a second log line');
    assert.match(lines[0], /directive=script-src/);

    const junk = await POST(new Request('http://app.test/api/csp-report', { method: 'POST', body: 'not json' }));
    assert.equal(junk.status, 204);
    assert.equal(lines.length, 1);
  } finally {
    console.warn = realWarn;
  }
});
