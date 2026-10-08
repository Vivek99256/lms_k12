'use client';

// Overview sub-tab: KPI tiles, an Achieved-vs-Expected donut, the real
// mastery-band distribution for this curriculum's mapped concepts, the LO
// performance list, and the three Curriculum Gaps buckets.

import { useState } from 'react';
import { BookOpenCheck, ChevronDown, ChevronRight, ClipboardCheck, Clock3, Library, Send, Trophy } from 'lucide-react';
import { SectionHeading, NotProvided } from './shared';
import type { GapCategory, LoRow, OutcomeSummaryApiData } from './outcomes-types';
import { Donut, KpiTile, StatusDot, TrackBar, formatAchievementValue, statusTone, toneAt } from './outcomes-shared';

const GAP_ACCENT: Record<GapCategory, string> = {
  delivery_gap: '#b87916',
  assessment_gap: '#b87916',
  learning_gap: '#d45628',
  none: '#1aa179',
  not_applicable: '#9a958e',
};

function humanizeBandKey(key: string): string {
  return key
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function OutcomesOverviewPanel({ data, onOpenOutcome }: { data: OutcomeSummaryApiData; onOpenOutcome: (id: number) => void }) {
  const { kpis } = data;
  const bandEntries = Object.entries(data.mastery_distribution);
  const bandTotal = bandEntries.reduce((sum, [, count]) => sum + count, 0);
  const trackedLoRows = data.lo_rows.filter((row) => row.chapter_id !== null);
  const unmappedLoRows = data.lo_rows.filter((row) => row.chapter_id === null);
  const gapGroups: Array<{ title: string; hint: string; category: GapCategory; rows: typeof data.gaps.delivery_gaps }> = [
    { title: 'Delivery Gaps', hint: 'expected but not yet taught', category: 'delivery_gap', rows: data.gaps.delivery_gaps },
    { title: 'Assessment Gaps', hint: 'delivered, no assessment evidence', category: 'assessment_gap', rows: data.gaps.assessment_gaps },
    { title: 'Learning Gaps', hint: 'delivered and assessed, below threshold', category: 'learning_gap', rows: data.gaps.learning_gaps },
  ];

  return (
    <div className="animate-in fade-in-0 slide-in-from-bottom-1 space-y-5 duration-300">
      <section className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiTile icon={BookOpenCheck} tone="indigo" label="Expected Outcomes" value={kpis.expected_outcomes.total} hint={`${kpis.expected_outcomes.chapter_mapped} chapter-mapped`} />
        <KpiTile icon={Send} tone="blue" label="Delivered" value={`${kpis.delivered.percent}%`} hint={`${kpis.delivered.count} of ${kpis.expected_outcomes.chapter_mapped}`} />
        <KpiTile icon={Trophy} tone="green" label="Achieved" value={`${kpis.achieved.percent}%`} hint={`${kpis.achieved.count} of ${kpis.expected_outcomes.chapter_mapped}`} />
        <KpiTile icon={Clock3} tone="amber" label="Delivery Gap" value={kpis.delivery_gap.count} hint="outcomes pending" />
        <KpiTile icon={Library} tone="purple" label="Resource Coverage" value={`${kpis.resource_coverage.percent}%`} />
        <KpiTile icon={ClipboardCheck} tone="teal" label="Assessment Coverage" value={`${kpis.assessment_coverage.percent}%`} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-[#ddd9d2] bg-white p-4 transition-shadow hover:shadow-[0_4px_16px_rgba(23,22,15,0.06)]">
          <SectionHeading>LO achievement</SectionHeading>
          <p className="mb-3 text-xs text-[#9a958e]">Outcomes whose achievement is 50% or above</p>
          <div className="flex flex-wrap items-center gap-6">
            <Donut achieved={kpis.achieved.count} total={kpis.expected_outcomes.chapter_mapped} tone="green" />
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#1aa179]" />
                Achieved <b className="tabular-nums">{kpis.achieved.count}</b>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#e3e1de]" />
                Not achieved <b className="tabular-nums">{kpis.expected_outcomes.chapter_mapped - kpis.achieved.count}</b>
              </div>
              <div className="flex gap-3 pt-1 text-xs text-[#9a958e]">
                <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#2f7dd9]" />{kpis.achieved.tier_breakdown.exam_based} exam-based</span>
                <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#7468d9]" />{kpis.achieved.tier_breakdown.pal_verified} PAL-verified</span>
                <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#9a958e]" />{kpis.achieved.tier_breakdown.unavailable} no evidence</span>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-[#ddd9d2] bg-white p-4 transition-shadow hover:shadow-[0_4px_16px_rgba(23,22,15,0.06)]">
          <SectionHeading>Mastery distribution</SectionHeading>
          <p className="mb-3 text-xs text-[#9a958e]">Real pal_concept_mastery evidence for this curriculum&apos;s mapped concepts, by this school&apos;s configured mastery bands</p>
          {bandEntries.length === 0 ? (
            <NotProvided label="No concept-level mastery evidence recorded for this curriculum yet." />
          ) : (
            <div className="space-y-2">
              {bandEntries
                .sort((a, b) => b[1] - a[1])
                .map(([band, count], index) => (
                  <TrackBar key={band} label={humanizeBandKey(band)} value={count} max={bandTotal} tone={toneAt(index)} valueLabel={String(count)} />
                ))}
            </div>
          )}
        </section>
      </div>

      <section className="rounded-lg border border-[#ddd9d2] bg-white p-4">
        <SectionHeading>LO performance</SectionHeading>
        <p className="mb-3 text-xs text-[#9a958e]">
          Achievement, Mastery and Status per learning outcome - the same code can repeat across chapters, the chapter name tells them apart
        </p>
        {trackedLoRows.length === 0 ? (
          <NotProvided
            label={
              data.lo_rows.length === 0
                ? 'No learning outcomes recorded for this curriculum.'
                : "None of this curriculum's outcomes are mapped to a chapter yet, so none can be tracked for performance - see below."
            }
          />
        ) : (
          <div className="space-y-1.5">
            <div className="grid grid-cols-[1.4fr_1.6fr_64px_120px] gap-3 px-2 text-[11px] font-semibold uppercase tracking-wide text-[#a09a93]">
              <span>Outcome</span>
              <span>Achievement</span>
              <span className="text-right">Mastery</span>
              <span>Status</span>
            </div>
            {trackedLoRows.map((row: LoRow) => (
              <button
                key={row.outcome_id}
                type="button"
                onClick={() => onOpenOutcome(row.outcome_id)}
                className="grid w-full grid-cols-[1.4fr_1.6fr_64px_120px] items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-[#faf9f7]"
              >
                <span className="min-w-0">
                  <span className="mr-1.5 whitespace-nowrap font-mono text-xs text-[#9a958e]">{row.code ?? '—'}</span>
                  <span className="block truncate text-sm text-[#3c3833]">{row.description || 'No description recorded'}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-[#a8710f]">{row.chapter_name}</span>
                </span>
                {row.achievement.value === null ? (
                  <span className="text-xs italic text-[#a09a93]">No evidence yet</span>
                ) : (
                  <TrackBar
                    label=""
                    value={row.achievement.value}
                    max={100}
                    tone={statusTone(row.achievement.status)}
                    valueLabel={formatAchievementValue(row.achievement.value)}
                    threshold={75}
                  />
                )}
                <span className="text-right text-sm font-medium tabular-nums text-[#2d2924]">{row.achievement.mastery !== null ? `${row.achievement.mastery}%` : '—'}</span>
                <StatusDot status={row.achievement.status} />
              </button>
            ))}
          </div>
        )}

        {unmappedLoRows.length > 0 ? <UnmappedOutcomesDisclosure rows={unmappedLoRows} onOpenOutcome={onOpenOutcome} /> : null}
      </section>

      <section>
        <SectionHeading>Curriculum Gaps &amp; Attention Areas</SectionHeading>
        <div className="grid gap-3 md:grid-cols-3">
          {gapGroups.map((group) => (
            <div
              key={group.title}
              className="relative overflow-hidden rounded-lg border border-[#e5e1da] bg-white p-3 pl-4 transition-shadow hover:shadow-[0_4px_16px_rgba(23,22,15,0.06)]"
            >
              <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: GAP_ACCENT[group.category] }} />
              <p className="mb-0.5 text-xs font-semibold text-[#5c574f]">{group.title} ({group.rows.length})</p>
              <p className="mb-2 text-[11px] text-[#9a958e]">{group.hint}</p>
              {group.rows.length === 0 ? (
                <p className="text-xs italic text-[#a09a93]">None</p>
              ) : (
                <ul className="space-y-1">
                  {group.rows.slice(0, 6).map((row) => (
                    <li key={row.outcome_id}>
                      <button
                        type="button"
                        onClick={() => onOpenOutcome(row.outcome_id)}
                        className="block w-full rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-[#faf9f7]"
                      >
                        <span className="font-mono font-semibold text-[#5c574f]">{row.code}</span>{' '}
                        <span className="text-[#706b64]">{row.chapter_name}</span>
                      </button>
                    </li>
                  ))}
                  {group.rows.length > 6 ? <li className="px-2 text-[11px] text-[#9a958e]">+{group.rows.length - 6} more</li> : null}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/**
 * Competencies with no chapter mapping, collapsed by default.
 *
 * Some curricula have dozens of these and zero chapter-mapped ones
 * (confirmed live - several English curricula map 0 of their competencies
 * to a chapter), so listing them at full row-height alongside trackable
 * outcomes would bury the real performance data under a wall of "No data"
 * rows. They are still real curriculum content, so they are named and
 * reachable, just not given the same visual weight as something trackable.
 */
function UnmappedOutcomesDisclosure({ rows, onOpenOutcome }: { rows: LoRow[]; onOpenOutcome: (id: number) => void }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-3 border-t border-[#e9e5de] pt-3">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex items-center gap-1.5 text-xs font-medium text-[#8a847d] transition-colors hover:text-[#3c3833]"
      >
        {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        {rows.length} competenc{rows.length === 1 ? 'y has' : 'ies have'} no chapter mapping yet - not tracked
      </button>
      {isOpen ? (
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {rows.map((row) => (
            <li key={row.outcome_id}>
              <button
                type="button"
                onClick={() => onOpenOutcome(row.outcome_id)}
                className="block w-full truncate rounded-md px-2 py-1 text-left text-xs transition-colors hover:bg-[#faf9f7]"
              >
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
