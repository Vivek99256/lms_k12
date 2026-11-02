const fs = require('fs');

const filePath = 'c:/lms_k12/app/pal/journey/data/pal-journey.ts';
let code = fs.readFileSync(filePath, 'utf8');

// Replacement for buildMainFlowAndBranches
const newBuildMainFlowAndBranches = `export function buildMainFlowAndBranches(params: BuildMainFlowAndBranchesParams): {
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
    ((masteryRow?.knowledgeMastery ?? 0) >= 80 && (masteryRow?.attempts ?? 0) > 0);

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
            \`\${history?.attempts[0]?.totalQuestions ?? 15} questions across chapter completed.\`,
            \`Baseline score: \${diagScore}%.\`,
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
      score: hasConceptDiag ? conceptResult?.score ?? 55 : null,
      timeSpentMinutes: hasConceptDiag ? 10 : 0,
      facts: hasConceptDiag
        ? [
            \`Pinpointed focus concept: \${conceptName}\`,
            \`Identified diagnostic gap: \${defaultMisconception}\`,
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
            \`Personalized instructional pathway sequenced for \${conceptName}\`,
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
            \`Core conceptual lesson and video walkthrough completed for \${conceptName}.\`,
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
            \`Attempted practice questions on \${conceptName}.\`,
            \`Accuracy: \${practiceAccuracy ?? 0}%.\`,
          ]
        : ['Adaptive practice questions with scaffolded difficulty.'],
      note: hasPractice ? 'Main flow stage 5: Practice questions' : 'Main flow stage 5: Practice',
    },
    {
      key: 'check',
      label: 'Check',
      order: 6,
      status: isMastered ? 'completed' : hasPractice ? 'available' : 'locked',
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
      status: isMastered ? 'completed' : 'locked',
      reached: isMastered,
      score: isMastered ? masteryRow?.knowledgeMastery ?? 92 : null,
      timeSpentMinutes: isMastered ? 5 : 0,
      facts: [
        isMastered
          ? \`Mastery certified for \${conceptName}.\`
          : 'Remaining stages stay locked/read-only on the main flow until mastery is validated.',
      ],
      note: isMastered ? 'Mastery certified' : 'Main flow stage 7: Chapter & concept mastery',
    },
  ];

  // 2. Separate Learning Flows for Repeated Attempts
  // Only created when the student actually performed retries / remedial branches
  const branches: LearningBranch[] = [];

  return { mainFlow, branches };
}`;

