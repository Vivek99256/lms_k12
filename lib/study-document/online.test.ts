import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { purposeRemedialDocument, purposeRevisionDocument } from './fixtures/purpose-documents';
import { activityKey } from '../study-deck/deck';
import { clozeFrom, compareItemStatements, firstLetters, markTerms, playsOf, sameAnswer, shuffled, slidePlays } from './play';
import { parseDocument, partByNumber, partsOf } from './document';
import { conceptMapOf, HINT_LEVELS, SOLO_LEVELS, activityStatus, activityStepKey, diagnosticSummary, exitVerdict, interactionStepOf, performDone, performKey, questionKeys, recommendedUnits, resultActions, slotsOf } from './journey';
import {
  checklistOf,
  clinicCardsOf,
  featuresOf,
  flashcardsOf,
  guidedOf,
  ifMissedFor,
  mistakesInteraction,
  partProgress,
  questionGroups,
  readinessRule,
  stepsInteraction,
  tickItemsOf,
  topicMixupInteraction,
  unitPointers,
} from './online';
import type { ActivityPart, BodyPart, DocumentKind, StudyDocument } from './types';

const golden = JSON.parse(readFileSync(new URL('./fixtures/study-documents-golden.json', import.meta.url), 'utf8')) as Record<DocumentKind, unknown>;
const legacy = (kind: DocumentKind): StudyDocument => parseDocument(structuredClone(golden[kind]));
const revision = (): StudyDocument => parseDocument(purposeRevisionDocument());
const remedial = (): StudyDocument => parseDocument(purposeRemedialDocument());

/** The part with this number, which must be of this type. */
function at<T extends BodyPart['type']>(doc: StudyDocument, n: number, type: T): Extract<BodyPart, { type: T }> {
  const part = partByNumber(doc, n);
  assert.ok(part && part.type === type, `part ${n} should be a ${type}`);

  return part as Extract<BodyPart, { type: T }>;
}

const featuresAt = (doc: StudyDocument, n: number) => featuresOf(partByNumber(doc, n) as BodyPart);

// ---------------------------------------------------------------------------
// Key terms and the checklist
// ---------------------------------------------------------------------------

test('the key terms are the glossary, when the document has one', () => {
  const cards = flashcardsOf(revision());

  assert.deepEqual(
    cards.map((c) => [c.id, c.term, c.part]),
    [
      ['term:3:0', 'Law', 3],
      ['term:3:1', 'Model', 3],
      ['term:3:2', 'Theory', 3],
    ]
  );
  assert.equal(cards[1].meaning, 'A simplified representation of a real system.');
});

test('glossary cards are alphabetical, skip a term with no meaning, and keep the id of their place in the glossary', () => {
  const raw = purposeRevisionDocument();
  const glossary = raw.sections[3];
  assert.ok(glossary.type === 'glossary');
  glossary.content.terms = [
    { term: 'zeta', meaning: 'Last.', concept_id: 1, topic_id: 10 },
    { term: 'Empty', meaning: '  ', concept_id: 1, topic_id: 10 },
    { term: 'alpha', meaning: 'First.', concept_id: 2, topic_id: 10 },
  ];
  const cards = flashcardsOf(parseDocument(raw));

  assert.deepEqual(cards.map((c) => [c.id, c.term]), [['term:3:2', 'alpha'], ['term:3:0', 'zeta']]);
});

test('a legacy document still gets its key terms from the definitions in its notes', () => {
  const cards = flashcardsOf(legacy('revision_notes'));

  assert.deepEqual(cards.map((c) => [c.id, c.term, c.part]), [['term:3', 'Law', 3], ['term:1', 'Model', 1], ['term:4', 'Theory', 4]]);
});

test('only revision notes have key terms and a checklist', () => {
  assert.deepEqual(flashcardsOf(remedial()), []);
  assert.deepEqual(checklistOf(remedial()), []);
  assert.deepEqual(checklistOf(legacy('activities')), []);
});

