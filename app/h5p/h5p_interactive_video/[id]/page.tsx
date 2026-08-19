'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { CheckCircle2, Clock, Lightbulb, X } from 'lucide-react';
import {
  fetchVideo,
  formatSeconds,
  hasH5pContext,
  h5pContextQuery,
  parseInteractionOptions,
  postH5pXapiStatement,
  readH5pContext,
  type H5pInteractiveVideo,
  type H5pVideoInteraction,
} from '../../data/h5p';
import {
  EmptyState,
  H5pPageHeader,
  InlineBanner,
  LoadingState,
  MissingContextNotice,
} from '../../components/shared';

/**
 * Interactive video player — mirrors Laravel `GET /h5p/h5p_interactive_video/{id}`
 * (resources/views/lms/h5p/interactiveVideo/show.blade.php): timeline markers,
 * auto-triggered popups, answer checking, and the "Did You Know?" info card.
 */

const MARKER_COLORS: Record<string, string> = {
  multiple_choice: '#ff4444',
  true_false: '#ffaa44',
  text_input: '#44aaff',
};

const TYPE_LABELS: Record<string, string> = {
  multiple_choice: 'Multiple Choice',
  true_false: 'True/False',
  text_input: 'Info',
};

const TYPE_BADGE_CLASSES: Record<string, string> = {
  multiple_choice: 'bg-red-50 text-red-600',
  true_false: 'bg-amber-50 text-amber-600',
  text_input: 'bg-sky-50 text-sky-600',
};

interface PopupState {
  index: number;
  selected: string | null;
  result: 'correct' | 'wrong' | null;
}

function interactionTime(interaction: H5pVideoInteraction): number {
  return Number(interaction.time ?? 0);
}

function truncateQuestion(question: string | null): string {
  const text = question ?? '';
  return text.length > 100 ? `${text.slice(0, 100)}…` : text;
}

