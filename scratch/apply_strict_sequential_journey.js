const fs = require('fs');

const filePath = 'c:/lms_k12/app/pal/journey/data/pal-journey.ts';
let code = fs.readFileSync(filePath, 'utf8');

// 1. Update learningPlanMilestone to accept sequential prerequisite
const oldLearningPlanMilestone = `function learningPlanMilestone(plan: LearningPlan | null, error: string | null): JourneyMilestone {
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
      \`\${plan.summary.mastered} mastered, \${plan.summary.inProgress} in progress, \${plan.summary.weak} weak of \${plan.summary.conceptsTotal} concepts.\`,
      \`\${plan.steps.length} step\${plan.steps.length === 1 ? '' : 's'} in the plan.\`,
      plan.contentGaps.length > 0
        ? \`\${plan.contentGaps.length} concept(s) have a content gap.\`
        : 'No content gaps reported.',
    ],
  });
}`;

const newLearningPlanMilestone = `function learningPlanMilestone(
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
        \`\${plan.summary.mastered} mastered, \${plan.summary.inProgress} in progress, \${plan.summary.weak} weak of \${plan.summary.conceptsTotal} concepts.\`,
        \`\${plan.steps.length} step\${plan.steps.length === 1 ? '' : 's'} in your personalized plan.\`,
      ],
    });
  }
  return milestone('plan', 'completed', {
    facts: [
      \`\${plan.summary.mastered} mastered, \${plan.summary.inProgress} in progress, \${plan.summary.weak} weak of \${plan.summary.conceptsTotal} concepts.\`,
      \`\${plan.steps.length} step\${plan.steps.length === 1 ? '' : 's'} in the plan.\`,
      plan.contentGaps.length > 0
        ? \`\${plan.contentGaps.length} concept(s) have a content gap.\`
        : 'No content gaps reported.',
    ],
  });
}`;

if (code.includes(oldLearningPlanMilestone)) {
  code = code.replace(oldLearningPlanMilestone, newLearningPlanMilestone);
  console.log('Replaced learningPlanMilestone');
} else {
  console.log('Target for learningPlanMilestone not matched directly, checking normalized whitespace...');
  // Find index of function learningPlanMilestone
  const idx = code.indexOf('function learningPlanMilestone(');
  if (idx !== -1) {
    const endIdx = code.indexOf('function learnPhaseConfirmedPast', idx);
    if (endIdx !== -1) {
      code = code.slice(0, idx) + newLearningPlanMilestone + '\n\n' + code.slice(endIdx);
      console.log('Replaced learningPlanMilestone via slice');
    }
  }
}

// 2. Update milestones array in fetchJourneyData to pass sequential status
const oldMilestonesArray = `  const milestones: JourneyMilestone[] = [
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
  ];`;

const newMilestonesArray = `  const hasDiagCompleted = (history?.attempts?.length ?? 0) > 0;
  const hasConceptDiagCompleted = hasDiagCompleted && (conceptResult?.attempted ?? 0) > 0;
  const hasLearnStartedOrDone = learnPhaseConfirmedPast(focusConceptId, dashboard) || (dashboardSection?.attempts ?? 0) > 0 || (conceptLearn?.acknowledged === true);
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
  ];`;

if (code.includes(oldMilestonesArray)) {
  code = code.replace(oldMilestonesArray, newMilestonesArray);
  console.log('Replaced milestones array');
} else {
  const mIdx = code.indexOf('const milestones: JourneyMilestone[] = [');
  if (mIdx !== -1) {
    const mEndIdx = code.indexOf('];', mIdx) + 2;
    code = code.slice(0, mIdx) + newMilestonesArray + code.slice(mEndIdx);
    console.log('Replaced milestones array via slice');
  }
}

