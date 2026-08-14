'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, RefreshCw, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import NewPalNav from '@/app/pal/new/_components/NewPalNav';
import MisconceptionCard from '@/app/pal/new/_components/MisconceptionCard';
import {
  fetchMisconceptionLibrary,
  humanise,
  severityTone,
  type MisconceptionLibrary,
} from '@/app/pal/new/data/content-model';

/**
 * Type 3 — the misconception library for a whole chapter.
 *
 * Ordered by priority, because that is the order a content lead should work in.
 * The C6 check leads: an approved misconception with no corrective behind it
 * can be detected but never answered, and that is worse than not detecting it.
 */
export default function MisconceptionLibraryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading library…
        </div>
      }
    >
      <MisconceptionLibraryContent />
    </Suspense>
  );
}

function MisconceptionLibraryContent() {
  const searchParams = useSearchParams();
  const semanticId = Number(searchParams?.get('chapter') ?? 0);

  const [library, setLibrary] = useState<MisconceptionLibrary | null>(null);
  const [severity, setSeverity] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!semanticId) {
        setError('No chapter was selected.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        setLibrary(await fetchMisconceptionLibrary(semanticId, {}, signal));
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setError((err as Error).message || 'Could not load the misconception library.');
      } finally {
        setLoading(false);
      }
    },
    [semanticId]
  );

  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      await load(controller.signal);
    };
    void run();
    return () => controller.abort();
  }, [load]);

  const visible = useMemo(() => {
    if (!library) return [];
    const term = search.trim().toLowerCase();
    return library.entries.filter((entry) => {
      if (severity && entry.severity !== severity) return false;
      if (
        term &&
        !entry.title.toLowerCase().includes(term) &&
        !entry.tag.toLowerCase().includes(term) &&
        !entry.conceptName.toLowerCase().includes(term)
      ) {
        return false;
      }
      return true;
    });
  }, [library, severity, search]);

  return (
    <div className="min-h-full px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-[1800px] space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Link href={`/pal/new/content-model/chapter?id=${semanticId}`}>
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Chapter
              </Button>
            </Link>
            <div>
              <h1 className="text-[22px] font-semibold text-[#1F2A44]">Misconception library</h1>
              <p className="mt-0.5 text-sm text-slate-500">
                Every known error for this chapter, what causes it, and the corrective content that
                answers it.
              </p>
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <NewPalNav />

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {loading && !library ? (
          <div className="flex items-center justify-center rounded-2xl border border-[#DFE6F2] bg-white py-16">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            <span className="ml-2 text-sm text-slate-500">Projecting the library…</span>
          </div>
        ) : null}

        {library ? (
          <>
            <div
              className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${
                library.c6Pass
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-rose-200 bg-rose-50 text-rose-800'
              }`}
            >
              {library.c6Pass ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <div>
                {library.c6Pass ? (
                  <>
                    <span className="font-semibold">Library is safe to serve.</span> All{' '}
                    {library.total} entries have corrective content behind them.
                  </>
                ) : (
                  <>
                    <span className="font-semibold">
                      {library.c6Violations.length} of {library.total} entries have no corrective
                      content.
                    </span>{' '}
                    These can be detected but not answered.
                    {library.c6Violations.length > 0 ? (
                      <span className="mt-1 block font-mono text-xs">
                        {library.c6Violations
                          .slice(0, 6)
                          .map((v) => v.tag)
                          .join(', ')}
                        {library.c6Violations.length > 6
                          ? ` +${library.c6Violations.length - 6} more`
                          : ''}
                      </span>
                    ) : null}
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#DFE6F2] bg-white p-4">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSeverity('')}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                    severity === ''
                      ? 'border-indigo-600 bg-indigo-600 text-white'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  All ({library.total})
                </button>
                {Object.entries(library.bySeverity).map(([key, count]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSeverity(severity === key ? '' : key)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                      severity === key ? 'border-indigo-600 bg-indigo-600 text-white' : severityTone(key)
                    }`}
                  >
                    {humanise(key)} ({count})
                  </button>
                ))}
              </div>

              <div className="relative ml-auto">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search tag, title or concept"
                  className="h-9 w-72 rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-indigo-400"
                />
              </div>
            </div>

            {visible.length === 0 ? (
              <p className="rounded-2xl border border-[#DFE6F2] bg-white px-4 py-10 text-center text-sm text-slate-500">
                {library.total === 0
                  ? 'No misconceptions were extracted for this chapter.'
                  : 'No misconception matches these filters.'}
              </p>
            ) : (
              <div className="space-y-3">
                {visible.map((entry) => (
                  <MisconceptionCard key={entry.nodeKey} entry={entry} showConcept />
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
