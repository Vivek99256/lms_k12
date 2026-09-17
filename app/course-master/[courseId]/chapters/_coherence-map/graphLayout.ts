/**
 * Positions for the coherence map.
 *
 * WHY THIS IS HAND-WRITTEN AND NOT dagre/elk
 * Three reasons, in order of weight.
 *
 * 1. Generic layered layouts assume a DAG. This graph is not one — the backend
 *    reports 13 nodes on prerequisite rings in the first course alone. Dagre
 *    silently breaks cycles by reversing edges, which would draw a prerequisite
 *    arrow pointing the wrong way with no indication it had done so.
 * 2. The useful axes here are known in advance and are curricular, not topological:
 *    x is "how far into the subject", y is "where in the syllabus". A force or
 *    layered engine would discover its own axes and fight the curriculum's.
 * 3. It keeps a dependency out of the bundle for maybe 150 lines of arithmetic.
 *
 * THE SHAPE
 * One left-to-right hierarchy, with the concept column stretched by prerequisite
 * depth:
 *
 *   Unit ──> Chapter ──> Topic ──> Concept ─> Concept ─> Concept
 *                                   depth 0    depth 1    depth 2
 *
 * So reading left to right gives you the curriculum's own structure, and reading
 * further right within the concept band gives you the order things must be learned.
 * A prerequisite edge therefore always points rightward, and an edge that points
 * left is visibly a cycle rather than a rendering artefact.
 *
 * Vertically every leaf gets its own row and every parent is centred on the block
 * of rows its children occupy, so a chapter label always sits beside its own
 * contents and nothing overlaps. That is a tidy-tree rule, not an optimisation
 * pass — there is no iteration and no randomness, which means the map looks
 * identical every time it is opened. Teachers navigate by remembered position.
 */

import type { CoherenceMap, CoherenceNode, CoherenceNodeType } from '@/app/course-master/data/coherenceMap';

/** Node box sizes, per level. Width narrows as the hierarchy deepens. */
export const NODE_SIZE: Record<CoherenceNodeType, { width: number; height: number }> = {
  unit: { width: 210, height: 60 },
  chapter: { width: 230, height: 60 },
  topic: { width: 240, height: 56 },
  concept: { width: 208, height: 52 },
};

const ROW_HEIGHT = 68;
const ROW_GAP_BETWEEN_CHAPTERS = 26;

/** Left edge of each level's column. */
const COLUMN_X: Record<CoherenceNodeType, number> = {
  unit: 0,
  chapter: 280,
  topic: 590,
  concept: 900,
};

/** How far right each additional step of prerequisite depth pushes a concept. */
const DEPTH_STEP = 250;

/**
 * Off-map nodes sit to the LEFT of everything.
 *
 * They are prerequisites from an earlier grade, so placing them left of the
 * curriculum keeps the "earlier is further left" rule true across the whole canvas
 * rather than only inside this course.
 */
const OFF_MAP_X = -320;

export type PositionedNode = CoherenceNode & {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Depth of this node in the containment tree; 0 for units. */
  level: number;
  /** True when this node has children that are currently hidden. */
  collapsed: boolean;
  /** Number of descendants, so a collapsed node can say what it is hiding. */
  hiddenDescendants: number;
};

export type LayoutResult = {
  nodes: PositionedNode[];
  /** Ids present in `nodes`, for filtering edges without a second pass. */
  visible: Set<string>;
  width: number;
  height: number;
};

type TreeNode = {
  node: CoherenceNode;
  children: TreeNode[];
  level: number;
};

/**
 * Lay the map out.
 *
 * @param collapsed Ids whose children are hidden. A collapsed node still renders.
 * @param typeFilter Levels to draw at all. Dropping a level re-parents its children
 *                   onto the nearest visible ancestor rather than orphaning them.
 */
export function layoutMap(
  map: CoherenceMap,
  collapsed: Set<string>,
  typeFilter: Set<CoherenceNodeType>
): LayoutResult {
  const byId = new Map<string, CoherenceNode>();
  for (const node of map.nodes) byId.set(node.id, node);

  const roots = buildForest(map.nodes, byId, typeFilter);

  const positioned: PositionedNode[] = [];
  const visible = new Set<string>();
  let cursorY = 0;
  let maxX = 0;

  /**
   * Place a subtree and return the vertical band it occupies.
   *
   * Post-order: children claim their rows first, then the parent is centred on
   * them. A leaf claims exactly one row.
   */
  const place = (tree: TreeNode): { top: number; bottom: number } => {
    const { node } = tree;
    const size = NODE_SIZE[node.type];
    const isCollapsed = collapsed.has(node.id);
    const children = isCollapsed ? [] : tree.children;

    let top: number;
    let bottom: number;
    let centreY: number;

    if (children.length === 0) {
      top = cursorY;
      bottom = cursorY + ROW_HEIGHT;
      centreY = cursorY + ROW_HEIGHT / 2;
      cursorY = bottom;
    } else {
      const bands = children.map(place);
      top = bands[0].top;
      bottom = bands[bands.length - 1].bottom;
      // Centre on the span, not on the mean of the children, so a parent with one
      // deep child and one shallow one still sits beside the middle of its block.
      centreY = (top + bottom) / 2;
    }

    const x = node.off_map
      ? OFF_MAP_X
      : COLUMN_X[node.type] + (node.type === 'concept' ? node.depth * DEPTH_STEP : 0);

    positioned.push({
      ...node,
      x,
      y: centreY - size.height / 2,
      width: size.width,
      height: size.height,
      level: tree.level,
      collapsed: isCollapsed,
      hiddenDescendants: isCollapsed ? countDescendants(tree) : 0,
    });
    visible.add(node.id);

    maxX = Math.max(maxX, x + size.width);

    return { top, bottom };
  };

  for (const root of roots) {
    place(root);
    // A gap between top-level blocks, so two units do not read as one list.
    cursorY += ROW_GAP_BETWEEN_CHAPTERS;
  }

  return {
    nodes: positioned,
    visible,
    width: maxX - OFF_MAP_X,
    height: cursorY,
  };
}