test('the checklist is the topics\' "I can" statements, grouped by topic in the outline\'s order', () => {
  const groups = checklistOf(revision());

  assert.deepEqual(
    groups.map((g) => [g.topicId, g.topic, g.items.map((i) => [i.id, i.part, i.partTitle])]),
    [
      [10, 'Models', [['check:1:0', 1, 'Models'], ['check:1:1', 1, 'Models']]],
      [11, 'Laws and theories', [['check:2:0', 2, 'Laws and theories']]],
    ]
  );
});

test('a legacy document still gets its checklist from its notes', () => {
  const groups = checklistOf(legacy('revision_notes'));

  assert.deepEqual(groups.map((g) => g.topic), ['Models', 'Laws and theories']);
  assert.deepEqual(groups.flatMap((g) => g.items.map((i) => i.id)), ['check:1:0', 'check:2:0', 'check:3:0', 'check:4:0']);
});

test('a checklist statement with no text is left out, and the others keep the key of their position', () => {
  const doc = revision();
  const topic = at(doc, 1, 'topic');
  topic.content.checklist = ['', 'I can say what a model is.'];

  assert.deepEqual(tickItemsOf(topic), [{ key: 'check:1:1', text: 'I can say what a model is.' }]);
});

// ---------------------------------------------------------------------------
// What each part offers online, and how far a learner is through it
// ---------------------------------------------------------------------------

test('a topic offers its mix-ups and its checklist, and its diagram first when it has one', () => {
  const doc = revision();

  assert.deepEqual(featuresAt(doc, 1), ['mistakes', 'checklist']);
  assert.deepEqual(featuresAt(doc, 2), ['checklist'], 'no mix-ups to reveal');

  Object.assign(at(doc, 1, 'topic'), { image: { type: 'diagram' }, interaction: { kind: 'hotspots' } });
  assert.deepEqual(featuresAt(doc, 1), ['diagram', 'mistakes', 'checklist']);
});

test('the glossary offers its cards, and a check offers its questions', () => {
  const doc = revision();

  assert.deepEqual(featuresAt(doc, 3), ['term']);
  assert.deepEqual(featuresAt(doc, 4), ['questions']);
});

test('each part of a purpose remedial class offers what it has', () => {
  const doc = remedial();

  assert.deepEqual(featuresAt(doc, 1), ['questions'], 'diagnostic');
  assert.deepEqual(featuresAt(doc, 2), ['reading'], 'gaps');
  assert.deepEqual(featuresAt(doc, 3), ['steps', 'questions'], 'a unit with no mistakes offers none');
  assert.deepEqual(featuresAt(doc, 5), ['mistakes'], 'clinic');
  assert.deepEqual(featuresAt(doc, 6), ['questions'], 'independent');
  assert.deepEqual(featuresAt(doc, 7), ['questions'], 'exit');
  assert.deepEqual(featuresAt(doc, 8), ['reading'], 'teacher');
});

test('a gaps table with nothing to show offers nothing', () => {
  const doc = remedial();
  const gaps = at(doc, 2, 'gaps');
  gaps.content.rows = [];
  gaps.content.others = [];

  assert.deepEqual(featuresOf(gaps), []);
});

test('a legacy note and unit offer what they always did', () => {
  assert.deepEqual(featuresAt(legacy('revision_notes'), 1), ['term', 'mistakes', 'questions', 'checklist']);
  assert.deepEqual(featuresAt(legacy('remedial'), 2), ['steps', 'worked_example', 'diagram', 'questions']);
  assert.deepEqual(partProgress(partByNumber(legacy('revision_notes'), 1) as BodyPart, new Set()), { done: 0, total: 4 });
});

test('progress through a topic counts its mix-ups and its checklist', () => {
  const doc = revision();
  const topic = at(doc, 1, 'topic');

  assert.deepEqual(partProgress(topic, new Set()), { done: 0, total: 3 });
  assert.deepEqual(partProgress(topic, new Set(['check:1:0', 'mistakes:1'])), { done: 2, total: 3 });
});

test('progress through the glossary counts its cards, and through a clinic its ideas', () => {
  const notes = revision();
  assert.deepEqual(partProgress(at(notes, 3, 'glossary'), new Set(['term:3:1'])), { done: 1, total: 3 });

  const doc = remedial();
  assert.deepEqual(partProgress(at(doc, 5, 'clinic'), new Set(['clinic:5:1'])), { done: 1, total: 2 });
});

