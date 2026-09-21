import test from 'node:test';
import assert from 'node:assert/strict';

import {
  gradeElement,
  nextSlideId,
  presentationFeedback,
  reachableSlideIds,
  scorePresentationAttempt,
  type ScorablePresentation,
  type ScorableSlide,
  type ScorableSlideElement,
} from './course-presentation-scoring';

/**
 * Two things here can go wrong without anybody noticing.
 *
 * SCORING: a multi-answer multiple choice where ticking every box scores full
 * marks. That renders correctly, marks generously, and is only discovered when
 * a whole class gets 100%.
 *
 * NAVIGATION: a branch pointing at a slide that has been deleted, which strands
 * a learner at a dead end the author cannot see because the editor shows the
 * deck as a list.
 */

function element(overrides: Partial<ScorableSlideElement> = {}): ScorableSlideElement {
  return {
    id: 401,
    slide_id: 310,
    element_type: 'multiple_choice',
    content_text: 'Which stage makes vapour?',
    options: {
      answers: [
        { text: 'Evaporation', correct: true },
        { text: 'Condensation', correct: false },
        { text: 'Precipitation', correct: false },
      ],
    },
    points: 4,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Multiple choice
// ---------------------------------------------------------------------------

test('a single-answer question is all or nothing', () => {
  const question = element();

  assert.equal(gradeElement(question, { kind: 'multiple_choice', chosen: [0] }).score, 4);
  assert.equal(gradeElement(question, { kind: 'multiple_choice', chosen: [1] }).score, 0);
  // Two ticks on a single-answer question is not a correct answer.
  assert.equal(gradeElement(question, { kind: 'multiple_choice', chosen: [0, 1] }).score, 0);
});

test('ticking every box on a multi-answer question does not score full marks', () => {
  // The bug this file exists for. Two of four are correct; ticking all four
  // nets 2 − 2 = 0.
  const question = element({
    options: {
      answers: [
        { text: 'Evaporation', correct: true },
        { text: 'Transpiration', correct: true },
        { text: 'Condensation', correct: false },
        { text: 'Collection', correct: false },
      ],
    },
  });

  assert.equal(gradeElement(question, { kind: 'multiple_choice', chosen: [0, 1, 2, 3] }).score, 0);
  assert.equal(gradeElement(question, { kind: 'multiple_choice', chosen: [0, 1] }).score, 4);
  // One right, one wrong: they cancel.
  assert.equal(gradeElement(question, { kind: 'multiple_choice', chosen: [0, 2] }).score, 0);
  // One right, nothing wrong: half marks.
  assert.equal(gradeElement(question, { kind: 'multiple_choice', chosen: [0] }).score, 2);
});

test('a question with no correct answer scores nothing rather than everything', () => {
  const broken = element({ options: { answers: [{ text: 'A' }, { text: 'B' }] } });

  const result = gradeElement(broken, { kind: 'multiple_choice', chosen: [0, 1] });
  assert.equal(result.score, 0);
  assert.equal(result.correct, false);
});

// ---------------------------------------------------------------------------
// True / false
// ---------------------------------------------------------------------------

test('true/false grades against the stored side', () => {
  const question = element({ id: 402, element_type: 'true_false', options: { correct: false }, points: 2 });

  assert.equal(gradeElement(question, { kind: 'true_false', chosen: false }).score, 2);
  assert.equal(gradeElement(question, { kind: 'true_false', chosen: true }).score, 0);
});

// ---------------------------------------------------------------------------
// Blanks
// ---------------------------------------------------------------------------

function blanks(options: Record<string, unknown> = {}): ScorableSlideElement {
  return element({
    id: 403,
    element_type: 'blanks',
    content_text: null,
    options: { passage: 'Water *evaporates* from the *sea/ocean*.', ...options },
    points: 4,
  });
}

test('blanks award one mark per correct slot', () => {
  const result = gradeElement(blanks(), {
    kind: 'blanks',
    responses: { 0: 'evaporates', 1: 'ocean' },
  });

  assert.equal(result.score, 4);
  assert.equal(result.correct, true);
});

test('blanks give partial credit', () => {
  const result = gradeElement(blanks(), { kind: 'blanks', responses: { 0: 'evaporates' } });

  assert.equal(result.score, 2);
  assert.equal(result.correct, false);
});

test('blanks reuse the standalone cloze marking rules', () => {
  // Case-insensitive by default, and the spelling rule only when it is on --
  // the same behaviour as the standalone Fill in the Blanks activity, which is
  // the whole reason this shares its marker.
  assert.equal(gradeElement(blanks(), { kind: 'blanks', responses: { 0: 'EVAPORATES' } }).score, 2);

  assert.equal(gradeElement(blanks(), { kind: 'blanks', responses: { 0: 'evaporotes' } }).score, 0);
  assert.equal(
    gradeElement(blanks({ accept_spelling_errors: true }), {
      kind: 'blanks',
      responses: { 0: 'evaporotes' },
    }).score,
    2
  );

  assert.equal(
    gradeElement(blanks({ case_sensitive: true }), { kind: 'blanks', responses: { 0: 'EVAPORATES' } }).score,
    0
  );
});

// ---------------------------------------------------------------------------
// Embedded drag and drop
// ---------------------------------------------------------------------------

test('an embedded drag question takes the fraction its own player computed', () => {
  const embedded = element({ id: 404, element_type: 'drag_drop', options: null, points: 10 });

  assert.equal(gradeElement(embedded, { kind: 'drag_drop', fraction: 1 }).score, 10);
  assert.equal(gradeElement(embedded, { kind: 'drag_drop', fraction: 0.5 }).score, 5);
  // A fraction outside [0,1] cannot push the element above its point value.
  assert.equal(gradeElement(embedded, { kind: 'drag_drop', fraction: 3 }).score, 10);
  assert.equal(gradeElement(embedded, { kind: 'drag_drop', fraction: -1 }).score, 0);
});

// ---------------------------------------------------------------------------
// Whole attempt
// ---------------------------------------------------------------------------

function deck(): ScorablePresentation {
  const mc = element({ id: 401, slide_id: 310, points: 4 });
  const tf = element({ id: 402, slide_id: 305, element_type: 'true_false', options: { correct: true }, points: 2 });
  const prose = element({
    id: 403,
    slide_id: 310,
    element_type: 'text',
    content_text: '<p>Water moves.</p>',
    options: null,
    points: 0,
  });

  return {
    pass_percentage: 60,
    slides: [
      { id: 310, slide_index: 0, next_slide_id: null, elements: [prose, mc] },
      { id: 305, slide_index: 1, next_slide_id: null, elements: [tf] },
    ],
  };
}

test('only scored elements count towards the total', () => {
  const result = scorePresentationAttempt(deck(), {
    401: { kind: 'multiple_choice', chosen: [0] },
    402: { kind: 'true_false', chosen: true },
  });

  assert.equal(result.maxScore, 6);
  assert.equal(result.score, 6);
  assert.equal(result.percentage, 100);
  assert.equal(result.scoredElementCount, 2);
  assert.equal(result.completed, true);
});

test('unanswered questions count against the total', () => {
  const result = scorePresentationAttempt(deck(), { 401: { kind: 'multiple_choice', chosen: [0] } });

  assert.equal(result.score, 4);
  assert.equal(result.maxScore, 6);
  assert.equal(result.percentage, 67);
  assert.equal(result.answeredCount, 1);
  assert.equal(result.completed, false);
  assert.equal(result.passed, true);
});

test('a lecture deck has a max score of zero and is not a failed attempt', () => {
  const lecture: ScorablePresentation = {
    pass_percentage: 60,
    slides: [
      {
        id: 1,
        slide_index: 0,
        next_slide_id: null,
        elements: [element({ id: 9, element_type: 'text', options: null, points: 0 })],
      },
    ],
  };

  const result = scorePresentationAttempt(lecture, {});

  assert.equal(result.maxScore, 0);
  assert.equal(result.percentage, 0);
  assert.equal(result.scoredElementCount, 0);
  // Vacuously complete: there was nothing to answer, so this deck must not sit
  // permanently "incomplete" in a progress report.
  assert.equal(result.completed, true);
  assert.ok(!Number.isNaN(result.percentage));
});

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

function slides(): ScorableSlide[] {
  // Ids deliberately out of order relative to slide_index.
  return [
    { id: 310, slide_index: 0, next_slide_id: null, elements: [] },
    { id: 305, slide_index: 1, next_slide_id: 322, elements: [] },
    { id: 288, slide_index: 2, next_slide_id: null, elements: [] },
    { id: 322, slide_index: 3, next_slide_id: null, elements: [] },
  ];
}

test('the next slide follows the deck order by default', () => {
  assert.equal(nextSlideId(slides(), 310), 305);
});

test('a branch overrides the deck order', () => {
  // Slide 2 skips slide 3 and lands on slide 4.
  assert.equal(nextSlideId(slides(), 305), 322);
});

test('the last slide has no next', () => {
  assert.equal(nextSlideId(slides(), 322), null);
});

test('a branch to a deleted slide falls back to the sequence', () => {
  const broken = slides().map((s) => (s.id === 305 ? { ...s, next_slide_id: 99999 } : s));

  // The dead end this exists to prevent: following 99999 would strand the
  // learner, and returning null would end the deck two slides early.
  assert.equal(nextSlideId(broken, 305), 288);
});

test('a slide reachable only through a button is still reachable', () => {
  const withButton: ScorableSlide[] = [
    { id: 1, slide_index: 0, next_slide_id: 3, elements: [] },
    {
      id: 2,
      slide_index: 1,
      next_slide_id: null,
      elements: [],
    },
    {
      id: 3,
      slide_index: 2,
      next_slide_id: null,
      elements: [
        element({
          id: 50,
          slide_id: 3,
          element_type: 'goto_slide',
          options: { target_slide_id: 2 },
          points: 0,
        }),
      ],
    },
  ];

  // Slide 1 branches straight to 3, so 2 is off the sequence — but 3 has a
  // button back to it.
  assert.deepEqual([...reachableSlideIds(withButton)].sort((a, b) => a - b), [1, 2, 3]);
});

test('a stranded slide is reported as unreachable', () => {
  const stranded: ScorableSlide[] = [
    { id: 1, slide_index: 0, next_slide_id: 3, elements: [] },
    { id: 2, slide_index: 1, next_slide_id: null, elements: [] },
    { id: 3, slide_index: 2, next_slide_id: null, elements: [] },
  ];

  const reachable = reachableSlideIds(stranded);
  assert.equal(reachable.has(2), false);
  assert.equal(reachable.has(3), true);
});

test('the last matching feedback band wins', () => {
  const bands = [
    { from: 0, to: 59, feedback: 'Read it again.' },
    { from: 60, to: 100, feedback: 'You have the cycle.' },
  ];

  assert.equal(presentationFeedback(67, bands), 'You have the cycle.');
  assert.equal(presentationFeedback(10, bands), 'Read it again.');
});
