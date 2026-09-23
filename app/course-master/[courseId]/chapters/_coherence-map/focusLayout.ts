/**
 * Positions for the coherence map's FOCUS view.
 *
 * WHAT THIS REPLACED, AND WHY
 * The previous layout drew the whole containment forest at once: every unit, chapter,
 * topic and concept in the subject, one row per leaf. On Science Grade 6 that is 233
 * concepts at 68px a row - roughly 15,000px tall - so `fitView` zoomed out to 0.05 and
 * the canvas became an unreadable vertical smear. It answered "what is in this
 * subject", which the chapter list already answers better.
 *
 * This one answers the question the screen exists for: given ONE concept, what must be
 * learned before it and what does it unlock. That is a small graph - measured across
 * the whole authored map, a concept has at most 4 direct prerequisites and at most 8
 * direct dependents - so it fits on screen at zoom 1 with nothing hidden.
 *
 * THE SHAPE
 * Five columns. The chosen concept sits in the middle; its prerequisites fan LEFT and
 * the things it unlocks fan RIGHT, two hops each way.
 *
 *   prereq(2) -> prereq(1) -> [ CONCEPT ] -> unlocks(1) -> unlocks(2)
 *
 * Left-to-right is the order a student learns things, which is why prerequisites are
 * on the left and every arrow points right. An arrow that points LEFT is therefore a
 * cycle in the data, visibly, rather than a rendering artefact.
 *
 * Containment does not appear on the canvas at all. A concept's unit, chapter and
 * topic ride in its card header instead, because hierarchy competing with dependency
 * for the same visual channel is what made the old map unreadable.
 */

import type {
  CoherenceEdge,
  CoherenceMap,
  CoherenceNode,
} from '@/app/course-master/data/coherenceMap';

/** Resting card. The reference draws 640x440 at scale(0.3); this is that, rounded. */
export const FOCUS_CARD = { width: 192, height: 132 } as const;

/** The same card opened. Full size, because here it IS the detail panel. */
export const FOCUS_EXPANDED = { width: 640, height: 440 } as const;

const PADDING_H = 100;
const PADDING_V = 40;

/** Column pitch: 292px. Five columns span 1360px, inside the shell's max-w-[1460px]. */
export const COLUMN_STEP = FOCUS_CARD.width + PADDING_H;

/** Row pitch: 172px. */
export const ROW_STEP = FOCUS_CARD.height + PADDING_V;

/** How far each side of the expanded card pushes its neighbours out. */
export const DETAIL_SHIFT = Math.round((FOCUS_EXPANDED.width - FOCUS_CARD.width) / 2) + 40;

/** Edges sharing a corridor are separated onto this grid, as the reference does. */
const LANE_STEP = 10;

/** Hops each way. 2 gives the reference's five columns. */
const DEGREES = 2;

export type FocusNode = CoherenceNode & {
  x: number;
  y: number;
  width: number;
  height: number;
  /** 0..4, where 2 is the centred concept. */
  column: number;
  /** Position within the column, top first. */
  row: number;
  /** Negative on the prerequisite side, positive on the dependent side. */
  distance: number;
  isRoot: boolean;
  /**
   * True when this concept is reachable in BOTH directions from the root - it is both
   * a prerequisite and a dependent, which means it shares a cycle with the root. It is
   * drawn once, on the prerequisite side, and flagged rather than hidden.
   */
  onBothSides: boolean;
  /** Unit > Chapter > Topic, outermost first. Rendered as the card's overline. */
  ancestry: CoherenceNode[];
};

export type FocusEdgeGeometry = {
  /** Absolute x of the vertical run, so edges in one corridor do not overlap. */
  laneX: number;
  /**
   * True when the arrow would point left, i.e. the dependent sits before its own
   * prerequisite. Only a cycle produces this, and it is routed as a bow over the top
   * rather than a line back through the cards.
   */
  backward: boolean;
};

export type FocusLayout = {
  nodes: FocusNode[];
  /** Edges to draw, already filtered to pairs where both ends are on screen. */
  edges: CoherenceEdge[];
  geometry: Map<string, FocusEdgeGeometry>;
  visible: Set<string>;
  width: number;
  height: number;
};

export type Adjacency = {
  /** node -> the concepts it requires. */
  prerequisitesOf: Map<string, string[]>;
  /** node -> the concepts that require it. */
  dependentsOf: Map<string, string[]>;
};

export type FocusFilters = {
  /** Draw edges nobody has approved yet. */
  includeSuggested: boolean;
  /** Draw `cross_curricular` links, which are related-to rather than required-by. */
  includeRelated: boolean;
};

