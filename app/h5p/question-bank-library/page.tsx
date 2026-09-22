'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, Layers3, Loader2, X } from 'lucide-react';

import {
  fetchQuestionBankFacets,
  type CountedOption,
  type QuestionBankApiQuestion,
} from '@/app/course-master/data/chapters';
import type { SearchDropdownValues, Standard, Subject } from '@/components/search-dropdown';
import { readH5pContext, type H5pContext } from '../data/h5p';
import {
  EMPTY_FILTERS,
  buildPlayable,
  fetchQuestionPage,
  fetchWholeChapter,
  runtimePlayerHref,
  sessionInstituteId,
  summariseChapter,
  type LibraryFilters,
} from '../data/question-bank-library';
import { EmptyState, H5pPageHeader, InlineBanner } from '../components/shared';
import { ChapterStats, TypeCard } from './components/chapter-stats';
import { LibraryFiltersBar } from './components/library-filters';
import { PreviewPanel, QuestionRows, type RowAction } from './components/question-rows';
import { RuntimePlayer, runtimeLibraryName } from './components/runtime-player';
import { AssignDialog } from './components/assign-dialog';
import { debugEnabled, logFunnel } from './debug';

/**
 * Question bank library -- a direct H5P runtime viewer over the question bank.
 *
 * WHAT THIS SCREEN IS. Pick a chapter, and every question in it becomes
 * playable through the H5P player its form maps to. Press Preview and the
 * player mounts over the table; press Open player and it gets its own page.
 *
 * WHAT IT DELIBERATELY IS NOT, ANY MORE. It is not a conversion tool. The
 * first build of this screen wrote an H5P draft for every question a teacher
 * wanted to see, which meant a write, a round trip and a permanent row before
 * anybody could look at anything -- and an estate of drafts created by
 * curiosity rather than intent. Preview now builds the activity in the browser
 * and throws it away when the panel closes. **Nothing on this screen writes to
 * the database except Assign**, which hands question ids to the homework
 * module and never touches H5P at all.
 *
 * WHERE THE RENDERING COMES FROM. `lib/h5p/question-bank-runtime.ts` builds the
 * exact row shape each player's controller returns, and
 * `components/runtime-player.tsx` hands it to that player. There is no
 * question markup in this feature -- no card, no option list, no answer
 * reveal. What a teacher previews is the activity a learner would sit, scored
 * by the same code.
 */

const PER_PAGE_DEFAULT = 25;

type Flash = { kind: 'success' | 'error'; message: string } | null;

interface Preview {
  /** The question itself. The player derives everything else from it. */
  question: QuestionBankApiQuestion;
  title: string;
  library: string;
}

