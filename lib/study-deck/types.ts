/**
 * The study deck as the backend writes it (next_lms_erp StudyDeck\SlideHtmlRenderer, deck v2).
 *
 * WHAT IS AND IS NOT IN IT. The deck carries the lesson - slide wording, concept maps,
 * images - and, for every question, an ACTIVITY SPEC: which bank question and which H5P
 * target to ask it as. It does NOT carry the questions. The player reads those rows from
 * the existing question bank and hands them to the existing native players, so a question
 * corrected in the bank is corrected in every deck, and no H5P row is ever created.
 *
 * The one exception is an AUTHORED check: a slide the bank had nothing for gets one short
 * question written for it, carried here as a bank-shaped row with a negative id. It is
 * played by the same player and is never stored.
 */

import type { BankQuestion, H5pTargetKind } from '../h5p/question-bank-h5p-map';

export const STUDY_DECK_VERSION = 2;

/** The five labels an activity may carry. */
export const ACTIVITY_LABELS = ['Try it', 'Apply', 'Explain', 'Check', 'Think about it'] as const;
export type ActivityLabel = (typeof ACTIVITY_LABELS)[number];

export interface AuthoredQuestion extends BankQuestion {
  chapter_id: number | null;
  standard_id: number | null;
  subject_id: number | null;
  concept_id: number | null;
  authored: true;
}

export interface DeckActivity {
  source: 'bank' | 'authored';
  /** Null for an authored check. */
  question_id: number | null;
  concept_id: number | null;
  /** The H5P target to ask it as. The runtime re-checks this and falls back to `default_as`. */
  as: H5pTargetKind;
  default_as: H5pTargetKind;
  /** The instructional pattern that actually shaped this activity, or null. */
  pattern: string | null;
  /** True for a branching-pattern decision question. */
  decision: boolean;
  /** Set when the question belongs to another concept the slide connects to this one. */
  connects_concept: number | null;
  label: ActivityLabel;
  bloom: string | null;
  difficulty: string | null;
  dok: number | null;
  why: string;
  /** Present only when `source` is 'authored'. */
  question?: AuthoredQuestion;
}

export interface DeckImage {
  type: 'photo' | 'diagram';
  url: string;
  alt: string;
  caption: string | null;
  width: number;
  height: number;
  /** A drawn diagram has no licence, source or creator because nothing was found. */
  licence: string | null;
  source_url: string | null;
  creator: string | null;
  attribution: string;
  attribution_required: boolean;
  title?: string | null;
}

export interface DeckExplanation {
  concept_id: number;
  text: string;
}

export interface DeckSlideContent {
  body: string;
  explanations: DeckExplanation[];
  bullets: string[];
  example: string | null;
  misconception: { wrong_idea: string; correction: string } | null;
  relationship_note: string | null;
  bloom: string;
  dok: number;
  minutes: number;
}

export interface DeckSlide {
  n: number;
  section: string | null;
  slide_type: string;
  title: string;
  concept_ids: number[];
  taught_concept_ids: number[];
  concepts: string[];
  relationship: { from: number; to: number; kind: string; idea: string } | null;
  content: DeckSlideContent;
  question_ids: number[];
  activities: DeckActivity[];
  h5p_pattern: { type: string; reason: string } | null;
  image: DeckImage | null;
  image_missing: string | null;
}

export interface DeckConcept {
  id: number;
  name: string;
  topic_id: number | null;
  requires: number[];
  related: Array<{ concept_id: number; type: string }>;
  definition: string | null;
}

export interface StudyDeck {
  version: number;
  chapter: { id: number; name: string; standard_id: number; subject_id: number; standard_name: string; subject_name: string };
  slide_count: number;
  teaching_strategy: string | null;
  outline: Array<{ topic_id: number; name: string; concept_ids: number[] }>;
  concepts: Record<string, DeckConcept>;
  slides: DeckSlide[];
  concept_slides: Record<string, number[]>;
  taught_by: Record<string, number[]>;
  concept_questions: Record<string, number[]>;
}
