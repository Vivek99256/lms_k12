'use client';

import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { Loader2 } from 'lucide-react';

import { fetchFlashcard, type H5pContext, type H5pFlashcard } from '@/app/h5p/data/h5p';
import {
  coursePresentationApi,
  memoryGameApi,
  singleChoiceSetApi,
  trueFalseApi,
} from '@/app/h5p/data/h5p-content-types';
import { MemoryGamePlayer } from '@/app/h5p/h5p_memory_game/[id]/page';
import { TrueFalsePlayer } from '@/app/h5p/h5p_true_false/[id]/page';
import { SingleChoiceSetPlayer } from '@/app/h5p/h5p_single_choice_set/[id]/page';
import { CoursePresentationPlayer } from '@/app/h5p/h5p_course_presentation/[id]/page';
import { FlashcardsPlayer } from '@/app/h5p/h5p_flashacard/[id]/page';
import type { QuestionResult } from '@/components/h5p/players/types';

/**
 * `FlashcardsPlayer` takes a `cards` array (it plays a whole chapter deck
 * when the standalone page fetches it), not a single `item` like the other
 * players here. `fetchFlashcard()` already fetches exactly one card by id —
 * this just wraps it as a one-card "deck" so it fits the same `{ item, ctx,
 * embedded, onResult }` shape every other registry entry uses.
 */
function SingleFlashcardPlayer({
  item,
  ctx,
  embedded,
  onResult,
}: {
  item: H5pFlashcard;
  ctx: H5pContext;
  embedded?: boolean;
  onResult?: (r: QuestionResult) => void;
}) {
  return <FlashcardsPlayer cards={[item]} ctx={ctx} questionId={item.id} embedded={embedded} onResult={onResult} />;
}

/**
 * Mounts an already-authored native H5P activity inline, inside PAL Learn.
 *
 * WHY THIS FILE EXISTS. `ConceptLearningResourceService::h5pForConcept()`
 * resolves a real `/h5p/{type}/{id}?...` player url for a tagged
 * `pal_h5p_node_metadata` node (see app/pal/data/pal-diagnostic.ts's
 * `LearnResourceItem`). Opening that url in a new tab already works and needs
 * nothing from this file. This component exists only to do better than that
 * for the types it knows how to: fetch the row and mount the SAME player the
 * standalone page renders, in place, so a student never leaves the lesson.
 *
 * NOTHING HERE IS A NEW PLAYER. Every entry below reuses a component the
 * native type's own `/h5p/{type}/[id]/page.tsx` already exports for exactly
 * this purpose (an `embedded`/`onResult` prop pair) — the same components
 * `components/h5p/players/{MatchingPlayer,TrueFalsePlayer,...}` wrap to
 * adapt a Question-bank row onto. This does the same wrapping one level up,
 * for a native H5P node instead of a question-bank row.
 */

export interface H5PActivityTarget {
  h5pType: string;
  nodeId: number;
  chapterId: number;
  subjectId: number;
  standardId: number;
}

/**
 * Each type's fetch/Player pair is internally consistent (same row shape in
 * and out); unifying the two `any`s below onto one real type would need a
 * discriminated union with no real payoff for four lines of glue code.
 */
interface RegistryEntry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fetch: (id: number | string, ctx: H5pContext) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Player: (props: { item: any; ctx: H5pContext; embedded?: boolean; onResult?: (r: QuestionResult) => void }) => ReactElement;
}

/**
 * Native H5P types PAL Learn can mount inline today.
 *
 * Adding a type is the whole job — no other file changes. A type lands here
 * once its `/h5p/{type}/[id]/page.tsx` already exports a `{ item, ctx,
 * embedded, onResult }` player (most native types do; see that file's own
 * `Preloaded*` interface) or, like `flash_cards`, a thin adapter to one.
 * The legacy `image_hotspot` (h5p_scenarios) is not here yet: that page has
 * no embeddable export yet — Phase 2/3 work, not this file's job. Anything
 * not listed still opens fine as a full-page link (the url
 * `h5pForConcept()` resolves), it just does not play inline.
 */
const REGISTRY: Record<string, RegistryEntry> = {
  memory_game: { fetch: memoryGameApi.get, Player: MemoryGamePlayer },
  true_false: { fetch: trueFalseApi.get, Player: TrueFalsePlayer },
  single_choice_set: { fetch: singleChoiceSetApi.get, Player: SingleChoiceSetPlayer },
  course_presentation: { fetch: coursePresentationApi.get, Player: CoursePresentationPlayer },
  flash_cards: { fetch: fetchFlashcard, Player: SingleFlashcardPlayer },
};

export function isInlineH5PPlayable(h5pType: string | null | undefined): boolean {
  return Boolean(h5pType && REGISTRY[h5pType]);
}

export function H5PActivityPlayer({
  target,
  onResult,
}: {
  target: H5PActivityTarget;
  onResult?: (result: QuestionResult) => void;
}) {
  const entry = REGISTRY[target.h5pType];

  const ctx: H5pContext = useMemo(
    () => ({
      chapter_id: String(target.chapterId),
      subject_id: String(target.subjectId),
      standard_id: String(target.standardId),
    }),
    [target.chapterId, target.subjectId, target.standardId]
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [item, setItem] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!entry) return;
    let cancelled = false;

    queueMicrotask(() => {
      if (!cancelled) {
        setLoading(true);
        setError('');
      }
    });

    entry
      .fetch(target.nodeId, ctx)
      .then((row) => {
        if (!cancelled) setItem(row);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : 'This activity could not be loaded.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [entry, target.nodeId, ctx]);

  if (!entry) {
    return (
      <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
        This activity type can&rsquo;t be played here yet.
      </p>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-slate-500">
        <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" />
        Loading activity…
      </div>
    );
  }

  if (error || !item) {
    return (
      <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {error || 'This activity could not be loaded.'}
      </p>
    );
  }

  const Player = entry.Player;
  return <Player item={item} ctx={ctx} embedded onResult={onResult} />;
}
