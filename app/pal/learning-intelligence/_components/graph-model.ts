/**
 * The one node/edge shape the canvas, legend and inspector all share.
 *
 * The explorer draws from three different backends (MariaDB hierarchy, the
 * ESO concept map, the Neo4j AI overlay), each with its own node/edge
 * types — see data/knowledge-graph.ts. Rather than teach the canvas three
 * shapes, each view maps its source data into this one, so
 * ConceptRelationshipGraph never needs to know which backend a node came
 * from.
 */

export type GraphNodeKind = 'unit' | 'chapter' | 'topic' | 'concept';

export type GraphEdgeKind = 'hierarchy' | 'prerequisite' | 'cross_curricular';

export interface GraphNodeInput {
  /** Unique across the whole canvas, e.g. "concept:1360". */
  id: string;
  kind: GraphNodeKind;
  label: string;
  /** Layout row within its kind-band — 0 for a root, increasing with depth. */
  depth: number;
  /**
   * The containing node's id (e.g. a chapter's unit), or null/undefined for
   * a root. Drives the canvas's tree layout for containment graphs — a
   * child is positioned under its real parent, not an arbitrary row index.
   * Absent for non-containment graphs (concept-relationship, AI overlay),
   * where the depth-banded layout is used instead.
   */
  parentId?: string | null;
  /** "You are here" / the concept this screen was opened for. */
  current?: boolean;
  /** Real counts/flags shown in the inspector drawer, never fabricated. */
  meta?: Record<string, unknown>;
}

export interface GraphEdgeInput {
  id: string;
  source: string;
  target: string;
  kind: GraphEdgeKind;
  /** Solid when true (curator-authored/approved); dashed when false (AI-suggested, unreviewed). */
  approved: boolean;
  /** True only for edges pulled in from the Neo4j AI-suggested overlay. */
  aiSuggested?: boolean;
}

/** Colour tokens live in design-system.ts (KIND_CHIP) — this file only defines the data shape. */
export const NODE_KIND_LABEL: Record<GraphNodeKind, string> = {
  unit: 'Unit',
  chapter: 'Chapter',
  topic: 'Topic',
  concept: 'Concept',
};
