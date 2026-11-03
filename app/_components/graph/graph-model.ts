import type { SourceDotKind } from './coherence-theme';

/**
 * The node/edge shape the Knowledge Graph canvas renders — independent of
 * the PAL `ConceptRelationshipGraph`'s `GraphNodeInput`/`GraphEdgeInput`
 * (graph-model.ts under app/pal/learning-intelligence/_components/), which
 * stays untouched. This feature draws from `GraphQueryService`/
 * `OntologyViewResolver`, not the PAL coherence/ESO sources, and has its own
 * mapper (graph-query-mapper.ts) from those responses into this shape.
 */
export interface KgNodeInput {
  /** Unique across the canvas, e.g. "student:4821". */
  id: string;
  /** The ontology entity key, e.g. "student", "fee_record" — not a fixed enum. */
  entityKey: string;
  /** The underlying record id, or null for a schema-level (legend) node. */
  recordId: number | string | null;
  label: string;
  /** Which store answered for this node — drives the type-dot (see TypeLegend). */
  source: SourceDotKind;
  /** "You are here" / the record this screen is centred on. */
  current?: boolean;
  attributes?: Record<string, unknown>;
}

export interface KgEdgeInput {
  id: string;
  source: string;
  target: string;
  /** The relation name, shown as the edge's label on hover. */
  relation: string;
  /** False renders dotted/no-arrowhead — the reference's "relatesTo" treatment. */
  directed: boolean;
  /** Real Neo4j relationship properties, when the backend captured any — shown in the relationship detail panel. Absent (not empty) for shapes that never collect them. */
  properties?: Record<string, unknown>;
}

export interface KgHop {
  label: string;
  entity: string | null;
  relation: string;
  available: boolean;
  reason?: string;
  total: number;
  items: Array<{
    entity: string;
    id: number | string | null;
    label: string;
    attributes: Record<string, unknown>;
  }>;
}