function QuestionBankLibrary() {
  const searchParams = useSearchParams();

  // Arriving from a chapter carries the scope already; arriving from the H5P
  // hub does not, and the dropdowns fill it in.
  const inherited = useMemo(() => readH5pContext(new URLSearchParams(searchParams.toString())), [searchParams]);

  const [scope, setScope] = useState<Partial<SearchDropdownValues>>({
    section: '',
    standard: inherited.standard_id,
    division: '',
    subject: inherited.subject_id,
  });
  const [names, setNames] = useState<{ standard: string; subject: string; chapter: string }>({
    standard: inherited.standard_name ?? '',
    subject: inherited.subject_name ?? '',
    chapter: inherited.chapter_name ?? '',
  });

  const [chapters, setChapters] = useState<CountedOption[]>([]);
  const [chaptersLoading, setChaptersLoading] = useState(false);
  const [difficulties, setDifficulties] = useState<CountedOption[]>([]);
  const [chapterId, setChapterId] = useState(inherited.chapter_id);

  const [filters, setFilters] = useState<LibraryFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(PER_PAGE_DEFAULT);

  const [rows, setRows] = useState<QuestionBankApiQuestion[]>([]);
  const [rowTotal, setRowTotal] = useState(0);
  const [serverPaged, setServerPaged] = useState(false);
  const [chapterQuestions, setChapterQuestions] = useState<QuestionBankApiQuestion[]>([]);
  const [loading, setLoading] = useState(false);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [preview, setPreview] = useState<Preview | null>(null);
  const [assigning, setAssigning] = useState<number[] | null>(null);
  const [flash, setFlash] = useState<Flash>(null);

  const standardId = readOne(scope.standard);
  const subjectId = readOne(scope.subject);

  const ctx: H5pContext = useMemo(
    () => ({
      chapter_id: chapterId,
      standard_id: standardId,
      subject_id: subjectId,
      chapter_name: names.chapter,
      subject_name: names.subject,
      standard_name: names.standard,
    }),
    [chapterId, standardId, subjectId, names]
  );

  const ready = Boolean(chapterId && standardId && subjectId);

  // -------------------------------------------------------------------------
  // Chapters and difficulty levels for the current subject
  // -------------------------------------------------------------------------

  // The state writes go through `queueMicrotask` here and in the two effects
  // below, which is how every list page in this module defers them out of the
  // effect body -- see `components/content-type-list.tsx`.
  useEffect(() => {
    const controller = new AbortController();

    queueMicrotask(() => {
      if (controller.signal.aborted) return;

      if (!subjectId) {
        setChapters([]);
        setDifficulties([]);
        return;
      }

      setChaptersLoading(true);

      fetchQuestionBankFacets(
        // The facets endpoint IS tenant-scoped, so the institute goes with it:
        // without it the chapter list is every institute pooled (143 chapters
        // on dev) rather than this school's own (12).
        { sub_institute_id: sessionInstituteId() ?? undefined, standard_id: standardId, subject_id: subjectId },
        controller.signal
      )
        .then((facets) => {
          if (controller.signal.aborted) return;
          setChapters(facets.chapters);
          setDifficulties(facets.difficulty_levels);
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setChapters([]);
          setFlash({ kind: 'error', message: error instanceof Error ? error.message : 'Could not load the chapters.' });
        })
        .finally(() => {
          if (!controller.signal.aborted) setChaptersLoading(false);
        });
    });

    return () => controller.abort();
  }, [standardId, subjectId]);

  // -------------------------------------------------------------------------
  // The chapter's questions
  // -------------------------------------------------------------------------

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!ready) return;

      setLoading(true);
      try {
        const result = await fetchQuestionPage(
          { chapterId: Number(chapterId), page, perPage, filters },
          signal
        );

        if (signal?.aborted) return;

        setRows(result.questions);
        setRowTotal(result.total);
        setServerPaged(result.serverPaged);

        // `all` is the whole chapter when the endpoint did not page, which is
        // what the summary needs; once it does page, ask for the counts.
        const whole = result.all ?? (await fetchWholeChapter(Number(chapterId), signal));
        setChapterQuestions(whole);

        if (debugEnabled(new URLSearchParams(searchParams.toString()))) {
          logFunnel({
            scope: { standardId, subjectId, chapterId, ready },
            chapterQuestions: whole,
            rows: result.questions,
            rendered: result.questions.length,
            total: result.total,
            serverPaged: result.serverPaged,
            filters,
          });
        }
      } catch (error: unknown) {
        if (signal?.aborted) return;
        setFlash({ kind: 'error', message: error instanceof Error ? error.message : 'Could not load the questions.' });
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [ready, chapterId, page, perPage, filters, standardId, subjectId, searchParams]
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  // A new chapter or a new filter is a new result set, so the page resets with
  // it -- staying on page 4 of a chapter that now has one page shows nothing.
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setPage(1);
      setSelected(new Set());
    });
    return () => {
      cancelled = true;
    };
  }, [chapterId, filters.typeCode, filters.difficulty, filters.search, perPage]);

  const summary = useMemo(() => summariseChapter(chapterQuestions), [chapterQuestions]);

  /**
   * What this institute is supposed to have in this chapter, per the facets
   * endpoint — which is tenant-scoped, unlike the one that returns the rows.
   *
   * When the two disagree the table is showing other schools' questions, and
   * the page says so rather than presenting a pooled count as this school's.
   * See the header on `postBank` for the measurement.
   */
  const institutionTotal = useMemo(() => {
    const chapter = chapters.find((entry) => String(entry.id ?? entry.value) === chapterId);
    const total = Number(chapter?.total ?? NaN);
    return Number.isFinite(total) ? total : null;
  }, [chapters, chapterId]);

  const crossTenant =
    institutionTotal !== null && chapterQuestions.length > institutionTotal
      ? { mine: institutionTotal, shown: chapterQuestions.length }
      : null;

  const availableTypes = useMemo(
    () => summary.buckets.map((bucket) => ({ mapping: bucket.mapping, count: bucket.questions.length })),
    [summary]
  );

  // -------------------------------------------------------------------------
  // Playing a question
  // -------------------------------------------------------------------------

  /**
   * Build the activity and show it. Synchronous on purpose: there is no
   * request to make and nothing to save, so a question opens in the time it
   * takes to render.
   */
  const openPreview = useCallback(
    (question: QuestionBankApiQuestion) => {
      const built = buildPlayable(question, chapterQuestions, ctx, names.chapter || undefined);

      if (!built.ok || !built.activity) {
        setFlash({ kind: 'error', message: built.reason ?? 'This question cannot be played.' });
        return;
      }

      setPreview({
        question,
        title: built.activity.kind === 'essay' ? built.activity.item.title : built.activity.item.title || 'Question preview',
        library: runtimeLibraryName(built.activity),
      });
    },
    [chapterQuestions, ctx, names.chapter]
  );

  const onAction = (action: RowAction, question: QuestionBankApiQuestion) => {
    switch (action) {
      case 'preview':
        openPreview(question);
        return;
      case 'open':
        window.open(runtimePlayerHref(question, ctx), '_blank', 'noopener');
        return;
      case 'assign':
        setAssigning([Number(question.id)]);
        return;
      default:
        return;
    }
  };

  // -------------------------------------------------------------------------
  // Selection
  // -------------------------------------------------------------------------

  const toggle = (id: number) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected((current) => {
      const ids = rows.map((question) => Number(question.id));
      const all = ids.every((id) => current.has(id));
      const next = new Set(current);
      for (const id of ids) {
        if (all) next.delete(id);
        else next.add(id);
      }
      return next;
    });

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6">
      <H5pPageHeader
        title="Question bank library"
        description="Play any question in a chapter through its H5P player. Nothing is converted and nothing is saved — the activity is built as you open it."
        ctx={ctx}
        backHref="/h5p/html_contents"
      />

      {flash ? <InlineBanner kind={flash.kind} message={flash.message} onDismiss={() => setFlash(null)} /> : null}

      <LibraryFiltersBar
        scope={scope}
        onScopeChange={(values) => {
          setScope(values);
          // A new subject invalidates the chapter, and with it every count on
          // the page.
          if (readOne(values.subject) !== subjectId) {
            setChapterId('');
            setNames((current) => ({ ...current, chapter: '' }));
          }
        }}
        onStandardPicked={(standards: Standard[]) =>
          setNames((current) => ({ ...current, standard: standards[0]?.name ?? current.standard }))
        }
        onSubjectPicked={(subjects: Subject[]) =>
          setNames((current) => ({ ...current, subject: subjects[0]?.subject_name ?? current.subject }))
        }
        chapters={chapters}
        chapterId={chapterId}
        chaptersLoading={chaptersLoading}
        onChapterChange={(next) => {
          setChapterId(next);
          const chapter = chapters.find((entry) => String(entry.id ?? entry.value) === next);
          setNames((current) => ({ ...current, chapter: String(chapter?.name ?? chapter?.label ?? '') }));
        }}
        availableTypes={availableTypes}
        difficulties={difficulties}
        filters={filters}
        onFiltersChange={setFilters}
      />

      {!ready ? (
        <EmptyState
          title="Choose a subject and a chapter"
          hint="The library reads one chapter at a time, so the counts and the activities always describe what you are looking at."
        />
      ) : (
        <>
          {crossTenant ? (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-900">
                <AlertTriangle className="h-4 w-4" />
                These counts include other institutes&rsquo; questions
              </p>
              <p className="mt-1 text-xs leading-relaxed text-amber-800">
                This chapter holds <strong>{crossTenant.mine}</strong> questions for your institute, but
                the question endpoint returned <strong>{crossTenant.shown}</strong>. `/api/lms-question-bank`
                ignores `sub_institute_id` and the rows carry no institute of their own, so this screen cannot
                narrow them down — the scoping has to be added in the backend&rsquo;s question bank controller.
                Everything below describes all {crossTenant.shown}.
              </p>
            </div>
          ) : null}

          <ChapterStats summary={summary} />

          {summary.buckets.length > 0 ? (
            <div className="mb-5">
              <h2 className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                <Layers3 className="h-4 w-4 text-indigo-500" />
                Question types in this chapter
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {summary.buckets.map((bucket) => (
                  <TypeCard
                    key={bucket.mapping.code}
                    bucket={bucket}
                    onPreview={() => {
                      const first = bucket.playable[0];
                      if (first) openPreview(first);
                    }}
                    onOpen={() => {
                      const first = bucket.playable[0];
                      if (first) window.open(runtimePlayerHref(first, ctx), '_blank', 'noopener');
                    }}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {selected.size > 0 ? (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-900">
              <span className="font-semibold">{selected.size} selected</span>
              <button
                type="button"
                onClick={() => setAssigning([...selected])}
                className="rounded-lg bg-white px-2.5 py-1 font-semibold text-indigo-700 transition hover:bg-indigo-100"
              >
                Assign these
              </button>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="ml-auto inline-flex items-center gap-1 font-medium text-indigo-700 hover:underline"
              >
                <X className="h-3 w-3" />
                Clear
              </button>
            </div>
          ) : null}

          <QuestionRows
            questions={rows}
            chapter={chapterQuestions}
            loading={loading}
            selected={selected}
            onToggle={toggle}
            onToggleAll={toggleAll}
            onAction={onAction}
            page={page}
            perPage={perPage}
            total={rowTotal}
            serverPaged={serverPaged}
            onPageChange={setPage}
            onPerPageChange={setPerPage}
          />
        </>
      )}

      {preview ? (
        <PreviewPanel title={preview.title} library={preview.library} onClose={() => setPreview(null)}>
          {/* Keyed by the question so switching questions remounts the player
              rather than feeding a new row into a half-finished attempt. */}
          <RuntimePlayer key={preview.question.id} question={preview.question} chapter={chapterQuestions} />
        </PreviewPanel>
      ) : null}

      {assigning ? (
        <AssignDialog
          questionIds={assigning}
          defaults={{ section: readOne(scope.section), standard: standardId, subject: subjectId }}
          onClose={() => setAssigning(null)}
          onAssigned={(message) => setFlash({ kind: 'success', message })}
        />
      ) : null}
    </div>
  );
}

function readOne(value: SearchDropdownValues[keyof SearchDropdownValues] | undefined): string {
  if (Array.isArray(value)) return value[0] ? String(value[0]) : '';
  return value ? String(value) : '';
}

export default function QuestionBankLibraryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center gap-2 py-24 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
          Loading the question bank library&hellip;
        </div>
      }
    >
      <QuestionBankLibrary />
    </Suspense>
  );
}
