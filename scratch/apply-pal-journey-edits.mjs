import fs from 'fs';

const filePath = 'app/pal/journey/data/pal-journey.ts';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add import for isStageReachedOrPassed
if (!content.includes("from '@/app/pal/data/pal-progression'")) {
  content = content.replace(
    "import { JOURNEY_STAGES, JOURNEY_STAGE_BY_KEY, type JourneyStageKey } from '@/app/pal/_components/journey-stages';",
    "import { JOURNEY_STAGES, JOURNEY_STAGE_BY_KEY, type JourneyStageKey } from '@/app/pal/_components/journey-stages';\nimport { isStageReachedOrPassed } from '@/app/pal/data/pal-progression';"
  );
}

// 2. In fetchJourneyData (around line 1060):
const oldFetchFlags = `  const hasDiagCompleted = (history?.attempts?.length ?? 0) > 0;
  const hasConceptDiagCompleted = hasDiagCompleted && (conceptResult?.attempted ?? 0) > 0;
  const hasLearnStartedOrDone = learnPhaseConfirmedPast(focusConceptId, dashboard) || (dashboardSection?.attempts ?? 0) > 0 || (conceptLearn?.acknowledged === true);
  const hasPlanCompleted = hasConceptDiagCompleted && hasLearnStartedOrDone;`;

const newFetchFlags = `  const hasDiagCompleted = (history?.attempts?.length ?? 0) > 0;
  const isProgPlan = isStageReachedOrPassed(focusConceptId, 'plan');
  const isProgLearn = isStageReachedOrPassed(focusConceptId, 'learn');
  const isProgPractice = isStageReachedOrPassed(focusConceptId, 'practice');
  const isProgCheck = isStageReachedOrPassed(focusConceptId, 'check');
  const isProgMastery = isStageReachedOrPassed(focusConceptId, 'mastery');

  const hasConceptDiagCompleted = hasDiagCompleted && ((conceptResult?.attempted ?? 0) > 0 || isProgPlan || isProgLearn || isProgPractice || isProgCheck || isProgMastery);
  const hasLearnStartedOrDone = isProgLearn || isProgPractice || isProgCheck || isProgMastery || learnPhaseConfirmedPast(focusConceptId, dashboard) || (dashboardSection?.attempts ?? 0) > 0 || (conceptLearn?.acknowledged === true);
  const hasPlanCompleted = hasConceptDiagCompleted && hasLearnStartedOrDone;`;

content = content.replace(oldFetchFlags, newFetchFlags);

// 3. In buildMainFlowAndBranches (around line 1260):
const oldMainFlowFlags = `  const {
    history,
    conceptResult,
    plan,
    dashboardSection,
    conceptName,
    masteryRow,
    chapterFullyMastered,
  } = params;

  const defaultMisconception =
    conceptResult?.misconception?.description ||
    'Confused core reaction mechanism with ambient conditions';

  const hasDiagAttempts = (history?.attempts?.length ?? 0) > 0;
  const diagScore = history?.attempts[0]?.percentage ?? null;
  const hasConceptDiag = (conceptResult?.attempted ?? 0) > 0;
  const hasPlan = plan != null && (plan.steps?.length ?? 0) > 0;
  const hasLearn = (dashboardSection?.attempts ?? 0) > 0 || (masteryRow?.attempts ?? 0) > 0;
  const hasPractice = (dashboardSection?.attempts ?? 0) > 0;
  const practiceAccuracy = dashboardSection?.knowledgeMastery ?? null;
  const isMastered =
    chapterFullyMastered ||
    masteryRow?.stage === 'mastered' ||
    ((masteryRow?.knowledgeMastery ?? 0) >= 80 && (masteryRow?.attempts ?? 0) > 0);`;

