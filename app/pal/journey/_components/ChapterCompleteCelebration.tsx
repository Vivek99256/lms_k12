'use client';

import React, { useEffect, useRef, useState } from 'react';
import { PartyPopper, X } from 'lucide-react';
import './chapter-celebration.css';

/**
 * The "you finished the whole chapter" celebration — shown once per chapter
 * (gated by localStorage in `MountainJourneyView.tsx`, not repeated on every
 * revisit) when every required milestone is completed or mastered.
 *
 * Follows `app/general/onboarding/_components/GoLiveOverlay.tsx`'s own
 * technique directly: CSS-only transform/opacity animation, no motion
 * library, `prefers-reduced-motion` collapses it to a static card (see
 * `chapter-celebration.css`'s own header for why this isn't a shared import
 * of that component instead). Unlike that overlay, this one never redirects
 * — there is no single "next page" after finishing a chapter the way
 * onboarding has a module dashboard, so it only ever waits for the learner
 * to dismiss it.
 */
export interface ChapterCompleteCelebrationProps {
  chapterName: string;
  onDismiss: () => void;
}

/**
 * Flowers, sparkles and confetti — literally what was asked for ("like
 * Congratulations with flowers and stuff"). An emoji glyph needs no new
 * icon asset and no new dependency, matching `go-live.css`'s own
 * "no motion library" constraint extended to "no new asset library" too.
 */
const PIECES = ['🌸', '🌼', '🎉', '✨', '🎊', '🌟', '💐', '🌺'];

export function ChapterCompleteCelebration({ chapterName, onDismiss }: ChapterCompleteCelebrationProps) {
  const [leaving, setLeaving] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    cardRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !leaving) dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving]);

  function dismiss() {
    setLeaving(true);
    setTimeout(onDismiss, 260);
  }

  return (
    <div
      className={`chaptercelebrate-root${leaving ? ' is-leaving' : ''}`}
      role="alertdialog"
      aria-modal="true"
      aria-label={`${chapterName} complete`}
      onClick={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
    >
      <div className="chaptercelebrate-glow" aria-hidden />

      <div className="chaptercelebrate-card" ref={cardRef} tabIndex={-1}>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <X aria-hidden className="h-4 w-4" />
        </button>

        <div className="chaptercelebrate-badge">
          <PartyPopper aria-hidden className="h-7 w-7 text-white" />
        </div>

        <h2 className="chaptercelebrate-headline">Congratulations!</h2>
        <p className="chaptercelebrate-body">
          You&rsquo;ve completed every step of <strong>{chapterName}</strong> &mdash; nice work!
        </p>

        <button
          type="button"
          onClick={dismiss}
          className="mt-5 w-full rounded-lg bg-gradient-to-r from-indigo-600 via-fuchsia-500 to-amber-500 px-4 py-2.5 text-sm font-bold text-white shadow-md transition-transform hover:scale-[1.02]"
        >
          Awesome!
        </button>
      </div>

      {/* Painted after the card on purpose — see chapter-celebration.css's
          `.chaptercelebrate-burst` comment for why. */}
      <div className="chaptercelebrate-burst" aria-hidden>
        {PIECES.concat(PIECES).map((piece, index) => (
          <span
            key={index}
            className="chaptercelebrate-piece"
            style={{
              ['--piece-angle' as string]: `${index * (360 / (PIECES.length * 2))}deg`,
              ['--piece-distance' as string]: `${160 + (index % 5) * 42}px`,
              ['--piece-spin' as string]: `${index % 2 ? 180 : -180}deg`,
              animationDelay: `${(index % 6) * 0.06}s`,
            }}
          >
            {piece}
          </span>
        ))}
      </div>
    </div>
  );
}
