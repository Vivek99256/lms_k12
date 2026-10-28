'use client';

import React from 'react';
import { JOURNEY_STAGES } from '@/app/pal/_components/journey-stages';
import { milestoneStatusStyle, type MilestoneKey } from '@/app/pal/journey/data/pal-journey';
import type { ClassBoardPosition } from '../../data/class-journey';

interface IsometricClassBoardProps {
  positionsByMilestone: Readonly<Record<MilestoneKey, ClassBoardPosition[]>>;
  onSelectStudent: (studentId: string) => void;
}

/**
 * The class-wide learning map as a flat ISOMETRIC illustration — distinct
 * floating platform tiles on a 2:1 isometric grid, one per journey stage,
 * each holding every student currently there as a small standing pawn.
 * Pure SVG/CSS projection math, no 3D engine: a real lit react-three-fiber
 * board was tried for the student's own map and pulled for reading as
 * gloomy even after a brighter recolour (see `PathJourneyView.tsx`'s own
 * header). Flat isometric keeps the "game board" feel without that
 * shadow-darkened-palette risk — every face here is a fixed flat tint,
 * never a lighting calculation.
 *
 * The GRID pitch (spacing between tile centres) is deliberately larger than
 * the TILE itself, so platforms sit apart with real gaps — a first version
 * packed tiles edge-to-edge, which left no safe space for a label below a
 * tile without it landing on the neighbour's footprint instead.
 */

// Grid coordinates (col 0-3, row 0-2), snaking through all 12 stages — the
// same shape the student map's own flat layout uses, just expressed as grid
// cells instead of raw pixel positions, since isometric projection needs a
// (col,row) pair to project rather than an (x,y) point.
const GRID: Readonly<Record<MilestoneKey, { col: number; row: number }>> = {
  diagnostic: { col: 0, row: 0 },
  adaptive: { col: 1, row: 0 },
  plan: { col: 2, row: 0 },
  learn: { col: 3, row: 0 },
  practice: { col: 3, row: 1 },
  explanation_lab: { col: 2, row: 1 },
  feedback: { col: 1, row: 1 },
  check: { col: 0, row: 1 },
  intervention: { col: 0, row: 2 },
  mastery: { col: 1, row: 2 },
  experiment: { col: 2, row: 2 },
  recall: { col: 3, row: 2 },
};

// Pitch between cell centres. CELL_H in particular has to clear a whole
// tile's own vertical footprint PLUS its label below it — two cells can
// share the same projected x (anything with the same col-row), and the
// nearer of those was landing its pawn/label inside the tile below it when
// CELL_H was 76 against a ~75-unit label reach. 112 leaves real margin.
const CELL_W = 170;
const CELL_H = 112;
// The platform's own footprint — smaller than the pitch so neighbours
// never touch.
const TILE_W = 100;
const TILE_H = 50;
const TILE_DEPTH = 14;
const LABEL_GAP = 14;
const LABEL_HEIGHT = 22;

const TOP_COLOR = '#a78bfa';
const LEFT_COLOR = '#7c5fe0';
const RIGHT_COLOR = '#8f6bf0';

const AVATAR_SIZE = 20;
const CLUSTER_RADIUS = 22;
const MAX_VISIBLE = 6;

interface IsoPoint {
  x: number;
  y: number;
}

function rawIso(col: number, row: number): IsoPoint {
  return { x: (col - row) * (CELL_W / 2), y: (col + row) * (CELL_H / 2) };
}

// The viewBox is derived from the real extent of all 12 stage positions
// (plus padding for a tile's own half-size, its depth, and label height)
// rather than hand-picked, so nothing clips regardless of how the constants
// above are tuned later.
const RAW_POINTS = JOURNEY_STAGES.map((stage) => rawIso(GRID[stage.key].col, GRID[stage.key].row));
const PAD_X = TILE_W / 2 + 14;
const PAD_TOP = TILE_H / 2 + 14;
const PAD_BOTTOM = TILE_H / 2 + TILE_DEPTH + LABEL_GAP + LABEL_HEIGHT;
const MIN_X = Math.min(...RAW_POINTS.map((p) => p.x)) - PAD_X;
const MAX_X = Math.max(...RAW_POINTS.map((p) => p.x)) + PAD_X;
const MIN_Y = Math.min(...RAW_POINTS.map((p) => p.y)) - PAD_TOP;
const MAX_Y = Math.max(...RAW_POINTS.map((p) => p.y)) + PAD_BOTTOM;
const VIEW_WIDTH = MAX_X - MIN_X;
const VIEW_HEIGHT = MAX_Y - MIN_Y;
const ORIGIN_X = -MIN_X;
const ORIGIN_Y = -MIN_Y;