const newMainFlowFlags = `  const {
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

  const hasConceptDiag = hasDiagAttempts && ((conceptResult?.attempted ?? 0) > 0 || isProgPlan || isProgLearn || isProgPractice || isProgCheck || isProgMastery);
  const isAtLeastLearn = isProgLearn || isProgPractice || isProgCheck || isProgMastery || (dashboardSection?.attempts ?? 0) > 0 || (masteryRow?.attempts ?? 0) > 0;
  const hasPlan = hasConceptDiag && isAtLeastLearn;
  const isAtLeastPractice = isProgPractice || isProgCheck || isProgMastery || (dashboardSection?.attempts ?? 0) > 0;
  const hasLearn = hasPlan && isAtLeastPractice;
  const isAtLeastCheck = isProgCheck || isProgMastery;
  const hasPractice = hasLearn && (isAtLeastCheck || (dashboardSection?.attempts ?? 0) > 0);
  const practiceAccuracy = dashboardSection?.knowledgeMastery ?? null;
  const isMastered =
    chapterFullyMastered ||
    masteryRow?.stage === 'mastered' ||
    isProgMastery ||
    ((masteryRow?.knowledgeMastery ?? 0) >= 80 && (masteryRow?.attempts ?? 0) > 0);`;

content = content.replace(oldMainFlowFlags, newMainFlowFlags);

// 4. In buildActualJourneySteps:
const oldActualStepsLogic = `  // ── 2. Concept Diagnostic ─────────────────────────────────────────────
  // STRICT SEQUENTIAL: Only completed if student ACTUALLY took Concept Diagnostic
  const hasDiagCompleted = hasDiagAttempts;
  const hasConceptDiagAttempted = (conceptResult?.attempted ?? 0) > 0;
  const conceptDiagScore = conceptResult?.score ?? null;
  const conceptDiagMisconception = conceptResult?.misconception?.description;
  const isConceptDiagStuck = hasConceptDiagAttempted && (conceptResult?.score ?? 0) < 50;
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
    stuckReason: isConceptDiagStuck ? \`Concept diagnostic score: \${conceptDiagScore}%. Identified gap: \${conceptDiagMisconception}\` : null,
    facts: hasConceptDiagCompleted
      ? [
          \`Focus concept diagnosed: \${conceptName}\`,
          ...(conceptDiagMisconception ? [\`Diagnostic gap detected: \${conceptDiagMisconception}\`] : [\`Diagnostic score: \${conceptDiagScore}%\`]),
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
  const hasLearnStartedOrDone = (dashboardSection?.attempts ?? 0) > 0 || (dashboard?.responsesOnCurrentConcept ?? 0) > 0 || conceptLearn?.acknowledged === true;
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
          \`Personalized pedagogical pathway sequenced for \${conceptName}\`,
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
  // STRICT SEQUENTIAL: Learn can only be completed if Plan was reached and student learned.
  const hasLearnCompleted = hasPlanCompleted && hasLearnStartedOrDone;

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
          \`Interactive lesson completed for \${conceptName}.\`,
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
  // STRICT SEQUENTIAL: Practice can only be completed if Learn was completed and student answered questions.
  const practiceResponses = dashboard?.responsesOnCurrentConcept ?? dashboardSection?.attempts ?? 0;
  const hasPracticeAttempted = hasLearnCompleted && practiceResponses > 0;
  const practiceAccuracy = dashboard?.accuracy ?? dashboardSection?.knowledgeMastery ?? null;
  const isPracticeStuck = hasPracticeAttempted && practiceAccuracy != null && practiceAccuracy < 50;
  const hasPracticeCompleted = hasPracticeAttempted && (practiceAccuracy == null || practiceAccuracy >= 50);`;

