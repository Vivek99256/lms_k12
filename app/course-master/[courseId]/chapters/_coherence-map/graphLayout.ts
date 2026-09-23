/**
 * The curriculum's containment tree: Unit > Chapter > Topic > Concept.
 *
 * This file used to also position a canvas — a tidy-tree over every node in the
 * subject, one row per leaf. That canvas is gone: on a real course it stacked 233
 * concepts about 15,000px tall, so the view zoomed out to 0.05 and nothing was
 * legible. The focus map in `focusLayout.ts` replaced it, and dependency layout lives
 * there now.
 *
 * What survives is the part that was never the problem — working out what contains
 * what — because the drill-down deck still needs it to let someone pick a concept.
 */

import type { CoherenceNode, CoherenceNodeType } from '@/app/course-master/data/coherenceMap';

export type TreeNode = {
  node: CoherenceNode;
  children: TreeNode[];
  /** Depth in the containment tree; 0 for the roots of the forest. */
  level: number;
};

/**
 * Build the containment forest, honouring a level filter.
 *
 * A node whose type is filtered out is skipped but its children are NOT: they are
 * lifted to the nearest visible ancestor. Hiding "Topic" should collapse the hierarchy
 * to Unit > Chapter > Concept, not make every concept vanish — and on a course where
 * `topic_id` is unpopulated that is the normal path rather than an edge case, which is
 * why the deck can rely on it.
 */
export function buildForest(
  nodes: CoherenceNode[],
  typeFilter: Set<CoherenceNodeType>
): TreeNode[] {
  const byId = new Map<string, CoherenceNode>();
  for (const node of nodes) byId.set(node.id, node);

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

  const sortChildren = (tree: TreeNode, level: number) => {
    tree.level = level;
    tree.children.sort((a, b) => a.node.order - b.node.order || a.node.label.localeCompare(b.node.label));
    for (const child of tree.children) sortChildren(child, level + 1);
  };

  roots.sort((a, b) => {
    // Off-map nodes first — they come before this course by definition.
    if (a.node.off_map !== b.node.off_map) return a.node.off_map ? -1 : 1;

    return a.node.order - b.node.order;
  });

  for (const root of roots) sortChildren(root, 0);

  return roots;
}

/** Every concept beneath a tree node, in curriculum order. */
export function conceptsUnder(tree: TreeNode): CoherenceNode[] {
  const found: CoherenceNode[] = [];

  const walk = (current: TreeNode) => {
    if (current.node.type === 'concept') found.push(current.node);
    for (const child of current.children) walk(child);
  };

  walk(tree);

  return found;
}
