import fs from 'fs';

const filePath = 'app/pal/journey/data/pal-journey.ts';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add BuildStepsParams interface
const buildStepsParamsDef = `export interface BuildStepsParams {
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

export function buildActualJourneySteps(params: BuildStepsParams): StudentJourneyStep[] {`;

content = content.replace('export function buildActualJourneySteps(params: BuildStepsParams): StudentJourneyStep[] {', buildStepsParamsDef);

// 2. Fix line 1070
content = content.replace(
  '  const hasLearnStartedOrDone = isProgLearn || isProgPractice || isProgCheck || isProgMastery || learnPhaseConfirmedPast(focusConceptId, dashboard) || (dashboardSection?.attempts ?? 0) > 0 || (conceptLearn?.acknowledged === true);',
  '  const hasLearnStartedOrDone = isProgLearn || isProgPractice || isProgCheck || isProgMastery || learnPhaseConfirmedPast(focusConceptId, dashboard) || (masteryRow?.attempts ?? 0) > 0 || ((conceptLearn?.attempt ?? 0) > 0);'
);

// 3. Fix line 1116
content = content.replace(
  '    dashboardSection?.conceptName ||',
  '    dashboardSection?.name ||'
);

// 4. Fix line 1205
content = content.replace(
  "      mastered: existing?.mastered || mc.stage === 'mastered' || (mc.knowledgeMastery ?? 0) >= 80,",
  "      mastered: existing?.mastered || mc.stage === 'mastered' || (((mc.pMastery ?? 0) * 100) >= 80),"
);

// 5. Fix line 1291, 1293, 1296, 1302, 1328
content = content.replace(
  '  const isAtLeastLearn = isProgLearn || isProgPractice || isProgCheck || isProgMastery || (dashboardSection?.attempts ?? 0) > 0 || (masteryRow?.attempts ?? 0) > 0;',
  '  const isAtLeastLearn = isProgLearn || isProgPractice || isProgCheck || isProgMastery || (masteryRow?.attempts ?? 0) > 0;'
);

content = content.replace(
  '  const isAtLeastPractice = isProgPractice || isProgCheck || isProgMastery || (dashboardSection?.attempts ?? 0) > 0;',
  '  const isAtLeastPractice = isProgPractice || isProgCheck || isProgMastery || (masteryRow?.attempts ?? 0) > 0;'
);

content = content.replace(
  '  const hasPractice = hasLearn && (isAtLeastCheck || (dashboardSection?.attempts ?? 0) > 0);',
  '  const hasPractice = hasLearn && (isAtLeastCheck || (masteryRow?.attempts ?? 0) > 0);'
);

content = content.replace(
  '    ((masteryRow?.knowledgeMastery ?? 0) >= 80 && (masteryRow?.attempts ?? 0) > 0);',
  '    (((masteryRow?.pMastery ?? 0) * 100 >= 80) && (masteryRow?.attempts ?? 0) > 0);'
);

content = content.replace(
  'score: hasConceptDiag ? conceptResult?.score ?? 55 : null,',
  'score: hasConceptDiag ? (conceptResult?.accuracy != null ? Math.round(conceptResult.accuracy) : 55) : null,'
);

// 6. Fix line 1410
content = content.replace(
  'score: isMastered ? masteryRow?.knowledgeMastery ?? 92 : null,',
  'score: isMastered ? Math.round((masteryRow?.pMastery ?? 0.92) * 100) : null,'
);

// 7. Fix type annotations on attempt & index (around line 1450)
content = content.replace(
  '    history.attempts.forEach((attempt, index) => {',
  '    history.attempts.forEach((attempt: DiagnosticHistoryEntry, index: number) => {'
);

// 8. Fix type annotations on e in decisionLog.filter (around line 1716)
content = content.replace(
  '  const cfuEntries = decisionLog.filter(\n    (e) => e.action === \'check_understanding\' || e.action === \'understood\' || e.action === \'not_understood\'\n  );',
  '  const cfuEntries = decisionLog.filter(\n    (e: DecisionLogEntry) => e.action === \'check_understanding\' || e.action === \'understood\' || e.action === \'not_understood\'\n  );'
);

// 9. Fix line 2038
content = content.replace(
  '    ((masteryRow?.knowledgeMastery ?? 0) >= 80 && (masteryRow?.attempts ?? 0) > 0);',
  '    (((masteryRow?.pMastery ?? 0) * 100 >= 80) && (masteryRow?.attempts ?? 0) > 0);'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed types in pal-journey.ts');

