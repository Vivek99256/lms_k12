import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BLOOM_LEVEL_META,
  MAX_QUESTIONS,
  allowedLevelMeta,
  buildGenerateRequest,
  buildQuotaRows,
  clampMarks,
  defaultPointsFor,
  h5pInfoForFormat,
  evenSplitLabel,
  isValidQuestionTotal,
  marksLabel,
  normaliseGeneratableFormats,
  orderSelectedFormats,
  previewExtras,
  pruneSelection,
  suggestedBloomCounts,
  toFormatCards,
  totalCoversFormats,
  type BloomLevel,
  type GeneratableFormat,
} from './generatable-formats';

/**
 * The logic behind the catalogue-driven Generate AI questions modal.
 *
 * The formats below are the entries the backend's formats endpoint returns for the
 * live question_type_catalog (read-only query, 2026-10-05) -- same codes, labels,
 * marks and Bloom limits as QuestionFormatRegistry::generatable(). The component
 * itself is not rendered here (this repo has no DOM test harness); everything it
 * decides is.
 */

const ALL: BloomLevel[] = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'];

function format(over: Partial<GeneratableFormat> & { code: string; label: string }): GeneratableFormat {
  return {
    lms_question_type_id: 2,
    default_marks: 1,
    marks_editable: false,
    min_marks: 1,
    max_marks: 1,
    allowed_bloom_levels: ALL,
    ...over,
  };
}

const FORMATS: GeneratableFormat[] = [
  format({ code: 'mcq', label: 'Multiple Choice', lms_question_type_id: 1 }),
  format({ code: 'true_false', label: 'True / False', lms_question_type_id: 1, allowed_bloom_levels: ['Remember', 'Understand', 'Apply', 'Analyze'] }),
  format({ code: 'fill_blank', label: 'Fill in the Blank', allowed_bloom_levels: ['Remember', 'Understand', 'Apply'] }),
  format({ code: 'match_following', label: 'Match the Following', allowed_bloom_levels: ['Remember', 'Understand', 'Apply'] }),
  format({ code: 'assertion_reason', label: 'Assertion & Reason', lms_question_type_id: 1, allowed_bloom_levels: ['Understand', 'Analyze', 'Evaluate'] }),
  format({ code: 'numerical', label: 'Numerical Response', default_marks: 2, marks_editable: true, min_marks: 1, max_marks: 3, allowed_bloom_levels: ['Apply', 'Analyze', 'Evaluate'] }),
  format({ code: 'very_short', label: 'Very Short Answer', default_marks: 2, marks_editable: true, min_marks: 1, max_marks: 2, allowed_bloom_levels: ['Remember', 'Understand', 'Apply'] }),
  format({ code: 'short', label: 'Short Answer', default_marks: 3, marks_editable: true, min_marks: 2, max_marks: 3, allowed_bloom_levels: ['Understand', 'Apply', 'Analyze'] }),
  format({ code: 'long', label: 'Long Answer', default_marks: 5, marks_editable: true, min_marks: 4, max_marks: 6, allowed_bloom_levels: ['Apply', 'Analyze', 'Evaluate', 'Create'] }),
  format({ code: 'case_study', label: 'Case Study', default_marks: 4, marks_editable: true, min_marks: 3, max_marks: 8, allowed_bloom_levels: ['Apply', 'Analyze', 'Evaluate', 'Create'] }),
];

const byCode = (code: string) => FORMATS.find((f) => f.code === code)!;

// ---------------------------------------------------------------------------
// Catalogue-driven cards
// ---------------------------------------------------------------------------

test('a card is built for every format the backend returns, in the order it returns them', () => {
  const cards = toFormatCards(FORMATS);

  assert.deepEqual(cards.map((card) => card.code), FORMATS.map((f) => f.code));
  assert.deepEqual(cards.map((card) => card.label), FORMATS.map((f) => f.label));
});

