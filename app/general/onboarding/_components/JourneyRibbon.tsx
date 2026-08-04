"use client";

import { useEffect, useState } from "react";
import { CHEVRON_FILL, OwnerMarker, STATUS_META } from "./onboarding-ui";
import type { OnboardingStep } from "../_lib/onboarding-api";

/**
 * The serpentine journey ribbon from the reference design.
 *
 * Steps flow left-to-right, turn at the end of a row and continue right-to-left,
 * producing the boustrophedon "snake". Implementation notes:
 *
 *  - Row direction is derived from row parity, and the chevron's clip-path is
 *    swapped (points right / points left) to match — rather than mirroring with
 *    scaleX, which would reverse the label text.
 *  - Each chevron carries both owner markers (the reference shows one above and
 *    one below every segment); the leading owner is the solid one.
 *  - Columns are responsive: 3 on desktop, 2 on tablet. Below `sm` the ribbon
 *    would be unreadable, so it degrades to a vertical stepper — same data, same
 *    interactions, no clip-path.
 */

const CHEVRON_RIGHT =
  "polygon(0% 0%, calc(100% - 20px) 0%, 100% 50%, calc(100% - 20px) 100%, 0% 100%, 20px 50%)";
const CHEVRON_LEFT =
  "polygon(20px 0%, 100% 0%, calc(100% - 20px) 50%, 100% 100%, 20px 100%, 0% 50%)";

function useColumns(): number {
  const [columns, setColumns] = useState(3);

  useEffect(() => {
    const wide = window.matchMedia("(min-width: 1280px)");
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

function StepChevron({
  step,
  index,
  pointsLeft,
  selected,
  onSelect,
}: {
  step: OnboardingStep;
  index: number;
  pointsLeft: boolean;
  selected: boolean;
  onSelect: (step: OnboardingStep) => void;
}) {
  const meta = STATUS_META[step.status] ?? STATUS_META.pending;
  const Icon = meta.icon;

  return (
    <div className="flex flex-col items-center gap-1.5">
      {/* Leading owner sits above the ribbon, as in the reference. */}
      <div className="flex h-9 items-end">
        <OwnerMarker
          owner={step.owner}
          role={step.owner === "TRIZ" ? step.trizRole : step.schoolRole}
          lead
        />
      </div>
      <span className="h-3 w-px bg-slate-300" aria-hidden />

      <button
        type="button"
        onClick={() => onSelect(step)}
        aria-current={selected ? "step" : undefined}
        className={`group relative flex h-20 w-full items-center px-8 text-left transition-all duration-200 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 ${
          CHEVRON_FILL[step.status] ?? CHEVRON_FILL.pending
        } ${selected ? "ring-2 ring-violet-900/30 brightness-110" : ""}`}
        style={{ clipPath: pointsLeft ? CHEVRON_LEFT : CHEVRON_RIGHT }}
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide uppercase opacity-80">
            <span className="tabular-nums">Step {index + 1}</span>
            <Icon className="size-3" aria-hidden />
          </span>
          <span className="mt-0.5 block truncate text-sm font-semibold">{step.title}</span>
          <span className="sr-only">— {meta.label}</span>
        </span>
      </button>

      <span className="h-3 w-px bg-slate-300" aria-hidden />
      {/* Supporting owner below — the counterpart party for the same step. */}
      <div className="flex h-9 items-start">
        <OwnerMarker
          owner={step.owner === "TRIZ" ? "SCHOOL" : "TRIZ"}
          role={step.owner === "TRIZ" ? step.schoolRole : step.trizRole}
        />
      </div>
    </div>
  );
}

/** The rounded elbow that carries the ribbon down into the next row. */
function RowTurn({ side }: { side: "left" | "right" }) {
  return (
    <div className="pointer-events-none flex h-6 items-center" aria-hidden>
      <div
        className={`h-6 w-full border-violet-300 ${
          side === "right"
            ? "ml-auto w-1/3 rounded-br-3xl border-r-4 border-b-4"
            : "mr-auto w-1/3 rounded-bl-3xl border-b-4 border-l-4"
        }`}
      />
    </div>
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
              className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
                selectedId === step.id
                  ? "border-violet-400 bg-violet-50"
                  : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
            >
              <span
                className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  CHEVRON_FILL[step.status] ?? CHEVRON_FILL.pending
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
                  {step.owner === "TRIZ" ? "Triz user" : "School user"}
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

  const rows: OnboardingStep[][] = [];
  for (let index = 0; index < steps.length; index += columns) {
    rows.push(steps.slice(index, index + columns));
  }

  return (
    <div>
      <VerticalStepper steps={steps} selectedId={selectedId} onSelect={onSelect} />

      <div className="hidden sm:block" aria-label="Onboarding journey">
        {rows.map((row, rowIndex) => {
          const reversed = rowIndex % 2 === 1;
          const isLastRow = rowIndex === rows.length - 1;
          const cells = reversed ? [...row].reverse() : row;

          return (
            <div key={rowIndex}>
              <div
                className="grid gap-x-1 gap-y-2"
                style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
              >
                {cells.map((step) => (
                  <StepChevron
                    key={step.id}
                    step={step}
                    index={steps.indexOf(step)}
                    pointsLeft={reversed}
                    selected={selectedId === step.id}
                    onSelect={onSelect}
                  />
                ))}
              </div>

              {!isLastRow ? <RowTurn side={reversed ? "left" : "right"} /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
