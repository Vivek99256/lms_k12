/**
 * Pure logic for study documents (revision notes, a remedial class, classroom activities): validate what the API sends,
 * name things for the interface, and say which bank questions a document needs.
 *
 * NO REACT AND NO FETCH HERE, so every rule is testable with node:test.
 *
 * REUSE, NOT A SECOND RUNTIME. A document's parts are written in the study deck's own shapes (see types.ts), so the deck's
 * checks, pictures, interactions and question players serve them unchanged. This module only adds what is new: the three
 * kinds, and a document's own structure.
 */

import { PLAYABLE_TARGETS, activityKey, resolveActivity, type ResolvedActivity } from '../study-deck/deck';
import { interactionProblem } from '../study-deck/interactions';
import { ACTIVITY_LABELS } from '../study-deck/types';
import type { BankQuestion } from '../h5p/question-bank-h5p-map';
import type { Audience } from './api';
import { DOCUMENT_KINDS, STUDY_DOCUMENT_VERSION, type BodyPart, type DocumentKind, type DocumentPart, type StudyDocument } from './types';

export class DocumentError extends Error {}

/** What each kind is called on a tab, a card and a dialog. Sentence case. */
export const KIND_LABEL: Record<DocumentKind, string> = {
  revision_notes: 'Revision notes',
  remedial: 'Remedial class',
  activities: 'Classroom activity',
};

/**
 * The part types a document of each kind may hold after its overview. `note` and `unit` are the legacy design (still in
 * storage); `unit` is also part of the purpose design, which adds the rest.
 */
export const PART_TYPES: Record<DocumentKind, readonly BodyPart['type'][]> = {
  revision_notes: ['note', 'topic', 'glossary', 'check'],
  remedial: ['unit', 'diagnostic', 'gaps', 'clinic', 'independent', 'exit', 'teacher'],
  activities: ['activity'],
};

/** The lists each type of part holds in its `content`. Filled in as empty when missing, so rendering never meets `undefined.map`. */
const LIST_FIELDS: Record<BodyPart['type'], readonly string[]> = {
  note: ['key_points', 'checklist', 'rules'],
  topic: ['rows', 'mixups', 'recall', 'checklist'],
  glossary: ['terms'],
  check: [],
  unit: ['steps', 'guided', 'mistakes', 'follow_up', 'prerequisites'],
  diagnostic: ['items'],
  gaps: ['rows', 'others'],
  clinic: ['items'],
  independent: [],
  exit: ['criteria', 'revisit'],
  teacher: ['how_to_run', 'pacing', 'interventions'],
  activity: ['teacher_steps', 'student_steps', 'discussion', 'reflection', 'materials'],
};

/** Lists inside the entries of those lists (`[list, nested list]`), filled in the same way. */
const NESTED_LIST_FIELDS: Partial<Record<BodyPart['type'], ReadonlyArray<readonly [string, string]>>> = {
  topic: [['rows', 'terms']],
  diagnostic: [['items', 'if_missed']],
  gaps: [
    ['rows', 'reasons'],
    ['rows', 'check_first'],
  ],
};

/** What a numbered part is called ("Note 3", "Topic 2", "Unit 4"). A part that appears once in a document is named instead (below). */
const NUMBERED_NAME: Partial<Record<BodyPart['type'], string>> = {
  note: 'Note',
  topic: 'Topic',
  unit: 'Unit',
  activity: 'Activity',
};

/** What a part that appears once in a document is called, on a tab and as its heading. Sentence case. */
const SINGLE_NAME: Partial<Record<BodyPart['type'], string>> = {
  glossary: 'Key terms',
  check: 'Test yourself',
  diagnostic: 'Where to start',
  gaps: 'Where it may be hard',
  clinic: 'Common mix-ups',
  independent: 'On your own',
  exit: 'Exit check',
  teacher: 'Teacher guide',
};

export function isDocumentKind(value: unknown): value is DocumentKind {
  return typeof value === 'string' && (DOCUMENT_KINDS as readonly string[]).includes(value);
}

