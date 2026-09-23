import test from 'node:test';
import assert from 'node:assert/strict';

import {
  H5P_TARGETS,
  MAPPINGS,
  convertibilityAs,
  flashcardSides,
  formsReaching,
  mappingForQuestion,
  playsAs,
  questionsPlayableAs,
  targetsForQuestion,
  type BankQuestion,
  type H5pTargetKind,
} from './question-bank-h5p-map';
import { mapQuestionToPlayerPayload, type RuntimeScope } from './question-bank-runtime';

/**
 * One question, several H5P content types.
 *
 * WHAT IS WORTH GUARDING HERE, and it is not "does it render". It is that
 * asking the same row a different way does not quietly change what the row
 * MEANS. The failure this file exists to catch is a question that plays as
 * three types and marks correctly in only one of them — a passage that loses
 * its answer key when the type changes, a card whose back is empty, a
 * mark-the-words activity where every word is an answer. Each of those plays
 * perfectly and scores nonsense, which is the class of bug that reaches a
 * classroom.
 *
 * The refusals are asserted as hard as the successes, for the same reason: a
 * type that lists a question it cannot actually ask is worse than one that
 * lists fewer.
 */

const SCOPE: RuntimeScope = { standard_id: 9, subject_id: 4, chapter_id: 1012 };

function blankQuestion(overrides: Partial<BankQuestion> = {}): BankQuestion {
  return {
    id: 501,
    question: 'The powerhouse of the cell is the ______ of every living organism.',
    question_type_code: 'fill_blank',
    model_answer: 'mitochondrion',
    marks: 1,
    ...overrides,
  };
}