/**
 * Whether an edge counts as a dependency at all.
 *
 * `hierarchy` never does: containment is not dependency, and following it would make
 * every concept in a chapter look like a prerequisite of every other one. That rule
 * lives here alone so the layout, the trace and the card cannot disagree about it.
 */
export function isDependencyEdge(edge: CoherenceEdge, filters: FocusFilters): boolean {
  if (edge.kind === 'hierarchy') return false;
  if (edge.kind === 'cross_curricular' && !filters.includeRelated) return false;
  if (edge.status !== 'approved' && !filters.includeSuggested) return false;

  return true;
}

/** Both directions of the dependency graph, built in one pass. */
export function buildAdjacency(edges: CoherenceEdge[], filters: FocusFilters): Adjacency {
  const prerequisitesOf = new Map<string, string[]>();
  const dependentsOf = new Map<string, string[]>();

  for (const edge of edges) {
    if (!isDependencyEdge(edge, filters)) continue;

    // source = prerequisite, target = dependent. The server flips storage direction
    // on the way out so arrows point the way learning travels; do not flip again.
    push(prerequisitesOf, edge.target, edge.source);
    push(dependentsOf, edge.source, edge.target);
  }

  return { prerequisitesOf, dependentsOf };
}

function push(map: Map<string, string[]>, key: string, value: string): void {
  const current = map.get(key);
  if (current) current.push(value);
  else map.set(key, [value]);
}

/**
 * Lay out the map around one concept.
 *
 * @param rootId   The concept to centre. Must exist in `map.nodes`.
 * @param expanded The concept whose card is open, if any. An open card pushes the
 *                 columns either side outward so it never overlaps its neighbours.
 */
export function layoutFocusMap(
  map: CoherenceMap,
  rootId: string,
  filters: FocusFilters,
  expanded: string | null = null
): FocusLayout | null {
  const byId = new Map<string, CoherenceNode>();
  for (const node of map.nodes) byId.set(node.id, node);

  const root = byId.get(rootId);
  if (!root) return null;

  const adjacency = buildAdjacency(map.edges, filters);

  // Separate visited sets per direction, deliberately. Sharing one would let whichever
  // direction ran first claim a node that is both a one-step prerequisite and a
  // two-step dependent - and `on_cycle` guarantees such nodes exist.
  const back = walk(adjacency.prerequisitesOf, rootId, -1);
  const forward = walk(adjacency.dependentsOf, rootId, +1);

  const distance = new Map<string, number>([[rootId, 0]]);

  for (const [id, d] of back) distance.set(id, d);

  for (const [id, d] of forward) {
    // Already claimed by the prerequisite side: it is on a ring with the root. Keep it
    // on the left and let the card flag the loop, rather than drawing it twice (which
    // xyflow forbids) or dropping it (which would hide the loop a curator must fix).
    if (!distance.has(id)) distance.set(id, d);
  }

  const bothSides = new Set<string>();
  for (const id of forward.keys()) {
    if (back.has(id)) bothSides.add(id);
  }

  // ── Columns ───────────────────────────────────────────────────────
  const columns: string[][] = [[], [], [], [], []];

  for (const [id, d] of distance) {
    if (!byId.has(id)) continue;
    columns[d + DEGREES].push(id);
  }

  orderColumns(columns, adjacency, byId);

  // ── Positions ─────────────────────────────────────────────────────
  const visible = new Set<string>();
  const nodes: FocusNode[] = [];
  const tallest = Math.max(...columns.map((c) => c.length), 1);

  columns.forEach((column, index) => {
    // Each column is centred on the root's line, so the root sits on the midline and
    // the two sides read as balanced rather than top-aligned.
    const offset = -((column.length - 1) / 2) * ROW_STEP;

    column.forEach((id, row) => {
      const node = byId.get(id);
      if (!node) return;

      const isRoot = id === rootId;
      const size = id === expanded ? FOCUS_EXPANDED : FOCUS_CARD;

      nodes.push({
        ...node,
        x: columnX(index, expanded === null ? null : columnOf(expanded, distance)) - size.width / 2,
        y: offset + row * ROW_STEP - size.height / 2,
        width: size.width,
        height: size.height,
        column: index,
        row,
        distance: index - DEGREES,
        isRoot,
        onBothSides: bothSides.has(id),
        ancestry: ancestryOf(byId, node),
      });
      visible.add(id);
    });
  });

  // ── Edges ─────────────────────────────────────────────────────────
  const drawn = map.edges.filter(
    (e) => isDependencyEdge(e, filters) && visible.has(e.source) && visible.has(e.target)
  );

  const positions = new Map<string, FocusNode>();
  for (const node of nodes) positions.set(node.id, node);

  const geometry = assignLanes(drawn, positions);

  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);

  return {
    nodes,
    edges: drawn,
    geometry,
    visible,
    width: Math.max(...xs.map((x, i) => x + nodes[i].width)) - Math.min(...xs),
    height: Math.max(...ys.map((y, i) => y + nodes[i].height)) - Math.min(...ys) || tallest * ROW_STEP,
  };
}