/**
 * The kind a content row is, as the API says it (`study_doc_kind`), or null for anything else.
 *
 * Deliberately NOT guessed from the category or the file name here: the server decides what is a study document (it checks
 * that the name and the category agree), and a row it did not mark is an ordinary file that opens as it always did.
 */
export function documentKindOf(row: { study_doc_kind?: unknown } | null | undefined): DocumentKind | null {
  const kind = row?.study_doc_kind;

  return isDocumentKind(kind) ? kind : null;
}

/**
 * Check that a JSON payload really is a version 1 study document, with a reason when it is not.
 *
 * Strict about what the interface cannot draw without (the kind, the parts and their numbering, interactions and activities
 * the shared players must run) and silent about extra fields, so the backend can add metadata without breaking readers.
 * Missing optional parts are filled in (`interaction`, `image`, `activities`), as the deck's parser does.
 */
export function parseDocument(raw: unknown): StudyDocument {
  const doc = raw as Partial<StudyDocument> | null;

  if (!doc || typeof doc !== 'object') throw new DocumentError('The document is empty.');
  if (doc.version !== STUDY_DOCUMENT_VERSION) {
    throw new DocumentError(`This document is version ${String(doc.version)}; this app reads version ${STUDY_DOCUMENT_VERSION}.`);
  }
  if (!isDocumentKind(doc.kind)) throw new DocumentError(`This document is of a kind this app does not know ("${String(doc.kind)}").`);
  if (!doc.chapter || typeof doc.chapter.id !== 'number') throw new DocumentError('The document does not say which chapter it is for.');
  if (!doc.concepts || typeof doc.concepts !== 'object') throw new DocumentError('The document has no concept list.');
  if (!Array.isArray(doc.outline)) throw new DocumentError('The document has no outline.');
  if (!Array.isArray(doc.sections) || doc.sections.length < 2) throw new DocumentError('The document has no parts.');

  const parts = doc.sections as unknown as DocumentPart[];
  const kind = doc.kind;
  const allowed: readonly string[] = PART_TYPES[kind];

  parts.forEach((part, index) => {
    if (!part || typeof part !== 'object' || part.n !== index || typeof part.title !== 'string' || !part.content || typeof part.content !== 'object') {
      throw new DocumentError(`Part ${index} is malformed.`);
    }
    if (index === 0 ? part.type !== 'overview' : !allowed.includes(part.type)) {
      throw new DocumentError(`Part ${index} is a "${String(part.type)}"; a ${kind} document has ${index === 0 ? 'an overview first' : `only ${allowed.join(', ')} parts after it`}.`);
    }
    part.image ??= null;
    part.interaction ??= null;
    part.activities ??= [];
    part.question_ids ??= [];
    part.concept_ids ??= [];
    part.taught_concept_ids ??= [];
    if (!Array.isArray(part.activities)) throw new DocumentError(`Part ${index} is malformed.`);

    if (part.interaction) {
      const problem = interactionProblem(part.interaction, part.image?.type === 'diagram');
      if (problem) throw new DocumentError(`Part ${index}'s interaction ${problem}.`);
    }
    part.activities.forEach((activity) => {
      if (!(PLAYABLE_TARGETS as readonly string[]).includes(activity.as)) {
        throw new DocumentError(`Part ${index} asks for "${String(activity.as)}", which no player here can render.`);
      }
      if (!(ACTIVITY_LABELS as readonly string[]).includes(activity.label)) {
        throw new DocumentError(`Part ${index} has an activity labelled "${String(activity.label)}".`);
      }
    });

    if (part.type === 'overview') return;
    const c = part.content as unknown as Record<string, unknown>;
    for (const key of LIST_FIELDS[part.type]) {
      c[key] ??= [];
      if (!Array.isArray(c[key])) throw new DocumentError(`Part ${index} has a "${key}" that is not a list.`);
    }
    for (const [list, nested] of NESTED_LIST_FIELDS[part.type] ?? []) {
      for (const entry of c[list] as unknown[]) {
        const item = entry as Record<string, unknown> | null;
        if (!item || typeof item !== 'object') throw new DocumentError(`Part ${index} has a "${list}" entry that is malformed.`);
        item[nested] ??= [];
        if (!Array.isArray(item[nested])) throw new DocumentError(`Part ${index} has a "${nested}" that is not a list.`);
      }
    }
    if (part.type === 'topic') {
      // A comparison table the interface cannot lay out is left out; it never stops the topic from opening.
      const compare = c.compare as { columns?: unknown; rows?: unknown } | null | undefined;
      c.compare = compare && Array.isArray(compare.columns) && Array.isArray(compare.rows) ? compare : null;
    }
  });

  doc.taught_by ??= {};
  doc.concept_questions ??= {};

  return doc as StudyDocument;
}

