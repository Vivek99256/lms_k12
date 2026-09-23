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
<<<<<<< HEAD
  /**
   * Which store the row lives in.
   *
   * 'concept' and 'learning' are the reviewable ones - the PATCH and DELETE routes
   * address those two and only those two.
   *
   * 'expert' is `concept_prerequisite`, the map the curriculum team authored and
   * imported. It arrives already approved, it carries the author's `note`, and it has
   * no review workflow behind it - so the UI must render it read-only rather than
   * offering Approve / Dismiss / Remove buttons that would 404.
   */
  source_table: 'concept' | 'learning' | 'expert' | null;
=======
  /** Which table the row lives in. Needed to address it for review or delete. */
  source_table: 'concept' | 'learning' | null;
>>>>>>> parent of 1c474ef (Merge pull request #297 from Vivek99256/harshit1)
  relation_type: string | null;
  link_type: string | null;
  confidence: number | null;
  note: string | null;
};

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
<<<<<<< HEAD
  /**
   * Academic years this subject+grade does have chapters for.
   *
   * Only sent when the requested year returned none. It is what separates "this
   * subject has no curriculum" from "the app is pointed at the wrong year", which
   * look identical on screen and have completely different fixes.
   */
  available_syears?: number[];
=======
>>>>>>> parent of 1c474ef (Merge pull request #297 from Vivek99256/harshit1)
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

<<<<<<< HEAD
/**
 * Which concept the server says to centre on.
 *
 * Only present on the concept-located fetch. The caller asked by entity id; the graph
 * speaks in typed refs, so the server hands back the ref rather than making the client
 * rebuild the string.
 */
export type CoherenceFocus = {
  ref: string;
  entity_id: number;
  label: string;
  subject_id: number;
  standard_id: number;
};

=======
>>>>>>> parent of 1c474ef (Merge pull request #297 from Vivek99256/harshit1)
export type CoherenceMap = {
  meta: CoherenceMeta;
  nodes: CoherenceNode[];
  edges: CoherenceEdge[];
  stats: CoherenceStats;
<<<<<<< HEAD
  focus?: CoherenceFocus;
=======
>>>>>>> parent of 1c474ef (Merge pull request #297 from Vivek99256/harshit1)
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
<<<<<<< HEAD
  options: { includeSuggested?: boolean; includeCrossGrade?: boolean; syear?: string | number } = {}
=======
  options: { includeSuggested?: boolean; includeCrossGrade?: boolean } = {}
>>>>>>> parent of 1c474ef (Merge pull request #297 from Vivek99256/harshit1)
): Promise<CoherenceMap> {
  const query = new URLSearchParams({
    subject_id: String(subjectId),
    standard_id: String(standardId),
    include_suggested: options.includeSuggested === false ? '0' : '1',
    include_cross_grade: options.includeCrossGrade === false ? '0' : '1',
  });

  // syear is optional server-side: omitted, the backend takes the newest
  // curriculum for the subject rather than guessing a year the tenant is not on.
<<<<<<< HEAD
  // An explicit `options.syear` overrides the session's, which is how the empty
  // state offers "show me the year that does have curriculum" without making the
  // teacher go and change the global academic-year selector first.
  const syear = options.syear ?? session.academicYearId;
  if (syear) query.set('syear', String(syear));
=======
  if (session.academicYearId) query.set('syear', session.academicYearId);
>>>>>>> parent of 1c474ef (Merge pull request #297 from Vivek99256/harshit1)

  const response = await fetch(`${baseUrl(session)}/api/lms/coherence-map?${query.toString()}`, {
    method: 'GET',
    headers: headers(session),
  });

  return unwrap<CoherenceMap>(response);
}

<<<<<<< HEAD
/**
 * The map located by a concept instead of by a subject and grade.
 *
 * This is what makes the map walkable across classes 6-10. A prerequisite from a lower
 * grade arrives as an `off_map` node; centring on it needs that concept's OWN subject
 * and grade, which the client has no way to name in advance. Sending the concept id and
 * letting the server resolve the scope avoids inventing a client-side lookup for
 * something the concept row already knows.
 *
 * Returns the same shape as `fetchCoherenceMap`, plus `focus` naming the node to centre.
 */
export async function fetchCoherenceMapForConcept(
  session: CurriculumSession,
  conceptEntityId: string | number,
  options: { includeSuggested?: boolean; includeCrossGrade?: boolean } = {}
): Promise<CoherenceMap> {
  const query = new URLSearchParams({
    include_suggested: options.includeSuggested === false ? '0' : '1',
    include_cross_grade: options.includeCrossGrade === false ? '0' : '1',
  });

  const response = await fetch(
    `${baseUrl(session)}/api/lms/coherence-map/concept/${encodeURIComponent(String(conceptEntityId))}?${query.toString()}`,
    { method: 'GET', headers: headers(session) }
  );

  return unwrap<CoherenceMap>(response);
}

/**
 * Whether this edge can be reviewed or deleted.
 *
 * Two kinds of edge cannot, and both reach the UI looking much like one that can:
 *
 * - **expert** rows come from `concept_prerequisite`. They are authored by the
 *   curriculum team, arrive already approved, and the PATCH / DELETE routes do not
 *   address that table - the route constraint is literally `concept|learning`.
 * - **hierarchy** edges are derived from `parent_id`, not stored, so they carry
 *   `relation_id: null` and there is no row to address.
 *
 * Offering Approve / Dismiss / Remove on either produces a request to
 * `/relations/expert/12` or `/relations/null/null`. Call this before rendering those
 * buttons AND before firing the handler, because a card that lists every incident edge
 * makes it easy to lose the check in one place but not the other.
 */
export function isReviewableEdge(
  edge: CoherenceEdge
): edge is CoherenceEdge & { source_table: 'concept' | 'learning'; relation_id: number } {
  return (
    (edge.source_table === 'concept' || edge.source_table === 'learning') &&
    edge.relation_id !== null
  );
}

=======
>>>>>>> parent of 1c474ef (Merge pull request #297 from Vivek99256/harshit1)
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
<<<<<<< HEAD
  /**
   * Refetch against a different academic year.
   *
   * The map is scoped by year, and the year comes from a selector that lives on
   * another screen. When the chosen one has no curriculum but another does, this is
   * what lets the teacher see it from here instead of hunting for the selector.
   */
  viewYear: (syear: number) => void;
=======
>>>>>>> parent of 1c474ef (Merge pull request #297 from Vivek99256/harshit1)
  /** Apply a mutation result locally so an approval shows instantly, without a refetch. */
  applyEdge: (edge: CoherenceEdge) => void;
  removeEdge: (edgeId: string) => void;
} {
<<<<<<< HEAD
  const [syearOverride, setSyearOverride] = useState<number | null>(null);
  const key = `${subjectId}|${standardId ?? ''}|${syearOverride ?? ''}`;
=======
  const key = `${subjectId}|${standardId ?? ''}`;
>>>>>>> parent of 1c474ef (Merge pull request #297 from Vivek99256/harshit1)

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

<<<<<<< HEAD
    fetchCoherenceMap(session, subjectId, standardId ?? subjectId, {
      ...(syearOverride === null ? {} : { syear: syearOverride }),
    })
=======
    fetchCoherenceMap(session, subjectId, standardId ?? subjectId)
>>>>>>> parent of 1c474ef (Merge pull request #297 from Vivek99256/harshit1)
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
<<<<<<< HEAD
  }, [key, subjectId, standardId, nonce, session, syearOverride]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const viewYear = useCallback((syear: number) => setSyearOverride(syear), []);

=======
  }, [key, subjectId, standardId, nonce, session]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

>>>>>>> parent of 1c474ef (Merge pull request #297 from Vivek99256/harshit1)
  const applyEdge = useCallback((edge: CoherenceEdge) => {
    setResult((current) => {
      if (!current?.map) return current;

      // A rejected edge leaves the map entirely — it is a decision to stop showing
      // the suggestion, not a state to render.
<<<<<<< HEAD
      return { ...current, map: applyEdgeTo(current.map, edge) };
=======
      const others = current.map.edges.filter((e) => e.id !== edge.id);
      const edges = edge.status === 'rejected' ? others : [...others, edge];

      return { ...current, map: { ...current.map, edges, stats: recount(current.map, edges) } };
>>>>>>> parent of 1c474ef (Merge pull request #297 from Vivek99256/harshit1)
    });
  }, []);

  const removeEdge = useCallback((edgeId: string) => {
    setResult((current) => {
      if (!current?.map) return current;
<<<<<<< HEAD

      return { ...current, map: removeEdgeFrom(current.map, edgeId) };
=======
      const edges = current.map.edges.filter((e) => e.id !== edgeId);

      return { ...current, map: { ...current.map, edges, stats: recount(current.map, edges) } };
>>>>>>> parent of 1c474ef (Merge pull request #297 from Vivek99256/harshit1)
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
<<<<<<< HEAD
    viewYear,
=======
>>>>>>> parent of 1c474ef (Merge pull request #297 from Vivek99256/harshit1)
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
<<<<<<< HEAD
/**
 * Apply a mutation result to a map, returning a new one.
 *
 * Exported because the focus view can be looking at a map fetched for ANOTHER scope -
 * the one it walked into when following a prerequisite across grades - which this
 * hook does not own. Both paths have to agree that a rejected edge leaves the map
 * entirely, so the rule lives in one place rather than being written twice.
 */
export function applyEdgeTo(map: CoherenceMap, edge: CoherenceEdge): CoherenceMap {
  const others = map.edges.filter((e) => e.id !== edge.id);
  const edges = edge.status === 'rejected' ? others : [...others, edge];

  return { ...map, edges, stats: recount(map, edges) };
}

export function removeEdgeFrom(map: CoherenceMap, edgeId: string): CoherenceMap {
  const edges = map.edges.filter((e) => e.id !== edgeId);

  return { ...map, edges, stats: recount(map, edges) };
}

=======
>>>>>>> parent of 1c474ef (Merge pull request #297 from Vivek99256/harshit1)
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
