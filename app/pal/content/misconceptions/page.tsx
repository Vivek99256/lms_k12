'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  RefreshCw,
  Search,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  fetchMisconceptionDetail,
  fetchMisconceptions,
  type MisconceptionCorrectiveItem,
  type MisconceptionItem,
} from '@/app/pal/data/pal-content';

/**
 * PAL V4 Content Intelligence — misconception library.
 *
 * Each entry pairs an error pattern with the corrective content served when a
 * learner hits it. The routing rule that makes this worth having: on a match the
 * engine serves a DIFFERENT modality, never the explanation that already failed.
 *
 * The `c6Ok` flag is the one to watch. An entry with no approved corrective can
 * be detected but not acted on, which is worse than not detecting it — the API
 * refuses to approve such an entry, and this screen flags it.
 *
 * Read-only by design. Authoring correctives means writing teaching content,
 * which belongs in the content authoring tools, not a review list.
 */

interface DetailState {
  correctives: MisconceptionCorrectiveItem[];
  loading: boolean;
  error: string;
}

function statusTone(status: string): string {
  if (status === 'approved') return 'bg-emerald-50 text-emerald-700';
  if (status === 'deprecated') return 'bg-slate-100 text-slate-600';
  return 'bg-amber-50 text-amber-700';
}

export default function PalMisconceptionsPage() {
  const [items, setItems] = useState<MisconceptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [query, setQuery] = useState('');
  const [subject, setSubject] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [details, setDetails] = useState<Record<number, DetailState>>({});

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      setItems(await fetchMisconceptions({ limit: 200 }, signal));
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError((err as Error).message || 'Could not load the misconception library.');
      setItems([]);
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

  const subjects = useMemo(
    () => Array.from(new Set(items.map((i) => i.subject).filter(Boolean))).sort(),
    [items]
  );

  // Filtered client-side: the whole library is a few hundred rows at most, and
  // a round trip per keystroke would be worse than the filtering cost.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (subject && item.subject !== subject) return false;
      if (!q) return true;
      return (
        item.tag.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.errorPattern.toLowerCase().includes(q)
      );
    });
  }, [items, query, subject]);

  const c6Failures = useMemo(() => items.filter((i) => !i.c6Ok).length, [items]);

  const openDetail = async (item: MisconceptionItem) => {
    if (expanded === item.id) {
      setExpanded(null);
      return;
    }
    setExpanded(item.id);

    if (details[item.id]?.correctives) return;

    setDetails((prev) => ({ ...prev, [item.id]: { correctives: [], loading: true, error: '' } }));
    try {
      const detail = await fetchMisconceptionDetail(item.id);
      setDetails((prev) => ({
        ...prev,
        [item.id]: { correctives: detail.correctives, loading: false, error: '' },
      }));
    } catch (err) {
      setDetails((prev) => ({
        ...prev,
        [item.id]: { correctives: [], loading: false, error: (err as Error).message },
      }));
    }
  };

  return (
    <div className="min-h-full px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-[1800px] space-y-5">
        {/* header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Link href="/pal/content">
              <Button variant="outline" size="sm" className="mt-0.5">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-[22px] font-semibold text-[#1F2A44]">Misconception library</h1>
              <p className="mt-0.5 text-sm text-slate-500">
                Known error patterns and the corrective content served when a learner hits one.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <div className="flex items-start gap-2.5 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            When a wrong answer matches one of these patterns, the engine serves the linked corrective
            in a <span className="font-semibold">different format</span> — it never repeats the
            explanation that already failed.
          </span>
        </div>

        {/* filters */}
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#DFE6F2] bg-white px-4 py-3 shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tag, description or error pattern"
              className="pl-9"
            />
          </div>
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm"
          >
            <option value="">All subjects</option>
            {subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <span className="ml-auto text-xs text-slate-500">
            {visible.length} of {items.length}
          </span>
        </div>

        {c6Failures > 0 ? (
          <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <span className="font-semibold">{c6Failures} entr{c6Failures === 1 ? 'y has' : 'ies have'} no corrective content.</span>{' '}
              They cannot be served until at least one corrective is added and approved.
            </span>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {/* list */}
        {loading ? (
          <div className="flex items-center justify-center rounded-2xl border border-[#DFE6F2] bg-white py-16">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            <span className="ml-2 text-sm text-slate-500">Loading library…</span>
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border border-[#DFE6F2] bg-white px-6 py-14 text-center">
            <p className="text-sm font-medium text-slate-700">No misconceptions found.</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
              Run <code className="rounded bg-slate-100 px-1">php artisan pal:seed-misconceptions</code>{' '}
              on the server to load the starter library.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[#DFE6F2] bg-white shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
            <ul className="divide-y divide-slate-100">
              {visible.map((item) => {
                const isOpen = expanded === item.id;
                const detail = details[item.id];

                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => void openDetail(item)}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50"
                    >
                      <span className="mt-0.5 shrink-0 text-slate-400">
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2">
                          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px] text-slate-800">
                            {item.tag}
                          </code>
                          {!item.c6Ok ? (
                            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                              no corrective
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-1 truncate text-sm text-slate-600">{item.description}</p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
                          {item.subject ? <span>{item.subject}</span> : null}
                          {item.gradeBand ? <span>grade {item.gradeBand}</span> : null}
                          {item.prevalenceRate !== null ? (
                            <span>{Math.round(item.prevalenceRate * 100)}% of students</span>
                          ) : null}
                          <span>{item.correctiveCount} corrective(s)</span>
                          {item.detectionCount > 0 ? (
                            <span>detected {item.detectionCount}×</span>
                          ) : null}
                        </p>
                      </div>

                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusTone(item.qualityStatus)}`}
                      >
                        {item.qualityStatus}
                      </span>
                    </button>

                    {isOpen ? (
                      <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-4">
                        <div className="grid gap-5 lg:grid-cols-2">
                          <div className="space-y-3 text-sm">
                            {item.errorPattern ? (
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                  Error pattern
                                </p>
                                <p className="mt-1 text-slate-700">{item.errorPattern}</p>
                              </div>
                            ) : null}

                            {item.correctiveAction ? (
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                  Corrective approach
                                </p>
                                <p className="mt-1 text-slate-700">{item.correctiveAction}</p>
                              </div>
                            ) : null}

                            {item.typicalWrongAnswers.length > 0 ? (
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                  Detected on these answers
                                </p>
                                <p className="mt-1.5 flex flex-wrap gap-1.5">
                                  {item.typicalWrongAnswers.map((w) => (
                                    <code
                                      key={w}
                                      className="rounded bg-white px-1.5 py-0.5 font-mono text-xs text-slate-700 ring-1 ring-slate-200"
                                    >
                                      {w}
                                    </code>
                                  ))}
                                </p>
                              </div>
                            ) : null}
                          </div>

                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                              Corrective content
                            </p>

                            {detail?.loading ? (
                              <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading…
                              </div>
                            ) : detail?.error ? (
                              <p className="mt-2 text-sm text-rose-600">{detail.error}</p>
                            ) : detail?.correctives.length === 0 ? (
                              <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
                                No corrective content. This entry can never be served.
                              </div>
                            ) : (
                              <ul className="mt-2 space-y-2">
                                {detail?.correctives.map((c) => (
                                  <li
                                    key={c.id}
                                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                                  >
                                    <p className="flex flex-wrap items-center gap-2">
                                      <span className="text-sm font-medium text-slate-800">
                                        {c.title}
                                      </span>
                                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                                        {c.format.replace(/_/g, ' ')}
                                      </span>
                                      <span
                                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusTone(c.qualityStatus)}`}
                                      >
                                        {c.qualityStatus}
                                      </span>
                                    </p>
                                    {c.body ? (
                                      <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                                        {c.body.length > 260 ? `${c.body.slice(0, 260)}…` : c.body}
                                      </p>
                                    ) : null}
                                    <p className="mt-1.5 flex flex-wrap gap-x-3 text-[11px] text-slate-400">
                                      <span>priority {c.priorityLevel}</span>
                                      {c.estimatedDurationMinutes ? (
                                        <span>{c.estimatedDurationMinutes} min</span>
                                      ) : null}
                                      <span>served {c.servedCount}×</span>
                                      {c.resolutionRate !== null ? (
                                        <span>resolved {Math.round(c.resolutionRate * 100)}%</span>
                                      ) : null}
                                    </p>
                                  </li>
                                ))}
                              </ul>
                            )}

                            {detail && detail.correctives.length > 1 ? (
                              <p className="mt-2 flex items-start gap-1.5 text-[11px] text-slate-500">
                                <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
                                Multiple formats available — a learner who fails the first gets the next
                                one, not a repeat.
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
