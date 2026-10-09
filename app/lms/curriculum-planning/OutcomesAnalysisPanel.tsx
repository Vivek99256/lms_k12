'use client';

// LO & LI analysis sub-tab: Expected/Delivered/Achieved, real resource-type
// mix, and the Learning Outcome list - sortable, each row expandable to
// show its leaf Learning Indicators.
//
// The same competency code can legitimately appear more than once: the real
// data shows one curriculum-level competency (e.g. "C 1.1") realized through
// different Learning Indicators in different chapters - confirmed live, not
// a duplicate-row bug. The chapter name is shown on every row so two
// same-coded rows are never mistaken for an exact repeat.
//
// Outcomes with no chapter mapping (confirmed live: some curricula map ZERO
// of their competencies to a chapter) are kept out of this list entirely -
// there is nothing to show a bar or sort against - and surfaced in a
// collapsed disclosure instead, so they stay reachable without burying the
// outcomes that do have something to track.

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { SectionHeading, NotProvided } from './shared';
import type { LoRow, OutcomeSummaryApiData } from './outcomes-types';
import {
  ASSESSED_LABEL,
  ASSESSED_TONE,
  DELIVERED_LABEL,
  DELIVERED_TONE,
  GAP_LABEL,
  GAP_TONE,
  Pill,
  RESOURCE_TYPE_LABEL,
  StatusDot,
  TrackBar,
  achievementTierLabel,
  achievementTone,
  formatAchievementValue,
  statusTone,
  toneAt,
} from './outcomes-shared';

type SortKey = 'code' | 'achievement';

