import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAPPINGS,
  blanksPassage,
  convertibility,
  mappingForCode,
  mappingForQuestion,
  matchPairs,
  sourceDescription,
  toBlanksPayload,
  toCoursePresentationPayload,
  toMemoryGamePayload,
  toSingleChoiceSetPayload,
  toTrueFalsePayload,
  trueFalseAnswer,
  type BankQuestion,
} from './question-bank-h5p-map';

/**
 * What is worth guarding here is the SILENT WRONG CONVERSION: a question that
 * converts and then marks every learner wrong. A missing correct flag, a
 * true/false answer read out of the wrong field, a blank whose marker landed in
 * the prose and a match pair read backwards all produce an activity that plays
 * perfectly and scores nonsense, and that is the class of bug that reaches a
 * classroom. The refusals are asserted as hard as the successes.
 */

function question(overrides: Partial<BankQuestion> = {}): BankQuestion {
  return {
    id: 101,
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

// ---------------------------------------------------------------------------
// The map
// ---------------------------------------------------------------------------

test('every catalogue form the brief lists has a mapping', () => {
  const expected = [
    'mcq', 'assertion_reason', 'true_false', 'fill_blank', 'match_following',
    'very_short', 'short', 'long', 'case_study_parent', 'case_study_child',
    'proof', 'construction', 'numerical', 'competency_focused',
    'source_based_integrated', 'case_study',
  ];

  for (const code of expected) {
    assert.ok(mappingForCode(code), `${code} has no mapping`);
  }
  assert.equal(MAPPINGS.length, expected.length);
});

test('a form whose requested library is absent still routes somewhere, and says why', () => {
  for (const entry of MAPPINGS) {
    if (entry.supported) continue;
    assert.ok(entry.target, `${entry.code} is unsupported with no fallback target`);
    assert.notEqual(entry.note.trim(), '', `${entry.code} substitutes silently`);
  }
});

test('the code is read before the collapsed grading name', () => {
  // The API calls an assertion-and-reason row 'MCQ' too. Reading that first
  // would drop the assertion and the reason from the stem.
  const map = mappingForQuestion(question({ question_type_code: 'assertion_reason', question_type: 'MCQ' }));
  assert.equal(map?.code, 'assertion_reason');
});

test('a row with no code falls back to its catalogue label, then to the grading name', () => {
  assert.equal(
    mappingForQuestion(question({ question_type_code: null, question_type_raw: 'Match the Following' }))?.code,
    'match_following'
  );
  assert.equal(
    mappingForQuestion(question({ question_type_code: null, question_type_raw: null }))?.code,
    'mcq'
  );
  assert.equal(
    mappingForQuestion(question({ question_type_code: null, question_type_raw: null, question_type: 'Narrative' })),
    null
  );
});

// ---------------------------------------------------------------------------
// Refusals
// ---------------------------------------------------------------------------

test('an MCQ with no option flagged correct is refused, not converted', () => {
  const verdict = convertibility(
    question({ options: [{ label: 'A', text: 'One' }, { label: 'B', text: 'Two' }] })
  );
  assert.equal(verdict.ok, false);
  assert.match(String(verdict.reason), /correct/i);
});

test('an MCQ with one option is refused', () => {
  assert.equal(convertibility(question({ options: [{ label: 'A', text: 'One', is_correct: true }] })).ok, false);
});

test('a true/false row whose answer does not read as a verdict is refused', () => {
  const verdict = convertibility(
    question({ question_type_code: 'true_false', options: [], model_answer: 'It depends on the season.' })
  );
  assert.equal(verdict.ok, false);
});

test('a fill-blank row with no stored answer is refused', () => {
  const verdict = convertibility(
    question({ question_type_code: 'fill_blank', options: [], model_answer: '' })
  );
  assert.equal(verdict.ok, false);
});

test('a match row whose pairs cannot be read is refused', () => {
  const verdict = convertibility(
    question({ question_type_code: 'match_following', options: [], model_answer: 'See the table above.' })
  );
  assert.equal(verdict.ok, false);
});

// ---------------------------------------------------------------------------
// True / false
// ---------------------------------------------------------------------------

test('the verdict is read from the flagged option or from the model answer', () => {
  assert.equal(
    trueFalseAnswer(question({ options: [{ label: 'A', text: 'True', is_correct: true }, { label: 'B', text: 'False' }] })),
    true
  );
  assert.equal(
    trueFalseAnswer(question({ options: [{ label: 'A', text: 'True' }, { label: 'B', text: '<p>False</p>', is_correct: true }] })),
    false
  );
  assert.equal(trueFalseAnswer(question({ options: [], model_answer: 'Yes' })), true);
  assert.equal(trueFalseAnswer(question({ options: [], model_answer: 'maybe' })), null);
});

test('a converted true/false pool asks every statement it carries', () => {
  const payload = toTrueFalsePayload([
    question({ id: 1, question_type_code: 'true_false', options: [], model_answer: 'True' }),
    question({ id: 2, question_type_code: 'true_false', options: [], model_answer: 'False' }),
  ]);

  assert.equal(payload.questions_to_ask, 0);
  assert.deepEqual(payload.questions.map((entry) => entry.correct_answer), [true, false]);
});

// ---------------------------------------------------------------------------
// Blanks
// ---------------------------------------------------------------------------

test('a drawn blank becomes the slot, and the rest of the stem stays prose', () => {
  const { passage, slots } = blanksPassage(
    question({ question_type_code: 'fill_blank', options: [], question: 'The capital of France is ______.', model_answer: 'Paris' })
  );

  assert.equal(passage, 'The capital of France is *Paris*.');
  assert.equal(slots, 1);
});

test('several answers fill successive blanks in order', () => {
  const { passage, slots } = blanksPassage(
    question({
      question_type_code: 'fill_blank',
      options: [],
      question: 'Water is made of ____ and ____.',
      model_answer: 'hydrogen; oxygen',
    })
  );

  assert.equal(passage, 'Water is made of *hydrogen* and *oxygen*.');
  assert.equal(slots, 2);
});

test('a stem with no drawn blank gets the answer appended rather than losing it', () => {
  const { passage, slots } = blanksPassage(
    question({ question_type_code: 'fill_blank', options: [], question: 'Name the process.', model_answer: 'Photosynthesis' })
  );

  assert.equal(passage, 'Name the process. *Photosynthesis*');
  assert.equal(slots, 1);
});

test('an asterisk in the prose cannot open a blank', () => {
  const { passage } = blanksPassage(
    question({ question_type_code: 'fill_blank', options: [], question: 'Solve 3 * 4 = ______.', model_answer: '12' })
  );

  // Unescaped, the prose asterisk would pair with the opening one and swallow
  // "4 = " as the answer.
  assert.equal(passage, 'Solve 3 \\* 4 = *12*.');
});

test('a blank with no answer left for it stays drawn instead of becoming an empty slot', () => {
  const { passage, slots } = blanksPassage(
    question({ question_type_code: 'fill_blank', options: [], question: 'A ____ and a ____.', model_answer: 'cat' })
  );

  assert.equal(passage, 'A *cat* and a ______.');
  assert.equal(slots, 1);
});

test('the blanks payload carries the passage and the marks per blank', () => {
  const payload = toBlanksPayload(
    question({ question_type_code: 'fill_blank', options: [], question: 'The ____ is red.', model_answer: 'apple', marks: 2 })
  );

  assert.equal(payload.passage, 'The *apple* is red.');
  assert.equal(payload.points_per_blank, 2);
});

// ---------------------------------------------------------------------------
// Match the following
// ---------------------------------------------------------------------------

test('a keyed model answer resolves its labels against the options', () => {
  const pairs = matchPairs(
    question({
      question_type_code: 'match_following',
      options: [
        { label: 'A', text: 'Mitochondrion' },
        { label: 'B', text: 'Ribosome' },
      ],
      model_answer: 'A - Powerhouse, B - Protein synthesis',
    })
  );

  assert.deepEqual(pairs, [
    { left: 'Mitochondrion', right: 'Powerhouse' },
    { left: 'Ribosome', right: 'Protein synthesis' },
  ]);
});

test('options that carry both halves are read as pairs', () => {
  const pairs = matchPairs(
    question({
      question_type_code: 'match_following',
      model_answer: '',
      options: [
        { label: 'A', text: 'Delhi -> India' },
        { label: 'B', text: 'Paris -> France' },
      ],
    })
  );

  assert.deepEqual(pairs, [
    { left: 'Delhi', right: 'India' },
    { left: 'Paris', right: 'France' },
  ]);
});

test('a memory game gets one card per pair, front and back the right way round', () => {
  const payload = toMemoryGamePayload(
    question({
      question_type_code: 'match_following',
      options: [{ label: 'A', text: 'Delhi -> India' }, { label: 'B', text: 'Paris -> France' }],
      model_answer: '',
    })
  );

  assert.equal(payload.cards.length, 2);
  assert.equal(payload.cards[0].front_text, 'Delhi');
  assert.equal(payload.cards[0].back_text, 'India');
});

// ---------------------------------------------------------------------------
// Single choice set and case studies
// ---------------------------------------------------------------------------

test('correctness travels as the flag, never as the position', () => {
  // H5P puts the right answer at index 0; this schema puts it on `is_correct`
  // and the server reorders. A converter that sorted here would double-apply it.
  const payload = toSingleChoiceSetPayload([
    question({ options: [{ label: 'A', text: 'Nitrogen' }, { label: 'B', text: 'Carbon dioxide', is_correct: true }] }),
  ]);

  assert.deepEqual(payload.questions[0].options.map((option) => option.is_correct), [false, true]);
});

test('an assertion-and-reason stem carries both halves to the learner', () => {
  const payload = toSingleChoiceSetPayload([
    question({
      question_type_code: 'assertion_reason',
      question: '<p>Read both statements.</p>',
      assertion: 'Water boils at 100C at sea level.',
      reason: 'Boiling point falls as pressure falls.',
    }),
  ]);

  assert.match(payload.questions[0].question_text, /Assertion:/);
  assert.match(payload.questions[0].question_text, /Boiling point falls/);
});

test('a case study puts the source first and each sub-part on its own slide', () => {
  const payload = toCoursePresentationPayload(
    question({ id: 7, question_type_code: 'case_study_parent', question: 'A farmer measures his field.', options: [] }),
    [
      question({ id: 8, question: 'What is the area?', options: [] }),
      question({ id: 9, question: 'Which unit applies?' }),
    ]
  );

  assert.equal(payload.slides.length, 3);
  assert.equal(payload.slides[0].title, 'Read this first');
  // The sub-part with options is scored; the one without keeps its model
  // answer in the notes, where a learner never sees it.
  assert.equal(payload.slides[1].elements[0].element_type, 'text');
  assert.equal(payload.slides[2].elements[0].element_type, 'multiple_choice');
});

test('a lone question needs no stem slide', () => {
  const payload = toCoursePresentationPayload(question({ id: 7, question_type_code: 'long', options: [] }), []);
  assert.equal(payload.slides.length, 1);
});

// ---------------------------------------------------------------------------
// The source line
// ---------------------------------------------------------------------------

test('the source line counts distinct questions and names the chapter', () => {
  const description = sourceDescription([12, 13, 13, 14], 'Fractions');

  assert.match(description, /3 question bank questions/);
  assert.match(description, /Fractions/);
  assert.match(sourceDescription([12]), /1 question bank question\./);
});

test('every built payload says where it came from', () => {
  const source = question({ id: 55 });

  for (const description of [
    toSingleChoiceSetPayload([source]).description,
    toTrueFalsePayload([source]).description,
    toBlanksPayload(question({ id: 55, options: [], model_answer: 'x' })).description,
    toCoursePresentationPayload(source, []).description,
  ]) {
    assert.match(description, /question bank/i);
  }
});
