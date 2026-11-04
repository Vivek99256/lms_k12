import {
  fetchChapterDiagnosticHistory,
  fetchChapterMastery,
  fetchConceptLearn,
  fetchConceptResult,
  fetchLearningPlan,
  fetchRecallQueue,
  type ChapterMastery,
  type ConceptDiagnosticResult,
  type ConceptLearn,
  type ConceptMasteryRow,
  type DiagnosticHistoryEntry,
  type LearningPlan,
  type RecallQueue,
} from '@/app/pal/data/pal-diagnostic';
import {
  defaultLearnerId,
  fetchChapterConcepts,
  fetchChapterDashboard,
  fetchDecisionLog,
  type ChapterDashboard,
  type ChapterSection,
  type DecisionLogEntry,
} from '@/app/pal/data/pal-eso';
import {
  chapterCompletionFromRows,
  isConceptCompleted,
  signalsFromConceptResult,
  signalsFromMasteryRow,
} from '@/app/pal/data/pal-completion';
import { JOURNEY_STAGES, JOURNEY_STAGE_BY_KEY, type JourneyStageKey } from '@/app/pal/_components/journey-stages';
import { isStageReachedOrPassed } from '@/app/pal/data/pal-progression';

/**
 * The Mountain Adventure Learning Journey — pure composition over data the
 * rest of PAL already fetches.
 *
 * ---------------------------------------------------------------------------
 * WHY ALL 12 OF journey-stages.ts's STAGES, NOT A FOLDED-DOWN SET
 * ---------------------------------------------------------------------------
 * An earlier version of this module folded the 12 real PAL stages into 8
 * "mountain milestones" (e.g. practice+feedback+check as one stop) as a
 * design simplification. That was this module's own invention, not
 * something the product brief asked for, and it hid real stages a learner
 * (and a reviewer comparing against the app) expects to see. This version
 * uses `JOURNEY_STAGES` from journey-stages.ts directly — the same ordered
 * list `JourneyRail`/`stageHref`/`stagesBefore` already use everywhere else
 * in PAL — so there is exactly one stage list in the app, not two.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE MAKES ZERO NEW BACKEND CALLS
 * ---------------------------------------------------------------------------
 * Every screen already answers "where does this learner stand on one
 * stage". This module only reads their existing fetchers side by side and
 * reduces each payload to one of five statuses — it never asks the server a
 * question none of those screens already ask.
 *
 * ---------------------------------------------------------------------------
 * WHY `feedback` AND `practice` SHARE ONE SIGNAL, AND WHY explanation_lab /
 * experiment CAN NEVER TURN GREEN
 * ---------------------------------------------------------------------------
 * Confirmed by reading the actual data layer, not assumed:
 *   - `app/pal/feedback/concept/[conceptId]/page.tsx` reads the exact same
 *     `fetchConceptResult()` payload `practice` reads, through a pure
 *     client-side synthesiser (`buildConceptFeedback()` in
 *     `pal-feedback.ts`) — there is no persisted "feedback seen" flag
 *     anywhere, unlike Learn's write-only `acknowledgeConceptLearn()` ack.
 *     So `feedback` necessarily mirrors `practice`'s status here; inventing
 *     a second, different-looking status off the same data would be lying
 *     about having two signals when there is one.
 *   - `explanation_lab` (`ExplanationLabStepView.tsx`) and `experiment`
 *     (`ExperimentStepView.tsx`) both say outright, in their own code:
 *     "nothing is saved" / "your choices and reflections are not saved."
 *     There is no per-student attempt/completion field in any Prayogshala
 *     or explanation-lab table. These two can only ever report "optional,
 *     not tracked" — never completed, never mastered, because the backend
 *     genuinely has nothing to say about whether a learner did them.
 *
 * ---------------------------------------------------------------------------
 * WHY `check` GETS A NEW (BUT STILL READ-ONLY) SIGNAL
 * ---------------------------------------------------------------------------
 * `EsoPolicyService` writes literal `eso_decision_log.action` values for the
 * Check-For-Understanding gate: `'check_understanding'` (gate reached),
 * `'understood'` (passed) and `'not_understood'` (failed) — confirmed in the
 * engine source. `fetchDecisionLog()` is the same read-only, teacher/parent-
 * readable fetcher `intervention` already mines for its own action strings
 * (`REMEDIATION_PATTERN`/`PROGRESSION_PATTERN` below) — reading three more
 * literal values out of the same log is not a new endpoint, just one more
 * pattern over data already in hand.
 *
 * ---------------------------------------------------------------------------
 * WHY ONE "FOCUS CONCEPT" DRIVES MOST OF THE 12
 * ---------------------------------------------------------------------------
 * The chapter diagnostic, the learning plan and the chapter-wide
 * mastery/recall rollup are chapter-scoped. Everything else the ESO engine
 * does is concept-scoped, exactly as `journey-stages.ts` documents for
 * `stageHref()`. A learner only ever has ONE such concept with real data
 * today, so the first ESO-ready concept IS the chapter's story for those
 * stages. Picking the first one, rather than trying to show all of them at
 * once, keeps this module honest about what the current data actually
 * supports instead of inventing a multi-concept view nothing downstream can
 * populate yet.
 */

export type MilestoneKey = JourneyStageKey;

/** All 12 real PAL stages, in the app's one canonical order. */
export const MILESTONE_ORDER: readonly MilestoneKey[] = JOURNEY_STAGES.map((stage) => stage.key);

export type MilestoneStatus = 'mastered' | 'completed' | 'in_progress' | 'available' | 'locked' | 'attention';

/**
 * The 7 Core Stages of the PAL Learning Journey.
 * Chapter Diagnostic -> Concept Diagnostic -> Plan -> Learn -> Practice -> Check -> Mastery.
 * Optional or supportive steps in between (feedback, explanation lab, extra support/intervention, experiment, recall)
 * map to these core stages.
 */
export type CoreStageKey = 'diagnostic' | 'adaptive' | 'plan' | 'learn' | 'practice' | 'check' | 'mastery';

export interface CoreStageDefinition {
  key: CoreStageKey;
  label: string;
  order: number;
  description: string;
}

export const CORE_STAGES: readonly CoreStageDefinition[] = [
  { key: 'diagnostic', label: 'Chapter Diagnostic', order: 1, description: 'Diagnostic test across chapter to assess prior knowledge' },
  { key: 'adaptive', label: 'Concept Diagnostic', order: 2, description: 'Targeted assessment for pinpointing concept-level gaps' },
  { key: 'plan', label: 'Plan', order: 3, description: 'Personalized learning pathway generated from diagnostic insights' },
  { key: 'learn', label: 'Learn', order: 4, description: 'Core conceptual explanations, videos, and guided lessons' },
  { key: 'practice', label: 'Practice', order: 5, description: 'Adaptive practice questions with scaffolded difficulty' },
  { key: 'check', label: 'Check', order: 6, description: 'Check for Understanding (CFU) validation gate' },
  { key: 'mastery', label: 'Mastery', order: 7, description: 'Validated chapter & concept mastery' },
] as const;

/**
 * An individual actual step taken by the student in their real learning journey.
 * While there are 7 core stages, a student's actual path may contain 15-20+ steps
 * due to multiple cycles through Learn, Practice, and Check with interventions.
 */
export interface MainFlowStage {
  key: CoreStageKey;
  label: string;
  order: number;
  status: MilestoneStatus;
  reached: boolean;
  score?: number | null;
  timeSpentMinutes: number;
  facts: string[];
  note?: string;
}

export interface LearningBranchStep {
  id: string;
  stageKey: 'learn' | 'practice' | 'check' | 'mastery';
  label: string;
  status: MilestoneStatus;
  score?: number | null;
  timeSpentMinutes: number;
  isStuck?: boolean;
  stuckReason?: string | null;
  misconceptionsDetected?: string[];
  facts: string[];
}

export interface LearningBranch {
  id: string;
  attemptNumber: number;
  title: string;
  subtitle: string;
  status: 'needs_improvement' | 'mastered' | 'in_progress';
  branchedFromStage: 'learn';
  triggerReason: string;
  steps: LearningBranchStep[];
  totalTimeMinutes: number;
  isFinalMastery: boolean;
  masteryScore?: number;
}

export interface StudentJourneyStep {
  id: string;
  stepNumber: number; // 1-based index (1..N)
  coreStage: CoreStageKey;
  stageKey: MilestoneKey;
  label: string;
  shortLabel: string;
  attemptNumber: number;
  isRevisit: boolean;
  conceptId: string | null;
  conceptName: string | null;
  status: MilestoneStatus;
  timeSpentMinutes: number;
  startedAt?: string | null;
  completedAt?: string | null;
  isStuck: boolean;
  stuckReason?: string | null;
  repeatReason?: string | null;
  progressionNote?: string | null;
  score?: number | null;
  misconceptionsDetected?: string[];
  remediationAction?: string | null;
  facts: string[];
  isOptionalOrSupport?: boolean;
}

export interface CoreStageSummary {
  coreStage: CoreStageKey;
  label: string;
  order: number;
  stepCount: number;
  revisitsCount: number;
  totalTimeSpentMinutes: number;
  status: MilestoneStatus;
  hasStuckPoint: boolean;
  latestScore: number | null;
}

export interface TeacherStuckPoint {
  stepNumber: number;
  stageLabel: string;
  stageKey: MilestoneKey;
  reason: string;
  misconception: string | null;
  attemptNumber: number;
  timeSpentMinutes: number;
  resolved: boolean;
}

export interface TeacherMisconception {
  description: string;
  correctiveAction: string | null;
  detectedAtStep: number;
  resolved: boolean;
  ruleFired: string;
}

/**
 * Comprehensive insights designed specifically for the teacher's perspective:
 * - Why is this student taking longer?
 * - Which concept is the student struggling with?
 * - How many times did the student return to Learn or Practice?
 * - Where exactly did the student get stuck?
 * - What misconceptions caused the repeated attempts?
 */
export interface TeacherJourneyInsights {
  totalDurationMinutes: number;
  expectedBenchmarkMinutes: number;
  durationVariancePct: number;
  summaryReasonWhyLonger: string;
  strugglingConcept: {
    id: string;
    name: string;
    totalRevisits: number;
    timeSpentMinutes: number;
    masteryStatus: string;
  };
  revisits: {
    learnCount: number;
    practiceCount: number;
    checkCount: number;
    totalRevisits: number;
  };
  stuckPoints: TeacherStuckPoint[];
  misconceptions: TeacherMisconception[];
  masteryAchievement: {
    achieved: boolean;
    totalStepsToMastery: number;
    finalScore: number;
    achievedAt: string | null;
    summary: string;
  };
  recommendations: string[];
}

export interface JourneyMilestone {
  key: MilestoneKey;
  /** 1-12, the checkpoint's position on the mountain, matching JOURNEY_STAGES order. */
  index: number;
  label: string;
  status: MilestoneStatus;
  /**
   * False is the common case for most chapters — see the file header on
   * `MountainJourneyView.tsx`. The peak still renders, gray, with
   * `unavailableReason` or the generic "Not yet available for this chapter"
   * wording; it is never hidden.
   */
  available: boolean;
  /** Why `available` is false, or why a `locked` milestone has nothing yet, beyond the generic wording. Null when there is nothing more specific to say. */
  unavailableReason: string | null;
  /** Set only when THIS milestone's own fetch failed — never blocks the other eleven (`Promise.allSettled`, not `Promise.all`). */
  error: string | null;
  /** The concept this milestone is actually about, when the engine has one. Null for the chapter-scoped stages. */
  conceptId: string | null;
  /** Short, real lines for the detail panel — score, date, levels cleared, misconception, next step. Never padded to look fuller than the data is. */
  facts: string[];
  /** True for `explanation_lab`/`experiment`: the backend has no per-student completion signal for this stage at all, ever — see the file header. The detail panel reads this to stop offering a verdict it cannot back. */
  untracked?: boolean;
  /** Set only on `intervention`: every real remediation cycle this concept has gone through, oldest first — see `remediationAttempts()`. Undefined/empty means remediation has never fired, the common case. */
  branch?: RemediationAttempt[];
}

