import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  mapQuestionToPlayerPayload,
} from './question-bank-runtime';
import {
  blanksPassage,
  composedStem,
  convertibilityAs,
  mappingForCode,
  mappingForQuestion,
  matchPairs,
  playsAs,
  readDistractors,
  targetsForQuestion,
  toBlanksPayload,
  toCoursePresentationPayload,
  toMemoryGamePayload,
  toSingleChoiceSetPayload,
  toTrueFalsePayload,
  trueFalseAnswer,
  type BankQuestion,
  type H5pTargetKind,
} from './question-bank-h5p-map';

/**
 * Questions the format-driven generator writes, run through the REAL H5P
 * projection.
 *
 * The fixture is the bank-API shape of one stored question per format. It is
 * produced by the backend's H5pContractFixtureTest (next_lms_erp, from the actual
 * format classes) and copied here byte for byte, so a change to what a format
 * stores fails the backend test first and this one second. Regenerate there with
 *
 *     UPDATE_GOLDEN=1 vendor/bin/phpunit --filter H5pContractFixture
 *
 * What is asserted is the thing that matters: every generated question resolves
 * to the form it was generated as, lands on the H5P type the map names for that
 * form, is judged convertible, and converts to a payload with the right answer.
 * Nothing here adds a mapping -- it only checks the existing one reads the new rows.
 */

const FIXTURE = JSON.parse(
  readFileSync(path.join(process.cwd(), 'lib/h5p/fixtures/generated-questions.json'), 'utf8')
) as Record<string, BankQuestion>;

function row(code: string): BankQuestion {
  const found = FIXTURE[code];
  assert.ok(found, `fixture has no ${code}`);
  return found;
}

/** The default H5P target the existing map names for each generated format. */
const DEFAULT_TARGET: Record<string, H5pTargetKind> = {
  true_false: 'true_false',
  fill_blank: 'fill_in_the_blanks',
  drag_text: 'drag_text',
  mark_the_words: 'mark_the_words',
  match_following: 'memory_game',
  assertion_reason: 'single_choice_set',
  numerical: 'fill_in_the_blanks',
  very_short: 'essay',
  short: 'essay',
  long: 'essay',
  case_study: 'course_presentation',
  proof: 'course_presentation',
  construction: 'course_presentation',
  drag_drop: 'drag_drop',
};

test('every generated format resolves to itself and to the H5P type the map names', () => {
  for (const [code, kind] of Object.entries(DEFAULT_TARGET)) {
    const q = row(code);

    assert.equal(mappingForQuestion(q)?.code, code, `${code} resolved to another form`);
    assert.equal(mappingForQuestion(q)?.target?.kind, kind, `${code} default target`);
    assert.equal(mappingForCode(code)?.target?.kind, kind, `${code} map entry`);
    assert.equal(convertibilityAs(q, kind).ok, true, `${code} must be convertible as ${kind}: ${convertibilityAs(q, kind).reason ?? ''}`);
    assert.ok(
      targetsForQuestion(q).some((target) => target.kind === kind),
      `${code} must be offered as ${kind}`
    );
  }
});

test('the generator adds no mapping of its own: every format is already in the map', () => {
  for (const code of Object.keys(DEFAULT_TARGET)) {
    assert.ok(mappingForCode(code), `${code} is not in MAPPINGS`);
  }
});

test('true / false: the stored verdict is read back and the statement is the stem', () => {
  const q = row('true_false');
  const expected = q.model_answer === 'True';

  assert.equal(trueFalseAnswer(q), expected);

  const payload = toTrueFalsePayload([q]);
  assert.equal(payload.questions.length, 1);
  assert.equal(payload.questions[0].correct_answer, expected);
  assert.equal(payload.questions[0].question_text, q.question);
});

test('true / false: the flagged option and the bare model answer agree', () => {
  const q = row('true_false');
  const flagged = (q.options ?? []).filter((option) => option.is_correct);

  assert.equal(flagged.length, 1);
  assert.equal(flagged[0].text, q.model_answer);
});

test('true / false also plays as a single choice set, from the two stored options', () => {
  const q = row('true_false');

  assert.equal(playsAs(q, 'single_choice_set'), true);
  const payload = toSingleChoiceSetPayload([q]);
  assert.deepEqual(payload.questions[0].options.map((option) => option.option_text), ['True', 'False']);
  assert.equal(payload.questions[0].options.filter((option) => option.is_correct).length, 1);
});

