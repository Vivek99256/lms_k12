'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Brain,
  Database,
  Layers,
  Loader2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { SUB_MODULES } from '@/app/pal/new/_components/NewPalNav';
import {
  fetchEstateCoverage,
  scoreTone,
  type EstateCoverage,
} from '@/app/pal/new/data/content-model';

/**
 * New PAL — module overview.
 *
 * Answers one question before the user goes anywhere: how much extracted
 * chapter intelligence is actually behind this module, and which sub-modules
 * can do something with it. Every number is read from the API.
 */
export default function NewPalPage() {
  const [coverage, setCoverage] = useState<EstateCoverage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      setCoverage(await fetchEstateCoverage(signal));
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError((err as Error).message || 'Could not load the New PAL overview.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      await load(controller.signal);
    };
    void run();
    return () => controller.abort();
  }, [load]);

  return (
    <div className="min-h-full px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-[1800px] space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Brain className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-[22px] font-semibold text-[#1F2A44]">New PAL</h1>
              <p className="mt-0.5 text-sm text-slate-500">
                The PAL V4 intelligence layer, built on the chapter data your extraction pipeline has
                already produced.
              </p>
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/*
          No sub-module bar here. DashboardShell already renders the New PAL
          sub-nav above every /pal route, so a second one on this page was the
          same navigation twice on one screen. The sub-module CARDS below still
          read SUB_MODULES, so the roadmap stays visible.
        */}

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {loading && !coverage ? (
          <div className="flex items-center justify-center rounded-2xl border border-[#DFE6F2] bg-white py-16">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            <span className="ml-2 text-sm text-slate-500">Loading extracted estate…</span>
          </div>
        ) : null}

        {coverage ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <SourceTile
                icon={<Database className="h-4 w-4" />}
                label="Extracted chapters"
                value={coverage.chapters.toLocaleString('en-IN')}
                hint={`Source: ${coverage.sourceTable}`}
              />
              <SourceTile
                icon={<Layers className="h-4 w-4" />}
                label="Concepts extracted"
                value={coverage.concepts.toLocaleString('en-IN')}
                hint="Each projects its own 4-type model"
              />
              <SourceTile
                icon={<BookOpen className="h-4 w-4" />}
                label="Practice questions available"
                value={(coverage.itemTotals.blueprint_items ?? 0).toLocaleString('en-IN')}
                hint={`${(coverage.itemTotals.misconceptions ?? 0).toLocaleString('en-IN')} misconceptions extracted`}
              />
              <SourceTile
                icon={<Sparkles className="h-4 w-4" />}
                label="AI enrichment"
                value={coverage.aiAvailable ? 'Available' : 'Unavailable'}
                hint={
                  coverage.aiAvailable
                    ? `${coverage.cachedEnrichments.toLocaleString('en-IN')} cached results`
                    : 'See the reason below'
                }
                tone={coverage.aiAvailable ? 'good' : 'warn'}
              />
            </div>

            {!coverage.aiAvailable && coverage.aiUnavailableReason ? (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <span className="font-semibold">AI enrichment is off.</span>{' '}
                  {coverage.aiUnavailableReason} Everything derivable from the extraction still works
                  — only the framework tags, cultural-context fallback and translation need a
                  provider.
                </div>
              </div>
            ) : null}

            {/* what the extraction can feed */}
            <div className="rounded-2xl border border-[#DFE6F2] bg-white p-5 shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
              <h2 className="text-[15px] font-semibold text-[#1F2A44]">
                What the extracted data can serve
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Each of the four PAL V4 content types is built from a different section of the
                extraction. A type is only projectable where that section was produced.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {coverage.fourTypeModel.map((type) => (
                  <div key={type.key} className="rounded-xl border border-slate-100 p-4">
                    <p className="text-sm font-medium text-slate-800">{type.label}</p>
                    <p className={`mt-2 text-[26px] font-semibold leading-none ${scoreTone(type.coveragePct)}`}>
                      {type.coveragePct}%
                    </p>
                    <p className="mt-1.5 text-xs text-slate-500">
                      {type.chaptersCovered} of {coverage.chapters} chapters
                    </p>
                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-indigo-500"
                        style={{ width: `${Math.min(100, type.coveragePct)}%` }}
                      />
                    </div>
                    <p className="mt-2 font-mono text-[11px] text-slate-400">{type.source}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* sub-modules */}
            <div className="grid gap-4 lg:grid-cols-2">
              {SUB_MODULES.map((sub) => {
                const Icon = sub.icon;
                const card = (
                  <div
                    className={`flex h-full flex-col rounded-2xl border bg-white p-5 shadow-[0_8px_18px_rgba(15,23,42,0.05)] ${
                      sub.available
                        ? 'border-[#DFE6F2] transition-colors hover:border-indigo-300'
                        : 'border-dashed border-slate-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                          sub.available ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-[15px] font-semibold text-[#1F2A44]">{sub.label}</h3>
                          {!sub.available ? (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                              Not built yet
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm text-slate-500">{sub.description}</p>
                      </div>
                      {sub.available ? (
                        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-300" />
                      ) : null}
                    </div>

                    {sub.available && sub.key === 'content-model' ? (
                      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                        <Pill label={`${coverage.chapters} chapters`} />
                        <Pill label={`${coverage.concepts.toLocaleString('en-IN')} concepts`} />
                        <Pill label={`${coverage.languages.length} languages`} />
                        <Pill label={`${coverage.culturalVocabulary.length} cultural contexts`} />
                        <Pill label={`${coverage.nodesTouched} nodes authored`} />
                      </div>
                    ) : null}
                  </div>
                );

                return sub.available ? (
                  <Link key={sub.key} href={sub.href} className="block">
                    {card}
                  </Link>
                ) : (
                  <div key={sub.key}>{card}</div>
                );
              })}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function Pill({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
      {label}
    </span>
  );
}

function SourceTile({
  icon,
  label,
  value,
  hint,
  tone = 'default',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'good' | 'warn';
}) {
  const toneClass =
    tone === 'good' ? 'text-emerald-600' : tone === 'warn' ? 'text-amber-600' : 'text-slate-900';

  return (
    <div className="rounded-2xl border border-[#DFE6F2] bg-white p-5 shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-slate-500">{label}</p>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          {icon}
        </div>
      </div>
      <p className={`mt-3 text-[28px] font-semibold leading-none ${toneClass}`}>{value}</p>
      {hint ? <p className="mt-2 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}
