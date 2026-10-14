import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { parseDeck } from './deck';
import { applyImageUrls, imageRefId, imageUrlsRequest, pendingImageIds, resolveDeckImages } from './images';

const golden = JSON.parse(readFileSync(new URL('./fixtures/study-deck-golden.json', import.meta.url), 'utf8')) as unknown;

test('a reference is recognised only in its exact form', () => {
  assert.equal(imageRefId('study-deck-image:12'), 12);
  for (const bad of ['study-deck-image:0', 'study-deck-image:012', 'study-deck-image:', 'study-deck-image:1x', ' study-deck-image:1', 'images/a.png', 'https://x/study-deck-image:1', null, undefined, 12]) {
    assert.equal(imageRefId(bad), null, String(bad));
  }
});

test('the golden deck names its pictures by reference, never by a path', () => {
  const deck = parseDeck(structuredClone(golden));
  const urls = deck.slides.map((slide) => slide.image?.url).filter((url): url is string => Boolean(url));

  assert.ok(urls.length >= 2, 'the fixture has pictures');
  for (const url of urls) {
    assert.notEqual(imageRefId(url), null, url);
    assert.doesNotMatch(url, /^images\//);
  }
  assert.deepEqual(pendingImageIds(deck), Array.from(new Set(urls.map((url) => imageRefId(url) as number))));
});

test('references are replaced by their addresses and nothing else changes', () => {
  const deck = parseDeck(structuredClone(golden));
  const [first, second] = pendingImageIds(deck);
  const before = JSON.stringify({ ...deck, slides: deck.slides.map((slide) => ({ ...slide, image: slide.image && { ...slide.image, url: '' } })) });

  applyImageUrls(deck, { [String(first)]: 'https://api.example.org/api/study-deck/images/1?sig=a', [String(second)]: 'https://api.example.org/api/study-deck/images/2?sig=b' });

  assert.deepEqual(pendingImageIds(deck), []);
  assert.equal(deck.slides.filter((slide) => slide.image?.url.startsWith('https://api.example.org/api/study-deck/images/')).length, deck.slides.filter((slide) => slide.image).length);
  assert.equal(JSON.stringify({ ...deck, slides: deck.slides.map((slide) => ({ ...slide, image: slide.image && { ...slide.image, url: '' } })) }), before);
});

test('a picture with no address is left as a reference and the rest still resolves', () => {
  const deck = parseDeck(structuredClone(golden));
  const [first, second] = pendingImageIds(deck);

  applyImageUrls(deck, { [String(first)]: 'https://api.example.org/i/1' });

  assert.deepEqual(pendingImageIds(deck), [second]);
});

test('the lookup is asked once, for each picture once, and not at all when there is nothing to resolve', async () => {
  const deck = parseDeck(structuredClone(golden));
  const asked: number[][] = [];

  await resolveDeckImages(deck, async (ids) => {
    asked.push(ids);
    return Object.fromEntries(ids.map((id) => [String(id), `https://api.example.org/i/${id}`]));
  });
  assert.equal(asked.length, 1);
  assert.deepEqual(asked[0], Array.from(new Set(asked[0])));

  let again = 0;
  await resolveDeckImages(deck, async () => {
    again += 1;
    return {};
  });
  assert.equal(again, 0, 'every picture already has an address');
});

test('a study document keeps its pictures in sections and is resolved the same way', async () => {
  const document = { sections: [{ image: { url: 'study-deck-image:7' } }, { image: null }, { image: { url: 'https://old.example.org/a.png' } }] };

  await resolveDeckImages(document, async (ids) => {
    assert.deepEqual(ids, [7]);
    return { '7': 'https://api.example.org/i/7' };
  });

  assert.equal(document.sections[0].image?.url, 'https://api.example.org/i/7');
  assert.equal(document.sections[2].image?.url, 'https://old.example.org/a.png', 'an address that is already absolute is left alone');
});

test('the request names the pictures and the school, and leaves the school out when it is unknown', () => {
  assert.deepEqual(imageUrlsRequest([3, 4], 7), { image_ids: [3, 4], sub_institute_id: 7 });
  assert.deepEqual(imageUrlsRequest([3], Number.NaN), { image_ids: [3] });
});
