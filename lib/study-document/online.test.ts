import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { purposeRemedialDocument, purposeRevisionDocument } from './fixtures/purpose-documents';
import { parseDocument, partByNumber } from './document';
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
import type { BodyPart, DocumentKind, StudyDocument } from './types';

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
