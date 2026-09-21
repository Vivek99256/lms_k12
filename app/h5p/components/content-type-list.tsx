'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Copy, Download, Eye, Loader2, Pencil, Plus, Search, Trash2, Upload } from 'lucide-react';
import {
  h5pContextQuery,
  hasH5pContext,
  isStudentProfile,
  readH5pContext,
  type H5pContext,
} from '../data/h5p';
import type { H5pContentRow, H5pContentTypeApi } from '../data/h5p-content-types';
import { EmptyState, H5pPageHeader, InlineBanner, LoadingState, MissingContextNotice } from './shared';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

/**
 * The list page every H5P content type in the 2026-09-21 vertical uses.
 *
 * WHY THIS IS ONE COMPONENT AND NOT FOUR PAGES.
 *
 * Image Hotspots, Memory Game, Course Presentation and Arithmetic Quiz share a
 * controller on the server and a generated API client here, so their list
 * pages differ in exactly three ways: the words at the top, the columns in the
 * middle, and whether there is an import button. Everything else -- the draft
 * and published states, delete with confirmation, duplicate, package exchange,
 * the student filter, the flash-from-create handling, the search box -- is
 * identical, and four copies of it would be four places for the student rule
 * to drift. That rule is the one on this page that must not.
 *
 * A type that needs a genuinely different list writes its own page; nothing
 * here forces this component on it.
 */

export interface ContentTypeColumn<TRow> {
  header: string;
  /** Right-aligned numeric columns get tabular figures; see `numeric`. */
  numeric?: boolean;
  render: (row: TRow) => ReactNode;
}

export interface ContentTypeListProps<TRow extends H5pContentRow> {
  /** Route segment under /h5p, e.g. `h5p_memory_game`. */
  path: string;
  title: string;
  description: string;
  /** "memory game" — used in empty states and confirmations. */
  noun: string;
  emptyHint: string;
  api: H5pContentTypeApi<TRow, never>;
  columns: ContentTypeColumn<TRow>[];
  /** Extra text a search should match, beyond the title. */
  searchText?: (row: TRow) => string;
  /** A type with no media still imports and exports; this is about the button. */
  canImport?: boolean;
}