test('a format the backend adds later gets a card with no change here', () => {
  const [card] = toFormatCards([format({ code: 'brand_new_form', label: 'Brand New Form' })]);

  assert.equal(card.code, 'brand_new_form');
  assert.equal(card.h5p.mapped, false);
  assert.match(card.h5p.note, /not mapped to an H5P type yet/);
});

test('no format is hardcoded: an empty response yields no cards', () => {
  assert.deepEqual(toFormatCards([]), []);
});

test('the card shows the default marks, with the range when marks are editable', () => {
  const marks = Object.fromEntries(toFormatCards(FORMATS).map((card) => [card.code, card.marks]));

  assert.deepEqual(marks, {
    mcq: '1 mark',
    true_false: '1 mark',
    fill_blank: '1 mark',
    match_following: '1 mark',
    assertion_reason: '1 mark',
    numerical: '2 marks (1–3)',
    very_short: '2 marks (1–2)',
    short: '3 marks (2–3)',
    long: '5 marks (4–6)',
    case_study: '4 marks (3–8)',
  });
  assert.equal(marksLabel(format({ code: 'x', label: 'X', marks_editable: true, min_marks: 2, max_marks: 2, default_marks: 2 })), '2 marks');
});

// ---------------------------------------------------------------------------
// H5P target, read from the existing map (no mapping of its own)
// ---------------------------------------------------------------------------

test('every generatable format is mapped to an H5P type by the existing map', () => {
  for (const f of FORMATS) {
    const info = h5pInfoForFormat(f.code);

    assert.equal(info.mapped, true, `${f.code} is not in the H5P map`);
    assert.ok(info.target, `${f.code} has no default H5P target`);
    assert.ok(info.library, `${f.code} has no H5P library`);
  }
});

test('each format shows the H5P type the map names for it', () => {
  const targets = Object.fromEntries(FORMATS.map((f) => [f.code, h5pInfoForFormat(f.code).target]));

  assert.deepEqual(targets, {
    mcq: 'Single choice set',
    true_false: 'True or false',
    fill_blank: 'Fill in the blanks',
    match_following: 'Memory game',
    assertion_reason: 'Single choice set',
    numerical: 'Fill in the blanks',
    very_short: 'Written answer',
    short: 'Written answer',
    long: 'Written answer',
    case_study: 'Course presentation',
  });
});

test('a substitution is flagged and explained; an exact match is not', () => {
  // Exact: the requested library is built.
  for (const code of ['true_false', 'fill_blank', 'match_following', 'case_study']) {
    const info = h5pInfoForFormat(code);
    assert.equal(info.exact, true, code);
    assert.equal(info.note, '', code);
  }
  // Substituted: the closest built type is used, and the map says why.
  for (const code of ['mcq', 'assertion_reason', 'numerical', 'very_short', 'short', 'long']) {
    const info = h5pInfoForFormat(code);
    assert.equal(info.exact, false, code);
    assert.ok(info.note.length > 20, `${code} should explain the substitution`);
  }
  assert.match(h5pInfoForFormat('mcq').note, /MultiChoice/);
  assert.match(h5pInfoForFormat('numerical').note, /Arithmetic quiz/);
});

test('the other H5P types a format also plays as are listed', () => {
  assert.deepEqual(h5pInfoForFormat('fill_blank').alsoPlaysAs, ['Drag the words', 'Mark the words', 'Flash cards', 'Course presentation']);
  assert.ok(h5pInfoForFormat('true_false').alsoPlaysAs.includes('Single choice set'));
  assert.deepEqual(h5pInfoForFormat('case_study').alsoPlaysAs, []);
});

// ---------------------------------------------------------------------------
// Bloom levels
// ---------------------------------------------------------------------------