test('progress through a question part counts its questions; reading parts have none to count', () => {
  const doc = remedial();

  assert.deepEqual(partProgress(at(doc, 1, 'diagnostic'), new Set(['1:0'])), { done: 1, total: 2 });
  assert.deepEqual(partProgress(at(doc, 3, 'unit'), new Set(['3:0', 'steps:3'])), { done: 2, total: 3 });
  assert.deepEqual(partProgress(at(doc, 2, 'gaps'), new Set()), { done: 0, total: 0 });
  assert.deepEqual(partProgress(at(doc, 8, 'teacher'), new Set()), { done: 0, total: 0 });
});

// ---------------------------------------------------------------------------
// Mix-ups, the clinic, and pointers between parts
// ---------------------------------------------------------------------------

test('a topic\'s mix-ups are cards: the wrong idea on the front, what is true when opened', () => {
  const doc = revision();
  const interaction = topicMixupInteraction(at(doc, 1, 'topic'));

  assert.ok(interaction);
  assert.equal(interaction.kind, 'reveal');
  assert.deepEqual(interaction.items, [{ id: 'm1', label: 'A model is an exact copy.', text: 'A model keeps only what is needed.' }]);
  assert.equal(topicMixupInteraction(at(doc, 2, 'topic')), null);
});

test('the clinic gives one card per idea, with its unit when it has one', () => {
  const cards = clinicCardsOf(at(remedial(), 5, 'clinic'));

  assert.deepEqual(
    cards.map((c) => [c.key, c.wrongIdea, c.unit]),
    [
      ['clinic:5:0', 'A model that leaves things out is wrong.', 3],
      ['clinic:5:1', 'A theory is a guess.', null],
    ]
  );
  assert.equal(cards[0].correction, 'It is done on purpose, to keep the useful parts.');
  assert.equal(cards[0].checkIt, 'Name one thing a map leaves out.');
});

test('an idea in the clinic with no correction is left out, and the others keep the key of their position', () => {
  const clinic = at(remedial(), 5, 'clinic');
  clinic.content.items[0].correction = '';

  assert.deepEqual(clinicCardsOf(clinic).map((c) => c.key), ['clinic:5:1']);
});

test('a pointer leads only to a unit that is in the document', () => {
  const doc = remedial();

  assert.deepEqual(unitPointers(doc, [3, 4]), [
    { part: 3, label: 'Unit 3: Ignoring details' },
    { part: 4, label: 'Unit 4: Theories' },
  ]);
  // The overview, the gaps, the teacher guide and a part that does not exist are not units; a repeat is listed once.
  assert.deepEqual(unitPointers(doc, [0, 2, 8, 99, 3, 3]), [{ part: 3, label: 'Unit 3: Ignoring details' }]);
});

test('a missed diagnostic question points at the units to take', () => {
  const doc = remedial();
  const diagnostic = at(doc, 1, 'diagnostic');

  assert.deepEqual(ifMissedFor(doc, diagnostic, 0), [{ part: 3, label: 'Unit 3: Ignoring details' }]);
  assert.deepEqual(ifMissedFor(doc, diagnostic, 1), [], 'a question with no unit to take');
});

test('a diagnostic question finds its pointers by question, not only by position', () => {
  const doc = remedial();
  const diagnostic = at(doc, 1, 'diagnostic');
  diagnostic.activities.reverse();

  assert.deepEqual(ifMissedFor(doc, diagnostic, 1), [{ part: 3, label: 'Unit 3: Ignoring details' }], 'question 201 is now second');
  assert.deepEqual(ifMissedFor(doc, diagnostic, 0), []);
});

test('the exit check says when a learner is ready, and says nothing it cannot stand behind', () => {
  const exit = at(remedial(), 7, 'exit');

  assert.equal(readinessRule(exit), 'You are ready when you get 1 of 2 right.');
  exit.content.ready_at = 3;
  assert.equal(readinessRule(exit), null, 'more needed than there are questions');
  exit.content.ready_at = 0;
  assert.equal(readinessRule(exit), null);
});

