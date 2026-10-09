import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  ClipboardCheck,
  Compass,
  Lightbulb,
  ListChecks,
  MessageSquareText,
  NotebookPen,
  Repeat,
  Star,
  Timer,
} from 'lucide-react';

/**
 * The PAL journey, as DATA: which stages exist, what they are called, what a
 * picture of one should depict, and where a learner goes for one.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE EXISTS NOW
 * ---------------------------------------------------------------------------
 * Until the image-based journey map, the stage list lived inside
 * `JourneyRail.tsx` and the map needed to read it from there. Importing a
 * constant back out of the component that renders it would have been a module
 * cycle (JourneyRail → JourneyImageMap → JourneyRail) whose safety depended on
 * nobody touching a value at import time.
 *
 * So the model moved here and `JourneyRail.tsx` re-exports every name it
 * exported before. All 21 existing call sites — and every `import { stagesBefore,
 * COMPLETED_THROUGH_CHECK } from './JourneyRail'` — keep working, unchanged,
 * and the stage order has exactly one home.
 *
 * ---------------------------------------------------------------------------
 * WHY A STAGE CARRIES AN ICON AND A BLURB
 * ---------------------------------------------------------------------------
 * Both exist for the map, and both exist because the images are optional:
 *
 *   - The ICON is what a node looks like when no usable picture was found.
 *     The search is deliberately strict (`pal_content.image.external.min_score`),
 *     so "no image" is an ordinary, recurring outcome rather than an error —
 *     and an ordinary outcome still has to look designed.
 *   - The BLURB is what the node says it is. A picture of a marked worksheet
 *     next to the word "Practice" carries the meaning; a picture alone would
 *     leave a learner guessing, and meaning is never carried by an image alone.
 */

export type JourneyStageKey =
  | 'diagnostic'
  | 'adaptive'
  | 'plan'
  | 'learn'
  | 'practice'
  | 'feedback'
  | 'check'
  | 'intervention'
  | 'mastery'
  | 'recall';

export interface JourneyStage {
  key: JourneyStageKey;
  label: string;
  /**
   * The image the server searches for this stage, described in words rather
   * than chosen by hand. See `pal_content.journey_image.stages` on the server,
   * which is the query-side half of this — kept in the Laravel config because
   * the search terms belong with the search provider's other settings, not
   * duplicated here.
   */
  icon: LucideIcon;
  /** One line saying what the learner does at this step. Rendered under the label. */
  blurb: string;
}

/**
 * Ordered exactly as the product brief specifies the journey. The two entry
 * stages carry their full product names - "Chapter diagnostic" for the
 * fifteen-question chapter paper, "Concept diagnostic" for the per-concept
 * drill that follows - because "Diagnostic" and "Adaptive" on their own gave a
 * learner no way to tell which of the two they were looking at.
 *
 * `practice` sits between Learn and Check because that is the order the engine
 * actually runs (EsoPolicyService::phaseFor(): Learn -> Practice -> Check). It
 * was missing entirely, so the one stage a learner spends the most questions
 * on had no pill of its own and the rail jumped from Learn straight to Check
 * while they were still practising.
 */
export const JOURNEY_STAGES: JourneyStage[] = [
  {
    key: 'diagnostic',
    label: 'Chapter diagnostic',
    icon: ClipboardCheck,
    blurb: 'Fifteen questions across the whole chapter, to find where to start.',
  },
  {
    key: 'adaptive',
    label: 'Concept diagnostic',
    icon: ListChecks,
    blurb: 'A short set on the one concept the chapter paper pointed at.',
  },
  {
    key: 'plan',
    label: 'Plan',
    icon: Compass,
    blurb: 'The order to work through this chapter, built from what you showed.',
  },
  {
    key: 'learn',
    label: 'Learn',
    icon: BookOpen,
    blurb: 'The lesson for this concept — read it, watch it, then move on.',
  },
  {
    key: 'practice',
    label: 'Practice',
    icon: NotebookPen,
    blurb: 'More questions on this concept, getting harder as you get them right.',
  },
  {
    key: 'feedback',
    label: 'Feedback',
    icon: MessageSquareText,
    blurb: 'What went well and what to fix, before anything is decided.',
  },
  {
    key: 'check',
    label: 'Check',
    icon: Timer,
    blurb: 'The understanding check that decides whether this concept is done.',
  },
  {
    key: 'intervention',
    label: 'Extra support',
    icon: Lightbulb,
    blurb: 'If the check was not passed, a teacher takes this one on.',
  },
  {
    key: 'mastery',
    label: 'Mastery',
    icon: Star,
    blurb: 'Where this concept stands across the whole chapter.',
  },
  {
    key: 'recall',
    label: 'Recall',
    icon: Repeat,
    blurb: 'Coming back to this later, so it stays.',
  },
];

/**
 * Stages nobody is guaranteed to pass through.
 *
 * Load-bearing: the rail's "anything before `current` is done" shortcut is a
 * lie for these. A learner standing on Mastery is past Extra support in the
 * array, and without this list it would render with a tick - claiming evidence
 * for something they were never asked to do. The image map reads the same list,
 * so a node the learner never needed is dimmed rather than drawn as a step
 * they skipped.
 */
export const CONDITIONAL_STAGES: readonly JourneyStageKey[] = ['intervention'];

