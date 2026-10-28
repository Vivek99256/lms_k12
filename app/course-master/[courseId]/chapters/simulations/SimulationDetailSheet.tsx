'use client';

import { AlertTriangle, Clock, Eye, EyeOff, Layers, Link2, Pencil, Play, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { describeSimulationError, simulationService, type SimulationCard, type SimulationDetail } from '@/app/course-master/data/simulations';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import type { SimulationActions } from '@/hooks/use-simulations';
import { difficultyOf, minutesLabel, missionsLabel, readSpec, startLabel } from '@/lib/simulation-format';
import { assetCreditLines } from '@/lib/simulation-host';
import { conceptChipsFor, isPendingReview } from '@/lib/simulation-links';

import { DifficultyBars, MetaItem, PendingBadge, ProgressPill, SimulationCover, StatusPill } from './simulation-bits';

const PRIMARY = 'bg-indigo-600 text-white hover:bg-indigo-700';

/**
 * One simulation before it is played: what it is, which concepts of this chapter it supports (and why, and where in the textbook), who made the
 * models and pictures it uses (a CC BY licence needs that credit to be visible), and - for the people the SERVER says may author - the
 * controls to change it. The specification and credits are fetched when the sheet opens.
 */
export function SimulationDetailSheet({
  card,
  chapterId,
  staff,
  authoring,
  actions,
  onClose,
  onPlay,
  onEdit,
  onLinks,
  onNotice,
}: {
  card: SimulationCard;
  chapterId: number;
  staff: boolean;
  /** True only for a card the server marked editable (platform-tenant staff). */
  authoring: boolean;
  actions: SimulationActions;
  onClose: () => void;
  onPlay: (card: SimulationCard) => void;
  onEdit: (card: SimulationCard) => void;
  onLinks: (card: SimulationCard) => void;
  onNotice: (message: string) => void;
}) {
  const [loaded, setLoaded] = useState<{ detail: SimulationDetail | null; error: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');

  useEffect(() => {
    let live = true;
    simulationService
      .show(card.id)
      .then((detail) => live && setLoaded({ detail, error: null }))
      .catch((err: unknown) => live && setLoaded({ detail: null, error: describeSimulationError(err, 'The details could not be loaded.').message }));
    return () => {
      live = false;
    };
  }, [card.id]);

  const detail = loaded?.detail ?? null;
  const facts = readSpec(detail?.spec);
  const difficulty = difficultyOf(card.difficulty);
  const minutes = minutesLabel(card.minutes);
  const missions = missionsLabel(card.missions || facts.missions.length);
  const links = conceptChipsFor(detail ?? card, { chapterId }, staff);
  const otherLinks = conceptChipsFor(detail ?? card, {}, staff).filter((link) => link.chapter_id !== chapterId);
  const credits = assetCreditLines(detail?.assets);
  const pending = staff && links.some(isPendingReview);
  const published = card.status === 'published';

  const run = async (work: () => Promise<{ ok: boolean; message?: string }>, done: string) => {
    setBusy(true);
    setFailure('');
    const result = await work();
    setBusy(false);
    if (result.ok) {
      onNotice(done);
      onClose();
    } else {
      setFailure(result.message ?? 'That did not work.');
    }
  };

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-lg">
        <div className="aspect-[16/9] w-full shrink-0">
          <SimulationCover simulation={card} />
        </div>
        <div className="space-y-5 p-5">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={card.status} />
              <ProgressPill progress={card.progress} />
              {pending ? <PendingBadge>Link pending review</PendingBadge> : null}
            </div>
            <SheetTitle className="text-xl font-semibold text-slate-900">{card.title}</SheetTitle>
            <SheetDescription className="text-sm text-slate-600">{card.subtitle ?? card.summary ?? 'An interactive simulation.'}</SheetDescription>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-slate-500">
              {minutes ? <MetaItem icon={Clock}>{minutes}</MetaItem> : null}
              {difficulty ? (
                <MetaItem>
                  <DifficultyBars level={difficulty.level} /> {difficulty.label}
                </MetaItem>
              ) : null}
              {missions ? <MetaItem icon={Layers}>{missions}</MetaItem> : null}
            </div>
          </div>

          <Button type="button" onClick={() => onPlay(card)} disabled={!published && !staff} className={`h-10 w-full gap-2 rounded-full ${PRIMARY}`}>
            <Play className="size-4" aria-hidden="true" /> {startLabel(card)}
          </Button>

          {card.summary && card.subtitle ? <p className="text-sm leading-relaxed text-slate-700">{card.summary}</p> : null}
          {facts.intro ? <p className="text-sm leading-relaxed text-slate-700">{facts.intro}</p> : null}

          {loaded === null ? (
            <div className="space-y-2" aria-label="Loading details">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-full" />
            </div>
          ) : loaded.error ? (
            <p className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {loaded.error}
            </p>
          ) : null}

          {facts.missions.length > 0 ? (
            <section aria-label="Missions">
              <h3 className="mb-1.5 text-sm font-semibold text-slate-900">What you will do</h3>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
                {facts.missions.map((mission, index) => (
                  <li key={mission.id ?? index}>{mission.title ?? mission.brief ?? `Mission ${index + 1}`}</li>
                ))}
              </ol>
            </section>
          ) : null}

          {links.length > 0 || otherLinks.length > 0 ? (
            <section aria-label="Linked concepts">
              <h3 className="mb-1.5 text-sm font-semibold text-slate-900">Concepts it supports</h3>
              <ul className="space-y-2">
                {[...links, ...otherLinks].map((link) => (
                  <li key={link.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-900">{link.concept_name ?? `Concept ${link.concept_id}`}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{link.role === 'primary' ? 'Main' : 'Supporting'}</span>
                      {isPendingReview(link) ? <PendingBadge /> : null}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">{[link.chapter_name, link.topic_name].filter(Boolean).join(' · ')}</p>
                    {link.citation ? <p className="mt-1 text-xs text-slate-600">Textbook: {link.citation}</p> : null}
                    {link.reason ? <p className="mt-1 text-xs text-slate-600">{link.reason}</p> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {credits.length > 0 ? (
            <section aria-label="Credits">
              <h3 className="mb-1.5 text-sm font-semibold text-slate-900">Credits</h3>
              <ul className="space-y-1 text-xs text-slate-600">
                {credits.map((line) => (
                  <li key={line.key}>
                    {line.text}
                    {line.href ? (
                      <>
                        {' · '}
                        <a href={line.href} target="_blank" rel="noopener noreferrer" aria-label={line.name ? `Source of ${line.name}` : undefined} className="underline underline-offset-2 hover:text-slate-900">
                          Source
                        </a>
                      </>
                    ) : null}
                    {line.sourceText ? ` · Source: ${line.sourceText}` : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {authoring ? (
            <section aria-label="Manage this simulation" className="space-y-3 border-t border-slate-200 pt-4">
              <h3 className="text-sm font-semibold text-slate-900">Manage</h3>
              {failure ? (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
                  {failure}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => onLinks(card)} className="gap-1.5 rounded-full">
                  <Link2 className="size-3.5" aria-hidden="true" /> Link to concepts
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => onEdit(card)} className="gap-1.5 rounded-full">
                  <Pencil className="size-3.5" aria-hidden="true" /> Edit details
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () => actions.setStatus(card.id, published ? 'draft' : 'published'),
                      published ? `“${card.title}” is now a draft.` : `“${card.title}” is published.`,
                    )
                  }
                  className="gap-1.5 rounded-full"
                >
                  {published ? <EyeOff className="size-3.5" aria-hidden="true" /> : <Eye className="size-3.5" aria-hidden="true" />}
                  {published ? 'Unpublish' : 'Publish'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    if (!window.confirm(`Remove “${card.title}” for everyone?`)) return;
                    void run(() => actions.remove(card.id), `Removed “${card.title}”.`);
                  }}
                  className="gap-1.5 rounded-full text-rose-700"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" /> Remove
                </Button>
              </div>
              <p className="text-xs text-slate-500">Publishing a simulation does not show it in a chapter. A learner sees it only through a concept link that has been published.</p>
            </section>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