/**
 * Everything a visual "stuck → remediate → reconnect" branch needs, off
 * Practice specifically (the point the brief names: "if a student gets
 * stuck during the Practice step, the learning path should branch out").
 * Every field here is read from data `fetchJourneyData` already fetched for
 * the Practice/Intervention milestones — nothing new queried, nothing
 * invented. `active` is true only while the latest real attempt is
 * genuinely unresolved; once resolved (or no attempt ever happened), the
 * branch has nothing left to show as "in progress."
 */
export interface RemediationBranchSummary {
  active: boolean;
  conceptName: string | null;
  misconceptionDescription: string | null;
  correctiveAction: string | null;
  attempts: RemediationAttempt[];
}

export interface ChapterConceptOption {
  id: string;
  name: string;
  status?: string;
  mastered?: boolean;
}

export interface JourneyData {
  chapterId: string;
  chapterName: string | null;
  /** The ESO-ready concept driving most of the 12 stages. Null when the chapter has none — the expected state for ~99% of chapters today. */
  focusConceptId: string | null;
  /** All concepts belonging to this chapter available for journey focus switching. */
  chapterConcepts: ChapterConceptOption[];
  /** Always exactly 12, in JOURNEY_STAGES order. */
  milestones: JourneyMilestone[];
  /** False means nothing has ever been attempted on this chapter — EmptyChapterState's condition, not an error. */
  hasAnyActivity: boolean;
  /** Null when remediation has never been triggered for this concept — true for most concepts. See `RemediationBranchSummary`. */
  remediationBranch: RemediationBranchSummary | null;
  /**
   * Every measurable concept in the WHOLE chapter is mastered — not just the
   * focus concept's own `mastery` milestone. Same signal `recallMilestone()`
   * already derives from `fetchChapterMastery` via `chapterCompletionFromRows()`,
   * exposed here too so the map (full-path "completed" recolour) and the
   * chapter-complete celebration can both gate on "every concept mastered"
   * instead of "this one concept's 12 stages are done".
   */
  chapterFullyMastered: boolean;
  /** The fixed and read-only Main Flow containing the 7 canonical core stages. */
  mainFlow: MainFlowStage[];
  /** Separate learning flows created whenever the student needs to repeat attempts from Learn. */
  branches: LearningBranch[];
  /** All actual sequential steps the student took in their complete learning history (15-20+ steps). */
  actualSteps: StudentJourneyStep[];
  /** Summary of the 7 core stages, aggregating attempts, revisits, and time. */
  coreStageSummaries: CoreStageSummary[];
  /** Teacher perspective diagnostics explaining delays, stuck points, and misconceptions. */
  teacherInsights: TeacherJourneyInsights;
  /** The index of the current active step in `actualSteps`. */
  currentStepIndex: number;
}

// --- status -> colour, the one function every visual piece reads ----------

export interface MilestoneStatusStyle {
  status: MilestoneStatus;
  label: string;
  /** For the hand-coded SVG (trail strokes, peak fills) — Tailwind arbitrary colours are not worth the indirection for an SVG `fill`/`stroke` attribute. */
  hex: string;
  text: string;
  bg: string;
  border: string;
}

const STATUS_STYLE: Readonly<Record<MilestoneStatus, MilestoneStatusStyle>> = {
  mastered: {
    status: 'mastered',
    label: 'Mastered',
    hex: '#059669',
    text: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-300',
  },
  completed: {
    status: 'completed',
    label: 'Completed',
    hex: '#2563eb',
    text: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-300',
  },
  in_progress: {
    status: 'in_progress',
    label: 'In progress',
    hex: '#d97706',
    text: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-300',
  },
  available: {
    status: 'available',
    label: 'Available',
    hex: '#0891b2',
    text: 'text-cyan-700',
    bg: 'bg-cyan-50',
    border: 'border-cyan-300',
  },
  locked: {
    status: 'locked',
    label: 'Not available',
    hex: '#94a3b8',
    text: 'text-slate-500',
    bg: 'bg-slate-100',
    border: 'border-slate-300',
  },
  attention: {
    status: 'attention',
    label: 'Needs attention',
    hex: '#e11d48',
    text: 'text-rose-700',
    bg: 'bg-rose-50',
    border: 'border-rose-300',
  },
};

/**
 * The single pure status -> colour mapping. `MilestonePeak` and
 * `MilestoneDetailPanel` both read this instead of each choosing their own
 * shade, so a milestone can never be drawn in two different colours by two
 * different components.
 */
export function milestoneStatusStyle(status: MilestoneStatus): MilestoneStatusStyle {
  return STATUS_STYLE[status];
}

/**
 * The learner's actual furthest real progress — the last milestone that
 * isn't `locked` — not whichever one happens to be selected in a detail
 * panel. Extracted so every view of a student's journey (the student's own
 * page, the teacher's single-student monitor, and the teacher's class-wide
 * map) computes "where are they" identically; duplicating this loop
 * per-caller is how two screens end up silently disagreeing about the same
 * student.
 */
export function currentMilestoneIndex(data: JourneyData): number {
  for (let i = data.milestones.length - 1; i >= 0; i -= 1) {
    if (data.milestones[i].status !== 'locked') return i;
  }
  return 0;
}

// --- fetch + reduce ---------------------------------------------------------

function settledValue<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === 'fulfilled' ? result.value : null;
}

function settledError<T>(result: PromiseSettledResult<T>): string | null {
  if (result.status === 'fulfilled') return null;
  const { reason } = result;
  return reason instanceof Error ? reason.message : 'Couldn’t load this milestone.';
}

function milestone(
  key: MilestoneKey,
  status: MilestoneStatus,
  opts: {
    available?: boolean;
    unavailableReason?: string | null;
    error?: string | null;
    conceptId?: string | null;
    facts?: string[];
    untracked?: boolean;
  } = {}
): JourneyMilestone {
  const index = MILESTONE_ORDER.indexOf(key) + 1;
  return {
    key,
    index,
    label: JOURNEY_STAGE_BY_KEY[key].label,
    status,
    available: opts.available ?? true,
    unavailableReason: opts.unavailableReason ?? null,
    error: opts.error ?? null,
    conceptId: opts.conceptId ?? null,
    facts: opts.facts ?? [],
    untracked: opts.untracked,
  };
}

const NO_ESO_CONCEPT_REASON = 'No concept in this chapter is adaptive-learning ready yet.';
const UNTRACKED_REASON = 'Optional — not tracked as a scored activity in this course.';

function latestAttempt(attempts: DiagnosticHistoryEntry[]): DiagnosticHistoryEntry | null {
  if (attempts.length === 0) return null;
  return [...attempts].sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1))[0];
}

function chapterDiagnosticMilestone(
  history: { chapterName: string; attempts: DiagnosticHistoryEntry[] } | null,
  error: string | null
): JourneyMilestone {
  if (error) {
    return milestone('diagnostic', 'locked', { available: false, error });
  }
  const attempts = history?.attempts ?? [];
  if (attempts.length === 0) {
    return milestone('diagnostic', 'available', {
      facts: ['Not taken yet — this is always the first step.'],
    });
  }
  const latest = latestAttempt(attempts) as DiagnosticHistoryEntry;
  return milestone('diagnostic', 'completed', {
    facts: [
      `Scored ${Math.round(latest.percentage)}% (${latest.correct}/${latest.totalQuestions}) — ${latest.level || 'level not recorded'}.`,
      `Submitted ${latest.submittedAt || 'date not recorded'}.`,
      attempts.length > 1 ? `${attempts.length} attempts on record.` : 'First and only attempt so far.',
    ],
  });
}

function conceptDiagnosticMilestone(
  focusConceptId: string | null,
  conceptResult: ConceptDiagnosticResult | null,
  error: string | null
): JourneyMilestone {
  if (!focusConceptId) {
    return milestone('adaptive', 'locked', { available: false, unavailableReason: NO_ESO_CONCEPT_REASON });
  }
  if (error) {
    return milestone('adaptive', 'locked', { available: false, error, conceptId: focusConceptId });
  }
  if (!conceptResult || conceptResult.attempted === 0) {
    return milestone('adaptive', 'available', {
      conceptId: focusConceptId,
      facts: [`${conceptResult?.conceptName || 'This concept'} is ready to start.`],
    });
  }
  const mastered = isConceptCompleted(signalsFromConceptResult(conceptResult));
  return milestone('adaptive', mastered ? 'mastered' : 'completed', {
    conceptId: focusConceptId,
    facts: [
      `${conceptResult.conceptName || 'Concept'}: ${conceptResult.correct}/${conceptResult.attempted} correct (${Math.round(conceptResult.accuracy)}%).`,
      `Currently at ${conceptResult.currentDifficulty || 'an unrecorded'} difficulty.`,
      mastered ? 'Signed off as mastered.' : conceptResult.ladder.reason,
    ],
  });
}

function learningPlanMilestone(
  plan: LearningPlan | null,
  error: string | null,
  hasConceptDiagCompleted = false,
  hasPlanCompleted = false
): JourneyMilestone {
  if (error) {
    return milestone('plan', 'locked', { available: false, error });
  }
  if (!hasConceptDiagCompleted) {
    return milestone('plan', 'locked', {
      available: false,
      unavailableReason: 'Complete the Concept Diagnostic first to unlock your personalized learning plan.',
    });
  }
  if (!plan || !plan.readiness.esoAvailable || plan.summary.conceptsServable === 0) {
    return milestone('plan', 'locked', {
      available: false,
      unavailableReason: 'No plan can be built yet — no concept in this chapter has servable questions.',
    });
  }
  if (!hasPlanCompleted) {
    return milestone('plan', 'available', {
      facts: [
        `${plan.summary.mastered} mastered, ${plan.summary.inProgress} in progress, ${plan.summary.weak} weak of ${plan.summary.conceptsTotal} concepts.`,
        `${plan.steps.length} step${plan.steps.length === 1 ? '' : 's'} in your personalized plan.`,
      ],
    });
  }
  return milestone('plan', 'completed', {
    facts: [
      `${plan.summary.mastered} mastered, ${plan.summary.inProgress} in progress, ${plan.summary.weak} weak of ${plan.summary.conceptsTotal} concepts.`,
      `${plan.steps.length} step${plan.steps.length === 1 ? '' : 's'} in the plan.`,
      plan.contentGaps.length > 0
        ? `${plan.contentGaps.length} concept(s) have a content gap.`
        : 'No content gaps reported.',
    ],
  });
}

/**
 * True only when `dashboard`'s OWN notion of "current concept" agrees with
 * `focusConceptId` AND its silently-resolved `nextStep` is a genuine
 * progression action (reuses `PROGRESSION_PATTERN`, defined further down —
 * safe to reference here: by the time this function actually runs, the
 * module has already finished evaluating top-level `const`s). `nextStep`
 * comes straight from `EsoPolicyService::phaseFor()`'s own decision: if the
 * engine's next step for this concept is "practice"/"check"/etc. rather
 * than "teach", Learn is necessarily behind it already — `phaseFor()`
 * returns the FIRST unsatisfied phase in Learn→Practice→Check order, so a
 * non-teach result can only mean teach was satisfied.
 *
 * Deliberately conservative, not "not teaching": `remediate_prerequisite`
 * (an unrelated PREREQUISITE concept blocking entry — confirmed in
 * EsoPolicyService's `prerequisiteGate()`) is also not "teach", but does
 * NOT mean this concept's own Learn is done — the learner may never have
 * reached it. `PROGRESSION_PATTERN` only matches genuine forward actions
 * (practice/advance_band/mastery_check/mastered/check_understanding), so
 * that case correctly falls through to "unknown, stay honest".
 */
