'use client';

import { ChevronDown, Clock, FlaskConical, Layers, Link2, Play, Plus } from 'lucide-react';
import React, { useState } from 'react';

import type { SimulationCard } from '@/app/course-master/data/simulations';
import { Button } from '@/components/ui/button';
import { difficultyOf, minutesLabel, missionsLabel, startLabel } from '@/lib/simulation-format';
import { conceptChipsFor, pendingReviewCount } from '@/lib/simulation-links';
import { cn } from '@/lib/utils';

import { DifficultyBars, ConceptChip, MetaItem, PendingBadge, ProgressPill, SimulationCover, StatusPill } from './simulation-bits';
import { useSimulationsContext } from './SimulationsProvider';

const MAX_CHIPS = 4;

/** One simulation as a card: cover, title, what it takes, the concepts of this chapter it supports. Opens the detail sheet; Start plays it. */
function SimulationCardView({ card, chapterId, staff }: { card: SimulationCard; chapterId: number; staff: boolean }) {
  const ctx = useSimulationsContext();
  const chips = conceptChipsFor(card, { chapterId }, staff);
  const pending = pendingReviewCount(card, { chapterId }, staff);
  const difficulty = difficultyOf(card.difficulty);
  const minutes = minutesLabel(card.minutes);
  const missions = missionsLabel(card.missions);
  const playable = card.status === 'published' || staff;

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={() => ctx?.openDetail(card)}
        className="block aspect-[16/9] w-full overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        aria-label={`Details of ${card.title}`}
      >
        <SimulationCover simulation={card} />
      </button>
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusPill status={card.status} />
          <ProgressPill progress={card.progress} />
          {pending > 0 ? <PendingBadge>{pending === 1 ? '1 link pending review' : `${pending} links pending review`}</PendingBadge> : null}
        </div>
        <h4 className="text-sm font-semibold leading-snug text-slate-900">
          <button type="button" onClick={() => ctx?.openDetail(card)} className="text-left hover:text-indigo-700 focus-visible:outline-none focus-visible:underline">
            {card.title}
          </button>
        </h4>
        {card.subtitle ?? card.summary ? <p className="line-clamp-2 text-xs leading-relaxed text-slate-500">{card.subtitle ?? card.summary}</p> : null}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
          {minutes ? <MetaItem icon={Clock}>{minutes}</MetaItem> : null}
          {difficulty ? (
            <MetaItem>
              <DifficultyBars level={difficulty.level} /> {difficulty.label}
            </MetaItem>
          ) : null}
          {missions ? <MetaItem icon={Layers}>{missions}</MetaItem> : null}
        </div>
        {chips.length > 0 ? (
          <ul className="flex flex-wrap gap-1" aria-label="Concepts this simulation supports">
            {chips.slice(0, MAX_CHIPS).map((link) => (
              <li key={link.id} className="max-w-full">
                <ConceptChip link={link} />
              </li>
            ))}
            {chips.length > MAX_CHIPS ? <li className="text-[11px] text-slate-500">+{chips.length - MAX_CHIPS} more</li> : null}
          </ul>
        ) : null}
        <div className="mt-auto pt-1">
          <Button
            type="button"
            size="sm"
            disabled={!playable}
            onClick={() => ctx?.play(card)}
            className="h-9 w-full gap-1.5 rounded-full bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            <Play className="size-3.5" aria-hidden="true" /> {startLabel(card)}
          </Button>
        </div>
      </div>
    </article>
  );
}

/**
 * Authors only: every simulation the platform holds, to find one that is not linked to this chapter yet and link it. Opening it loads the
 * list; a learner never reaches this component (the parent draws it only when the SERVER said the session may author).
 */