// ---------------------------------------------------------------------------
// Questions, and units of the purpose design
// ---------------------------------------------------------------------------

test('a check sets its questions out topic by topic, in the outline\'s order', () => {
  const doc = revision();

  // The fixture asks the Laws question first; the groups follow the outline, and point at the question's place.
  assert.deepEqual(questionGroups(doc, at(doc, 4, 'check')), [
    { topic: 'Models', indexes: [1] },
    { topic: 'Laws and theories', indexes: [0] },
  ]);
});

test('questions about one topic are not split, and a question that cannot be placed comes last', () => {
  const doc = remedial();
  assert.deepEqual(questionGroups(doc, at(doc, 6, 'independent')), [{ topic: null, indexes: [0] }]);

  const notes = revision();
  const check = at(notes, 4, 'check');
  check.activities[0].concept_id = 999;
  assert.deepEqual(questionGroups(notes, check), [
    { topic: 'Models', indexes: [1] },
    { topic: null, indexes: [0] },
  ]);
});

test('a purpose unit has no mistakes and one or two guided questions, and still plays', () => {
  const doc = remedial();
  const two = at(doc, 3, 'unit');
  const one = at(doc, 4, 'unit');

  assert.equal(mistakesInteraction(two), null);
  assert.ok(stepsInteraction(two));
  assert.deepEqual(guidedOf(two).map((g) => [g.level, g.index]), [[1, 0], [2, 1]]);
  assert.deepEqual(guidedOf(one).map((g) => [g.level, g.index]), [[1, 0]]);
});

// ---------------------------------------------------------------------------
// The three student journeys
// ---------------------------------------------------------------------------

test('a marked answer is remembered as right or not right, and a written one is only done', () => {
  assert.deepEqual(resultActions('1:0', true, true), [
    { type: 'done', key: '1:0' },
    { type: 'done', key: 'ok:1:0' },
    { type: 'undone', key: 'miss:1:0' },
  ]);
  assert.deepEqual(resultActions('1:0', true, false), [
    { type: 'done', key: '1:0' },
    { type: 'undone', key: 'ok:1:0' },
    { type: 'done', key: 'miss:1:0' },
  ]);
  assert.deepEqual(resultActions('1:0', false, false), [{ type: 'done', key: '1:0' }]);
});

test('a diagnostic question answered wrongly recommends the unit the document names, and nothing else does', () => {
  const doc = remedial();
  const diagnostic = at(doc, 1, 'diagnostic');
  const first = activityKey(diagnostic, 0);
  const second = activityKey(diagnostic, 1);

  assert.deepEqual(recommendedUnits(doc, new Set()), [], 'nothing answered');
  assert.deepEqual(recommendedUnits(doc, new Set([first, `ok:${first}`])), [], 'answered right');
  assert.deepEqual(recommendedUnits(doc, new Set([first, `miss:${first}`])), [3]);
  assert.deepEqual(recommendedUnits(doc, new Set([second, `miss:${second}`])), [], 'a missed question with no unit to take');
  assert.deepEqual(diagnosticSummary(doc, new Set([first, `miss:${first}`, second])), { answered: 2, total: diagnostic.activities.length, missed: 1 });
});

test('the exit check judges by its own rule, only when every question is answered and marked', () => {
  const doc = remedial();
  const exit = at(doc, 7, 'exit');
  const keys = exit.activities.map((_, i) => activityKey(exit, i));

  assert.equal(exitVerdict(doc, exit, new Set()).ready, null, 'nothing answered');
  assert.equal(exitVerdict(doc, exit, new Set([keys[0], `ok:${keys[0]}`])).ready, null, 'not every question answered');
  const passed = new Set(keys.flatMap((k, i) => [k, i === 0 ? `ok:${k}` : `miss:${k}`]));
  assert.equal(exitVerdict(doc, exit, passed).ready, true, 'ready_at is 1');
  const failed = new Set(keys.flatMap((k) => [k, `miss:${k}`]));
  const verdict = exitVerdict(doc, exit, failed);
  assert.equal(verdict.ready, false);
  assert.equal(verdict.right, 0);
  const written = new Set(keys);
  assert.equal(exitVerdict(doc, exit, written).ready, null, 'written answers are not marked, so no verdict');
  assert.equal(exitVerdict(doc, exit, written).unmarked, keys.length);
});

