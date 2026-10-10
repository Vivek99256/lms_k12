import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { purposeRemedialDocument, purposeRevisionDocument } from './fixtures/purpose-documents';
import { DocumentError, parseDocument, partByNumber, partHeading, partLabel, partName, partTag, partsFor, partsOf } from './document';
import type { Audience } from './api';
import type { DocumentKind } from './types';

/**
 * A study document in storage is one of two designs. The legacy one (`note` / `unit` parts) is still stored, e.g. content
 * 61402, and the golden file is what the backend wrote for it. The purpose design is built from the frozen schema in
 * fixtures/purpose-documents.ts. Both must open.
 */

type RawPart = Record<string, unknown> & { type: string; content: Record<string, unknown> };
type Raw = { sections: RawPart[] };

const golden = JSON.parse(readFileSync(new URL('./fixtures/study-documents-golden.json', import.meta.url), 'utf8')) as Record<DocumentKind, unknown>;
const legacy = (kind: DocumentKind): Raw => structuredClone(golden[kind]) as Raw;
const raw = (doc: object): Raw => doc as unknown as Raw;
const typesOf = (doc: ReturnType<typeof parseDocument>) => partsOf(doc).map((p) => p.type);

test('a purpose revision document opens: a topic for each topic, then the glossary and the check', () => {
  const doc = parseDocument(purposeRevisionDocument());

  assert.equal(doc.kind, 'revision_notes');
  assert.equal(doc.profile, 'purpose');
  assert.deepEqual(typesOf(doc), ['topic', 'topic', 'glossary', 'check']);
});

test('a purpose remedial document opens: diagnostic, gaps, units, clinic, independent, exit, then the teacher guide', () => {
  const doc = parseDocument(purposeRemedialDocument());

  assert.equal(doc.kind, 'remedial');
  assert.deepEqual(typesOf(doc), ['diagnostic', 'gaps', 'unit', 'unit', 'clinic', 'independent', 'exit', 'teacher']);
});

test('a legacy document still opens: notes, units and activities, as the backend wrote them', () => {
  assert.deepEqual(typesOf(parseDocument(legacy('revision_notes'))), ['note', 'note', 'note', 'note']);
  assert.deepEqual(typesOf(parseDocument(legacy('remedial'))), ['unit', 'unit', 'unit', 'unit']);
  assert.deepEqual(typesOf(parseDocument(legacy('activities'))), ['activity', 'activity', 'activity']);
});

test('each kind accepts exactly the part types the schema lists for it, and nothing else', () => {
  const schema: Record<DocumentKind, { make: () => Raw; accepted: string[] }> = {
    revision_notes: { make: () => raw(purposeRevisionDocument()), accepted: ['note', 'topic', 'glossary', 'check'] },
    remedial: { make: () => raw(purposeRemedialDocument()), accepted: ['unit', 'diagnostic', 'gaps', 'clinic', 'independent', 'exit', 'teacher'] },
    activities: { make: () => legacy('activities'), accepted: ['activity'] },
  };
  const everyType = ['note', 'topic', 'glossary', 'check', 'unit', 'diagnostic', 'gaps', 'clinic', 'independent', 'exit', 'teacher', 'activity', 'overview', 'worksheet'];

  for (const [kind, { make, accepted }] of Object.entries(schema)) {
    for (const type of everyType) {
      const doc = make();
      doc.sections[1].type = type;
      if (accepted.includes(type)) {
        assert.doesNotThrow(() => parseDocument(doc), `${kind} should accept a ${type}`);
      } else {
        assert.throws(() => parseDocument(doc), DocumentError, `${kind} should refuse a ${type}`);
      }
    }
  }
});

