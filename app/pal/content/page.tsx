'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Terminal,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  fetchContentCoverage,
  fetchContentVocabulary,
  fetchReviewQueue,
  type ContentCoverage,
  type ContentVocabulary,
  type ReviewItem,
} from '@/app/pal/data/pal-content';

/**
 * PAL V4 Content Intelligence — coverage dashboard.
 *
 * Answers three questions a content lead actually has:
 *   how much of our estate is tagged, how much of it is approved (i.e. can
 *   actually be served), and is the misconception library safe to serve.
 *
 * Deliberately read-only. Approving happens in the review queue, where the
 * reviewer can see the item they are approving.
 */

interface DashboardState {
  coverage: ContentCoverage | null;
  vocabulary: ContentVocabulary | null;
  sample: ReviewItem[];
}

function formatNumber(value: number): string {
  return value.toLocaleString('en-IN');
}

function StatTile({
  icon,
  label,
  value,
  hint,
  tone = 'default',
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'good' | 'warn' | 'bad';
}) {
  const toneClass =
    tone === 'good'
      ? 'text-emerald-600'
      : tone === 'warn'
        ? 'text-amber-600'
        : tone === 'bad'
          ? 'text-rose-600'
          : 'text-slate-900';

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

function ProgressBar({ pct, tone = 'indigo' }: { pct: number; tone?: 'indigo' | 'emerald' }) {
  const width = Math.max(0, Math.min(100, pct));
  return (
    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className={`h-full rounded-full ${tone === 'emerald' ? 'bg-emerald-500' : 'bg-indigo-500'}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

export default function PalContentDashboardPage() {
  const [state, setState] = useState<DashboardState>({ coverage: null, vocabulary: null, sample: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      // The review sample is a nice-to-have; a failure there must not blank the
      // whole dashboard, so it is settled separately from the two that matter.
      const [coverage, vocabulary] = await Promise.all([
        fetchContentCoverage(signal),
        fetchContentVocabulary(signal),
      ]);

      let sample: ReviewItem[] = [];
      try {
        const queue = await fetchReviewQueue('question', { status: 'draft', limit: 5 }, signal);
        sample = queue.items;
      } catch {
        sample = [];
      }

      setState({ coverage, vocabulary, sample });
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError((err as Error).message || 'Could not load Content Intelligence data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    // Defined inside the effect so the state updates happen in an async callback
    // rather than synchronously in the effect body (react-hooks/set-state-in-effect).
    const run = async () => {
      await load(controller.signal);
    };
    void run();
    return () => controller.abort();
  }, [load]);

  const coverage = state.coverage;
  const health = coverage?.misconceptions;
  const pendingReview = state.sample.length;

  return (
    <div className="min-h-full px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-[1800px] space-y-5">
        {/* header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Brain className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-[22px] font-semibold text-[#1F2A44]">Content Intelligence</h1>
              <p className="mt-0.5 text-sm text-slate-500">
                Metadata coverage, quality pipeline and misconception library for this institute.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Link href="/pal/content/review">
              <Button size="sm">
                <ClipboardCheck className="mr-1.5 h-4 w-4" />
                Review queue
              </Button>
            </Link>
            <Link href="/pal/content/misconceptions">
              <Button variant="outline" size="sm">
                <AlertTriangle className="mr-1.5 h-4 w-4" />
                Misconceptions
              </Button>
            </Link>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {loading && !coverage ? (
          <div className="flex items-center justify-center rounded-2xl border border-[#DFE6F2] bg-white py-16">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            <span className="ml-2 text-sm text-slate-500">Loading coverage…</span>
          </div>
        ) : null}

        {coverage ? (
          <>
            {/* headline tiles */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-[#DFE6F2] bg-white p-5 shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[13px] font-medium text-slate-500">Questions tagged</p>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <FileText className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-3 text-[28px] font-semibold leading-none text-slate-900">
                  {formatNumber(coverage.questions.tagged)}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  of {formatNumber(coverage.questions.total)} · {coverage.questions.coveragePct}%
                </p>
                <ProgressBar pct={coverage.questions.coveragePct} />
              </div>

              <div className="rounded-2xl border border-[#DFE6F2] bg-white p-5 shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[13px] font-medium text-slate-500">Content tagged</p>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <FileText className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-3 text-[28px] font-semibold leading-none text-slate-900">
                  {formatNumber(coverage.content.tagged)}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  of {formatNumber(coverage.content.total)} · {coverage.content.coveragePct}%
                </p>
                <ProgressBar pct={coverage.content.coveragePct} tone="emerald" />
              </div>

              <StatTile
                icon={<ShieldCheck className="h-4 w-4" />}
                label="Approved & servable"
                value={formatNumber(coverage.questions.approved + coverage.content.approved)}
                hint="Only approved content is ever shown to a learner"
                tone={coverage.questions.approved + coverage.content.approved > 0 ? 'good' : 'warn'}
              />

              <StatTile
                icon={<AlertTriangle className="h-4 w-4" />}
                label="Misconception library"
                value={formatNumber(health?.total ?? 0)}
                hint={`${health?.approved ?? 0} approved · ${health?.servableWithCorrective ?? 0} servable`}
                tone={health?.c6Pass ? 'good' : 'bad'}
              />
            </div>

            {/* library safety */}
            <div
              className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${
                health?.c6Pass
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-rose-200 bg-rose-50 text-rose-800'
              }`}
            >
              {health?.c6Pass ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <div>
                {health?.c6Pass ? (
                  <>
                    <span className="font-semibold">Library is safe to serve.</span> Every approved
                    misconception has approved corrective content behind it.
                  </>
                ) : (
                  <>
                    <span className="font-semibold">
                      {health?.c6Violations ?? 0} misconception(s) have no corrective content.
                    </span>{' '}
                    These are approved but cannot be served — detecting an error and then showing the
                    learner nothing is worse than not detecting it.
                    {health?.c6ViolationTags?.length ? (
                      <span className="mt-1 block font-mono text-xs">
                        {health.c6ViolationTags.slice(0, 6).join(', ')}
                      </span>
                    ) : null}
                  </>
                )}
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              {/* pending review */}
              <div className="rounded-2xl border border-[#DFE6F2] bg-white p-5 shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-[15px] font-semibold text-[#1F2A44]">Awaiting review</h2>
                  <Link href="/pal/content/review">
                    <Button variant="outline" size="sm">
                      Open queue
                    </Button>
                  </Link>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Machine-proposed tags, least confident first. Nothing here reaches a learner until a
                  person approves it.
                </p>

                {pendingReview === 0 ? (
                  <p className="mt-4 rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                    Nothing pending review.
                  </p>
                ) : (
                  <ul className="mt-4 space-y-2">
                    {state.sample.map((item) => (
                      <li
                        key={item.metadataId}
                        className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm text-slate-800">
                            <span className="font-mono text-xs text-slate-400">#{item.entityId}</span>{' '}
                            {item.title || '(no title)'}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {item.bloomLevel || 'no bloom level'}
                            {item.practiceLevel ? ` · L${item.practiceLevel}` : ''} · tagged by{' '}
                            {item.taggedBy}
                          </p>
                        </div>
                        {item.confidence !== null ? (
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              item.confidence < 0.6
                                ? 'bg-rose-50 text-rose-700'
                                : item.confidence < 0.75
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'bg-emerald-50 text-emerald-700'
                            }`}
                          >
                            {Math.round(item.confidence * 100)}%
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* how to populate */}
              <div className="rounded-2xl border border-[#DFE6F2] bg-white p-5 shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-slate-500" />
                  <h2 className="text-[15px] font-semibold text-[#1F2A44]">Populating this data</h2>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Tagging is a batch job — it processes tens of thousands of rows, so it runs on the
                  server rather than from this screen. Everything it writes arrives here as a draft.
                </p>
                <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-900 px-4 py-3 text-[12px] leading-relaxed text-slate-100">
                  {`php artisan pal:content-coverage --concepts
php artisan pal:tag-content --order-by-usage
php artisan pal:derive-irt
php artisan pal:seed-misconceptions
php artisan pal:vocab-check`}
                </pre>
                {state.vocabulary ? (
                  <p className="mt-3 text-xs text-slate-500">
                    Vocabulary loaded: {state.vocabulary.bloomLevels.length} Bloom levels ·{' '}
                    {state.vocabulary.culturalContexts.length} cultural contexts ·{' '}
                    {state.vocabulary.languages.length} languages ·{' '}
                    {Object.keys(state.vocabulary.pedagogy).length} pedagogy types
                  </p>
                ) : null}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