export function OutcomesAnalysisPanel({ data, onOpenOutcome }: { data: OutcomeSummaryApiData; onOpenOutcome: (id: number) => void }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'code', dir: 1 });
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { kpis } = data;
  const resourceEntries = Object.entries(data.resource_breakdown);
  const resourceMax = Math.max(1, ...resourceEntries.map(([, v]) => v));

  const trackedRows = useMemo(() => {
    const sorted = data.lo_rows.filter((row) => row.chapter_id !== null);
    sorted.sort((a, b) => {
      const av = sort.key === 'code' ? a.code ?? '' : a.achievement.value ?? -1;
      const bv = sort.key === 'code' ? b.code ?? '' : b.achievement.value ?? -1;
      if (typeof av === 'string') return av.localeCompare(bv as string) * sort.dir;
      return ((av as number) - (bv as number)) * sort.dir;
    });
    return sorted;
  }, [data.lo_rows, sort]);
  const unmappedRows = useMemo(() => data.lo_rows.filter((row) => row.chapter_id === null), [data.lo_rows]);

  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === 'code' ? 1 : -1 }));
  const sortButtonClass = (key: SortKey) =>
    `rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${sort.key === key ? 'bg-[#dcecff] text-[#1761a7]' : 'text-[#8a847d] hover:bg-[#f1f0ed]'}`;

  return (
    <div className="animate-in fade-in-0 slide-in-from-bottom-1 space-y-5 duration-300">
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-[#ddd9d2] bg-white p-4 transition-shadow hover:shadow-[0_4px_16px_rgba(23,22,15,0.06)]">
          <SectionHeading>Expected, delivered and achieved</SectionHeading>
          <div className="space-y-2.5">
            <TrackBar label="Expected" value={kpis.expected_outcomes.chapter_mapped} max={kpis.expected_outcomes.chapter_mapped} tone="gray" valueLabel={String(kpis.expected_outcomes.chapter_mapped)} />
            <TrackBar label="Delivered" value={kpis.delivered.count} max={kpis.expected_outcomes.chapter_mapped} tone="blue" valueLabel={String(kpis.delivered.count)} />
            <TrackBar label="Achieved" value={kpis.achieved.count} max={kpis.expected_outcomes.chapter_mapped} tone="green" valueLabel={String(kpis.achieved.count)} />
          </div>
          <p className="mt-3 text-xs text-[#9a958e]">
            {kpis.delivery_gap.count} planned outcome{kpis.delivery_gap.count === 1 ? '' : 's'} not yet delivered.
          </p>
        </section>

        <section className="rounded-lg border border-[#ddd9d2] bg-white p-4 transition-shadow hover:shadow-[0_4px_16px_rgba(23,22,15,0.06)]">
          <SectionHeading>Learning resource use</SectionHeading>
          <p className="mb-2 text-xs text-[#9a958e]">Real content_master resources linked to this curriculum&apos;s chapters, by file type</p>
          {resourceEntries.length === 0 ? (
            <NotProvided label="No learning resources recorded for this curriculum's chapters yet." />
          ) : (
            <div className="space-y-2">
              {resourceEntries
                .sort((a, b) => b[1] - a[1])
                .map(([type, count], index) => (
                  <TrackBar key={type} label={RESOURCE_TYPE_LABEL[type] ?? type} value={count} max={resourceMax} tone={toneAt(index)} valueLabel={String(count)} />
                ))}
            </div>
          )}
        </section>
      </div>

      <section className="overflow-hidden rounded-lg border border-[#ddd9d2] bg-white">
        <div className="p-4 pb-0">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <SectionHeading>Learning outcomes ({trackedRows.length})</SectionHeading>
            <div className="flex items-center gap-1">
              <span className="mr-1 text-xs text-[#9a958e]">Sort</span>
              <button type="button" onClick={() => toggleSort('code')} className={sortButtonClass('code')}>
                Code{sort.key === 'code' ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}
              </button>
              <button type="button" onClick={() => toggleSort('achievement')} className={sortButtonClass('achievement')}>
                Achievement{sort.key === 'achievement' ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}
              </button>
            </div>
          </div>
          <p className="mb-3 text-xs text-[#9a958e]">The same code can appear more than once when one competency spans several chapters - the chapter name tells them apart.</p>
        </div>
        {trackedRows.length === 0 ? (
          <div className="p-4 pt-0">
            <NotProvided label="None of this curriculum's outcomes are mapped to a chapter yet, so none can be tracked here - see below." />
          </div>
        ) : (
          <div className="divide-y divide-[#e9e5de] border-t border-[#e9e5de]">
            {trackedRows.map((row) => (
              <LoCard
                key={row.outcome_id}
                row={row}
                isOpen={expandedId === row.outcome_id}
                onToggle={() => setExpandedId((id) => (id === row.outcome_id ? null : row.outcome_id))}
                onOpenOutcome={onOpenOutcome}
              />
            ))}
          </div>
        )}
        {unmappedRows.length > 0 ? (
          <div className="border-t border-[#e9e5de] p-4">
            <UnmappedDisclosure rows={unmappedRows} onOpenOutcome={onOpenOutcome} />
          </div>
        ) : null}
      </section>
    </div>
  );
}