test('only the levels a format allows are offered', () => {
  assert.deepEqual(allowedLevelMeta(byCode('true_false')).map((m) => m.level), ['Remember', 'Understand', 'Apply', 'Analyze']);
  assert.deepEqual(allowedLevelMeta(byCode('assertion_reason')).map((m) => m.level), ['Understand', 'Analyze', 'Evaluate']);
  assert.deepEqual(allowedLevelMeta(byCode('long')).map((m) => m.level), ['Apply', 'Analyze', 'Evaluate', 'Create']);
  assert.equal(allowedLevelMeta(null).length, 6);
  assert.equal(allowedLevelMeta(undefined).length, 6);
});

/**
 * The split exactly as chapters/page.tsx computed it before this change (verbatim,
 * with its own copy of the weights). It is the oracle: with no format chosen the
 * new function must agree with it for every total the modal accepts.
 */
function legacySuggestedBloomCounts(total: number): Record<BloomLevel, number> {
  const meta: Array<{ level: BloomLevel; weight: number }> = [
    { level: 'Remember', weight: 0.15 },
    { level: 'Understand', weight: 0.3 },
    { level: 'Apply', weight: 0.3 },
    { level: 'Analyze', weight: 0.15 },
    { level: 'Evaluate', weight: 0.1 },
    { level: 'Create', weight: 0 },
  ];
  const empty = Object.fromEntries(meta.map((m) => [m.level, 0])) as Record<BloomLevel, number>;
  if (!Number.isFinite(total) || total <= 0) return { ...empty };

  const exact = meta.map((m) => ({ level: m.level, value: total * m.weight }));
  const counts = { ...empty };
  exact.forEach((entry) => {
    counts[entry.level] = Math.floor(entry.value);
  });

  let remaining = total - Object.values(counts).reduce((sum, value) => sum + value, 0);
  const byRemainder = [...exact]
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - Math.floor(b.value) - (a.value - Math.floor(a.value)));

  let index = 0;
  while (remaining > 0 && byRemainder.length > 0) {
    counts[byRemainder[index % byRemainder.length].level] += 1;
    remaining -= 1;
    index += 1;
  }

  return counts;
}

test('the suggested split is exactly the one the modal always seeded', () => {
  const asArray = (counts: Record<BloomLevel, number>) => ALL.map((level) => counts[level]);

  assert.deepEqual(asArray(suggestedBloomCounts(10)), [2, 3, 3, 1, 1, 0]);
  assert.deepEqual(asArray(suggestedBloomCounts(5)), [1, 2, 1, 1, 0, 0]);
  assert.deepEqual(asArray(suggestedBloomCounts(0)), [0, 0, 0, 0, 0, 0]);
  assert.deepEqual(asArray(suggestedBloomCounts(Number.NaN)), [0, 0, 0, 0, 0, 0]);

  for (let total = 0; total <= MAX_QUESTIONS; total += 1) {
    assert.deepEqual(suggestedBloomCounts(total), legacySuggestedBloomCounts(total), `total ${total}`);
  }
});

test('the split always adds back up to the total, for every total and every format', () => {
  for (const f of [null, ...FORMATS]) {
    const allowed = f ? f.allowed_bloom_levels : undefined;

    for (let total = 1; total <= MAX_QUESTIONS; total += 1) {
      const counts = suggestedBloomCounts(total, allowed);
      const sum = ALL.reduce((acc, level) => acc + counts[level], 0);

      assert.equal(sum, total, `${f?.code ?? 'none'} total ${total}`);
      if (allowed) {
        for (const level of ALL.filter((l) => !allowed.includes(l))) {
          assert.equal(counts[level], 0, `${f?.code} must not allocate to ${level}`);
        }
      }
    }
  }
});

test('a format whose levels carry no default weight shares the total equally', () => {
  const counts = suggestedBloomCounts(5, ['Create']);

  assert.equal(counts.Create, 5);
  assert.equal(suggestedBloomCounts(4, ['Evaluate', 'Create']).Evaluate + suggestedBloomCounts(4, ['Evaluate', 'Create']).Create, 4);
});

// ---------------------------------------------------------------------------
// Marks
// ---------------------------------------------------------------------------

