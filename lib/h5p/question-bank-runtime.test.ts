import test from 'node:test';
import assert from 'node:assert/strict';

import { mapQuestionToPlayerPayload, isPlayable } from './question-bank-runtime';
import type { BankQuestion } from './question-bank-h5p-map';

/**
 * What matters here is that the adapter produces a row a player can actually
 * render, without a save.
 *
 * The content decisions are already covered in question-bank-h5p-map.test.ts;
 * these tests guard the scaffolding that turns a save payload into a ROW --
 * parent/child ids that line up, ids that cannot collide with a stored
 * activity, and a refusal where a question has nothing to play.
 */

const SCOPE = { standard_id: 43, subject_id: 3975, chapter_id: 1012 };

function question(overrides: Partial<BankQuestion> = {}): BankQuestion {
  return {
    id: 709362,
    question: 'Which gas do plants absorb?',
    question_type_code: 'mcq',
    question_type: 'MCQ',
    marks: 1,
    options: [
      { label: 'A', text: 'Carbon dioxide', is_correct: true },
      { label: 'B', text: 'Nitrogen' },
    ],
    ...overrides,
  };
}

test('every question form the brief lists produces a playable activity', () => {
  const cases: Array<[string, BankQuestion]> = [
    ['mcq', question()],
    ['true_false', question({ question_type_code: 'true_false', options: [], model_answer: 'True' })],
    ['fill_blank', question({ question_type_code: 'fill_blank', options: [], question: 'The ____ is red.', model_answer: 'apple' })],
    ['match_following', question({
      question_type_code: 'match_following',
      model_answer: '',
      options: [{ label: 'A', text: 'Delhi -> India' }, { label: 'B', text: 'Paris -> France' }],
    })],
    ['assertion_reason', question({ question_type_code: 'assertion_reason', assertion: 'A is true.', reason: 'B explains A.' })],
    ['very_short', question({ question_type_code: 'very_short', options: [], model_answer: 'Photosynthesis' })],
    ['short', question({ question_type_code: 'short', options: [], model_answer: 'Because of chlorophyll.' })],
    ['long', question({ question_type_code: 'long', options: [], model_answer: 'A long answer.' })],
    ['numerical', question({ question_type_code: 'numerical', options: [], question: 'Find x when 2x = ____.', model_answer: '6' })],
    ['case_study_parent', question({ question_type_code: 'case_study_parent', options: [] })],
    ['construction', question({ question_type_code: 'construction', options: [] })],
    ['proof', question({ question_type_code: 'proof', options: [] })],
  ];

  for (const [code, row] of cases) {
    const result = mapQuestionToPlayerPayload(row, SCOPE);
    assert.equal(result.ok, true, `${code} is not playable: ${result.reason}`);
    assert.ok(result.activity, `${code} produced no activity`);
  }
});

test('every player kind is reachable from a question form', () => {
  const kinds = new Set(
    [
      question(),
      question({ question_type_code: 'true_false', options: [], model_answer: 'True' }),
      question({ question_type_code: 'fill_blank', options: [], question: 'The ____ is red.', model_answer: 'apple' }),
      question({
        question_type_code: 'match_following',
        model_answer: '',
        options: [{ label: 'A', text: 'Delhi -> India' }, { label: 'B', text: 'Paris -> France' }],
      }),
      question({ question_type_code: 'long', options: [] }),
      question({ question_type_code: 'case_study_parent', options: [] }),
    ]
      .map((row) => mapQuestionToPlayerPayload(row, SCOPE).activity?.kind)
      .filter(Boolean)
  );

  assert.deepEqual(
    [...kinds].sort(),
    ['course_presentation', 'essay', 'fill_in_the_blanks', 'memory_game', 'single_choice_set', 'true_false']
  );
});

test('ids are negative, so a preview can never be mistaken for a stored activity', () => {
  const result = mapQuestionToPlayerPayload(question(), SCOPE);
  assert.equal(result.activity?.kind, 'single_choice_set');

  const item = result.activity?.kind === 'single_choice_set' ? result.activity.item : null;
  assert.ok(item);
  assert.ok(item.id < 0, 'set id is not negative');

  for (const q of item.questions) {
    assert.ok(q.id < 0, 'question id is not negative');
    for (const option of q.options) assert.ok(option.id < 0, 'option id is not negative');
  }
});

