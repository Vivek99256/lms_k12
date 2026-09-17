"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { JourneyEndLaunch } from "./JourneyEndLaunch";
import { RIBBON_FILL, RIBBON_TURN_COLOR, STATUS_META } from "./onboarding-ui";
import type { OnboardingStep, StepOwner } from "../_lib/onboarding-api";

/**
 * The launch pad is packed into the lanes alongside the steps, so this sentinel
 * stands in for it wherever a cell can be either.
 */
const LAUNCH = "launch" as const;
type Cell = OnboardingStep | typeof LAUNCH;

/**
 * The serpentine journey ribbon from the reference design.
 *
 * One continuous purple band: steps flow left-to-right, the band makes a thick
 * hairpin turn at the end of the row and continues right-to-left. Each segment
 * carries a small owner marker above and below, joined to the band by a hairline
 * connector.
 *
 * Geometry notes:
 *  - Segments interlock. A chevron's point extends NOTCH past its own box, and
 *    the next chevron is pulled back by -NOTCH so the point fills its notch —
 *    without that negative margin the band shows a triangular gap at every joint.
 *  - Segments that meet a turn get a flat edge on that side, so the band runs
 *    smoothly into the arc instead of poking a point into it.
 *  - Row direction comes from row parity and the clip-path is swapped between
 *    right-pointing and left-pointing variants, rather than mirroring with
 *    scaleX — mirroring would reverse the label text.
 *  - The turn is an SVG semicircle stroked at the band's own thickness, which is
 *    the only way to get a true constant-width 180 degree bend.
 *
 * The journey ends on a launch pad rather than on a step: `JourneyEndLaunch` is
 * packed as one more cell after the last step, so it lands at the end of the
 * final lane and the last chevron points straight into it. It is always laid
 * out — locked until every required step is done — because a destination you
 * cannot see from the start of the road is not a destination.
 *
 * Below `sm` the ribbon cannot stay legible, so it degrades to a vertical
 * stepper — same data, same interactions, no clip-path, launch pad last.
 */

const RIBBON_H = 56; // band thickness
const MARKER_ZONE = 44; // space above and below the band for the owner markers
const ROW_H = MARKER_ZONE * 2 + RIBBON_H; // 144 — also the turn's centre-to-centre span
const TURN_R = ROW_H / 2; // 72
const TURN_W = TURN_R + RIBBON_H / 2 + 4; // 104
const NOTCH = 20; // chevron point depth

const BAND_TOP = MARKER_ZONE + RIBBON_H / 2; // 72 — band centreline within a row
const SVG_H = BAND_TOP + ROW_H + RIBBON_H / 2; // 244

/** Chevron outline. `head`/`tail` flatten the edge that meets a turn. */
function clipPath(pointsLeft: boolean, head: boolean, tail: boolean): string {
  if (pointsLeft) {
    // Row runs right-to-left: notch on the right, point on the left.
    if (head && tail) return "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)";
    if (head) return `polygon(0% 0%, 100% 0%, calc(100% - ${NOTCH}px) 50%, 100% 100%, 0% 100%)`;
    if (tail) return `polygon(${NOTCH}px 0%, 100% 0%, 100% 100%, ${NOTCH}px 100%, 0% 50%)`;
    return `polygon(${NOTCH}px 0%, 100% 0%, calc(100% - ${NOTCH}px) 50%, 100% 100%, ${NOTCH}px 100%, 0% 50%)`;
  }

  if (head && tail) return "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)";
  if (head) return `polygon(0% 0%, calc(100% - ${NOTCH}px) 0%, 100% 50%, calc(100% - ${NOTCH}px) 100%, 0% 100%)`;
  if (tail) return `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, ${NOTCH}px 50%)`;
  return `polygon(0% 0%, calc(100% - ${NOTCH}px) 0%, 100% 50%, calc(100% - ${NOTCH}px) 100%, 0% 100%, ${NOTCH}px 50%)`;
}

