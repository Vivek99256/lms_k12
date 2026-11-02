import fs from 'fs';

const filePath = 'app/pal/journey/data/pal-journey.ts';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update buildMainFlowAndBranches
const oldMainFlowDef = `  const isProgPlan = isStageReachedOrPassed(focusConceptId, 'plan');
  const isProgLearn = isStageReachedOrPassed(focusConceptId, 'learn');
  const isProgPractice = isStageReachedOrPassed(focusConceptId, 'practice');
  const isProgCheck = isStageReachedOrPassed(focusConceptId, 'check');
  const isProgMastery = isStageReachedOrPassed(focusConceptId, 'mastery');

  const hasConceptDiag = hasDiagAttempts && ((conceptResult?.attempted ?? 0) > 0 || isProgPlan || isProgLearn || isProgPractice || isProgCheck || isProgMastery);
  const isAtLeastLearn = isProgLearn || isProgPractice || isProgCheck || isProgMastery || (masteryRow?.attempts ?? 0) > 0;
  const hasPlan = hasConceptDiag && isAtLeastLearn;
  const isAtLeastPractice = isProgPractice || isProgCheck || isProgMastery || (masteryRow?.attempts ?? 0) > 0;
  const hasLearn = hasPlan && isAtLeastPractice;
  const isAtLeastCheck = isProgCheck || isProgMastery;
  const hasPractice = hasLearn && (isAtLeastCheck || (masteryRow?.attempts ?? 0) > 0);
  const practiceAccuracy = dashboardSection?.knowledgeMastery ?? null;
  const isMastered =
    chapterFullyMastered ||
    masteryRow?.stage === 'mastered' ||
    isProgMastery ||
    (((masteryRow?.pMastery ?? 0) * 100 >= 80) && (masteryRow?.attempts ?? 0) > 0);`;

const newMainFlowDef = `  const isProgPlan = isStageReachedOrPassed(focusConceptId, 'plan');
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
    ));`;

content = content.replace(oldMainFlowDef, newMainFlowDef);

// Also in mainFlow array:
content = content.replace(
  "      status: isMastered ? 'completed' : hasPractice ? 'available' : 'locked',",
  "      status: hasCheck ? 'completed' : hasPractice ? 'available' : 'locked',"
);

content = content.replace(
  "      status: isMastered ? 'completed' : 'locked',",
  "      status: isMastered ? 'completed' : hasCheck ? 'available' : 'locked',"
);

// 2. In buildActualJourneySteps:
const oldActualStepsPractice = `  // ── 5. Practice (Attempt 1 — Adaptive Questions) ───────────────────────
  // STRICT SEQUENTIAL: When student moves from Practice to Check, Practice gets a green tick.
  const practiceResponses = dashboard?.responsesOnCurrentConcept ?? (masteryRow?.attempts ?? 0);
  const isAtLeastCheck = isProgCheck || isProgMastery;
  const hasPracticeAttempted = hasLearnCompleted && (isAtLeastCheck || practiceResponses > 0);
  const practiceAccuracy = dashboardSection?.knowledgeMastery ?? (masteryRow?.pMastery != null ? Math.round(masteryRow.pMastery * 100) : null);
  const isPracticeStuck = hasPracticeAttempted && practiceAccuracy != null && practiceAccuracy < 50;
  const hasPracticeCompleted = hasPracticeAttempted && (isAtLeastCheck || (practiceAccuracy == null || practiceAccuracy >= 50));

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
    status: hasPracticeAttempted
      ? isPracticeStuck
        ? 'attention'
        : 'completed'
      : hasLearnCompleted
      ? 'available'
      : 'locked',`;

const newActualStepsPractice = `  // ── 5. Practice (Attempt 1 — Adaptive Questions) ───────────────────────
  // STRICT SEQUENTIAL: Practice gets a green tick ONLY when student completes Practice and moves to Check.
  // While student is on Practice, Practice is active (available) with no green tick.
  const practiceResponses = dashboard?.responsesOnCurrentConcept ?? (masteryRow?.attempts ?? 0);
  const isAtLeastCheck = isProgCheck || isProgMastery || isProgCompleted;
  const hasPracticeCompleted = hasLearnCompleted && isAtLeastCheck;
  const practiceAccuracy = dashboardSection?.knowledgeMastery ?? (masteryRow?.pMastery != null ? Math.round(masteryRow.pMastery * 100) : null);
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
      : 'locked',`;

content = content.replace(oldActualStepsPractice, newActualStepsPractice);

// 3. In Check and Mastery:
const oldCheckAndMastery = `  // ── 7. Check for Understanding (CFU Gate) ──────────────────────────────
  // STRICT SEQUENTIAL: Check can only be completed if Practice was attempted.
  // When Check is completed and passed, Check turns green (status: completed) and Mastery becomes active.
  const isProgCompleted = isStageReachedOrPassed(focusConceptId, 'completed');
  const cfuEntries = decisionLog.filter(
    (e: DecisionLogEntry) => e.action === 'check_understanding' || e.action === 'understood' || e.action === 'not_understood'
  );
  const hasCheckAttempted = hasPracticeCompleted && (isProgMastery || isProgCompleted || cfuEntries.length > 0);
  const firstCfu = cfuEntries[0];
  const firstCfuPassed = isProgMastery || isProgCompleted || firstCfu?.action === 'understood';
  const firstCfuFailed = !isProgMastery && !isProgCompleted && firstCfu?.action === 'not_understood';
  const hasCheckCompleted = hasPracticeCompleted && firstCfuPassed;

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
      : 'locked',`;

const newCheckAndMastery = `  // ── 7. Check for Understanding (CFU Gate) ──────────────────────────────
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
      : 'locked',`;

content = content.replace(oldCheckAndMastery, newCheckAndMastery);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated sequential Check and Mastery logic in pal-journey.ts');