test('fill in the blank: one slot per gap, drawn inline, marked against the stored answer', () => {
  const q = row('fill_blank');
  const passage = blanksPassage(q);

  assert.equal(passage.slots, 1);
  assert.equal(passage.inline, true);
  assert.match(passage.passage, /\*negative\*/);
  assert.doesNotMatch(passage.passage, /_{3,}/);
  assert.equal(toBlanksPayload(q).passage, passage.passage);
});

test('fill in the blank also plays as drag-the-words and mark-the-words', () => {
  const q = row('fill_blank');

  for (const kind of ['fill_in_the_blanks', 'drag_text', 'mark_the_words'] as const) {
    assert.equal(playsAs(q, kind), true, `fill_blank as ${kind}: ${convertibilityAs(q, kind).reason ?? ''}`);
  }
});

test('numerical: a typed value in a trailing slot, played as fill in the blanks', () => {
  const q = row('numerical');
  const passage = blanksPassage(q);

  assert.equal(passage.slots, 1);
  assert.equal(passage.inline, false);
  assert.match(passage.passage, /\*-12\*$/);
  assert.equal(playsAs(q, 'fill_in_the_blanks'), true);
  // The answer is appended to the end of the stem, so there is nothing to FIND in it.
  assert.equal(convertibilityAs(q, 'mark_the_words').ok, false);
});

test('match the following: structured pairs are used exactly, in answer-key order', () => {
  const q = row('match_following');
  assert.ok(q.pairs && q.pairs.length >= 4, 'the generator writes 4-6 pairs');

  const pairs = matchPairs(q);

  assert.deepEqual(pairs, q.pairs);
  assert.equal(toMemoryGamePayload(q).cards.length, q.pairs!.length);
  assert.equal(convertibilityAs(q, 'memory_game').ok, true);
});

test('match the following: pairs win over the text forms, and survive separator characters', () => {
  const pairs = [
    { left: 'x-axis', right: 'Horizontal reference line' },
    { left: 'y-axis', right: 'Vertical reference line' },
    { left: 'Ratio a:b', right: 'Comparison of two quantities' },
  ];
  const q: BankQuestion = {
    id: 1,
    question: 'Match.',
    question_type_code: 'match_following',
    model_answer: 'a-(ii), b-(i), c-(iii)',
    pairs,
  };

  assert.deepEqual(matchPairs(q), pairs);
  // Without `pairs` the same row falls back to the old text parse, which cannot
  // recover "x-axis": it reads the key's letters and numerals instead.
  assert.notDeepEqual(matchPairs({ ...q, pairs: null }), pairs);
});

test('match the following: a row with no usable pairs reads exactly as it always did', () => {
  const legacy: BankQuestion = {
    id: 2,
    question: 'Match the following',
    question_type_code: 'match_following',
    model_answer: 'A-3, B-1',
    options: [
      { label: 'A', text: 'Mitochondrion' },
      { label: 'B', text: 'Nucleus' },
      { label: '1', text: 'Control centre' },
      { label: '3', text: 'Powerhouse' },
    ],
  };

  const baseline = matchPairs(legacy);
  assert.deepEqual(matchPairs({ ...legacy, pairs: null }), baseline);
  assert.deepEqual(matchPairs({ ...legacy, pairs: [] }), baseline);
  assert.deepEqual(matchPairs({ ...legacy, pairs: [{ left: 'only one', right: 'pair' }] }), baseline);
  assert.deepEqual(matchPairs({ ...legacy, pairs: [{ left: '', right: 'x' }, { left: 'y', right: '' }] }), baseline);
});

test('assertion & reason: four options, one correct, and each half appears in the stem once', () => {
  const q = row('assertion_reason');
  const payload = toSingleChoiceSetPayload([q]);
  const options = payload.questions[0].options;

  assert.equal(options.length, 4);
  assert.equal(options.filter((option) => option.is_correct).length, 1);

  const stem = composedStem(q);
  assert.equal(stem.split(q.assertion!).length - 1, 1, 'assertion must not be appended a second time');
  assert.equal(stem.split(q.reason!).length - 1, 1, 'reason must not be appended a second time');
  assert.equal(stem, q.question);
});

