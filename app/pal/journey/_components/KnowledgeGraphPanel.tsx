'use client';

import React, { useEffect, useState } from 'react';
import { Info, Loader2, Lock, Network } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  defaultLearnerId,
  fetchKnowledgeMap,
  fetchKnowledgeMapForViewer,
  type KnowledgeMap,
  type KnowledgeMapConcept,
  type KnowledgeMapNodeStatus,
} from '@/app/pal/data/pal-eso';
import type { JourneyMilestone } from '@/app/pal/journey/data/pal-journey';
import type { JourneyViewContext } from './MountainJourneyView';

export interface KnowledgeGraphPanelProps {
  /** Null/undefined keeps the dialog closed — set by MountainJourneyView when a milestone's "Explore concept map" button is pressed. */
  milestone: JourneyMilestone | null;
  viewContext: JourneyViewContext;
  onClose: () => void;
}

const STATUS_STYLE: Readonly<Record<KnowledgeMapNodeStatus, { label: string; dot: string; text: string }>> = {
  mastered: { label: 'Mastered', dot: 'bg-emerald-500', text: 'text-emerald-700' },
  retained: { label: 'Retained', dot: 'bg-emerald-500', text: 'text-emerald-700' },
  in_progress: { label: 'In progress', dot: 'bg-amber-500', text: 'text-amber-700' },
  not_started: { label: 'Not started', dot: 'bg-slate-400', text: 'text-slate-600' },
  not_ready: { label: 'No content yet', dot: 'bg-slate-400', text: 'text-slate-500' },
  locked: { label: 'Locked', dot: 'bg-slate-400', text: 'text-slate-500' },
};

/**
 * A pure renderer over EsoPolicyService::chapterKnowledgeMap()'s existing
 * response — no new graph logic, no invented relationships. Concepts are
 * grouped by their real prerequisite depth (the backend's own layout axis)
 * rather than laid out as a force-directed graph, which would need a new
 * library for a secondary panel the brief itself frames as optional.
 *
 * `viewContext.mode === 'monitor'` calls the teacher-scoped sibling fetcher
 * over the same data; a student always sees their own map via the
 * student-only route.
 */
export function KnowledgeGraphPanel({ milestone, viewContext, onClose }: KnowledgeGraphPanelProps) {
  const [map, setMap] = useState<KnowledgeMap | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const conceptId = milestone?.conceptId ?? null;
  const open = Boolean(milestone) && Boolean(conceptId);

  useEffect(() => {
    if (!open || !conceptId) {
      setMap(null);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const isMonitor = viewContext.mode === 'monitor';
    const learnerId = (isMonitor && viewContext.studentId) || defaultLearnerId();
    const load = isMonitor ? fetchKnowledgeMapForViewer : fetchKnowledgeMap;

    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setLoading(true);
      setError(null);
      load(learnerId, Number(conceptId), controller.signal)
        .then((result) => {
          if (!controller.signal.aborted) setMap(result);
        })
        .catch((reason: unknown) => {
          if (controller.signal.aborted) return;
          setError(reason instanceof Error ? reason.message : 'Couldn’t load the concept map.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    });

    return () => controller.abort();
  }, [open, conceptId, viewContext.mode, viewContext.studentId]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Network aria-hidden className="h-4 w-4 text-indigo-600" />
            {map ? `Concept map — ${map.chapterName}` : 'Concept map'}
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
            Loading the concept map…
          </div>
        )}

        {!loading && error && (
          <p className="flex items-start gap-1.5 py-6 text-sm text-rose-700">
            <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}

        {!loading && !error && map && <KnowledgeMapBody map={map} />}
      </DialogContent>
    </Dialog>
  );
}

function KnowledgeMapBody({ map }: { map: KnowledgeMap }) {
  const byDepth = new Map<number, KnowledgeMapConcept[]>();
  for (const concept of map.concepts) {
    const row = byDepth.get(concept.depth) ?? [];
    row.push(concept);
    byDepth.set(concept.depth, row);
  }
  const depths = [...byDepth.keys()].sort((a, b) => a - b);
  const nameById = new Map(map.concepts.map((c) => [c.conceptId, c.name]));

  return (
    <div className="space-y-5">
      {map.chapterDescription && <p className="text-sm text-slate-600">{map.chapterDescription}</p>}

      <div className="space-y-3">
        {depths.map((depth) => (
          <div key={depth} className="flex flex-wrap items-center gap-2">
            {byDepth.get(depth)!.map((concept) => {
              const style = STATUS_STYLE[concept.status];
              return (
                <span
                  key={concept.conceptId}
                  title={
                    concept.status === 'locked' && concept.blockingPrerequisiteNames.length > 0
                      ? `Needs: ${concept.blockingPrerequisiteNames.join(', ')}`
                      : style.label
                  }
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium',
                    concept.isCurrent ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-slate-200',
                    'bg-white'
                  )}
                >
                  {concept.status === 'locked' ? (
                    <Lock aria-hidden className="h-3 w-3 text-slate-400" />
                  ) : (
                    <span aria-hidden className={cn('h-2 w-2 rounded-full', style.dot)} />
                  )}
                  <span className={style.text}>{concept.name}</span>
                  {concept.chapterRelation !== 'current' && (
                    <span className="text-slate-400">· {concept.chapterName}</span>
                  )}
                </span>
              );
            })}
          </div>
        ))}
      </div>

      {map.edges.length > 0 && (
        <ul className="space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-600">
          {map.edges.map((edge, index) => (
            <li key={index}>
              {edge.type === 'direct_prerequisite'
                ? `${nameById.get(edge.fromConceptId) ?? edge.fromConceptId} → ${nameById.get(edge.toConceptId) ?? edge.toConceptId} (prerequisite)`
                : `${nameById.get(edge.fromConceptId) ?? edge.fromConceptId} ↔ ${nameById.get(edge.toConceptId) ?? edge.toConceptId} (related)`}
            </li>
          ))}
        </ul>
      )}

      <p className="border-t border-slate-100 pt-3 text-xs text-slate-500">
        {map.stats.concepts} concepts · {map.stats.directPrerequisites} prerequisite links · {map.stats.related} related
        links · {map.stats.misconceptions} misconceptions on record.
      </p>
    </div>
  );
}
