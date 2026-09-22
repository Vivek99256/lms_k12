'use client';

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, ChevronLeft, ChevronRight, HelpCircle, Lightbulb, XCircle } from 'lucide-react';
import {
  fetchFlashcards,
  h5pContextQuery,
  hasH5pContext,
  isStudentProfile,
  postH5pXapiStatement,
  readH5pContext,
  type H5pFlashcard,
} from '@/app/h5p/data/h5p';
import { EmptyState, H5pPageHeader, InlineBanner, MissingContextNotice } from '@/app/h5p/components/shared';
import {
  Celebration,
  PlayerSkeleton,
  PrimaryAction,
  ProgressRail,
  ResultScreen,
  RetryAction,
  deriveAchievements,
} from '@/app/h5p/components/game';
import { Input } from '@/components/ui/input';

/**
 * Flashcard player — mirrors Laravel `GET /h5p/h5p_flashacard/{id}`
 * (flashcard/show.blade.php). The route id is ignored (Laravel always links
 * id 0); the player loads every card for the chapter context and steps
 * through them one at a time.
 */

/**
 * Swipe-to-navigate, for the one gesture a learner will try on a phone before
 * they look for a button.
 *
 * TOUCH AND PEN ONLY. A mouse drag across a card is how someone selects the
 * text on it, and turning that into a page change would make the card's own
 * content unreadable. The same reason keeps the threshold generous and the
 * direction check strict: a gesture that is mostly vertical is a scroll, and
 * scrolling the page must never cost the learner their place.
 *
 * Nothing here is the only way to do anything — the arrows and the dots below
 * do the same job for a keyboard, a mouse and a screen reader.
 */
