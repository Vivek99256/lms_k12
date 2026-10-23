'use client';

import { useState, type ReactNode } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

import { assetUrl } from '@/lib/study-deck/deck';
import { creditText, webSource } from '@/lib/study-deck/imageCredit';
import type { DeckImage } from '@/lib/study-deck/types';

export interface VisualFigureProps {
  image: DeckImage;
  assetBase: string | null;
  /** Laid over the picture, positioned as a share of it (used by hotspots). */
  children?: ReactNode;
}

/**
 * The slide's picture or drawn diagram, as large as the column allows.
 *
 * A diagram is drawn 16:9 and is shown at the full width of the lesson column so its labels stay
 * readable and hotspots have room; a photograph keeps its own shape, capped in height. The figure
 * carries the credit line (or says the diagram was drawn for the lesson), so a picture is never
 * shown without where it came from.
 */
export function VisualFigure({ image, assetBase, children }: VisualFigureProps) {
  const isDiagram = image.type === 'diagram';
  // A photograph can be shown larger, in place: no dialog, so nothing steals focus from the viewer around it.
  const [large, setLarge] = useState(false);

  return (
    <figure className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {/* On a narrow screen a diagram keeps a readable size and scrolls sideways inside its own frame, so labels and hotspots stay usable. */}
      <div className={isDiagram ? 'max-sm:overflow-x-auto' : ''}>
        <div className={isDiagram ? 'relative max-sm:min-w-[30rem]' : 'relative flex justify-center bg-slate-50'}>
          {/* eslint-disable-next-line @next/next/no-img-element -- deck images are our own stored files or local review copies */}
          <img
            src={assetUrl(image.url, assetBase)}
            alt={image.alt}
            width={image.width}
            height={image.height}
            className={isDiagram ? 'block h-auto w-full' : `block w-auto max-w-full object-contain transition-[max-height] duration-300 motion-reduce:transition-none ${large ? 'max-h-[44rem]' : 'max-h-[16rem] sm:max-h-[28rem]'}`}
            loading="lazy"
          />
          {children}
          {isDiagram ? null : (
            <button
              type="button"
              aria-pressed={large}
              onClick={() => setLarge((v) => !v)}
              className="absolute right-2 top-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white/95 px-2 py-1 text-xs font-semibold text-slate-800 shadow-sm hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
            >
              {large ? <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" /> : <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />}
              {large ? 'Smaller' : 'Larger'}
            </button>
          )}
        </div>
      </div>
      {isDiagram ? <p className="px-4 pt-2 text-xs text-slate-500 sm:hidden">Swipe sideways to see the whole diagram.</p> : null}
      <figcaption className="border-t border-slate-100 px-4 py-2 text-xs text-slate-600">
        {image.caption ? `${image.caption}. ` : ''}
        {creditText(image)}.{' '}
        {webSource(image) !== null ? (
          <a href={webSource(image) ?? undefined} target="_blank" rel="noreferrer noopener" className="text-indigo-700 underline">
            Source
          </a>
        ) : null}
      </figcaption>
    </figure>
  );
}
