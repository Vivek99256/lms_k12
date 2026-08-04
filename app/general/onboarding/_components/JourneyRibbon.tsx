"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { RIBBON_FILL, RIBBON_TURN_COLOR, STATUS_META } from "./onboarding-ui";
import type { OnboardingStep, StepOwner } from "../_lib/onboarding-api";

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
 * Below `sm` the ribbon cannot stay legible, so it degrades to a vertical
 * stepper — same data, same interactions, no clip-path.
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

/** The ringed avatar that sits on a hairline above or below the band. */
function Marker({ owner, above }: { owner: StepOwner; above: boolean }) {
  const triz = owner === "TRIZ";
  const label = triz ? "scholar admin" : "School admin";

  const dot = (
    <span
      title={label}
      className={`flex size-7 shrink-0 items-center justify-center rounded-full border-2 bg-white ${triz ? "border-sky-500 text-sky-600" : "border-orange-500 text-orange-500"
        }`}
    >
      {triz ? <Users className="size-3.5" aria-hidden /> : null}
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
      ) : (
        <>
          {line}
          {dot}
        </>
      )}
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
  onSelect,
}: {
  step: OnboardingStep;
  index: number;
  pointsLeft: boolean;
  head: boolean;
  tail: boolean;
  selected: boolean;
  onSelect: (step: OnboardingStep) => void;
}) {
  const meta = STATUS_META[step.status] ?? STATUS_META.pending;
  const Icon = meta.icon;
  const other: StepOwner = step.owner === "TRIZ" ? "SCHOOL" : "TRIZ";

  return (
    <div className="relative flex min-w-0 flex-1 flex-col items-center">
      <Marker owner={step.owner} above />

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

      <Marker owner={other} above={false} />
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
  onSelect,
}: {
  steps: OnboardingStep[];
  selectedId: number | null;
  onSelect: (step: OnboardingStep) => void;
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
                  {step.owner === "TRIZ" ? "scholar admin" : "School admin"}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function JourneyRibbon({
  steps,
  selectedId,
  onSelect,
}: {
  steps: OnboardingStep[];
  selectedId: number | null;
  onSelect: (step: OnboardingStep) => void;
}) {
  const columns = useColumns();

  if (steps.length === 0) return null;

  // A middle row loses width to a turn on BOTH sides, so it carries one segment
  // fewer than the first and last rows. With 8 steps at 3 columns this yields the
  // reference layout: 3, 2, 3.
  const rows: OnboardingStep[][] = [];
  for (let index = 0; index < steps.length;) {
    const isFirstRow = rows.length === 0;
    const remaining = steps.length - index;
    const capacity =
      isFirstRow || remaining <= columns ? columns : Math.max(1, columns - 1);

    rows.push(steps.slice(index, index + capacity));
    index += capacity;
  }

  return (
    <div>
      <VerticalStepper steps={steps} selectedId={selectedId} onSelect={onSelect} />

      <div className="relative hidden sm:block" aria-label="Onboarding journey">
        {rows.map((row, rowIndex) => {
          const reversed = rowIndex % 2 === 1;
          const isLastRow = rowIndex === rows.length - 1;
          // `flex-row-reverse` already lays DOM order out right-to-left, so the
          // array must stay in flow order — reversing it too would run the row
          // backwards.
          const cells = row;

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
                {cells.map((step, cellIndex) => {
                  const first = cellIndex === 0;
                  const last = cellIndex === cells.length - 1;

                  return (
                    <div
                      key={step.id}
                      className="flex min-w-0 flex-1"
                      style={
                        first
                          ? undefined
                          : reversed
                            ? { marginRight: -NOTCH }
                            : { marginLeft: -NOTCH }
                      }
                    >
                      <StepSegment
                        step={step}
                        index={steps.indexOf(step)}
                        pointsLeft={reversed}
                        // Flatten the edge where the band enters from a turn…
                        head={first && rowIndex > 0}
                        // …and the edge where it leaves into one.
                        tail={last && !isLastRow}
                        selected={selectedId === step.id}
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
