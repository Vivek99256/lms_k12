'use client';

/**
 * The coherence map for one subject + grade.
 *
 * Unit -> Chapter -> Topic -> Concept, plus the prerequisite edges between them.
 * Everything here is a transport layer: it fetches what the backend built and
 * types it. No curriculum structure, no node labels and no prerequisite logic are
 * decided in this file or anywhere below it - that is the whole point of the
 * feature. Adding a concept or approving an edge in the database changes the map
 * with no change here.
 *
 * WHY THIS IS NOT `lms/new_curriculum`
 * That endpoint already returns units -> chapters -> topics -> concepts, and the
 * curriculum screen uses it. But it types concepts as `string[]` - names only, no
 * ids (see CurriculumTopic in ./curriculum.ts). A prerequisite edge connects two
 * concept IDs, so there is nothing on that payload to attach an edge to. Hence a
 * separate endpoint that carries real ids at every level.
 */

import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL } from '@/app/components/utils/api_url';
import { getCurriculumSession, type CurriculumSession } from './curriculum';

/** The four levels the map draws, coarsest first. */
export type CoherenceNodeType = 'unit' | 'chapter' | 'topic' | 'concept';

/**
 * How an edge came to exist and whether a person has confirmed it.
 * 'draft' renders dashed, 'approved' solid. Nothing else may be drawn as solid.
 */
export type CoherenceEdgeStatus = 'draft' | 'approved' | 'rejected';

/**
 * 'hierarchy'  - containment, Unit holds Chapter holds Topic holds Concept.
 * 'prerequisite' - must be learned first.
 * 'cross_curricular' - related across subjects, not a gate.
 */
export type CoherenceEdgeKind = 'hierarchy' | 'prerequisite' | 'cross_curricular';

export type CoherenceNode = {
  /** Typed reference, e.g. "concept:1360". Unique across all four levels. */
  id: string;
  type: CoherenceNodeType;
  /** The row id within its own table. Not unique across levels - use `id` for that. */
  entity_id: number;
  label: string;
  /** Typed ref of the containing node, or null for a root / off-map node. */
  parent_id: string | null;
  order: number;
  /** Longest prerequisite chain beneath this node. Drives the map's progression axis. */
  depth: number;
  /** True when this node sits on a prerequisite loop; the map flags it rather than hiding it. */
  on_cycle: boolean;
  prereq_count: number;
  dependent_count: number;
  /** True for a node pulled in from another grade or subject because an edge reaches it. */
  off_map: boolean;
  meta: Record<string, unknown>;
};

export type CoherenceEdge = {
  id: string;
  /** Prerequisite end. Arrows point the way learning travels. */
  source: string;
  /** Dependent end. */
  target: string;
  kind: CoherenceEdgeKind;
  status: CoherenceEdgeStatus;
  /** 'human' | 'ai' | 'structural' | 'structure' — who proposed it. */
  tagged_by: string;
  /** Row id in its own table; null for hierarchy edges, which are derived not stored. */
  relation_id: number | null;
  /** Which table the row lives in. Needed to address it for review or delete. */
  source_table: 'concept' | 'learning' | 'expert' | null;
  relation_type: string | null;
  link_type: string | null;
  confidence: number | null;
  note: string | null;
};

/**
 * Whether an edge can be reviewed or deleted through `reviewRelation` /
 * `deleteRelation` — both take `sourceTable` and `relationId`, so an edge
 * needs both to be addressable. Hierarchy edges are derived, not stored, and
 * carry neither.
 */
export function isReviewableEdge(
  edge: CoherenceEdge
): edge is CoherenceEdge & { source_table: 'concept' | 'learning'; relation_id: number } {
  return edge.relation_id !== null && (edge.source_table === 'concept' || edge.source_table === 'learning');
}

export type CoherenceMeta = {
  sub_institute_id: number;
  subject_id: number;
  standard_id: number;
  subject_name: string | null;
  standard_name: string | null;
  syear: number | null;
  curriculum_id: number | null;
  curriculum_name: string | null;
  board: string | null;
  /**
   * False when no concept in this scope carries a topic_id, so concepts are
   * parented straight to their chapter. The UI must not offer a topic control it
   * cannot honour.
   */
  topic_level_available: boolean;
};

export type CoherenceStats = {
  units: number;
  chapters: number;
  topics: number;
  concepts: number;
  prerequisite_edges: number;
  cross_curricular_edges: number;
  approved: number;
  draft: number;
  roots: number;
  isolated: number;
  max_depth: number;
  acyclic: boolean;
  cycle_nodes: string[];
};

