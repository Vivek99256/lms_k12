/**
 * Shared mappers from each of the three existing graph sources (see
 * data/knowledge-graph.ts) into the one canvas shape (graph-model.ts).
 * Used by both the Knowledge Graph Explorer and the Context Graph
 * Inspector's "Concept Relationships" stage, so a concept drawn in one
 * never looks different from the same concept drawn in the other.
 */

import type { GraphEdgeInput, GraphNodeInput } from './graph-model';
import type { CurriculumGraph, ConceptRelationshipMap, AiOverlayGraph } from '../data/knowledge-graph';

const KIND_DEPTH: Record<string, number> = { unit: 0, chapter: 1, topic: 2, concept: 3 };

export type MappedGraph = { nodes: GraphNodeInput[]; edges: GraphEdgeInput[] };

export function mapHierarchy(graph: CurriculumGraph): MappedGraph {
  const nodes: GraphNodeInput[] = graph.nodes.map((n) => ({
    id: n.id,
    kind: n.type,
    label: n.label,
    depth: KIND_DEPTH[n.type] ?? 3,
    parentId: n.parent_id,
    meta: {
      prerequisites: n.prereq_count,
      unlocks: n.dependent_count,
      on_a_cycle: n.on_cycle,
      from_another_scope: n.off_map,
    },
  }));

  const edges: GraphEdgeInput[] = graph.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    kind: e.kind,
    approved: e.status === 'approved' || e.kind === 'hierarchy',
    aiSuggested: e.tagged_by === 'ai' && e.status === 'draft',
  }));

  return { nodes, edges };
}

/**
 * A browsable subset of a full hierarchy graph: level by level, not
 * flattened. Units show first; a node's children only appear once that
 * node itself is expanded — so clicking a Unit reveals its Chapters,
 * clicking one of those Chapters then reveals its Topics, and clicking a
 * Topic reveals its Concepts. Nothing two levels down ever appears before
 * the level between has been opened, which is what keeps a subject's full
 * hierarchy (hundreds of concepts) from rendering as one clutter the
 * moment a single chapter is opened.
 *
 * Visibility is defined recursively — a node shows only if it has no
 * parent (a root Unit) or its parent is both visible and in
 * `expandedIds` — so it keeps working regardless of how many levels deep
 * the hierarchy goes, with no hardcoded notion of "chapter" as the one
 * expandable level.
 */
export function filterHierarchyForExpansion(graph: MappedGraph, expandedIds: ReadonlySet<string>): MappedGraph {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const visibility = new Map<string, boolean>();

  function isVisible(node: GraphNodeInput): boolean {
    const cached = visibility.get(node.id);
    if (cached !== undefined) return cached;

    // Breaks a cycle in corrupt data by treating the node as not (yet)
    // visible rather than recursing forever.
    visibility.set(node.id, false);

    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    const result = !parent || (isVisible(parent) && expandedIds.has(parent.id));
    visibility.set(node.id, result);
    return result;
  }

  const visible = graph.nodes.filter(isVisible);
  const visibleIds = new Set(visible.map((n) => n.id));
  const edges = graph.edges.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target));

  return { nodes: visible, edges };
}

export function mapConceptRelationships(map: ConceptRelationshipMap): MappedGraph {
  const nodes: GraphNodeInput[] = map.concepts.map((c) => ({
    id: `concept:${c.conceptId}`,
    kind: 'concept',
    label: c.name,
    depth: c.depth,
    current: c.isCurrent,
    meta: {
      status: c.status,
      chapter: c.chapterName,
      topic: c.topicName,
      standard: c.standardName,
      misconceptions_seen: c.misconceptionCount,
    },
  }));

  const edges: GraphEdgeInput[] = map.edges.map((e, i) => ({
    id: `rel-${i}-${e.fromConceptId}-${e.toConceptId}`,
    source: `concept:${e.fromConceptId}`,
    target: `concept:${e.toConceptId}`,
    kind: e.type === 'related' ? 'cross_curricular' : 'prerequisite',
    approved: true,
  }));

  return { nodes, edges };
}

export function mapAiOverlay(overlay: AiOverlayGraph): MappedGraph {
  const nodes: GraphNodeInput[] = overlay.nodes.map((n) => ({
    id: `concept:${n.id}`,
    kind: 'concept',
    label: n.name,
    depth: n.depth,
    meta: { bloom_level: n.bloom, priority: n.priority, on_a_cycle: n.onCycle },
  }));

  const edges: GraphEdgeInput[] = overlay.edges.map((e, i) => ({
    id: `ai-${i}-${e.source}-${e.target}`,
    source: `concept:${e.source}`,
    target: `concept:${e.target}`,
    kind: e.kind === 'CROSS_LINKS' ? 'cross_curricular' : 'prerequisite',
    approved: e.status === 'approved',
    aiSuggested: e.taggedBy === 'ai',
  }));

  return { nodes, edges };
}

export function mergeGraphs(a: MappedGraph, b: MappedGraph): MappedGraph {
  const nodeIds = new Set(a.nodes.map((n) => n.id));
  const nodes = [...a.nodes, ...b.nodes.filter((n) => !nodeIds.has(n.id))];
  const edgeIds = new Set(a.edges.map((e) => e.id));
  const edges = [...a.edges, ...b.edges.filter((e) => !edgeIds.has(e.id))];
  return { nodes, edges };
}
