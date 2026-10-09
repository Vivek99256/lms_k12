/**
 * A STUDY DOCUMENT as the backend writes it (next_lms_erp StudyDeck\Documents, document v1): revision notes, a remedial
 * class or classroom activities, for one chapter.
 *
 * It is the same family as the study deck. A document is a list of numbered PARTS (`sections`) built from the chapter's own
 * concepts, and each part uses the deck slide's keys (`n`, `title`, `concept_ids`, `taught_concept_ids`, `image`,
 * `interaction`, `activities`, `question_ids`), so the deck's own pictures, interactions and question players run a
 * document's parts unchanged. Part 0 is always the overview; a part's number is its position.
 *
 * WHAT IS NOT HERE. No question text (a part names bank questions by id and the player reads the row from the question
 * bank, as the deck does), no H5P row, and no picture bytes (a picture is a `study-deck-image:<id>` reference the API
 * has already turned into an address).
 *
 * The PDF is the document's primary file. Everything a PDF cannot do (select a diagram part, flip a card, get a question
 * marked, tick an item off) is done in the "Try it online" tab, from this same structure.
 */

import type { DeckActivity, DeckConcept, DeckImage, DeckInteraction } from '../study-deck/types';

export const STUDY_DOCUMENT_VERSION = 1;

export type DocumentKind = 'revision_notes' | 'remedial' | 'activities';

export const DOCUMENT_KINDS: readonly DocumentKind[] = ['revision_notes', 'remedial', 'activities'];

export interface DocumentChapter {
  id: number;
  name: string;
  standard_id: number;
  subject_id: number;
  standard_name: string;
  subject_name: string;
}

export interface DocumentOutlineTopic {
  topic_id: number;
  name: string;
  concept_ids: number[];
}

/** The parts every kind of part carries. `content` is what differs. */
interface PartBase<Type extends string, Content> {
  n: number;
  type: Type;
  block: string;
  title: string;
  topic_id: number | null;
  concept_ids: number[];
  taught_concept_ids: number[];
  content: Content;
  /** A drawn diagram of the part, or null. */
  image: DeckImage | null;
  /** What the learner explores on this part (diagram hotspots, a matching or ordering exercise, cards), or null. */
  interaction: DeckInteraction | null;
  /** The bank questions of this part, in the order they are asked. */
  question_ids: number[];
  activities: DeckActivity[];
}

// ---------------------------------------------------------------------------
// Overviews (part 0)
// ---------------------------------------------------------------------------

export interface RevisionOverview {
  summary: string;
  topics: Array<{ topic_id: number; name: string; gist: string }>;
}

export interface RemedialOverview {
  method: Array<{ label: string; text: string }>;
  focus: Array<{ concept_id: number; name: string; difficulty: string | null }>;
}

export interface ActivitiesOverview {
  run_sheet: Array<{ n: number; title: string; format: string; grouping: string; minutes: number; concept_ids: number[] }>;
  total_minutes: number;
}

// ---------------------------------------------------------------------------
// Parts
// ---------------------------------------------------------------------------

export interface RevisionNoteContent {
  summary: string;
  key_points: string[];
  definition: { term: string; text: string } | null;
  rules: Array<{ label: string; statement: string }>;
  example: string | null;
  misconception: { wrong_idea: string; correction: string } | null;
  remember: string | null;
  checklist: string[];
  bloom: string;
  dok: number;
  minutes: number;
}

export interface RemedialStep {
  id: string;
  label: string;
  text: string;
}

export interface RemedialUnitContent {
  prerequisites: Array<{ concept_id: number; name: string; refresher: string }>;
  simple_explanation: string;
  steps: RemedialStep[];
  real_life: string | null;
  worked_example: { problem: string; steps: Array<{ text: string; why: string }>; answer: string } | null;
  mistakes: Array<{ wrong_idea: string; why_wrong: string; correct_idea: string }>;
  /** Practice of rising difficulty: level 1 (with a hint) to level 3 (on your own). */
  guided: Array<{ level: number; label: string; question_id: number; hint: string; not_options: Record<string, string> }>;
  follow_up: Array<{ concept_id: number; name: string; section: number; why: string }>;
  win: string;
  bloom: string;
  dok: number;
  minutes: number;
}

export interface ActivityContent {
  format: string;
  grouping: string;
  minutes: number;
  focus: string;
  objectives: Array<{ concept_id: number; text: string }>;
  materials: string[];
  setup: string | null;
  teacher_steps: Array<{ minutes: number; text: string }>;
  student_steps: string[];
  expected_outcomes: string[];
  discussion: Array<{ prompt: string; answer: string }>;
  misconception: { wrong_idea: string; correction: string } | null;
  assessment: Array<{ criterion: string; evidence: string }>;
  differentiation: { support: string; extension: string } | null;
  reflection: string[];
  bloom: string;
  dok: number;
}

export type RevisionOverviewPart = PartBase<'overview', RevisionOverview>;
export type RemedialOverviewPart = PartBase<'overview', RemedialOverview>;
export type ActivitiesOverviewPart = PartBase<'overview', ActivitiesOverview>;
export type RevisionNotePart = PartBase<'note', RevisionNoteContent>;
export type RemedialUnitPart = PartBase<'unit', RemedialUnitContent>;
export type ActivityPart = PartBase<'activity', ActivityContent>;

interface DocumentBase<K extends DocumentKind, Overview, Part> {
  version: number;
  kind: K;
  /** The content library category it is filed under ("Revision Notes", "Remedial Class", "Classroom Activity"). */
  category: string;
  chapter: DocumentChapter;
  chapter_id: number;
  title: string;
  lede: string;
  scope: { all: boolean; concept_ids: number[] };
  section_count: number;
  outline: DocumentOutlineTopic[];
  concepts: Record<string, DeckConcept>;
  /** Part 0 (the overview) first, then the parts in teaching order. */
  sections: [Overview, ...Part[]];
  /** Concept id -> the numbers of the parts that teach it. */
  taught_by: Record<string, number[]>;
  /** Concept id -> the bank questions asked about it. */
  concept_questions: Record<string, number[]>;
  stats: Record<string, number>;
}

export type RevisionNotesDocument = DocumentBase<'revision_notes', RevisionOverviewPart, RevisionNotePart>;
export type RemedialDocument = DocumentBase<'remedial', RemedialOverviewPart, RemedialUnitPart>;
export type ActivitiesDocument = DocumentBase<'activities', ActivitiesOverviewPart, ActivityPart>;

export type StudyDocument = RevisionNotesDocument | RemedialDocument | ActivitiesDocument;

/** Any one part, of any kind. */
export type DocumentPart = RevisionOverviewPart | RemedialOverviewPart | ActivitiesOverviewPart | RevisionNotePart | RemedialUnitPart | ActivityPart;