function SimulationLibrary() {
  const ctx = useSimulationsContext();
  const [open, setOpen] = useState(false);
  if (!ctx) return null;
  const inChapter = new Set(ctx.simulations.map((card) => card.id));
  const others = ctx.library.simulations.filter((card) => !inChapter.has(card.id));

  return (
    <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/60">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          ctx.setLibraryWanted(!open);
        }}
        className="flex w-full items-center justify-between gap-2 rounded-2xl px-4 py-3 text-left text-sm font-medium text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <span>Simulations not linked to this chapter</span>
        <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>
      {open ? (
        <div className="border-t border-slate-200 px-4 py-3">
          {ctx.library.loading ? (
            <div className="h-10 animate-pulse rounded-xl bg-slate-100" aria-label="Loading simulations" />
          ) : ctx.library.error ? (
            <p className="text-sm text-rose-700">{ctx.library.error}</p>
          ) : others.length === 0 ? (
            <p className="text-sm text-slate-500">Every simulation is already linked to a concept of this chapter.</p>
          ) : (
            <ul className="divide-y divide-slate-200">
              {others.map((card) => (
                <li key={card.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{card.title}</p>
                    <p className="text-xs text-slate-500">
                      {card.status === 'published' ? 'Published' : card.status === 'draft' ? 'Draft' : 'Archived'} · {card.links.length} {card.links.length === 1 ? 'link' : 'links'} elsewhere
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => ctx.openLinks(card)} className="gap-1.5 rounded-full" aria-label={`Link ${card.title} to concepts`}>
                    <Link2 className="size-3.5" aria-hidden="true" /> Link to concepts
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The chapter-level Simulations section of the Prayogshala tab: the simulations linked to any concept of this chapter. A learner sees published
 * simulations through published links and nothing at all when there are none; staff also see links still in review, marked as pending. The Add
 * button and the library appear only when the server said this session may author.
 */
export function SimulationsSection() {
  const ctx = useSimulationsContext();
  if (!ctx) return null;
  const { loading, error, simulations, staff, authoring, chapterId } = ctx;

  // A learner has nothing to read here until a simulation is linked and published: the section stays out of the way.
  if (!loading && !error && simulations.length === 0 && !authoring) return null;
  if (error && !staff && !authoring) return null;

  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" aria-label="Simulations">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FlaskConical className="size-4 text-indigo-600" aria-hidden="true" />
          <h3 className="text-base font-semibold text-slate-900">Simulations</h3>
          {simulations.length > 0 ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{simulations.length}</span> : null}
        </div>
        {authoring ? (
          <Button type="button" size="sm" onClick={ctx.openAdd} className="h-9 gap-1.5 rounded-full bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-700">
            <Plus className="size-3.5" aria-hidden="true" /> Add simulation
          </Button>
        ) : null}
      </div>

      {ctx.notice ? (
        <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800" role="status">
          {ctx.notice}
        </p>
      ) : null}

      {error ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          <Button type="button" variant="ghost" onClick={ctx.retry} className="h-9 rounded-full bg-white px-4 text-rose-700">
            Try again
          </Button>
        </div>
      ) : loading && simulations.length === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading simulations">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-56 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : simulations.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
          No simulation is linked to a concept of this chapter yet. Add one, or link an existing one below.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {simulations.map((card) => (
            <SimulationCardView key={card.id} card={card} chapterId={chapterId} staff={staff} />
          ))}
        </div>
      )}

      {authoring ? <SimulationLibrary /> : null}
    </section>
  );
}

/** A compact line of the simulations linked to one topic, drawn under the topic's row in "Prayogshala by topic". Nothing when there are none. */
export function TopicSimulations({ topicId }: { topicId: number }) {
  const ctx = useSimulationsContext();
  if (!ctx) return null;
  const cards = ctx.forTopic(topicId);
  if (cards.length === 0) return null;
  return (
    <ul className="mt-1.5 flex flex-wrap items-center gap-1.5" aria-label="Simulations for this topic">
      {cards.map((card) => {
        const pending = ctx.staff && pendingReviewCount(card, { topicId }, true) > 0;
        return (
          <li key={card.id}>
            <button
              type="button"
              onClick={() => ctx.openDetail(card)}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                pending ? 'border-dashed border-amber-400 bg-amber-50 text-amber-900' : 'border-indigo-200 bg-indigo-50 text-indigo-900 hover:bg-indigo-100',
              )}
            >
              <FlaskConical className="size-3" aria-hidden="true" />
              {card.title}
              {pending ? <span className="text-[10px] uppercase tracking-wide">review</span> : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