function UnmappedDisclosure({ rows, onOpenOutcome }: { rows: LoRow[]; onOpenOutcome: (id: number) => void }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <button type="button" onClick={() => setIsOpen((open) => !open)} className="flex items-center gap-1.5 text-xs font-medium text-[#8a847d] transition-colors hover:text-[#3c3833]">
        {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        {rows.length} competenc{rows.length === 1 ? 'y has' : 'ies have'} no chapter mapping yet - not tracked
      </button>
      {isOpen ? (
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {rows.map((row) => (
            <li key={row.outcome_id}>
              <button type="button" onClick={() => onOpenOutcome(row.outcome_id)} className="block w-full truncate rounded-md px-2 py-1 text-left text-xs transition-colors hover:bg-[#faf9f7]">
                <span className="mr-1.5 whitespace-nowrap font-mono text-[#9a958e]">{row.code ?? '—'}</span>
                <span className="text-[#706b64]">{row.description}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function LoCard({
  row,
  isOpen,
  onToggle,
  onOpenOutcome,
}: {
  row: LoRow;
  isOpen: boolean;
  onToggle: () => void;
  onOpenOutcome: (id: number) => void;
}) {
  return (
    <div className={isOpen ? 'bg-[#eef2ff]' : ''}>
      <button type="button" onClick={onToggle} className="flex w-full items-start gap-2.5 px-4 py-3 text-left transition-colors hover:bg-[#faf9f7] data-[open=true]:hover:bg-[#eef2ff]" data-open={isOpen}>
        <ChevronRight size={15} className={`mt-0.5 shrink-0 text-[#8a847d] transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="rounded bg-[#dcecff] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#114f8f]">{row.code}</span>
            <span className="rounded-full bg-[#f7e6d4] px-2 py-0.5 text-[11px] font-medium text-[#8a5a1a]">{row.chapter_name}</span>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-[#2d2924]">{row.description || 'No description recorded'}</p>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Pill tone={DELIVERED_TONE[row.delivered]}>{DELIVERED_LABEL[row.delivered]}</Pill>
            <Pill tone={ASSESSED_TONE[row.assessed]}>{ASSESSED_LABEL[row.assessed]}</Pill>
            <Pill tone={GAP_TONE[row.gap_category]}>{GAP_LABEL[row.gap_category]}</Pill>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-4 border-t border-[#f1f0ed] pt-2.5">
            {row.achievement.value === null ? (
              <span className="text-xs italic text-[#a09a93]">No achievement evidence yet</span>
            ) : (
              <div className="min-w-[180px] max-w-xs flex-1">
                <TrackBar label="" value={row.achievement.value} max={100} tone={statusTone(row.achievement.status)} valueLabel={formatAchievementValue(row.achievement.value)} threshold={75} />
              </div>
            )}
            {row.achievement.mastery !== null ? (
              <span className="text-xs text-[#706b64]">
                Mastery <b className="text-sm font-semibold text-[#2d2924]">{row.achievement.mastery}%</b>
              </span>
            ) : null}
            <Pill tone={achievementTone(row.achievement.tier)}>{achievementTierLabel(row.achievement.tier)}</Pill>
            <StatusDot status={row.achievement.status} />
          </div>
        </div>
      </button>

      {/* grid-template-rows 0fr -> 1fr is a CSS-only height animation that needs no measured pixel height. */}
      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="space-y-2 border-t border-[#dde3fb] bg-white px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-[#8a847d]">
                Learning indicators ({row.indicators.length})
              </span>
              <button type="button" onClick={() => onOpenOutcome(row.outcome_id)} className="text-xs font-medium text-[#2f7dd9] transition-colors hover:text-[#1761a7] hover:underline">
                Open outcome detail →
              </button>
            </div>
            {row.indicators.length === 0 ? (
              <p className="text-xs italic text-[#a09a93]">No learning indicators recorded under this outcome.</p>
            ) : (
              <ul className="space-y-1.5">
                {row.indicators.map((indicator) => (
                  <li key={indicator.outcome_id}>
                    <button
                      type="button"
                      onClick={() => onOpenOutcome(indicator.outcome_id)}
                      className="grid w-full grid-cols-[minmax(140px,1.4fr)_minmax(140px,1fr)_90px] items-center gap-3 rounded-md bg-[#faf9f7] px-2.5 py-2 text-left transition-colors hover:bg-[#f1f0ed]"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="font-mono text-[11px] text-[#9a958e]">{indicator.code}</span>
                        <span className="truncate text-xs text-[#3c3833]">{indicator.description}</span>
                      </span>
                      {indicator.achievement.value === null ? (
                        <span className="text-[11px] italic text-[#a09a93]">No evidence yet</span>
                      ) : (
                        <TrackBar
                          label=""
                          value={indicator.achievement.value}
                          max={100}
                          tone={statusTone(indicator.achievement.status)}
                          valueLabel={formatAchievementValue(indicator.achievement.value)}
                          threshold={75}
                        />
                      )}
                      <StatusDot status={indicator.achievement.status} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