test('children point back at their parent', () => {
  const result = mapQuestionToPlayerPayload(question(), SCOPE);
  const item = result.activity?.kind === 'single_choice_set' ? result.activity.item : null;
  assert.ok(item);

  for (const q of item.questions) {
    assert.equal(q.set_id, item.id);
    for (const option of q.options) assert.equal(option.set_id, item.id);
  }
});

test('the curriculum scope rides on the row, so the player has its context', () => {
  const result = mapQuestionToPlayerPayload(question(), SCOPE);
  const item = result.activity?.kind === 'single_choice_set' ? result.activity.item : null;

  assert.equal(item?.standard_id, 43);
  assert.equal(item?.subject_id, 3975);
  assert.equal(item?.chapter_id, 1012);
});

test('a preview is published, because there is nothing to publish', () => {
  // Players gate on status; a draft would render as "not playable yet" for a
  // row that only ever exists for the length of this render.
  const result = mapQuestionToPlayerPayload(question(), SCOPE);
  const item = result.activity?.kind === 'single_choice_set' ? result.activity.item : null;
  assert.equal(item?.status, 'published');
});

test('the same question always builds the same ids', () => {
  const first = mapQuestionToPlayerPayload(question(), SCOPE);
  const second = mapQuestionToPlayerPayload(question(), SCOPE);

  assert.deepEqual(first.activity, second.activity);
});

test('a true/false row whose answer does not read as a verdict is refused, not defaulted', () => {
  // The builder would default this to `false` and mark every learner wrong.
  const result = mapQuestionToPlayerPayload(
    question({ question_type_code: 'true_false', options: [], model_answer: 'It depends.' }),
    SCOPE
  );

  assert.equal(result.ok, false);
  assert.match(String(result.reason), /true or false/i);
});

test('a question with nothing to play is refused with a reason', () => {
  const noOptions = mapQuestionToPlayerPayload(question({ options: [] }), SCOPE);
  assert.equal(noOptions.ok, false);
  assert.match(String(noOptions.reason), /two options/i);

  const noCorrect = mapQuestionToPlayerPayload(
    question({ options: [{ label: 'A', text: 'One' }, { label: 'B', text: 'Two' }] }),
    SCOPE
  );
  assert.equal(noCorrect.ok, false);
  assert.match(String(noCorrect.reason), /correct/i);

  const unrecorded = mapQuestionToPlayerPayload(
    question({ question_type_code: null, question_type_raw: null, question_type: 'Narrative' }),
    SCOPE
  );
  assert.equal(unrecorded.ok, false);
});

test('a case study stem carries its sub-parts onto slides of one presentation', () => {
  const result = mapQuestionToPlayerPayload(
    question({ id: 7, question_type_code: 'case_study_parent', question: 'A farmer measures his field.', options: [] }),
    SCOPE,
    'Fractions',
    [question({ id: 8, question: 'What is the area?', options: [] }), question({ id: 9, question: 'Which unit?' })]
  );

  const item = result.activity?.kind === 'course_presentation' ? result.activity.item : null;
  assert.ok(item);
  assert.equal(item.slides.length, 3);

  for (const slide of item.slides) {
    assert.equal(slide.presentation_id, item.id);
    for (const element of slide.elements) {
      assert.equal(element.slide_id, slide.id);
      assert.equal(element.presentation_id, item.id);
    }
  }
});

test('every element id in a presentation is distinct', () => {
  const result = mapQuestionToPlayerPayload(
    question({ id: 7, question_type_code: 'case_study_parent', options: [] }),
    SCOPE,
    undefined,
    [question({ id: 8, options: [] }), question({ id: 9 }), question({ id: 10, options: [] })]
  );

  const item = result.activity?.kind === 'course_presentation' ? result.activity.item : null;
  assert.ok(item);

  const ids = item.slides.flatMap((slide) => slide.elements.map((element) => element.id));
  assert.equal(new Set(ids).size, ids.length, 'element ids collide');
});

test('isPlayable agrees with the builder', () => {
  assert.equal(isPlayable(question(), SCOPE), true);
  assert.equal(isPlayable(question({ options: [] }), SCOPE), false);
});