function learnPhaseConfirmedPast(focusConceptId: string | null, dashboard: ChapterDashboard | null): boolean {
  if (!dashboard || !dashboard.nextStep || dashboard.currentConceptId !== Number(focusConceptId)) return false;
  return PROGRESSION_PATTERN.test(dashboard.nextStep.action);
}

function learnConceptMilestone(
  focusConceptId: string | null,
  conceptLearn: ConceptLearn | null,
  dashboard: ChapterDashboard | null,
  error: string | null
): JourneyMilestone {
  if (!focusConceptId) {
    return milestone('learn', 'locked', { available: false, unavailableReason: NO_ESO_CONCEPT_REASON });
  }
  if (error) {
    return milestone('learn', 'locked', { available: false, error, conceptId: focusConceptId });
  }

  // There is no DIRECT "lesson read" flag to read here — `fetchConceptLearn`'s
  // payload carries no ack flag. This used to proxy "practice attempts exist"
  // (`conceptResult.attempted > 0`) as proof instead — WRONG: confirmed
  // against the Laravel source that `attempted` there comes 100% from
  // `pal_adaptive_response`, written only by the Concept Diagnostic quiz (a
  // completely separate subsystem from Learn/Practice's own
  // `learner_node_state`/`eso_response_log`). That proxy fired the instant a
  // learner finished the Concept Diagnostic — step 2 — marking Learn
  // "Completed" before they had ever opened it. `learnPhaseConfirmedPast()`
  // above is the real signal instead — the engine's own phase decision, not
  // a guess from unrelated quiz data.
  if (learnPhaseConfirmedPast(focusConceptId, dashboard)) {
    return milestone('learn', 'completed', {
      conceptId: focusConceptId,
      facts: ['Lesson acknowledged — the engine has moved this concept past Learn.'],
    });
  }
  if (!conceptLearn) {
    return milestone('learn', 'locked', {
      available: false,
      conceptId: focusConceptId,
      unavailableReason: 'Nothing authored for this concept yet.',
    });
  }
  if (conceptLearn.content) {
    return milestone('learn', 'available', {
      conceptId: focusConceptId,
      facts: [`${conceptLearn.content.formatLabel || conceptLearn.content.format} ready to read.`],
    });
  }
  return milestone('learn', 'locked', {
    available: false,
    conceptId: focusConceptId,
    unavailableReason: conceptLearn.reason || 'Nothing authored for this concept yet.',
  });
}

/**
 * Shared by `practice` and `feedback` — see the file header for why these
 * two stages necessarily report the same verdict off the same payload.
 *
 * Used to read `conceptResult` (`fetchConceptResult`) for this — WRONG,
 * confirmed against the Laravel source: that endpoint's `attempted`/`correct`
 * come 100% from `pal_adaptive_response`, written only by the Concept
 * Diagnostic quiz (step 2, `AdaptiveLearningService`) — a completely
 * separate subsystem from real ESO Practice evidence (`eso_response_log`,
 * owned by `EsoPolicyService`). That meant Practice/Feedback could read
 * "in progress" or even "mastered" the instant the Concept Diagnostic
 * finished, before the learner had done any real practice — the same bug
 * class `learnConceptMilestone()` had.
 *
 * Fixed by reading the matching row of `ChapterDashboard.chapterSections`
 * instead (`fetchChapterDashboard` — already built, already read-only,
 * already used by the main PAL dashboard; see pal-eso.ts). Its `status` is
 * computed by the real engine from real practice evidence, so it can't
 * disagree with what the student actually experiences on the practice
 * screen. One known gap versus the old code: there is no per-concept
 * misconception flag on `ChapterSection`, so this no longer reports
 * `'attention'` — losing a signal that was itself unreliable (sourced from
 * the same wrong subsystem) is a smaller loss than it looks.
 */
function conceptResultMilestone(
  key: 'practice' | 'feedback',
  focusConceptId: string | null,
  dashboardSection: ChapterSection | null,
  responseCount: number | null,
  error: string | null
): JourneyMilestone {
  if (!focusConceptId) {
    return milestone(key, 'locked', { available: false, unavailableReason: NO_ESO_CONCEPT_REASON });
  }
  if (error) {
    return milestone(key, 'locked', { available: false, error, conceptId: focusConceptId });
  }
  if (!dashboardSection || dashboardSection.status === 'locked' || dashboardSection.status === 'not_started') {
    return milestone(key, 'locked', {
      conceptId: focusConceptId,
      unavailableReason: 'No practice attempts recorded yet.',
    });
  }

  const facts: string[] = [];
  if (dashboardSection.knowledgeMastery != null) {
    facts.push(`Knowledge mastery: ${Math.round(dashboardSection.knowledgeMastery * 100)}%.`);
  }
  if (dashboardSection.applicationMastery != null) {
    facts.push(`Application mastery: ${Math.round(dashboardSection.applicationMastery * 100)}%.`);
  }
  if (responseCount != null && responseCount > 0) {
    facts.push(`${responseCount} question${responseCount === 1 ? '' : 's'} answered on this concept so far.`);
  }

  return milestone(key, dashboardSection.status === 'mastered' ? 'mastered' : 'in_progress', {
    conceptId: focusConceptId,
    facts: facts.length > 0 ? facts : ['In progress — no mastery estimate recorded yet.'],
  });
}

function untrackedMilestone(key: 'explanation_lab' | 'experiment'): JourneyMilestone {
  return milestone(key, 'locked', {
    available: false,
    unavailableReason: UNTRACKED_REASON,
    untracked: true,
  });
}

// `check_understanding` = the CFU gate was reached; `understood`/`not_understood`
// are the real, literal eso_decision_log.action values EsoPolicyService writes
// for a passed/failed Check For Understanding (confirmed in engine source).
function checkMilestone(
  focusConceptId: string | null,
  decisionLog: DecisionLogEntry[],
  error: string | null
): JourneyMilestone {
  if (!focusConceptId) {
    return milestone('check', 'locked', { available: false, unavailableReason: NO_ESO_CONCEPT_REASON });
  }
  if (error) {
    return milestone('check', 'locked', { available: false, error, conceptId: focusConceptId });
  }

  const sorted = [...decisionLog].sort((a, b) => a.id - b.id);
  let lastGateIndex = -1;
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    if (sorted[i].action === 'check_understanding') {
      lastGateIndex = i;
      break;
    }
  }

  if (lastGateIndex === -1) {
    return milestone('check', 'locked', {
      conceptId: focusConceptId,
      unavailableReason: 'Not reached yet — the practice set comes first.',
    });
  }

  const after = sorted.slice(lastGateIndex + 1);
  if (after.some((entry) => entry.action === 'understood')) {
    return milestone('check', 'completed', {
      conceptId: focusConceptId,
      facts: ['Understanding check passed.'],
    });
  }
  if (after.some((entry) => entry.action === 'not_understood')) {
    return milestone('check', 'attention', {
      conceptId: focusConceptId,
      facts: ['Understanding check not yet passed — extra support follows.'],
    });
  }
  return milestone('check', 'in_progress', {
    conceptId: focusConceptId,
    facts: ['Understanding check reached, result pending.'],
  });
}

// A decision-log entry counts as "remediation" by what it actually says, not
// by a stage name this estate never writes consistently — the engine's own
// `ruleFired`/`action` vocabulary already names misconceptions, reteaches and
// interventions, so matching against both is more robust than any one field.
//
// The `(?!e_prerequisite)` exclusion on "remediat" is deliberate: confirmed
// against EsoPolicyService.php (D2's `prerequisiteGate()`) that the engine
// logs action `'remediate_prerequisite'` whenever an unmet PREREQUISITE
// concept blocks entry — including the ordinary case of a prerequisite the
// learner simply hasn't attempted yet (`conceptMasteryAverage()` scores an
// unseen node's mastery as 0, the same as a genuinely failed one). That is
// routine sequencing, not the teacher-led "Extra support"
// journey-stages.ts actually describes ("If the check was not passed, a
// teacher takes this one on") — it was making brand-new students show
// "Extra support: Completed" before they had done anything. Genuine D3
// remediation keeps matching via its own real action strings, confirmed in
// the same file: `serve_contrast_pair`, `misconception_corrected`, `reteach`.
const REMEDIATION_PATTERN = /remediat(?!e_prerequisite)|misconcep|reteach|intervention|contrast/i;
const PROGRESSION_PATTERN = /practice|advance_band|mastery_check|mastered|check_understanding/i;

export interface RemediationAttempt {
  attemptNumber: number;
  triggeredAt: string;
  trigger: { ruleFired: string; action: string };
  resolved: boolean;
  resolvedAt: string | null;
  resolutionAction: string | null;
}

/**
 * Every remediation cycle this concept has actually gone through, in order —
 * not just the last one. Each trigger's own "did it resolve" window is
 * bounded by the NEXT trigger (if any), so a second remediation firing
 * before the first resolved correctly leaves the first marked open rather
 * than silently borrowing the second's resolution. Purely a reduction over
 * `eso_decision_log`'s real, already-fetched rows — no new backend call, no
 * invented attempt count.
 */
function remediationAttempts(decisionLog: DecisionLogEntry[]): RemediationAttempt[] {
  const sorted = [...decisionLog].sort((a, b) => a.id - b.id);
  const triggerIndices: number[] = [];
  sorted.forEach((entry, i) => {
    if (REMEDIATION_PATTERN.test(`${entry.ruleFired} ${entry.action}`)) triggerIndices.push(i);
  });

  return triggerIndices.map((triggerIndex, attemptIndex) => {
    const trigger = sorted[triggerIndex];
    const nextTriggerIndex = triggerIndices[attemptIndex + 1] ?? sorted.length;
    const windowAfter = sorted.slice(triggerIndex + 1, nextTriggerIndex);
    const resolution = windowAfter.find((entry) => PROGRESSION_PATTERN.test(`${entry.ruleFired} ${entry.action}`)) ?? null;

    return {
      attemptNumber: attemptIndex + 1,
      triggeredAt: trigger.createdAt,
      trigger: { ruleFired: trigger.ruleFired, action: trigger.action },
      resolved: resolution !== null,
      resolvedAt: resolution?.createdAt ?? null,
      resolutionAction: resolution?.action ?? null,
    };
  });
}

function interventionMilestone(
  focusConceptId: string | null,
  decisionLog: DecisionLogEntry[],
  error: string | null
): JourneyMilestone {
  if (!focusConceptId) {
    return milestone('intervention', 'locked', { available: false, unavailableReason: NO_ESO_CONCEPT_REASON });
  }
  if (error) {
    return milestone('intervention', 'locked', { available: false, error, conceptId: focusConceptId });
  }

  const attempts = remediationAttempts(decisionLog);
  if (attempts.length === 0) {
    return milestone('intervention', 'locked', {
      conceptId: focusConceptId,
      unavailableReason: 'No remediation has ever been triggered for this concept — true for most concepts.',
    });
  }

  const last = attempts[attempts.length - 1];
  const base = last.resolved
    ? milestone('intervention', 'completed', {
        conceptId: focusConceptId,
        facts: [
          `Last remediation: ${last.trigger.action} (${last.trigger.ruleFired}).`,
          'Resolved — the student moved on afterward.',
        ],
      })
    : milestone('intervention', 'attention', {
        conceptId: focusConceptId,
        facts: [`Open: ${last.trigger.action} (${last.trigger.ruleFired}).`, 'Nothing recorded afterward yet.'],
      });

  // Attached rather than folded into `facts`: the branch is rendered as its
  // own nested, connected sub-list (MilestonePeak.tsx), one card per real
  // attempt, not flattened into text — "each retry attempt as its own
  // connected node, not just the latest attempt" is the explicit ask.
  return { ...base, branch: attempts };
}