function isoCenter(col: number, row: number): IsoPoint {
  const raw = rawIso(col, row);
  return { x: ORIGIN_X + raw.x, y: ORIGIN_Y + raw.y };
}

function diamondPoints({ x, y }: IsoPoint): string {
  return [`${x},${y - TILE_H / 2}`, `${x + TILE_W / 2},${y}`, `${x},${y + TILE_H / 2}`, `${x - TILE_W / 2},${y}`].join(' ');
}

function leftFacePoints({ x, y }: IsoPoint): string {
  return [
    `${x - TILE_W / 2},${y}`,
    `${x},${y + TILE_H / 2}`,
    `${x},${y + TILE_H / 2 + TILE_DEPTH}`,
    `${x - TILE_W / 2},${y + TILE_DEPTH}`,
  ].join(' ');
}

function rightFacePoints({ x, y }: IsoPoint): string {
  return [
    `${x},${y + TILE_H / 2}`,
    `${x + TILE_W / 2},${y}`,
    `${x + TILE_W / 2},${y + TILE_DEPTH}`,
    `${x},${y + TILE_H / 2 + TILE_DEPTH}`,
  ].join(' ');
}

function leftPct(point: IsoPoint) {
  return (point.x / VIEW_WIDTH) * 100;
}
function topPct(point: IsoPoint) {
  return (point.y / VIEW_HEIGHT) * 100;
}
function pctW(units: number) {
  return (units / VIEW_WIDTH) * 100;
}
function pctH(units: number) {
  return (units / VIEW_HEIGHT) * 100;
}

/** Where one pawn in a cluster of `count` stands on a tile's top face — centred when alone, a small flattened ring otherwise (squashed to roughly the diamond's own 2:1 footprint, so it reads as standing on the tile, not floating above it). */
function pawnOffset(slot: number, count: number): { dx: number; dy: number } {
  if (count <= 1) return { dx: 0, dy: 0 };
  const angle = (slot / count) * 2 * Math.PI - Math.PI / 2;
  return { dx: Math.cos(angle) * CLUSTER_RADIUS, dy: Math.sin(angle) * CLUSTER_RADIUS * 0.5 };
}

