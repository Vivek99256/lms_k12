'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import DOMPurify from 'isomorphic-dompurify';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import {
  h5pContextQuery,
  hasH5pContext,
  postH5pXapiStatement,
  readH5pContext,
  type H5pContext,
} from '../../data/h5p';
import {
  coursePresentationApi,
  type H5pCoursePresentation,
  type H5pSlideElement,
} from '../../data/h5p-content-types';
import {
  gradeElement,
  isScoredElement,
  nextSlideId,
  presentationFeedback,
  scorePresentationAttempt,
  type ScorableSlideElement,
  type SlideResponse,
} from '@/lib/h5p/course-presentation-scoring';
import { H5pPageHeader, InlineBanner, LoadingState, MissingContextNotice } from '../../components/shared';
import { Input } from '@/components/ui/input';
import { parsePassage, segmentPassage } from '@/lib/h5p/text-activity-markup';

/**
 * Course presentation — player.
 *
 * NAVIGATION GOES THROUGH `nextSlideId`, which is the same function the editor
 * validates against and is unit-tested. A branch pointing at a deleted slide
 * falls back to the sequence rather than stranding the learner — that fallback
 * is the whole reason navigation is not just `index + 1` here.
 *
 * ANSWERS ARE HELD PER ELEMENT ID and graded by `lib/h5p/course-presentation-
 * scoring`, not here. This file renders and collects; it never decides a mark.
 * The embedded fill-in-the-blanks in particular reuses the standalone cloze
 * marker, so the same question marks identically on a slide and on its own.
 *
 * AN EMBEDDED DRAG AND DROP IS NOT PLAYED INLINE. It is a link to the activity
 * with its own player, which already handles pointer and keyboard placement
 * and its own scoring. A second, worse drag surface inside a slide would be a
 * second thing to keep correct.
 */

const THEME_SURFACE: Record<string, string> = {
  default: 'bg-white',
  slate: 'bg-slate-100',
  indigo: 'bg-indigo-50',
  warm: 'bg-amber-50',
  'high-contrast': 'bg-white',
};

/** Row -> the scorer's structural shape. */
function toScorable(element: H5pSlideElement): ScorableSlideElement {
  return {
    id: element.id,
    slide_id: element.slide_id,
    element_type: element.element_type,
    content_text: element.content_text,
    options: element.options,
    points: element.points,
  };
}

