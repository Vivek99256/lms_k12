'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Download,
  Eye,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  deleteDragDrop,
  exportDragDropPackage,
  fetchDragDrops,
  h5pContextQuery,
  hasH5pContext,
  importDragDropPackage,
  isStudentProfile,
  publishDragDrop,
  readH5pContext,
  type H5pDragDrop,
} from '../data/h5p';
import {
  EmptyState,
  H5pPageHeader,
  InlineBanner,
  LoadingState,
  MissingContextNotice,
} from '../components/shared';
import { QuestionBankSource } from '../components/question-bank-source';
import { NO_BANK_SOURCE_REASON } from '../data/question-bank-source';
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
 * Drag and drop — list page.
 *
 * Follows the scenario list it sits beside, with two things that type does not
 * have: a draft/published state, and .h5p package exchange. Both are teacher-
 * only; a student reaching this route sees published activities and view links,
 * because the API already filters drafts out for them.
 */
function statusChip(task: H5pDragDrop) {
  const published = task.status === 'published';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
        published ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
      }`}
    >
      {published ? 'Published' : 'Draft'}
    </span>
  );
}

function DragDropListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ctx = useMemo(
    () => readH5pContext(new URLSearchParams(searchParams?.toString())),
    [searchParams]
  );
  const contextQuery = h5pContextQuery(ctx);
  const importInputRef = useRef<HTMLInputElement>(null);

  const [tasks, setTasks] = useState<H5pDragDrop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [isStudent, setIsStudent] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setIsStudent(isStudentProfile());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Flash forwarded from create/edit; show it, then strip it from the URL.
  const flash = searchParams?.get('flash');
  useEffect(() => {
    if (!flash) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setSuccess(flash);
    });
    router.replace(`/h5p/h5p_drag_drop?${h5pContextQuery(ctx)}`);
    return () => {
      cancelled = true;
    };
  }, [flash, ctx, router]);

  const load = useCallback(() => {
    if (!hasH5pContext(ctx)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    fetchDragDrops(ctx)
      .then(setTasks)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load activities');
      })
      .finally(() => setLoading(false));
  }, [ctx]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) load();
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return tasks;
    return tasks.filter(
      (task) =>
        (task.title ?? '').toLowerCase().includes(term) ||
        (task.task_description ?? '').toLowerCase().includes(term)
    );
  }, [tasks, search]);

  const handleDelete = async (task: H5pDragDrop) => {
    if (!window.confirm(`Delete "${task.title}"? This cannot be undone from here.`)) return;
    setBusyId(task.id);
    setError('');
    setSuccess('');
    try {
      const result = await deleteDragDrop(task.id, ctx);
      setSuccess(result.message);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete activity');
    } finally {
      setBusyId(null);
    }
  };

  const handlePublish = async (task: H5pDragDrop) => {
    setBusyId(task.id);
    setError('');
    setSuccess('');
    try {
      const result = await publishDragDrop(task.id, ctx, task.status !== 'published');
      setSuccess(result.message);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to change publish state');
    } finally {
      setBusyId(null);
    }
  };

  const handleExport = async (task: H5pDragDrop) => {
    setBusyId(task.id);
    setError('');
    try {
      await exportDragDropPackage(task.id, ctx);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to export package');
    } finally {
      setBusyId(null);
    }
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    setError('');
    setSuccess('');
    try {
      const result = await importDragDropPackage(ctx, file);
      // Warnings are about missing media, not failure: the activity imported, and
      // the author needs to know which images did not come with it.
      setSuccess(
        result.warnings.length > 0
          ? `${result.message} ${result.warnings.join(' ')}`
          : result.message
      );
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to import package');
    } finally {
      setImporting(false);
    }
  };

  const createButton = (
    <Link
      href={`/h5p/h5p_drag_drop/create?${contextQuery}`}
      className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700"
    >
      <Plus className="h-3.5 w-3.5" />
      Add activity
    </Link>
  );

  return (
    <div className="p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <H5pPageHeader
          title="Drag and drop"
          description="Learners can drag text or images into correct drop zones"
          ctx={ctx}
          backHref={`/h5p/html_contents?${contextQuery}`}
          actions={
            !isStudent ? (
              <>
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">
                  {importing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  Import .h5p
                  <input
                    ref={importInputRef}
                    type="file"
                    accept=".h5p,application/zip"
                    className="sr-only"
                    disabled={importing}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) void handleImport(file);
                    }}
                  />
                </label>
                {createButton}
              </>
            ) : null
          }
        />

        {!hasH5pContext(ctx) ? (
          <MissingContextNotice />
        ) : (
          <>
            <InlineBanner kind="success" message={success} onDismiss={() => setSuccess('')} />
            <InlineBanner kind="error" message={error} onDismiss={() => setError('')} />

            {/*
              No bank tab on this type, and the reason said out loud.

              Every other H5P content type can ask questions straight out of
              `lms_question_master`. This one cannot, and a page that simply
              lacked the tab would read as an oversight. What is missing is
              named instead — it is a gap in what the bank RECORDS, not in
              this screen, and it is the thing that would have to change.
            */}
            <div className="mb-4">
              <QuestionBankSource kind={null} unavailableReason={NO_BANK_SOURCE_REASON['h5p_drag_drop']} ctx={ctx} noun="drag and drop activity" />
            </div>

            {loading ? (
              <LoadingState label="Loading activities…" />
            ) : tasks.length === 0 ? (
              <EmptyState
                title="No drag and drop activities yet"
                hint="Build one on a background image, or import an existing .h5p package."
                action={!isStudent ? createButton : undefined}
              />
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="relative w-full max-w-xs">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search by title or instruction…"
                      className="pl-8"
                    />
                  </div>
                  <span className="shrink-0 text-xs text-slate-500">
                    {filtered.length} of {tasks.length}
                  </span>
                </div>

                {filtered.length === 0 ? (
                  <p className="py-10 text-center text-sm text-slate-500">
                    No activities match your search.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-slate-600">Preview</TableHead>
                        <TableHead className="text-slate-600">Title</TableHead>
                        <TableHead className="text-slate-600">Zones</TableHead>
                        <TableHead className="text-slate-600">Draggables</TableHead>
                        <TableHead className="text-slate-600">Pass mark</TableHead>
                        <TableHead className="text-slate-600">Status</TableHead>
                        <TableHead className="text-right text-slate-600">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((task) => (
                        <TableRow key={task.id}>
                          <TableCell>
                            {task.background_image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={task.background_image}
                                alt=""
                                className="h-12 w-20 rounded-lg border border-slate-200 object-cover"
                              />
                            ) : (
                              <div className="flex h-12 w-20 items-center justify-center rounded-lg border border-dashed border-slate-300 text-[10px] text-slate-400">
                                No image
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-medium text-slate-800">{task.title}</TableCell>
                          <TableCell className="text-slate-600">{task.zones?.length ?? 0}</TableCell>
                          <TableCell className="text-slate-600">{task.elements?.length ?? 0}</TableCell>
                          <TableCell className="tabular-nums text-slate-600">
                            {task.pass_percentage}%
                          </TableCell>
                          <TableCell>{statusChip(task)}</TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <Link
                                href={`/h5p/h5p_drag_drop/${task.id}?${contextQuery}`}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-indigo-600"
                                aria-label={`Open ${task.title}`}
                                title="Open"
                              >
                                <Eye className="h-4 w-4" />
                              </Link>

                              {!isStudent ? (
                                <>
                                  <Link
                                    href={`/h5p/h5p_drag_drop/${task.id}/edit?${contextQuery}`}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-indigo-600"
                                    aria-label={`Edit ${task.title}`}
                                    title="Edit"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Link>

                                  <button
                                    type="button"
                                    onClick={() => void handleExport(task)}
                                    disabled={busyId === task.id}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-indigo-600 disabled:opacity-50"
                                    aria-label={`Export ${task.title} as an H5P package`}
                                    title="Export .h5p"
                                  >
                                    <Download className="h-4 w-4" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => void handlePublish(task)}
                                    disabled={busyId === task.id}
                                    className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 px-2 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                                  >
                                    {busyId === task.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : task.status === 'published' ? (
                                      'Unpublish'
                                    ) : (
                                      'Publish'
                                    )}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => void handleDelete(task)}
                                    disabled={busyId === task.id}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                                    aria-label={`Delete ${task.title}`}
                                    title="Delete"
                                  >
                                    <Trash2 className="h-4 w-4" />
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

export default function DragDropListPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading activities…" />}>
      <DragDropListContent />
    </Suspense>
  );
}
