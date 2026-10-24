import assert from 'node:assert/strict';
import test from 'node:test';

import {
  deckForChapter,
  firstIndexOfTopic,
  hintFor,
  isCorrectAnswer,
  normaliseAnswer,
  parseVocabularyDeck,
  playableCards,
  score,
  startIndexForChapter,
} from './deck';

const card = (id: string, term: string, image: unknown = null) => ({ id, term, definition: `${term} is a thing.`, image });

function deck() {
  return {
    type: 'vocabulary_class',
    version: 1,
    title: 'Grade 4 water vocabulary',
    topics: [
      { id: 't1', chapter_id: 10, title: 'First', cards: [card('a', 'glacier'), card('b', 'aquifer')] },
      { id: 't2', chapter_id: 20, title: 'Second', cards: [card('c', 'surface tension', { src: 'https://x.test/a.jpg', alt: 'An insect on water' })] },
    ],
  };
}

test('a complete deck parses and flattens in deck order with each card knowing its topic', () => {
  const cards = playableCards(parseVocabularyDeck(deck()));

  assert.deepEqual(cards.map((c) => c.id), ['a', 'b', 'c']);
  assert.deepEqual(cards.map((c) => c.index), [0, 1, 2]);
  assert.deepEqual(cards.map((c) => c.topicNumber), [1, 1, 2]);
  assert.equal(cards[2].chapterId, 20);
  assert.equal(cards[0].image, null);
});

test('the player opens on the first card of the chapter the learner came from, else the first card', () => {
  const cards = playableCards(parseVocabularyDeck(deck()));

  assert.equal(startIndexForChapter(cards, 20), 2);
  assert.equal(startIndexForChapter(cards, 10), 0);
  assert.equal(startIndexForChapter(cards, 999), 0);
  assert.equal(firstIndexOfTopic(cards, 't2'), 2);
});

test('a chapter sees only its own topic, never another chapter’s words', () => {
  const parsed = parseVocabularyDeck(deck());
  const chapter = deckForChapter(parsed, 20);

  assert.deepEqual(playableCards(chapter).map((c) => c.id), ['c']);
  assert.deepEqual(playableCards(deckForChapter(parsed, 10)).map((c) => c.id), ['a', 'b']);
  assert.throws(() => deckForChapter(parsed, 999), /no vocabulary for this chapter/);
});

test('a deck the player cannot rely on is refused, never shown half-complete', () => {
  assert.throws(() => parseVocabularyDeck(null), /not a vocabulary class/);
  assert.throws(() => parseVocabularyDeck({ ...deck(), type: 'quiz' }), /not a vocabulary class/);
  assert.throws(() => parseVocabularyDeck({ ...deck(), topics: [] }), /no topics/);

  const noDefinition = deck();
  noDefinition.topics[0].cards[0].definition = '  ';
  assert.throws(() => parseVocabularyDeck(noDefinition), /card .* incomplete/);

  const duplicate = deck();
  duplicate.topics[1].cards[0].id = 'a';
  assert.throws(() => parseVocabularyDeck(duplicate), /card .* incomplete/);

  const emptyTopic = deck();
  emptyTopic.topics[1].cards = [];
  assert.throws(() => parseVocabularyDeck(emptyTopic), /topic .* incomplete/);

  const noAddress = deck();
  noAddress.topics[1].cards[0].image = { src: '', alt: 'x' } as never;
  assert.throws(() => parseVocabularyDeck(noAddress), /picture .* no address/);
});

test('an answer is checked ignoring case, spacing, hyphens and punctuation, but not the word itself', () => {
  assert.equal(isCorrectAnswer('Glacier', 'glacier'), true);
  assert.equal(isCorrectAnswer('  surface   tension. ', 'surface tension'), true);
  assert.equal(isCorrectAnswer('surface-tension', 'surface tension'), true);
  assert.equal(isCorrectAnswer('glaciers', 'glacier'), false);
  assert.equal(isCorrectAnswer('', 'glacier'), false);
  assert.equal(isCorrectAnswer('   ', 'glacier'), false);
  assert.equal(normaliseAnswer('Cohesion and Adhesion!'), 'cohesion and adhesion');
});

test('a hint gives the first letter and the length without giving the word away', () => {
  assert.equal(hintFor('glacier'), 'Starts with “G”; 7 letters');
  assert.equal(hintFor('surface tension'), 'Starts with “S”; 2 words (7 + 7 letters)');
  assert.ok(!hintFor('glacier').includes('lacier'));
});

test('the score counts correct cards over the whole deck, and a revealed answer is not a correct one', () => {
  assert.deepEqual(score({ a: 'correct', b: 'revealed', c: 'correct' }, 4), { correct: 2, total: 4, percent: 50 });
  assert.deepEqual(score({}, 0), { correct: 0, total: 0, percent: 0 });
});