/**
 * Build the containment forest, honouring the level filter.
 *
 * A node whose type is filtered out is skipped but its children are NOT: they are
 * lifted to the nearest visible ancestor. Hiding "Topic" should collapse the
 * hierarchy to Unit > Chapter > Concept, not make every concept vanish — which is
 * exactly what happens on a course where topic_id is unpopulated, so this path is
 * the normal one rather than an edge case.
 */
function buildForest(
  nodes: CoherenceNode[],
  byId: Map<string, CoherenceNode>,
  typeFilter: Set<CoherenceNodeType>
): TreeNode[] {
  const visibleParent = (node: CoherenceNode): string | null => {
    let parentId = node.parent_id;

    while (parentId) {
      const parent = byId.get(parentId);
      if (!parent) return null;
      if (typeFilter.has(parent.type)) return parent.id;
      parentId = parent.parent_id;
    }

    return null;
  };

  const trees = new Map<string, TreeNode>();

  for (const node of nodes) {
    if (!typeFilter.has(node.type)) continue;
    trees.set(node.id, { node, children: [], level: 0 });
  }

  const roots: TreeNode[] = [];

  for (const tree of trees.values()) {
    const parentId = visibleParent(tree.node);
    const parent = parentId ? trees.get(parentId) : undefined;

    if (parent) parent.children.push(tree);
    else roots.push(tree);
  }

  // Curriculum order, then depth so a prerequisite chain reads downward within a
  // topic instead of interleaving with its siblings.
  const sortChildren = (tree: TreeNode, level: number) => {
    tree.level = level;
    tree.children.sort((a, b) => a.node.depth - b.node.depth || a.node.order - b.node.order);
    for (const child of tree.children) sortChildren(child, level + 1);
  };

  roots.sort((a, b) => {
    // Off-map prerequisites first — they come before this course by definition.
    if (a.node.off_map !== b.node.off_map) return a.node.off_map ? -1 : 1;

    return a.node.order - b.node.order;
  });

  for (const root of roots) sortChildren(root, 0);

  return roots;
}

function countDescendants(tree: TreeNode): number {
  let total = 0;

  for (const child of tree.children) {
    total += 1 + countDescendants(child);
  }

  return total;
}

/**
 * The prerequisite neighbourhood of one node.
 *
 * Returns everything it depends on (upstream, transitively) and everything that
 * depends on it (downstream) — the two questions the brief asks the map to answer
 * about any selected element.
 *
 * Breadth-first with a visited set, because the graph contains rings and a naive
 * recursion would not terminate on one. Hierarchy edges are excluded: containment
 * is not dependency, and following it would make every concept in a chapter look
 * like a prerequisite of every other.
 */
export function neighbourhood(
  edges: CoherenceMap['edges'],
  nodeId: string
): { upstream: Set<string>; downstream: Set<string>; touching: Set<string> } {
  const back = new Map<string, string[]>();
  const forward = new Map<string, string[]>();
  const touching = new Set<string>();

  for (const edge of edges) {
    if (edge.kind === 'hierarchy') continue;

    // source = prerequisite, target = dependent.
    if (!back.has(edge.target)) back.set(edge.target, []);
    back.get(edge.target)!.push(edge.source);

    if (!forward.has(edge.source)) forward.set(edge.source, []);
    forward.get(edge.source)!.push(edge.target);

    if (edge.source === nodeId || edge.target === nodeId) touching.add(edge.id);
  }

  const reach = (adjacency: Map<string, string[]>): Set<string> => {
    const seen = new Set<string>();
    const queue = [...(adjacency.get(nodeId) ?? [])];

    while (queue.length > 0) {
      const current = queue.pop()!;
      if (seen.has(current) || current === nodeId) continue;
      seen.add(current);

      for (const next of adjacency.get(current) ?? []) {
        if (!seen.has(next)) queue.push(next);
      }
    }

    return seen;
  };

  return { upstream: reach(back), downstream: reach(forward), touching };
}
