import assert from 'node:assert/strict';
import test from 'node:test';

import { creditText, isTextbookPicture, missingPictureNotice, webSource } from './imageCredit';
import type { DeckImage } from './types';

const base: DeckImage = {
  type: 'photo',
  url: 'study-deck-image:1',
  alt: 'alt',
  caption: null,
  width: 400,
  height: 300,
  licence: null,
  source_url: null,
  creator: null,
  attribution: '',
  attribution_required: false,
};

const web: DeckImage = { ...base, source_url: 'https://commons.wikimedia.org/wiki/File:X.jpg', creator: 'A. Person', licence: 'BY-SA 4.0', source_kind: 'web' };
const book: DeckImage = {
  ...base,
  source_url: 'textbook:evs-std4-water#page-16',
  creator: 'Anand Niketan International',
  licence: 'Publisher textbook (permitted for this project)',
  attribution: 'From Level 4 Integrated Studies: Water, page 16 (Anand Niketan International).',
  attribution_required: true,
  source_kind: 'textbook',
};
const drawn: DeckImage = { ...base, type: 'diagram', source_kind: 'diagram' };

test('a web photograph is credited to its maker and links to its source page', () => {
  assert.equal(creditText(web), 'A. Person, BY-SA 4.0');
  assert.equal(webSource(web), 'https://commons.wikimedia.org/wiki/File:X.jpg');
});

test('a textbook picture is credited to the book and its page, and has no web link', () => {
  assert.equal(isTextbookPicture(book), true);
  assert.equal(creditText(book), 'From Level 4 Integrated Studies: Water, page 16 (Anand Niketan International)');
  assert.equal(webSource(book), null, 'its source is a book page, not an address a browser can open');
});

test('a drawn diagram says it was drawn for the lesson', () => {
  assert.equal(creditText(drawn), 'Drawn for this lesson');
  assert.equal(webSource(drawn), null);
});

test('a deck made before source_kind existed is read as it always was', () => {
  const { source_kind: _unused, ...old } = web;
  void _unused;
  assert.equal(creditText(old as DeckImage), 'A. Person, BY-SA 4.0');
  assert.equal(webSource(old as DeckImage), 'https://commons.wikimedia.org/wiki/File:X.jpg');
  assert.equal(creditText({ ...base, type: 'diagram' }), 'Drawn for this lesson');
});

test('only an http(s) address is ever linked', () => {
  for (const bad of ['javascript:alert(1)', 'textbook:x#page-1', 'file:///C:/x.png', '', '  ']) {
    assert.equal(webSource({ ...web, source_url: bad }), null, bad);
  }
});

test('a slide that planned a picture and has none says so, and a slide with its picture or no plan says nothing', () => {
  assert.equal(missingPictureNotice({ image: null, image_missing: 'no suitable picture was found' }), 'No suitable picture is available for this slide.');
  assert.equal(missingPictureNotice({ image: web, image_missing: null }), null);
  assert.equal(missingPictureNotice({ image: null, image_missing: null }), null, 'a slide that never planned a picture');
  assert.equal(missingPictureNotice({ image: null }), null);
});