export function IsometricClassBoard({ positionsByMilestone, onSelectStudent }: IsometricClassBoardProps) {
  // Painter's algorithm: a tile nearer the viewer (higher col+row) must be
  // drawn after every tile behind it, or its side faces would be painted
  // over by a farther tile drawn later. JOURNEY_STAGES isn't ordered that
  // way, so sort explicitly before drawing (the connecting bridges are
  // drawn first regardless, so every tile sits on top of them).
  const drawOrder = [...JOURNEY_STAGES].sort((a, b) => {
    const ga = GRID[a.key];
    const gb = GRID[b.key];
    return ga.col + ga.row - (gb.col + gb.row) || ga.col - gb.col;
  });

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-b from-sky-200 via-sky-100 to-emerald-100"
      style={{ aspectRatio: `${VIEW_WIDTH} / ${VIEW_HEIGHT}` }}
    >
      <svg viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} className="pointer-events-none absolute inset-0 h-full w-full">
        {/* Bridges first, so a tile's own body always paints over the segment crossing its footprint — only the gap between platforms stays visible, reading as a rope bridge between islands. The dashes drift along the line (iso-bridge) so the path reads as a route being travelled, not a static dotted border. */}
        {JOURNEY_STAGES.slice(0, -1).map((stage, i) => {
          const next = JOURNEY_STAGES[i + 1];
          const a = isoCenter(GRID[stage.key].col, GRID[stage.key].row);
          const b = isoCenter(GRID[next.key].col, GRID[next.key].row);
          return (
            <line
              key={stage.key}
              className="iso-bridge"
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="#fbbf24"
              strokeWidth={6}
              strokeLinecap="round"
              strokeDasharray="1 14"
              opacity={0.9}
            />
          );
        })}

        {drawOrder.map((stage, i) => {
          const center = isoCenter(GRID[stage.key].col, GRID[stage.key].row);
          return (
            <g
              key={stage.key}
              className="iso-tile"
              style={{ animationDelay: `${i * 45}ms`, transformBox: 'fill-box', transformOrigin: 'center' }}
            >
              <ellipse
                cx={center.x}
                cy={center.y + TILE_H / 2 + 5}
                rx={TILE_W / 2.3}
                ry={7}
                fill="#0f172a"
                opacity={0.18}
              />
              <polygon points={leftFacePoints(center)} fill={LEFT_COLOR} />
              <polygon points={rightFacePoints(center)} fill={RIGHT_COLOR} />
              <polygon points={diamondPoints(center)} fill={TOP_COLOR} stroke="#ffffff" strokeWidth={2} strokeOpacity={0.8} />
            </g>
          );
        })}
      </svg>

      <div className="pointer-events-none absolute inset-0">
        {JOURNEY_STAGES.map((stage) => {
          const grid = GRID[stage.key];
          const center = isoCenter(grid.col, grid.row);
          const Icon = stage.icon;
          const students = positionsByMilestone[stage.key] ?? [];
          const visible = students.slice(0, MAX_VISIBLE);
          const overflow = students.length - visible.length;
          const slotCount = visible.length + (overflow > 0 ? 1 : 0);
          const left = leftPct(center);
          const top = topPct(center);

          return (
            <React.Fragment key={stage.key}>
              {students.length === 0 && (
                <div
                  className="iso-idle-icon pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center text-white/85"
                  style={{ left: `${left}%`, top: `${top}%` }}
                >
                  <Icon className="h-4 w-4" />
                </div>
              )}

              {visible.map((student, i) => {
                const { dx, dy } = pawnOffset(i, slotCount);
                const style = milestoneStatusStyle(student.status);
                return (
                  <button
                    key={student.studentId}
                    type="button"
                    title={student.name ?? `Student #${student.studentId}`}
                    onClick={() => onSelectStudent(student.studentId)}
                    className="pointer-events-auto absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                    style={{ left: `calc(${left}% + ${pctW(dx)}%)`, top: `calc(${top}% + ${pctH(dy)}%)` }}
                  >
                    {/* Bob animation lives on this inner wrapper, never on the
                        positioned button above — animating `transform` there
                        would clobber the -50%/-50% centring translate. */}
                    <span className="iso-pawn-bob flex flex-col items-center" style={{ animationDelay: `${(i * 260) % 1700}ms` }}>
                      <span
                        className="flex items-center justify-center rounded-full border-2 border-white text-[9px] font-bold text-white shadow transition-transform hover:z-10 hover:scale-125"
                        style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, backgroundColor: style.hex }}
                      >
                        {(student.name ?? '?').trim().charAt(0).toUpperCase() || '?'}
                      </span>
                      <span className="-mt-0.5 h-1 w-3 rounded-full bg-black/20 blur-[1px]" />
                    </span>
                  </button>
                );
              })}

              {overflow > 0 &&
                (() => {
                  const { dx, dy } = pawnOffset(slotCount - 1, slotCount);
                  return (
                    <div
                      title={`${overflow} more student${overflow === 1 ? '' : 's'}`}
                      className="pointer-events-auto absolute flex -translate-x-1/2 -translate-y-1/2 cursor-default items-center justify-center rounded-full border-2 border-white bg-slate-700 text-[8px] font-bold text-white shadow"
                      style={{
                        left: `calc(${left}% + ${pctW(dx)}%)`,
                        top: `calc(${top}% + ${pctH(dy)}%)`,
                        width: AVATAR_SIZE,
                        height: AVATAR_SIZE,
                      }}
                    >
                      +{overflow}
                    </div>
                  );
                })()}

              <div
                className="pointer-events-none absolute flex -translate-x-1/2 flex-col items-center"
                style={{ left: `${left}%`, top: `calc(${top}% + ${pctH(TILE_H / 2 + TILE_DEPTH + LABEL_GAP)}%)` }}
              >
                <span className="whitespace-nowrap rounded-md bg-white px-1.5 py-0.5 text-[8px] font-bold text-slate-700 shadow">
                  {stage.label}
                  {students.length > 0 ? ` · ${students.length}` : ''}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      <style jsx>{`
        .iso-tile {
          animation: isoTileIn 420ms ease both;
        }
        .iso-bridge {
          animation: isoBridgeFlow 1.4s linear infinite;
        }
        .iso-pawn-bob {
          animation: isoPawnBob 2.6s ease-in-out infinite;
        }
        .iso-idle-icon {
          animation: isoIdlePulse 2.8s ease-in-out infinite;
        }
        @keyframes isoTileIn {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.92);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes isoBridgeFlow {
          from {
            stroke-dashoffset: 0;
          }
          to {
            stroke-dashoffset: -30;
          }
        }
        @keyframes isoPawnBob {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-3px);
          }
        }
        @keyframes isoIdlePulse {
          0%,
          100% {
            opacity: 0.55;
          }
          50% {
            opacity: 0.95;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .iso-tile,
          .iso-bridge,
          .iso-pawn-bob,
          .iso-idle-icon {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