function mcqQuestion(overrides: Partial<BankQuestion> = {}): BankQuestion {
  return {
    id: 502,
    question: 'Which gas do plants absorb?',
    question_type_code: 'mcq',
    marks: 1,
    options: [
      { label: 'A', text: 'Carbon dioxide', is_correct: true },
      { label: 'B', text: 'Nitrogen' },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// The map now goes one-to-many
// ---------------------------------------------------------------------------

test('a fill-in-the-blank question plays as all three text types', () => {
  const kinds = targetsForQuestion(blankQuestion()).map((target) => target.kind);

  assert.ok(kinds.includes('fill_in_the_blanks'), 'the default target');
  assert.ok(kinds.includes('drag_text'), 'the same passage, dragged');
  assert.ok(kinds.includes('mark_the_words'), 'the same passage, marked');
});

test('the default target is still first, so every existing caller is unchanged', () => {
  for (const entry of MAPPINGS) {
    if (!entry.target) continue;

    const question: BankQuestion = {
      id: 1,
      question: 'A stem long enough to be a sentence with a real answer in it.',
      question_type_code: entry.code,
      model_answer: 'answer',
      options: [
        { label: 'A', text: 'Carbon dioxide', is_correct: true },
        { label: 'B', text: 'Nitrogen' },
      ],
    };

    const targets = targetsForQuestion(question);
    if (targets.length === 0) continue;

    // Only when the row can actually carry the default. `targetsForQuestion`
    // drops a target the ROW is missing parts for, which is the point of it —
    // this synthetic row does not read as a verdict, so the true/false form
    // legitimately leads with its secondary target here.
    if (!convertibilityAs(question, entry.target.kind).ok) continue;

    assert.equal(
      targets[0].kind,
      entry.target.kind,
      `${entry.code} must still default to ${entry.target.kind}`
    );
  }
});

test('a secondary target is only offered when the row has the parts for it', () => {
  // Tagged fill-in-the-blank, but the answer is a paragraph. Blanks refuses
  // it, and so must the two types that mark the same key.
  const prose = blankQuestion({
    model_answer:
      'Because the mitochondrion carries out respiration, releasing the energy the cell needs for every process it performs.',
  });

  for (const kind of ['fill_in_the_blanks', 'drag_text', 'mark_the_words'] as H5pTargetKind[]) {
    assert.equal(playsAs(prose, kind), false, `${kind} must refuse a prose answer`);
  }

  // It is still a perfectly good card, because a card marks nothing.
  assert.equal(playsAs(prose, 'flashcards'), true);
});

test('mark the words refuses a question that states its answer separately', () => {
  // No drawn blank in the stem, so the answer is appended — and would always
  // be the last word of the sentence.
  const appended = blankQuestion({ question: 'Name the powerhouse of the cell.' });

  assert.equal(playsAs(appended, 'fill_in_the_blanks'), true, 'typing it is fine');
  assert.equal(playsAs(appended, 'drag_text'), true, 'dragging it is fine');
  assert.equal(playsAs(appended, 'mark_the_words'), false, 'but there is nothing to find');

  const reason = convertibilityAs(appended, 'mark_the_words').reason ?? '';
  assert.match(reason, /not part of the sentence/i);
});

test('mark the words refuses a sentence that is almost entirely answer', () => {
  const bare = blankQuestion({ question: '______ is ______.', model_answer: 'water; wet' });

  assert.equal(playsAs(bare, 'mark_the_words'), false);
});

test('a question is never offered as a type its form does not reach', () => {
  const mcq = mcqQuestion();

  // Multiple choice reaches single choice set, course presentation and cards.
  // It does not reach the text-passage types: there is no passage to mark.
  assert.equal(playsAs(mcq, 'drag_text'), false);
  assert.equal(playsAs(mcq, 'mark_the_words'), false);
  assert.equal(playsAs(mcq, 'flashcards'), true);
});

// ---------------------------------------------------------------------------
// The reverse index: what a content type page asks for
// ---------------------------------------------------------------------------

test('a content type only ever selects questions it can actually ask', () => {
  const chapter: BankQuestion[] = [
    blankQuestion({ id: 1 }),
    mcqQuestion({ id: 2 }),
    { id: 3, question: 'Water boils at 100 degrees Celsius.', question_type_code: 'true_false', model_answer: 'True' },
    { id: 4, question: 'Discuss the causes of the war.', question_type_code: 'long', model_answer: 'A long essay.' },
    { id: 5, question: 'An untagged row.', question_type_code: null },
  ];

  for (const kind of Object.keys(H5P_TARGETS) as H5pTargetKind[]) {
    for (const picked of questionsPlayableAs(chapter, kind)) {
      // The selection and the builder must agree. A page that lists a question
      // the player then refuses is the exact failure this guards.
      const built = mapQuestionToPlayerPayload(picked, SCOPE, undefined, [], kind);
      assert.equal(built.ok, true, `${kind} selected question ${picked.id} but could not build it`);
      assert.equal(built.activity?.kind, kind, `${kind} built a ${built.activity?.kind} instead`);
    }
  }
});

test('an untagged question is offered to no content type at all', () => {
  const untagged: BankQuestion = { id: 9, question: 'Something nobody tagged.', question_type_code: null };

  assert.deepEqual(targetsForQuestion(untagged), []);
  for (const kind of Object.keys(H5P_TARGETS) as H5pTargetKind[]) {
    assert.equal(playsAs(untagged, kind), false);
  }
});

test('every built type except the ones with no source is reachable from some form', () => {
  for (const kind of Object.keys(H5P_TARGETS) as H5pTargetKind[]) {
    assert.ok(formsReaching(kind).length > 0, `nothing reaches ${kind}`);
  }
});

// ---------------------------------------------------------------------------
// The runtime builds what was asked for, not what it felt like
// ---------------------------------------------------------------------------

test('the three text types share one passage and one answer key', () => {
  const question = blankQuestion();

  const built = (['fill_in_the_blanks', 'drag_text', 'mark_the_words'] as const).map((kind) => {
    const result = mapQuestionToPlayerPayload(question, SCOPE, undefined, [], kind);
    assert.equal(result.ok, true, `${kind} should build`);
    assert.equal(result.activity?.kind, kind);
    return result.activity?.item as { passage: string | null; blanks: Array<{ solution: string | null }>; content_type: string; library: string };
  });

  const [blanks, drag, mark] = built;

  assert.equal(drag.passage, blanks.passage, 'the passage must not change with the type');
  assert.equal(mark.passage, blanks.passage);
  assert.deepEqual(
    drag.blanks.map((slot) => slot.solution),
    blanks.blanks.map((slot) => slot.solution),
    'the answer key must not change with the type'
  );

  // What DOES change: the discriminator and the library it reports as.
  assert.equal(blanks.content_type, 'fill_in_the_blanks');
  assert.equal(drag.content_type, 'drag_text');
  assert.equal(mark.content_type, 'mark_the_words');
  assert.equal(drag.library, 'H5P.DragText');
  assert.equal(mark.library, 'H5P.MarkTheWords');
});

test('asking for a type the question cannot be is refused, never silently substituted', () => {
  const mcq = mcqQuestion();
  const result = mapQuestionToPlayerPayload(mcq, SCOPE, undefined, [], 'mark_the_words');

  assert.equal(result.ok, false);
  assert.equal(result.activity, undefined, 'no activity, rather than the default one');
  assert.match(result.reason ?? '', /cannot be asked as mark the words/i);
});

test('omitting the type still builds the question default, unchanged', () => {
  const byDefault = mapQuestionToPlayerPayload(blankQuestion(), SCOPE);
  assert.equal(byDefault.activity?.kind, 'fill_in_the_blanks');
});

test('a match-the-following question becomes a deck of pairs, not one card', () => {
  const match: BankQuestion = {
    id: 601,
    question: 'Match the organ to its function.',
    question_type_code: 'match_following',
    options: [
      { label: 'A', text: 'Heart - pumps blood' },
      { label: 'B', text: 'Lungs - exchange gases' },
    ],
  };

  const result = mapQuestionToPlayerPayload(match, SCOPE, undefined, [], 'flashcards');
  assert.equal(result.ok, true);

  const deck = result.activity?.item as { cards: Array<{ question: string | null; correct_answer: string | null }> };
  assert.equal(deck.cards.length, 2);
  assert.equal(deck.cards[0].question, 'Heart');
  assert.equal(deck.cards[0].correct_answer, 'pumps blood');
});

test('every other form becomes a single card, with the stored answer on the back', () => {
  const result = mapQuestionToPlayerPayload(mcqQuestion(), SCOPE, undefined, [], 'flashcards');
  const deck = result.activity?.item as { cards: Array<{ question: string | null; correct_answer: string | null }> };

  assert.equal(deck.cards.length, 1);
  assert.equal(deck.cards[0].correct_answer, 'Carbon dioxide');
});

test('a card is refused rather than built with a blank back', () => {
  const noAnswer: BankQuestion = { id: 7, question: 'Explain photosynthesis.', question_type_code: 'long' };

  assert.equal(flashcardSides(noAnswer).back, '');
  assert.equal(playsAs(noAnswer, 'flashcards'), false);
});

test('an activity reports the library it IS, so xAPI attributes it to the right type', () => {
  for (const kind of ['drag_text', 'mark_the_words', 'flashcards'] as H5pTargetKind[]) {
    const source = kind === 'flashcards' ? mcqQuestion() : blankQuestion();
    const result = mapQuestionToPlayerPayload(source, SCOPE, undefined, [], kind);

    const item = result.activity?.item as { library: string };
    assert.equal(item.library, H5P_TARGETS[kind].library, `${kind} reported the wrong library`);
  }
});

test('nothing in the projection depends on a question having been converted first', () => {
  // The ids are synthetic and negative on every type, which is what makes an
  // in-memory activity impossible to mistake for a stored one.
  const question = blankQuestion();

  for (const kind of ['fill_in_the_blanks', 'drag_text', 'mark_the_words'] as H5pTargetKind[]) {
    const result = mapQuestionToPlayerPayload(question, SCOPE, undefined, [], kind);
    const item = result.activity?.item as { id: number };
    assert.ok(item.id < 0, `${kind} built a non-negative id`);
  }
});

test('the mapping a question falls under does not change with the type it is asked as', () => {
  const question = blankQuestion();
  const asked = (['fill_in_the_blanks', 'drag_text', 'mark_the_words'] as H5pTargetKind[]).map(
    (kind) => mapQuestionToPlayerPayload(question, SCOPE, undefined, [], kind).mapping?.code
  );

  assert.deepEqual(asked, ['fill_blank', 'fill_blank', 'fill_blank']);
  assert.equal(mappingForQuestion(question)?.code, 'fill_blank');
});