test('marks are held inside the format range', () => {
  const short = byCode('short');

  assert.equal(clampMarks(short, 1), 2);
  assert.equal(clampMarks(short, 9), 3);
  assert.equal(clampMarks(short, 2.6), 3);
  assert.equal(clampMarks(byCode('true_false'), 5), 1);
});

test('default marks per level come from the format, not the legacy ladder', () => {
  assert.deepEqual(Object.values(defaultPointsFor(byCode('short'))), [3, 3, 3, 3, 3, 3]);
  assert.deepEqual(Object.values(defaultPointsFor(byCode('true_false'))), [1, 1, 1, 1, 1, 1]);
  assert.deepEqual(Object.values(defaultPointsFor(byCode('case_study'))), [4, 4, 4, 4, 4, 4]);
  // No format chosen: the legacy ladder, untouched.
  assert.deepEqual(Object.values(defaultPointsFor(null)), BLOOM_LEVEL_META.map((m) => m.points));
});

// ---------------------------------------------------------------------------
// The request
// ---------------------------------------------------------------------------

const IDS = { chapter_id: 11, subject_id: 3, standard_id: 8, concept_id: 123 };

function counts(over: Partial<Record<BloomLevel, number>>): Partial<Record<BloomLevel, number>> {
  return over;
}

test('the request names the selected format and nothing from the legacy contract', () => {
  const body = buildGenerateRequest({
    ids: IDS, formats: [byCode('true_false')], total: 5, auto: true, counts: {}, difficulties: {}, points: {},
  });

  assert.deepEqual(body.question_format_codes, ['true_false']);
  assert.equal('question_format_code' in body, false, 'one array replaces the singular field');
  assert.equal(body.total_questions, 5);
  assert.deepEqual({ chapter_id: body.chapter_id, subject_id: body.subject_id, standard_id: body.standard_id, concept_id: body.concept_id }, IDS);
  assert.equal('question_type' in body, false, 'the legacy alias is not sent');
  assert.equal('question_type_id' in body, false, 'the type id is resolved server-side');
  assert.equal('sub_institute_id' in body, false);
  assert.equal('created_by' in body, false);
});

test('auto mode sends no quota, so the server decides the mix over the allowed levels', () => {
  const body = buildGenerateRequest({
    ids: IDS, formats: [byCode('long')], total: 4, auto: true, counts: counts({ Apply: 4 }), difficulties: {}, points: {},
  });

  assert.equal('quota' in body, false);
});

test('a custom mix sends only the levels with a count, in ladder order', () => {
  const body = buildGenerateRequest({
    ids: IDS,
    formats: [byCode('assertion_reason')],
    total: 5,
    auto: false,
    counts: counts({ Evaluate: 1, Understand: 3, Analyze: 0, Apply: 0 }),
    difficulties: { Understand: 'Easy', Evaluate: 'Hard' },
    points: {},
  });

  assert.deepEqual(body.quota?.map((row) => row.level), ['Understand', 'Evaluate']);
  assert.deepEqual(body.quota?.map((row) => row.count), [3, 1]);
  assert.deepEqual(body.quota?.map((row) => row.difficulty), ['Easy', 'Hard']);
});

test('a level the format excludes is never sent, even with a count', () => {
  const rows = buildQuotaRows({
    format: byCode('true_false'),
    counts: counts({ Remember: 2, Create: 3, Evaluate: 1 }),
    difficulties: {},
    points: {},
  });

  assert.deepEqual(rows.map((row) => row.level), ['Remember']);
});

test('fixed-marks formats send no marks; editable ones send marks inside their range', () => {
  const fixed = buildQuotaRows({ format: byCode('fill_blank'), counts: counts({ Remember: 2 }), difficulties: {}, points: { Remember: 9 } });
  assert.equal('points' in fixed[0], false);

  const editable = buildQuotaRows({
    format: byCode('short'),
    counts: counts({ Understand: 1, Apply: 1, Analyze: 1 }),
    difficulties: {},
    points: { Understand: 1, Apply: 3, Analyze: 99 },
  });
  assert.deepEqual(editable.map((row) => row.points), [2, 3, 3]);
});

