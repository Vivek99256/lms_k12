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

import { useEffect, useMemo, useState } from 'react';
import { FilterBar } from '@/components/ui/g2g/filter-bar';
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
  { key: 'analysis', label: 'LO / LI analysis' },
  { key: 'students', label: 'Student analysis' },
];

export function OutcomesTab({ curricula }: { curricula: ApiCurriculum[] }) {
  const [standardId, setStandardId] = useState<number | null>(null);
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [curriculumId, setCurriculumId] = useState<number | null>(null);
  const [openOutcomeId, setOpenOutcomeId] = useState<number | null>(null);
  const [subTab, setSubTab] = useState<SubTabKey>('overview');

  // There is no reliable "current class" to default to (see useLmsSession's
  // own note on this) - default to the first curriculum once the list
  // arrives, same as every other filtered page in this app.
  useEffect(() => {
    if (curriculumId !== null || curricula.length === 0) return;
    const first = curricula[0];
    setStandardId(first.standard_id);
    setSubjectId(first.subject_id);
    setCurriculumId(first.curriculum_id);
  }, [curricula, curriculumId]);

  const standardOptions = useMemo(() => {
    const seen = new Map<number, string>();
    curricula.forEach((c) => {
      if (!seen.has(c.standard_id)) seen.set(c.standard_id, c.standard_name ?? `Std ${c.standard_id}`);
    });
    return Array.from(seen.entries()).map(([id, label]) => ({ id: String(id), label, value: String(id) }));
  }, [curricula]);

  const subjectOptions = useMemo(() => {
    const seen = new Map<number, string>();
    curricula
      .filter((c) => standardId === null || c.standard_id === standardId)
      .forEach((c) => {
        if (!seen.has(c.subject_id)) seen.set(c.subject_id, c.subject_name);
      });
    return Array.from(seen.entries()).map(([id, label]) => ({ id: String(id), label, value: String(id) }));
  }, [curricula, standardId]);

  const curriculumOptions = useMemo(
    () =>
      curricula
        .filter((c) => (standardId === null || c.standard_id === standardId) && (subjectId === null || c.subject_id === subjectId))
        .map((c) => ({ id: String(c.curriculum_id), label: c.curriculum_name || `Curriculum #${c.curriculum_id}`, value: String(c.curriculum_id) })),
    [curricula, standardId, subjectId]
  );

  const handleStandardChange = (value: string) => {
    const id = Number(value) || null;
    setStandardId(id);
    const match = curricula.find((c) => c.standard_id === id);
    setSubjectId(match?.subject_id ?? null);
    setCurriculumId(match?.curriculum_id ?? null);
  };

  const handleSubjectChange = (value: string) => {
    const id = Number(value) || null;
    setSubjectId(id);
    const match = curricula.find((c) => c.standard_id === standardId && c.subject_id === id);
    setCurriculumId(match?.curriculum_id ?? null);
  };

  const filters: OutcomeFilters = useMemo(() => ({ standardId, subjectId, curriculumId }), [standardId, subjectId, curriculumId]);
  const { data, isLoading, loadError } = useOutcomeSummary(filters);

  if (curricula.length === 0) {
    return <NotProvided label="No curriculum data found for this institute yet - add a curriculum under the Curriculum tab first." />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {data ? <Pill tone={HEALTH_TONE[data.health_status]} className="px-3 py-1.5 text-xs">{HEALTH_LABEL[data.health_status]}</Pill> : <span />}
        <FilterBar
          filters={[
            { id: 'standard', label: 'Standard', type: 'select', value: standardId !== null ? String(standardId) : '', options: standardOptions, onChange: (v) => handleStandardChange(v as string) },
            { id: 'subject', label: 'Subject', type: 'select', value: subjectId !== null ? String(subjectId) : '', options: subjectOptions, onChange: (v) => handleSubjectChange(v as string) },
            { id: 'curriculum', label: 'Curriculum', type: 'select', value: curriculumId !== null ? String(curriculumId) : '', options: curriculumOptions, triggerClassName: 'w-56', onChange: (v) => setCurriculumId(Number(v) || null) },
          ]}
        />
      </div>

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
