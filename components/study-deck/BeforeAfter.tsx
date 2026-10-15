'use client';

import { CheckCircle2, MousePointerClick } from 'lucide-react';

import { assetUrl } from '@/lib/study-deck/deck';
import { teaserOf } from '@/lib/study-deck/interactions';
import type { DeckImage, ExploreItem } from '@/lib/study-deck/types';
import { GlyphIcon, motion, TONES } from './stage-ui';

export interface BeforeAfterProps {
  /** Exactly two things to compare. */
  items: [ExploreItem, ExploreItem];
  /** The one that is open, or null. */
  openId: string | null;
  seen: (id: string) => boolean;
  onSelect: (id: string) => void;
  portrait: boolean;
  assetBase?: string | null;
}

function Credit({ image }: { image: DeckImage }) {
  if (!image.creator && !image.licence) return null;

  return (
    <span className="absolute bottom-0 right-0 max-w-full truncate rounded-tl bg-white/85 px-[0.4em] text-[0.55em] text-slate-600">
      {[image.creator, image.licence].filter(Boolean).join(', ')}
    </span>
  );
}

/**
 * Two things compared. Closed, they sit side by side as equal cards, each with its picture. Opening one gives it the stage
 * (its picture beside its explanation) and the other becomes a full-width strip below it, still naming its subject, still
 * showing a small picture and still saying whether it has been read. Nothing is ever squeezed into a narrow column or laid
 * over the other card: the two share the space as a column, so each keeps room for its whole title.
 *
 * It holds no state and scores nothing: the explore screen around it counts what has been opened.
 */
export function BeforeAfter({ items, openId, seen, onSelect, portrait, assetBase = null }: BeforeAfterProps) {
  const stacked = portrait || openId !== null;

  return (
    <ul aria-label="Compare the two" className={`relative flex h-full min-h-0 min-w-0 gap-[0.7em] ${stacked ? 'flex-col' : 'flex-row'}`}>
      {items.map((item, index) => {
        const tone = TONES[index % TONES.length];
        const isOpen = openId === item.id;
        const folded = openId !== null && !isOpen;
        const read = seen(item.id);
        const picture = item.image ?? null;
        const header = (
          <span className={`flex min-w-0 items-center gap-[0.6em] px-[0.9em] py-[0.6em] text-white ${read && !isOpen ? 'bg-emerald-700' : tone.dot}`}>
            {read && !isOpen ? <CheckCircle2 className="h-[1.3em] w-[1.3em] shrink-0" aria-label="Read" /> : <GlyphIcon text={item.label} className="h-[1.3em] w-[1.3em] shrink-0" />}
            <span className="min-w-0 text-[1.25em] font-bold leading-tight">{item.label}</span>
          </span>
        );

        return (
          <li key={item.id} className={`min-h-0 min-w-0 transition-[flex-grow] duration-500 motion-reduce:transition-none ${folded ? 'shrink-0 grow-0 basis-auto' : 'grow basis-0'}`}>
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => onSelect(item.id)}
              className={`relative flex h-full w-full overflow-hidden rounded-[0.9em] border-2 text-left shadow-[0_0.2em_0.8em_rgba(15,23,42,0.12)] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sd-accent motion-reduce:transition-none ${
                folded ? 'flex-row items-stretch' : 'flex-col'
              } ${isOpen ? 'border-sd-accent bg-white' : read ? 'border-emerald-300 bg-emerald-50' : tone.card}`}
            >
              {folded ? (
                <>
                  {picture && !portrait ? (
                    <span className="relative flex w-[6em] shrink-0 items-center justify-center bg-white p-[0.3em]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={assetUrl(picture.url, assetBase)} alt={picture.alt} className="h-[3.6em] w-full object-contain" />
                    </span>
                  ) : null}
                  <span className="flex min-w-0 flex-1 flex-col">
                    {header}
                    <span className={`flex-wrap items-center justify-between gap-x-[1em] gap-y-[0.3em] px-[0.9em] py-[0.5em] text-[0.85em] text-slate-700 ${portrait ? 'hidden' : 'flex'}`}>
                      <span className="min-w-0 flex-1 basis-[12em]">{read ? 'Read. Select to read it again.' : `“${teaserOf(item.text)}”`}</span>
                      <span className="inline-flex shrink-0 items-center gap-[0.4em] rounded-full bg-white/90 px-[0.9em] py-[0.3em] font-semibold text-sd-strong shadow-sm ring-1 ring-sd-line">
                        <MousePointerClick className="h-[1.1em] w-[1.1em]" aria-hidden="true" />
                        Select to compare
                      </span>
                    </span>
                  </span>
                </>
              ) : (
                <>
                  {header}
                  <span className={`flex min-h-0 flex-1 ${isOpen ? 'flex-row' : 'flex-col'}`}>
                    {picture ? (
                      <span className={`relative flex min-h-0 items-center justify-center bg-white p-[0.4em] ${isOpen ? (portrait ? 'basis-[38%] self-stretch' : 'basis-[48%] self-stretch') : 'flex-[3]'}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={assetUrl(picture.url, assetBase)} alt={picture.alt} className="h-full max-h-full w-full object-contain" />
                        <Credit image={picture} />
                      </span>
                    ) : null}
                    <span className="relative flex min-h-0 min-w-0 flex-[2] overflow-y-auto px-[0.9em] py-[0.7em] text-slate-900">
                      {isOpen ? (
                        <span key={item.id} className={`my-auto block leading-snug ${portrait ? 'text-[0.9em]' : 'text-[1.1em]'} ${motion.fadeUp}`}>
                          {item.text}
                        </span>
                      ) : (
                        <span className="my-auto flex w-full flex-col items-center gap-[0.7em] text-center">
                          {picture ? null : (
                            <span aria-hidden="true" className="flex h-[4.6em] w-[4.6em] items-center justify-center rounded-full bg-white/85 text-sd-accent shadow-[inset_0_0_0_0.12em_var(--sd-line),0_0.3em_0.9em_rgba(15,23,42,0.1)]">
                              <GlyphIcon text={item.label} className="h-[2.4em] w-[2.4em]" />
                            </span>
                          )}
                          <span className="max-w-[17em] text-[1em] italic leading-snug text-slate-700">&ldquo;{teaserOf(item.text)}&rdquo;</span>
                          <span className="inline-flex items-center gap-[0.4em] rounded-full bg-white/90 px-[0.9em] py-[0.3em] text-[0.8em] font-semibold text-sd-strong shadow-sm ring-1 ring-sd-line">
                            <MousePointerClick className="h-[1.1em] w-[1.1em]" aria-hidden="true" />
                            {read ? 'Select to read it again' : 'Select to see it'}
                          </span>
                        </span>
                      )}
                    </span>
                  </span>
                </>
              )}
            </button>
          </li>
        );
      })}
      {!stacked ? (
        <li aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[1.3em] z-10 flex h-[2.4em] w-[2.4em] -translate-x-1/2 items-center justify-center rounded-full bg-slate-900 text-[0.8em] font-extrabold text-white ring-[0.25em] ring-white">
          VS
        </li>
      ) : null}
    </ul>
  );
}