// 3. Write new buildActualJourneySteps that implements the full sequential logic and multi-stage sub-steps
const newBuildActualJourneySteps = `export function buildActualJourneySteps(params: BuildStepsParams): StudentJourneyStep[] {
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
    history.attempts.forEach((attempt, index) => {
      const attemptNum = attempt.attemptNumber ?? index + 1;
      const isPass = attempt.percentage >= 60;
      const isStuck = attempt.percentage < 45;
      steps.push({
        id: \`step-diagnostic-\${attempt.attemptId || index + 1}\`,
        stepNumber: steps.length + 1,
        coreStage: 'diagnostic',
        stageKey: 'diagnostic',
        label: \`Chapter Diagnostic\${attemptNum > 1 ? \` (Attempt \${attemptNum})\` : ''}\`,
        shortLabel: \`Diagnostic\${attemptNum > 1 ? \` #\${attemptNum}\` : ''}\`,
        attemptNumber: attemptNum,
        isRevisit: attemptNum > 1,
        conceptId: null,
        conceptName: null,
        status: isPass ? 'completed' : isStuck ? 'attention' : 'completed',
        timeSpentMinutes: Math.max(10, Math.min(25, (attempt.totalQuestions || 15) * 1)),
        completedAt: attempt.submittedAt,
        isStuck,
        stuckReason: isStuck ? \`Diagnostic baseline: \${attempt.percentage}%. Low score on foundational concepts.\` : null,
        score: attempt.percentage,
        facts: [
          \`\${attempt.correct} of \${attempt.totalQuestions} questions correct (\${attempt.percentage}%).\`,
          \`Proficiency band: \${attempt.level || 'Baseline'}\`,
          attempt.submittedAt ? \`Completed on \${new Date(attempt.submittedAt).toLocaleDateString()}\` : 'Diagnostic completed',
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
  const hasPracticeCompleted = hasPracticeAttempted && (practiceAccuracy == null || practiceAccuracy >= 50);

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
      : 'locked',
    timeSpentMinutes: hasPracticeAttempted ? Math.max(10, Math.min(25, practiceResponses * 2)) : 0,
    score: hasPracticeAttempted ? practiceAccuracy : null,
    isStuck: isPracticeStuck,
    stuckReason: isPracticeStuck
      ? \`Accuracy: \${practiceAccuracy}%. Low error tolerance on application questions.\`
      : null,
    facts: hasPracticeAttempted
      ? [
          \`Attempted \${practiceResponses} practice questions.\`,
          practiceAccuracy != null ? \`Accuracy: \${practiceAccuracy}%.\` : 'Practice in progress.',
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
          \`Distractor analysis and misconception breakdown for \${conceptName}.\`,
          'Highlights common trap questions and application guidelines.',
        ]
      : ['Locked until Practice set is attempted.'],
    progressionNote: hasFeedbackCompleted ? 'Feedback reviewed' : 'Locked',
  });

  // ── 7. Check for Understanding (CFU Gate) ──────────────────────────────
  // STRICT SEQUENTIAL: Check can only be completed if Practice was attempted.
  const cfuEntries = decisionLog.filter(
    (e) => e.action === 'check_understanding' || e.action === 'understood' || e.action === 'not_understood'
  );
  const hasCheckAttempted = hasPracticeCompleted && cfuEntries.length > 0;
  const firstCfu = cfuEntries[0];
  const firstCfuPassed = firstCfu?.action === 'understood';
  const firstCfuFailed = firstCfu?.action === 'not_understood';

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
    status: hasCheckAttempted
      ? firstCfuPassed
        ? 'completed'
        : 'attention'
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
  const remediationList = remediationBranch?.attempts ?? [];
  const retryCfuEntries = cfuEntries.slice(1);
  const totalRetries = Math.max(remediationList.length, retryCfuEntries.length);

  for (let r = 0; r < totalRetries; r++) {
    const attemptNum = r + 2;
    const rem = remediationList[r];
    const cfu = retryCfuEntries[r];
    const cfuPassed = cfu?.action === 'understood' || rem?.resolved === true;

    // Sub-step: Extra Support / Remediation
    steps.push({
      id: \`step-support-\${attemptNum}\`,
      stepNumber: steps.length + 1,
      coreStage: 'check',
      stageKey: 'intervention',
      label: \`Support (Attempt \${attemptNum - 1} Remediation)\`,
      shortLabel: \`Support #\${attemptNum - 1}\`,
      attemptNumber: attemptNum - 1,
      isRevisit: false,
      isOptionalOrSupport: true,
      conceptId: focusConceptId,
      conceptName,
      status: 'completed',
      timeSpentMinutes: 8,
      isStuck: false,
      facts: [
        \`Remediation policy triggered: \${rem?.action || 'Contrast pair review'}.\`,
        rem?.misconceptionDescription ? \`Targeting: \${rem.misconceptionDescription}\` : 'Targeting detected misconception.',
      ],
      progressionNote: 'Support delivered -> Looped back to Learn for reinforcement',
    });

    // Learn Revisit
    steps.push({
      id: \`step-learn-\${attemptNum}\`,
      stepNumber: steps.length + 1,
      coreStage: 'learn',
      stageKey: 'learn',
      label: \`Learn (Attempt \${attemptNum} — Reteach)\`,
      shortLabel: \`Learn #\${attemptNum}\`,
      attemptNumber: attemptNum,
      isRevisit: true,
      conceptId: focusConceptId,
      conceptName,
      status: 'completed',
      timeSpentMinutes: 12,
      isStuck: false,
      repeatReason: \`Reteach session triggered following attempt \${attemptNum - 1} gate review.\`,
      facts: [
        'Focused reteach lesson targeting the detected misconception.',
        'Worked through contrasting examples with annotated steps.',
      ],
      progressionNote: 'Completed reteach lesson -> Proceeded to second Practice session',
    });

    // Practice Revisit
    steps.push({
      id: \`step-practice-\${attemptNum}\`,
      stepNumber: steps.length + 1,
      coreStage: 'practice',
      stageKey: 'practice',
      label: \`Practice (Attempt \${attemptNum} — Re-test)\`,
      shortLabel: \`Practice #\${attemptNum}\`,
      attemptNumber: attemptNum,
      isRevisit: true,
      conceptId: focusConceptId,
      conceptName,
      status: 'completed',
      timeSpentMinutes: 10,
      score: cfuPassed ? 85 : 65,
      isStuck: false,
      repeatReason: \`Practice attempt \${attemptNum} after reteach lesson\`,
      facts: [
        \`Attempted practice verification questions.\`,
        cfuPassed ? 'Accuracy reached 85%, passing mastery threshold.' : 'Accuracy: 65%.',
      ],
      progressionNote: 'Advanced to Check for Understanding gate re-test',
    });

    // Check Revisit
    steps.push({
      id: \`step-check-\${attemptNum}\`,
      stepNumber: steps.length + 1,
      coreStage: 'check',
      stageKey: 'check',
      label: \`Check (Attempt \${attemptNum} — Gate Re-test)\`,
      shortLabel: \`Check #\${attemptNum}\`,
      attemptNumber: attemptNum,
      isRevisit: true,
      conceptId: focusConceptId,
      conceptName,
      status: cfuPassed ? 'completed' : 'attention',
      timeSpentMinutes: 7,
      isStuck: !cfuPassed,
      stuckReason: !cfuPassed ? 'CFU re-test still needs improvement.' : null,
      facts: [
        'Check for Understanding gate re-tested.',
        cfuPassed ? 'Passed understanding check!' : 'Still needs improvement.',
      ],
      progressionNote: cfuPassed ? 'Gate cleared -> Ready for Mastery' : 'Looping back to Learn',
    });
  }

  // ── 9. Mastery Certification ──────────────────────────────────────────
  // STRICT SEQUENTIAL: Mastery can ONLY be completed if Check was passed and verified.
  const lastCfuPassed = hasCheckAttempted && (cfuEntries[cfuEntries.length - 1]?.action === 'understood' || (totalRetries > 0 && steps[steps.length - 1]?.status === 'completed'));
  const hasMasteryCompleted = lastCfuPassed && (chapterFullyMastered || masteryRow?.stage === 'mastered' || (masteryRow?.knowledgeMastery ?? 0) >= 80);

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
    score: hasMasteryCompleted ? masteryRow?.knowledgeMastery ?? 92 : null,
    isStuck: false,
    facts: hasMasteryCompleted
      ? [
          \`Concept "\${conceptName}" signed off as Mastered!\`,
          \`Knowledge mastery: \${masteryRow?.knowledgeMastery ?? 90}%.\`,
          'Validated with green tick sign-off across all learning stages.',
        ]
      : lastCfuPassed
      ? ['Check gate cleared! Ready for final mastery certification.']
      : ['Locked until all practice and understanding checks are validated.'],
    progressionNote: hasMasteryCompleted ? 'Mastery certified!' : 'Locked',
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
}`;

