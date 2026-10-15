'use client';

import { useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

import { assetUrl } from '@/lib/study-deck/deck';
import { conceptImage } from '@/lib/study-document/document';
import type { DeckImage } from '@/lib/study-deck/types';
import type { StudyDocument } from '@/lib/study-document/types';

/** Where a picture came from, in one line: a photograph is never shown without its credit, a drawn diagram says it was drawn. */
export function creditOf(image: DeckImage): string {
  if (image.type === 'diagram') return 'Drawn for this lesson.';
  const credit = (image.attribution ?? '').trim() || `${image.creator ?? 'Openverse'}, ${image.licence ?? ''}`.trim();

  return credit;
}

/**
 * A concept's picture, small, beside its words. Select it to see it larger in place (no dialog, so nothing takes focus from the
 * page around it) and to reach its source. Its credit is always under it.
 */
export function ConceptPicture({ image, name, size = 'md' }: { image: DeckImage; name: string; size?: 'sm' | 'md' }) {
  const [large, setLarge] = useState(false);
  const small = size === 'sm';
  const credit = creditOf(image);

  return (
    <figure className={`${large ? 'w-full max-w-md' : small ? 'w-24' : 'w-36'} shrink-0 transition-all duration-300 motion-reduce:transition-none`} data-testid="concept-picture">
      <button
        type="button"
        aria-pressed={large}
        aria-label={`${large ? 'Make smaller' : 'Make larger'}: picture of ${name}`}
        onClick={() => setLarge((v) => !v)}
        className="group relative block w-full overflow-hidden rounded-lg border border-slate-300 bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sd-accent"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- stored pictures are our own files */}
        <img
          src={assetUrl(image.url, null)}
          alt={image.alt}
          width={image.width}
          height={image.height}
          loading="lazy"
          className={`block w-full transition-all duration-300 motion-reduce:transition-none ${large ? 'h-auto max-h-[22rem] object-contain' : small ? 'h-16 object-cover' : 'h-24 object-cover'}`}
        />
        <span aria-hidden="true" className="absolute right-1 top-1 rounded bg-white/90 p-0.5 text-slate-700 opacity-0 shadow-sm transition group-hover:opacity-100 group-focus-visible:opacity-100">
          {large ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
        </span>
      </button>
      <figcaption className="mt-0.5 text-[10px] leading-tight text-slate-600" title={credit}>
        {large ? (
          <>
            {credit}{' '}
            {image.type === 'photo' && image.source_url ? (
              <a href={image.source_url} target="_blank" rel="noreferrer noopener" className="text-sd-strong underline">
                Source
              </a>
            ) : null}
          </>
        ) : (
          <span className="line-clamp-1">{credit}</span>
        )}
      </figcaption>
    </figure>
  );
}

/** The pictures of some concepts as a captioned row (the concept's name under each). Nothing is drawn for a concept with no picture. */
export function ConceptStrip({ doc, conceptIds, max = 4, label }: { doc: StudyDocument; conceptIds: readonly number[]; max?: number; label?: string }) {
  const items = Array.from(new Set(conceptIds))
    .flatMap((id) => {
      const image = conceptImage(doc, id);

      return image ? [{ id, image, name: doc.concepts[String(id)]?.name ?? '' }] : [];
    })
    .slice(0, max);
  if (items.length === 0) return null;

  return (
    <div className="space-y-1" data-testid="concept-strip">
      {label ? <p className="text-xs font-bold uppercase tracking-wider text-sd-strong">{label}</p> : null}
      <ul className="flex flex-wrap gap-3">
        {items.map((item) => (
          <li key={item.id} className="space-y-0.5">
            <ConceptPicture image={item.image} name={item.name} />
            <p className="max-w-36 text-xs font-medium leading-tight text-slate-800">{item.name}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