const newActualStepsLogic = `  // ── 2. Concept Diagnostic ─────────────────────────────────────────────
  // STRICT SEQUENTIAL: Only completed if student ACTUALLY took Concept Diagnostic
  const hasDiagCompleted = hasDiagAttempts;

  const isProgPlan = isStageReachedOrPassed(focusConceptId, 'plan');
  const isProgLearn = isStageReachedOrPassed(focusConceptId, 'learn');
  const isProgPractice = isStageReachedOrPassed(focusConceptId, 'practice');
  const isProgCheck = isStageReachedOrPassed(focusConceptId, 'check');
  const isProgMastery = isStageReachedOrPassed(focusConceptId, 'mastery');

  const hasConceptDiagAttempted = (conceptResult?.attempted ?? 0) > 0 || isProgPlan || isProgLearn || isProgPractice || isProgCheck || isProgMastery;
  const conceptDiagScore = conceptResult?.score ?? null;
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
    stuckReason: isConceptDiagStuck ? \`Concept diagnostic score: \${conceptDiagScore}%. Identified gap: \${conceptDiagMisconception}\` : null,
    facts: hasConceptDiagCompleted
      ? [
          \`Focus concept diagnosed: \${conceptName}\`,
          ...(conceptDiagMisconception ? [\`Diagnostic gap detected: \${conceptDiagMisconception}\`] : [\`Diagnostic score: \${conceptDiagScore}%\`]),
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
  const hasLearnStartedOrDone = isProgLearn || isProgPractice || isProgCheck || isProgMastery || learnPhaseConfirmedPast(focusConceptId, dashboard) || (dashboardSection?.attempts ?? 0) > 0 || (dashboard?.responsesOnCurrentConcept ?? 0) > 0 || conceptLearn?.acknowledged === true;
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
          \`Personalized pedagogical pathway sequenced for \${conceptName}\`,
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
  const isAtLeastPractice = isProgPractice || isProgCheck || isProgMastery || (dashboardSection?.attempts ?? 0) > 0 || (dashboard?.responsesOnCurrentConcept ?? 0) > 0;
  const hasLearnCompleted = hasPlanCompleted && (isAtLeastPractice || conceptLearn?.acknowledged === true);

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
          \`Interactive lesson completed for \${conceptName}.\`,
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
  // STRICT SEQUENTIAL: When student moves from Practice to Check, Practice gets a green tick.
  const practiceResponses = dashboard?.responsesOnCurrentConcept ?? dashboardSection?.attempts ?? 0;
  const isAtLeastCheck = isProgCheck || isProgMastery;
  const hasPracticeAttempted = hasLearnCompleted && (isAtLeastCheck || practiceResponses > 0);
  const practiceAccuracy = dashboard?.accuracy ?? dashboardSection?.knowledgeMastery ?? null;
  const isPracticeStuck = hasPracticeAttempted && practiceAccuracy != null && practiceAccuracy < 50;
  const hasPracticeCompleted = hasPracticeAttempted && (isAtLeastCheck || (practiceAccuracy == null || practiceAccuracy >= 50));`;

content = content.replace(oldActualStepsLogic, newActualStepsLogic);

// 5. In Check (around line 1700):
const oldCheckLogic = `  const cfuEntries = decisionLog.filter(
    (e) => e.action === 'check_understanding' || e.action === 'understood' || e.action === 'not_understood'
  );
  const hasCheckAttempted = hasPracticeCompleted && cfuEntries.length > 0;
  const firstCfu = cfuEntries[0];
  const firstCfuPassed = firstCfu?.action === 'understood';
  const firstCfuFailed = firstCfu?.action === 'not_understood';`;

const newCheckLogic = `  const cfuEntries = decisionLog.filter(
    (e) => e.action === 'check_understanding' || e.action === 'understood' || e.action === 'not_understood'
  );
  const hasCheckAttempted = hasPracticeCompleted && (isProgMastery || cfuEntries.length > 0);
  const firstCfu = cfuEntries[0];
  const firstCfuPassed = isProgMastery || firstCfu?.action === 'understood';
  const firstCfuFailed = !isProgMastery && firstCfu?.action === 'not_understood';`;

content = content.replace(oldCheckLogic, newCheckLogic);

// 6. In Mastery (around line 1840):
const oldMasteryLogic = `  const lastCfuPassed = hasCheckAttempted && (cfuEntries[cfuEntries.length - 1]?.action === 'understood' || (totalRetries > 0 && steps[steps.length - 1]?.status === 'completed'));
  const hasMasteryCompleted = lastCfuPassed && (chapterFullyMastered || masteryRow?.stage === 'mastered' || (masteryRow?.knowledgeMastery ?? 0) >= 80);`;

const newMasteryLogic = `  const lastCfuPassed = hasCheckAttempted && (isProgMastery || cfuEntries[cfuEntries.length - 1]?.action === 'understood' || (totalRetries > 0 && steps[steps.length - 1]?.status === 'completed'));
  const hasMasteryCompleted = lastCfuPassed && (isProgMastery || chapterFullyMastered || masteryRow?.stage === 'mastered' || (masteryRow?.knowledgeMastery ?? 0) >= 80);`;

content = content.replace(oldMasteryLogic, newMasteryLogic);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated pal-journey.ts');