test('a unit splits its practice between the hint stage and the independent stage by level', () => {
  const doc = remedial();
  const unit = at(doc, 3, 'unit');
  const guided = guidedOf(unit);
  const hinted = questionKeys(unit, HINT_LEVELS);
  const solo = questionKeys(unit, SOLO_LEVELS);

  assert.deepEqual(hinted, guided.filter((g) => HINT_LEVELS.includes(g.level)).map((g) => g.key));
  assert.equal(new Set([...hinted, ...solo]).size, hinted.length + solo.length, 'no question in both stages');
  assert.equal(hinted.length + solo.length, unit.activities.length, 'every question is in one stage');
});

test('an activity compared side by side asks about each side; any other asks one question', () => {
  const doc = parseDocument(structuredClone(golden.activities));
  const activities = partsOf(doc).filter((p): p is ActivityPart => p.type === 'activity');
  assert.ok(activities.length > 0);
  const compare = structuredClone(activities[0]);
  compare.interaction = { kind: 'compare', reason: '', intro: '', wrapup: '', items: [{ id: 'a', label: 'In water', text: '' }, { id: 'b', label: 'In sugar', text: '' }] };
  assert.deepEqual(slotsOf(compare), [{ id: 'a', label: 'In water' }, { id: 'b', label: 'In sugar' }]);
  compare.interaction = null;
  assert.deepEqual(slotsOf(compare), [{ id: 'all', label: '' }]);
  assert.equal(interactionStepOf({ ...compare, interaction: { kind: 'order', reason: '', intro: '', wrapup: '', items: [] } }), 'perform');
  assert.equal(interactionStepOf({ ...compare, interaction: { kind: 'reveal', reason: '', intro: '', wrapup: '', items: [] } }), 'discuss');
});

test('an activity is done only when predicted, performed, recorded and discussed', () => {
  const doc = parseDocument(structuredClone(golden.activities));
  const part = structuredClone(partsOf(doc).find((p): p is ActivityPart => p.type === 'activity') as ActivityPart);
  part.interaction = null;
  part.content.student_steps = ['one', 'two'];
  const ticks = [performKey(part, 0), performKey(part, 1)];

  assert.equal(activityStatus(part, new Set()).status, 'not_started');
  assert.equal(activityStatus(part, new Set([activityStepKey(part, 'predict')])).status, 'in_progress');
  assert.equal(performDone(part, new Set([ticks[0]])), false, 'one instruction is not enough');
  assert.equal(performDone(part, new Set(ticks)), true);
  const all = new Set([...ticks, activityStepKey(part, 'predict'), activityStepKey(part, 'record'), activityStepKey(part, 'discuss')]);
  assert.deepEqual(activityStatus(part, all), { status: 'done', steps: 4, of: 4 });
});

// ---------------------------------------------------------------------------
// Practice built from the document: blanks, words, true or false, sort
// ---------------------------------------------------------------------------

test('a gap is made only where a term is written once, as a whole word, with words before it', () => {
  const s = (text: string, terms: string[]) => clozeFrom([{ id: 'a', text, terms }]);
  assert.deepEqual(s('Water moves across the membrane from a dilute solution to a concentrated one.', ['membrane'])[0].answer, 'membrane');
  assert.equal(s('Water moves across the membrane and the membrane lets some things through.', ['membrane']).length, 0, 'twice');
  assert.equal(s('Membranes are thin boundaries that surround every living cell in the body.', ['membrane']).length, 0, 'not a whole word');
  assert.equal(s('Osmosis is the diffusion of water across a selectively permeable membrane.', ['osmosis']).length, 0, 'at the very start');
  assert.equal(s('Too short a sentence here.', ['sentence']).length, 0);
  const phrase = s('The cell is selectively permeable so it lets some substances through only.', ['permeable', 'selectively permeable']);
  assert.equal(phrase[0].answer, 'selectively permeable', 'a phrase beats one of its words');
  assert.equal(phrase[0].before + phrase[0].answer + phrase[0].after, 'The cell is selectively permeable so it lets some substances through only.');
});

