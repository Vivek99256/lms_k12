/**
 * A small, dependency-free force simulation — every node repels every other,
 * links act as springs, and a weak pull keeps the whole thing centred.
 * `alpha` is the energy: it decays to rest, and dragging or expanding pumps
 * it back up so the picture rearranges and settles again.
 *
 * Lifted from `org-knowledge-graph.tsx`'s own `tick()` (the Organization
 * Management Knowledge Graph's bespoke physics engine — the actual UI
 * reference this file generalizes), with one change: that version hard-coded
 * a `SIZE`/`CHARGE` table per `GraphNodeType` (institute/role/department/
 * staff/subject/fact). This version takes the same two functions as plain
 * parameters instead, so any caller with its own notion of node "kind" can
 * reuse the identical physics without inheriting that one domain's table.
 */

export interface SimNode {
  id: string;
  kind: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Set while a node is dragged or pinned: the simulation holds it here. */
  fx: number | null;
  fy: number | null;
}

export interface SimLink {
  a: string;
  b: string;
  length: number;
  strength: number;
}

export interface ForceConfig {
  /** Diameter of a kind of node — the physics treats it as a disc of half this size. */
  size: (kind: string) => number;
  /** How hard a kind of node pushes its neighbours away. */
  charge: (kind: string) => number;
}

export function tick(sim: Map<string, SimNode>, links: SimLink[], alpha: number, config: ForceConfig): void {
  const list = [...sim.values()];

  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let d2 = dx * dx + dy * dy;
      if (d2 > 360000) continue;
      if (d2 < 1) {
        dx = (Math.random() - 0.5) * 2;
        dy = (Math.random() - 0.5) * 2;
        d2 = dx * dx + dy * dy + 1;
      }
      // Distance is floored for the push so two nodes that start on top of each other are not flung out.
      const push = (((config.charge(a.kind) + config.charge(b.kind)) / 2) * alpha) / Math.max(d2, 900);
      a.vx -= dx * push;
      a.vy -= dy * push;
      b.vx += dx * push;
      b.vy += dy * push;

      // Collision: never let two circles overlap.
      const d = Math.sqrt(d2);
      const min = (config.size(a.kind) + config.size(b.kind)) / 2 + 10;
      if (d < min) {
        const overlap = (Math.min(min - d, 30) / Math.max(d, 1)) * 0.5;
        a.x -= dx * overlap;
        a.y -= dy * overlap;
        b.x += dx * overlap;
        b.y += dy * overlap;
      }
    }
  }

  for (const link of links) {
    const a = sim.get(link.a);
    const b = sim.get(link.b);
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const pull = ((d - link.length) / d) * link.strength * alpha;
    a.vx += dx * pull;
    a.vy += dy * pull;
    b.vx -= dx * pull;
    b.vy -= dy * pull;
  }

  for (const n of list) {
    n.vx -= n.x * 0.012 * alpha;
    n.vy -= n.y * 0.012 * alpha;
    if (n.fx !== null && n.fy !== null) {
      n.x = n.fx;
      n.y = n.fy;
      n.vx = 0;
      n.vy = 0;
      continue;
    }
    n.vx *= 0.62;
    n.vy *= 0.62;
    // Speed limit: whatever the forces say, a node moves at most this far in one frame.
    const speed = Math.hypot(n.vx, n.vy);
    if (speed > 28) {
      n.vx = (n.vx / speed) * 28;
      n.vy = (n.vy / speed) * 28;
    }
    n.x = Math.max(-2500, Math.min(2500, n.x + n.vx));
    n.y = Math.max(-2500, Math.min(2500, n.y + n.vy));
    // A node can never leave the world: this also stops any numeric blow-up from hiding the graph.
    if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) {
      n.x = 0;
      n.y = 0;
      n.vx = 0;
      n.vy = 0;
    }
  }
}

/** Mix a #rrggbb colour toward white (amount > 0) or black (amount < 0) — for the gradient/glow fills. */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const target = amount >= 0 ? 255 : 0;
  const mix = (channel: number) => Math.round(channel + (target - channel) * Math.abs(amount));
  return `rgb(${mix((n >> 16) & 255)},${mix((n >> 8) & 255)},${mix(n & 255)})`;
}

export const initials = (label: string) =>
  label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';