test('a unit is refused in revision notes, a topic in a remedial class, and an unknown type anywhere', () => {
  const unitInNotes = raw(purposeRevisionDocument());
  unitInNotes.sections[1].type = 'unit';
  assert.throws(() => parseDocument(unitInNotes), /Part 1 is a "unit"; a revision_notes document has only note, topic, glossary, check parts after it/);

  const topicInRemedial = raw(purposeRemedialDocument());
  topicInRemedial.sections[3].type = 'topic';
  assert.throws(() => parseDocument(topicInRemedial), /Part 3 is a "topic"; a remedial document/);

  const unknown = raw(purposeRemedialDocument());
  unknown.sections[2].type = 'worksheet';
  assert.throws(() => parseDocument(unknown), /Part 2 is a "worksheet"/);

  const notFirst = raw(purposeRevisionDocument());
  notFirst.sections[0].type = 'topic';
  assert.throws(() => parseDocument(notFirst), /Part 0 is a "topic"; a revision_notes document has an overview first/);
});

test('optional keys and lists that are missing are filled in, so rendering never meets undefined', () => {
  const lists: Record<string, string[]> = {
    topic: ['rows', 'mixups', 'recall', 'checklist'],
    glossary: ['terms'],
    diagnostic: ['items'],
    gaps: ['rows', 'others'],
    unit: ['steps', 'guided', 'mistakes', 'follow_up', 'prerequisites'],
    clinic: ['items'],
    exit: ['criteria', 'revisit'],
    teacher: ['how_to_run', 'pacing', 'interventions'],
  };

  for (const make of [() => raw(purposeRevisionDocument()), () => raw(purposeRemedialDocument())]) {
    const doc = make();
    for (const part of doc.sections.slice(1)) {
      for (const key of ['image', 'interaction', 'activities', 'question_ids', 'concept_ids', 'taught_concept_ids']) delete part[key];
      for (const key of lists[part.type] ?? []) delete part.content[key];
    }
    delete (doc as Record<string, unknown>).taught_by;
    delete (doc as Record<string, unknown>).concept_questions;

    const parsed = parseDocument(doc);
    for (const part of partsOf(parsed)) {
      assert.equal(part.image, null);
      assert.equal(part.interaction, null);
      for (const key of ['activities', 'question_ids', 'concept_ids', 'taught_concept_ids'] as const) assert.deepEqual(part[key], []);
      const content = part.content as unknown as Record<string, unknown>;
      for (const key of lists[part.type] ?? []) assert.deepEqual(content[key], [], `${part.type}.${key}`);
    }
    assert.deepEqual(parsed.taught_by, {});
    assert.deepEqual(parsed.concept_questions, {});
  }
});

test('lists inside the entries of a list are filled in too', () => {
  const remedial = raw(purposeRemedialDocument());
  for (const item of remedial.sections[1].content.items as Array<Record<string, unknown>>) delete item.if_missed;
  for (const row of remedial.sections[2].content.rows as Array<Record<string, unknown>>) {
    delete row.reasons;
    delete row.check_first;
  }
  const parsedRemedial = parseDocument(remedial);
  const [diagnostic, gaps] = partsOf(parsedRemedial);
  assert.ok(diagnostic.type === 'diagnostic' && gaps.type === 'gaps');
  assert.deepEqual(diagnostic.content.items.map((i) => i.if_missed), [[], []]);
  assert.deepEqual(gaps.content.rows.map((r) => [r.reasons, r.check_first]), [[[], []], [[], []]]);

  const notes = raw(purposeRevisionDocument());
  for (const row of notes.sections[1].content.rows as Array<Record<string, unknown>>) delete row.terms;
  const [topic] = partsOf(parseDocument(notes));
  assert.ok(topic.type === 'topic');
  assert.deepEqual(topic.content.rows.map((r) => r.terms), [[], []]);
});