test('a custom mix with no counts still sends an empty quota, never a silent auto', () => {
  const body = buildGenerateRequest({
    ids: IDS, formats: [byCode('short')], total: 3, auto: false, counts: {}, difficulties: {}, points: {},
  });

  assert.deepEqual(body.quota, []);
});

// ---------------------------------------------------------------------------
// Question count
// ---------------------------------------------------------------------------

test('the question count stays 1 to 50', () => {
  assert.equal(MAX_QUESTIONS, 50);

  for (const ok of ['1', '5', '20', '50']) assert.equal(isValidQuestionTotal(ok), true, ok);
  for (const bad of ['', ' ', '0', '51', '100', '-3', '2.5', 'ten']) assert.equal(isValidQuestionTotal(bad), false, bad);
});

// ---------------------------------------------------------------------------
// Loading the catalogue: what the formats endpoint returns, made safe
// ---------------------------------------------------------------------------


test('a well-formed formats response passes through unchanged', () => {
  const normalised = normaliseGeneratableFormats(FORMATS);

  assert.deepEqual(normalised.map((f) => f.code), FORMATS.map((f) => f.code));
  assert.deepEqual(normalised.map((f) => f.allowed_bloom_levels), FORMATS.map((f) => f.allowed_bloom_levels));
  assert.deepEqual(normalised.map((f) => f.default_marks), FORMATS.map((f) => f.default_marks));
});

test('a response that is not a list yields no formats, never a crash', () => {
  for (const bad of [null, undefined, {}, 'formats', 42, { data: [] }]) {
    assert.deepEqual(normaliseGeneratableFormats(bad), []);
  }
});

test('unusable entries are dropped instead of becoming cards that cannot work', () => {
  const kept = normaliseGeneratableFormats([
    null,
    'true_false',
    { label: 'No code' },
    { code: 'no_label' },
    { code: 'Bad Code!', label: 'Bad code' },
    { code: "x'; DROP", label: 'Injection-shaped' },
    { code: 'good_one', label: 'Good one', default_marks: 1 },
    { code: 'good_one', label: 'Duplicate of the above' },
  ]);

  assert.deepEqual(kept.map((f) => f.code), ['good_one']);
  assert.equal(kept[0].label, 'Good one');
});

test('a sparse entry is completed with safe defaults', () => {
  const [format] = normaliseGeneratableFormats([{ code: 'sparse', label: 'Sparse' }]);

  assert.equal(format.default_marks, 1);
  assert.equal(format.min_marks, 1);
  assert.equal(format.max_marks, 1);
  assert.equal(format.marks_editable, false);
  assert.deepEqual(format.allowed_bloom_levels, ALL, 'no levels declared means every level, so the mix table is never empty');
});

test('unknown Bloom levels are ignored and marks are held in order', () => {
  const [format] = normaliseGeneratableFormats([
    { code: 'odd', label: 'Odd', allowed_bloom_levels: ['Apply', 'Memorise', 7, 'Create'], default_marks: 9, min_marks: 2, max_marks: 4, marks_editable: true },
  ]);

  assert.deepEqual(format.allowed_bloom_levels, ['Apply', 'Create']);
  assert.equal(format.default_marks, 4, 'default is clamped into [min, max]');
  assert.equal(format.marks_editable, true);

  const [fixed] = normaliseGeneratableFormats([{ code: 'fixed', label: 'Fixed', marks_editable: true, default_marks: 2, min_marks: 2, max_marks: 2 }]);
  assert.equal(fixed.marks_editable, false, 'a single-value range is not editable whatever the flag says');
});