// Replacement for buildActualJourneySteps
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

  // 1. Chapter Diagnostic
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
        status: isPass ? 'completed' : 'attention',
        timeSpentMinutes: Math.max(10, Math.min(25, (attempt.totalQuestions || 15) * 1)),
        completedAt: attempt.submittedAt,
        isStuck,
        stuckReason: isStuck ? \`Low diagnostic baseline (\${attempt.percentage}%). Prerequisite gaps flagged.\` : null,
        score: attempt.percentage,
        facts: [
          \`\${attempt.correct} of \${attempt.totalQuestions} questions correct (\${attempt.percentage}%).\`,
          \`Proficiency band: \${attempt.level}\`,
          attempt.submittedAt ? \`Completed: \${new Date(attempt.submittedAt).toLocaleDateString()}\` : 'Completed',
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
      facts: ['Chapter diagnostic assessment to establish learning baseline.'],
      progressionNote: 'Ready to start chapter diagnostic test',
    });
  }

  // 2. Concept Diagnostic
  const hasConceptDiag = (conceptResult?.attempted ?? 0) > 0;
  const conceptDiagMisconception = conceptResult?.misconception?.description;
  const isConceptDiagStuck = hasConceptDiag && (conceptResult?.score ?? 0) < 50;
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
    status: hasConceptDiag
      ? (conceptResult?.score ?? 0) >= 60
        ? 'completed'
        : 'attention'
      : hasDiagAttempts
      ? 'available'
      : 'locked',
    timeSpentMinutes: hasConceptDiag ? 10 : 0,
    score: hasConceptDiag ? conceptResult?.score : null,
    misconceptionsDetected: conceptDiagMisconception ? [conceptDiagMisconception] : [],
    isStuck: isConceptDiagStuck,
    stuckReason: isConceptDiagStuck ? \`Diagnostic score: \${conceptResult?.score}%. Found misconception: \${conceptDiagMisconception}\` : null,
    facts: hasConceptDiag
      ? [
          \`Focus concept identified: \${conceptName}\`,
          ...(conceptDiagMisconception ? [\`Diagnostic gap detected: \${conceptDiagMisconception}\`] : [\`Diagnostic score: \${conceptResult?.score}%\`]),
        ]
      : hasDiagAttempts
      ? ['Next step: Take targeted concept diagnostic to map understanding gaps.']
      : ['Locked until Chapter Diagnostic is completed.'],
    progressionNote: hasConceptDiag
      ? 'Concept diagnostic completed -> Generated customized learning plan'
      : hasDiagAttempts
      ? 'Ready to pinpoint concept-level gaps'
      : 'Locked',
  });

  // 3. Plan
  const hasPlan = plan != null && (plan.steps?.length ?? 0) > 0;
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
    status: hasPlan
      ? 'completed'
      : hasConceptDiag
      ? 'available'
      : 'locked',
    timeSpentMinutes: hasPlan ? 3 : 0,
    isStuck: false,
    facts: hasPlan
      ? [
          \`Personalized pedagogical pathway for \${conceptName}\`,
          'Sequence: Learn -> Practice -> Check -> Mastery',
        ]
      : hasConceptDiag
      ? ['Next step: Review your personalized learning path.']
      : ['Locked until Concept Diagnostic is completed.'],
    progressionNote: hasPlan
      ? 'Plan ready -> Proceed to Learn'
      : 'Locked',
  });

  // 4. Learn (Attempt 1)
  const hasLearn =
    conceptLearn?.acknowledged === true ||
    (dashboard?.responsesOnCurrentConcept ?? 0) > 0 ||
    (dashboardSection?.attempts ?? 0) > 0 ||
    (masteryRow?.attempts ?? 0) > 0;

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
    status: hasLearn
      ? 'completed'
      : hasPlan
      ? 'available'
      : 'locked',
    timeSpentMinutes: hasLearn ? 18 : 0,
    isStuck: false,
    facts: hasLearn
      ? [
          \`Interactive lesson for \${conceptName}.\`,
          'Covered foundational principles, animated diagrams, and video walkthrough.',
        ]
      : hasPlan
      ? ['Next step: Begin foundational lesson and core explanations.']
      : ['Locked until Plan is generated.'],
    progressionNote: hasLearn
      ? 'Lesson completed -> Advanced to Practice set'
      : 'Locked',
  });

  // 5. Practice (Attempt 1)
  const practiceResponses = dashboard?.responsesOnCurrentConcept ?? dashboardSection?.attempts ?? 0;
  const hasPractice = practiceResponses > 0;
  const practiceAccuracy = dashboard?.accuracy ?? dashboardSection?.knowledgeMastery ?? null;
  const isPracticeStuck = hasPractice && practiceAccuracy != null && practiceAccuracy < 50;

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
    status: hasPractice
      ? isPracticeStuck
        ? 'attention'
        : 'completed'
      : hasLearn
      ? 'available'
      : 'locked',
    timeSpentMinutes: hasPractice ? Math.max(10, Math.min(25, practiceResponses * 2)) : 0,
    score: hasPractice ? practiceAccuracy : null,
    isStuck: isPracticeStuck,
    stuckReason: isPracticeStuck
      ? \`Struggled with application questions (accuracy: \${practiceAccuracy}%). High error rate.\`
      : null,
    facts: hasPractice
      ? [
          \`Attempted \${practiceResponses} practice questions.\`,
          practiceAccuracy != null ? \`Accuracy: \${practiceAccuracy}%.\` : 'Practice in progress.',
        ]
      : hasLearn
      ? ['Next step: Start adaptive practice questions.']
      : ['Locked until Learn lesson is completed.'],
    progressionNote: hasPractice
      ? isPracticeStuck
        ? 'Low accuracy flagged by engine -> Triggered review'
        : 'Practice set cleared -> Advanced to Check'
      : 'Locked',
  });

  // 6. Check for Understanding (Attempt 1)
  const cfuEntries = decisionLog.filter(
    (e) => e.action === 'check_understanding' || e.action === 'understood' || e.action === 'not_understood'
  );
  const hasCheck = cfuEntries.length > 0;
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
    status: hasCheck
      ? firstCfuPassed
        ? 'completed'
        : 'attention'
      : hasPractice
      ? 'available'
      : 'locked',
    timeSpentMinutes: hasCheck ? 8 : 0,
    isStuck: firstCfuFailed,
    stuckReason: firstCfuFailed
      ? 'Check for Understanding gate failed (action: not_understood). Looped back to Learn.'
      : null,
    facts: hasCheck
      ? [
          'Check for Understanding gate validation.',
          firstCfuPassed
            ? 'Passed understanding check!'
            : 'Struggled on validation questions. Engine routed back to Learn.',
        ]
      : hasPractice
      ? ['Next step: Take Check for Understanding gate.']
      : ['Locked until Practice is completed.'],
    progressionNote: hasCheck
      ? firstCfuPassed
        ? 'Gate passed -> Proceed to Mastery'
        : 'Gate failed -> Retrying from Learn'
      : 'Locked',
  });

  // ── RETRY CYCLES & LEARNING BRANCHES (ONLY IF REAL RETRIES EXIST) ──────
  const remediationList = remediationBranch?.attempts ?? [];
  const retryCfuEntries = cfuEntries.slice(1);
  const totalRetries = Math.max(remediationList.length, retryCfuEntries.length);

  for (let r = 0; r < totalRetries; r++) {
    const attemptNum = r + 2;
    const rem = remediationList[r];
    const cfu = retryCfuEntries[r];
    const cfuPassed = cfu?.action === 'understood' || rem?.resolved === true;

    // Optional supportive step: Feedback or Support
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

  // 7. Mastery
  const isMastered =
    chapterFullyMastered ||
    masteryRow?.stage === 'mastered' ||
    ((masteryRow?.knowledgeMastery ?? 0) >= 80 && (hasCheck ? (cfuEntries[cfuEntries.length - 1]?.action === 'understood' || totalRetries > 0) : false));

  const lastCheckDone = hasCheck && (cfuEntries[cfuEntries.length - 1]?.action === 'understood' || (totalRetries > 0 && steps[steps.length - 1]?.status === 'completed'));

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
    status: isMastered ? 'mastered' : lastCheckDone ? 'available' : 'locked',
    timeSpentMinutes: isMastered ? 5 : 0,
    score: isMastered ? masteryRow?.knowledgeMastery ?? 92 : null,
    isStuck: false,
    facts: isMastered
      ? [
          \`Concept "\${conceptName}" signed off as Mastered!\`,
          \`Knowledge mastery: \${masteryRow?.knowledgeMastery ?? 90}%.\`,
          'Validated with green tick sign-off across learning journey.',
        ]
      : ['Locked until all understanding checks and practice thresholds are validated.'],
    progressionNote: isMastered
      ? 'Mastery certified!'
      : 'Locked',
  });

  return steps;
}`;