/** The parts after the overview. */
export function partsOf(doc: StudyDocument): BodyPart[] {
  return (doc.sections as DocumentPart[]).slice(1) as BodyPart[];
}

/**
 * The parts a reader is shown. The teacher guide of a remedial class is for the teacher: anyone who is not a teacher is
 * treated as a student, so a wrong or missing audience hides it rather than shows it.
 *
 * Like `defaultVariant` this shapes what is offered; it does not restrict what the server sends (see api.ts).
 */
export function partsFor(doc: StudyDocument, audience: Audience): BodyPart[] {
  const parts = partsOf(doc);

  return audience === 'teacher' ? parts : parts.filter((part) => part.type !== 'teacher');
}

/** The part with this number, or null when the document has none (a pointer to a part that is not there). */
export function partByNumber(doc: StudyDocument, n: number): BodyPart | null {
  return partsOf(doc).find((part) => part.n === n) ?? null;
}

/** The bank question ids a document needs, so the interface can ask for exactly those. */
export function neededQuestionIds(doc: StudyDocument): number[] {
  const ids = new Set<number>();
  for (const part of doc.sections as DocumentPart[]) {
    for (const activity of part.activities) {
      if (activity.source === 'bank' && activity.question_id !== null) ids.add(activity.question_id);
    }
  }

  return Array.from(ids);
}

/** One part's questions, each decided against the question row as it is now. */
export function resolvePart(part: DocumentPart, bank: ReadonlyMap<number, BankQuestion>): Array<{ key: string; resolved: ResolvedActivity }> {
  return part.activities.map((activity, index) => ({ key: activityKey(part, index), resolved: resolveActivity(activity, bank) }));
}

/** The topic a part sits under, or null. */
export function topicNameOf(doc: StudyDocument, part: DocumentPart): string | null {
  const topic = doc.outline.find((t) => t.topic_id === part.topic_id);

  return topic ? topic.name : null;
}

/** What a numbered part is called without its number ("Unit"), or null for a part that appears once and is named instead. */
export function partName(type: DocumentPart['type']): string | null {
  return (NUMBERED_NAME as Record<string, string | undefined>)[type] ?? null;
}

/** The small label above a part's heading: "Unit 3" for a numbered part, otherwise the kind of document. */
export function partTag(doc: StudyDocument, part: DocumentPart): string {
  const name = partName(part.type);

  return name ? `${name} ${part.n}` : KIND_LABEL[doc.kind];
}

/** A part's heading: its own title, except for a part that appears once, which always has the same name. */
export function partHeading(part: DocumentPart): string {
  return (SINGLE_NAME as Record<string, string | undefined>)[part.type] ?? part.title;
}

/** "Note 3: Ignoring details", "Topic 2: Models", "Unit 4: Ratios", "Test yourself". */
export function partLabel(doc: StudyDocument, part: DocumentPart): string {
  if (part.n === 0) return 'Overview';
  const name = partName(part.type);

  return name ? `${name} ${part.n}: ${part.title}` : partHeading(part);
}

/** The part that teaches a concept first, or null. Used by "If that was hard" and the checklist. */
export function partForConcept(doc: StudyDocument, conceptId: number): number | null {
  const taught = doc.taught_by[String(conceptId)] ?? [];

  return taught.length > 0 ? Math.min(...taught) : null;
}
