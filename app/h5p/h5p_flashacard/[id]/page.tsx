'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Lightbulb,
  RotateCcw,
  Trophy,
  XCircle,
} from 'lucide-react';
import {
  fetchFlashcards,
  h5pContextQuery,
  hasH5pContext,
  isStudentProfile,
  postH5pXapiStatement,
  readH5pContext,
  type H5pFlashcard,
} from '@/app/h5p/data/h5p';
import { EmptyState, H5pPageHeader, InlineBanner, LoadingState, MissingContextNotice } from '@/app/h5p/components/shared';
import { Input } from '@/components/ui/input';

/**
 * Flashcard player — mirrors Laravel `GET /h5p/h5p_flashacard/{id}`
 * (flashcard/show.blade.php). The route id is ignored (Laravel always links
 * id 0); the player loads every card for the chapter context and steps
 * through them one at a time.
 */

function resultMessage(percentage: number): string {
  if (percentage >= 90) return 'Excellent! You are a star!';
  if (percentage >= 70) return 'Good job! Keep practicing!';
  if (percentage >= 50) return 'Not bad! Review the cards and keep practicing!';
  return 'Keep learning! You will do better next time!';
}

function FlashcardPlayerContent() {
  const searchParams = useSearchParams();
  const ctx = useMemo(() => readH5pContext(new URLSearchParams(searchParams?.toString())), [searchParams]);

  const [cards, setCards] = useState<H5pFlashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isStudent, setIsStudent] = useState(false);

  const [current, setCurrent] = useState(0);
  const [solved, setSolved] = useState<boolean[]>([]);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [hintVisible, setHintVisible] = useState(false);
  const [showResult, setShowResult] = useState(false);

  const feedbackTimer = useRef<number | null>(null);
  const hintTimer = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (feedbackTimer.current !== null) {
      window.clearTimeout(feedbackTimer.current);
      feedbackTimer.current = null;
    }
    if (hintTimer.current !== null) {
      window.clearTimeout(hintTimer.current);
      hintTimer.current = null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setIsStudent(isStudentProfile());
    });
    return () => {
      cancelled = true;
      clearTimers();
    };
  }, [clearTimers]);

  useEffect(() => {
    let cancelled = false;
    if (!hasH5pContext(ctx)) {
      queueMicrotask(() => {
        if (!cancelled) setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }
    queueMicrotask(() => {
      if (!cancelled) {
        setLoading(true);
        setError('');
      }
    });
    fetchFlashcards(ctx)
      .then((list) => {
        if (cancelled) return;
        setCards(list);
        setSolved(new Array<boolean>(list.length).fill(false));
        setCurrent(0);
        setAnswer('');
        setFeedback(null);
        setHintVisible(false);
        setShowResult(false);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load flashcards');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ctx]);

  const card: H5pFlashcard | undefined = cards[current];
  const total = cards.length;
  const correctCount = solved.filter(Boolean).length;
  const isLocked = solved[current] === true;

  const goToCard = useCallback(
    (index: number) => {
      clearTimers();
      setFeedback(null);
      setHintVisible(false);
      setAnswer('');
      setCurrent(index);
    },
    [clearTimers]
  );

  /** Navigate to `target`; past-the-end finishes the run. Forward moves past an unanswered card confirm first. */
  const requestNavigate = (target: number) => {
    if (target < 0 || target === current) return;
    if (target > current && !isLocked && feedback !== 'correct') {
      if (!window.confirm('Skip this card without answering?')) return;
    }
    if (target >= total) {
      clearTimers();
      setFeedback(null);
      setHintVisible(false);
      setShowResult(true);
      return;
    }
    goToCard(target);
  };

  const handleCheck = () => {
    if (!card || isLocked || feedback === 'correct') return;
    const guess = answer.trim().toLowerCase();
    if (guess === '') return;
    clearTimers();

    const expected = (card.correct_answer ?? '').trim().toLowerCase();
    const isCorrect = guess === expected;

    void postH5pXapiStatement({
      objectId: `flash_cards:${card.id}`,
      verb: 'answered',
      ctx,
      success: isCorrect,
      response: answer.trim(),
    });

    if (isCorrect) {
      const index = current;
      setSolved((prev) => prev.map((value, i) => (i === index ? true : value)));
      setFeedback('correct');
      feedbackTimer.current = window.setTimeout(() => {
        feedbackTimer.current = null;
        setFeedback(null);
        if (index < total - 1) {
          goToCard(index + 1);
        } else {
          setShowResult(true);
          void postH5pXapiStatement({ objectId: `flash_cards:${card.id}`, verb: 'completed', ctx });
        }
      }, 2000);
    } else {
      setFeedback('wrong');
      feedbackTimer.current = window.setTimeout(() => {
        feedbackTimer.current = null;
        setFeedback(null);
      }, 2000);
    }
  };

  const showHint = () => {
    if (hintTimer.current !== null) window.clearTimeout(hintTimer.current);
    setHintVisible(true);
    hintTimer.current = window.setTimeout(() => {
      hintTimer.current = null;
      setHintVisible(false);
    }, 5000);
  };

  const restart = () => {
    clearTimers();
    setSolved(new Array<boolean>(total).fill(false));
    setCurrent(0);
    setAnswer('');
    setFeedback(null);
    setHintVisible(false);
    setShowResult(false);
  };

  const contextQuery = h5pContextQuery(ctx);
  const backHref = isStudent ? `/h5p/html_contents?${contextQuery}` : `/h5p/h5p_flashacard?${contextQuery}`;
  const hasHint = Boolean(card?.hint && card.hint.trim() !== '');

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <H5pPageHeader
          title="Flash cards"
          description={total > 0 ? `Card ${Math.min(current + 1, total)} of ${total}` : 'Interactive flash card practice'}
          ctx={ctx}
          backHref={backHref}
        />

        {!hasH5pContext(ctx) ? (
          <MissingContextNotice />
        ) : (
          <>
            <InlineBanner kind="error" message={error} onDismiss={() => setError('')} />

            {loading ? (
              <LoadingState label="Loading flash cards…" />
            ) : total === 0 ? (
              <EmptyState title="No flashcards available" hint="No flash cards have been created for this chapter yet." />
            ) : card ? (
              <div className="mx-auto max-w-xl">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => requestNavigate(current - 1)}
                    disabled={current === 0}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#4f46e5] text-white shadow-sm transition hover:bg-[#4338ca] disabled:pointer-events-none disabled:opacity-40"
                    aria-label="Previous card"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>

                  <div className="relative min-w-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    {/* Card body */}
                    <div className="relative min-h-[320px] p-6 sm:p-8">
                      {card.content && card.content.trim() !== '' ? (
                        <div
                          className="text-sm leading-relaxed text-slate-700 [&_img]:my-3 [&_img]:max-w-full [&_img]:rounded-lg"
                          dangerouslySetInnerHTML={{ __html: card.content }}
                        />
                      ) : (
                        <p className="text-sm text-slate-400">No content available</p>
                      )}

                      {hasHint ? (
                        <button
                          type="button"
                          onClick={showHint}
                          className="absolute right-4 top-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-amber-400 text-amber-900 shadow-sm transition hover:bg-amber-500"
                          aria-label="Show hint"
                          title="Show hint"
                        >
                          <HelpCircle className="h-5 w-5" />
                        </button>
                      ) : null}

                      {hintVisible && hasHint ? (
                        <div className="absolute right-4 top-14 z-20 max-w-xs rounded-xl border-l-4 border-amber-400 bg-white p-3 shadow-lg">
                          <p className="flex items-start gap-2 text-xs text-slate-700">
                            <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                            <span>{card.hint}</span>
                          </p>
                        </div>
                      ) : null}

                      {/* Feedback overlay */}
                      {feedback !== null ? (
                        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-900/90">
                          <div className="px-6 text-center text-white">
                            {feedback === 'correct' ? (
                              <>
                                <CheckCircle className="mx-auto h-16 w-16 text-emerald-400" />
                                <p className="mt-4 text-xl font-bold">Correct!</p>
                              </>
                            ) : (
                              <>
                                <XCircle className="mx-auto h-16 w-16 text-red-400" />
                                <p className="mt-4 text-xl font-bold">Incorrect — try again</p>
                              </>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {/* Card footer */}
                    <div className="border-t border-slate-200 bg-slate-50 p-4 sm:p-5">
                      <div className="mb-3 rounded-xl border-l-4 border-[#4f46e5] bg-white px-4 py-3 text-sm font-semibold text-slate-800">
                        {card.question || '—'}
                      </div>

                      {isLocked ? (
                        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                          <CheckCircle className="h-4 w-4 shrink-0" />
                          Answered correctly
                        </div>
                      ) : (
                        <form
                          onSubmit={(event) => {
                            event.preventDefault();
                            handleCheck();
                          }}
                          className="flex items-center gap-2"
                        >
                          <Input
                            value={answer}
                            onChange={(event) => setAnswer(event.target.value)}
                            placeholder="Type your answer here…"
                            autoComplete="off"
                            disabled={feedback === 'correct'}
                            aria-label="Your answer"
                          />
                          <button
                            type="submit"
                            disabled={answer.trim() === '' || feedback === 'correct'}
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#4f46e5] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#4338ca] disabled:pointer-events-none disabled:opacity-50"
                          >
                            <CheckCircle className="h-4 w-4" />
                            Check
                          </button>
                        </form>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => requestNavigate(current + 1)}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#4f46e5] text-white shadow-sm transition hover:bg-[#4338ca]"
                    aria-label={current === total - 1 ? 'Finish' : 'Next card'}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>

                {/* Indicator dots */}
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                  {cards.map((dotCard, index) => {
                    const isActive = index === current;
                    const isCompleted = solved[index] === true;
                    return (
                      <button
                        key={dotCard.id}
                        type="button"
                        onClick={() => requestNavigate(index)}
                        className={`h-2.5 rounded-full transition-all ${
                          isActive ? 'w-7 bg-[#4f46e5]' : isCompleted ? 'w-2.5 bg-emerald-500' : 'w-2.5 bg-slate-300 hover:bg-slate-400'
                        }`}
                        aria-label={`Go to card ${index + 1}`}
                        aria-current={isActive ? 'true' : undefined}
                      />
                    );
                  })}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>

      {/* Result modal */}
      {showResult ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl">
            <Trophy className="mx-auto h-14 w-14 text-amber-400" />
            <h2 className="mt-4 text-lg font-semibold text-slate-900">Quiz completed!</h2>
            <p className="mt-3 text-4xl font-bold text-[#4f46e5]">
              {correctCount} / {total}
            </p>
            <p className="mt-1 text-sm text-slate-500">correct</p>
            <p className="mt-4 text-sm text-slate-600">
              {resultMessage(total > 0 ? (correctCount / total) * 100 : 0)}
            </p>
            <button
              type="button"
              onClick={restart}
              className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-[#4f46e5] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#4338ca]"
            >
              <RotateCcw className="h-4 w-4" />
              Start Over
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function FlashcardPlayerPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading flash cards…" />}>
      <FlashcardPlayerContent />
    </Suspense>
  );
}