function useSwipe({ onLeft, onRight }: { onLeft: () => void; onRight: () => void }) {
  const origin = useRef<{ x: number; y: number } | null>(null);

  return {
    onPointerDown: (event: ReactPointerEvent) => {
      origin.current = event.pointerType === 'mouse' ? null : { x: event.clientX, y: event.clientY };
    },
    onPointerUp: (event: ReactPointerEvent) => {
      const start = origin.current;
      origin.current = null;
      if (!start) return;

      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;

      if (dx < 0) onLeft();
      else onRight();
    },
    onPointerCancel: () => {
      origin.current = null;
    },
  };
}

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

  const swipe = useSwipe({
    onLeft: () => requestNavigate(current + 1),
    onRight: () => requestNavigate(current - 1),
  });

  return (
    <div className="p-4 sm:p-6">
      <div className="mx-auto">
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
              <PlayerSkeleton lines={2} label="Loading flash cards" />
            ) : total === 0 ? (
              <EmptyState title="No flashcards available" hint="No flash cards have been created for this chapter yet." />
            ) : card ? (
              <div className="mx-auto max-w-xl">
                {/* How far through the deck, above the card rather than below
                    it: on a phone the dots are past the fold, and a learner
                    who cannot see how much is left assumes it is endless. */}
                <div className="mb-4 flex items-center gap-3">
                  <ProgressRail value={correctCount} max={total} label="Cards answered correctly" />
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-[color:var(--h5p-ink-muted)]">
                    {correctCount}/{total}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => requestNavigate(current - 1)}
                    disabled={current === 0}
                    className="h5p-tappable h5p-focusable h5p-target inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white disabled:pointer-events-none disabled:opacity-40"
                    style={{ background: 'var(--h5p-accent)', boxShadow: 'var(--h5p-shadow-raised)' }}
                    aria-label="Previous card"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>

                  {/* `h5p-stack` draws the rest of the deck behind this card as
                      two pseudo-elements — depth with no extra DOM and nothing
                      a keyboard can land on. */}
                  <div
                    {...swipe}
                    className="h5p-stack h5p-enter relative min-w-0 flex-1 rounded-[var(--h5p-radius)]"
                    // pan-y leaves vertical scrolling to the browser; the swipe
                    // handler only ever claims a horizontal gesture.
                    style={{ touchAction: 'pan-y' }}
                  >
                    {/* The card itself. Separate from the stack wrapper because
                        the wrapper must NOT clip its overflow — the two deck
                        layers behind it peek out at the bottom, and
                        `overflow: hidden` here would erase them. */}
                    <div className="h5p-surface overflow-hidden">
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

                      {/* Feedback overlay. Tinted with the verdict's own token
                          rather than a flat black scrim, so the card underneath
                          stays legible and the colour itself carries meaning —
                          backed up by the icon, which is what actually does. */}
                      {feedback !== null ? (
                        <div
                          className="h5p-enter-scale absolute inset-0 z-30 flex items-center justify-center"
                          style={{
                            background:
                              feedback === 'correct'
                                ? 'color-mix(in srgb, var(--h5p-success) 92%, transparent)'
                                : 'color-mix(in srgb, var(--h5p-danger) 92%, transparent)',
                          }}
                        >
                          <Celebration show={feedback === 'correct'} pieces={14} />
                          <div className="relative px-6 text-center text-white">
                            {feedback === 'correct' ? (
                              <>
                                <CheckCircle className="mx-auto h-16 w-16" aria-hidden="true" />
                                <p className="mt-4 text-xl font-bold">Correct</p>
                                <p className="mt-1 text-sm opacity-90">Next card coming up.</p>
                              </>
                            ) : (
                              <>
                                <XCircle className="mx-auto h-16 w-16" aria-hidden="true" />
                                <p className="mt-4 text-xl font-bold">Not quite</p>
                                <p className="mt-1 text-sm opacity-90">Have another go.</p>
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
                          <PrimaryAction
                            type="submit"
                            disabled={answer.trim() === '' || feedback === 'correct'}
                            icon={<CheckCircle className="h-4 w-4" aria-hidden="true" />}
                            className="shrink-0"
                          >
                            Check
                          </PrimaryAction>
                        </form>
                      )}
                    </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => requestNavigate(current + 1)}
                    className="h5p-tappable h5p-focusable h5p-target inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white"
                    style={{ background: 'var(--h5p-accent)', boxShadow: 'var(--h5p-shadow-raised)' }}
                    aria-label={current === total - 1 ? 'Finish' : 'Next card'}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>

                {/* Indicator dots. Each is a real button with a 24px hit area
                    around a small visual pip — WCAG 2.2 target size without a
                    row of chunky dots dominating the card. */}
                <div className="mt-5 flex flex-wrap items-center justify-center gap-0.5">
                  {cards.map((dotCard, index) => {
                    const isActive = index === current;
                    const isCompleted = solved[index] === true;
                    return (
                      <button
                        key={dotCard.id}
                        type="button"
                        onClick={() => requestNavigate(index)}
                        className="h5p-focusable flex h-6 w-6 items-center justify-center rounded-full"
                        aria-label={`Go to card ${index + 1}${isCompleted ? ', answered' : ''}`}
                        aria-current={isActive ? 'true' : undefined}
                      >
                        <span
                          className={`h5p-pip ${isActive ? 'is-current' : isCompleted ? 'is-done' : ''}`}
                          aria-hidden="true"
                        />
                      </button>
                    );
                  })}
                </div>

                <p className="mt-2 text-center text-[11px] text-[color:var(--h5p-ink-faint)] sm:hidden">
                  Swipe left or right to move between cards.
                </p>
              </div>
            ) : null}
          </>
        )}
      </div>

      {/* Result. A dialog rather than a decorated div: it takes the whole
          screen and the deck behind it is no longer usable, so it has to say
          so to anything that is not reading pixels. */}
      {showResult ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Your result"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'color-mix(in srgb, var(--h5p-ink) 82%, transparent)' }}
        >
          <div className="w-full max-w-md">
            <ResultScreen
              headline="Deck finished"
              score={correctCount}
              maxScore={total}
              percentage={total > 0 ? (correctCount / total) * 100 : 0}
              // A deck has no pass mark, so "passed" here means the learner
              // answered more than they missed — enough to be worth the
              // celebration without handing it out for one right card.
              passed={total > 0 && correctCount / total >= 0.5}
              passLabel="Worth another pass"
              summary={`${correctCount} of ${total} answered correctly`}
              message={resultMessage(total > 0 ? (correctCount / total) * 100 : 0)}
              achievements={deriveAchievements({
                percentage: total > 0 ? (correctCount / total) * 100 : 0,
                passed: total > 0 && correctCount === total,
              })}
              actions={<RetryAction onClick={restart} label="Start over" />}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function FlashcardPlayerPage() {
  return (
    <Suspense fallback={<PlayerSkeleton lines={2} label="Loading flash cards" />}>
      <FlashcardPlayerContent />
    </Suspense>
  );
}
