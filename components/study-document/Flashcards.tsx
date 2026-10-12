'use client';

import { useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, RotateCw } from 'lucide-react';

import type { Flashcard } from '@/lib/study-document/online';

export interface FlashcardsProps {
  cards: Flashcard[];
  /** Keys (`term:<part>`) the learner has marked as known. */
  known: ReadonlySet<string>;
  onKnown: (key: string, known: boolean) => void;
  /** Start on this card (a note's own term when it is opened from the note). */
  startAt?: number;
}

/**
 * The key terms as cards: the term on the front, its meaning when turned over.
 *
 * One card at a time, so it reads the same on a phone; Previous and Next move through them; "I know this" is the learner's
 * own place-keeping and is kept only in this browser. Nothing is scored.
 */
export function Flashcards({ cards, known, onKnown, startAt = 0 }: FlashcardsProps) {
  const [index, setIndex] = useState(Math.min(Math.max(startAt, 0), Math.max(cards.length - 1, 0)));
  const [turned, setTurned] = useState(false);

  if (cards.length === 0) {
    return <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">This document has no key terms to turn over.</p>;
  }

  const card = cards[Math.min(index, cards.length - 1)];
  const isKnown = known.has(card.id);
  const knownCount = cards.filter((c) => known.has(c.id)).length;
  const go = (to: number) => {
    setIndex((to + cards.length) % cards.length);
    setTurned(false);
  };

  return (
    <section aria-label="Key terms" className="space-y-3" data-testid="flashcards">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-700">
        <p>
          Card {index + 1} of {cards.length}
        </p>
        <p role="status">{knownCount === cards.length ? 'You know every term' : `${knownCount} of ${cards.length} marked as known`}</p>
      </div>

      <button
        type="button"
        onClick={() => setTurned((t) => !t)}
        aria-pressed={turned}
        aria-label={turned ? `Meaning of ${card.term}: ${card.meaning}. Select to turn back.` : `Term: ${card.term}. Select to see its meaning.`}
        className={`flex min-h-[11rem] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 p-6 text-center shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
          turned ? 'border-emerald-300 bg-emerald-50 text-emerald-950' : 'border-indigo-300 bg-indigo-50 text-indigo-950 hover:border-indigo-500'
        }`}
      >
        <span className="text-xs font-semibold uppercase tracking-wider opacity-70">{turned ? 'Meaning' : 'Term'}</span>
        <span className={turned ? 'text-lg leading-snug' : 'text-2xl font-semibold leading-tight'}>{turned ? card.meaning : card.term}</span>
        <span className="mt-1 inline-flex items-center gap-1 text-xs opacity-70">
          <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
          {turned ? 'Select to turn back' : 'Select to turn over'}
        </span>
      </button>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => go(index - 1)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Previous
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
          >
            Next
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <button
          type="button"
          onClick={() => onKnown(card.id, !isKnown)}
          aria-pressed={isKnown}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
            isKnown ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'border border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-50'
          }`}
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          {isKnown ? 'You know this' : 'I know this'}
        </button>
      </div>
    </section>
  );
}
