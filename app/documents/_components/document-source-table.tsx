'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ExternalLink, FileText, Loader2, Search } from 'lucide-react';

import { PageFrame, PageHeader, InlineMessage } from '@/app/fees/_components/fees-shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { fetchSource, type DocumentPage } from '@/app/documents/_lib/documents-api';
import { useSelectedAcademicYear } from '@/lib/academic-year';

/**
 * One source's documents, listed.
 *
 * READ-ONLY BY CONSTRUCTION. There is no upload button, no rename and no delete.
 * The only two actions on a row are "open the file" (the same URL the owning
 * module already builds) and "open in module" (that module's own screen), which
 * is where every change to a document still happens.
 *
 * SEARCH AND PAGING ARE SERVER-SIDE. These tables run to tens of thousands of
 * rows on a live tenant; filtering in the browser would mean shipping all of
 * them first. The term is passed as a bound parameter and applied to the title
 * column named in the registry — no column name travels from here.
 */

function formatDate(value: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function ExtensionChip({ extension }: { extension: string }) {
  if (!extension) return <span className="text-slate-400">—</span>;

  return (
    <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] uppercase text-slate-600">
      {extension}
    </span>
  );
}

export function DocumentSourceTable({ sourceKey }: { sourceKey: string }) {
  const router = useRouter();

  /** Same header selection the dashboard reads — one source of truth, not two. */
  const syear = useSelectedAcademicYear();

  const [page, setPage] = useState<DocumentPage | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setPage(null);
    try {
      setPage(await fetchSource({
        source: sourceKey,
        search: appliedSearch,
        page: pageNumber,
        syear,
      }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'These documents could not be loaded.');
      setPage(null);
    } finally {
      setLoading(false);
    }
  }, [sourceKey, appliedSearch, pageNumber, syear]);

  useEffect(() => {
    void load();
  }, [load]);

  /*
   * A new year is a different result set, so the offset from the old one is
   * meaningless — page 7 of last year is very likely past the end of this one,
   * which would show an empty table on a source that has rows. Reset to the
   * first page whenever the year changes, but NOT on the first render, or this
   * would fight the initial load.
   */
  const previousYear = useRef(syear);
  useEffect(() => {
    if (previousYear.current !== syear) {
      previousYear.current = syear;
      setPageNumber(1);
    }
  }, [syear]);

  const submitSearch = useCallback(() => {
    setPageNumber(1);
    setAppliedSearch(searchInput.trim());
  }, [searchInput]);

  const pagination = page?.pagination;
  const rangeLabel = useMemo(() => {
    if (!pagination || pagination.total === 0) return 'No documents';
    const from = (pagination.page - 1) * pagination.perPage + 1;
    const to = Math.min(pagination.page * pagination.perPage, pagination.total);
    return `${from}–${to} of ${new Intl.NumberFormat('en-IN').format(pagination.total)}`;
  }, [pagination]);

  return (
    <PageFrame>
      <PageHeader
        title={page?.source.label ?? 'Documents'}
        description="Read-only. Uploading, editing and removing a document happens in the module that owns it."
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push('/documents')}>
              <ArrowLeft className="size-4" />
              All documents
            </Button>
            {page?.source.route && (
              <Button variant="outline" size="sm" onClick={() => router.push(page.source.route!)}>
                Open in module
                <ExternalLink className="size-4" />
              </Button>
            )}
          </div>
        }
      />

      {error && <InlineMessage type="error" text={error} />}

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submitSearch();
              }}
              placeholder="Search by title"
              className="pl-8"
              aria-label="Search documents by title"
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs tabular-nums text-slate-500">{rangeLabel}</span>
            <Button variant="outline" size="sm" onClick={submitSearch} disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : null}
              Search
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead className="w-24">Type</TableHead>
                <TableHead className="w-32">Reference</TableHead>
                <TableHead className="w-36">Added</TableHead>
                <TableHead className="w-24 text-right">Open</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !page ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-slate-500">
                    <Loader2 className="mx-auto size-5 animate-spin text-slate-400" />
                  </TableCell>
                </TableRow>
              ) : !page || page.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-slate-500">
                    {appliedSearch
                      ? `No documents match “${appliedSearch}”.`
                      : 'No documents recorded for this source.'}
                  </TableCell>
                </TableRow>
              ) : (
                page.rows.map((row, index) => (
                  <TableRow key={`${row.id ?? index}`}>
                    <TableCell>
                      <div className="flex items-start gap-2">
                        <FileText className="mt-0.5 size-4 shrink-0 text-slate-400" strokeWidth={1.75} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-800">{row.title}</p>
                          {row.fileName && row.fileName !== row.title && (
                            <p className="mt-0.5 truncate font-mono text-xs text-slate-500">
                              {row.fileName}
                            </p>
                          )}
                          {row.status && (
                            <span className="mt-1 inline-block rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-600">
                              {row.status}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <ExtensionChip extension={row.extension} />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-600">
                      {row.ownerId != null && row.ownerId !== '' ? `#${row.ownerId}` : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">{formatDate(row.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      {row.url ? (
                        <a
                          href={row.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-indigo-600 transition-colors hover:bg-indigo-50"
                        >
                          Open
                          <ExternalLink className="size-3.5" strokeWidth={1.75} />
                        </a>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
            <span className="text-xs text-slate-500">
              Page {pagination.page} of {pagination.pages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={loading || pagination.page <= 1}
                onClick={() => setPageNumber((current) => Math.max(1, current - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={loading || pagination.page >= pagination.pages}
                onClick={() => setPageNumber((current) => current + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </section>
    </PageFrame>
  );
}

export default DocumentSourceTable;
