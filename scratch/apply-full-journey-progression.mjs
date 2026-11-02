import fs from 'fs';

const filePath = 'app/pal/journey/data/pal-journey.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Replace lines 1730-1925 with the dynamic sequential tracking across Check, Retry loops, and Mastery
const oldCheckAndLoopSection = `  // ── 7. Check for Understanding (CFU Gate) ──────────────────────────────
  // STRICT SEQUENTIAL: Check can only be completed if Practice was attempted.
  const cfuEntries = decisionLog.filter(
    (e: DecisionLogEntry) => e.action === 'check_understanding' || e.action === 'understood' || e.action === 'not_understood'
  );
  const hasCheckAttempted = hasPracticeCompleted && (isProgMastery || cfuEntries.length > 0);
  const firstCfu = cfuEntries[0];
  const firstCfuPassed = isProgMastery || firstCfu?.action === 'understood';
  const firstCfuFailed = !isProgMastery && firstCfu?.action === 'not_understood';

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
        \`Remediation policy triggered: \${rem?.trigger?.action || 'Contrast pair review'}.\`,
        remediationBranch?.misconceptionDescription ? \`Targeting: \${remediationBranch.misconceptionDescription}\` : 'Targeting detected misconception.',
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
  const lastCfuPassed = hasCheckAttempted && (isProgMastery || cfuEntries[cfuEntries.length - 1]?.action === 'understood' || (totalRetries > 0 && steps[steps.length - 1]?.status === 'completed'));
  const hasMasteryCompleted = lastCfuPassed && (isProgMastery || chapterFullyMastered || masteryRow?.stage === 'mastered' || (((masteryRow?.pMastery ?? 0) * 100) >= 80));

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
          \`Concept "\${conceptName}" signed off as Mastered!\`,
          \`Knowledge mastery: \${Math.round((masteryRow?.pMastery ?? 0.9) * 100)}%.\`,
          'Validated with green tick sign-off across all learning stages.',
        ]
      : lastCfuPassed
      ? ['Check gate cleared! Ready for final mastery certification.']
      : ['Locked until all practice and understanding checks are validated.'],
    progressionNote: hasMasteryCompleted ? 'Mastery certified!' : 'Locked',
  });`;

const newCheckAndLoopSection = `  // ── 7. Check for Understanding (CFU Gate) ──────────────────────────────
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
    const hasSupportCompleted = isStageReachedOrPassed(focusConceptId, \`learn_\${attemptNum}\`) || isStageReachedOrPassed(focusConceptId, \`practice_\${attemptNum}\`) || isStageReachedOrPassed(focusConceptId, \`check_\${attemptNum}\`) || isProgMastery || isProgCompleted || rem?.resolved === true;
    const hasSupportActive = !hasSupportCompleted && (firstCfuFailed || isStageReachedOrPassed(focusConceptId, \`support_\${attemptNum - 1}\`));

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
      status: hasSupportCompleted
        ? 'completed'
        : hasSupportActive
        ? 'available'
        : 'locked',
      timeSpentMinutes: hasSupportCompleted ? 8 : 0,
      isStuck: false,
      facts: [
        \`Remediation policy triggered: \${rem?.trigger?.action || 'Contrast pair review'}.\`,
        remediationBranch?.misconceptionDescription ? \`Targeting: \${remediationBranch.misconceptionDescription}\` : 'Targeting detected misconception.',
      ],
      progressionNote: hasSupportCompleted
        ? 'Support delivered -> Looped back to Learn for reinforcement'
        : hasSupportActive
        ? 'Targeted misconception support in progress'
        : 'Locked',
    });

    // Learn Revisit
    const hasLearnRevisitCompleted = isStageReachedOrPassed(focusConceptId, \`practice_\${attemptNum}\`) || isStageReachedOrPassed(focusConceptId, \`check_\${attemptNum}\`) || isProgMastery || isProgCompleted;
    const hasLearnRevisitActive = !hasLearnRevisitCompleted && (hasSupportCompleted || isStageReachedOrPassed(focusConceptId, \`learn_\${attemptNum}\`));

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
      status: hasLearnRevisitCompleted
        ? 'completed'
        : hasLearnRevisitActive
        ? 'available'
        : 'locked',
      timeSpentMinutes: hasLearnRevisitCompleted ? 12 : 0,
      isStuck: false,
      repeatReason: \`Reteach session triggered following attempt \${attemptNum - 1} gate review.\`,
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
    const hasPracticeRevisitCompleted = isStageReachedOrPassed(focusConceptId, \`check_\${attemptNum}\`) || isProgMastery || isProgCompleted;
    const hasPracticeRevisitActive = !hasPracticeRevisitCompleted && (hasLearnRevisitCompleted || isStageReachedOrPassed(focusConceptId, \`practice_\${attemptNum}\`));

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
      status: hasPracticeRevisitCompleted
        ? 'completed'
        : hasPracticeRevisitActive
        ? 'available'
        : 'locked',
      timeSpentMinutes: hasPracticeRevisitCompleted ? 10 : 0,
      score: hasPracticeRevisitCompleted ? (cfuPassed ? 85 : 65) : null,
      isStuck: false,
      repeatReason: \`Practice attempt \${attemptNum} after reteach lesson\`,
      facts: [
        \`Attempted practice verification questions.\`,
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
          \`Concept "\${conceptName}" signed off as Mastered!\`,
          \`Knowledge mastery: \${Math.round((masteryRow?.pMastery ?? 0.9) * 100)}%.\`,
          'Validated with green tick sign-off across all learning stages.',
        ]
      : lastCfuPassed
      ? ['Check gate cleared! Ready for final mastery certification.']
      : ['Locked until all practice and understanding checks are validated.'],
    progressionNote: hasMasteryCompleted ? 'Mastery certified! Concept journey complete.' : lastCfuPassed ? 'Ready for mastery certification' : 'Locked',
  });`;

content = content.replace(oldCheckAndLoopSection, newCheckAndLoopSection);
fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated check, retry loops, and mastery progression');