function useColumns(): number {
  const [columns, setColumns] = useState(3);

  useEffect(() => {
    const wide = window.matchMedia("(min-width: 1024px)");
    const medium = window.matchMedia("(min-width: 640px)");

    const sync = () => setColumns(wide.matches ? 3 : medium.matches ? 2 : 1);

    sync();
    wide.addEventListener("change", sync);
    medium.addEventListener("change", sync);

    return () => {
      wide.removeEventListener("change", sync);
      medium.removeEventListener("change", sync);
    };
  }, []);

  return columns;
}

function Marker({ label, above }: { label: string; above: boolean }) {
  const initials = (label || "US").substring(0, 2).toUpperCase();

  const dot = (
    <span
      title={label}
      className={`flex size-7 shrink-0 items-center justify-center rounded-full border-2 bg-white border-sky-500 text-sky-600 font-semibold text-[10px]`}
    >
      {initials}
      <span className="sr-only">{label}</span>
    </span>
  );

  const line = <span className="w-px flex-1 bg-slate-800/70" aria-hidden />;

  return (
    <span
      className="flex flex-col items-center"
      style={{ height: MARKER_ZONE }}
    >
      {above ? (
        <>
          {dot}
          {line}
        </>
      ) : null}
    </span>
  );
}

function StepSegment({
  step,
  index,
  pointsLeft,
  head,
  tail,
  selected,
  currentUserName,
  onSelect,
}: {
  step: OnboardingStep;
  index: number;
  pointsLeft: boolean;
  head: boolean;
  tail: boolean;
  selected: boolean;
  currentUserName: string;
  onSelect: (step: OnboardingStep) => void;
}) {
  const meta = STATUS_META[step.status] ?? STATUS_META.pending;
  const Icon = meta.icon;

  return (
    <div className="relative flex min-w-0 flex-1 flex-col items-center">
      <Marker label={currentUserName} above />

      <button
        type="button"
        onClick={() => onSelect(step)}
        aria-current={selected ? "step" : undefined}
        title={`${step.title} — ${meta.label}`}
        className={`relative flex w-full items-center justify-center px-7 text-center transition duration-200 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 ${
          // Gradient follows the direction of travel.
          pointsLeft ? "bg-gradient-to-l" : "bg-gradient-to-r"
          } ${RIBBON_FILL[step.status] ?? RIBBON_FILL.pending} ${selected ? "brightness-110 saturate-150" : ""
          }`}
        style={{ height: RIBBON_H, clipPath: clipPath(pointsLeft, head, tail) }}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <Icon className="size-3.5 shrink-0 opacity-90" aria-hidden />
          <span className="truncate text-[13px] leading-tight font-semibold">{step.title}</span>
        </span>
        <span className="sr-only">
          {" "}— step {index + 1}, {meta.label}
        </span>
      </button>

      {/* Empty space below to keep the chevron centered */}
      <span style={{ height: MARKER_ZONE }} />
    </div>
  );
}

/** Thick 180-degree bend joining one row's band to the next. */
function Turn({ side }: { side: "left" | "right" }) {
  const start = BAND_TOP;
  const end = BAND_TOP + ROW_H;

  // sweep 1 bulges right, sweep 0 bulges left.
  const path =
    side === "right"
      ? `M 0 ${start} H 4 A ${TURN_R} ${TURN_R} 0 0 1 4 ${end} H 0`
      : `M ${TURN_W} ${start} H ${TURN_W - 4} A ${TURN_R} ${TURN_R} 0 0 0 ${TURN_W - 4} ${end} H ${TURN_W}`;

  return (
    <svg
      className="pointer-events-none absolute top-0"
      style={{ width: TURN_W, height: SVG_H, [side]: 0 }}
      viewBox={`0 0 ${TURN_W} ${SVG_H}`}
      fill="none"
      aria-hidden
    >
      <path
        d={path}
        stroke={RIBBON_TURN_COLOR}
        strokeWidth={RIBBON_H}
        strokeLinecap="butt"
        fill="none"
      />
    </svg>
  );
}

