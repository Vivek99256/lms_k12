'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import {
  deleteScenario,
  fetchScenarios,
  h5pContextQuery,
  hasH5pContext,
  isStudentProfile,
  readH5pContext,
  type H5pScenario,
} from '../data/h5p';
import {
  EmptyState,
  H5pPageHeader,
  InlineBanner,
  LoadingState,
  MissingContextNotice,
} from '../components/shared';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

/**
 * Scenario based learning — list page.
 * Mirrors Laravel `resources/views/lms/h5p/scenario/index.blade.php`.
 */

function stripHtml(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(text: string, max = 50): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function ScenarioListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ctx = useMemo(
    () => readH5pContext(new URLSearchParams(searchParams?.toString())),
    [searchParams]
  );
  const contextQuery = h5pContextQuery(ctx);

  const [scenarios, setScenarios] = useState<H5pScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [isStudent, setIsStudent] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setIsStudent(isStudentProfile());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Flash message forwarded from create/edit; show it, then strip it from the URL.
  const flash = searchParams?.get('flash');
  useEffect(() => {
    if (flash) {
      let cancelled = false;
      queueMicrotask(() => {
        if (!cancelled) setSuccess(flash);
      });
      router.replace(`/h5p/scenario_based?${h5pContextQuery(ctx)}`);
      return () => {
        cancelled = true;
      };
    }
  }, [flash, ctx, router]);

  const loadScenarios = useCallback(() => {
    if (!hasH5pContext(ctx)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    fetchScenarios(ctx)
      .then(setScenarios)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load scenarios');
      })
      .finally(() => setLoading(false));
  }, [ctx]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) loadScenarios();
    });
    return () => {
      cancelled = true;
    };
  }, [loadScenarios]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return scenarios;
    return scenarios.filter(
      (scenario) =>
        scenario.title.toLowerCase().includes(term) ||
        stripHtml(scenario.description).toLowerCase().includes(term)
    );
  }, [scenarios, search]);

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this scenario?')) return;
    setDeletingId(id);
    setError('');
    setSuccess('');
    try {
      const result = await deleteScenario(id, ctx);
      setSuccess(result.message);
      loadScenarios();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete scenario');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <H5pPageHeader
          title="Scenario based learning"
          description="Interactive image scenarios with clickable points of interest"
          ctx={ctx}
          backHref={`/h5p/html_contents?${contextQuery}`}
          actions={
            !isStudent ? (
              <Link
                href={`/h5p/scenario_based/create?${contextQuery}`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#4f46e5] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#4338ca]"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Scenario
              </Link>
            ) : null
          }
        />

        {!hasH5pContext(ctx) ? (
          <MissingContextNotice />
        ) : (
          <>
            <InlineBanner kind="success" message={success} onDismiss={() => setSuccess('')} />
            <InlineBanner kind="error" message={error} onDismiss={() => setError('')} />

            {loading ? (
              <LoadingState label="Loading scenarios…" />
            ) : scenarios.length === 0 ? (
              <EmptyState
                title="No scenarios yet"
                hint="Create an image-based scenario with interactive points for this chapter."
                action={
                  !isStudent ? (
                    <Link
                      href={`/h5p/scenario_based/create?${contextQuery}`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#4f46e5] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#4338ca]"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Scenario
                    </Link>
                  ) : undefined
                }
              />
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="relative w-full max-w-xs">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search by title or description…"
                      className="pl-8"
                    />
                  </div>
                  <span className="shrink-0 text-xs text-slate-500">
                    {filtered.length} of {scenarios.length}
                  </span>
                </div>

                {filtered.length === 0 ? (
                  <p className="py-10 text-center text-sm text-slate-500">
                    No scenarios match your search.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-slate-600">SR No</TableHead>
                        <TableHead className="text-slate-600">File</TableHead>
                        <TableHead className="text-slate-600">Title</TableHead>
                        <TableHead className="text-slate-600">Description</TableHead>
                        <TableHead className="text-slate-600">Total Points</TableHead>
                        <TableHead className="text-right text-slate-600">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((scenario, index) => (
                        <TableRow key={scenario.id}>
                          <TableCell className="text-slate-600">{index + 1}</TableCell>
                          <TableCell>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={scenario.file_path}
                              alt={scenario.title}
                              className="h-16 w-16 rounded-lg border border-slate-200 object-cover"
                            />
                          </TableCell>
                          <TableCell className="font-medium text-slate-800">
                            {scenario.title}
                          </TableCell>
                          <TableCell className="max-w-[220px] whitespace-normal text-slate-500">
                            {truncate(stripHtml(scenario.description)) || '—'}
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {scenario.points?.length ?? 0}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <Link
                                href={`/h5p/scenario_based/${scenario.id}?${contextQuery}`}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-indigo-600"
                                aria-label="View scenario"
                                title="View"
                              >
                                <Eye className="h-4 w-4" />
                              </Link>
                              {!isStudent ? (
                                <>
                                  <Link
                                    href={`/h5p/scenario_based/${scenario.id}/edit?${contextQuery}`}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-indigo-600"
                                    aria-label="Edit scenario"
                                    title="Edit"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Link>
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(scenario.id)}
                                    disabled={deletingId === scenario.id}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                                    aria-label="Delete scenario"
                                    title="Delete"
                                  >
                                    {deletingId === scenario.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-4 w-4" />
                                    )}
                                  </button>
                                </>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function ScenarioListPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading scenarios…" />}>
      <ScenarioListContent />
    </Suspense>
  );
}
