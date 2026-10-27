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

export interface JourneyData {
  chapterId: string;
  chapterName: string | null;
  /** The ESO-ready concept driving most of the 12 stages. Null when the chapter has none — the expected state for ~99% of chapters today. */
  focusConceptId: string | null;
  /** Always exactly 12, in JOURNEY_STAGES order. */
  milestones: JourneyMilestone[];
  /** False means nothing has ever been attempted on this chapter — EmptyChapterState's condition, not an error. */
  hasAnyActivity: boolean;
  /** Null when remediation has never been triggered for this concept — true for most concepts. See `RemediationBranchSummary`. */
  remediationBranch: RemediationBranchSummary | null;
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

function learningPlanMilestone(plan: LearningPlan | null, error: string | null): JourneyMilestone {
  if (error) {
    return milestone('plan', 'locked', { available: false, error });
  }
  if (!plan || !plan.readiness.esoAvailable || plan.summary.conceptsServable === 0) {
    return milestone('plan', 'locked', {
      available: false,
      unavailableReason: 'No plan can be built yet — no concept in this chapter has servable questions.',
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
  asStudentId?: string
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
    concepts[0]?.id != null ? String(concepts[0].id) : plan?.concepts.find((c) => c.esoReady)?.conceptId ?? null;

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

  const milestones: JourneyMilestone[] = [
    chapterDiagnosticMilestone(history, settledError(historyR)),
    conceptDiagnosticMilestone(focusConceptId, conceptResult, conceptResultError),
    learningPlanMilestone(plan, settledError(planR)),
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

  return {
    chapterId,
    chapterName: history?.chapterName || plan?.chapterName || mastery?.chapterName || null,
    focusConceptId,
    milestones,
    hasAnyActivity,
    remediationBranch,
  };
}