export type CoherenceMap = {
  meta: CoherenceMeta;
  nodes: CoherenceNode[];
  edges: CoherenceEdge[];
  stats: CoherenceStats;
};

type Envelope<T> = { status: boolean; message?: string; data?: T; errors?: unknown };

function baseUrl(session: CurriculumSession): string {
  return (session.hostName || API_BASE_URL).replace(/\/$/, '');
}

function headers(session: CurriculumSession, withBody = false): HeadersInit {
  return {
    Accept: 'application/json',
    // The endpoint resolves the institute from this token and refuses to take it
    // from a query parameter, so the request is meaningless without it.
    Authorization: `Bearer ${session.token}`,
    ...(withBody ? { 'Content-Type': 'application/json' } : {}),
  };
}

/**
 * Read the message the API sent rather than inventing one.
 *
 * A 401 here means the sign-in expired and a 403 means the account lacks the
 * curriculum right — two different things a teacher can act on, and both are
 * lost if every failure becomes "Something went wrong".
 */
async function unwrap<T>(response: Response): Promise<T> {
  let payload: Envelope<T> | null = null;

  try {
    payload = (await response.json()) as Envelope<T>;
  } catch {
    payload = null;
  }

  if (!response.ok || payload?.status === false) {
    throw new Error(payload?.message || `Request failed (${response.status})`);
  }

  if (payload?.data === undefined) {
    throw new Error('The server returned no data.');
  }

  return payload.data;
}

export async function fetchCoherenceMap(
  session: CurriculumSession,
  subjectId: string | number,
  standardId: string | number,
  options: { includeSuggested?: boolean; includeCrossGrade?: boolean } = {}
): Promise<CoherenceMap> {
  const query = new URLSearchParams({
    subject_id: String(subjectId),
    standard_id: String(standardId),
    include_suggested: options.includeSuggested === false ? '0' : '1',
    include_cross_grade: options.includeCrossGrade === false ? '0' : '1',
  });

  // syear is optional server-side: omitted, the backend takes the newest
  // curriculum for the subject rather than guessing a year the tenant is not on.
  if (session.academicYearId) query.set('syear', session.academicYearId);

  const response = await fetch(`${baseUrl(session)}/api/lms/coherence-map?${query.toString()}`, {
    method: 'GET',
    headers: headers(session),
  });

  return unwrap<CoherenceMap>(response);
}

export type RelationMutationResult = {
  relation: CoherenceEdge;
  /** e.g. ['creates_cycle'] — advisory, the write still happened. */
  warnings?: string[];
};

/**
 * Draw a prerequisite.
 *
 * Named by ROLE, not by source/target, because three different directions meet at
 * this call: storage keeps "dependent requires prerequisite", the map draws
 * prerequisite -> dependent. Passing the wrong one reverses a curriculum rule
 * without erroring, so the parameter names make it impossible to mix up.
 */
export async function createRelation(
  session: CurriculumSession,
  prerequisiteId: string,
  dependentId: string,
  relationType: 'requires' | 'cross_curricular' = 'requires'
): Promise<RelationMutationResult> {
  const response = await fetch(`${baseUrl(session)}/api/lms/coherence-map/relations`, {
    method: 'POST',
    headers: headers(session, true),
    body: JSON.stringify({
      prerequisite_id: prerequisiteId,
      dependent_id: dependentId,
      relation_type: relationType,
    }),
  });

  return unwrap<RelationMutationResult>(response);
}

export async function reviewRelation(
  session: CurriculumSession,
  sourceTable: 'concept' | 'learning',
  relationId: number,
  status: 'approved' | 'rejected'
): Promise<{ relation: CoherenceEdge; previous_status: string }> {
  const response = await fetch(
    `${baseUrl(session)}/api/lms/coherence-map/relations/${sourceTable}/${relationId}`,
    { method: 'PATCH', headers: headers(session, true), body: JSON.stringify({ status }) }
  );

  return unwrap<{ relation: CoherenceEdge; previous_status: string }>(response);
}

export async function deleteRelation(
  session: CurriculumSession,
  sourceTable: 'concept' | 'learning',
  relationId: number
): Promise<void> {
  const response = await fetch(
    `${baseUrl(session)}/api/lms/coherence-map/relations/${sourceTable}/${relationId}`,
    { method: 'DELETE', headers: headers(session) }
  );

  await unwrap<unknown>(response);
}