test('the normaliser feeds the same cards the modal renders', () => {
  const cards = toFormatCards(normaliseGeneratableFormats(FORMATS));

  assert.equal(cards.length, 10);
  assert.equal(cards[0].code, 'mcq');
  assert.equal(cards[9].code, 'case_study');
});

// ---------------------------------------------------------------------------
// The generated-question preview
// ---------------------------------------------------------------------------

test('preview extras read the pairs of a match question', () => {
  const extras = previewExtras({
    pairs: [
      { left: 'x-axis', right: 'Horizontal line' },
      { left: ' y-axis ', right: 'Vertical line' },
      { left: '', right: 'dropped' },
    ],
  });

  assert.deepEqual(extras.pairs, [
    { left: 'x-axis', right: 'Horizontal line' },
    { left: 'y-axis', right: 'Vertical line' },
  ]);
});

test('preview extras read the gap answers of a fill-in-the-blank question', () => {
  assert.deepEqual(previewExtras({ answers: ['referee', ' judge ', '', 7, null] }).answers, ['referee', 'judge']);
});

test('preview extras read the working and unit of a numerical question', () => {
  const extras = previewExtras({ solution_steps: ['Descent is negative.', '4 x (-3) = -12.'], unit: ' m ' });

  assert.deepEqual(extras.steps, ['Descent is negative.', '4 x (-3) = -12.']);
  assert.equal(extras.unit, 'm');
});

test('preview extras are empty, not undefined, for formats that have none', () => {
  for (const answer of [undefined, null, {}, { pairs: 'x', answers: 'y', solution_steps: {}, unit: 3 }]) {
    assert.deepEqual(previewExtras(answer), { pairs: [], answers: [], steps: [], unit: null });
  }
});

// ---------------------------------------------------------------------------
// Several formats at once
// ---------------------------------------------------------------------------

test('the request carries every selected format code, in the order given', () => {
  const body = buildGenerateRequest({
    ids: IDS,
    formats: [byCode('mcq'), byCode('fill_blank'), byCode('numerical'), byCode('match_following')],
    total: 20,
    auto: true,
    counts: {},
    difficulties: {},
    points: {},
  });

  assert.deepEqual(body.question_format_codes, ['mcq', 'fill_blank', 'numerical', 'match_following']);
  assert.equal(body.total_questions, 20);
  assert.equal('quota' in body, false);
  assert.equal('question_type' in body, false);
  assert.equal('question_type_id' in body, false);
});

test('a custom mix is sent only for a single format, never with several', () => {
  const custom = {
    ids: IDS,
    total: 4,
    auto: false,
    counts: counts({ Understand: 2, Apply: 2 }),
    difficulties: {},
    points: {},
  };

  const one = buildGenerateRequest({ ...custom, formats: [byCode('true_false')] });
  assert.deepEqual(one.quota?.map((row) => row.level), ['Understand', 'Apply']);

  const several = buildGenerateRequest({ ...custom, formats: [byCode('true_false'), byCode('mcq')] });
  assert.equal('quota' in several, false, 'the server would refuse it');
});

test('selected formats are listed in the backend order, whatever order they were clicked', () => {
  const picked = orderSelectedFormats(['case_study', 'mcq', 'fill_blank'], FORMATS);

  assert.deepEqual(picked.map((f) => f.code), ['mcq', 'fill_blank', 'case_study']);
});

test('a code the backend no longer offers is dropped from the selection', () => {
  assert.deepEqual(pruneSelection(['mcq', 'retired_form', 'short'], FORMATS), ['mcq', 'short']);
  assert.deepEqual(orderSelectedFormats(['retired_form'], FORMATS), []);
  assert.deepEqual(pruneSelection([], FORMATS), []);
});

test('the total must reach the number of formats', () => {
  assert.equal(totalCoversFormats(5, 5), true);
  assert.equal(totalCoversFormats(20, 4), true);
  assert.equal(totalCoversFormats(3, 4), false);
  assert.equal(totalCoversFormats(0, 1), false);
  assert.equal(totalCoversFormats(1, 0), true, 'no formats yet: only the count itself is checked');
  assert.equal(totalCoversFormats(2.5, 1), false);
});