/** Centre-x of a column, pushed outward when a card in the middle is open. */
function columnX(index: number, expandedColumn: number | null): number {
  const base = (index - DEGREES) * COLUMN_STEP;

  if (expandedColumn === null) return base;

  // The reference's `detailLayout`: everything left of the open card moves further
  // left and everything right of it moves further right, so the open card gets its
  // width without covering its neighbours.
  if (index < expandedColumn) return base - DETAIL_SHIFT;
  if (index > expandedColumn) return base + DETAIL_SHIFT;

  return base;
}

function columnOf(id: string, distance: Map<string, number>): number | null {
  const d = distance.get(id);

  return d === undefined ? null : d + DEGREES;
}

/**
 * Breadth-first, level-synchronous, so the shallowest distance always wins.
 *
 * A depth-first walk cannot do this: it would reach a node at distance 2 along one
 * path before the distance-1 edge that also points at it, and pin it to the wrong
 * column. Seeding `visited` with the root in the same line guards self-loops and the
 * prerequisite rings the data is known to contain.
 */
function walk(adjacency: Map<string, string[]>, rootId: string, sign: 1 | -1): Map<string, number> {
  const visited = new Set<string>([rootId]);
  const distance = new Map<string, number>();
  let frontier = [rootId];

  for (let hop = 1; hop <= DEGREES; hop += 1) {
    const next: string[] = [];

    for (const id of frontier) {
      for (const neighbour of adjacency.get(id) ?? []) {
        if (visited.has(neighbour)) continue;

        visited.add(neighbour);
        distance.set(neighbour, sign * hop);
        next.push(neighbour);
      }
    }

    frontier = next;
  }

  return distance;
}

/**
 * Order each column to reduce edge crossings.
 *
 * Two barycentre sweeps outward from the centre, then one back-sweep. Ties break on
 * `(order, id)`, which is a total order - so the map is identical every time it opens.
 * That determinism is not a nicety: teachers navigate this by remembered position, and
 * a layout that reshuffles on reload is worse than one that is slightly less tidy.
 */
function orderColumns(
  columns: string[][],
  adjacency: Adjacency,
  byId: Map<string, CoherenceNode>
): void {
  const rowOf = new Map<string, number>();

  const commit = (column: string[]) => {
    column.forEach((id, row) => rowOf.set(id, row));
  };

  commit(columns[DEGREES]);

  const sweep = (target: number, reference: number) => {
    const column = columns[target];
    if (column.length < 2) {
      commit(column);

      return;
    }

    const neighbours = columns[reference];
    const barycentre = new Map<string, number>();

    for (const id of column) {
      const linked = [
        ...(adjacency.prerequisitesOf.get(id) ?? []),
        ...(adjacency.dependentsOf.get(id) ?? []),
      ].filter((n) => neighbours.includes(n));

      // No link into the reference column - only reachable some other way. Sink it to
      // the bottom rather than letting an average of nothing decide its place.
      barycentre.set(
        id,
        linked.length === 0
          ? Number.POSITIVE_INFINITY
          : linked.reduce((sum, n) => sum + (rowOf.get(n) ?? 0), 0) / linked.length
      );
    }

    column.sort((a, b) => {
      const delta = (barycentre.get(a) ?? 0) - (barycentre.get(b) ?? 0);
      if (delta !== 0 && Number.isFinite(delta)) return delta;

      const nodeA = byId.get(a);
      const nodeB = byId.get(b);

      return (nodeA?.order ?? 0) - (nodeB?.order ?? 0) || a.localeCompare(b);
    });

    commit(column);
  };

  sweep(DEGREES + 1, DEGREES);
  sweep(DEGREES + 2, DEGREES + 1);
  sweep(DEGREES - 1, DEGREES);
  sweep(DEGREES - 2, DEGREES - 1);
}

