'use client';

import { useEffect, useMemo, useRef } from 'react';
import { AlertTriangle, ArrowLeft, Lightbulb, Link2 } from 'lucide-react';

import { assetUrl, relatedConcepts, resolveActivity, stageLabel, activityKey, type ResolvedActivity } from '@/lib/study-deck/deck';
import { slideStatus, type DeckProgress, type ResultInput } from '@/lib/study-deck/progress';
import type { BankQuestion } from '@/lib/h5p/question-bank-h5p-map';
import type { DeckSlide, StudyDeck } from '@/lib/study-deck/types';
import { ActivityCard } from './ActivityCard';

export interface SlideViewProps {
  deck: StudyDeck;
  slide: DeckSlide;
  bank: ReadonlyMap<number, BankQuestion>;
  progress: DeckProgress;
  assetBase: string | null;
  onResult: (key: string, result: ResultInput, conceptId: number | null, questionId: number | null) => void;
  onGoto: (n: number) => void;
}

/**
 * One slide, as a lesson step rather than a page of a document.
 *
 * Order follows how the idea is taught: what stage this is, the explanation of each concept it
 * teaches, the picture, an example, the common mistake, how it connects to earlier ideas, and
 * then the interactive activities. Feedback comes from the activity itself, once answered.
 */
export function SlideView({ deck, slide, bank, progress, assetBase, onResult, onGoto }: SlideViewProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  const c = slide.content;
  const isCover = slide.slide_type === 'cover';

  // Move focus to the new slide's title so a screen-reader or keyboard user lands on it.
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [slide.n]);

  // Resolved once per slide and bank, so the cards below get stable props across progress updates.
  const resolved: ResolvedActivity[] = useMemo(() => slide.activities.map((activity) => resolveActivity(activity, bank)), [slide, bank]);
  const related = relatedConcepts(deck, slide);
  const status = slideStatus(slide, progress);
  const nameOf = (id: number | null) => (id !== null ? deck.concepts[String(id)]?.name ?? null : null);

  return (
    <article aria-labelledby={`slide-${slide.n}-title`} className="space-y-5">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">{stageLabel(slide.slide_type)}</p>
        <h2
          id={`slide-${slide.n}-title`}
          ref={heading}
          tabIndex={-1}
          className={`mt-1 font-semibold tracking-tight text-slate-900 outline-none ${isCover ? 'text-3xl sm:text-4xl' : 'text-2xl'}`}
        >
          {isCover ? deck.chapter.name : slide.title}
        </h2>
        {isCover ? (
          <p className="mt-1 text-sm text-slate-600">
            Class {deck.chapter.standard_name} · {deck.chapter.subject_name}
          </p>
        ) : null}
      </header>

      {c.explanations.length > 0 ? (
        <div className="space-y-3">
          {c.explanations.map((e) => (
            <div key={e.concept_id} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
              {slide.taught_concept_ids.length > 1 ? (
                <p className="mb-1 text-xs font-semibold text-slate-500">{nameOf(e.concept_id)}</p>
              ) : null}
              <p className="text-lg leading-relaxed text-slate-900">{e.text}</p>
            </div>
          ))}
        </div>
      ) : c.body ? (
        <p className={`leading-relaxed text-slate-800 ${isCover ? 'text-xl' : 'text-lg'}`}>{c.body}</p>
      ) : null}

      {c.bullets.length > 0 ? (
        <ul className="list-disc space-y-1 pl-6 text-base text-slate-800">
          {c.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ) : null}

      {slide.image ? (
        <figure className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element -- deck images are our own stored files or local review copies */}
          <img
            src={assetUrl(slide.image.url, assetBase)}
            alt={slide.image.alt}
            width={slide.image.width}
            height={slide.image.height}
            className="mx-auto max-h-80 w-auto max-w-full object-contain"
            loading="lazy"
          />
          <figcaption className="border-t border-slate-100 px-4 py-2 text-xs text-slate-600">
            {slide.image.caption ? `${slide.image.caption}. ` : ''}
            {slide.image.type === 'photo' && slide.image.source_url
              ? `${slide.image.creator ?? 'Openverse'}, ${slide.image.licence}. `
              : 'Drawn for this lesson. '}
            {slide.image.type === 'photo' && slide.image.source_url ? (
              <a href={slide.image.source_url} target="_blank" rel="noreferrer noopener" className="text-indigo-700 underline">
                Source
              </a>
            ) : null}
          </figcaption>
        </figure>
      ) : null}

      {c.example ? (
        <aside className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-emerald-900">
            <Lightbulb className="h-4 w-4" aria-hidden="true" />
            Worked example
          </p>
          <p className="text-base leading-relaxed text-emerald-950">{c.example}</p>
        </aside>
      ) : null}

      {c.misconception ? (
        <aside className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-amber-900">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            Common mistake
          </p>
          <p className="text-base text-amber-950">
            <span className="font-medium">Not quite: </span>
            {c.misconception.wrong_idea}
          </p>
          <p className="mt-1 text-base text-amber-950">
            <span className="font-medium">Instead: </span>
            {c.misconception.correction}
          </p>
        </aside>
      ) : null}

      {c.relationship_note || related.length > 0 ? (
        <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
            <Link2 className="h-4 w-4" aria-hidden="true" />
            How this connects
          </p>
          {c.relationship_note ? <p className="text-base text-slate-800">{c.relationship_note}</p> : null}
          {related.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-2">
              {related.map((r) => (
                <li key={r.concept.id}>
                  {r.slide !== null && r.slide !== slide.n ? (
                    <button
                      type="button"
                      onClick={() => onGoto(r.slide as number)}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1 text-sm text-slate-800 hover:border-indigo-400 hover:text-indigo-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                      {r.kind === 'builds on' ? 'Builds on' : 'Connects to'} {r.concept.name}
                    </button>
                  ) : (
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700">
                      {r.kind === 'builds on' ? 'Builds on' : 'Connects to'} {r.concept.name}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </aside>
      ) : null}

      {resolved.length > 0 ? (
        <div className="space-y-3" aria-label="Activities for this slide">
          {resolved.map((r, index) => {
            const key = activityKey(slide, index);
            const connectsId = r.activity.connects_concept;

            return (
              <ActivityCard
                key={`${key}-${r.activity.question_id ?? 'authored'}`}
                resolved={r}
                activityKey={key}
                done={Boolean(progress.activities[key]?.done)}
                connects={nameOf(connectsId)}
                onResult={onResult}
              />
            );
          })}
          <p role="status" className="text-xs text-slate-600">
            {status.done} of {status.total} {status.total === 1 ? 'activity' : 'activities'} done
          </p>
        </div>
      ) : null}
    </article>
  );
}
