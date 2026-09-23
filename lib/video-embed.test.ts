import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isDirectMediaFile, looksLikeFile, toEmbedUrl } from './video-embed';

describe('toEmbedUrl', () => {
  it('embeds a standard watch URL', () => {
    const embed = toEmbedUrl('https://www.youtube.com/watch?v=viVG8POtDXo');
    assert.equal(embed?.provider, 'youtube');
    assert.ok(embed?.src.startsWith('https://www.youtube-nocookie.com/embed/viVG8POtDXo?'));
    assert.equal(embed?.externalUrl, 'https://www.youtube.com/watch?v=viVG8POtDXo');
  });

  it('embeds short, mobile, shorts, live and already-embed forms', () => {
    const urls = [
      'https://youtu.be/viVG8POtDXo',
      'https://m.youtube.com/watch?v=viVG8POtDXo',
      'https://www.youtube.com/shorts/viVG8POtDXo',
      'https://www.youtube.com/live/viVG8POtDXo',
      'https://www.youtube.com/embed/viVG8POtDXo',
      'https://www.youtube-nocookie.com/embed/viVG8POtDXo',
    ];

    for (const url of urls) {
      assert.ok(toEmbedUrl(url)?.src.includes('viVG8POtDXo'), url);
    }
  });

  it('carries a start time through, in both accepted spellings', () => {
    assert.ok(toEmbedUrl('https://youtu.be/viVG8POtDXo?t=90')?.src.includes('start=90'));
    assert.ok(toEmbedUrl('https://www.youtube.com/watch?v=viVG8POtDXo&start=45')?.src.includes('start=45'));
    assert.ok(toEmbedUrl('https://youtu.be/viVG8POtDXo?t=1h2m3s')?.src.includes('start=3723'));
  });

  it('embeds vimeo', () => {
    assert.equal(toEmbedUrl('https://vimeo.com/123456789')?.src, 'https://player.vimeo.com/video/123456789');
    assert.equal(toEmbedUrl('https://player.vimeo.com/video/123456789')?.provider, 'vimeo');
  });

  it('returns null for anything it cannot frame', () => {
    const notEmbeddable = [
      'https://s3-triz.fra1.digitaloceanspaces.com/public/lms_content_file/lesson.mp4',
      'https://example.com/watch?v=viVG8POtDXo',
      'https://www.youtube.com/watch?v=tooshort',
      'https://www.youtube.com/',
      'javascript:alert(1)',
      'not a url',
      '',
      null,
      undefined,
    ];

    for (const url of notEmbeddable) {
      assert.equal(toEmbedUrl(url), null, String(url));
    }
  });
});

describe('isDirectMediaFile', () => {
  it('recognises playable files, including with a query string', () => {
    assert.ok(isDirectMediaFile('https://cdn.example.com/a/b/lesson.mp4'));
    assert.ok(isDirectMediaFile('https://cdn.example.com/lesson.webm?v=2'));
    assert.ok(isDirectMediaFile('https://cdn.example.com/LESSON.MOV'));
  });

  it('rejects pages and documents', () => {
    assert.equal(isDirectMediaFile('https://www.youtube.com/watch?v=viVG8POtDXo'), false);
    assert.equal(isDirectMediaFile('https://example.com/notes.pdf'), false);
    assert.equal(isDirectMediaFile(''), false);
  });
});

describe('looksLikeFile', () => {
  it('is true for a path with an extension and false for a bare page', () => {
    assert.ok(looksLikeFile('https://cdn.example.com/a/lesson.mp4'));
    assert.equal(looksLikeFile('https://example.com/lessons/metals'), false);

    // A query string must not be mistaken for an extension — this is the case
    // that would otherwise put a YouTube page into a <video> element.
    assert.equal(looksLikeFile('https://www.youtube.com/watch?v=viVG8POtDXo'), false);
  });
});