/**
 * Give every edge its own vertical lane within the corridor it crosses.
 *
 * Interval-graph colouring: two edges may share a lane whenever their y-spans do not
 * overlap, so the number of lanes needed is the worst simultaneous overlap - typically
 * three or four, not the edge count. Grouping is by absolute corridor rather than by
 * column pair, so an edge that skips a column cannot land in a neighbouring corridor's
 * lanes. The final snap to a 10px grid is what makes two coincident edges draw as one
 * crisp line instead of two half-pixel-apart blurry ones.
 */
function assignLanes(
  edges: CoherenceEdge[],
  positions: Map<string, FocusNode>
): Map<string, FocusEdgeGeometry> {
  const geometry = new Map<string, FocusEdgeGeometry>();
  const corridors = new Map<string, { edge: CoherenceEdge; from: number; to: number; top: number; bottom: number }[]>();

  for (const edge of edges) {
    const source = positions.get(edge.source);
    const target = positions.get(edge.target);
    if (!source || !target) continue;

    const from = source.x + source.width;
    const to = target.x;

    if (from >= to) {
      // The dependent sits at or before its own prerequisite: a cycle. It gets a bow
      // over the top instead of a lane, so it cannot be mistaken for a normal edge.
      geometry.set(edge.id, { laneX: (from + to) / 2, backward: true });
      continue;
    }

    const key = `${Math.round(from)}:${Math.round(to)}`;
    const sourceY = source.y + source.height / 2;
    const targetY = target.y + target.height / 2;

    const entry = {
      edge,
      from,
      to,
      top: Math.min(sourceY, targetY),
      bottom: Math.max(sourceY, targetY),
    };

    const bucket = corridors.get(key);
    if (bucket) bucket.push(entry);
    else corridors.set(key, [entry]);
  }

  for (const bucket of corridors.values()) {
    bucket.sort((a, b) => a.top - b.top || a.bottom - b.bottom);

    const laneEnds: number[] = [];
    const laneOf = new Map<string, number>();

    for (const entry of bucket) {
      let lane = laneEnds.findIndex((end) => end <= entry.top);

      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(entry.bottom);
      } else {
        laneEnds[lane] = entry.bottom;
      }

      laneOf.set(entry.edge.id, lane);
    }

    const lanes = laneEnds.length;

    for (const entry of bucket) {
      const lane = laneOf.get(entry.edge.id) ?? 0;
      const middle = (entry.from + entry.to) / 2;
      const raw = middle + (lane - (lanes - 1) / 2) * LANE_STEP;

      geometry.set(entry.edge.id, {
        laneX: Math.round(raw / LANE_STEP) * LANE_STEP,
        backward: false,
      });
    }
  }

  return geometry;
}

/**
 * Unit > Chapter > Topic for one concept, outermost first.
 *
 * The containment levels left the canvas, so this is how a card still says where in
 * the curriculum it sits. Off-map concepts have no parent chain in this payload - they
 * carry their chapter and subject as names in `meta` instead - so this returns empty
 * for them and the card falls back to those.
 */
export function ancestryOf(byId: Map<string, CoherenceNode>, node: CoherenceNode): CoherenceNode[] {
  const chain: CoherenceNode[] = [];
  let parentId = node.parent_id;
  let guard = 0;

  while (parentId && guard < 8) {
    const parent = byId.get(parentId);
    if (!parent) break;

    chain.unshift(parent);
    parentId = parent.parent_id;
    guard += 1;
  }

  return chain;
}

/**
 * Everything the root depends on, and everything that depends on it, transitively.
 *
 * Used for the ambient tint, not for columns - it answers "is this related at all",
 * which is a different question from "how far away is it". Breadth-first with a
 * visited set because the graph contains rings.
 */
export function neighbourhood(
  edges: CoherenceEdge[],
  nodeId: string,
  filters: FocusFilters
): { upstream: Set<string>; downstream: Set<string>; touching: Set<string> } {
  const { prerequisitesOf, dependentsOf } = buildAdjacency(edges, filters);
  const touching = new Set<string>();

  for (const edge of edges) {
    if (!isDependencyEdge(edge, filters)) continue;
    if (edge.source === nodeId || edge.target === nodeId) touching.add(edge.id);
  }

  const reach = (adjacency: Map<string, string[]>): Set<string> => {
    const seen = new Set<string>();
    const queue = [...(adjacency.get(nodeId) ?? [])];

    while (queue.length > 0) {
      const current = queue.pop();
      if (current === undefined || seen.has(current) || current === nodeId) continue;
      seen.add(current);

      for (const next of adjacency.get(current) ?? []) {
        if (!seen.has(next)) queue.push(next);
      }
    }

    return seen;
  };

  return { upstream: reach(prerequisitesOf), downstream: reach(dependentsOf), touching };
}