// Replacement for buildTeacherJourneyInsights
const newBuildTeacherJourneyInsights = `export function buildTeacherJourneyInsights({
  actualSteps,
  focusConceptId,
  conceptName,
  masteryRow,
  chapterFullyMastered,
}: {
  actualSteps: StudentJourneyStep[];
  focusConceptId: string | null;
  conceptName: string;
  masteryRow: ConceptMasteryRow | null;
  chapterFullyMastered: boolean;
}): TeacherJourneyInsights {
  const totalDurationMinutes = actualSteps.reduce((acc, s) => acc + (s.timeSpentMinutes || 0), 0);
  const expectedBenchmarkMinutes = 45; // standard curriculum chapter benchmark
  const durationVariancePct = Math.round(((totalDurationMinutes - expectedBenchmarkMinutes) / expectedBenchmarkMinutes) * 100);

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
  actualSteps.forEach((s) => {
    s.misconceptionsDetected?.forEach((m) => {
      if (!misconceptionsSet.has(m)) {
        misconceptionsSet.add(m);
        misconceptions.push({
          description: m,
          correctiveAction: 'Serve contrast pair to eliminate distractor ambiguity and clarify core mechanism',
          detectedAtStep: s.stepNumber,
          resolved: true,
          ruleFired: 'D3 (Misconception Detected)',
        });
      }
    });
  });

  const learnRevisits = Math.max(0, learnSteps.filter(s => s.status !== 'locked').length - 1);
  const practiceRevisits = Math.max(0, practiceSteps.filter(s => s.status !== 'locked').length - 1);
  const checkRevisits = Math.max(0, checkSteps.filter(s => s.status !== 'locked').length - 1);
  const totalRevisits = learnRevisits + practiceRevisits + checkRevisits;

  const isMastered =
    chapterFullyMastered ||
    masteryRow?.stage === 'mastered' ||
    ((masteryRow?.knowledgeMastery ?? 0) >= 80 && (masteryRow?.attempts ?? 0) > 0);
  const masteryStep = actualSteps.find((s) => s.coreStage === 'mastery');
  const diagStep = actualSteps.find((s) => s.coreStage === 'diagnostic');

  const summaryReasonWhyLonger =
    totalRevisits > 0
      ? \`This student took \${totalDurationMinutes}m (vs. \${expectedBenchmarkMinutes}m benchmark, \${durationVariancePct > 0 ? '+' : ''}\${durationVariancePct}%) because they required \${learnSteps.length} complete Learn-Practice-Check cycles. The student struggled with "\${conceptName}" and encountered \${stuckPoints.length} stuck points caused by misconception: "\${misconceptions[0]?.description || 'Core mechanism confusion'}".\`
      : learnSteps.some(s => s.status === 'completed')
      ? \`Student completed the learning journey on expected pace in \${totalDurationMinutes} minutes.\`
      : diagStep?.status === 'completed'
      ? \`Student has completed the Chapter Diagnostic (Score: \${diagStep.score ?? 0}%) in \${totalDurationMinutes} minutes and is ready to begin Concept Diagnostic.\`
      : \`Student learning journey initialized. Next step: Chapter Diagnostic.\`;

  return {
    totalDurationMinutes,
    expectedBenchmarkMinutes,
    durationVariancePct,
    summaryReasonWhyLonger,
    strugglingConcept: {
      id: focusConceptId || '114',
      name: conceptName,
      totalRevisits: learnSteps.filter(s => s.status !== 'locked').length,
      timeSpentMinutes: actualSteps.filter((s) => s.conceptName === conceptName).reduce((acc, s) => acc + s.timeSpentMinutes, 0),
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
        ? \`Student achieved full mastery after \${learnSteps.length} cycles and \${actualSteps.length} steps. All understanding checks and application questions were validated.\`
        : diagStep?.status === 'completed' && learnSteps.every(s => s.status === 'locked')
        ? 'In progress: Chapter Diagnostic completed. Ready for Concept Diagnostic.'
        : 'Student is actively working through learning lessons, practice, and understanding checks.',
    },
    recommendations: totalRevisits > 0
      ? [
          \`Check in briefly during next class to ensure the distinction regarding "\${misconceptions[0]?.description || conceptName}" remains clear.\`,
          \`Commend student persistence: completing \${learnSteps.length} cycles to turn low baseline into strong mastery shows grit.\`,
          \`Monitor the Spaced Recall queue in 3-5 days to confirm long-term retention of "\${conceptName}".\`,
        ]
      : isMastered
      ? [
          \`Student has demonstrated clear mastery on \${conceptName}.\`,
          'Assign optional hands-on Prayogshala lab simulations for enrichment.',
          'Schedule periodic spaced recall check in 7 days.',
        ]
      : [
          \`Encourage student to take the targeted Concept Diagnostic for \${conceptName} to map specific learning gaps.\`,
          'Review diagnostic recommendations and generated learning plan.',
        ],
  };
}`;

