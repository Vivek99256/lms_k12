'use client';

import React, { createContext, useContext, useState } from 'react';

import type { SimulationCard, SimulationProgress } from '@/app/course-master/data/simulations';
import { useAuthoringProbe, useChapterSimulations, useSimulationLibrary, type SimulationActions } from '@/hooks/use-simulations';
import { authoringAllowed, cardEditable, shouldProbeAuthoring, simulationsForTopic } from '@/lib/simulation-links';

import { AddSimulationDialog } from './AddSimulationDialog';
import { EditSimulationDialog } from './EditSimulationDialog';
import { LinkConceptsDialog } from './LinkConceptsDialog';
import { SimulationDetailSheet } from './SimulationDetailSheet';
import { SimulationPlayer, type SimulationPlayerOutcome } from './SimulationPlayer';

/**
 * Everything the Simulations section and the topic rows share for ONE chapter: the list, who may author, and the sheets, dialogs and player
 * they open. The parent keys this by chapter, so changing chapter starts clean.
 *
 * `staff` is the Prayogshala tab's own notion of a person who manages content (it decides whether links still in review are drawn, as
 * pending). `authoring` is different and comes from the SERVER (the list's `editable` flag, or the author-only limits call): it decides whether
 * the Add / Edit / Link controls are drawn at all. Neither is a gate; every write is checked again on the server.
 */

export interface SimulationsContextValue {
  chapterId: number;
  staff: boolean;
  authoring: boolean;
  loading: boolean;
  error: string | null;
  simulations: SimulationCard[];
  notice: string;
  /** Simulations linked to a concept of this topic. */
  forTopic: (topicId: number) => SimulationCard[];
  openDetail: (card: SimulationCard) => void;
  play: (card: SimulationCard) => void;
  retry: () => void;
  /** Author controls. Calling them without authoring does nothing visible: the dialogs are not mounted. */
  openAdd: () => void;
  openEdit: (card: SimulationCard) => void;
  openLinks: (card: SimulationCard) => void;
  editable: (card: SimulationCard) => boolean;
  library: { simulations: SimulationCard[]; loading: boolean; error: string | null };
  /** Tells the library list to load (an author opened it). */
  setLibraryWanted: (wanted: boolean) => void;
}

const SimulationsContext = createContext<SimulationsContextValue | null>(null);

/** The shared state, or null when the tab is rendered without a Simulations provider (the topic rows then draw nothing extra). */
export function useSimulationsContext(): SimulationsContextValue | null {
  return useContext(SimulationsContext);
}

interface Props {
  chapterId: number;
  /** The Prayogshala tab's `canCreateContent !== false`: draws links in review as pending. */
  canManage: boolean;
  /** `canCreateContent === true`: only these people are asked whether they may author. */
  canCreate: boolean;
  children: React.ReactNode;
}

