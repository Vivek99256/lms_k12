import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sanitizeHtml } from './sanitize-html';

test('document mode keeps a print layout (style, table) and drops script, handlers and js: links', () => {
  const page = '<html><head><title>R</title><style>td{border:1px solid #000}</style></head><body onload="alert(1)"><table><tr><td>Rahul <img src=x onerror="alert(2)"></td></tr></table><script>alert(3)</script><a href="javascript:alert(4)">x</a></body></html>';
  const out = sanitizeHtml(page, { document: true });
  assert.match(out, /<style>td\{border:1px solid #000\}<\/style>/);
  assert.match(out, /<table>/);
  assert.match(out, /Rahul/);
  assert.ok(!/<script|onload|onerror|javascript:/i.test(out), out);
});