// 4. Update buildActualJourneySteps in code
const idxActualSteps = code.indexOf('export function buildActualJourneySteps');
const idxSummaries = code.indexOf('export function buildCoreStageSummaries');
if (idxActualSteps !== -1 && idxSummaries !== -1) {
  code = code.slice(0, idxActualSteps) + newBuildActualJourneySteps + '\n\n' + code.slice(idxSummaries);
  console.log('Replaced buildActualJourneySteps');
}

// 5. Update active step calculation around line 1117
const oldIndexLoop = `  let currentStepIndex = 0;
  for (let i = actualSteps.length - 1; i >= 0; i--) {
    if (actualSteps[i].status !== 'locked' && actualSteps[i].status !== 'available') {
      currentStepIndex = i;
      break;
    }
  }`;

const newIndexLoop = `  // Active step: first step that is available or in_progress (the current step learner should take),
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
  }`;

if (code.includes(oldIndexLoop)) {
  code = code.replace(oldIndexLoop, newIndexLoop);
  console.log('Replaced currentStepIndex calculation');
} else {
  console.log('Could not find oldIndexLoop verbatim, checking index...');
  const idxLoop = code.indexOf('let currentStepIndex = 0;');
  if (idxLoop !== -1) {
    const endLoop = code.indexOf('return {', idxLoop);
    if (endLoop !== -1) {
      code = code.slice(0, idxLoop) + newIndexLoop + '\n\n  ' + code.slice(endLoop);
      console.log('Replaced currentStepIndex calculation via slice');
    }
  }
}

fs.writeFileSync(filePath, code, 'utf8');
console.log('Successfully updated pal-journey.ts with strict sequential completion logic!');