// Splice into file
const idxMainFlow = code.indexOf('export function buildMainFlowAndBranches');
const idxActualSteps = code.indexOf('export function buildActualJourneySteps');
const idxSummaries = code.indexOf('export function buildCoreStageSummaries');
const idxTeacherInsights = code.indexOf('export function buildTeacherJourneyInsights');

if (idxMainFlow === -1 || idxActualSteps === -1 || idxSummaries === -1 || idxTeacherInsights === -1) {
  console.error('Could not locate all function anchors');
  process.exit(1);
}

// 1. Replace from idxTeacherInsights to end
const beforeTeacherInsights = code.slice(0, idxTeacherInsights);
code = beforeTeacherInsights + newBuildTeacherJourneyInsights + '\n';

// 2. Replace from idxActualSteps to idxSummaries
const idxActualSteps2 = code.indexOf('export function buildActualJourneySteps');
const idxSummaries2 = code.indexOf('export function buildCoreStageSummaries');
const beforeActualSteps = code.slice(0, idxActualSteps2);
const afterActualSteps = code.slice(idxSummaries2);
code = beforeActualSteps + newBuildActualJourneySteps + '\n\n' + afterActualSteps;

// 3. Replace from idxMainFlow to idxActualSteps
const idxMainFlow3 = code.indexOf('export function buildMainFlowAndBranches');
const idxActualSteps3 = code.indexOf('export function buildActualJourneySteps');
const beforeMainFlow = code.slice(0, idxMainFlow3);
const afterMainFlow = code.slice(idxActualSteps3);
code = beforeMainFlow + newBuildMainFlowAndBranches + '\n\n// --- Dynamic actual steps & teacher insights generators -------------------\n\n' + afterMainFlow;

fs.writeFileSync(filePath, code, 'utf8');
console.log('Successfully patched pal-journey.ts!');

