/**
 * The study deck as the backend writes it (next_lms_erp StudyDeck\SlideHtmlRenderer, deck v3).
 *
 * WHAT IS IN IT. The deck is a CLASSROOM LESSON: slide wording, concept maps, large pictures
 * and diagrams, a discussion prompt per slide, and - where a concept earned one - an
 * INTERACTION written into the slide itself: hotspots laid over a drawn diagram, a short
 * branching scenario, or click-to-reveal cards. Those are plain data; the player draws them.
 *
 * PRACTICE IS OPTIONAL. A handful of slides also name an existing question-bank question and
 * which H5P target to ask it as (an ACTIVITY SPEC). The deck never carries the question: the
 * player reads the row from the question bank and hands it to the existing native players, so
 * a question corrected in the bank is corrected in every deck, and no H5P row is ever created.
 *
 * (Version 2 decks also carried an AUTHORED check, a bank-shaped question with a negative id.
 * Version 3 writes a discussion prompt instead; the type stays so the runtime can still play one.)
 */

import type { BankQuestion, H5pTargetKind } from '../h5p/question-bank-h5p-map';

export const STUDY_DECK_VERSION = 3;

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

/** A picture kept in the shared object store. The deck refers to it by this record, never by a local path. */
export interface DeckAsset {
  sha1: string;
  /** The object's key in the store. */
  path: string;
  /** The canonical public URL. */
  url: string;
  mime: string;
  filename: string;
  bytes: number;
}

export interface DeckImage {
  type: 'photo' | 'diagram';
  url: string;
  /** Key into the deck's `assets` map, present once the deck has been stored. */
  asset_id?: string;
  alt: string;
  caption: string | null;
  width: number;
  height: number;
  /** The labels drawn on a diagram, in reading order. */
  texts?: string[];
  /** A drawn diagram has no licence, source or creator because nothing was found. */
  licence: string | null;
  source_url: string | null;
  creator: string | null;
  attribution: string;
  attribution_required: boolean;
  title?: string | null;
}

/** A prompt for the class to talk about, with a possible answer for the teacher. Never marked. */
export interface DeckDiscussion {
  prompt: string;
  answer: string;
}

/** Hotspots over a drawn diagram. x, y, w, h are shares of the picture (0-100); (x, y) is the box centre. */
export interface HotspotSpot {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
}

export interface HotspotsInteraction {
  kind: 'hotspots';
  reason: string;
  intro: string;
  spots: HotspotSpot[];
  wrapup: string;
}

export interface ScenarioChoice {
  id: string;
  text: string;
  /** What happens as a result. */
  outcome: string;
  /** Why it happens: the explanation the learner reads. */
  why: string;
  /** Whether this is the sound choice. Shown as a reading of the situation, never a mark. */
  sound: boolean;
  /** The next decision, or null when the path ends here. */
  next: string | null;
}

export interface ScenarioNode {
  id: string;
  prompt: string;
  choices: ScenarioChoice[];
}

/** A lightweight branching scenario. Links only go forward, so every path ends. */
export interface ScenarioInteraction {
  kind: 'scenario';
  reason: string;
  situation: string;
  start: string;
  nodes: ScenarioNode[];
  conclusion: string;
}

/** One thing in a list that is opened one at a time. `when` is the date of a timeline event. */
export interface ExploreItem {
  id: string;
  label: string;
  text: string;
  when?: string;
}

/**
 * A list of items, each explained when opened. The kind says how the list is drawn:
 * reveal = cards, steps = a process opened step by step, timeline = dated events, compare = things side by side
 * (and `wrapup` then says how they compare).
 */
export interface ItemsInteraction {
  kind: 'reveal' | 'steps' | 'timeline' | 'compare';
  reason: string;
  intro: string;
  items: ExploreItem[];
  wrapup: string;
}

export interface MatchPair {
  id: string;
  term: string;
  meaning: string;
}

/** Pair each term with its meaning. */
export interface MatchInteraction {
  kind: 'match';
  reason: string;
  intro: string;
  pairs: MatchPair[];
  wrapup: string;
}

/** Put a real sequence in order. `items` are listed in the CORRECT order; the player shuffles them. */
export interface OrderInteraction {
  kind: 'order';
  reason: string;
  intro: string;
  items: Array<{ id: string; text: string }>;
  wrapup: string;
}

export type DeckInteraction = HotspotsInteraction | ScenarioInteraction | ItemsInteraction | MatchInteraction | OrderInteraction;

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
  /** The one sentence to remember from this slide; shown when its example screen has been explored. */
  key_idea?: string | null;
  /** A prompt for the class, shown with a "show a possible answer" reveal. Null where a practice question stands in. */
  discussion: DeckDiscussion | null;
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
  /** Optional practice from the question bank: at most one, on a few slides. */
  activities: DeckActivity[];
  /** What the learner explores or decides on this slide, or null where plain teaching is enough. */
  interaction: DeckInteraction | null;
  /** Why this slide has the interaction it has, or why it was left as plain teaching. */
  interaction_reason: string;
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
  /** Every stored picture the deck uses, by sha1. Present once the deck has been stored. */
  assets?: Record<string, DeckAsset>;
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
