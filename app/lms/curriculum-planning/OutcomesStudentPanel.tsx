'use client';

// Student analysis sub-tab: which students have real per-outcome evidence
// (sparse by design - see OutcomeAnalyticsService::studentRows), their
// mastery summary, a weak-areas/remedial-action detail on click, and an
// outcome-by-student heatmap over that same real evidence.

import { useMemo, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SectionHeading, NotProvided } from './shared';
import type { OutcomeSummaryApiData, StudentRow } from './outcomes-types';
import { Pill, achievementTierLabel, achievementTone, formatAchievementValue } from './outcomes-shared';

type SortKey = 'name' | 'achieved_count' | 'mean';

function cellTone(value: number | null): { label: string; className: string; title: string } {
  if (value === null) return { label: '', className: 'bg-[#f1f0ed]', title: 'No evidence' };
  if (value >= 70) return { label: '✓', className: 'bg-[#def4d2] text-[#3f7b2b]', title: `${value}% — achieved` };
  if (value >= 40) return { label: '~', className: 'bg-[#fae8c7] text-[#6f470c]', title: `${value}% — developing` };
  return { label: '✕', className: 'bg-[#fae0d4] text-[#8a331a]', title: `${value}% — beginning` };
}

export function OutcomesStudentPanel({ data, onOpenOutcome }: { data: OutcomeSummaryApiData; onOpenOutcome: (id: number) => void }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'mean', dir: -1 });
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { students, outcomes, note } = data.student_rows;

  const sorted = useMemo(() => {
    const copy = [...students];
    copy.sort((a, b) => {
      const av = sort.key === 'name' ? a.name : sort.key === 'achieved_count' ? a.summary.achieved_count : a.summary.mean ?? -1;
      const bv = sort.key === 'name' ? b.name : sort.key === 'achieved_count' ? b.summary.achieved_count : b.summary.mean ?? -1;
      if (typeof av === 'string') return av.localeCompare(bv as string) * sort.dir;
      return ((av as number) - (bv as number)) * sort.dir;
    });
    return copy;
  }, [students, sort]);

  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === 'name' ? 1 : -1 }));
  const selected = selectedId !== null ? students.find((s) => s.student_id === selectedId) ?? null : null;

  if (students.length === 0) {
    return (
      <NotProvided
        label={note ?? 'No student-level evidence recorded for this curriculum yet.'}
      />
    );
  }

  return (
    <div className="animate-in fade-in-0 slide-in-from-bottom-1 space-y-5 duration-300">
      <section className="rounded-lg border border-[#ddd9d2] bg-white p-4 transition-shadow hover:shadow-[0_4px_16px_rgba(23,22,15,0.06)]">
        <SectionHeading>Student mastery</SectionHeading>
        <p className="mb-3 text-xs text-[#9a958e]">
          Only students with recorded evidence appear here ({students.length} of this curriculum&apos;s roster) - select a row to see weak areas.
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('name')}>Student{sort.key === 'name' ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}</TableHead>
              <TableHead className="cursor-pointer select-none text-right" onClick={() => toggleSort('achieved_count')}>Achieved LO{sort.key === 'achieved_count' ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}</TableHead>
              <TableHead className="text-right">Not achieved</TableHead>
              <TableHead className="cursor-pointer select-none text-right" onClick={() => toggleSort('mean')}>Mastery{sort.key === 'mean' ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row) => (
              <TableRow
                key={row.student_id}
                className={`cursor-pointer transition-colors hover:bg-[#faf9f7] ${selectedId === row.student_id ? 'bg-[#eef2ff]' : ''}`}
                onClick={() => setSelectedId((id) => (id === row.student_id ? null : row.student_id))}
              >
                <TableCell>
                  <span className="text-sm text-[#2d2924]">{row.name}</span>
                  {row.roll_no ? <span className="ml-1.5 font-mono text-xs text-[#9a958e]">#{row.roll_no}</span> : null}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">{row.summary.achieved_count}/{row.summary.assessed_count}</TableCell>
                <TableCell className="text-right text-sm tabular-nums">{row.summary.assessed_count - row.summary.achieved_count}</TableCell>
                <TableCell className="text-right text-sm font-medium tabular-nums">{row.summary.mean !== null ? `${row.summary.mean}%` : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      {selected ? <StudentDetail student={selected} outcomes={outcomes} onOpenOutcome={onOpenOutcome} /> : null}

      <section className="rounded-lg border border-[#ddd9d2] bg-white p-4 transition-shadow hover:shadow-[0_4px_16px_rgba(23,22,15,0.06)]">
        <SectionHeading>Outcome by student</SectionHeading>
        <p className="mb-2 text-xs text-[#9a958e]">Where weak students and weak outcomes overlap - blank means no evidence recorded</p>
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#706b64]">
          <span className="inline-flex items-center gap-1.5"><span className="inline-flex h-4 w-4 items-center justify-center rounded bg-[#def4d2] text-[#3f7b2b]">✓</span>70%+ achieved</span>
          <span className="inline-flex items-center gap-1.5"><span className="inline-flex h-4 w-4 items-center justify-center rounded bg-[#fae8c7] text-[#6f470c]">~</span>40–69% developing</span>
          <span className="inline-flex items-center gap-1.5"><span className="inline-flex h-4 w-4 items-center justify-center rounded bg-[#fae0d4] text-[#8a331a]">✕</span>Below 40%</span>
        </div>
        <div className="overflow-x-auto">
          <table className="border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 bg-white px-2 py-1 text-left font-medium text-[#706b64]" />
                {outcomes.map((o) => (
                  <th key={o.outcome_id} title={o.code ?? undefined} className="px-0.5 py-1 text-center font-mono text-[10px] font-normal text-[#9a958e]">
                    {(o.code ?? '').slice(-4)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((row) => (
                <tr key={row.student_id}>
                  <td className="sticky left-0 whitespace-nowrap bg-white px-2 py-1 text-[#3c3833]">{row.name}</td>
                  {outcomes.map((o) => {
                    const cell = cellTone(row.scores[String(o.outcome_id)]?.value ?? null);
                    return (
                      <td key={o.outcome_id} title={`${o.code ?? ''}: ${cell.title}`} className={`h-[26px] w-[26px] rounded border-2 border-white text-center font-bold transition-transform hover:scale-110 ${cell.className}`}>
                        {cell.label}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StudentDetail({
  student,
  outcomes,
  onOpenOutcome,
}: {
  student: StudentRow;
  outcomes: OutcomeSummaryApiData['student_rows']['outcomes'];
  onOpenOutcome: (id: number) => void;
}) {
  const worst = outcomes
    .map((o) => ({ outcome: o, score: student.scores[String(o.outcome_id)] }))
    .filter((e) => e.score && e.score.value !== null)
    .sort((a, b) => (a.score!.value as number) - (b.score!.value as number))
    .slice(0, 3);

  return (
    <section className="animate-in fade-in-0 slide-in-from-top-1 rounded-lg border border-[#ddd9d2] bg-white p-4 duration-200">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-[#24211d]">{student.name}</h2>
          <p className="text-xs text-[#9a958e]">
            {student.summary.achieved_count} of {student.summary.assessed_count} assessed outcomes achieved · mean {student.summary.mean ?? '—'}%
          </p>
        </div>
      </div>
      {worst.length === 0 ? (
        <p className="text-sm italic text-[#a09a93]">No scored outcomes recorded for this student yet.</p>
      ) : (
        <div className="space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-[#8a847d]">Weak areas</span>
          {worst.map(({ outcome, score }) => (
            <button
              key={outcome.outcome_id}
              type="button"
              onClick={() => onOpenOutcome(outcome.outcome_id)}
              className="flex w-full items-center justify-between gap-3 rounded-md px-1.5 py-1.5 text-left hover:bg-[#faf9f7]"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="font-mono text-xs text-[#9a958e]">{outcome.code}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <span className="text-sm font-semibold text-[#8a331a]">{formatAchievementValue(score!.value)}</span>
                <Pill tone={achievementTone(score!.tier)}>{achievementTierLabel(score!.tier)}</Pill>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
