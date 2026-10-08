import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { mapQuestionToPlayerPayload } from '../h5p/question-bank-runtime';
import type { BankQuestion } from '../h5p/question-bank-h5p-map';
import {
  DeckError,
  PLAYABLE_TARGETS,
  assetUrl,
  explanationOf,
  neededQuestionIds,
  outlineOf,
  parseDeck,
  relatedConcepts,
  resolveActivity,
  stageLabel,
  topicOfSlide,
} from './deck';
import type { DeckActivity, StudyDeck } from './types';

/**
 * The deck is the file the Laravel pipeline writes (tests/Fixtures/study-deck-golden.json
 * in next_lms_erp, pinned there by StudyDeckContractFixtureTest). Every activity in it is
 * played here through the REAL runtime, so a drift between the two repos fails a test
 * instead of showing a learner a broken card.
 */

const golden = JSON.parse(readFileSync(new URL('./fixtures/study-deck-golden.json', import.meta.url), 'utf8')) as unknown;

function deck(): StudyDeck {
  return parseDeck(structuredClone(golden));
}

/** The bank rows the fixture chapter's questions would come back as from /api/lms-question-bank. */
function bank(): Map<number, BankQuestion> {
  const scope = { chapter_id: 1, standard_id: 9, subject_id: 2 };
  const rows: BankQuestion[] = [
    {
      id: 101, question: 'Which describes a scientific model?', question_type_code: 'mcq', question_type: 'MCQ', marks: 1,
      model_answer: 'The second choice is right because a model keeps only what the question needs.',
      options: [{ label: 'A', text: 'First choice' }, { label: 'B', text: 'Second choice', is_correct: true }], ...scope,
    } as BankQuestion,
    {
      id: 103, question: 'Why does a map ignore trees?', question_type_code: 'mcq', question_type: 'MCQ', marks: 1,
      model_answer: 'The second choice is right because a model keeps only what the question needs.',
      options: [{ label: 'A', text: 'First choice' }, { label: 'B', text: 'Second choice', is_correct: true }], ...scope,
    } as BankQuestion,
    {
      id: 104, question: 'What does a law describe?', question_type_code: 'short', question_type: 'Narrative', marks: 2,
      model_answer: 'A repeated pattern.', options: [], ...scope,
    } as BankQuestion,
  ];

  return new Map(rows.map((row) => [row.id, row]));
}

function allActivities(d: StudyDeck): DeckActivity[] {
  return d.slides.flatMap((slide) => slide.activities);
}

test('the golden deck from the backend parses', () => {
  const d = deck();

  assert.equal(d.version, 2);
  assert.equal(d.slide_count, 7);
  assert.equal(d.chapter.name, 'Ideas in exploration');
  assert.equal(d.slides.length, 7);
});

test('a deck the player cannot read is refused with a reason', () => {
  type Json = Record<string, unknown>;
  const slideAt = (d: Json, i: number) => (d.slides as Json[])[i];
  const activityAt = (d: Json, i: number) => (slideAt(d, i).activities as Json[])[0];
  const broken = (patch: (d: Json) => void): unknown => {
    const d = structuredClone(golden) as Json;
    patch(d);
    return d;
  };

  assert.throws(() => parseDeck(null), DeckError);
  assert.throws(() => parseDeck(broken((d) => { d.version = 1; })), /version 1/);
  assert.throws(() => parseDeck(broken((d) => { d.slides = []; })), /no slides/);
  assert.throws(() => parseDeck(broken((d) => { delete d.concepts; })), /no concept list/);
  assert.throws(() => parseDeck(broken((d) => { delete d.chapter; })), /which chapter/);
  assert.throws(() => parseDeck(broken((d) => { activityAt(d, 1).as = 'branching'; })), /"branching", which no player here can render/);
  assert.throws(() => parseDeck(broken((d) => { activityAt(d, 1).label = 'Quiz time'; })), /labelled "Quiz time"/);
  assert.throws(() => parseDeck(broken((d) => { activityAt(d, 3).question = undefined; })), /authored check with no question/);
});

