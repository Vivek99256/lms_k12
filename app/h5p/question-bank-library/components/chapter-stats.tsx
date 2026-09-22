'use client';

import { AlertTriangle, ExternalLink, Play } from 'lucide-react';

import type { ChapterSummary, TypeBucket } from '../../data/question-bank-library';

/**
 * The chapter's numbers, then one card per question type.
 *
 * WHAT THE NUMBERS COUNT NOW. They count questions and whether a player can
 * render them. They no longer count conversions, drafts or "pending" work,
 * because there is no conversion step left to be pending on -- a question is
 * either playable right now or it is missing something, and the card says
 * which.
 *
 * A card whose requested library does not exist in this platform still says so
 * on its face and names what it plays as instead. Hiding those forms would
 * leave a teacher looking for "Essay" with an empty grid and no explanation.
 */

function StatTile({ label, value, tone }: { label: string; value: number; tone?: 'good' | 'warn' }) {
  const valueClass = tone === 'good' ? 'text-emerald-600' : tone === 'warn' ? 'text-amber-600' : 'text-slate-900';

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <p className={`text-lg font-semibold tabular-nums leading-none ${valueClass}`}>{value}</p>
      <p className="mt-1 truncate text-[11px] text-slate-500">{label}</p>
    </div>
  );
}

export function ChapterStats({ summary }: { summary: ChapterSummary }) {
  const count = (code: string) => summary.buckets.find((bucket) => bucket.mapping.code === code)?.questions.length ?? 0;

  const caseStudy = ['case_study', 'case_study_parent', 'case_study_child', 'source_based_integrated'].reduce(
    (total, code) => total + count(code),
    0
  );

  return (
    <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-900">Chapter statistics</h2>
        {summary.unmapped > 0 ? (
          <p className="text-[11px] text-slate-500">
            {summary.unmapped} {summary.unmapped === 1 ? 'question carries' : 'questions carry'} no recorded form
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
        <StatTile label="Questions total" value={summary.total} />
        <StatTile label="Multiple choice" value={count('mcq')} />
        <StatTile label="True / false" value={count('true_false')} />
        <StatTile label="Fill in the blank" value={count('fill_blank')} />
        <StatTile label="Case study" value={caseStudy} />
        <StatTile label="Playable now" value={summary.playable} tone="good" />
        <StatTile label="Needs attention" value={summary.notPlayable} tone="warn" />
      </div>
    </div>
  );
}

export function TypeCard({
  bucket,
  onPreview,
  onOpen,
}: {
  bucket: TypeBucket;
  onPreview: () => void;
  onOpen: () => void;
}) {
  const { mapping } = bucket;
  const playable = bucket.playable.length;
  const blocked = bucket.blocked.length;

  return (
    <div className="h5p-surface flex h-full flex-col p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-900">{mapping.label}</h3>
          <p className="mt-0.5 font-mono text-[11px] text-slate-400">{mapping.code}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-semibold tabular-nums leading-none text-slate-900">{bucket.questions.length}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">{bucket.questions.length === 1 ? 'question' : 'questions'}</p>
        </div>
      </div>

      <div className="mt-3 rounded-lg bg-slate-50 px-2.5 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Plays as</p>
        <p className="mt-0.5 font-mono text-xs text-slate-700">{mapping.target?.library ?? 'No player yet'}</p>
      </div>

      {mapping.supported ? null : (
        <div className="mt-2.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5" />
            Not supported yet: {mapping.requested.join(' / ')}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-amber-700">{mapping.note}</p>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
        {playable > 0 ? (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">{playable} playable</span>
        ) : null}
        {blocked > 0 ? (
          <span
            className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600"
            title={bucket.blocked[0]?.reason}
          >
            {blocked} incomplete
          </span>
        ) : null}
      </div>

      <div className="mt-auto flex items-center gap-2 pt-3">
        <button
          type="button"
          onClick={onPreview}
          disabled={playable === 0}
          className="h5p-tappable inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#4f46e5] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#4338ca] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
        >
          <Play className="h-3.5 w-3.5" />
          Preview
        </button>
        <button
          type="button"
          onClick={onOpen}
          disabled={playable === 0}
          className="h5p-tappable inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
          title="Open the first playable question on its own page"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open player
        </button>
      </div>
    </div>
  );
}
