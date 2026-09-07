"use client";

import { useState, type ReactNode } from "react";
import { AlertTriangle, Bot, CircleCheck, GraduationCap, Info, ShieldCheck, User } from "lucide-react";

import {
  ACTOR_LABELS,
  TASK_ORIGIN_LABELS,
  type ActorMode,
  type ExecutionMode,
  type ParseIssue,
  type TaskDraft,
} from "@/lib/process";

/**
 * Presentation atoms shared by the four conversion steps.
 *
 * The actor is the single most important thing on any of these screens - it
 * decides whether a step is somebody's work, whether a human gate is mandatory
 * and whether a task can be assigned at all - so it gets a consistent colour
 * and icon everywhere it appears, and never carries meaning by colour alone
 * (icon + label always present, per the design system's accessibility rules).
 */

const ACTOR_STYLES: Record<ActorMode, { className: string; Icon: typeof User }> = {
  teacher: { className: "border-blue-200 bg-blue-50 text-blue-700", Icon: User },
  ai: { className: "border-violet-200 bg-violet-50 text-violet-700", Icon: Bot },
  teacher_ai: { className: "border-amber-200 bg-amber-50 text-amber-800", Icon: ShieldCheck },
  student: { className: "border-emerald-200 bg-emerald-50 text-emerald-700", Icon: GraduationCap },
  student_ai: { className: "border-teal-200 bg-teal-50 text-teal-700", Icon: GraduationCap },
};

export function ActorBadge({ actor, className = "" }: { actor: ActorMode; className?: string }) {
  const { className: tone, Icon } = ACTOR_STYLES[actor];
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${tone} ${className}`}
    >
      <Icon className="size-3" aria-hidden />
      {ACTOR_LABELS[actor]}
    </span>
  );
}

const EXECUTION_LABELS: Record<ExecutionMode, string> = {
  manual: "Performed by a person",
  system: "Runs unattended",
  human_in_the_loop: "AI proposes, human applies",
  learner: "Performed by the learner",
};

export function ExecutionLabel({ execution }: { execution: ExecutionMode }) {
  return <span className="text-xs text-slate-500">{EXECUTION_LABELS[execution]}</span>;
}

/**
 * A business-rule citation that can be read without leaving the page.
 *
 * The rule text matters — "BR-04" alone tells a reviewer nothing — but it is
 * too long to inline in a table cell. A `title` attribute was the first
 * attempt and it is not good enough: it never appears for keyboard or touch
 * users. This opens on hover *and* on focus, so the rule is reachable however
 * you are driving the page.
 */
export function RuleChip({ id, title }: { id: string; title?: string }) {
  const [open, setOpen] = useState(false);

  if (!title) {
    return (
      <span className="inline-flex items-center rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] text-slate-600">
        {id}
      </span>
    );
  }

  return (
    <span className="relative inline-block">
      <button
        type="button"
        aria-expanded={open}
        aria-label={`${id}: ${title}`}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex cursor-help items-center rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] text-slate-600 transition hover:border-slate-400 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
      >
        {id}
      </button>
      {open ? (
        <span
          role="tooltip"
          className="absolute bottom-full left-0 z-50 mb-1.5 block w-64 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-left text-xs font-normal leading-5 text-slate-700 shadow-lg"
        >
          <span className="font-mono font-semibold text-slate-900">{id}</span> {title}
        </span>
      ) : null}
    </span>
  );
}

const ORIGIN_STYLES: Record<TaskDraft["origin"], string> = {
  precondition: "border-blue-200 bg-blue-50 text-blue-700",
  step: "border-slate-200 bg-slate-50 text-slate-700",
  gate: "border-amber-200 bg-amber-50 text-amber-800",
  output: "border-indigo-200 bg-indigo-50 text-indigo-700",
  learner_activity: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

export function OriginBadge({ origin }: { origin: TaskDraft["origin"] }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${ORIGIN_STYLES[origin]}`}
    >
      {TASK_ORIGIN_LABELS[origin]}
    </span>
  );
}

/**
 * Conversion issues. Errors and warnings are visually distinct because they
 * mean different things: an error is the converter refusing to guess, a warning
 * is the SOP itself being incomplete - and the second is the reviewer's problem
 * to fix in the document, not a bug to work around here.
 */
export function IssueList({ issues }: { issues: ParseIssue[] }) {
  if (!issues.length) return null;

  const errors = issues.filter((issue) => issue.level === "error");
  const warnings = issues.filter((issue) => issue.level === "warning");

  return (
    <div className="space-y-2">
      {errors.length ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="flex items-center gap-1.5 text-sm font-medium text-red-800">
            <AlertTriangle className="size-4" aria-hidden />
            {errors.length} {errors.length === 1 ? "error" : "errors"} - these must be fixed in the source text
          </p>
          <ul className="mt-1.5 list-disc space-y-1 pl-6 text-sm text-red-700">
            {errors.map((issue, index) => (
              <li key={`${issue.field}-${index}`}>{issue.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {warnings.length ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="flex items-center gap-1.5 text-sm font-medium text-amber-900">
            <Info className="size-4" aria-hidden />
            {warnings.length} {warnings.length === 1 ? "gap" : "gaps"} found against the SOP standard
          </p>
          <ul className="mt-1.5 list-disc space-y-1 pl-6 text-sm text-amber-800">
            {warnings.map((issue, index) => (
              <li key={`${issue.field}-${index}`}>{issue.message}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function CleanBill({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
      <CircleCheck className="size-4 shrink-0" aria-hidden />
      {children}
    </p>
  );
}

/** Label / value pair used across the process attribute card. */
export function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-b border-slate-100 py-3 last:border-0 sm:grid sm:grid-cols-[200px_1fr] sm:gap-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-700 sm:mt-0">{children || <span className="text-slate-400">Not stated</span>}</dd>
    </div>
  );
}

export function BulletList({ items }: { items: string[] }) {
  if (!items.length) return <span className="text-slate-400">Not stated</span>;
  return (
    <ul className="list-disc space-y-1 pl-4">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}