function InteractiveVideoPlayerContent() {
  const params = useParams<{ id: string }>();
  const videoId = params?.id;
  const searchParams = useSearchParams();
  const ctx = useMemo(() => readH5pContext(new URLSearchParams(searchParams?.toString())), [searchParams]);

  const [video, setVideo] = useState<H5pInteractiveVideo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [duration, setDuration] = useState(0);
  const [progressPct, setProgressPct] = useState(0);
  const [answered, setAnswered] = useState<Set<number>>(new Set());
  const [popup, setPopup] = useState<PopupState | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const popupOpenRef = useRef(false);
  const answeredRef = useRef<Set<number>>(new Set());
  const triggeredRef = useRef<Set<number>>(new Set());
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    popupOpenRef.current = popup !== null;
  }, [popup]);

  useEffect(() => {
    answeredRef.current = answered;
  }, [answered]);

  useEffect(
    () => () => {
      for (const timer of timersRef.current) window.clearTimeout(timer);
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    if (!videoId || !hasH5pContext(ctx)) {
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
        setLoadError('');
      }
    });
    fetchVideo(videoId, ctx)
      .then((loaded) => {
        if (!cancelled) setVideo(loaded);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load video');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [videoId, ctx]);

  const interactions = useMemo(() => video?.interactions ?? [], [video]);

  const schedule = (fn: () => void, delay: number) => {
    timersRef.current.push(window.setTimeout(fn, delay));
  };

  const openPopup = (index: number) => {
    videoRef.current?.pause();
    setPopup({ index, selected: null, result: null });
  };

  const closePopup = (resume: boolean) => {
    setPopup(null);
    if (resume) void videoRef.current?.play();
  };

  const markAnswered = (index: number) => {
    setAnswered((prev) => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
    answeredRef.current = new Set(answeredRef.current).add(index);
  };

  const seekToInteraction = (index: number) => {
    const player = videoRef.current;
    const interaction = interactions[index];
    if (!player || !interaction) return;
    player.currentTime = interactionTime(interaction);
    openPopup(index);
  };

  const handleTimeUpdate = () => {
    const player = videoRef.current;
    if (!player) return;
    const total = player.duration || duration;
    setProgressPct(total > 0 ? Math.min(100, (player.currentTime / total) * 100) : 0);

    if (popupOpenRef.current) return;
    interactions.forEach((interaction, index) => {
      if (answeredRef.current.has(index) || triggeredRef.current.has(index)) return;
      if (Math.abs(player.currentTime - interactionTime(interaction)) < 0.5) {
        triggeredRef.current.add(index);
        player.pause();
        openPopup(index);
        schedule(() => triggeredRef.current.delete(index), 3000);
      }
    });
  };

  const handleSubmitAnswer = () => {
    if (!popup || popup.selected === null) return;
    const interaction = interactions[popup.index];
    if (!interaction) return;
    const correct = String(popup.selected) === String(interaction.correct_answer);
    markAnswered(popup.index);
    setPopup({ ...popup, result: correct ? 'correct' : 'wrong' });
    void postH5pXapiStatement({
      objectId: `interactive_video:${videoId}`,
      verb: 'answered',
      ctx,
      success: correct,
      response: popup.selected ?? undefined,
    });
    if (correct) {
      const answeredIndex = popup.index;
      schedule(() => {
        setPopup((current) => {
          if (current && current.index === answeredIndex) {
            void videoRef.current?.play();
            return null;
          }
          return current;
        });
      }, 1800);
    }
  };

  const contextQuery = h5pContextQuery(ctx);
  const activeInteraction = popup ? interactions[popup.index] : undefined;
  const activeOptions = activeInteraction ? parseInteractionOptions(activeInteraction) : [];
  const correctKey = activeInteraction ? String(activeInteraction.correct_answer ?? '') : '';
  const correctLabel = activeOptions.find((option) => option.key === correctKey)?.label ?? correctKey;
  const isInfoCard = activeInteraction?.interaction_type === 'text_input';

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <H5pPageHeader
          title={video?.title || 'Interactive video'}
          description="Watch the video — questions appear at the marked times"
          ctx={ctx}
          backHref={`/h5p/h5p_interactive_video?${contextQuery}`}
        />

        {!hasH5pContext(ctx) ? (
          <MissingContextNotice />
        ) : loading ? (
          <LoadingState label="Loading video…" />
        ) : loadError ? (
          <InlineBanner kind="error" message={loadError} />
        ) : !video ? (
          <EmptyState title="Interactive video not found" />
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                {video.video_path ? (
                  <video
                    ref={videoRef}
                    controls
                    className="w-full rounded-xl bg-black"
                    src={video.video_path}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={() => setDuration(videoRef.current?.duration ?? 0)}
                    onEnded={() => void postH5pXapiStatement({ objectId: `interactive_video:${videoId}`, verb: 'completed', ctx })}
                  />
                ) : (
                  <p className="rounded-xl bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                    No video file available.
                  </p>
                )}

                {/* Timeline with interaction markers */}
                <div className="mt-4 px-1">
                  <div className="relative h-2 rounded-full bg-slate-200">
                    <div
                      className="h-2 rounded-full bg-[#4f46e5] transition-[width] duration-100"
                      style={{ width: `${progressPct}%` }}
                    />
                    {duration > 0
                      ? interactions.map((interaction, index) => {
                          const pct = (interactionTime(interaction) / duration) * 100;
                          if (pct > 100) return null;
                          const type = String(interaction.interaction_type ?? 'multiple_choice');
                          return (
                            <button
                              key={interaction.id ?? index}
                              type="button"
                              onClick={() => seekToInteraction(index)}
                              className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow transition hover:scale-125"
                              style={{ left: `${pct}%`, backgroundColor: MARKER_COLORS[type] ?? '#ff4444' }}
                              title={`${TYPE_LABELS[type] ?? type} at ${formatSeconds(interactionTime(interaction))}`}
                              aria-label={`Open interaction at ${formatSeconds(interactionTime(interaction))}`}
                            />
                          );
                        })
                      : null}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-slate-500">
                    {(['multiple_choice', 'true_false', 'text_input'] as const).map((type) => (
                      <span key={type} className="inline-flex items-center gap-1.5">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: MARKER_COLORS[type] }}
                        />
                        {TYPE_LABELS[type]}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Interactions panel */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">
                Interactions ({interactions.length})
              </h2>
              {interactions.length === 0 ? (
                <p className="text-xs text-slate-500">This video has no interactions.</p>
              ) : (
                <div className="grid gap-2">
                  {interactions.map((interaction, index) => {
                    const type = String(interaction.interaction_type ?? 'multiple_choice');
                    return (
                      <button
                        key={interaction.id ?? index}
                        type="button"
                        onClick={() => seekToInteraction(index)}
                        className="rounded-xl border border-slate-200 p-3 text-left transition hover:border-indigo-200 hover:bg-indigo-50/40"
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#4f46e5]">
                            <Clock className="h-3 w-3" />
                            {formatSeconds(interactionTime(interaction))}
                          </span>
                          {answered.has(index) ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" aria-label="Answered" />
                          ) : null}
                        </span>
                        <span className="mt-1 block text-xs text-slate-700">
                          {truncateQuestion(interaction.question)}
                        </span>
                        <span
                          className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            TYPE_BADGE_CLASSES[type] ?? 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {TYPE_LABELS[type] ?? type}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Interaction popup */}
        {popup && activeInteraction ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
              {isInfoCard ? (
                <>
                  <div className="flex items-center justify-between bg-teal-500 px-5 py-3.5">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Lightbulb className="h-4 w-4" />
                      Did You Know?
                    </h3>
                    <button
                      type="button"
                      onClick={() => closePopup(false)}
                      className="text-white/80 transition hover:text-white"
                      aria-label="Close"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="p-5">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-teal-50 text-teal-600">
                      <Lightbulb className="h-5 w-5" />
                    </span>
                    <p className="mt-3 text-[11px] font-bold uppercase tracking-widest text-teal-600">Note</p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-700">{activeInteraction.question}</p>
                  </div>
                  <div className="flex justify-end border-t border-teal-50 px-5 py-3.5">
                    <button
                      type="button"
                      onClick={() => {
                        markAnswered(popup.index);
                        closePopup(true);
                      }}
                      className="rounded-xl bg-teal-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-teal-600"
                    >
                      Got it, continue
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between bg-[#4f46e5] px-5 py-3.5">
                    <h3 className="text-sm font-semibold text-white">Interactive Question</h3>
                    <button
                      type="button"
                      onClick={() => closePopup(false)}
                      className="text-white/80 transition hover:text-white"
                      aria-label="Close"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="p-5">
                    <p className="text-sm font-medium text-slate-800">{activeInteraction.question}</p>
                    <div className="mt-4 grid gap-2">
                      {activeOptions.map((option) => {
                        let optionClass = 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40';
                        if (popup.result !== null) {
                          if (option.key === correctKey) {
                            optionClass = 'border-emerald-400 bg-emerald-50';
                          } else if (option.key === popup.selected && popup.result === 'wrong') {
                            optionClass = 'border-red-400 bg-red-50';
                          } else {
                            optionClass = 'border-slate-200 opacity-60';
                          }
                        } else if (option.key === popup.selected) {
                          optionClass = 'border-[#4f46e5] bg-indigo-50';
                        }
                        return (
                          <label
                            key={option.key}
                            className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-3.5 py-2.5 text-sm text-slate-700 transition ${optionClass}`}
                          >
                            <input
                              type="radio"
                              name="popup-answer"
                              value={option.key}
                              checked={popup.selected === option.key}
                              disabled={popup.result !== null}
                              onChange={() => setPopup({ ...popup, selected: option.key })}
                              className="h-4 w-4 accent-[#4f46e5]"
                            />
                            {option.label}
                          </label>
                        );
                      })}
                    </div>
                    {popup.result === 'correct' ? (
                      <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-700">
                        Correct! Great job!
                      </p>
                    ) : null}
                    {popup.result === 'wrong' ? (
                      <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">
                        Incorrect. Correct answer: {correctLabel}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3.5">
                    {popup.result === 'wrong' ? (
                      <button
                        type="button"
                        onClick={() => closePopup(true)}
                        className="rounded-xl bg-[#4f46e5] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#4338ca]"
                      >
                        Continue
                      </button>
                    ) : popup.result === null ? (
                      <>
                        <button
                          type="button"
                          onClick={() => closePopup(true)}
                          className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                        >
                          Skip
                        </button>
                        <button
                          type="button"
                          onClick={handleSubmitAnswer}
                          disabled={popup.selected === null}
                          className="rounded-xl bg-[#4f46e5] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#4338ca] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Submit Answer
                        </button>
                      </>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function InteractiveVideoPlayerPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading interactive video…" />}>
      <InteractiveVideoPlayerContent />
    </Suspense>
  );
}
