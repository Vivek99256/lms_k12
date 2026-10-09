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
import {
  DOCUMENT_KINDS,
  STUDY_DOCUMENT_VERSION,
  type ActivityPart,
  type DocumentKind,
  type DocumentPart,
  type RemedialUnitPart,
  type RevisionNotePart,
  type StudyDocument,
} from './types';

export class DocumentError extends Error {}

/** What each kind is called on a tab, a card and a dialog. Sentence case. */
export const KIND_LABEL: Record<DocumentKind, string> = {
  revision_notes: 'Revision notes',
  remedial: 'Remedial class',
  activities: 'Classroom activity',
};

/** What one numbered part of each kind is called ("Note 3"). */
export const PART_NAME: Record<DocumentKind, string> = {
  revision_notes: 'Note',
  remedial: 'Unit',
  activities: 'Activity',
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
  const expected = { revision_notes: 'note', remedial: 'unit', activities: 'activity' }[doc.kind];

  parts.forEach((part, index) => {
    if (!part || typeof part !== 'object' || part.n !== index || typeof part.title !== 'string' || !part.content || typeof part.content !== 'object') {
      throw new DocumentError(`Part ${index} is malformed.`);
    }
    if (part.type !== (index === 0 ? 'overview' : expected)) {
      throw new DocumentError(`Part ${index} is a "${String(part.type)}"; a ${doc.kind} document has ${index === 0 ? 'an overview first' : `only ${expected}s after it`}.`);
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

    const c = part.content as unknown as Record<string, unknown>;
    const lists = { note: ['key_points', 'checklist', 'rules'], unit: ['steps', 'guided', 'mistakes', 'follow_up', 'prerequisites'], activity: ['teacher_steps', 'student_steps', 'discussion', 'reflection', 'materials'] }[
      part.type as 'note' | 'unit' | 'activity'
    ];
    for (const key of lists ?? []) {
      c[key] ??= [];
      if (!Array.isArray(c[key])) throw new DocumentError(`Part ${index} has a "${key}" that is not a list.`);
    }
  });

  doc.taught_by ??= {};
  doc.concept_questions ??= {};

  return doc as StudyDocument;
}

/** The parts after the overview. */
export function partsOf(doc: StudyDocument): Array<RevisionNotePart | RemedialUnitPart | ActivityPart> {
  return (doc.sections as DocumentPart[]).slice(1) as Array<RevisionNotePart | RemedialUnitPart | ActivityPart>;
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

/** "Note 3: Ignoring details" */
export function partLabel(doc: StudyDocument, part: DocumentPart): string {
  return part.n === 0 ? 'Overview' : `${PART_NAME[doc.kind]} ${part.n}: ${part.title}`;
}

/** The part that teaches a concept first, or null. Used by "If that was hard" and the checklist. */
export function partForConcept(doc: StudyDocument, conceptId: number): number | null {
  const taught = doc.taught_by[String(conceptId)] ?? [];

  return taught.length > 0 ? Math.min(...taught) : null;
}
