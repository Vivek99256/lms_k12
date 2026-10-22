'use client';

// Curriculum Outcomes & Delivery - the EXPECTED -> PLANNED -> DELIVERED ->
// ASSESSED -> ACHIEVED -> GAP chain for one curriculum, as a teacher-facing
// extension of Curriculum Planning rather than a separate dashboard.
//
// Three sub-tabs, same report shape as the reference design: Overview (KPIs,
// achievement donut, mastery distribution, LO performance, gap buckets),
// LO & LI analysis (expected/delivered/achieved, resource mix, the sortable
// expandable outcome table) and Student analysis (per-student evidence,
// weak-area detail, outcome-by-student heatmap). All three read one fetch.
//
// Achievement is always shown at its evidence tier (exam-based vs rare
// PAL-verified concept mastery) and never fabricated: missing evidence
// renders literally as "Data not available", not a 0.

import { useMemo, useState } from 'react';
import type { ApiCurriculum } from './types';
import { NotProvided } from './shared';
import { useOutcomeSummary, type OutcomeFilters } from './useOutcomeAnalytics';
import { OutcomeDetailDrawer } from './OutcomeDetailDrawer';
import { OutcomesOverviewPanel } from './OutcomesOverviewPanel';
import { OutcomesAnalysisPanel } from './OutcomesAnalysisPanel';
import { OutcomesStudentPanel } from './OutcomesStudentPanel';
import { HEALTH_LABEL, HEALTH_TONE, Pill } from './outcomes-shared';

type SubTabKey = 'overview' | 'analysis' | 'students';

const SUB_TABS: Array<{ key: SubTabKey; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'analysis', label: 'CG / LO analysis' },
  { key: 'students', label: 'Student analysis' },
];

export function OutcomesTab({
  curricula,
  standardId,
  subjectId,
  curriculumId,
}: {
  curricula: ApiCurriculum[];
  standardId: number | null;
  subjectId: number | null;
  curriculumId: number | null;
}) {
  const [openOutcomeId, setOpenOutcomeId] = useState<number | null>(null);
  const [subTab, setSubTab] = useState<SubTabKey>('overview');

  const filters: OutcomeFilters = useMemo(() => ({ standardId, subjectId, curriculumId }), [standardId, subjectId, curriculumId]);
  const { data, isLoading, loadError } = useOutcomeSummary(filters);

  if (curricula.length === 0) {
    return <NotProvided label="No curriculum data found for this institute yet - add a curriculum under the Curriculum tab first." />;
  }

  return (
    <div className="space-y-5">
      {data ? (
        <div className="flex items-center justify-end">
          <Pill tone={HEALTH_TONE[data.health_status]} className="px-3 py-1.5 text-xs">
            {HEALTH_LABEL[data.health_status]}
          </Pill>
        </div>
      ) : null}

      <nav className="flex gap-1 border-b border-[#ddd9d2]" role="tablist" aria-label="Outcomes report sections">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={subTab === tab.key}
            onClick={() => setSubTab(tab.key)}
            className={`-mb-px border-b-2 px-3.5 py-2 text-sm font-medium transition-colors ${
              subTab === tab.key ? 'border-[#2f7dd9] text-[#1761a7]' : 'border-transparent text-[#77716b] hover:text-[#3c3833]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {isLoading ? (
        <div className="rounded-lg border border-[#ddd9d2] bg-white px-4 py-10 text-center text-sm text-[#9a958e]">Loading curriculum outcomes...</div>
      ) : loadError ? (
        <div className="rounded-lg border border-[#e8cdc7] bg-[#fdf3f1] px-4 py-6 text-center text-sm text-[#a33a2a]">{loadError}</div>
      ) : !data ? (
        <NotProvided label="No outcomes data found for this curriculum yet." />
      ) : subTab === 'overview' ? (
        <OutcomesOverviewPanel data={data} onOpenOutcome={setOpenOutcomeId} />
      ) : subTab === 'analysis' ? (
        <OutcomesAnalysisPanel data={data} onOpenOutcome={setOpenOutcomeId} />
      ) : (
        <OutcomesStudentPanel data={data} onOpenOutcome={setOpenOutcomeId} />
      )}

      {openOutcomeId !== null ? (
        <OutcomeDetailDrawer outcomeId={openOutcomeId} filters={filters} onClose={() => setOpenOutcomeId(null)} />
      ) : null}
    </div>
  );
}
