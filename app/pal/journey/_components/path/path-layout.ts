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

export const NODE_RADIUS = 26;

/**
 * Adventure Map Layout — transforms the learning path into a multi-track panoramic
 * adventure landscape with parallel colored ribbons (matching the bright gamified reference).
 *
 * - Route 1 (Attempt 1): Diagnostic -> Concept Diag -> Plan -> Learn #1 -> Practice #1 -> Feedback -> Check #1 -> Support #1
 *   Flows across the upper ridge of the landscape.
 * - Route 2 (Attempt 2 / Reteach Branch): Plan -> Learn #2 -> Practice #2 -> Check #2 -> Mastery
 *   Branches directly from Plan and flows in parallel across the lower valley.
 */
export function calculateAdventureLayout(
  stepCount: number,
  hasSplit: boolean,
  learn2Index: number,
  planIndex: number,
  viewWidth = VIEW_WIDTH,
  viewHeight = 480
): Point[] {
  if (stepCount <= 0) return [];
  const points: Point[] = [];

  if (!hasSplit || learn2Index <= 0 || learn2Index >= stepCount) {
    // Single undulating adventure path from left to right across the landscape
    const startX = 90;
    const endX = viewWidth - 90;
    const stepX = (endX - startX) / Math.max(1, stepCount - 1);
    for (let i = 0; i < stepCount; i++) {
      const x = Math.round(startX + i * stepX);
      // Gentle rolling landscape curve
      const wave = Math.sin((i / Math.max(1, stepCount - 1)) * Math.PI * 2) * 50;
      const y = Math.round(viewHeight * 0.48 + wave);
      points.push({ x, y });
    }
    return points;
  }

  // Multi-tier panoramic layout (Route 1 across top ridge, Route 2 across lower valley)
  const route1Count = learn2Index;
  const route2Count = stepCount - learn2Index;

  // Route 1 (Top ridge): Diagnostic -> ... -> Support #1
  const r1StartX = 80;
  const r1EndX = viewWidth - 80;
  const r1StepX = (r1EndX - r1StartX) / Math.max(1, route1Count - 1);
  for (let i = 0; i < route1Count; i++) {
    const x = Math.round(r1StartX + i * r1StepX);
    // Gentle undulating mountain wave
    const wave = Math.sin((i / Math.max(1, route1Count - 1)) * Math.PI * 2.2) * 32;
    const y = Math.round(viewHeight * 0.28 + wave);
    points.push({ x, y });
  }

  // Route 2 (Lower valley): Plan -> Learn #2 -> Practice #2 -> Check #2 -> Mastery
  const planX = points[planIndex]?.x ?? (viewWidth * 0.32);
  const r2StartX = Math.max(planX + 75, viewWidth * 0.38);
  const r2EndX = viewWidth - 80;
  const r2StepX = (r2EndX - r2StartX) / Math.max(1, route2Count - 1);
  for (let j = 0; j < route2Count; j++) {
    const x = Math.round(r2StartX + j * r2StepX);
    const wave = Math.sin((j / Math.max(1, route2Count - 1)) * Math.PI * 1.6) * 28;
    const y = Math.round(viewHeight * 0.74 + wave);
    points.push({ x, y });
  }

  return points;
}

/**
 * Dynamically computes 2D coordinates for an arbitrary number of steps (e.g. 14-22+ steps)
 * snaking left-to-right and right-to-left in a smooth serpentine level-map path.
 */
export function calculateDynamicPathLayout(
  stepCount: number,
  viewWidth = VIEW_WIDTH,
  viewHeight = VIEW_HEIGHT
): Point[] {
  if (stepCount <= 0) return [];
  const colsPerRow = stepCount > 16 ? 5 : 4;
  const numRows = Math.ceil(stepCount / colsPerRow);

  const marginX = colsPerRow === 5 ? 80 : 100;
  const usableWidth = viewWidth - marginX * 2;
  const colSpacing = colsPerRow > 1 ? usableWidth / (colsPerRow - 1) : 0;

  const marginY = 90;
  const usableHeight = viewHeight - marginY * 2;
  const rowSpacing = numRows > 1 ? usableHeight / (numRows - 1) : 0;

  const points: Point[] = [];
  for (let i = 0; i < stepCount; i++) {
    const row = Math.floor(i / colsPerRow);
    const colInRow = i % colsPerRow;
    const isEvenRow = row % 2 === 0;
    const effectiveCol = isEvenRow ? colInRow : colsPerRow - 1 - colInRow;

    const x = Math.round(marginX + effectiveCol * colSpacing);
    const y = Math.round(marginY + row * rowSpacing);
    points.push({ x, y });
  }

  return points;
}

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
