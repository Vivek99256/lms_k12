import { DiagnosticScoreSummary } from '@/app/pal/diagnostic/chapter/[chapterId]/page';
import type { ChapterDiagnosticResult, DiagnosticConceptBreakdown } from '@/app/pal/data/pal-diagnostic';

/**
 * TEMPORARY - not part of the feature. Mounts `DiagnosticScoreSummary` with
 * mock data so it can be hit directly (no session, no backend, no real
 * submitted attempt) while verifying the redesign actually renders. Delete
 * this route once that's confirmed.
 */

function concept(name: string, correct: number, served: number, exact = true): DiagnosticConceptBreakdown {
  return {
    conceptId: name,
    name,
    served,
    correct,
    percentage: (correct / served) * 100,
    band: correct / served >= 0.7 ? 'strong' : correct / served >= 0.4 ? 'moderate' : 'weak',
    conceptExact: exact,
  };
}

function mockResult(overrides: Partial<ChapterDiagnosticResult>): ChapterDiagnosticResult {
  return {
    attemptId: 'preview-attempt',
    chapterId: '1',
    subjectId: '1',
    status: 'completed',
    totalQuestions: 15,
    correct: 11,
    incorrect: 2,
    unanswered: 2,
    percentage: 73,
    level: 'proficient',
    difficultyBreakdown: [],
    conceptBreakdown: [
      concept('Chemical reactions', 5, 5),
      concept('Balancing equations', 4, 5),
      concept('Types of reactions', 2, 3, false),
      concept('Oxidation and reduction', 0, 2),
    ],
    strengths: [],
    weaknesses: [],
    questionResults: [],
    recommendedDifficulty: 'medium',
    recommendedReason: 'preview',
    submittedAt: new Date().toISOString(),
    ...overrides,
  };
}

export default function DiagnosticSummaryPreview() {
  return (
    <div className="space-y-16 bg-slate-100 p-6">
      <section>
        <h2 className="mb-2 text-sm font-bold text-slate-500">HIGH (100%, advanced, confetti + Flawless)</h2>
        <DiagnosticScoreSummary
          result={mockResult({
            correct: 15,
            incorrect: 0,
            unanswered: 0,
            percentage: 100,
            level: 'advanced',
            conceptBreakdown: [concept('Chemical reactions', 5, 5), concept('Balancing equations', 5, 5)],
          })}
          totalQuestions={15}
          elapsedSeconds={81}
          onContinue={() => {}}
          onReview={() => {}}
        />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold text-slate-500">MID (73%, proficient)</h2>
        <DiagnosticScoreSummary
          result={mockResult({})}
          totalQuestions={15}
          elapsedSeconds={612}
          onContinue={() => {}}
          onReview={() => {}}
        />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold text-slate-500">LOW (0%, beginner, mostly unanswered - the reported case)</h2>
        <DiagnosticScoreSummary
          result={mockResult({
            correct: 0,
            incorrect: 2,
            unanswered: 13,
            percentage: 0,
            level: 'beginner',
            conceptBreakdown: [concept('Chemical reactions', 0, 2)],
          })}
          totalQuestions={15}
          elapsedSeconds={81}
          onContinue={() => {}}
          onReview={() => {}}
        />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold text-slate-500">NO ELAPSED TIME / NO CONCEPTS</h2>
        <DiagnosticScoreSummary
          result={mockResult({ conceptBreakdown: [] })}
          totalQuestions={15}
          elapsedSeconds={null}
          onContinue={() => {}}
          onReview={() => {}}
        />
      </section>
    </div>
  );
}