function StatusChip({ status }: { status: string }) {
  const published = status === 'published';
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

function ContentTypeListInner<TRow extends H5pContentRow>({
  path,
  title,
  description,
  noun,
  emptyHint,
  api,
  columns,
  searchText,
  canImport = true,
}: ContentTypeListProps<TRow>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ctx: H5pContext = useMemo(
    () => readH5pContext(new URLSearchParams(searchParams?.toString())),
    [searchParams]
  );
  const contextQuery = h5pContextQuery(ctx);
  const importInputRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<TRow[]>([]);
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

  // Flash forwarded from create/edit; show it, then strip it from the URL so a
  // reload does not repeat it.
  const flash = searchParams?.get('flash');
  useEffect(() => {
    if (!flash) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setSuccess(flash);
    });
    router.replace(`/h5p/${path}?${h5pContextQuery(ctx)}`);
    return () => {
      cancelled = true;
    };
  }, [flash, ctx, router, path]);

  const load = useCallback(() => {
    if (!hasH5pContext(ctx)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    api
      .list(ctx)
      .then(setRows)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : `Failed to load ${noun}s`);
      })
      .finally(() => setLoading(false));
  }, [ctx, api, noun]);

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
    if (!term) return rows;
    return rows.filter(
      (row) =>
        (row.title ?? '').toLowerCase().includes(term) ||
        (searchText?.(row) ?? '').toLowerCase().includes(term)
    );
  }, [rows, search, searchText]);

  /** Every row action shares this shape: busy, clear banners, reload, report. */
  const run = async (row: TRow, work: () => Promise<string>, fallback: string) => {
    setBusyId(row.id);
    setError('');
    setSuccess('');
    try {
      setSuccess(await work());
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : fallback);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = (row: TRow) => {
    if (!window.confirm(`Delete "${row.title}"? This cannot be undone from here.`)) return;
    void run(row, async () => (await api.remove(row.id, ctx)).message, `Failed to delete ${noun}`);
  };

  const handlePublish = (row: TRow) =>
    void run(
      row,
      async () => (await api.publish(row.id, ctx, row.status !== 'published')).message,
      'Failed to change publish state'
    );

  const handleDuplicate = (row: TRow) =>
    void run(row, async () => (await api.duplicate(row.id, ctx)).message, `Failed to duplicate ${noun}`);

  const handleExport = (row: TRow) =>
    void run(
      row,
      async () => {
        const { warnings } = await api.exportPackage(row.id, ctx);
        // Export notes are not failures. The file downloaded; they say what a
        // host outside this ERP will not be able to render, which the author
        // needs at the moment they hand the file over and never afterwards.
        return warnings.length > 0 ? `Package downloaded. ${warnings.join(' ')}` : 'Package downloaded.';
      },
      'Failed to export package'
    );

  const handleImport = async (file: File) => {
    setImporting(true);
    setError('');
    setSuccess('');
    try {
      const result = await api.importPackage(ctx, file);
      // Warnings are about missing media or an element this ERP cannot edit,
      // not about failure: the item imported, and the author needs to know
      // what did not come with it.
      setSuccess(result.warnings.length > 0 ? `${result.message} ${result.warnings.join(' ')}` : result.message);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to import package');
    } finally {
      setImporting(false);
    }
  };

  const createButton = (
    <Link
      href={`/h5p/${path}/create?${contextQuery}`}
      className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700"
    >
      <Plus className="h-3.5 w-3.5" />
      Add {noun}
    </Link>
  );

  const iconButton =
    'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-indigo-600 disabled:opacity-50';

  return (
    <div className="p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <H5pPageHeader
          title={title}
          description={description}
          ctx={ctx}
          backHref={`/h5p/html_contents?${contextQuery}`}
          actions={
            !isStudent ? (
              <>
                {canImport ? (
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">
                    {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    Import .h5p
                    <input
                      ref={importInputRef}
                      type="file"
                      accept=".h5p,application/zip"
                      className="sr-only"
                      disabled={importing}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        // Cleared before the await so choosing the same file
                        // twice in a row still fires a change event.
                        e.target.value = '';
                        if (file) void handleImport(file);
                      }}
                    />
                  </label>
                ) : null}
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

            {loading ? (
              <LoadingState label={`Loading ${noun}s…`} />
            ) : rows.length === 0 ? (
              <EmptyState
                title={`No ${noun}s yet`}
                hint={emptyHint}
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
                      placeholder="Search by title…"
                      className="pl-8"
                      aria-label={`Search ${noun}s`}
                    />
                  </div>
                  <span className="shrink-0 text-xs text-slate-500">
                    {filtered.length} of {rows.length}
                  </span>
                </div>

                {filtered.length === 0 ? (
                  <p className="py-10 text-center text-sm text-slate-500">No {noun}s match your search.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-slate-600">Title</TableHead>
                        {columns.map((column) => (
                          <TableHead key={column.header} className="text-slate-600">
                            {column.header}
                          </TableHead>
                        ))}
                        <TableHead className="text-slate-600">Status</TableHead>
                        <TableHead className="text-right text-slate-600">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium text-slate-800">{row.title}</TableCell>
                          {columns.map((column) => (
                            <TableCell
                              key={column.header}
                              className={column.numeric ? 'tabular-nums text-slate-600' : 'text-slate-600'}
                            >
                              {column.render(row)}
                            </TableCell>
                          ))}
                          <TableCell>
                            <StatusChip status={String(row.status)} />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <Link
                                href={`/h5p/${path}/${row.id}?${contextQuery}`}
                                className={iconButton}
                                aria-label={`Open ${row.title}`}
                                title="Open"
                              >
                                <Eye className="h-4 w-4" />
                              </Link>

                              {!isStudent ? (
                                <>
                                  <Link
                                    href={`/h5p/${path}/${row.id}/edit?${contextQuery}`}
                                    className={iconButton}
                                    aria-label={`Edit ${row.title}`}
                                    title="Edit"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Link>

                                  <button
                                    type="button"
                                    onClick={() => handleDuplicate(row)}
                                    disabled={busyId === row.id}
                                    className={iconButton}
                                    aria-label={`Duplicate ${row.title}`}
                                    title="Duplicate"
                                  >
                                    <Copy className="h-4 w-4" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleExport(row)}
                                    disabled={busyId === row.id}
                                    className={iconButton}
                                    aria-label={`Export ${row.title} as an H5P package`}
                                    title="Export .h5p"
                                  >
                                    <Download className="h-4 w-4" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handlePublish(row)}
                                    disabled={busyId === row.id}
                                    className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 px-2 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                                  >
                                    {busyId === row.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : row.status === 'published' ? (
                                      'Unpublish'
                                    ) : (
                                      'Publish'
                                    )}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleDelete(row)}
                                    disabled={busyId === row.id}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                                    aria-label={`Delete ${row.title}`}
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

/** The exported page body, wrapped in the Suspense `useSearchParams` requires. */
export function ContentTypeListPage<TRow extends H5pContentRow>(props: ContentTypeListProps<TRow>) {
  return (
    <Suspense fallback={<LoadingState label={`Loading ${props.noun}s…`} />}>
      <ContentTypeListInner {...props} />
    </Suspense>
  );
}
