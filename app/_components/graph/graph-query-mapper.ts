import type {
  ErpSubmoduleGraph,
  GraphBrowserResult,
  GraphNodeDetail,
  GraphPathResult,
  GraphSearchResult,
  GraphTraversal,
  OntologyEntity,
  OntologyRelationship,
  OrganizationStaffGraph,
} from '@/lib/intelligence/types';
import type { ModuleViewsPayload, NodeExpansionResult, OntologyViewResult } from '@/lib/intelligence/workspace';
import type { KgEdgeInput, KgHop, KgNodeInput } from './graph-model';

/**
 * Converts GraphQueryService/OntologyViewResolver responses into the shape
 * GraphCanvas draws. One mapper, used by both Knowledge Graph entry points,
 * so a change to either backend response only has one place to update.
 *
 * Node ids mirror the backend's own `GraphNode::fingerprint()` —
 * `"<entityKey>:<id>"` — exactly, since `GraphTraversal.edges[].from/to` are
 * already that fingerprint and nothing here needs to invent a second id
 * scheme to reconnect them.
 */
function fingerprint(entity: string, id: number | string | null): string {
  return `${entity}:${id ?? 'null'}`;
}

/** A real traversal from `POST /api/ai/knowledge-graph/query`. */
export function mapGraphTraversal(traversal: GraphTraversal): { nodes: KgNodeInput[]; edges: KgEdgeInput[] } {
  const startFingerprint = traversal.start ? fingerprint(traversal.start.entity, traversal.start.id) : null;

  const nodes: KgNodeInput[] = traversal.nodes.map((node) => {
    const id = fingerprint(node.entity, node.id);
    return {
      id,
      entityKey: node.entity,
      recordId: node.id,
      label: node.label,
      source: node.source,
      current: id === startFingerprint,
      attributes: node.attributes,
    };
  });

  const edges: KgEdgeInput[] = traversal.edges.map((edge, index) => ({
    id: `${edge.from}->${edge.relation}->${edge.to}#${index}`,
    source: edge.from,
    target: edge.to,
    relation: edge.relation,
    // Every relation GraphQueryService walks is a declared, one-direction
    // hop (see ontology_relationships) — the reference's "relatesTo" dotted
    // treatment has no equivalent here yet, so every edge renders directed.
    directed: true,
  }));

  return { nodes, edges };
}

/**
 * The schema-level legend: entities and relationships with no record data —
 * what the centralized Knowledge Graph shows before anyone searches for a
 * record. Synthetic ids (no real record behind them), so `recordId` is null
 * throughout.
 */
export function mapOntologySchema(
  entities: OntologyEntity[],
  relationships: OntologyRelationship[]
): { nodes: KgNodeInput[]; edges: KgEdgeInput[] } {
  const nodes: KgNodeInput[] = entities.map((entity) => ({
    id: `schema:${entity.key}`,
    entityKey: entity.key,
    recordId: null,
    label: entity.label,
    source: entity.queryable && entity.is_virtual === false ? 'graph' : 'sql',
    attributes: { category: entity.category, description: entity.description },
  }));

  const known = new Set(entities.map((entity) => entity.key));

  const edges: KgEdgeInput[] = relationships
    .filter((rel) => known.has(rel.from) && known.has(rel.to))
    .map((rel) => ({
      id: `schema:${rel.key}`,
      source: `schema:${rel.from}`,
      target: `schema:${rel.to}`,
      relation: rel.relation,
      directed: true,
    }));

  return { nodes, edges };
}

/**
 * A walked relationship view (`OntologyViewResolver::resolve()`'s hop chain)
 * into canvas nodes/edges, plus the hops themselves for the accordion detail
 * panel (mirrors the reference's "child standards" collapsible sections).
 */
