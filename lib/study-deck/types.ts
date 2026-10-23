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

/**
 * A picture kept in the database (`study_deck_images`). The deck refers to it by this record, never by a path.
 *
 * A deck stored before pictures moved to the database lists object-store files instead (`sha1`, `path`, `url`,
 * `filename`); those fields are optional here and the player does not read this map either way.
 */
export interface DeckAsset {
  image_id?: number;
  /** The picture's stable reference, `study-deck-image:<id>`. */
  ref?: string;
  sha256?: string;
  mime: string;
  format?: string;
  bytes: number;
  width?: number;
  height?: number;
  sha1?: string;
  path?: string;
  url?: string;
  filename?: string;
}

export interface DeckImage {
  type: 'photo' | 'diagram';
  /**
   * `study-deck-image:<id>` as stored. The API (and `resolveDeckImages` for a deck held locally) replace it with an
   * address the browser can load before the player sees it. An older stored deck has an absolute address already.
   */
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
  /** What a story scene's picture is for: the scene itself, a close-up, the evidence, a comparison, or a drawn diagram. */
  role?: 'scene' | 'close_up' | 'evidence' | 'compare' | 'diagram';
  /**
   * The part of a story scene's picture the student should look at, as percentages of the picture's width and height (x and y are the
   * top-left corner). Drawn as a highlight over it; ignored when it is not a rectangle inside the picture.
   */
  focus?: { x: number; y: number; w: number; h: number } | null;
  /** A short name for the highlighted part (at most three words), drawn as a tag beside it. */
  focus_label?: string | null;
  /** Set on a picture of the scientific process: which step (observation, investigation, evidence or conclusion) is in focus. */
  step?: 'observation' | 'investigation' | 'evidence' | 'conclusion';
  /**
   * False when the picture should never be used as a soft background behind another slide (a grey electron micrograph or a
   * photograph of equipment makes a dull or busy texture). Absent means it may be.
   */
  backdrop?: boolean;
  /**
   * Where the picture came from: a web search (`web`), the chapter's own textbook (`textbook`: credited to the book and its page, with no web
   * source), a diagram drawn from the chapter's content (`diagram`), or `none` (no suitable picture). Absent on a deck made before it was recorded.
   */
  source_kind?: 'web' | 'textbook' | 'diagram' | 'none';
  /**
   * True for a stored picture (a photograph or a real labelled diagram) whose parts a person has marked: it may carry hotspots
   * like a drawn diagram does. The marks sit where the person put them, so the picture is reviewed before it is stored.
   */
  annotated?: boolean;
  /**
   * A story scene's picture with two to four parts a learner can open (each part is explained and tied to the scene). Same shape as the parts of a
   * hotspots slide; each part is found on the picture itself by the picture check, never drawn from a guess. Absent when the picture has none.
   */
  hotspots?: HotspotSpot[] | null;
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
  /** Where the numbered pin sits (share of the picture), chosen beside the structure so it does not cover it. */
  pin?: { x: number; y: number };
  /** A picture of this part by its name (for instance a labelled lipid bilayer), shown beside its name and in its explanation. */
  image?: DeckImage | null;
}

export interface HotspotsInteraction {
  kind: 'hotspots';
  /** A live model shown with the picture, driven by the same selected part (four parts: see components/study-deck/OsmosisLab.tsx). */
  lab?: 'osmosis';
  reason: string;
  intro: string;
  spots: HotspotSpot[];
  wrapup: string;
}

/** The template a story act is made with; the player draws exactly these as story scenes (components/study-deck/StoryView.tsx). */
export const STORY_TEMPLATE = 'story_branching_scenario';

/** What a story node is: a narrated scene (one way on), a decision (two or more choices) or an ending (none). */
export type StoryNodeKind = 'scene' | 'decision' | 'ending';

export interface ScenarioChoice {
  id: string;
  text: string;
  /** What happens as a result (in a story: the story event that follows this choice). */
  outcome: string;
  /** Why it happens: the explanation the learner reads (in a story: the scientific explanation for this path). */
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
  /** Story nodes only (all optional, so a deck stored before stories is unchanged). */
  kind?: StoryNodeKind;
  title?: string;
  /** The scene's narration, or an ending's text. */
  body?: string;
  /** This scene's own picture: the main one, drawn large. */
  image?: DeckImage | null;
  /** Up to two supporting pictures beside the main one (a photograph with a drawn diagram, a close-up, a comparison). */
  extra_images?: DeckImage[];
  /** A plain-language explanation of the concept this scene teaches, told through what has just happened (title and body). */
  explain?: { title: string; body: string };
  /**
   * Only on a scene or ending where branches meet: a short lead-in for each way in (`after` is the node the learner came from), so what
   * happened on their own path shows in the scene that follows.
   */
  variants?: Array<{ after: string; body: string }>;
  /** The concepts this scene teaches (the server checks that every path teaches all of the act's). */
  concept_ids?: number[];
}

/** A lightweight branching scenario. Links only go forward, so every path ends. */
export interface ScenarioInteraction {
  kind: 'scenario';
  /** Set to STORY_TEMPLATE for a story act: nodes are scenes, decisions and endings. */
  template?: typeof STORY_TEMPLATE;
  /** A story act's mission: what the learner is trying to do. */
  mission?: { title: string; body: string };
  reason: string;
  situation: string;
  start: string;
  nodes: ScenarioNode[];
  conclusion: string;
}

/** One thing in a list that is opened one at a time. `when` is the date of a timeline event. */
/**
 * A structure marked on a picture: a path in percent of the picture's width and height (0,0 is the top left corner), so it
 * stays on the structure however large the picture is drawn. `line` is an open path (a wall, a membrane seen edge-on);
 * `area` is a closed outline (the edge of a cell or its contents). `tone` picks one of two highlight colours so two
 * structures shown together never look alike.
 */
export interface ImageMark {
  shape: 'line' | 'area';
  points: Array<[number, number]>;
  tone: 'primary' | 'secondary';
  /** Spoken to screen readers; the visible name is the card's own label. */
  label?: string;
}

/** A small drawing shown beside the picture when the picture holds no example of the card's subject. */
export interface MarkInset {
  caption: string;
  /** Marks in the inset's own square (percent of its width and height). */
  marks: ImageMark[];
}

export interface ExploreItem {
  id: string;
  label: string;
  text: string;
  when?: string;
  /** A picture of this item alone (a compare card can show its own). */
  image?: DeckImage | null;
  /** The structures of the slide's picture this card is about, highlighted while the card is open. */
  marks?: ImageMark[];
  /** Shown when the slide's picture has no example of this card's subject (for instance, no animal cell in a plant photograph). */
  inset?: MarkInset;
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
  chapter: { id: number; name: string; /** The chapter's place in its subject ("Chapter 2"), when the school's list numbers it. */ number?: number; standard_id: number; subject_id: number; standard_name: string; subject_name: string };
  slide_count: number;
  teaching_strategy: string | null;
  outline: Array<{ topic_id: number; name: string; concept_ids: number[] }>;
  concepts: Record<string, DeckConcept>;
  slides: DeckSlide[];
  concept_slides: Record<string, number[]>;
  taught_by: Record<string, number[]>;
  concept_questions: Record<string, number[]>;
}