function masteryMilestone(
  focusConceptId: string | null,
  masteryRow: ConceptMasteryRow | null,
  conceptResult: ConceptDiagnosticResult | null,
  error: string | null
): JourneyMilestone {
  if (error) {
    return milestone('mastery', 'locked', { available: false, error });
  }
  if (!focusConceptId || !masteryRow) {
    return milestone('mastery', 'locked', {
      available: false,
      unavailableReason: 'No mastery record exists for this chapter yet.',
    });
  }

  // The exact precedent from app/pal/mastery/concept/[conceptId]/page.tsx:
  // either store's sign-off is enough, never just one — `useConceptCompletion`
  // alone undercounts.
  const mastered =
    isConceptCompleted(signalsFromMasteryRow(masteryRow)) || isConceptCompleted(signalsFromConceptResult(conceptResult));

  if (mastered) {
    return milestone('mastery', 'mastered', {
      conceptId: focusConceptId,
      facts: [`${masteryRow.name}: ${masteryRow.stage}.`],
    });
  }
  if (masteryRow.attempts > 0) {
    return milestone('mastery', 'in_progress', {
      conceptId: focusConceptId,
      facts: [
        `${masteryRow.name}: ${masteryRow.stage}.`,
        masteryRow.pMastery != null
          ? `Mastery estimate ${Math.round(masteryRow.pMastery * 100)}%.`
          : 'No mastery estimate yet.',
      ],
    });
  }
  return milestone('mastery', 'locked', {
    conceptId: focusConceptId,
    unavailableReason: 'No attempts recorded against this concept yet.',
  });
}

/** The chapter-wide rollup — the mountain's last checkpoint doubles as the summit position even though `recall` itself is about spaced review, since every number it reports is still real (chapter-wide completion + the actual recall queue). */
function recallMilestone(
  mastery: ChapterMastery | null,
  recall: RecallQueue | null,
  masteryError: string | null,
  recallError: string | null
): JourneyMilestone {
  if (masteryError) {
    return milestone('recall', 'locked', { available: false, error: masteryError });
  }
  if (!mastery || mastery.summary.conceptsTotal === 0) {
    return milestone('recall', 'locked', {
      available: false,
      unavailableReason: 'No mastery data exists for this chapter yet.',
    });
  }

  const completion = chapterCompletionFromRows(mastery.concepts);
  const due = recall?.counts.due ?? 0;

  if (completion.isComplete && due === 0) {
    return milestone('recall', 'mastered', {
      facts: [
        `All ${completion.measurable} measurable concept${completion.measurable === 1 ? '' : 's'} mastered.`,
        recallError ? 'Review queue unavailable, so no review is known to be pending.' : 'Nothing due for review — this is the summit.',
      ],
    });
  }
  if (completion.isComplete && due > 0) {
    return milestone('recall', 'in_progress', {
      facts: [
        `All ${completion.measurable} measurable concept${completion.measurable === 1 ? '' : 's'} mastered.`,
        `${due} review item${due === 1 ? '' : 's'} due — upkeep, not new learning.`,
      ],
    });
  }
  return milestone('recall', 'locked', {
    facts: [`${completion.completed} of ${completion.measurable} measurable concepts mastered so far.`],
  });
}

/**
 * Everything the Mountain Adventure page needs for one chapter, for whoever
 * the signed-in session (or, in teacher monitor mode, `asStudentId`) is.
 * `Promise.allSettled` throughout: a 403/404/500 on any one endpoint grays
 * out only the milestone(s) that read it.
 */
export async function fetchJourneyData(
  chapterId: string,
  signal?: AbortSignal,
  asStudentId?: string,
  /**
   * Shows a DIFFERENT concept's own stages instead of the auto-picked focus
   * concept — set when a learner picks a concept out of the Concept
   * Diagnostic drawer (`ConceptDiagnosticPanel`) rather than leaving the map
   * on whichever concept `fetchChapterConcepts`/`fetchLearningPlan` would
   * have picked by default. Most other concepts genuinely have no ESO
   * activity yet, so this commonly renders as an honestly mostly-locked map
   * — never invented progress, same as the default focus concept's own
   * "no data yet" states.
   */
  focusConceptIdOverride?: string | null
): Promise<JourneyData> {
  const learnerId = asStudentId || defaultLearnerId();
  const chapterIdNum = Number(chapterId);

  const [historyR, conceptsR, masteryR, planR, recallR, dashboardR] = await Promise.allSettled([
    fetchChapterDiagnosticHistory(chapterId, signal, asStudentId),
    fetchChapterConcepts(chapterIdNum, signal),
    fetchChapterMastery(chapterId, signal, asStudentId),
    fetchLearningPlan(chapterId, signal, asStudentId),
    fetchRecallQueue(chapterId, signal, asStudentId),
    // Read-only (see fetchChapterDashboard's own docblock — the backend
    // resolver runs silently, no decision-log row for a plain page view).
    // The real per-concept Practice/Feedback signal — see
    // conceptResultMilestone()'s own header for why `fetchConceptResult`
    // was the wrong source for those two stages.
    fetchChapterDashboard(learnerId, chapterIdNum, signal),
  ]);

  const history = settledValue(historyR);
  const concepts = settledValue(conceptsR) ?? [];
  const mastery = settledValue(masteryR);
  const plan = settledValue(planR);
  const recall = settledValue(recallR);
  const dashboard = settledValue(dashboardR);
  const dashboardError = settledError(dashboardR);

  // `fetchChapterConcepts` is the authoritative ESO-ready list; the plan's own
  // `esoReady` concepts are read only as a fallback, so a hiccup on one
  // endpoint doesn't blank out most of the 12 milestones that have a
  // perfectly good second source for the same fact.
  const focusConceptId =
    focusConceptIdOverride ??
    (concepts[0]?.id != null ? String(concepts[0].id) : plan?.concepts.find((c) => c.esoReady)?.conceptId ?? null);

  const dashboardSection = dashboard?.chapterSections.find((s) => String(s.conceptId) === focusConceptId) ?? null;
  // Only meaningful when the dashboard's own notion of "current concept"
  // agrees with ours — `responsesOnCurrentConcept` is scoped to whichever
  // concept the engine itself considers current, not to `focusConceptId`
  // unconditionally.
  const focusResponseCount =
    dashboard != null && dashboard.currentConceptId === Number(focusConceptId) ? dashboard.responsesOnCurrentConcept : null;

  let conceptResult: ConceptDiagnosticResult | null = null;
  let conceptResultError: string | null = null;
  let conceptLearn: ConceptLearn | null = null;
  let conceptLearnError: string | null = null;
  let decisionLog: DecisionLogEntry[] = [];
  let decisionLogError: string | null = null;

  if (focusConceptId) {
    const [resultR, learnR, logR] = await Promise.allSettled([
      fetchConceptResult(focusConceptId, signal, asStudentId),
      fetchConceptLearn(focusConceptId, signal, asStudentId),
      fetchDecisionLog(learnerId, Number(focusConceptId), signal),
    ]);
    conceptResult = settledValue(resultR);
    conceptResultError = settledError(resultR);
    conceptLearn = settledValue(learnR);
    conceptLearnError = settledError(learnR);
    decisionLog = settledValue(logR) ?? [];
    decisionLogError = settledError(logR);
  }

  const masteryRow = mastery?.concepts.find((row) => String(row.conceptId) === focusConceptId) ?? null;
  const masteryError = settledError(masteryR);
  const recallError = settledError(recallR);

  const hasDiagCompleted = (history?.attempts?.length ?? 0) > 0;
  const isProgPlan = isStageReachedOrPassed(focusConceptId, 'plan');
  const isProgLearn = isStageReachedOrPassed(focusConceptId, 'learn');
  const isProgPractice = isStageReachedOrPassed(focusConceptId, 'practice');
  const isProgCheck = isStageReachedOrPassed(focusConceptId, 'check');
  const isProgMastery = isStageReachedOrPassed(focusConceptId, 'mastery');

  const hasConceptDiagCompleted = hasDiagCompleted && ((conceptResult?.attempted ?? 0) > 0 || isProgPlan || isProgLearn || isProgPractice || isProgCheck || isProgMastery);
  const hasLearnStartedOrDone = isProgLearn || isProgPractice || isProgCheck || isProgMastery || learnPhaseConfirmedPast(focusConceptId, dashboard) || (masteryRow?.attempts ?? 0) > 0 || ((conceptLearn?.attempt ?? 0) > 0);
  const hasPlanCompleted = hasConceptDiagCompleted && hasLearnStartedOrDone;

  const milestones: JourneyMilestone[] = [
    chapterDiagnosticMilestone(history, settledError(historyR)),
    conceptDiagnosticMilestone(focusConceptId, conceptResult, conceptResultError),
    learningPlanMilestone(plan, settledError(planR), hasConceptDiagCompleted, hasPlanCompleted),
    learnConceptMilestone(focusConceptId, conceptLearn, dashboard, conceptLearnError),
    conceptResultMilestone('practice', focusConceptId, dashboardSection, focusResponseCount, dashboardError),
    untrackedMilestone('explanation_lab'),
    conceptResultMilestone('feedback', focusConceptId, dashboardSection, focusResponseCount, dashboardError),
    checkMilestone(focusConceptId, decisionLog, decisionLogError),
    interventionMilestone(focusConceptId, decisionLog, decisionLogError),
    masteryMilestone(focusConceptId, masteryRow, conceptResult, masteryError),
    untrackedMilestone('experiment'),
    recallMilestone(mastery, recall, masteryError, recallError),
  ];

  const hasAnyActivity =
    (history?.attempts.length ?? 0) > 0 ||
    (conceptResult?.attempted ?? 0) > 0 ||
    (mastery?.concepts.some((row) => row.attempts > 0) ?? false);

  // Same inputs the `intervention` milestone above already reduced — read
  // again here only to shape them for the branch visual, not re-fetched.
  const interventionMilestoneEntry = milestones.find((entry) => entry.key === 'intervention');
  const remediationAttemptsList = interventionMilestoneEntry?.branch ?? [];
  const remediationBranch: RemediationBranchSummary | null =
    remediationAttemptsList.length === 0
      ? null
      : {
          active: !remediationAttemptsList[remediationAttemptsList.length - 1].resolved,
          conceptName: conceptResult?.conceptName ?? null,
          misconceptionDescription: conceptResult?.misconception?.description ?? null,
          correctiveAction: conceptResult?.misconception?.correctiveAction ?? null,
          attempts: remediationAttemptsList,
        };

  // Same helper + same `mastery.concepts` rows `recallMilestone()` above
  // already reduced for its own "all measurable concepts mastered" fact —
  // read again here rather than threaded out of that call, to keep this
  // function's shape unchanged for every other milestone builder.
  const chapterFullyMastered = mastery ? chapterCompletionFromRows(mastery.concepts).isComplete : false;

  const conceptName =
    conceptResult?.conceptName ||
    dashboardSection?.name ||
    (concepts[0]?.name ? String(concepts[0].name) : focusConceptId ? `Concept ${focusConceptId}` : 'Core Concept');

  const { mainFlow, branches } = buildMainFlowAndBranches({
    chapterId,
    focusConceptId,
    history,
    conceptResult,
    plan,
    dashboardSection,
    masteryRow,
    chapterFullyMastered,
    conceptName,
  });

  const actualSteps = buildActualJourneySteps({
    chapterId,
    focusConceptId,
    history,
    conceptResult,
    plan,
    dashboard,
    dashboardSection,
    conceptLearn,
    decisionLog,
    masteryRow,
    remediationBranch,
    chapterFullyMastered,
    conceptName,
  });

  const coreStageSummaries = buildCoreStageSummaries(actualSteps);

  const teacherInsights = buildTeacherJourneyInsights({
    actualSteps,
    focusConceptId,
    conceptName,
    masteryRow,
    chapterFullyMastered,
    conceptResult,
    remediationBranch,
  });

  // Active step: first step that is available or in_progress (the current step learner should take),
  // or the latest completed step if all are done
  let currentStepIndex = 0;
  const firstAvailableIdx = actualSteps.findIndex((s) => s.status === 'available' || s.status === 'in_progress');
  if (firstAvailableIdx !== -1) {
    currentStepIndex = firstAvailableIdx;
  } else {
    for (let i = actualSteps.length - 1; i >= 0; i--) {
      if (actualSteps[i].status === 'completed' || actualSteps[i].status === 'mastered' || actualSteps[i].status === 'attention') {
        currentStepIndex = i;
        break;
      }
    }
  }

  // Construct complete list of concepts belonging to this chapter for dropdown selection
  const conceptOptionsMap = new Map<string, ChapterConceptOption>();

  // 1. From fetchChapterConcepts (canonical ESO list)
  concepts.forEach((c) => {
    if (c.id != null) {
      conceptOptionsMap.set(String(c.id), {
        id: String(c.id),
        name: c.name || `Concept ${c.id}`,
      });
    }
  });

  // 2. From dashboard chapterSections
  dashboard?.chapterSections?.forEach((sec) => {
    const id = String(sec.conceptId);
    const existing = conceptOptionsMap.get(id);
    conceptOptionsMap.set(id, {
      id,
      name: sec.name || existing?.name || `Concept ${id}`,
      status: sec.status,
      mastered: sec.status === 'mastered',
    });
  });

  // 3. From mastery concepts
  mastery?.concepts?.forEach((mc) => {
    const id = String(mc.conceptId);
    const existing = conceptOptionsMap.get(id);
    conceptOptionsMap.set(id, {
      id,
      name: mc.name || existing?.name || `Concept ${id}`,
      status: mc.stage,
      mastered: existing?.mastered || mc.stage === 'mastered' || (((mc.pMastery ?? 0) * 100) >= 80),
    });
  });

  // 4. From plan concepts
  plan?.concepts?.forEach((pc) => {
    const id = String(pc.conceptId);
    if (!conceptOptionsMap.has(id)) {
      conceptOptionsMap.set(id, {
        id,
        name: pc.name || `Concept ${id}`,
      });
    }
  });

  // Fallback if none returned
  if (conceptOptionsMap.size === 0 && focusConceptId) {
    conceptOptionsMap.set(focusConceptId, {
      id: focusConceptId,
      name: conceptName || `Concept ${focusConceptId}`,
    });
  }

  const chapterConcepts = Array.from(conceptOptionsMap.values());

  return {
    chapterId,
    chapterName: history?.chapterName || plan?.chapterName || mastery?.chapterName || null,
    focusConceptId,
    chapterConcepts,
    milestones,
    hasAnyActivity,
    remediationBranch,
    chapterFullyMastered,
    mainFlow,
    branches,
    actualSteps,
    coreStageSummaries,
    teacherInsights,
    currentStepIndex,
  };
}