test('there is no branching player: the deck can only ask for targets the runtime has', () => {
  assert.ok(!(PLAYABLE_TARGETS as readonly string[]).includes('branching'));
  for (const activity of allActivities(deck())) {
    assert.ok((PLAYABLE_TARGETS as readonly string[]).includes(activity.as), activity.as);
  }
});

test('every activity in the deck is playable through the real H5P runtime', () => {
  const d = deck();
  const rows = bank();

  for (const slide of d.slides) {
    slide.activities.forEach((activity) => {
      const resolved = resolveActivity(activity, rows);
      assert.equal(resolved.ok, true, `slide ${slide.n}: ${resolved.ok ? '' : resolved.reason}`);
      if (!resolved.ok) return;

      const built = mapQuestionToPlayerPayload(resolved.question, { standard_id: 9, subject_id: 2, chapter_id: 1 }, undefined, [], resolved.as);
      assert.equal(built.ok, true);
      assert.equal(built.activity?.kind, resolved.as);
    });
  }
});

test('question to activity mapping: choice questions are single-choice sets, a recall question is flashcards, a written check is an essay', () => {
  const d = deck();
  const rows = bank();
  const kinds = (n: number) => d.slides[n - 1].activities.map((a) => {
    const r = resolveActivity(a, rows);
    return r.ok ? r.as : 'unplayable';
  });

  assert.deepEqual(kinds(2), ['single_choice_set']);
  assert.deepEqual(kinds(3), ['single_choice_set']);
  assert.deepEqual(kinds(5), ['flashcards']); // a recall short answer on a flashcards slide
  assert.deepEqual(kinds(4), ['essay']);      // authored check
});

test('each activity keeps its question id, concept id, format and bank levels', () => {
  const d = deck();
  const q101 = d.slides[1].activities[0];

  assert.equal(q101.question_id, 101);
  assert.equal(q101.concept_id, 1);
  assert.equal(q101.source, 'bank');
  assert.equal(q101.bloom, 'apply');
  assert.equal(q101.difficulty, 'medium');
  assert.equal(q101.dok, 2);
  assert.deepEqual(d.concept_questions['1'], [101]);
  assert.deepEqual(d.concept_questions['3'], [104]);
});

test('the stored explanation reaches the learner after answering', () => {
  const rows = bank();
  const built = mapQuestionToPlayerPayload(rows.get(101)!, { standard_id: 9, subject_id: 2, chapter_id: 1 }, undefined, [], 'single_choice_set');

  assert.equal(built.ok, true);
  assert.equal(built.activity?.kind, 'single_choice_set');
  if (built.activity?.kind !== 'single_choice_set') return;
  const question = built.activity.item.questions[0];
  assert.match(String(question.explanation ?? question.feedback_correct), /a model keeps only what the question needs/);
  assert.equal(question.options.filter((o) => o.is_correct).length, 1);
});

test('a target the real row cannot be falls back to the question\'s own default, and says so', () => {
  const rows = bank();
  const activity: DeckActivity = { ...deck().slides[1].activities[0], as: 'fill_in_the_blanks' };

  const resolved = resolveActivity(activity, rows);
  assert.equal(resolved.ok, true);
  if (!resolved.ok) return;
  assert.equal(resolved.as, 'single_choice_set');
  assert.equal(resolved.fellBack, true);
});

test('a question deleted from the bank is a clear message, not a crash', () => {
  const rows = bank();
  rows.delete(101);
  const resolved = resolveActivity(deck().slides[1].activities[0], rows);

  assert.equal(resolved.ok, false);
  if (resolved.ok) return;
  assert.match(resolved.reason, /no longer in the question bank/);
});

test('an authored check travels with the deck and needs no bank row', () => {
  const authored = deck().slides[3].activities[0];
  const resolved = resolveActivity(authored, new Map());

  assert.equal(authored.source, 'authored');
  assert.ok((authored.question?.id ?? 0) < 0, 'a negative id: it is not a stored question');
  assert.equal(resolved.ok, true);
});

