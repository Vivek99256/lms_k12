import fs from 'fs';

// 1. Fix pal-journey.ts
let journeyPath = 'app/pal/journey/data/pal-journey.ts';
let journeyContent = fs.readFileSync(journeyPath, 'utf8');

journeyContent = journeyContent.replace(
  '  const conceptDiagScore = conceptResult?.score ?? null;',
  '  const conceptDiagScore = conceptResult?.accuracy != null ? Math.round(conceptResult.accuracy) : null;'
);

journeyContent = journeyContent.replace(
  '  const hasLearnStartedOrDone = isProgLearn || isProgPractice || isProgCheck || isProgMastery || learnPhaseConfirmedPast(focusConceptId, dashboard) || (dashboardSection?.attempts ?? 0) > 0 || (dashboard?.responsesOnCurrentConcept ?? 0) > 0 || conceptLearn?.acknowledged === true;',
  '  const hasLearnStartedOrDone = isProgLearn || isProgPractice || isProgCheck || isProgMastery || learnPhaseConfirmedPast(focusConceptId, dashboard) || (masteryRow?.attempts ?? 0) > 0 || (dashboard?.responsesOnCurrentConcept ?? 0) > 0 || (conceptLearn != null && conceptLearn.status === 200);'
);

journeyContent = journeyContent.replace(
  '  const isAtLeastPractice = isProgPractice || isProgCheck || isProgMastery || (dashboardSection?.attempts ?? 0) > 0 || (dashboard?.responsesOnCurrentConcept ?? 0) > 0;\n  const hasLearnCompleted = hasPlanCompleted && (isAtLeastPractice || conceptLearn?.acknowledged === true);',
  '  const isAtLeastPractice = isProgPractice || isProgCheck || isProgMastery || (masteryRow?.attempts ?? 0) > 0 || (dashboard?.responsesOnCurrentConcept ?? 0) > 0;\n  const hasLearnCompleted = hasPlanCompleted && (isAtLeastPractice || ((conceptLearn?.attempt ?? 0) > 0));'
);

journeyContent = journeyContent.replace(
  '  const practiceResponses = dashboard?.responsesOnCurrentConcept ?? dashboardSection?.attempts ?? 0;',
  '  const practiceResponses = dashboard?.responsesOnCurrentConcept ?? (masteryRow?.attempts ?? 0);'
);

journeyContent = journeyContent.replace(
  '  const practiceAccuracy = dashboard?.accuracy ?? dashboardSection?.knowledgeMastery ?? null;',
  '  const practiceAccuracy = dashboardSection?.knowledgeMastery ?? (masteryRow?.pMastery != null ? Math.round(masteryRow.pMastery * 100) : null);'
);

journeyContent = journeyContent.replace(
  '        `Remediation policy triggered: ${rem?.action || \'Contrast pair review\'}.`,\n        rem?.misconceptionDescription ? `Targeting: ${rem.misconceptionDescription}` : \'Targeting detected misconception.\',',
  '        `Remediation policy triggered: ${rem?.trigger?.action || \'Contrast pair review\'}.`,\n        remediationBranch?.misconceptionDescription ? `Targeting: ${remediationBranch.misconceptionDescription}` : \'Targeting detected misconception.\','
);

journeyContent = journeyContent.replace(
  '  const hasMasteryCompleted = lastCfuPassed && (isProgMastery || chapterFullyMastered || masteryRow?.stage === \'mastered\' || (masteryRow?.knowledgeMastery ?? 0) >= 80);',
  '  const hasMasteryCompleted = lastCfuPassed && (isProgMastery || chapterFullyMastered || masteryRow?.stage === \'mastered\' || (((masteryRow?.pMastery ?? 0) * 100) >= 80));'
);

journeyContent = journeyContent.replace(
  '    score: hasMasteryCompleted ? masteryRow?.knowledgeMastery ?? 92 : null,',
  '    score: hasMasteryCompleted ? Math.round((masteryRow?.pMastery ?? 0.92) * 100) : null,'
);

journeyContent = journeyContent.replace(
  '          `Knowledge mastery: ${masteryRow?.knowledgeMastery ?? 90}%.`,',
  '          `Knowledge mastery: ${Math.round((masteryRow?.pMastery ?? 0.9) * 100)}%.`,'
);

fs.writeFileSync(journeyPath, journeyContent, 'utf8');

// 2. Fix PathJourneyView.tsx style tag
let pathViewPath = 'app/pal/journey/_components/path/PathJourneyView.tsx';
let pathViewContent = fs.readFileSync(pathViewPath, 'utf8');
pathViewContent = pathViewContent.replace('<style jsx>{', '<style dangerouslySetInnerHTML={{ __html: ');
pathViewContent = pathViewContent.replace('      `}</style>', '      ` }} />');
fs.writeFileSync(pathViewPath, pathViewContent, 'utf8');

console.log('Applied remaining fixes');