export function mapOntologyViewResult(result: OntologyViewResult): {
  nodes: KgNodeInput[];
  edges: KgEdgeInput[];
  hops: KgHop[];
} {
  if (!result.found || !result.root) {
    return { nodes: [], edges: [], hops: [] };
  }

  const rootId = fingerprint(result.root.entity, result.root.id);
  const nodes = new Map<string, KgNodeInput>([
    [
      rootId,
      {
        id: rootId,
        entityKey: result.root.entity,
        recordId: result.root.id,
        label: result.root.label ?? String(result.root.id),
        source: 'graph',
        current: true,
      },
    ],
  ]);
  const edges: KgEdgeInput[] = [];
  const hops: KgHop[] = [];

  let frontierIds = [rootId];

  for (const hop of result.hops) {
    hops.push({
      label: hop.label,
      entity: hop.entity,
      relation: hop.relation,
      available: hop.available,
      reason: hop.reason,
      total: hop.total,
      items: hop.items,
    });

    if (!hop.available) continue;

    const nextFrontier: string[] = [];

    for (const item of hop.items) {
      const id = fingerprint(item.entity, item.id);

      if (!nodes.has(id)) {
        nodes.set(id, {
          id,
          entityKey: item.entity,
          recordId: item.id,
          label: item.label,
          source: 'sql',
          attributes: item.attributes,
        });
      }

      // Every node reached this hop connects back to every node the hop
      // expanded from — the same fan-out OntologyViewResolver itself walks
      // (it reads from up to 5 frontier records per hop).
      for (const fromId of frontierIds) {
        edges.push({
          id: `${fromId}->${hop.relation}->${id}`,
          source: fromId,
          target: id,
          relation: hop.relation,
          directed: true,
          sourceKind: hop.source === 'sql' ? 'sql' : 'graph',
        });
      }

      nextFrontier.push(id);
    }

    if (nextFrontier.length > 0) frontierIds = nextFrontier;
  }

  return { nodes: Array.from(nodes.values()), edges, hops };
}

/**
 * One node's click-to-expand result (`POST /workspace/nodes/{entity}/{id}/
 * expand`) into nodes/edges to MERGE onto an existing decentralized canvas —
 * not a replacement, since the point of expand-in-place is that everything
 * already on screen stays put. Caller dedupes against its current node/edge
 * ids before adding these (ids are the same `fingerprint()` scheme
 * `mapOntologyViewResult` already uses, so they collide correctly when the
 * same record is reachable two ways).
 */
export function mapExpandNodeResult(centerId: string, result: NodeExpansionResult): {
  nodes: KgNodeInput[];
  edges: KgEdgeInput[];
  hops: KgHop[];
} {
  if (!result.found || !result.node) {
    return { nodes: [], edges: [], hops: [] };
  }

  const nodes: KgNodeInput[] = [];
  const edges: KgEdgeInput[] = [];
  const hops: KgHop[] = [];

  for (const group of result.relations) {
    hops.push({
      label: `${group.relation} (${group.direction})`,
      entity: group.entity,
      relation: group.relation,
      direction: group.direction,
      available: group.available,
      reason: group.reason ?? undefined,
      total: group.total,
      items: group.items,
    });

    if (!group.available) continue;

    for (const item of group.items) {
      const id = fingerprint(item.entity, item.id);

      nodes.push({
        id,
        entityKey: item.entity,
        recordId: item.id,
        label: item.label,
        source: group.source ?? 'sql',
        attributes: item.attributes,
      });

      const sourceKind: 'sql' | 'graph' = group.source === 'sql' ? 'sql' : 'graph';

      edges.push(
        group.direction === 'outgoing'
          ? { id: `${centerId}->${group.relation}->${id}`, source: centerId, target: id, relation: group.relation, directed: true, sourceKind }
          : { id: `${id}->${group.relation}->${centerId}`, source: id, target: centerId, relation: group.relation, directed: true, sourceKind }
      );
    }
  }

  return { nodes, edges, hops };
}

/**
 * A real connected subgraph straight from Neo4j (GraphModuleBrowser — the
 * centralized Knowledge Graph's Modules/Submodules/Data-flow browser).
 * Already in near-canvas shape; this only adds `directed: true` (every
 * Neo4j relationship is directed, and the backend's own startNode/endNode
 * resolution already picked source/target correctly).
 */