test('assertion & reason: a stem WITHOUT the halves still gets them appended, as before', () => {
  const bare: BankQuestion = {
    id: 3,
    question: 'Read the statements and choose.',
    question_type_code: 'assertion_reason',
    assertion: 'The sky is blue.',
    reason: 'Light scatters.',
  };

  const stem = composedStem(bare);
  assert.match(stem, /<strong>Assertion:<\/strong> The sky is blue\./);
  assert.match(stem, /<strong>Reason:<\/strong> Light scatters\./);

  const half: BankQuestion = { ...bare, question: 'Assertion (A): The sky is blue.' };
  const halfStem = composedStem(half);
  assert.doesNotMatch(halfStem, /<strong>Assertion:/);
  assert.match(halfStem, /<strong>Reason:<\/strong> Light scatters\./);
});

test('assertion & reason: the model answer is words, not the raw envelope', () => {
  const q = row('assertion_reason');

  assert.match(q.model_answer ?? '', /^[A-D]\) /);
  assert.doesNotMatch(q.model_answer ?? '', /^\{/);
});

test('very short, short and long answers play as the written-answer player', () => {
  for (const code of ['very_short', 'short', 'long']) {
    const q = row(code);

    assert.equal(mappingForQuestion(q)?.target?.kind, 'essay', code);
    assert.equal(convertibilityAs(q, 'essay').ok, true, code);
    assert.equal(convertibilityAs(q, 'flashcards').ok, true, `${code} as flash cards`);
    assert.notEqual(q.model_answer, '');
  }
});

test('only a word-sized written answer also plays as a blank', () => {
  // Very short: "The product is negative." -- four words, so a typed blank is fair.
  assert.equal(convertibilityAs(row('very_short'), 'fill_in_the_blanks').ok, true);
  // Short and long are prose: marking them against an exact string would fail every
  // learner who worded the answer differently, so the map refuses.
  assert.equal(convertibilityAs(row('short'), 'fill_in_the_blanks').ok, false);
  assert.equal(playsAs(row('long'), 'fill_in_the_blanks'), false);
});

test('case study: one row, the whole case on one slide, the answers in the notes', () => {
  const q = row('case_study');
  assert.deepEqual(q.sub_part_labels, ['a', 'b', 'c']);

  const payload = toCoursePresentationPayload(q, []);

  assert.equal(payload.slides.length, 1, 'no children, so no separate stem slide');
  assert.match(payload.slides[0].elements[0].content_text, /\(a\) Write the diver/);
  assert.match(payload.slides[0].notes, /-12 m/);
});

test('a generated MCQ-typed row and a narrative-typed row keep the grading type the API reports', () => {
  assert.equal(row('true_false').question_type, 'MCQ');
  assert.equal(row('assertion_reason').question_type, 'MCQ');
  for (const code of ['fill_blank', 'numerical', 'match_following', 'very_short', 'short', 'long', 'case_study']) {
    assert.equal(row(code).question_type, 'Narrative', code);
  }
});

test('the fixture stays in step with the formats the map can carry', () => {
  // Nine generated formats; the tenth (mcq) is the legacy engine and is covered by
  // the existing map tests. A format added to the generator must appear here.
  assert.deepEqual(Object.keys(FIXTURE).sort(), Object.keys(DEFAULT_TARGET).sort());
});

// ---------------------------------------------------------------------------
// Drag the words, Mark the words, Proof, Construction
// ---------------------------------------------------------------------------

const SCOPE = { standard_id: 8, subject_id: 3, chapter_id: 11 };

test('drag the words: the gaps are slots and the stored distractors become the player word bank', () => {
  const q = row('drag_text');

  assert.deepEqual(q.distractors, ['respiration', 'oxygen', 'nitrogen']);
  assert.equal(blanksPassage(q).slots, 2);
  assert.equal(blanksPassage(q).inline, true);
  assert.equal(toBlanksPayload(q).distractors, 'respiration, oxygen, nitrogen');

  const result = mapQuestionToPlayerPayload(q, SCOPE);
  assert.equal(result.ok, true, result.ok ? '' : result.reason);
  if (result.ok) {
    assert.equal(result.activity?.kind, 'drag_text');
    assert.equal((result.activity?.item as { distractors: string | null }).distractors, 'respiration, oxygen, nitrogen');
  }
});