test('a typed answer is the answer ignoring case and spacing, and a hint shows only first letters', () => {
  assert.equal(sameAnswer('  Selectively  Permeable ', 'selectively permeable'), true);
  assert.equal(sameAnswer('', 'x'), false);
  assert.equal(sameAnswer('nucleus', 'nucleolus'), false);
  assert.equal(firstLetters('cell wall'), 'c\u00b7\u00b7\u00b7 w\u00b7\u00b7\u00b7');
});

test('a comparison table becomes true or false statements and a sort, and a row with equal cells makes neither', () => {
  const doc = revision();
  const topic = partsOf(doc).find((p) => p.type === 'topic');
  assert.ok(topic && topic.type === 'topic');
  topic.content.compare = {
    title: 'Plant and animal',
    columns: ['Feature', 'Plant cell', 'Animal cell'],
    rows: [['Outer layer', 'Same', 'Same'], ['Cell wall', 'Present', 'Absent'], ['Shape', 'Fixed and regular', 'Round and irregular'], ['Vacuole', 'One large', 'Small or none'], ['Plastids', 'Present', 'Absent']],
  };
  const compare = topic.content.compare;
  const plays = playsOf(doc, topic);
  const tf = plays.find((p) => p.kind === 'truefalse');
  const sort = plays.find((p) => p.kind === 'sort');
  assert.ok(tf && tf.kind === 'truefalse' && tf.items.length >= 3, 'statements are made');
  assert.ok(sort && sort.kind === 'sort', 'a sort is made');
  if (tf && tf.kind === 'truefalse') assert.ok(tf.items.every((i) => !i.statement.includes('Same')), 'the equal row is skipped');
  if (sort && sort.kind === 'sort') {
    assert.ok(sort.items.every((i) => !i.text.includes('Same')));
    assert.deepEqual(sort.buckets, compare.columns.slice(1));
    for (const item of sort.items) assert.ok(item.text.endsWith(compare.rows.find((r) => item.text.startsWith(`${r[0]}:`))![item.bucket + 1]), 'each card is the cell of its own column');
  }
});

test('a false statement is always the wrong column\'s cell, never an invented one', () => {
  const doc = revision();
  for (const part of partsOf(doc)) {
    const tf = playsOf(doc, part).find((p) => p.kind === 'truefalse');
    if (!tf || tf.kind !== 'truefalse' || part.type !== 'topic' || !part.content.compare) continue;
    const cells = new Set(part.content.compare.rows.flatMap((r) => r.slice(1)));
    for (const item of tf.items.filter((i) => !i.truth && i.id.startsWith('cmp'))) {
      const cell = item.statement.split(' — ')[1];
      assert.ok(cells.has(cell), `"${cell}" is a cell of the table`);
      assert.ok(item.why.startsWith('No.') && item.why.includes(cell));
    }
  }
});

test('plays are only offered with enough material, and the same shuffle comes back for the same seed', () => {
  const doc = remedial();
  for (const part of partsOf(doc)) for (const p of playsOf(doc, part)) assert.ok(p.items.length >= 2, `${part.title}: ${p.kind}`);
  assert.deepEqual(shuffled([1, 2, 3, 4, 5, 6], 7), shuffled([1, 2, 3, 4, 5, 6], 7));
  assert.deepEqual([...shuffled([1, 2, 3, 4, 5, 6], 7)].sort(), [1, 2, 3, 4, 5, 6]);
});

// ---------------------------------------------------------------------------
// Phase A: key terms, comparisons, concept maps and a presentation's knowledge check
// ---------------------------------------------------------------------------

test('key terms are found as whole words, the longest first, and each place is claimed once', () => {
  const pieces = markTerms('Osmosis is the diffusion of water across a selectively permeable membrane.', ['permeable', 'selectively permeable', 'water', 'osmosis']);
  assert.deepEqual(
    pieces.filter((p) => p.term).map((p) => p.term),
    ['osmosis', 'water', 'selectively permeable'],
  );
  assert.equal(pieces.map((p) => p.text).join(''), 'Osmosis is the diffusion of water across a selectively permeable membrane.', 'the sentence is unchanged');
  assert.equal(markTerms('Membranes are thin.', ['membrane']).some((p) => p.term), false, 'not a whole word');
  assert.deepEqual(markTerms('Nothing here.', ['absent']), [{ text: 'Nothing here.', term: null }]);
});