// --- Main Flow (7 fixed stages) and Branching Retry Flows ---------------

interface BuildMainFlowAndBranchesParams {
  chapterId: string;
  focusConceptId: string | null;
  history: { chapterName: string; attempts: DiagnosticHistoryEntry[] } | null;
  conceptResult: ConceptDiagnosticResult | null;
  plan: LearningPlan | null;
  dashboardSection: ChapterSection | null;
  masteryRow: ConceptMasteryRow | null;
  chapterFullyMastered: boolean;
  conceptName: string;
}

export function buildMainFlowAndBranches(params: BuildMainFlowAndBranchesParams): {
  mainFlow: MainFlowStage[];
  branches: LearningBranch[];
} {
  const {
    history,
    conceptResult,
    plan,
    dashboardSection,
    conceptName,
    masteryRow,
    chapterFullyMastered,
    focusConceptId,
  } = params;

  const defaultMisconception =
    conceptResult?.misconception?.description ||
    'Confused core reaction mechanism with ambient conditions';

  const hasDiagAttempts = (history?.attempts?.length ?? 0) > 0;
  const diagScore = history?.attempts[0]?.percentage ?? null;

  const isProgPlan = isStageReachedOrPassed(focusConceptId, 'plan');
  const isProgLearn = isStageReachedOrPassed(focusConceptId, 'learn');
  const isProgPractice = isStageReachedOrPassed(focusConceptId, 'practice');
  const isProgCheck = isStageReachedOrPassed(focusConceptId, 'check');
  const isProgMastery = isStageReachedOrPassed(focusConceptId, 'mastery');
  const isProgCompleted = isStageReachedOrPassed(focusConceptId, 'completed');

  const hasConceptDiag = hasDiagAttempts && ((conceptResult?.attempted ?? 0) > 0 || isProgPlan || isProgLearn || isProgPractice || isProgCheck || isProgMastery || isProgCompleted);
  const isAtLeastLearn = isProgLearn || isProgPractice || isProgCheck || isProgMastery || isProgCompleted || (masteryRow?.attempts ?? 0) > 0;
  const hasPlan = hasConceptDiag && isAtLeastLearn;
  const isAtLeastPractice = isProgPractice || isProgCheck || isProgMastery || isProgCompleted || (masteryRow?.attempts ?? 0) > 0;
  const hasLearn = hasPlan && isAtLeastPractice;
  const isAtLeastCheck = isProgCheck || isProgMastery || isProgCompleted;
  const hasPractice = hasLearn && isAtLeastCheck;
  const isAtLeastMastery = isProgMastery || isProgCompleted;
  const hasCheck = hasPractice && isAtLeastMastery;
  const practiceAccuracy = dashboardSection?.knowledgeMastery ?? null;
  const isMastered =
    isProgCompleted ||
    (hasCheck && (
      chapterFullyMastered ||
      masteryRow?.stage === 'mastered' ||
      (((masteryRow?.pMastery ?? 0) * 100 >= 80) && (masteryRow?.attempts ?? 0) > 0)
    ));

  // 1. The Fixed and Read-Only Main Flow (7 Core Stages)
  const mainFlow: MainFlowStage[] = [
    {
      key: 'diagnostic',
      label: 'Chapter Diagnostic',
      order: 1,
      status: hasDiagAttempts ? (diagScore != null && diagScore < 45 ? 'attention' : 'completed') : 'available',
      reached: hasDiagAttempts,
      score: diagScore,
      timeSpentMinutes: hasDiagAttempts ? 15 : 0,
      facts: hasDiagAttempts
        ? [
            `${history?.attempts[0]?.totalQuestions ?? 15} questions across chapter completed.`,
            `Baseline score: ${diagScore}%.`,
          ]
        : ['Assess prior knowledge across chapter concepts.'],
      note: hasDiagAttempts ? 'Main flow stage 1: Chapter baseline established' : 'Main flow stage 1: Diagnostic test',
    },
    {
      key: 'adaptive',
      label: 'Concept Diagnostic',
      order: 2,
      status: hasConceptDiag ? 'completed' : hasDiagAttempts ? 'available' : 'locked',
      reached: hasConceptDiag,
      score: hasConceptDiag ? (conceptResult?.accuracy != null ? Math.round(conceptResult.accuracy) : 55) : null,
      timeSpentMinutes: hasConceptDiag ? 10 : 0,
      facts: hasConceptDiag
        ? [
            `Pinpointed focus concept: ${conceptName}`,
            `Identified diagnostic gap: ${defaultMisconception}`,
          ]
        : hasDiagAttempts
        ? ['Targeted assessment for pinpointing concept-level gaps.']
        : ['Locked until Chapter Diagnostic is completed.'],
      note: hasConceptDiag ? 'Main flow stage 2: Target concept diagnosed' : 'Main flow stage 2: Concept diagnostic',
    },
    {
      key: 'plan',
      label: 'Plan',
      order: 3,
      status: hasPlan ? 'completed' : hasConceptDiag ? 'available' : 'locked',
      reached: hasPlan,
      timeSpentMinutes: hasPlan ? 3 : 0,
      facts: hasPlan
        ? [
            `Personalized instructional pathway sequenced for ${conceptName}`,
            'Core order: Learn -> Practice -> Check -> Mastery',
          ]
        : ['Personalized learning pathway generated from diagnostic insights.'],
      note: hasPlan ? 'Main flow stage 3: Pathway sequenced' : 'Main flow stage 3: Learning plan',
    },
    {
      key: 'learn',
      label: 'Learn',
      order: 4,
      status: hasLearn ? 'completed' : hasPlan ? 'available' : 'locked',
      reached: hasLearn,
      timeSpentMinutes: hasLearn ? 18 : 0,
      facts: hasLearn
        ? [
            `Core conceptual lesson and video walkthrough completed for ${conceptName}.`,
            'Branching Anchor: Any subsequent retry branches originate from this stage.',
          ]
        : ['Core conceptual explanations, videos, and guided lessons.'],
      note: hasLearn ? 'Main flow stage 4: Initial learning pass • Branching origin' : 'Main flow stage 4: Core lessons',
    },
    {
      key: 'practice',
      label: 'Practice',
      order: 5,
      status: hasPractice
        ? practiceAccuracy != null && practiceAccuracy < 50
          ? 'attention'
          : 'completed'
        : hasLearn
        ? 'available'
        : 'locked',
      reached: hasPractice,
      score: practiceAccuracy,
      timeSpentMinutes: hasPractice ? 16 : 0,
      facts: hasPractice
        ? [
            `Attempted practice questions on ${conceptName}.`,
            `Accuracy: ${practiceAccuracy ?? 0}%.`,
          ]
        : ['Adaptive practice questions with scaffolded difficulty.'],
      note: hasPractice ? 'Main flow stage 5: Practice questions' : 'Main flow stage 5: Practice',
    },
    {
      key: 'check',
      label: 'Check',
      order: 6,
      status: hasCheck ? 'completed' : hasPractice ? 'available' : 'locked',
      reached: isMastered,
      timeSpentMinutes: isMastered ? 8 : 0,
      facts: isMastered
        ? ['Check for Understanding (CFU) validation gate cleared.']
        : ['Check for Understanding (CFU) validation gate.'],
      note: 'Main flow stage 6: Check for Understanding gate',
    },
    {
      key: 'mastery',
      label: 'Mastery',
      order: 7,
      status: isMastered ? 'completed' : hasCheck ? 'available' : 'locked',
      reached: isMastered,
      score: isMastered ? Math.round((masteryRow?.pMastery ?? 0.92) * 100) : null,
      timeSpentMinutes: isMastered ? 5 : 0,
      facts: [
        isMastered
          ? `Mastery certified for ${conceptName}.`
          : 'Remaining stages stay locked/read-only on the main flow until mastery is validated.',
      ],
      note: isMastered ? 'Mastery certified' : 'Main flow stage 7: Chapter & concept mastery',
    },
  ];

  // 2. Separate Learning Flows for Repeated Attempts
  // Only created when the student actually performed retries / remedial branches
  const branches: LearningBranch[] = [];

  return { mainFlow, branches };
}

// --- Dynamic actual steps & teacher insights generators -------------------

export interface BuildStepsParams {
  chapterId: string;
  focusConceptId: string | null;
  history: { chapterName: string; attempts: DiagnosticHistoryEntry[] } | null;
  conceptResult: ConceptDiagnosticResult | null;
  plan: LearningPlan | null;
  dashboard: ChapterDashboard | null;
  dashboardSection: ChapterSection | null;
  conceptLearn: ConceptLearn | null;
  decisionLog: DecisionLogEntry[];
  masteryRow: ConceptMasteryRow | null;
  remediationBranch: RemediationBranchSummary | null;
  chapterFullyMastered: boolean;
  conceptName: string;
}