export function SimulationsProvider({ chapterId, canManage, canCreate, children }: Props) {
  const data = useChapterSimulations(chapterId);

  const probeWanted = shouldProbeAuthoring({
    canCreateContent: canCreate ? true : undefined,
    listEditable: data.listEditable,
    cards: data.simulations,
  });
  const probe = useAuthoringProbe(probeWanted && !data.loading);
  const authoring = authoringAllowed({ listEditable: data.listEditable, cards: data.simulations, probe });

  const [libraryWanted, setLibraryWanted] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const library = useSimulationLibrary(authoring && (libraryWanted || addOpen));

  const [detail, setDetail] = useState<SimulationCard | null>(null);
  const [playing, setPlaying] = useState<SimulationCard | null>(null);
  const [editing, setEditing] = useState<SimulationCard | null>(null);
  const [linking, setLinking] = useState<SimulationCard | null>(null);
  const [afterAdd, setAfterAdd] = useState<SimulationCard | null>(null);
  const [notice, setNotice] = useState('');

  const staff = canManage;

  const onPlayerClose = (outcome: SimulationPlayerOutcome) => {
    setPlaying(null);
    void outcome.saved.then(() => data.reload());
  };

  const wrap = (fn: SimulationActions): SimulationActions => ({
    ...fn,
    // Anything an author saves also refreshes the library list they may have open.
    create: async (input) => {
      const result = await fn.create(input);
      if (result.ok) void library.reload();
      return result;
    },
    update: async (id, input) => {
      const result = await fn.update(id, input);
      if (result.ok) void library.reload();
      return result;
    },
    setStatus: async (id, status) => {
      const result = await fn.setStatus(id, status);
      if (result.ok) void library.reload();
      return result;
    },
    remove: async (id) => {
      const result = await fn.remove(id);
      if (result.ok) void library.reload();
      return result;
    },
  });
  const actions = wrap(data.actions);

  const value: SimulationsContextValue = {
    chapterId,
    staff,
    authoring,
    loading: data.loading,
    error: data.error,
    simulations: data.simulations,
    notice,
    forTopic: (topicId) => simulationsForTopic(data.simulations, topicId, staff),
    openDetail: setDetail,
    play: (card) => {
      setDetail(null);
      setPlaying(card);
    },
    retry: data.retry,
    openAdd: () => setAddOpen(true),
    openEdit: (card) => {
      setDetail(null);
      setEditing(card);
    },
    openLinks: (card) => {
      setDetail(null);
      setLinking(card);
    },
    editable: (card) => authoring && cardEditable(card, authoring),
    library: { simulations: library.simulations, loading: library.loading, error: library.error },
    setLibraryWanted,
  };

  const existing = [...data.simulations, ...library.simulations.filter((card) => !data.simulations.some((c) => c.id === card.id))].map((card) => ({
    id: card.id,
    slug: card.slug,
    title: card.title,
    status: card.status,
    scope: 'tenant',
  }));
  const categories = [...new Set([...data.simulations, ...library.simulations].map((card) => card.category).filter((c): c is string => Boolean(c)))];

  const onProgress = (id: number, report: Pick<SimulationProgress, 'status' | 'percent' | 'step'>) => data.applyProgress(id, report);

  return (
    <SimulationsContext.Provider value={value}>
      {children}

      {detail ? (
        <SimulationDetailSheet
          card={detail}
          chapterId={chapterId}
          staff={staff}
          authoring={value.editable(detail)}
          actions={actions}
          onClose={() => setDetail(null)}
          onPlay={value.play}
          onEdit={value.openEdit}
          onLinks={value.openLinks}
          onNotice={setNotice}
        />
      ) : null}

      {playing ? <SimulationPlayer simulation={playing} onClose={onPlayerClose} onProgress={onProgress} /> : null}

      {authoring && addOpen ? (
        <AddSimulationDialog
          open
          onOpenChange={(open) => {
            if (open) return;
            setAddOpen(false);
            if (afterAdd) {
              setLinking(afterAdd);
              setAfterAdd(null);
            }
          }}
          categories={categories}
          simulations={existing}
          create={actions.create}
          update={actions.update}
          setStatus={actions.setStatus}
          onAdded={(message, card) => {
            setNotice(message);
            if (card) setAfterAdd(card);
          }}
          onPreview={(card) => {
            setAfterAdd(null);
            setAddOpen(false);
            setPlaying(card);
          }}
        />
      ) : null}

      {authoring && editing ? (
        <EditSimulationDialog
          card={editing}
          categories={categories}
          update={actions.update}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setNotice(message);
            setEditing(null);
          }}
        />
      ) : null}

      {authoring && linking ? (
        <LinkConceptsDialog
          card={linking}
          chapterId={chapterId}
          onClose={() => setLinking(null)}
          onChanged={() => {
            void data.reload();
            void library.reload();
          }}
        />
      ) : null}
    </SimulationsContext.Provider>
  );
}