function CoursePresentationPlayerContent() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const searchParams = useSearchParams();
  const ctx: H5pContext = useMemo(
    () => readH5pContext(new URLSearchParams(searchParams?.toString())),
    [searchParams]
  );
  const contextQuery = h5pContextQuery(ctx);

  const [deck, setDeck] = useState<H5pCoursePresentation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [slideId, setSlideId] = useState<number | null>(null);
  const [visited, setVisited] = useState<Set<number>>(new Set());
  const [responses, setResponses] = useState<Record<number, SlideResponse>>({});
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [showSummary, setShowSummary] = useState(false);
  // A ref, not state: it must never re-render, and Date.now() during render
  // is impure. Seeded when the deck loads and re-seeded on restart.
  const startedAt = useRef(0);

  useEffect(() => {
    let cancelled = false;
    if (!hasH5pContext(ctx) || !id) {
      queueMicrotask(() => {
        if (!cancelled) setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }

    coursePresentationApi
      .get(id, ctx)
      .then((data) => {
        if (cancelled) return;
        setDeck(data);
        startedAt.current = Date.now();
        const first = (data.slides ?? [])[0];
        if (first) {
          setSlideId(first.id);
          setVisited(new Set([first.id]));
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load presentation');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ctx, id]);

  // Memoised rather than derived inline: `deck?.slides ?? []` produces a new
  // array identity on every render when a deck has no slides, which would make
  // the `scorable` memo below rebuild on every render and defeat its purpose.
  const slides = useMemo(() => deck?.slides ?? [], [deck]);
  const scorable = useMemo(
    () =>
      slides.map((slide) => ({
        id: slide.id,
        slide_index: slide.slide_index,
        next_slide_id: slide.next_slide_id,
        elements: (slide.elements ?? []).map(toScorable),
      })),
    [slides]
  );

  const slide = slides.find((s) => s.id === slideId) ?? null;
  const result = deck
    ? scorePresentationAttempt({ slides: scorable, pass_percentage: deck.pass_percentage }, responses)
    : null;

  const goTo = useCallback((target: number | null) => {
    if (target === null) return;
    setSlideId(target);
    setVisited((seen) => new Set(seen).add(target));
  }, []);

  // useCallback so the lint analyser can see this is deferred work rather
  // than render code -- it reads the clock and a ref, neither of which is
  // legal during render.
  const finish = useCallback(() => {
    if (!deck || !result) return;
    setShowSummary(true);
    void postH5pXapiStatement({
      objectId: `course_presentation:${deck.id}`,
      verb: 'completed',
      ctx,
      success: result.passed,
      response: `${result.score}/${result.maxScore}`,
      durationSeconds: (Date.now() - startedAt.current) / 1000,
    });
  }, [deck, result, ctx]);

  const restart = () => {
    setResponses({});
    setChecked(new Set());
    setShowSummary(false);
    startedAt.current = Date.now();
    const first = slides[0];
    if (first) {
      setSlideId(first.id);
      setVisited(new Set([first.id]));
    }
  };

  const answer = (element: H5pSlideElement, response: SlideResponse) => {
    setResponses((current) => ({ ...current, [element.id]: response }));
  };

  const check = (element: H5pSlideElement) => {
    if (!deck) return;
    setChecked((current) => new Set(current).add(element.id));

    const graded = gradeElement(toScorable(element), responses[element.id]);
    void postH5pXapiStatement({
      objectId: `course_presentation:${deck.id}`,
      verb: 'answered',
      ctx,
      success: graded.correct,
      response: `element ${element.id}: ${graded.score}/${graded.maxScore}`,
    });
  };

  // --- rendering -----------------------------------------------------------

  const renderElement = (element: H5pSlideElement) => {
    if (!deck) return null;

    const options = (element.options ?? {}) as Record<string, unknown>;
    const response = responses[element.id];
    const isChecked = checked.has(element.id);
    const graded = isScoredElement(toScorable(element)) ? gradeElement(toScorable(element), response) : null;

    const box = (children: React.ReactNode) => (
      <div
        key={element.id}
        className="absolute overflow-auto"
        style={{
          left: `${element.position_x}%`,
          top: `${element.position_y}%`,
          width: `${element.width}%`,
          height: `${element.height}%`,
        }}
      >
        {children}
      </div>
    );

    switch (element.element_type) {
      case 'text':
        return box(
          <div
            className="prose prose-sm max-w-none text-sm text-slate-800 [&_a]:text-indigo-600 [&_li]:my-0.5 [&_ul]:list-disc [&_ul]:pl-5"
            // Sanitised, always: an imported package can carry any markup, and
            // a teacher account is not a reason to run a script in a learner's
            // browser.
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(element.content_text ?? '') }}
          />
        );

      case 'image':
        return box(
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={element.media_path ?? ''}
            alt={element.media_alt ?? ''}
            className="h-full w-full rounded-lg object-contain"
          />
        );

      case 'video':
        return box(
          <video
            src={element.media_path ?? ''}
            controls={options.controls !== false}
            autoPlay={options.autoplay === true}
            loop={options.loop === true}
            className="h-full w-full rounded-lg bg-black"
          >
            {element.media_alt ? <track kind="descriptions" label={element.media_alt} /> : null}
          </video>
        );

      case 'audio':
        return box(
          <div className="flex h-full flex-col justify-center gap-1">
            {element.media_alt ? <p className="text-[11px] text-slate-600">{element.media_alt}</p> : null}
            <audio
              src={element.media_path ?? ''}
              controls={options.controls !== false}
              autoPlay={options.autoplay === true}
              className="w-full"
            />
          </div>
        );

      case 'multiple_choice': {
        const answers = (options.answers as Array<{ text?: string; correct?: boolean; feedback?: string }>) ?? [];
        const chosen = response?.kind === 'multiple_choice' ? response.chosen : [];
        const single = answers.filter((a) => a.correct).length <= 1;

        return box(
          <fieldset className="rounded-xl border border-slate-200 bg-white/95 p-3">
            <legend className="px-1 text-sm font-medium text-slate-800">{element.content_text}</legend>
            <div className="mt-1 space-y-1.5">
              {answers.map((option, i) => (
                <label key={i} className="flex items-start gap-2 text-sm text-slate-700">
                  <input
                    type={single ? 'radio' : 'checkbox'}
                    name={`mc-${element.id}`}
                    checked={chosen.includes(i)}
                    disabled={isChecked}
                    onChange={(e) =>
                      answer(element, {
                        kind: 'multiple_choice',
                        chosen: single
                          ? [i]
                          : e.target.checked
                            ? [...chosen, i]
                            : chosen.filter((c) => c !== i),
                      })
                    }
                    className="mt-0.5 h-4 w-4 shrink-0 border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>{option.text}</span>
                </label>
              ))}
            </div>
            {renderCheck(element, graded, isChecked, chosen.length > 0)}
          </fieldset>
        );
      }

      case 'true_false': {
        const chosen = response?.kind === 'true_false' ? response.chosen : null;
        return box(
          <fieldset className="rounded-xl border border-slate-200 bg-white/95 p-3">
            <legend className="px-1 text-sm font-medium text-slate-800">{element.content_text}</legend>
            <div className="mt-2 flex gap-2">
              {[true, false].map((side) => (
                <button
                  key={String(side)}
                  type="button"
                  disabled={isChecked}
                  aria-pressed={chosen === side}
                  onClick={() => answer(element, { kind: 'true_false', chosen: side })}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-60 ${
                    chosen === side
                      ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {side ? 'True' : 'False'}
                </button>
              ))}
            </div>
            {renderCheck(element, graded, isChecked, chosen !== null)}
          </fieldset>
        );
      }

      case 'blanks': {
        const passage = String(options.passage ?? '');
        const segments = segmentPassage(passage);
        const slots = parsePassage(passage);
        const typed = response?.kind === 'blanks' ? response.responses : {};

        return box(
          <div className="rounded-xl border border-slate-200 bg-white/95 p-3">
            {options.task_description ? (
              <p className="mb-2 text-sm font-medium text-slate-800">{String(options.task_description)}</p>
            ) : null}
            <p className="text-sm leading-8 text-slate-700">
              {segments.map((segment, i) =>
                segment.kind === 'text' ? (
                  <span key={i}>{segment.text}</span>
                ) : (
                  <Input
                    key={i}
                    value={typed[segment.slot.index] ?? ''}
                    disabled={isChecked}
                    onChange={(e) =>
                      answer(element, {
                        kind: 'blanks',
                        responses: { ...typed, [segment.slot.index]: e.target.value },
                      })
                    }
                    className="mx-1 inline-block h-7 w-28 align-baseline"
                    aria-label={`Blank ${segment.slot.index + 1}`}
                  />
                )
              )}
            </p>
            {renderCheck(element, graded, isChecked, Object.keys(typed).length > 0)}
            {isChecked && deck.enable_show_solution ? (
              <p className="mt-1.5 text-[11px] text-slate-500">
                Answers: {slots.map((slot) => slot.solution).join(', ')}
              </p>
            ) : null}
          </div>
        );
      }

      case 'drag_drop':
        return box(
          <div className="flex h-full flex-col items-start justify-center gap-2 rounded-xl border border-slate-200 bg-white/95 p-3">
            <p className="text-xs text-slate-600">This slide includes a drag and drop activity.</p>
            {element.ref_content_id ? (
              <Link
                href={`/h5p/h5p_drag_drop/${element.ref_content_id}?${contextQuery}`}
                className="inline-flex items-center rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700"
              >
                Open the activity
              </Link>
            ) : (
              <p className="text-[11px] text-amber-700">The activity for this slide is unavailable.</p>
            )}
          </div>
        );

      case 'goto_slide':
        return box(
          <button
            type="button"
            onClick={() => goTo(Number(options.target_slide_id) || null)}
            className="h-full w-full rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700"
          >
            {String(options.label ?? element.content_text ?? 'Continue')}
          </button>
        );

      default:
        return null;
    }
  };

  const renderCheck = (
    element: H5pSlideElement,
    graded: ReturnType<typeof gradeElement> | null,
    isChecked: boolean,
    answered: boolean
  ) => {
    if (!deck || !graded) return null;

    if (!isChecked) {
      return (
        <button
          type="button"
          disabled={!answered}
          onClick={() => check(element)}
          className="mt-2 inline-flex items-center rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
        >
          Check
        </button>
      );
    }

    return (
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span
          aria-live="polite"
          className={`text-[11px] font-semibold ${graded.correct ? 'text-emerald-700' : 'text-amber-700'}`}
        >
          {graded.score} of {graded.maxScore}
          {graded.correct ? ' — correct' : ''}
        </span>
        {deck.enable_retry ? (
          <button
            type="button"
            onClick={() => {
              setChecked((current) => {
                const next = new Set(current);
                next.delete(element.id);
                return next;
              });
              setResponses((current) => {
                const next = { ...current };
                delete next[element.id];
                return next;
              });
            }}
            className="text-[11px] font-medium text-indigo-600 underline"
          >
            Try again
          </button>
        ) : null}
      </div>
    );
  };

  // --- body ----------------------------------------------------------------

  const body = () => {
    if (!deck || !result) return null;

    if (slides.length === 0) {
      return <InlineBanner kind="error" message="This presentation has no slides yet." />;
    }

    if (showSummary) {
      const message = presentationFeedback(result.percentage, deck.feedback_bands);
      return (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Summary</p>
          {result.maxScore > 0 ? (
            <>
              <p className="mt-2 text-4xl font-semibold tabular-nums text-slate-900">
                {result.score}
                <span className="text-2xl text-slate-400"> / {result.maxScore}</span>
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {result.answeredCount} of {result.scoredElementCount} questions answered
              </p>
              <span
                className={`mt-3 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                  result.passed ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                }`}
              >
                {result.passed ? 'Passed' : `Pass mark is ${deck.pass_percentage}%`}
              </span>
            </>
          ) : (
            // A lecture deck has no marks, and a big "0 / 0" would read as a
            // failure rather than as "there was nothing to answer".
            <p className="mt-2 text-sm text-slate-600">
              You reached the end of {visited.size} of {slides.length} slides. This presentation has no questions.
            </p>
          )}

          {message ? <p className="mt-4 text-sm text-slate-700">{message}</p> : null}

          {deck.enable_retry ? (
            <button
              type="button"
              onClick={restart}
              className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Start again
            </button>
          ) : null}
        </div>
      );
    }

    if (!slide) return null;

    const next = nextSlideId(scorable, slide.id);
    const position = slides.indexOf(slide);

    return (
      <div className="flex gap-4">
        {deck.show_keywords ? (
          <nav aria-label="Slides" className="hidden w-40 shrink-0 space-y-1 lg:block">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => goTo(s.id)}
                aria-current={s.id === slide.id ? 'true' : undefined}
                className={`block w-full truncate rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                  s.id === slide.id
                    ? 'bg-indigo-50 font-semibold text-indigo-700'
                    : visited.has(s.id)
                      ? 'text-slate-600 hover:bg-slate-50'
                      : 'text-slate-400 hover:bg-slate-50'
                }`}
              >
                <span className="tabular-nums">{i + 1}.</span> {s.title || `Slide ${i + 1}`}
              </button>
            ))}
          </nav>
        ) : null}

        <div className="min-w-0 flex-1">
          {deck.show_progress_bar ? (
            <div
              className="mb-3 h-1 w-full overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-valuenow={visited.size}
              aria-valuemin={0}
              aria-valuemax={slides.length}
              aria-label="Slides visited"
            >
              <div
                className="h-full rounded-full bg-indigo-500 transition-all"
                style={{ width: `${(visited.size / slides.length) * 100}%` }}
              />
            </div>
          ) : null}

          <div
            className={`relative w-full overflow-hidden rounded-2xl border border-slate-200 shadow-sm ${
              THEME_SURFACE[deck.theme] ?? THEME_SURFACE.default
            }`}
            style={{ aspectRatio: '16 / 9' }}
          >
            {slide.background_image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={slide.background_image}
                alt=""
                className="pointer-events-none absolute inset-0 h-full w-full object-cover"
              />
            ) : null}

            {(slide.elements ?? []).map(renderElement)}
          </div>

          {!deck.active_surface ? (
            <div className="mt-3 flex items-center justify-between gap-3">
              <button
                type="button"
                disabled={position <= 0}
                onClick={() => goTo(slides[position - 1]?.id ?? null)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </button>

              <span className="text-xs tabular-nums text-slate-500">
                {position + 1} of {slides.length}
              </span>

              {next !== null ? (
                <button
                  type="button"
                  onClick={() => goTo(next)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              ) : deck.show_summary_slide ? (
                <button
                  type="button"
                  onClick={finish}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700"
                >
                  Finish
                </button>
              ) : (
                <span />
              )}
            </div>
          ) : (
            // Navigation is hidden: the only way on is something on the slide.
            // The finish button still appears at the end, or the deck would
            // have no way to complete and nothing would ever be reported.
            next === null && deck.show_summary_slide ? (
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={finish}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700"
                >
                  Finish
                </button>
              </div>
            ) : null
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <H5pPageHeader
          title={deck?.title || 'Course presentation'}
          description={deck?.description || undefined}
          ctx={ctx}
          backHref={`/h5p/h5p_course_presentation?${contextQuery}`}
        />

        {!hasH5pContext(ctx) ? (
          <MissingContextNotice />
        ) : loading ? (
          <LoadingState label="Loading presentation…" />
        ) : error ? (
          <InlineBanner kind="error" message={error} />
        ) : (
          body()
        )}
      </div>
    </div>
  );
}

export default function CoursePresentationPlayerPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading presentation…" />}>
      <CoursePresentationPlayerContent />
    </Suspense>
  );
}
