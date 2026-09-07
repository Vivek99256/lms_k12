"use client";

import { Check, CircleDot, LoaderCircle, Save, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ProcessSpec, ProcessStatus } from "@/lib/process";

/**
 * The toolbar's own select styling.
 *
 * Not `erpSelectClass`: that one carries `w-full`, which is right for a form
 * field in a grid cell and wrong for a control sitting in a toolbar row.
 * Appending `w-auto` does not undo it — Tailwind resolves same-specificity
 * utilities by their order in the generated stylesheet, not by the order they
 * appear in the class attribute — so the select stretched to the full row and
 * pushed the buttons onto a second line. Sized explicitly instead.
 */
const toolbarSelectClass =
  "h-9 shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60";

/**
 * The sticky spine of the conversion.
 *
 * Converting a procedure produces five stacked sections and roughly three
 * screens of scroll. Without this bar the shape of the work is invisible: you
 * cannot see how far you are, the Save and Publish buttons sit below
 * everything, and nothing tells you that edits made to the task list have not
 * been written down yet. All three are how people lose work on long forms.
 *
 * So the bar carries exactly the things you need continuously rather than at
 * one moment: what you are converting, where you are in it, whether it is
 * saved, and the two actions that commit anything. Everything else stays in
 * the sections where it belongs.
 */

export interface ToolbarStep {
  id: string;
  label: string;
  /** Short state line, e.g. "7 steps" or "8 of 12 selected". */
  detail: string;
  done: boolean;
}

export const SECTION_IDS = {
  source: "process-source",
  process: "process-record",
  workflow: "process-workflow",
  tasks: "process-tasks",
  publish: "process-publish",
} as const;

export function ProcessToolbar({
  spec,
  steps,
  status,
  onStatusChange,
  dirty,
  saving,
  busy,
  onSave,
  onJump,
  selectedTaskCount,
}: {
  spec: ProcessSpec;
  steps: ToolbarStep[];
  status: ProcessStatus;
  onStatusChange: (next: ProcessStatus) => void;
  dirty: boolean;
  saving: boolean;
  busy: boolean;
  onSave: () => void;
  onJump: (sectionId: string) => void;
  selectedTaskCount: number;
}) {
  return (
    <div className="sticky top-0 z-30 -mx-4 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* min-w-0 lets the title truncate; the actions never give up space. */}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-xs font-semibold text-white">
              {spec.ref}
            </span>
            <h2 className="truncate text-sm font-semibold text-slate-900">{spec.title}</h2>
            {dirty ? (
              <span className="flex shrink-0 items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                <CircleDot className="size-3" aria-hidden />
                Unsaved changes
              </span>
            ) : (
              <span className="flex shrink-0 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                <Check className="size-3" aria-hidden />
                Saved
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {spec.module} &middot; {spec.lifecycleStage} &middot; {spec.workflow.steps.length} steps &middot;{" "}
            {selectedTaskCount} of {spec.tasks.length} tasks selected
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <label className="sr-only" htmlFor="toolbarStatus">
            Process status
          </label>
          <select
            id="toolbarStatus"
            className={toolbarSelectClass}
            value={status}
            disabled={busy}
            onChange={(event) => onStatusChange(event.target.value as ProcessStatus)}
          >
            <option value="draft">Draft</option>
            <option value="in_review">In review</option>
            <option value="approved">Approved</option>
            <option value="published">Published</option>
          </select>

          <Button type="button" size="sm" onClick={onSave} disabled={busy || !dirty}>
            {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
            {dirty ? "Save process" : "Saved"}
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onJump(SECTION_IDS.publish)}
            disabled={busy || !selectedTaskCount}
          >
            <Send className="size-4" />
            Assign &amp; publish
          </Button>
        </div>
      </div>

      {/* Step rail. Buttons, not links: this scrolls within the page rather
          than navigating, and a hash would strand the browser's back button. */}
      <nav aria-label="Conversion steps" className="mt-3 flex gap-1 overflow-x-auto pb-0.5">
        {steps.map((step, index) => (
          <button
            key={step.id}
            type="button"
            onClick={() => onJump(step.id)}
            className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-1.5 text-left transition ${
              step.done
                ? "border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50"
                : "border-dashed border-slate-200 bg-slate-50 hover:border-slate-300"
            }`}
          >
            <span
              className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                step.done ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"
              }`}
              aria-hidden
            >
              {step.done ? <Check className="size-3" /> : index + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-medium text-slate-800">{step.label}</span>
              <span className="block text-[11px] text-slate-500">{step.detail}</span>
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}