test('drag the words: played as a blank the same row carries no word bank', () => {
  const q = row('drag_text');
  const result = mapQuestionToPlayerPayload(q, SCOPE, undefined, [], 'fill_in_the_blanks');

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal((result.activity?.item as { distractors: string | null }).distractors, '');
  }
});

test('mark the words: the answers are marked where they stand, not stapled to the end', () => {
  const q = row('mark_the_words');
  const passage = blanksPassage(q);

  assert.equal(passage.inline, true, 'inline is what mark-the-words requires');
  assert.equal(passage.slots, 1);
  assert.match(passage.passage, /releases \*oxygen\* back into the air/);
  assert.doesNotMatch(passage.passage, /\*oxygen\*$/, 'not appended after the last word');
  assert.equal(convertibilityAs(q, 'mark_the_words').ok, true, convertibilityAs(q, 'mark_the_words').reason ?? '');

  const result = mapQuestionToPlayerPayload(q, SCOPE);
  assert.equal(result.ok, true, result.ok ? '' : result.reason);
  if (result.ok) assert.equal(result.activity?.kind, 'mark_the_words');
});

test('mark the words: every whole-word occurrence is marked, whatever its case', () => {
  const q: BankQuestion = {
    id: 1,
    question: 'Mark the repeated word.\nThe Cat sat on the mat while another cat watched and a third CAT slept near the old warm stove.',
    question_type_code: 'mark_the_words',
    model_answer: 'cat',
  };
  const passage = blanksPassage(q);

  assert.equal(passage.slots, 3);
  assert.match(passage.passage, /\*Cat\* sat/);
  assert.match(passage.passage, /another \*cat\* watched/);
  assert.match(passage.passage, /third \*CAT\* slept/);
  // "category" and "scatter" contain "cat" but are different words.
  const different = blanksPassage({ ...q, question: 'Mark the word. A category of scatter plots has one cat in the middle of it for you.' });
  assert.equal(different.slots, 1);
});

test('mark the words: an answer that is not in the passage falls back to the old behaviour', () => {
  const q: BankQuestion = {
    id: 2, question: 'Mark the colour in this short plain passage about the weather today.',
    question_type_code: 'mark_the_words', model_answer: 'purple',
  };
  const passage = blanksPassage(q);

  assert.equal(passage.inline, false, 'appended, so mark-the-words refuses the row');
  assert.equal(convertibilityAs(q, 'mark_the_words').ok, false);
});

test('mark the words: a multi-word answer is not marked in place', () => {
  const q: BankQuestion = {
    id: 3, question: 'Mark the gas. Carbon dioxide enters the leaf through tiny pores in the surface of it.',
    question_type_code: 'mark_the_words', model_answer: 'carbon dioxide',
  };

  assert.equal(blanksPassage(q).inline, false);
});

test('only mark_the_words rows are marked in place: a fill_blank row keeps its appended answer', () => {
  const q: BankQuestion = {
    id: 4, question: 'The capital of France is Paris and it is a very old city on the river Seine.',
    question_type_code: 'fill_blank', model_answer: 'Paris',
  };
  const passage = blanksPassage(q);

  assert.equal(passage.inline, false);
  assert.match(passage.passage, /\*Paris\*$/);
});

test('proof and construction play as a course presentation with the worked answer in the notes', () => {
  for (const code of ['proof', 'construction']) {
    const q = row(code);
    const payload = toCoursePresentationPayload(q, []);

    assert.equal(payload.slides.length, 1, code);
    assert.equal(payload.slides[0].notes, q.model_answer, `${code}: the answer stays out of the learner's view`);
    assert.equal(convertibilityAs(q, 'course_presentation').ok, true, code);
  }
});

test('readDistractors accepts only non-empty strings', () => {
  assert.deepEqual(readDistractors([' a ', 'b']), ['a', 'b']);
  assert.deepEqual(readDistractors(['a', '', '  ', 3, null]), ['a']);
  for (const bad of [undefined, null, 'a, b', 7, {}, [], ['', ' ']]) {
    assert.equal(readDistractors(bad), null, JSON.stringify(bad));
  }
});