function VerticalStepper({
  steps,
  selectedId,
  currentUserName,
  onSelect,
  launchUnlocked,
  launchDestination,
  remainingSteps,
  onLaunch,
}: {
  steps: OnboardingStep[];
  selectedId: number | null;
  currentUserName: string;
  onSelect: (step: OnboardingStep) => void;
  launchUnlocked: boolean;
  launchDestination: string;
  remainingSteps: number;
  onLaunch: () => void;
}) {
  return (
    <ol className="space-y-2 sm:hidden">
      {steps.map((step, index) => {
        const meta = STATUS_META[step.status] ?? STATUS_META.pending;
        const Icon = meta.icon;

        return (
          <li key={step.id}>
            <button
              type="button"
              onClick={() => onSelect(step)}
              aria-current={selectedId === step.id ? "step" : undefined}
              className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${selectedId === step.id
                ? "border-violet-400 bg-violet-50"
                : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
            >
              <span
                className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-r text-xs font-semibold ${RIBBON_FILL[step.status] ?? RIBBON_FILL.pending
                  }`}
              >
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-900">{step.title}</span>
                <span className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                  <Icon className="size-3.5" aria-hidden />
                  {meta.label}
                  <span aria-hidden>·</span>
                  {currentUserName}
                </span>
              </span>
            </button>
          </li>
        );
      })}

      {/* Last item on the list for the same reason it is the last cell of the
          ribbon: the journey ends here. */}
      <li className="pt-1">
        <JourneyEndLaunch
          unlocked={launchUnlocked}
          pointsLeft={false}
          height={RIBBON_H}
          destinationLabel={launchDestination}
          remaining={remainingSteps}
          onLaunch={onLaunch}
        />
      </li>
    </ol>
  );
}

export function JourneyRibbon({
  steps,
  selectedId,
  currentUserName,
  onSelect,
  launchUnlocked,
  launchDestination,
  remainingSteps,
  onLaunch,
}: {
  steps: OnboardingStep[];
  selectedId: number | null;
  currentUserName: string;
  onSelect: (step: OnboardingStep) => void;
  /** True once the API reports every required step complete. */
  launchUnlocked: boolean;
  /** Where the pad says it is going, e.g. "Fees dashboard". */
  launchDestination: string;
  /** Required steps still outstanding, shown on the locked pad. */
  remainingSteps: number;
  onLaunch: () => void;
}) {
  const columns = useColumns();

  if (steps.length === 0) return null;

  // The launch pad is packed as one more cell, so it always lands at the end of
  // the final lane — and starts a lane of its own when the last row is full,
  // which reads as the road arriving somewhere rather than stopping.
  const cells: Cell[] = [...steps, LAUNCH];

  // A middle row loses width to a turn on BOTH sides, so it carries one segment
  // fewer than the first and last rows. With 8 steps at 3 columns this yields the
  // reference layout: 3, 2, 3.
  // Capacity is carried alongside the cells, not recomputed from how many landed
  // in the row: a row that did not fill up still divides into that many slots, so
  // its segments stay the width of a segment instead of stretching to fill the
  // lane. The last lane is nearly always short one, because the launch pill takes
  // a slot but only its own compact width.
  const rows: { cells: Cell[]; capacity: number }[] = [];
  for (let index = 0; index < cells.length;) {
    const isFirstRow = rows.length === 0;
    const remaining = cells.length - index;
    const capacity =
      isFirstRow || remaining <= columns ? columns : Math.max(1, columns - 1);

    rows.push({ cells: cells.slice(index, index + capacity), capacity });
    index += capacity;
  }

  return (
    <div>
      <VerticalStepper
        steps={steps}
        selectedId={selectedId}
        currentUserName={currentUserName}
        onSelect={onSelect}
        launchUnlocked={launchUnlocked}
        launchDestination={launchDestination}
        remainingSteps={remainingSteps}
        onLaunch={onLaunch}
      />

      <div className="relative hidden sm:block" aria-label="Onboarding journey">
        {rows.map((row, rowIndex) => {
          const reversed = rowIndex % 2 === 1;
          const isLastRow = rowIndex === rows.length - 1;
          // `flex-row-reverse` already lays DOM order out right-to-left, so the
          // array must stay in flow order — reversing it too would run the row
          // backwards.
          const rowCells = row.cells;

          // A full row's segments each end up this wide: the lane's width, plus
          // back the NOTCH that every interlocking margin pulled out of it, over
          // the number of slots. Pinning short rows to the same figure is what
          // keeps the last segment the size of a segment.
          const slotBasis = `calc((100% + ${(row.capacity - 1) * NOTCH}px) / ${row.capacity})`;
          // Rows that fill up can keep growing into any rounding slack. Rows that
          // do not — which is every row holding the launch pill, since the pill
          // takes a slot but only its own compact width — must not, or the spare
          // lane width lands in the segments.
          const fixedWidth =
            rowCells.length < row.capacity || rowCells.includes(LAUNCH);

          // A row must clear space on BOTH sides that a turn attaches to: the
          // one it arrives from and the one it leaves by. Turns alternate sides,
          // so the arriving turn is on the right for odd rows and the left for
          // even ones — the mirror of the departing turn.
          const leavesRight = !reversed && !isLastRow;
          const leavesLeft = reversed && !isLastRow;
          const arrivesRight = reversed && rowIndex > 0;
          const arrivesLeft = !reversed && rowIndex > 0;

          return (
            <div
              key={rowIndex}
              className="relative"
              style={{
                height: ROW_H,
                paddingRight: leavesRight || arrivesRight ? TURN_W : 0,
                paddingLeft: leavesLeft || arrivesLeft ? TURN_W : 0,
                // A turn overhangs into the row beneath it, so earlier rows must
                // paint on top.
                zIndex: rows.length - rowIndex,
              }}
            >
              <div className={`flex h-full ${reversed ? "flex-row-reverse" : ""}`}>
                {rowCells.map((cell, cellIndex) => {
                  const first = cellIndex === 0;
                  const last = cellIndex === rowCells.length - 1;

                  if (cell === LAUNCH) {
                    return (
                      <div
                        key={LAUNCH}
                        /* `flex-none`, so the node stays its own compact width
                           rather than stretching across whatever the lane has
                           left — the spare width goes back to the chevrons. No
                           interlocking margin either: it has no notch to fill,
                           and the chevron before it is flattened to meet it
                           flush (see `tail` below). Centred on the band, which
                           is the row's own centreline. */
                        className="flex flex-none items-center"
                        style={{ marginLeft: reversed ? 0 : 10, marginRight: reversed ? 10 : 0 }}
                      >
                        <JourneyEndLaunch
                          unlocked={launchUnlocked}
                          pointsLeft={reversed}
                          height={RIBBON_H}
                          destinationLabel={launchDestination}
                          remaining={remainingSteps}
                          onLaunch={onLaunch}
                        />
                      </div>
                    );
                  }

                  return (
                    <div
                      key={cell.id}
                      className="flex min-w-0"
                      style={{
                        flexGrow: fixedWidth ? 0 : 1,
                        flexShrink: 1,
                        flexBasis: fixedWidth ? slotBasis : 0,
                        // Non-first cells are pulled back so the previous
                        // chevron's point fills their notch.
                        ...(first
                          ? undefined
                          : reversed
                            ? { marginRight: -NOTCH }
                            : { marginLeft: -NOTCH }),
                      }}
                    >
                      <StepSegment
                        step={cell}
                        index={steps.indexOf(cell)}
                        pointsLeft={reversed}
                        // Flatten the edge where the band enters from a turn…
                        head={first && rowIndex > 0}
                        // …and the edge where it leaves into one, or runs into
                        // the launch pad, which is flat-sided and would otherwise
                        // leave the chevron's point sticking out over nothing.
                        tail={(last && !isLastRow) || rowCells[cellIndex + 1] === LAUNCH}
                        selected={selectedId === cell.id}
                        currentUserName={currentUserName}
                        onSelect={onSelect}
                      />
                    </div>
                  );
                })}
              </div>

              {!isLastRow ? <Turn side={reversed ? "left" : "right"} /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
