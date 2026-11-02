import { buildActualJourneySteps } from '../app/pal/journey/data/pal-journey.ts';

// Test mock inputs
const baseHistory = {
  chapterName: 'Chemical Reactions and Equations',
  attempts: [
    {
      attemptId: 1,
      attemptNumber: 1,
      percentage: 26.67,
      totalQuestions: 15,
      correct: 4,
      level: 'Developing',
      submittedAt: '2026-10-25T10:00:00Z',
    },
  ],
};

const baseConceptResult = {
  conceptId: '114',
  conceptName: 'Combination Reactions',
  chapterId: '14',
  conceptExact: true,
  availability: {},
  attempted: 0,
  correct: 0,
  accuracy: 0,
  byDifficulty: {},
  currentDifficulty: null,
  nextDifficulty: null,
  ruleFired: '',
  rationale: '',
  understanding: '',
  needsRemediation: false,
  readyForProgression: false,
  ladder: { score: 0, stage: 'unseen', reason: '' },
  diagnosticLevel: null,
  diagnosticConceptPct: null,
  next: null,
  misconception: null,
};

console.log('--- TEST 1: Initial state after Chapter Diagnostic only ---');
const steps1 = buildActualJourneySteps({
  chapterId: '14',
  focusConceptId: '114',
  history: baseHistory,
  conceptResult: baseConceptResult,
  plan: { steps: [{ conceptId: '114' }], summary: { mastered: 0, inProgress: 1, weak: 0, conceptsTotal: 1, conceptsServable: 1 }, readiness: { esoAvailable: true }, contentGaps: [] },
  dashboard: null,
  dashboardSection: null,
  conceptLearn: null,
  decisionLog: [],
  masteryRow: null,
  remediationBranch: null,
  chapterFullyMastered: false,
  conceptName: 'Combination Reactions',
});

console.log('Step 1 (Diag):', steps1[0].shortLabel, 'status =', steps1[0].status);
console.log('Step 2 (Concept Diag):', steps1[1].shortLabel, 'status =', steps1[1].status);
console.log('Step 3 (Plan):', steps1[2].shortLabel, 'status =', steps1[2].status);
console.log('Step 4 (Learn):', steps1[3].shortLabel, 'status =', steps1[3].status);

if (steps1[1].status === 'available' && steps1[2].status === 'locked' && steps1[3].status === 'locked') {
  console.log('-> PASS: Concept Diag is Available, Plan is strictly Locked (NO premature green tick)!');
} else {
  console.error('-> FAIL: Plan should be locked!');
}