test('two things compared become statements true of their own thing and false of the other, only when they differ', () => {
  const item = (id: string, label: string, text: string) => ({ id, label, text });
  const compare = (a: string, b: string) => ({ kind: 'compare' as const, reason: '', intro: '', wrapup: '', items: [item('a', 'Plain water', a), item('b', 'Sugar solution', b)] });
  const made = compareItemStatements(compare('Water enters, so the piece swells. It gains weight.', 'Water leaves, so the piece shrinks. It loses weight.'));
  assert.deepEqual(
    made.map((m) => m.truth),
    [true, false, true],
  );
  assert.equal(made[1].statement, 'Plain water: Water leaves, so the piece shrinks.', 'the false one is the other side\'s own first sentence');
  assert.deepEqual(compareItemStatements(compare('Same thing here.', 'Same thing here.')), [], 'equal sentences make no false statement');
  assert.deepEqual(compareItemStatements({ ...compare('One.', 'Two.'), items: [item('a', 'A', 'One sentence here.')] } as never), [], 'only a pair');
  assert.deepEqual(compareItemStatements(null), []);
});

test('a presentation slide offers a knowledge check only from what it says, and true or false needs a statement that is not true', () => {
  const concepts = { '1': { name: 'Osmosis across selectively permeable membrane' } };
  const slide = (over: Record<string, unknown> = {}) => ({
    n: 4,
    interaction: null,
    content: { explanations: [{ text: 'Water moves across a selectively permeable membrane, from a dilute solution to a concentrated one.' }], key_idea: null, relationship_note: null, misconception: null, ...over },
  });
  const plays = slidePlays(concepts, slide({ key_idea: 'Osmosis is the movement of water across a membrane until concentrations are equal.', misconception: { wrong_idea: 'Osmosis moves sugar into the cell', correction: 'Only water moves.' } }));
  assert.deepEqual(
    plays.map((p) => p.kind),
    ['words', 'truefalse'],
  );
  const tf = plays.find((p) => p.kind === 'truefalse');
  assert.ok(tf && tf.kind === 'truefalse' && tf.items.some((i) => !i.truth) && tf.items.some((i) => i.truth));
  assert.deepEqual(slidePlays(concepts, slide()), [], 'one sentence and nothing to judge: no check');
  assert.deepEqual(slidePlays(concepts, slide({ key_idea: 'Osmosis is the movement of water across a membrane until concentrations are equal.' })).map((p) => p.kind), ['words'], 'only true statements make no true or false');
});

test('a concept map links ideas of the topic by what each needs, and is not offered without a link', () => {
  const doc = revision();
  const topic = partsOf(doc).find((p) => p.type === 'topic');
  assert.ok(topic && topic.type === 'topic' && topic.content.rows.length >= 2);
  const [a, b] = topic.content.rows;
  for (const row of topic.content.rows) doc.concepts[String(row.concept_id)] = { ...(doc.concepts[String(row.concept_id)] ?? { id: row.concept_id, name: row.name, topic_id: topic.topic_id, related: [], definition: '' }), requires: [] };
  assert.equal(conceptMapOf(doc, topic), null, 'no link, no map');
  doc.concepts[String(b.concept_id)].requires = [a.concept_id, 999999];
  const map = conceptMapOf(doc, topic);
  assert.ok(map);
  assert.deepEqual(map.edges, [{ from: a.concept_id, to: b.concept_id }], 'an idea outside the topic is not drawn');
  assert.equal(map.nodes.find((n) => n.conceptId === a.concept_id)?.depth, 0);
  assert.equal(map.nodes.find((n) => n.conceptId === b.concept_id)?.depth, 1);
  // A cycle in the data must not hang or throw.
  doc.concepts[String(a.concept_id)].requires = [b.concept_id];
  assert.ok(conceptMapOf(doc, topic));
});