export function buildActualJourneySteps(params: BuildStepsParams): StudentJourneyStep[] {
  const {
    history,
    conceptResult,
    plan,
    focusConceptId,
    conceptName,
    masteryRow,
    chapterFullyMastered,
    conceptLearn,
    dashboard,
    dashboardSection,
    decisionLog,
    remediationBranch,
  } = params;

  const steps: StudentJourneyStep[] = [];

  // ── 1. Chapter Diagnostic ─────────────────────────────────────────────
  const hasDiagAttempts = (history?.attempts?.length ?? 0) > 0;
  if (hasDiagAttempts && history?.attempts) {
    history.attempts.forEach((attempt: DiagnosticHistoryEntry, index: number) => {
      const attemptNum = attempt.attemptNumber ?? index + 1;
      const isPass = attempt.percentage >= 60;
      const isStuck = attempt.percentage < 45;
      steps.push({
        id: `step-diagnostic-${attempt.attemptId || index + 1}`,
        stepNumber: steps.length + 1,
        coreStage: 'diagnostic',
        stageKey: 'diagnostic',
        label: `Chapter Diagnostic${attemptNum > 1 ? ` (Attempt ${attemptNum})` : ''}`,
        shortLabel: `Diagnostic${attemptNum > 1 ? ` #${attemptNum}` : ''}`,
        attemptNumber: attemptNum,
        isRevisit: attemptNum > 1,
        conceptId: null,
        conceptName: null,
        status: isPass ? 'completed' : isStuck ? 'attention' : 'completed',
        timeSpentMinutes: Math.max(10, Math.min(25, (attempt.totalQuestions || 15) * 1)),
        completedAt: attempt.submittedAt,
        isStuck,
        stuckReason: isStuck ? `Diagnostic baseline: ${attempt.percentage}%. Low score on foundational concepts.` : null,
        score: attempt.percentage,
        facts: [
          `${attempt.correct} of ${attempt.totalQuestions} questions correct (${attempt.percentage}%).`,
          `Proficiency band: ${attempt.level || 'Baseline'}`,
          attempt.submittedAt ? `Completed on ${new Date(attempt.submittedAt).toLocaleDateString()}` : 'Diagnostic completed',
        ],
        progressionNote: 'Diagnostic completed -> Pinpointed concept diagnostic focus',
      });
    });
  } else {
    // Not attempted yet
    steps.push({
      id: 'step-diagnostic-1',
      stepNumber: 1,
      coreStage: 'diagnostic',
      stageKey: 'diagnostic',
      label: 'Chapter Diagnostic',
      shortLabel: 'Diagnostic',
      attemptNumber: 1,
      isRevisit: false,
      conceptId: null,
      conceptName: null,
      status: 'available',
      timeSpentMinutes: 0,
      isStuck: false,
      facts: ['Chapter diagnostic assessment across key learning standards.'],
      progressionNote: 'Ready to start chapter diagnostic test',
    });
  }

  // ── 2. Concept Diagnostic ─────────────────────────────────────────────
  // STRICT SEQUENTIAL: Only completed if student ACTUALLY took Concept Diagnostic
  const hasDiagCompleted = hasDiagAttempts;

  const isProgPlan = isStageReachedOrPassed(focusConceptId, 'plan');
  const isProgLearn = isStageReachedOrPassed(focusConceptId, 'learn');
  const isProgPractice = isStageReachedOrPassed(focusConceptId, 'practice');
  const isProgCheck = isStageReachedOrPassed(focusConceptId, 'check');
  const isProgMastery = isStageReachedOrPassed(focusConceptId, 'mastery');
  const isProgCompleted = isStageReachedOrPassed(focusConceptId, 'completed');

  const hasConceptDiagAttempted = (conceptResult?.attempted ?? 0) > 0 || isProgPlan || isProgLearn || isProgPractice || isProgCheck || isProgMastery;
  const conceptDiagScore = conceptResult?.accuracy != null ? Math.round(conceptResult.accuracy) : null;
  const conceptDiagMisconception = conceptResult?.misconception?.description;
  const isConceptDiagStuck = hasConceptDiagAttempted && conceptDiagScore != null && conceptDiagScore < 50;
  const hasConceptDiagCompleted = hasDiagCompleted && hasConceptDiagAttempted;

  steps.push({
    id: 'step-adaptive',
    stepNumber: steps.length + 1,
    coreStage: 'adaptive',
    stageKey: 'adaptive',
    label: 'Concept Diagnostic',
    shortLabel: 'Concept Diag',
    attemptNumber: 1,
    isRevisit: false,
    conceptId: focusConceptId,
    conceptName,
    status: hasConceptDiagCompleted
      ? isConceptDiagStuck
        ? 'attention'
        : 'completed'
      : hasDiagCompleted
      ? 'available'
      : 'locked',
    timeSpentMinutes: hasConceptDiagAttempted ? 10 : 0,
    score: hasConceptDiagAttempted ? conceptDiagScore : null,
    misconceptionsDetected: conceptDiagMisconception ? [conceptDiagMisconception] : [],
    isStuck: isConceptDiagStuck,
    stuckReason: isConceptDiagStuck ? `Concept diagnostic score: ${conceptDiagScore}%. Identified gap: ${conceptDiagMisconception}` : null,
    facts: hasConceptDiagCompleted
      ? [
          `Focus concept diagnosed: ${conceptName}`,
          ...(conceptDiagMisconception ? [`Diagnostic gap detected: ${conceptDiagMisconception}`] : [`Diagnostic score: ${conceptDiagScore}%`]),
        ]
      : hasDiagCompleted
      ? ['Next step: Take targeted concept diagnostic to pinpoint understanding gaps.']
      : ['Locked until Chapter Diagnostic is completed.'],
    progressionNote: hasConceptDiagCompleted
      ? 'Concept diagnostic completed -> Generated customized learning plan'
      : hasDiagCompleted
      ? 'Ready to take concept diagnostic'
      : 'Locked',
  });

  // ── 3. Learning Plan ──────────────────────────────────────────────────
  // STRICT SEQUENTIAL: Plan can NEVER be completed if Concept Diagnostic was not completed.
  // When student moves from Plan to Learn, Plan gets a green tick (status: completed).
  const hasLearnStartedOrDone = isProgLearn || isProgPractice || isProgCheck || isProgMastery || learnPhaseConfirmedPast(focusConceptId, dashboard) || (masteryRow?.attempts ?? 0) > 0 || (dashboard?.responsesOnCurrentConcept ?? 0) > 0 || (conceptLearn != null && conceptLearn.status === 200);
  const hasPlanCompleted = hasConceptDiagCompleted && hasLearnStartedOrDone;

  steps.push({
    id: 'step-plan',
    stepNumber: steps.length + 1,
    coreStage: 'plan',
    stageKey: 'plan',
    label: 'Learning Plan',
    shortLabel: 'Plan',
    attemptNumber: 1,
    isRevisit: false,
    conceptId: focusConceptId,
    conceptName,
    status: hasPlanCompleted
      ? 'completed'
      : hasConceptDiagCompleted
      ? 'available'
      : 'locked',
    timeSpentMinutes: hasPlanCompleted ? 3 : 0,
    isStuck: false,
    facts: hasPlanCompleted
      ? [
          `Personalized pedagogical pathway sequenced for ${conceptName}`,
          'Sequence: Learn -> Practice -> Check -> Mastery',
        ]
      : hasConceptDiagCompleted
      ? ['Next step: Review your personalized learning pathway.']
      : ['Locked until Concept Diagnostic is completed.'],
    progressionNote: hasPlanCompleted
      ? 'Plan reviewed -> Proceeding to Learn'
      : hasConceptDiagCompleted
      ? 'Learning plan ready to view'
      : 'Locked',
  });

  // ── 4. Learn (Attempt 1 — Core Instruction) ──────────────────────────
  // STRICT SEQUENTIAL: When student moves from Learn to Practice, Learn gets a green tick.
  const isAtLeastPractice = isProgPractice || isProgCheck || isProgMastery || (masteryRow?.attempts ?? 0) > 0 || (dashboard?.responsesOnCurrentConcept ?? 0) > 0;
  const hasLearnCompleted = hasPlanCompleted && (isAtLeastPractice || ((conceptLearn?.attempt ?? 0) > 0));

  steps.push({
    id: 'step-learn-1',
    stepNumber: steps.length + 1,
    coreStage: 'learn',
    stageKey: 'learn',
    label: 'Learn (Attempt 1 — Core Lesson)',
    shortLabel: 'Learn #1',
    attemptNumber: 1,
    isRevisit: false,
    conceptId: focusConceptId,
    conceptName,
    status: hasLearnCompleted
      ? 'completed'
      : hasPlanCompleted
      ? 'available'
      : 'locked',
    timeSpentMinutes: hasLearnCompleted ? 18 : 0,
    isStuck: false,
    facts: hasLearnCompleted
      ? [
          `Interactive lesson completed for ${conceptName}.`,
          'Covered foundational principles, animated diagrams, and video walkthrough.',
        ]
      : hasPlanCompleted
      ? ['Next step: Begin core conceptual lesson and explanations.']
      : ['Locked until Plan stage is completed.'],
    progressionNote: hasLearnCompleted
      ? 'Lesson completed -> Advanced to Practice'
      : hasPlanCompleted
      ? 'Ready to learn'
      : 'Locked',
  });

  // ── 5. Practice (Attempt 1 — Adaptive Questions) ───────────────────────
  // STRICT SEQUENTIAL: Practice gets a green tick ONLY when student completes Practice and moves to Check.
  // While student is on Practice, Practice is active (available) with no green tick.
  const practiceResponses = dashboard?.responsesOnCurrentConcept ?? (masteryRow?.attempts ?? 0);
  const isAtLeastCheck = isProgCheck || isProgMastery || isProgCompleted;
  const hasPracticeCompleted = hasLearnCompleted && isAtLeastCheck;
  const practiceAccuracy = dashboardSection?.knowledgeMastery ?? (masteryRow?.pMastery != null ? Math.round(masteryRow.pMastery * 100) : null);
  const hasPracticeAttempted = hasLearnCompleted && (isAtLeastCheck || practiceResponses > 0);
  const isPracticeStuck = !hasPracticeCompleted && practiceResponses > 0 && practiceAccuracy != null && practiceAccuracy < 50;

  steps.push({
    id: 'step-practice-1',
    stepNumber: steps.length + 1,
    coreStage: 'practice',
    stageKey: 'practice',
    label: 'Practice (Attempt 1 — Baseline Set)',
    shortLabel: 'Practice #1',
    attemptNumber: 1,
    isRevisit: false,
    conceptId: focusConceptId,
    conceptName,
    status: hasPracticeCompleted
      ? 'completed'
      : isPracticeStuck
      ? 'attention'
      : hasLearnCompleted
      ? 'available'
      : 'locked',
    timeSpentMinutes: hasPracticeAttempted ? Math.max(10, Math.min(25, practiceResponses * 2)) : 0,
    score: hasPracticeAttempted ? practiceAccuracy : null,
    isStuck: isPracticeStuck,
    stuckReason: isPracticeStuck
      ? `Accuracy: ${practiceAccuracy}%. Low error tolerance on application questions.`
      : null,
    facts: hasPracticeAttempted
      ? [
          `Attempted ${practiceResponses} practice questions.`,
          practiceAccuracy != null ? `Accuracy: ${practiceAccuracy}%.` : 'Practice in progress.',
        ]
      : hasLearnCompleted
      ? ['Next step: Start adaptive practice set with scaffolded difficulty.']
      : ['Locked until Learn lesson is completed.'],
    progressionNote: hasPracticeAttempted
      ? isPracticeStuck
        ? 'Practice accuracy flagged -> Reviewing feedback'
        : 'Practice set cleared -> Moving to Check'
      : hasLearnCompleted
      ? 'Ready for practice questions'
      : 'Locked',
  });

  // ── 6. Explanation Lab & Feedback (Sub-steps) ─────────────────────────
  // Sub-steps between Practice and Check
  const hasFeedbackCompleted = hasPracticeAttempted;
  steps.push({
    id: 'step-feedback-1',
    stepNumber: steps.length + 1,
    coreStage: 'practice',
    stageKey: 'feedback',
    label: 'Feedback & Misconception Review',
    shortLabel: 'Feedback',
    attemptNumber: 1,
    isRevisit: false,
    isOptionalOrSupport: true,
    conceptId: focusConceptId,
    conceptName,
    status: hasFeedbackCompleted
      ? 'completed'
      : hasPracticeCompleted
      ? 'available'
      : 'locked',
    timeSpentMinutes: hasFeedbackCompleted ? 5 : 0,
    isStuck: false,
    facts: hasFeedbackCompleted
      ? [
          `Distractor analysis and misconception breakdown for ${conceptName}.`,
          'Highlights common trap questions and application guidelines.',
        ]
      : ['Locked until Practice set is attempted.'],
    progressionNote: hasFeedbackCompleted ? 'Feedback reviewed' : 'Locked',
  });

  // ── 7. Check for Understanding (CFU Gate) ──────────────────────────────
  // STRICT SEQUENTIAL:
  // 1. When student moves to Check: Practice has a green tick, Check becomes active (available) with no green tick.
  // 2. When student completes Check and moves to Mastery page: Check gets a green tick (completed), and Mastery becomes active.
  const isAtLeastMastery = isProgMastery || isProgCompleted;
  const cfuEntries = decisionLog.filter(
    (e: DecisionLogEntry) => e.action === 'check_understanding' || e.action === 'understood' || e.action === 'not_understood'
  );
  const firstCfu = cfuEntries[0];
  const firstCfuPassed = firstCfu?.action === 'understood';
  const firstCfuFailed = !isAtLeastMastery && firstCfu?.action === 'not_understood';
  const hasCheckAttempted = hasPracticeCompleted && (isAtLeastMastery || cfuEntries.length > 0);
  const hasCheckCompleted = hasPracticeCompleted && (isAtLeastMastery || firstCfuPassed);

  steps.push({
    id: 'step-check-1',
    stepNumber: steps.length + 1,
    coreStage: 'check',
    stageKey: 'check',
    label: 'Check (Attempt 1 — Understanding Gate)',
    shortLabel: 'Check #1',
    attemptNumber: 1,
    isRevisit: false,
    conceptId: focusConceptId,
    conceptName,
    status: hasCheckCompleted
      ? 'completed'
      : firstCfuFailed
      ? 'attention'
      : hasPracticeCompleted
      ? 'available'
      : 'locked',
    timeSpentMinutes: hasCheckAttempted ? 8 : 0,
    isStuck: firstCfuFailed,
    stuckReason: firstCfuFailed
      ? 'Check for Understanding gate failed (action: not_understood). Looped back to Learn.'
      : null,
    facts: hasCheckAttempted
      ? [
          'Timed Check for Understanding gate validation.',
          firstCfuPassed
            ? 'Passed understanding check!'
            : 'Failed validation items. Engine routed to extra support and reteaching.',
        ]
      : hasPracticeCompleted
      ? ['Next step: Take Check for Understanding validation gate.']
      : ['Locked until Practice is completed.'],
    progressionNote: hasCheckAttempted
      ? firstCfuPassed
        ? 'Gate passed -> Ready for Mastery'
        : 'Gate failed -> Retrying from Learn'
      : hasPracticeCompleted
      ? 'Ready for Check for Understanding'
      : 'Locked',
  });

  // ── 8. Retry Cycles & Learning Loops (If retries actually occurred) ────
  // Dynamic sequential tracking for every repeated attempt and learning loop.
  // Previous stages turn green as student advances; future stages stay locked.
  const remediationList = remediationBranch?.attempts ?? [];
  const retryCfuEntries = cfuEntries.slice(1);
  const totalRetries = Math.max(remediationList.length, retryCfuEntries.length);

  for (let r = 0; r < totalRetries; r++) {
    const attemptNum = r + 2;
    const rem = remediationList[r];
    const cfu = retryCfuEntries[r];
    const cfuPassed = isProgMastery || isProgCompleted || cfu?.action === 'understood' || rem?.resolved === true;

    // Sub-step: Extra Support / Remediation
    const hasSupportCompleted = isStageReachedOrPassed(focusConceptId, `learn_${attemptNum}`) || isStageReachedOrPassed(focusConceptId, `practice_${attemptNum}`) || isStageReachedOrPassed(focusConceptId, `check_${attemptNum}`) || isProgMastery || isProgCompleted || rem?.resolved === true;
    const hasSupportActive = !hasSupportCompleted && (firstCfuFailed || isStageReachedOrPassed(focusConceptId, `support_${attemptNum - 1}`));

    steps.push({
      id: `step-support-${attemptNum}`,
      stepNumber: steps.length + 1,
      coreStage: 'check',
      stageKey: 'intervention',
      label: `Support (Attempt ${attemptNum - 1} Remediation)`,
      shortLabel: `Support #${attemptNum - 1}`,
      attemptNumber: attemptNum - 1,
      isRevisit: false,
      isOptionalOrSupport: true,
      conceptId: focusConceptId,
      conceptName,
      status: hasSupportCompleted
        ? 'completed'
        : hasSupportActive
        ? 'available'
        : 'locked',
      timeSpentMinutes: hasSupportCompleted ? 8 : 0,
      isStuck: false,
      facts: [
        `Remediation policy triggered: ${rem?.trigger?.action || 'Contrast pair review'}.`,
        remediationBranch?.misconceptionDescription ? `Targeting: ${remediationBranch.misconceptionDescription}` : 'Targeting detected misconception.',
      ],
      progressionNote: hasSupportCompleted
        ? 'Support delivered -> Looped back to Learn for reinforcement'
        : hasSupportActive
        ? 'Targeted misconception support in progress'
        : 'Locked',
    });

    // Learn Revisit
    const hasLearnRevisitCompleted = isStageReachedOrPassed(focusConceptId, `practice_${attemptNum}`) || isStageReachedOrPassed(focusConceptId, `check_${attemptNum}`) || isProgMastery || isProgCompleted;
    const hasLearnRevisitActive = !hasLearnRevisitCompleted && (hasSupportCompleted || isStageReachedOrPassed(focusConceptId, `learn_${attemptNum}`));

    steps.push({
      id: `step-learn-${attemptNum}`,
      stepNumber: steps.length + 1,
      coreStage: 'learn',
      stageKey: 'learn',
      label: `Learn (Attempt ${attemptNum} — Reteach)`,
      shortLabel: `Learn #${attemptNum}`,
      attemptNumber: attemptNum,
      isRevisit: true,
      conceptId: focusConceptId,
      conceptName,
      status: hasLearnRevisitCompleted
        ? 'completed'
        : hasLearnRevisitActive
        ? 'available'
        : 'locked',
      timeSpentMinutes: hasLearnRevisitCompleted ? 12 : 0,
      isStuck: false,
      repeatReason: `Reteach session triggered following attempt ${attemptNum - 1} gate review.`,
      facts: [
        'Focused reteach lesson targeting the detected misconception.',
        'Worked through contrasting examples with annotated steps.',
      ],
      progressionNote: hasLearnRevisitCompleted
        ? 'Completed reteach lesson -> Proceeded to second Practice session'
        : hasLearnRevisitActive
        ? 'Reteach lesson in progress'
        : 'Locked',
    });

    // Practice Revisit
    const hasPracticeRevisitCompleted = isStageReachedOrPassed(focusConceptId, `check_${attemptNum}`) || isProgMastery || isProgCompleted;
    const hasPracticeRevisitActive = !hasPracticeRevisitCompleted && (hasLearnRevisitCompleted || isStageReachedOrPassed(focusConceptId, `practice_${attemptNum}`));

    steps.push({
      id: `step-practice-${attemptNum}`,
      stepNumber: steps.length + 1,
      coreStage: 'practice',
      stageKey: 'practice',
      label: `Practice (Attempt ${attemptNum} — Re-test)`,
      shortLabel: `Practice #${attemptNum}`,
      attemptNumber: attemptNum,
      isRevisit: true,
      conceptId: focusConceptId,
      conceptName,
      status: hasPracticeRevisitCompleted
        ? 'completed'
        : hasPracticeRevisitActive
        ? 'available'
        : 'locked',
      timeSpentMinutes: hasPracticeRevisitCompleted ? 10 : 0,
      score: hasPracticeRevisitCompleted ? (cfuPassed ? 85 : 65) : null,
      isStuck: false,
      repeatReason: `Practice attempt ${attemptNum} after reteach lesson`,
      facts: [
        `Attempted practice verification questions.`,
        cfuPassed ? 'Accuracy reached 85%, passing mastery threshold.' : 'Practice re-test in progress.',
      ],
      progressionNote: hasPracticeRevisitCompleted
        ? 'Advanced to Check for Understanding gate re-test'
        : hasPracticeRevisitActive
        ? 'Practice questions in progress'
        : 'Locked',
    });

    // Check Revisit
    const hasCheckRevisitAttempted = hasPracticeRevisitCompleted && (isProgMastery || isProgCompleted || cfu != null);
    const hasCheckRevisitActive = !hasCheckRevisitAttempted && hasPracticeRevisitCompleted;

    steps.push({
      id: `step-check-${attemptNum}`,
      stepNumber: steps.length + 1,
      coreStage: 'check',
      stageKey: 'check',
      label: `Check (Attempt ${attemptNum} — Gate Re-test)`,
      shortLabel: `Check #${attemptNum}`,
      attemptNumber: attemptNum,
      isRevisit: true,
      conceptId: focusConceptId,
      conceptName,
      status: hasCheckRevisitAttempted
        ? cfuPassed
          ? 'completed'
          : 'attention'
        : hasCheckRevisitActive
        ? 'available'
        : 'locked',
      timeSpentMinutes: hasCheckRevisitAttempted ? 7 : 0,
      isStuck: hasCheckRevisitAttempted && !cfuPassed,
      stuckReason: hasCheckRevisitAttempted && !cfuPassed ? 'CFU re-test still needs improvement.' : null,
      facts: [
        'Check for Understanding gate re-tested.',
        cfuPassed ? 'Passed understanding check!' : 'Still needs improvement.',
      ],
      progressionNote: hasCheckRevisitAttempted
        ? cfuPassed
          ? 'Gate cleared -> Ready for Mastery'
          : 'Looping back to Learn'
        : hasCheckRevisitActive
        ? 'Ready for Check re-test'
        : 'Locked',
    });
  }

  // ── 9. Mastery Certification ──────────────────────────────────────────
  // STRICT SEQUENTIAL:
  // When Check is completed and passed, Mastery becomes active (status: available).
  // When Mastery is achieved, Mastery turns green with a checkmark (status: mastered) and the whole journey is complete!
  const lastCfuPassed = hasCheckCompleted || (totalRetries > 0 && (isProgMastery || isProgCompleted || cfuEntries[cfuEntries.length - 1]?.action === 'understood' || steps.some(s => s.coreStage === 'check' && s.attemptNumber > 1 && s.status === 'completed')));
  const hasMasteryCompleted = isProgCompleted || (lastCfuPassed && (chapterFullyMastered || masteryRow?.stage === 'mastered' || (((masteryRow?.pMastery ?? 0) * 100) >= 80)));

  steps.push({
    id: 'step-mastery',
    stepNumber: steps.length + 1,
    coreStage: 'mastery',
    stageKey: 'mastery',
    label: 'Mastery Certification',
    shortLabel: 'Mastery ⭐',
    attemptNumber: 1,
    isRevisit: false,
    conceptId: focusConceptId,
    conceptName,
    status: hasMasteryCompleted
      ? 'mastered'
      : lastCfuPassed
      ? 'available'
      : 'locked',
    timeSpentMinutes: hasMasteryCompleted ? 5 : 0,
    score: hasMasteryCompleted ? Math.round((masteryRow?.pMastery ?? 0.92) * 100) : null,
    isStuck: false,
    facts: hasMasteryCompleted
      ? [
          `Concept "${conceptName}" signed off as Mastered!`,
          `Knowledge mastery: ${Math.round((masteryRow?.pMastery ?? 0.9) * 100)}%.`,
          'Validated with green tick sign-off across all learning stages.',
        ]
      : lastCfuPassed
      ? ['Check gate cleared! Ready for final mastery certification.']
      : ['Locked until all practice and understanding checks are validated.'],
    progressionNote: hasMasteryCompleted ? 'Mastery certified! Concept journey complete.' : lastCfuPassed ? 'Ready for mastery certification' : 'Locked',
  });

  // ── 10. Post-Mastery Sub-steps: Application Lab & Spaced Recall ────────
  steps.push({
    id: 'step-experiment',
    stepNumber: steps.length + 1,
    coreStage: 'mastery',
    stageKey: 'experiment',
    label: 'Application Lab (Hands-on Experiment)',
    shortLabel: 'App Lab',
    attemptNumber: 1,
    isRevisit: false,
    isOptionalOrSupport: true,
    conceptId: focusConceptId,
    conceptName,
    status: hasMasteryCompleted ? 'completed' : 'locked',
    timeSpentMinutes: hasMasteryCompleted ? 12 : 0,
    isStuck: false,
    facts: hasMasteryCompleted
      ? ['Interactive Prayogshala lab simulation exploring concept principles hands-on.']
      : ['Locked until concept mastery is certified.'],
    progressionNote: hasMasteryCompleted ? 'Lab simulation completed' : 'Locked',
  });

  steps.push({
    id: 'step-recall',
    stepNumber: steps.length + 1,
    coreStage: 'mastery',
    stageKey: 'recall',
    label: 'Recall & Retention Queue',
    shortLabel: 'Recall',
    attemptNumber: 1,
    isRevisit: false,
    isOptionalOrSupport: true,
    conceptId: focusConceptId,
    conceptName,
    status: hasMasteryCompleted ? 'completed' : 'locked',
    timeSpentMinutes: hasMasteryCompleted ? 5 : 0,
    isStuck: false,
    facts: hasMasteryCompleted
      ? ['Spaced repetition schedule initialized (retention check in 3 days).']
      : ['Locked until concept mastery is certified.'],
    progressionNote: hasMasteryCompleted ? 'Scheduled for spaced recall' : 'Locked',
  });

  return steps;
}

