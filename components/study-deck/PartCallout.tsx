'use client';

import { RotateCcw, X } from 'lucide-react';
import { useState } from 'react';

import { assetUrl } from '@/lib/study-deck/deck';
import type { DeckImage } from '@/lib/study-deck/types';
import { motion, useReducedMotion } from './stage-ui';

export interface PartCalloutProps {
  number: number;
  title: string;
  text: string;
  /** A picture of the part by its name, shown with the text. */
  image?: DeckImage | null;
  assetBase?: string | null;
  /** Which side of the picture it opens on: the side away from the part, so the part stays in view. */
  placement: 'left' | 'right';
  onClose: () => void;
}

/** The explanation split into its sentences, so they can arrive one after another. */
export function sentencesOf(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
}

/** Time between one sentence appearing and the next, in ms. */
export const SENTENCE_GAP = 1100;

/**
 * A part's explanation, shown on the picture itself: a card that opens against the edge of the picture away from the selected
 * part, numbered like the part's pin, with the explanation arriving one sentence at a time (so the eye stays on the part while
 * the idea builds). "Replay" plays it again. With reduced motion, or for a screen reader, the whole text is there at once.
 */
export function PartCallout({ number, title, text, image = null, assetBase = null, placement, onClose }: PartCalloutProps) {
  const still = useReducedMotion();
  const [round, setRound] = useState(0);
  const sentences = sentencesOf(text);

  return (
    <div
      role="region"
      aria-label={`${title}: explanation`}
      data-testid="part-callout"
      className={`absolute top-[5%] z-30 w-[62%] rounded-[0.9em] border-2 border-sd-accent bg-white/97 p-[0.7em] shadow-[0_0.4em_1.4em_rgba(15,23,42,0.28)] ${placement === 'left' ? 'left-[2.5%]' : 'right-[2.5%]'} ${motion.fadeUp}`}
    >
      <div className="flex items-center gap-[0.6em]">
        <span aria-hidden="true" className="flex h-[1.7em] w-[1.7em] shrink-0 items-center justify-center rounded-full bg-sd-accent text-[0.85em] font-bold tabular-nums text-white">
          {number}
        </span>
        <h3 className="min-w-0 flex-1 text-[1.15em] font-bold text-slate-900">{title}</h3>
        {still ? null : (
          <button
            type="button"
            onClick={() => setRound((r) => r + 1)}
            aria-label="Replay the explanation"
            title="Replay"
            className="shrink-0 rounded-[0.4em] p-[0.25em] text-sd-strong hover:bg-sd-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-sd-accent"
          >
            <RotateCcw className="h-[1.1em] w-[1.1em]" aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close explanation"
          className="shrink-0 rounded-[0.4em] p-[0.25em] text-slate-500 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sd-accent"
        >
          <X className="h-[1.1em] w-[1.1em]" aria-hidden="true" />
        </button>
      </div>
      {/* One paragraph for assistive technology, so it is read once and whole; the animated sentences are for the eye. */}
      <p className="sr-only">{text}</p>
      <div className="mt-[0.4em] flex items-start gap-[0.7em]">
        {image ? (
          <figure className="w-[40%] shrink-0 rounded-[0.6em] border border-sd-line bg-white p-[0.3em]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={assetUrl(image.url, assetBase)} alt={image.alt} className="mx-auto max-h-[8em] w-full object-contain" />
            {image.creator || image.licence ? <figcaption className="truncate text-[0.6em] text-slate-500">{[image.creator, image.licence].filter(Boolean).join(', ')}</figcaption> : null}
          </figure>
        ) : null}
        <p key={round} aria-hidden="true" className="min-w-0 flex-1 text-[0.92em] leading-snug text-slate-800">
        {sentences.map((sentence, index) => (
          <span key={index} className={`${still ? '' : motion.fadeUp} mr-[0.3em] inline`} style={still ? undefined : { animationDelay: `${index * SENTENCE_GAP}ms`, animationDuration: '450ms' }}>
            {sentence}
          </span>
        ))}
      </p>
      </div>
    </div>
  );
}