export async function bulkReviewRelations(
  session: CurriculumSession,
  relations: Array<{ source: 'concept' | 'learning'; id: number }>,
  status: 'approved' | 'rejected'
): Promise<{ updated: number; failed: Array<{ id: number; source: string; error: string }> }> {
  const response = await fetch(`${baseUrl(session)}/api/lms/coherence-map/relations/bulk`, {
    method: 'POST',
    headers: headers(session, true),
    body: JSON.stringify({ status, relations }),
  });

  return unwrap<{ updated: number; failed: Array<{ id: number; source: string; error: string }> }>(response);
}

/**
 * The map for a course, with its loading and error states kept apart.
 *
 * `loading` is distinguished from "loaded and empty" so the canvas can stay quiet
 * while the request is in flight instead of flashing an empty-curriculum message
 * that is about to be replaced — the same rule useCurriculumMeta follows.
 */
export function useCoherenceMap(
  subjectId: string,
  standardId?: string
): {
  map: CoherenceMap | null;
  session: CurriculumSession | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  /** Apply a mutation result locally so an approval shows instantly, without a refetch. */
  applyEdge: (edge: CoherenceEdge) => void;
  removeEdge: (edgeId: string) => void;
} {
  const key = `${subjectId}|${standardId ?? ''}`;

  /**
   * One piece of state for the whole request, stamped with the scope it answers.
   *
   * Keeping the result, its error and its key together is what lets `loading` be
   * derived (`result.key !== key`) instead of tracked. A separate `loading` flag
   * would have to be set synchronously at the top of the effect, which triggers a
   * second render before the fetch has even started.
   */
  const [result, setResult] = useState<{ key: string; map: CoherenceMap | null; error: string | null } | null>(
    null
  );

  // Read once, lazily. The session lives in localStorage and does not change while
  // the map is open.
  const [session] = useState<CurriculumSession | null>(() => getCurriculumSession());
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    // Nothing to fetch without an identity; the missing-session message is derived
    // below rather than written into state here.
    if (!session || !subjectId) return;

    let cancelled = false;

    fetchCoherenceMap(session, subjectId, standardId ?? subjectId)
      .then((data) => {
        if (!cancelled) setResult({ key, map: data, error: null });
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setResult({
            key,
            map: null,
            error: e instanceof Error ? e.message : 'The coherence map could not be loaded.',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [key, subjectId, standardId, nonce, session]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const applyEdge = useCallback((edge: CoherenceEdge) => {
    setResult((current) => {
      if (!current?.map) return current;

      // A rejected edge leaves the map entirely — it is a decision to stop showing
      // the suggestion, not a state to render.
      const others = current.map.edges.filter((e) => e.id !== edge.id);
      const edges = edge.status === 'rejected' ? others : [...others, edge];

      return { ...current, map: { ...current.map, edges, stats: recount(current.map, edges) } };
    });
  }, []);

  const removeEdge = useCallback((edgeId: string) => {
    setResult((current) => {
      if (!current?.map) return current;
      const edges = current.map.edges.filter((e) => e.id !== edgeId);

      return { ...current, map: { ...current.map, edges, stats: recount(current.map, edges) } };
    });
  }, []);

  // An expired session is a fact about `session`, not something the fetch discovers,
  // so it is computed rather than stored — and it suppresses `loading`, because no
  // request is ever going to arrive.
  const sessionError = session ? null : 'Your session has expired. Sign in again to open the coherence map.';
  const settled = result?.key === key;

  return {
    map: settled ? result.map : null,
    session,
    loading: sessionError === null && !settled,
    error: sessionError ?? (settled ? result.error : null),
    reload,
    applyEdge,
    removeEdge,
  };
}

/**
 * Keep the approved/draft counters honest after a local edit.
 *
 * Only the counts that a single edge change can affect are recomputed; depth and
 * cycle detection stay as the server computed them, because recomputing those in
 * the browser would be a second implementation of the traversal and the two would
 * eventually disagree.
 */
function recount(map: CoherenceMap, edges: CoherenceEdge[]): CoherenceStats {
  let approved = 0;
  let draft = 0;
  let prerequisite = 0;
  let crossCurricular = 0;

  for (const edge of edges) {
    if (edge.kind === 'hierarchy') continue;

    if (edge.status === 'approved') approved += 1;
    else draft += 1;

    if (edge.kind === 'cross_curricular') crossCurricular += 1;
    else prerequisite += 1;
  }

  return {
    ...map.stats,
    approved,
    draft,
    prerequisite_edges: prerequisite,
    cross_curricular_edges: crossCurricular,
  };
}
