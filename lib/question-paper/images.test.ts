import test from 'node:test';
import assert from 'node:assert/strict';

import {
  extractImageSrcs,
  figureDisplaySrc,
  isAllowedAssetUrl,
  isInlineableUrl,
  isPrintableImageDataUri,
  rewriteImageSrcs,
} from './images';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

test('spots the images worth fetching', () => {
  assert.equal(isInlineableUrl('https://assets.test/fig.png'), true);
  assert.equal(isInlineableUrl('http://assets.test/fig.png'), true);
  assert.equal(isInlineableUrl(PNG), false);
  assert.equal(isInlineableUrl('/storage/fig.png'), false);
  assert.equal(isInlineableUrl(''), false);
  assert.equal(isInlineableUrl(null), false);
});

test('accepts only the data URIs a printed paper will keep', () => {
  assert.equal(isPrintableImageDataUri(PNG), true);
  assert.equal(isPrintableImageDataUri('data:image/webp;base64,UklGRg=='), true);
  // Not in RichText's allow-list, so inlining it would strip the image.
  assert.equal(isPrintableImageDataUri('data:image/bmp;base64,Qk0='), false);
  assert.equal(isPrintableImageDataUri('data:text/html;base64,PHNjcmlwdD4='), false);
  assert.equal(isPrintableImageDataUri('https://assets.test/fig.png'), false);
});

test('finds every img src in stored question html', () => {
  const html =
    '<p>Study the circuit.</p><img src="https://a.test/1.png" alt="x"><img src=\'https://a.test/2.png\'>';

  assert.deepEqual(extractImageSrcs(html), ['https://a.test/1.png', 'https://a.test/2.png']);
  assert.deepEqual(extractImageSrcs('<p>no pictures</p>'), []);
  assert.deepEqual(extractImageSrcs(''), []);
  assert.deepEqual(extractImageSrcs(null), []);
});

test('rewrites a src and keeps its quote style', () => {
  const html = '<img src="https://a.test/1.png"><img src=\'https://a.test/2.png\'>';
  const out = rewriteImageSrcs(html, { 'https://a.test/1.png': PNG });

  assert.ok(out.includes(`src="${PNG}"`));
  // Unmapped srcs survive untouched — a failed fetch must not empty the tag.
  assert.ok(out.includes("src='https://a.test/2.png'"));
});

test('leaves html without images alone', () => {
  assert.equal(rewriteImageSrcs('<p>plain</p>', { 'x': PNG }), '<p>plain</p>');
  assert.equal(rewriteImageSrcs('', {}), '');
});

test('the proxy allow-list compares origins, not substrings', () => {
  const allowed = ['https://erp.triz.co.in', 'https://dev.triz.co.in/'];

  assert.equal(isAllowedAssetUrl('https://erp.triz.co.in/storage/fig.png', allowed), true);
  assert.equal(isAllowedAssetUrl('https://dev.triz.co.in/assets/fig.png', allowed), true);

  // The attack the origin check exists for.
  assert.equal(isAllowedAssetUrl('https://erp.triz.co.in.evil.test/fig.png', allowed), false);
  assert.equal(isAllowedAssetUrl('https://evil.test/?x=erp.triz.co.in', allowed), false);
  // Scheme and port are part of the origin.
  assert.equal(isAllowedAssetUrl('http://erp.triz.co.in/fig.png', allowed), false);
  assert.equal(isAllowedAssetUrl('https://erp.triz.co.in:8443/fig.png', allowed), false);
});

test('the allow-list refuses everything it cannot parse', () => {
  assert.equal(isAllowedAssetUrl('https://a.test/fig.png', []), false);
  assert.equal(isAllowedAssetUrl('not-a-url', ['https://a.test']), false);
  assert.equal(isAllowedAssetUrl('file:///etc/passwd', ['https://a.test']), false);
  assert.equal(isAllowedAssetUrl('https://a.test/fig.png', ['', 'nonsense']), false);
});

test('a figure is served through this origin, never the third-party url', () => {
  const remote =
    'https://s3-triz.fra1.cdn.digitaloceanspaces.com/public/lms_content_file/qbank/abc.jpg';

  assert.equal(
    figureDisplaySrc(remote),
    `/api/question-paper/asset?url=${encodeURIComponent(remote)}`
  );
  // The query value must survive round-tripping, or the proxy rejects the host.
  const parsed = new URL(figureDisplaySrc(remote), 'http://localhost:3000');
  assert.equal(parsed.searchParams.get('url'), remote);
});

test('an already-local figure src is left alone', () => {
  // The PDF path inlines every image first; re-proxying a data URI would break it.
  assert.equal(figureDisplaySrc(PNG), PNG);
  assert.equal(figureDisplaySrc('/storage/fig.png'), '/storage/fig.png');
  assert.equal(figureDisplaySrc(''), '');
  assert.equal(figureDisplaySrc(null), '');
});