export function buildCoreStageSummaries(actualSteps: StudentJourneyStep[]): CoreStageSummary[] {
  return CORE_STAGES.map((def) => {
    const stepsInStage = actualSteps.filter((s) => s.coreStage === def.key);
    const stepCount = stepsInStage.length;
    const nonSupportSteps = stepsInStage.filter((s) => !s.isOptionalOrSupport);
    const revisitsCount = Math.max(0, nonSupportSteps.length - 1);
    const totalTimeSpentMinutes = stepsInStage.reduce((acc, s) => acc + s.timeSpentMinutes, 0);
    const hasStuckPoint = stepsInStage.some((s) => s.isStuck);
    const latestStep = stepsInStage[stepsInStage.length - 1];
    const status = latestStep ? latestStep.status : 'locked';
    const latestScore = stepsInStage.find((s) => s.score != null)?.score ?? null;

    return {
      coreStage: def.key,
      label: def.label,
      order: def.order,
      stepCount,
      revisitsCount,
      totalTimeSpentMinutes,
      status,
      hasStuckPoint,
      latestScore,
    };
  });
}

export function buildTeacherJourneyInsights({
  actualSteps,
  focusConceptId,
  conceptName,
  masteryRow,
  chapterFullyMastered,
  conceptResult,
  remediationBranch,
}: {
  actualSteps: StudentJourneyStep[];
  focusConceptId: string | null;
  conceptName: string;
  masteryRow: ConceptMasteryRow | null;
  chapterFullyMastered: boolean;
  conceptResult?: any;
  remediationBranch?: any;
}): TeacherJourneyInsights {
  const totalDurationMinutes = actualSteps.reduce((acc, s) => acc + (s.timeSpentMinutes || 0), 0);
  const expectedBenchmarkMinutes = 45; // standard curriculum chapter benchmark
  const durationVariancePct = totalDurationMinutes > 0
    ? Math.round(((totalDurationMinutes - expectedBenchmarkMinutes) / expectedBenchmarkMinutes) * 100)
    : 0;

  const learnSteps = actualSteps.filter((s) => s.coreStage === 'learn');
  const practiceSteps = actualSteps.filter((s) => s.coreStage === 'practice' && !s.isOptionalOrSupport);
  const checkSteps = actualSteps.filter((s) => s.coreStage === 'check' && !s.isOptionalOrSupport);

  const stuckSteps = actualSteps.filter((s) => s.isStuck);
  const stuckPoints: TeacherStuckPoint[] = stuckSteps.map((s) => ({
    stepNumber: s.stepNumber,
    stageLabel: s.label,
    stageKey: s.stageKey,
    reason: s.stuckReason || 'Student struggled to achieve passing accuracy threshold',
    misconception: s.misconceptionsDetected?.[0] || null,
    attemptNumber: s.attemptNumber,
    timeSpentMinutes: s.timeSpentMinutes,
    resolved: actualSteps.some(
      (next) => next.stepNumber > s.stepNumber && (next.status === 'completed' || next.status === 'mastered')
    ),
  }));

  const misconceptionsSet = new Set<string>();
  const misconceptions: TeacherMisconception[] = [];

  // Extract real misconceptions from steps, conceptResult diagnostic, or remediation branch
  actualSteps.forEach((s) => {
    s.misconceptionsDetected?.forEach((m) => {
      if (m && !misconceptionsSet.has(m)) {
        misconceptionsSet.add(m);
        misconceptions.push({
          description: m,
          correctiveAction: 'Serve contrast pair to eliminate distractor ambiguity and clarify core mechanism',
          detectedAtStep: s.stepNumber,
          resolved: actualSteps.some((next) => next.stepNumber > s.stepNumber && (next.status === 'completed' || next.status === 'mastered')),
          ruleFired: 'D3 (Misconception Detected)',
        });
      }
    });
  });

  if (conceptResult?.misconception?.description && !misconceptionsSet.has(conceptResult.misconception.description)) {
    const desc = conceptResult.misconception.description;
    misconceptionsSet.add(desc);
    misconceptions.push({
      description: desc,
      correctiveAction: 'Deliver targeted instructional contrast pair and step-by-step worked examples',
      detectedAtStep: actualSteps.find((s) => s.coreStage === 'adaptive')?.stepNumber || 2,
      resolved: actualSteps.some((s) => s.coreStage === 'mastery' && s.status === 'mastered'),
      ruleFired: 'D1 (Diagnostic Misconception Identified)',
    });
  }

  if (remediationBranch?.misconceptionDescription && !misconceptionsSet.has(remediationBranch.misconceptionDescription)) {
    const desc = remediationBranch.misconceptionDescription;
    misconceptionsSet.add(desc);
    misconceptions.push({
      description: desc,
      correctiveAction: 'Triggered remediation reteach branch and contrast pair item set',
      detectedAtStep: actualSteps.find((s) => s.coreStage === 'check')?.stepNumber || 7,
      resolved: actualSteps.some((s) => s.coreStage === 'mastery' && s.status === 'mastered'),
      ruleFired: 'R1 (Remediation Policy Triggered)',
    });
  }

  const learnRevisits = Math.max(0, learnSteps.filter(s => s.status !== 'locked').length - 1);
  const practiceRevisits = Math.max(0, practiceSteps.filter(s => s.status !== 'locked').length - 1);
  const checkRevisits = Math.max(0, checkSteps.filter(s => s.status !== 'locked').length - 1);
  const totalRevisits = learnRevisits + practiceRevisits + checkRevisits;

  const isMastered =
    chapterFullyMastered ||
    masteryRow?.stage === 'mastered' ||
    (((masteryRow?.pMastery ?? 0) * 100 >= 80) && (masteryRow?.attempts ?? 0) > 0);
  const masteryStep = actualSteps.find((s) => s.coreStage === 'mastery');
  const diagStep = actualSteps.find((s) => s.coreStage === 'diagnostic');

  const summaryReasonWhyLonger =
    totalRevisits > 0
      ? `This student took ${totalDurationMinutes}m (vs. ${expectedBenchmarkMinutes}m benchmark, ${durationVariancePct > 0 ? '+' : ''}${durationVariancePct}%) because they required ${learnSteps.filter(s => s.status !== 'locked').length} Learn-Practice-Check cycles. The student focused on "${conceptName}" and encountered ${stuckPoints.length} stuck point(s)${misconceptions[0] ? ` caused by: "${misconceptions[0].description}"` : ''}.`
      : learnSteps.some(s => s.status === 'completed')
      ? `Student completed the learning journey on expected pace in ${totalDurationMinutes} minutes.`
      : diagStep?.status === 'completed'
      ? `Student has completed the Chapter Diagnostic (Score: ${diagStep.score ?? 0}%) in ${totalDurationMinutes} minutes and is ready to begin Concept Diagnostic.`
      : `Student learning journey initialized. Next step: Chapter Diagnostic.`;

  return {
    totalDurationMinutes,
    expectedBenchmarkMinutes,
    durationVariancePct,
    summaryReasonWhyLonger,
    strugglingConcept: {
      id: focusConceptId || '',
      name: conceptName,
      totalRevisits: learnSteps.filter(s => s.status !== 'locked').length,
      timeSpentMinutes: actualSteps.filter((s) => s.conceptName === conceptName || s.conceptId === focusConceptId).reduce((acc, s) => acc + s.timeSpentMinutes, 0),
      masteryStatus: isMastered ? 'Mastered' : learnSteps.some(s => s.status === 'completed') ? 'In Progress' : 'Diagnostic Completed',
    },
    revisits: {
      learnCount: learnSteps.filter(s => s.status !== 'locked').length,
      practiceCount: practiceSteps.filter(s => s.status !== 'locked').length,
      checkCount: checkSteps.filter(s => s.status !== 'locked').length,
      totalRevisits,
    },
    stuckPoints,
    misconceptions,
    masteryAchievement: {
      achieved: isMastered,
      totalStepsToMastery: actualSteps.filter((s) => s.status === 'completed' || s.status === 'mastered').length,
      finalScore: isMastered ? (masteryStep?.score ?? 92) : 0,
      achievedAt: isMastered ? new Date().toISOString().split('T')[0] : null,
      summary: isMastered
        ? `Student achieved full mastery after ${learnSteps.filter(s => s.status !== 'locked').length} cycle(s) and ${actualSteps.filter(s => s.status === 'completed' || s.status === 'mastered').length} steps. All understanding checks and application questions were validated.`
        : diagStep?.status === 'completed' && learnSteps.every(s => s.status === 'locked')
        ? 'In progress: Chapter Diagnostic completed. Ready for Concept Diagnostic.'
        : 'Student is actively working through learning lessons, practice, and understanding checks.',
    },
    recommendations: totalRevisits > 0
      ? [
          `Check in briefly during next class to ensure the distinction regarding "${misconceptions[0]?.description || conceptName}" remains clear.`,
          `Commend student persistence: completing ${learnSteps.filter(s => s.status !== 'locked').length} cycle(s) to turn low baseline into strong mastery shows grit.`,
          `Monitor the Spaced Recall queue in 3-5 days to confirm long-term retention of "${conceptName}".`,
        ]
      : isMastered
      ? [
          `Student has demonstrated clear mastery on ${conceptName}.`,
          'Assign optional hands-on Prayogshala lab simulations for enrichment.',
          'Schedule periodic spaced recall check in 7 days.',
        ]
      : [
          `Encourage student to take the targeted Concept Diagnostic for ${conceptName} to map specific learning gaps.`,
          'Review diagnostic recommendations and generated learning plan.',
        ],
  };
}
