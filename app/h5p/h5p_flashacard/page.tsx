'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import {
  deleteFlashcard,
  fetchFlashcards,
  h5pContextQuery,
  hasH5pContext,
  isStudentProfile,
  readH5pContext,
  type H5pFlashcard,
} from '@/app/h5p/data/h5p';
import {
  EmptyState,
  H5pPageHeader,
  InlineBanner,
  LoadingState,
  MissingContextNotice,
} from '@/app/h5p/components/shared';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

/**
 * Flashcard admin list — mirrors Laravel `GET /h5p/h5p_flashacard`
 * (H5PFlashcardController@index + flashcard/index.blade.php).
 *
 * Students never see this table: the Laravel controller renders the player
 * (`show`, id 0) for student profiles, so we reroute them immediately.
 */

function truncate(text: string, max = 80): string {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

function FlashcardListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ctx = useMemo(() => readH5pContext(new URLSearchParams(searchParams?.toString())), [searchParams]);
  const flashParam = searchParams?.get('flash') ?? '';

  // Null until the profile check has run client-side (avoids table flash for students).
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [cards, setCards] = useState<H5pFlashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (isStudentProfile()) {
      // Laravel reroutes students to the player; the player route always uses id 0.
      router.replace('/h5p/h5p_flashacard/0?' + h5pContextQuery(ctx));
      queueMicrotask(() => {
        if (!cancelled) setAllowed(false);
      });
      return () => {
        cancelled = true;
      };
    }
    queueMicrotask(() => {
      if (!cancelled) setAllowed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [ctx, router]);

  // Surface the flash message forwarded by create/edit, then strip it from the URL.
  useEffect(() => {
    if (!flashParam) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setSuccess(flashParam);
    });
    router.replace('/h5p/h5p_flashacard?' + h5pContextQuery(ctx));
    return () => {
      cancelled = true;
    };
  }, [flashParam, ctx, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setCards(await fetchFlashcards(ctx));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load flashcards');
    } finally {
      setLoading(false);
    }
  }, [ctx]);

  useEffect(() => {
    if (allowed !== true || !hasH5pContext(ctx)) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [allowed, ctx, load]);

  const handleDelete = async (card: H5pFlashcard) => {
    if (!window.confirm('Are you sure you want to delete this flashcard?')) return;
    setDeletingId(card.id);
    setError('');
    setSuccess('');
    try {
      const result = await deleteFlashcard(card.id, ctx);
      setSuccess(result.message);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete flashcard');
    } finally {
      setDeletingId(null);
    }
  };

  const contextQuery = h5pContextQuery(ctx);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return cards;
    return cards.filter((card) => (card.question ?? '').toLowerCase().includes(term));
  }, [cards, search]);

  if (allowed !== true) {
    return (
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="mx-auto max-w-5xl">
          <LoadingState label="Loading flash cards…" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <H5pPageHeader
          title="Flash cards"
          description={`${cards.length} card${cards.length === 1 ? '' : 's'} for this chapter`}
          ctx={ctx}
          backHref={`/h5p/html_contents?${contextQuery}`}
          actions={
            <Link
              href={`/h5p/h5p_flashacard/create?${contextQuery}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#4f46e5] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#4338ca]"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Cards
            </Link>
          }
        />

        {!hasH5pContext(ctx) ? (
          <MissingContextNotice />
        ) : (
          <>
            <InlineBanner kind="success" message={success} onDismiss={() => setSuccess('')} />
            <InlineBanner kind="error" message={error} onDismiss={() => setError('')} />

            {loading ? (
              <LoadingState label="Loading flash cards…" />
            ) : cards.length === 0 ? (
              <EmptyState
                title="No flashcards yet"
                hint="Create the first set of flash cards for this chapter."
                action={
                  <Link
                    href={`/h5p/h5p_flashacard/create?${contextQuery}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#4f46e5] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#4338ca]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Cards
                  </Link>
                }
              />
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
                  <p className="text-sm font-semibold text-slate-700">Flashcard list</p>
                  <div className="relative w-full max-w-xs">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search by question…"
                      className="pl-8"
                      aria-label="Search flashcards"
                    />
                  </div>
                </div>

                {filtered.length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm text-slate-500">
                    No flashcards match “{search}”.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16 pl-4 text-xs uppercase tracking-wide text-slate-500">SR No</TableHead>
                        <TableHead className="text-xs uppercase tracking-wide text-slate-500">Question</TableHead>
                        <TableHead className="text-xs uppercase tracking-wide text-slate-500">Correct Answer</TableHead>
                        <TableHead className="text-xs uppercase tracking-wide text-slate-500">Hint</TableHead>
                        <TableHead className="pr-4 text-right text-xs uppercase tracking-wide text-slate-500">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((card, index) => (
                        <TableRow key={card.id}>
                          <TableCell className="pl-4 text-sm text-slate-500">{index + 1}</TableCell>
                          <TableCell className="max-w-sm whitespace-normal text-sm text-slate-700">
                            {truncate(card.question ?? '')}
                          </TableCell>
                          <TableCell className="whitespace-normal text-sm text-slate-700">
                            {card.correct_answer || '—'}
                          </TableCell>
                          <TableCell className="whitespace-normal text-sm text-slate-500">
                            {card.hint && card.hint.trim() !== '' ? card.hint : '—'}
                          </TableCell>
                          <TableCell className="pr-4">
                            <div className="flex items-center justify-end gap-1.5">
                              <Link
                                href={`/h5p/h5p_flashacard/0?${contextQuery}`}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-indigo-50 hover:text-[#4f46e5]"
                                aria-label="View flashcards"
                                title="View"
                              >
                                <Eye className="h-4 w-4" />
                              </Link>
                              <Link
                                href={`/h5p/h5p_flashacard/${card.id}/edit?${contextQuery}`}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-indigo-50 hover:text-[#4f46e5]"
                                aria-label="Edit flashcard"
                                title="Edit"
                              >
                                <Pencil className="h-4 w-4" />
                              </Link>
                              <button
                                type="button"
                                onClick={() => void handleDelete(card)}
                                disabled={deletingId !== null}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-red-50 hover:text-red-600 disabled:pointer-events-none disabled:opacity-50"
                                aria-label="Delete flashcard"
                                title="Delete"
                              >
                                {deletingId === card.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </button>
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

export default function FlashcardListPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading flash cards…" />}>
      <FlashcardListContent />
    </Suspense>
  );
}