test('the split is described the way the server divides it', () => {
  assert.equal(evenSplitLabel(15, 3), '5 each');
  assert.equal(evenSplitLabel(20, 4), '5 each');
  assert.equal(evenSplitLabel(20, 3), '6\u20137 each');
  assert.equal(evenSplitLabel(7, 2), '3\u20134 each');
  assert.equal(evenSplitLabel(20, 1), '', 'a single format has no split to describe');
  assert.equal(evenSplitLabel(2, 3), '', 'fewer questions than formats cannot be split');
});

test('every format the backend returns can be selected together', () => {
  const picked = orderSelectedFormats(FORMATS.map((f) => f.code), FORMATS);

  assert.equal(picked.length, FORMATS.length);
  assert.ok(totalCoversFormats(FORMATS.length, picked.length));
  assert.equal(evenSplitLabel(MAX_QUESTIONS, picked.length), '5 each');
});

// ---------------------------------------------------------------------------
// The four formats added after the first ten
// ---------------------------------------------------------------------------

const ADDED: GeneratableFormat[] = [
  format({ code: 'drag_text', label: 'Drag Text', lms_question_type_id: 1, default_marks: 2, min_marks: 2, max_marks: 2, allowed_bloom_levels: ['Remember', 'Understand', 'Apply'] }),
  format({ code: 'mark_the_words', label: 'Mark the Words', lms_question_type_id: 1, default_marks: 2, min_marks: 2, max_marks: 2, allowed_bloom_levels: ['Remember', 'Understand', 'Apply'] }),
  format({ code: 'proof', label: 'Prove / Show That', default_marks: 5, marks_editable: true, min_marks: 4, max_marks: 6, allowed_bloom_levels: ['Apply', 'Analyze', 'Evaluate'] }),
  format({ code: 'construction', label: 'Plot / Draw / Construct', default_marks: 3, marks_editable: true, min_marks: 2, max_marks: 4, allowed_bloom_levels: ['Apply', 'Analyze', 'Create'] }),
];

test('drag the words and mark the words are mapped to their own H5P players, exactly', () => {
  const drag = h5pInfoForFormat('drag_text');
  assert.equal(drag.mapped, true);
  assert.equal(drag.target, 'Drag the words');
  assert.equal(drag.exact, true);
  assert.equal(drag.note, '');
  assert.ok(drag.alsoPlaysAs.includes('Fill in the blanks'));

  const mark = h5pInfoForFormat('mark_the_words');
  assert.equal(mark.target, 'Mark the words');
  assert.equal(mark.exact, true);
});

test('proof and construction play as a course presentation and say it is the closest built type', () => {
  for (const code of ['proof', 'construction']) {
    const info = h5pInfoForFormat(code);

    assert.equal(info.target, 'Course presentation', code);
    assert.equal(info.exact, false, code);
    assert.match(info.note, /InteractiveBook/, code);
  }
});

test('cards for the added formats carry their marks and a mapping', () => {
  const cards = toFormatCards(ADDED);

  assert.deepEqual(cards.map((card) => card.marks), ['2 marks', '2 marks', '5 marks (4\u20136)', '3 marks (2\u20134)']);
  for (const card of cards) assert.equal(card.h5p.mapped, true, card.code);
});

test('the added formats select together with the first ten and split evenly', () => {
  const all = [...FORMATS, ...ADDED];
  const picked = orderSelectedFormats(all.map((f) => f.code), all);

  assert.equal(picked.length, 14);
  assert.ok(totalCoversFormats(14, picked.length));
  assert.equal(evenSplitLabel(28, picked.length), '2 each');
  assert.equal(evenSplitLabel(MAX_QUESTIONS, picked.length), '3\u20134 each');
});