test('a blanks activity carries its answer key, or it cannot be scored', () => {
  // The Blanks player marks from `blanks[]`, never from the passage: an empty
  // array makes `scoreBlanks` return "not scoreable" and the learner is told
  // the activity has no answers set. This is the test that caught that.
  const result = mapQuestionToPlayerPayload(
    question({ question_type_code: 'fill_blank', options: [], question: 'The ____ is red.', model_answer: 'apple' }),
    SCOPE
  );

  const item = result.activity?.kind === 'fill_in_the_blanks' ? result.activity.item : null;
  assert.ok(item);
  assert.equal(item.blanks.length, 1);
  assert.equal(item.blanks[0].solution, 'apple');
  assert.equal(item.blanks[0].blank_index, 0);
  assert.equal(item.blanks[0].is_distractor, false);
  assert.equal(item.blanks[0].text_activity_id, item.id);
});

test('a paragraph-long model answer is refused rather than made into one blank', () => {
  // Real row QB-706484: "seven, being two hydrogen, one sulphur and four
  // oxygen". As a single blank it is unanswerable, and exact-string marking
  // would fail every learner who wrote it in their own words.
  const prose = mapQuestionToPlayerPayload(
    question({
      question_type_code: 'fill_blank',
      options: [],
      question: 'In the formula H2SO4 there are ______ atoms altogether.',
      model_answer: 'seven, being two hydrogen, one sulphur and four oxygen',
    }),
    SCOPE
  );

  assert.equal(prose.ok, false);
  assert.match(String(prose.reason), /explanation rather than a word or value/i);

  // The same question with the answer it should have had stays playable.
  const short = mapQuestionToPlayerPayload(
    question({
      question_type_code: 'fill_blank',
      options: [],
      question: 'In the formula H2SO4 there are ______ atoms altogether.',
      model_answer: 'seven',
    }),
    SCOPE
  );

  assert.equal(short.ok, true);
});

test('short-answer forms become a written answer, not a slide', () => {
  // They used to route to Course Presentation, which showed the prompt and hid
  // the model answer in author-only notes: a learner could neither answer nor
  // check. H5P.Essay does not exist here, so the written-answer player does.
  for (const code of ['very_short', 'short', 'long']) {
    const result = mapQuestionToPlayerPayload(
      question({ question_type_code: code, options: [], model_answer: 'Because chlorophyll absorbs light.' }),
      SCOPE
    );

    assert.equal(result.activity?.kind, 'essay', `${code} did not become a written answer`);
  }
});

test('a written answer carries the prompt, the model answer and nothing that marks it', () => {
  const result = mapQuestionToPlayerPayload(
    question({
      question_type_code: 'short',
      options: [],
      question: 'Why do leaves look green?',
      model_answer: 'Chlorophyll absorbs red and blue light and reflects green light.',
      marks: 3,
    }),
    SCOPE
  );

  const item = result.activity?.kind === 'essay' ? result.activity.item : null;
  assert.ok(item);
  assert.match(item.prompt, /Why do leaves look green\?/);
  assert.match(String(item.model_answer), /Chlorophyll absorbs/);
  assert.equal(item.marks, 3);

  // Keywords are a self-check, so they must be content words -- never the
  // filler that any answer would contain.
  assert.ok(item.keywords.includes('chlorophyll'));
  assert.ok(!item.keywords.includes('and'));
  assert.ok(!item.keywords.includes('the'));
  assert.ok(item.keywords.length <= 8);
});

test('a written answer with no model answer is still playable', () => {
  const result = mapQuestionToPlayerPayload(
    question({ question_type_code: 'long', options: [], model_answer: null }),
    SCOPE
  );

  const item = result.activity?.kind === 'essay' ? result.activity.item : null;
  assert.equal(result.ok, true);
  assert.equal(item?.model_answer, null);
  assert.deepEqual(item?.keywords, []);
});

test('an empty prompt is refused', () => {
  const result = mapQuestionToPlayerPayload(
    question({ question_type_code: 'short', options: [], question: '   ' }),
    SCOPE
  );

  assert.equal(result.ok, false);
});