test('only bank questions are requested from the bank', () => {
  assert.deepEqual(neededQuestionIds(deck()).sort(), [101, 103, 104]);
});

test('the outline is chapter, topic, concept with where each is taught', () => {
  const outline = outlineOf(deck());

  assert.deepEqual(outline.map((t) => t.name), ['Models', 'Laws and theories']);
  assert.deepEqual(outline[0].concepts.map((c) => [c.concept.name, c.taughtOn]), [['Models', [2]], ['Ignoring details', [3]]]);
  assert.deepEqual(outline[1].concepts.map((c) => [c.concept.name, c.taughtOn]), [['Laws', [4]], ['Theories', [5]]]);
});

test('a slide belongs to the topic of the concept it teaches', () => {
  const d = deck();

  assert.equal(topicOfSlide(d, d.slides[2])?.name, 'Models');
  assert.equal(topicOfSlide(d, d.slides[4])?.name, 'Laws and theories');
  assert.equal(topicOfSlide(d, d.slides[0]), null);
});

test('prerequisites and related concepts point back to where they were explained', () => {
  const d = deck();
  const related = relatedConcepts(d, d.slides[2]); // slide 3 teaches "Ignoring details"

  assert.deepEqual(related.map((r) => [r.concept.name, r.kind, r.slide]), [['Models', 'builds on', 2]]);
  assert.deepEqual(relatedConcepts(d, d.slides[1]).map((r) => r.concept.name), ['Ignoring details'], 'a related concept is offered from the slide that teaches the other');
  assert.deepEqual(relatedConcepts(d, d.slides[0]), []);
});

test('image paths are resolved against the deck base only when relative', () => {
  assert.equal(assetUrl('images/a.png', '/study-deck/chapter-1'), '/study-deck/chapter-1/images/a.png');
  assert.equal(assetUrl('images/a.png', '/study-deck/chapter-1/'), '/study-deck/chapter-1/images/a.png');
  assert.equal(assetUrl('https://x.digitaloceanspaces.com/a.png', '/base'), 'https://x.digitaloceanspaces.com/a.png');
  assert.equal(assetUrl('/abs/a.png', '/base'), '/abs/a.png');
  assert.equal(assetUrl('images/a.png', null), 'images/a.png');
});

test('slide types read as plain stages for the learner', () => {
  assert.equal(stageLabel('concept_intro'), 'Explanation');
  assert.equal(stageLabel('relationship'), 'How ideas connect');
  assert.equal(stageLabel('exit_ticket'), 'Exit ticket');
  assert.equal(stageLabel('something_new'), 'Lesson');
});

test('the photo carries alt text made from the picture, and a credit', () => {
  const image = deck().slides[1].image;

  assert.equal(image?.type, 'photo');
  assert.equal(image?.alt, 'Photograph: Map as a simplified scientific model. Tags: map, model.');
  assert.equal(image?.licence, 'BY-SA 4.0');
  assert.equal(image?.attribution_required, true);
});

test('the explanation a learner sees is plain text, never a raw answer envelope', () => {
  const envelope = JSON.stringify({
    v: 'ans-2.0',
    question_type: 'mcq',
    explanation: 'A model keeps only what the question needs.',
    options: [],
  });

  assert.equal(explanationOf({ model_answer: envelope }), 'A model keeps only what the question needs.');
  assert.equal(explanationOf({ model_answer: JSON.stringify({ model_answer: 'A repeated pattern.' }) }), 'A repeated pattern.');
  assert.equal(explanationOf({ model_answer: 'A plain stored answer.' }), 'A plain stored answer.');
  assert.equal(explanationOf({ model_answer: '<p>Tagged  <b>text</b></p>' }), 'Tagged text');
  assert.equal(explanationOf({ model_answer: '{ not json at all' }), '', 'an unreadable envelope shows nothing, not its source');
  assert.equal(explanationOf({ model_answer: null }), '');
  assert.equal(explanationOf({ model_answer: JSON.stringify({ v: 'ans-2.0' }) }), '', 'an envelope with no explanation shows nothing');
});