export function mapGraphBrowserResult(result: GraphBrowserResult): { nodes: KgNodeInput[]; edges: KgEdgeInput[] } {
  return {
    nodes: result.nodes,
    edges: result.edges.map((edge) => ({ ...edge, directed: true })),
  };
}

/**
 * A real connected subgraph for one ERP submodule (the tblmenumaster-backed
 * navigation) — structurally the same shape as mapGraphBrowserResult's
 * input, just under the erp-submodules/{id}/graph response's own field
 * names.
 */
export function mapErpSubmoduleGraph(result: ErpSubmoduleGraph): { nodes: KgNodeInput[]; edges: KgEdgeInput[] } {
  return {
    nodes: result.nodes,
    edges: result.edges.map((edge) => ({ ...edge, directed: true })),
  };
}

/** The views a module offers, before any is walked — for the tab's picker list. */
export function moduleHasCoverage(payload: ModuleViewsPayload): boolean {
  return payload.module !== null && payload.views.length > 0;
}

/** A global cross-label text search — matched nodes only, no edges (nothing to connect them with yet). */
export function mapGraphSearchResult(result: GraphSearchResult): { nodes: KgNodeInput[] } {
  return { nodes: result.nodes };
}

/** A real shortest path between two nodes, or an empty, honest "no path" result. */
export function mapGraphPathResult(result: GraphPathResult): { found: boolean; nodes: KgNodeInput[]; edges: KgEdgeInput[] } {
  if (!result.found) return { found: false, nodes: [], edges: [] };

  return {
    found: true,
    nodes: result.nodes,
    edges: result.edges.map((edge) => ({ ...edge, directed: true })),
  };
}

/** One node's full detail plus a paginated page of its relationships, for the docked right panel. */
export function mapGraphNodeDetail(result: GraphNodeDetail): {
  node: KgNodeInput | null;
  nodes: KgNodeInput[];
  edges: KgEdgeInput[];
  totalIncoming: number;
  totalOutgoing: number;
  hasMore: boolean;
} {
  return {
    node: result.node,
    nodes: result.nodes,
    edges: result.edges.map((edge) => ({ ...edge, directed: true })),
    totalIncoming: result.total_incoming,
    totalOutgoing: result.total_outgoing,
    hasMore: result.has_more,
  };
}

/** Organization Management's own Institute/Department/Role/Staff graph (PR #988's data, GraphModuleBrowser-mediated). */
export function mapOrganizationStaffGraph(result: OrganizationStaffGraph): { nodes: KgNodeInput[]; edges: KgEdgeInput[] } {
  return {
    nodes: result.nodes,
    edges: result.edges.map((edge) => ({ ...edge, directed: true })),
  };
}

/**
 * Groups a node-detail fetch's edges into the accordion-section shape
 * `GraphDetailPanel` already knows how to render (one section per relation
 * + direction), rather than giving that component a second display mode.
 * The centralized explorer has no "hop chain" the way a walked ontology
 * view does — this is a flat one-level grouping of a single node's own
 * incoming/outgoing relationships.
 */
export function buildHopsFromNodeDetail(
  centerId: string,
  nodes: KgNodeInput[],
  edges: KgEdgeInput[]
): KgHop[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const groups = new Map<string, { relation: string; direction: 'outgoing' | 'incoming'; items: KgHop['items'] }>();

  for (const edge of edges) {
    const outgoing = edge.source === centerId;
    const otherId = outgoing ? edge.target : edge.source;
    const other = byId.get(otherId);
    if (!other) continue;

    const key = `${edge.relation}::${outgoing ? 'out' : 'in'}`;
    const group = groups.get(key) ?? { relation: edge.relation, direction: outgoing ? 'outgoing' : 'incoming', items: [] };
    group.items.push({ entity: other.entityKey, id: other.recordId, label: other.label, attributes: other.attributes ?? {} });
    groups.set(key, group);
  }

  return Array.from(groups.values()).map((group) => ({
    label: `${group.relation} (${group.direction})`,
    entity: null,
    relation: group.relation,
    direction: group.direction,
    available: true,
    total: group.items.length,
    items: group.items,
  }));
}
