import type { JourneyStageKey } from '@/app/pal/_components/journey-stages';

/**
 * Fixed 2D layout for the serpentine "level map" journey path — the 2D
 * replacement for `three/scene-layout.ts`'s isometric ground plane (see
 * `PathJourneyView.tsx`'s own header for why this replaced the 3D board).
 *
 * Four columns, three rows, snaking left-right-left-right across the twelve
 * stages in `JOURNEY_STAGES` order — the same structural idea as a mobile
 * game's level map, built from this app's own coordinates rather than
 * traced from one.
 */
export interface Point {
  x: number;
  y: number;
}

export const VIEW_WIDTH = 880;
export const VIEW_HEIGHT = 660;

const COL = [110, 330, 550, 770];
const ROW = [130, 330, 530];

export const MILESTONE_2D_POSITIONS: Readonly<Record<JourneyStageKey, Point>> = {
  diagnostic: { x: COL[0], y: ROW[0] },
  adaptive: { x: COL[1], y: ROW[0] },
  plan: { x: COL[2], y: ROW[0] },
  learn: { x: COL[3], y: ROW[0] },
  practice: { x: COL[3], y: ROW[1] },
  explanation_lab: { x: COL[2], y: ROW[1] },
  feedback: { x: COL[1], y: ROW[1] },
  check: { x: COL[0], y: ROW[1] },
  intervention: { x: COL[0], y: ROW[2] },
  mastery: { x: COL[1], y: ROW[2] },
  experiment: { x: COL[2], y: ROW[2] },
  recall: { x: COL[3], y: ROW[2] },
};

export const NODE_RADIUS = 34;

/**
 * Catmull-Rom-to-cubic-bezier smoothing (tension 1/6) through an ordered
 * point list, so the track reads as a winding road rather than straight
 * joins between stops. Standard conversion, not project-specific.
 */
export function smoothPathD(points: Point[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  const d = [`M ${points[0].x} ${points[0].y}`];
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d.push(`C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`);
  }
  return d.join(' ');
}