test('a list that is not a list, or a comparison table that cannot be laid out, is handled', () => {
  const broken = raw(purposeRevisionDocument());
  broken.sections[1].content.recall = 'remember this';
  assert.throws(() => parseDocument(broken), /Part 1 has a "recall" that is not a list/);

  const nested = raw(purposeRemedialDocument());
  (nested.sections[2].content.rows as Array<Record<string, unknown>>)[0].reasons = 'because';
  assert.throws(() => parseDocument(nested), /Part 2 has a "reasons" that is not a list/);

  // The comparison table is decoration: one that has no columns is left out, and the topic still opens.
  const compare = raw(purposeRevisionDocument());
  compare.sections[1].content.compare = { title: 'Model and real system' };
  const [topic] = partsOf(parseDocument(compare));
  assert.ok(topic.type === 'topic');
  assert.equal(topic.content.compare, null);

  const [kept] = partsOf(parseDocument(purposeRevisionDocument()));
  assert.ok(kept.type === 'topic');
  assert.equal(kept.content.compare?.columns.length, 3);
});

test('each part is named the way a learner reads it', () => {
  const remedial = parseDocument(purposeRemedialDocument());
  const labels = partsOf(remedial).map((p) => partLabel(remedial, p));
  assert.deepEqual(labels, ['Where to start', 'Where it may be hard', 'Unit 3: Ignoring details', 'Unit 4: Theories', 'Common mix-ups', 'On your own', 'Exit check', 'Teacher guide']);

  const revision = parseDocument(purposeRevisionDocument());
  assert.deepEqual(
    partsOf(revision).map((p) => partLabel(revision, p)),
    ['Topic 1: Models', 'Topic 2: Laws and theories', 'Key terms', 'Test yourself']
  );

  const old = parseDocument(legacy('revision_notes'));
  assert.equal(partLabel(old, partsOf(old)[0]), 'Note 1: Models');
  const oldActivities = parseDocument(legacy('activities'));
  assert.match(partLabel(oldActivities, partsOf(oldActivities)[0]), /^Activity 1: /);
  assert.equal(partLabel(revision, revision.sections[0]), 'Overview');
});

test('a numbered part has a name and a number above its heading; a part that appears once has a name and the kind of document', () => {
  const remedial = parseDocument(purposeRemedialDocument());
  const [diagnostic, , unit] = partsOf(remedial);

  assert.equal(partName('unit'), 'Unit');
  assert.equal(partName('topic'), 'Topic');
  assert.equal(partName('exit'), null);
  assert.equal(partTag(remedial, unit), 'Unit 3');
  assert.equal(partTag(remedial, diagnostic), 'Remedial class');
  assert.equal(partHeading(unit), 'Ignoring details');
  assert.equal(partHeading(diagnostic), 'Where to start');
});

test('a student is never given the teacher guide; a teacher is given every part', () => {
  const doc = parseDocument(purposeRemedialDocument());

  assert.equal(partsFor(doc, 'teacher').length, 8);
  assert.deepEqual(
    partsFor(doc, 'teacher').map((p) => p.type).slice(-1),
    ['teacher']
  );

  const forStudent = partsFor(doc, 'student');
  assert.equal(forStudent.length, 7);
  assert.equal(forStudent.some((p) => p.type === 'teacher'), false);
  // The other parts keep their numbers, so a pointer to "Unit 3" still means Unit 3.
  assert.deepEqual(forStudent.map((p) => p.n), [1, 2, 3, 4, 5, 6, 7]);

  // Anything that is not a teacher is treated as a student.
  assert.equal(partsFor(doc, 'parent' as Audience).some((p) => p.type === 'teacher'), false);
  assert.equal(partsFor(doc, undefined as unknown as Audience).some((p) => p.type === 'teacher'), false);

  // A document without a teacher guide is the same for both.
  const notes = parseDocument(purposeRevisionDocument());
  assert.equal(partsFor(notes, 'student').length, partsFor(notes, 'teacher').length);
});

test('a part is found by its number, or not at all', () => {
  const doc = parseDocument(purposeRemedialDocument());

  assert.equal(partByNumber(doc, 3)?.type, 'unit');
  assert.equal(partByNumber(doc, 0), null, 'the overview is not a part');
  assert.equal(partByNumber(doc, 99), null);
});
