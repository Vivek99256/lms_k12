"use client";

import type { ReactNode } from "react";
import {
  Ban,
  CircleCheck,
  CircleDashed,
  CircleDot,
  SkipForward,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { StepOwner, StepStatus } from "../_lib/onboarding-api";

/**
 * Presentation tokens for the onboarding journey.
 *
 * Deliberately expressed in the same Tailwind vocabulary the rest of the app
 * already uses (slate borders, rounded-2xl cards, white surfaces — see
 * components/erp/erp-ui.tsx). The ribbon uses the indigo/violet brand ramp the
 * design system already declares as `--action-primary` rather than introducing
 * a new hue.
 *
 * Status is never carried by colour alone: every state pairs a hue with a
 * distinct icon and a text label, per the design system's accessibility rule.
 */

export const STATUS_META: Record<
  StepStatus,
  { label: string; icon: typeof CircleCheck; badge: string; dot: string }
> = {
  completed: {
    label: "Completed",
    icon: CircleCheck,
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
  },
  in_progress: {
    label: "In progress",
    icon: CircleDot,
    badge: "border-indigo-200 bg-indigo-50 text-indigo-700",
    dot: "bg-indigo-500",
  },
  pending: {
    label: "Not started",
    icon: CircleDashed,
    badge: "border-slate-200 bg-slate-50 text-slate-600",
    dot: "bg-slate-300",
  },
  skipped: {
    label: "Skipped",
    icon: SkipForward,
    badge: "border-slate-200 bg-slate-100 text-slate-600",
    dot: "bg-slate-400",
  },
  blocked: {
    label: "Blocked",
    icon: Ban,
    badge: "border-rose-200 bg-rose-50 text-rose-700",
    dot: "bg-rose-500",
  },
  misconfigured: {
    label: "Needs attention",
    icon: TriangleAlert,
    badge: "border-amber-200 bg-amber-50 text-amber-800",
    dot: "bg-amber-500",
  },
};

/** Fill applied to a ribbon chevron for each status. */
export const CHEVRON_FILL: Record<StepStatus, string> = {
  completed: "bg-violet-600 text-white",
  in_progress: "bg-violet-500 text-white",
  pending: "bg-violet-300 text-violet-950",
  skipped: "bg-slate-300 text-slate-700",
  blocked: "bg-rose-500 text-white",
  misconfigured: "bg-amber-400 text-amber-950",
};

export const OWNER_META: Record<StepOwner, { label: string; ring: string; text: string }> = {
  TRIZ: {
    label: "Triz user",
    ring: "border-sky-500 bg-sky-50 text-sky-700",
    text: "text-sky-700",
  },
  SCHOOL: {
    label: "School user",
    ring: "border-orange-400 bg-orange-50 text-orange-700",
    text: "text-orange-700",
  },
};

export function StatusBadge({ status }: { status: StepStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.pending;
  const Icon = meta.icon;

  return (
    <Badge variant="outline" className={`gap-1 ${meta.badge}`}>
      <Icon className="size-3" aria-hidden />
      {meta.label}
    </Badge>
  );
}

/**
 * The owner marker from the reference design — the small ringed avatar that
 * sits above or below each chevron. `lead` renders the owner that drives the
 * step; the other side is shown muted so both parties stay visible.
 */
export function OwnerMarker({
  owner,
  role,
  lead,
}: {
  owner: StepOwner;
  role?: string;
  lead?: boolean;
}) {
  const meta = OWNER_META[owner];
  const initials = owner === "TRIZ" ? "TZ" : "SC";

  return (
    <span className="flex items-center gap-1.5">
      <span
        className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-semibold ${meta.ring} ${
          lead ? "" : "opacity-60"
        }`}
        aria-hidden
      >
        {initials}
      </span>
      <span className={`text-[11px] leading-tight ${lead ? meta.text : "text-slate-400"}`}>
        <span className="font-medium">{meta.label}</span>
        {role ? <span className="block text-slate-400">{role}</span> : null}
      </span>
    </span>
  );
}

/** Compact percentage meter used on module cards and the journey header. */
export function ProgressMeter({
  percent,
  label,
  tone = "brand",
}: {
  percent: number;
  label?: string;
  tone?: "brand" | "neutral";
}) {
  const safe = Math.max(0, Math.min(100, Math.round(percent)));

  return (
    <div className="w-full">
      {label ? (
        <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
          <span>{label}</span>
          <span className="font-semibold tabular-nums text-slate-700">{safe}%</span>
        </div>
      ) : null}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuenow={safe}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Onboarding progress"}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${
            tone === "brand" ? "bg-violet-600" : "bg-slate-400"
          }`}
          style={{ width: `${safe}%` }}
        />
      </div>
    </div>
  );
}

export function OnboardingLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
      <OwnerMarker owner="TRIZ" lead />
      <OwnerMarker owner="SCHOOL" lead />
      <span className="h-4 w-px bg-slate-200" aria-hidden />
      {(["completed", "in_progress", "pending", "misconfigured"] as StepStatus[]).map((status) => (
        <span key={status} className="flex items-center gap-1.5">
          <span className={`size-2.5 rounded-full ${STATUS_META[status].dot}`} aria-hidden />
          {STATUS_META[status].label}
        </span>
      ))}
    </div>
  );
}

export function OnboardingPanel({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-semibold text-slate-900">{title}</h2>
          {description ? <p className="mt-0.5 text-sm text-slate-500">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