/**
 * Every stage a learner necessarily passed to be standing on `stage`.
 *
 * Derived rather than written out, so adding a stage to JOURNEY_STAGES can
 * never leave a preset behind - which is exactly what happened with the
 * six-key array that ended up pasted into seven call sites. Conditional stages
 * are excluded because `completed` asserts evidence, and most learners have
 * none for Extra support.
 */
export function stagesBefore(stage: JourneyStageKey): JourneyStageKey[] {
  const index = JOURNEY_STAGES.findIndex((entry) => entry.key === stage);
  if (index <= 0) return [];

  return JOURNEY_STAGES.slice(0, index)
    .map((entry) => entry.key)
    .filter((key) => !CONDITIONAL_STAGES.includes(key));
}

/** Diagnostic through Check, minus Extra support. The old six-key literal. */
export const COMPLETED_THROUGH_CHECK: readonly JourneyStageKey[] = stagesBefore('mastery');

/** ...and Mastery too. The recall screen's seven-key literal. */
export const COMPLETED_THROUGH_MASTERY: readonly JourneyStageKey[] = stagesBefore('recall');

/** Lookup by key, for call sites that have a key and want a label or an icon. */
export const JOURNEY_STAGE_BY_KEY: Readonly<Record<JourneyStageKey, JourneyStage>> =
  Object.fromEntries(JOURNEY_STAGES.map((stage) => [stage.key, stage])) as Record<
    JourneyStageKey,
    JourneyStage
  >;

/**
 * Where a learner goes for a stage, given only what the screen hosting the map
 * happens to know.
 *
 * ---------------------------------------------------------------------------
 * WHY HALF THE STAGES TAKE A CONCEPT AND HALF TAKE A CHAPTER
 * ---------------------------------------------------------------------------
 * PAL is chapter-scoped for the paper stages (diagnostic, plan, mastery, the
 * chapter's recall queue) and concept-scoped for everything that diagnoses or
 * teaches one idea (adaptive, learn, practice, feedback, check, extra support).
 * That split is the backend's, not this component's: `EsoPolicyService` and
 * `palController` both work this way.
 *
 * So a stage whose page needs a concept returns null here when the screen
 * hosting the map did not have one — a chapter-level screen with no concept to
 * hand. The map treats a null href as "this node cannot be opened from here"
 * and still renders the node, because the picture and the explanation of the
 * step are worth showing even when the full screen needs an id this screen
 * genuinely does not have. Fabricating an href from a concept the learner is
 * not on would be worse: it would send them somewhere real but wrong.
 */
export function stageHref(
  stage: JourneyStageKey,
  ids: { chapterId?: string | number | null; conceptId?: string | number | null }
): string | null {
  const chapter = ids.chapterId
    ? String(ids.chapterId)
    : typeof window !== 'undefined'
      ? sessionStorage.getItem('pal_active_chapter_id')
      : null;
  const concept = ids.conceptId ? String(ids.conceptId) : null;

  // Step 2 (Concept Diagnostic) routes directly to the dedicated adaptive chapter page
  if (stage === 'adaptive') {
    return chapter ? `/pal/adaptive/chapter/${chapter}` : concept ? `/pal/adaptive/concept/${concept}` : null;
  }

  // Step 3 (Learning Plan) routes directly to the dedicated learning plan page
  if (stage === 'plan') {
    return chapter ? `/pal/plan/chapter/${chapter}` : null;
  }

  // If a chapter is known, always route directly into the unified image-based journey system
  if (chapter) {
    return `/pal/diagnostic/chapter/${chapter}?stage=${stage}`;
  }

  // Fallbacks if only concept is known without chapter context
  switch (stage) {
    case 'diagnostic':
      return null;
    case 'learn':
      return concept ? `/pal/learn/concept/${concept}` : null;
    case 'practice':
      return concept ? `/pal/eso?conceptId=${concept}` : null;
    case 'feedback':
      return concept ? `/pal/feedback/concept/${concept}` : null;
    case 'check':
      return concept ? `/pal/eso?conceptId=${concept}` : null;
    case 'intervention':
      return concept ? `/pal/intervention/concept/${concept}` : null;
    case 'mastery':
      return concept ? `/pal/mastery/concept/${concept}` : null;
    case 'recall':
      return '/pal/recall';
    default:
      return null;
  }
}

/**
 * Which stage a chapter is on, from what the backend already reports.
 *
 * Deliberately derived rather than stored: every input is persisted evidence,
 * so a stage computed here can never disagree with the data it came from, and
 * there is no extra field to keep in sync.
 *
 * There is no `feedback` branch on purpose. Feedback lives for one screen,
 * between one practice set and one check; a chapter-level rollup that reported
 * it would be wrong the moment the learner navigated away.
 */
export function resolveChapterStage(input: {
  hasDiagnostic: boolean;
  practiceAttempts: number;
  mastered: number;
  conceptsServable: number;
  /**
   * Support cases open against this chapter. Optional: a caller with no
   * intervention data omits it and gets exactly the old answer, rather than
   * having to pass a zero it cannot vouch for.
   */
  openInterventions?: number;
}): JourneyStageKey {
  if (!input.hasDiagnostic) return 'diagnostic';
  if (input.practiceAttempts === 0) return 'adaptive';
  if (input.conceptsServable > 0 && input.mastered >= input.conceptsServable) return 'recall';
  // After the completion check on purpose: a learner who has finished the
  // chapter is not "being supported", whatever is still open on a record.
  if ((input.openInterventions ?? 0) > 0) return 'intervention';
  if (input.mastered > 0) return 'mastery';
  return 'plan';
}