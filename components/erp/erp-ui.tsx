"use client";

import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, Inbox, LoaderCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Presentation primitives shared by the Blade-era menu groups (Utility, Admin
 * services). They reuse the same Tailwind vocabulary as the existing ERP
 * screens (e.g. Teacher Transfer) so new pages look native to the app — no new
 * design system.
 */

export const erpSelectClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60";

export const erpInputClass = erpSelectClass;

export const erpCardClass = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6";

export function ErpPageHeader({
  title,
  description,
  onRefresh,
  refreshing,
  actions,
}: {
  title: string;
  description: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {actions}
        {onRefresh ? (
          <Button variant="outline" onClick={onRefresh} disabled={refreshing}>
            <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        ) : null}
      </div>
    </header>
  );
}

export function ErpAlert({
  tone,
  children,
}: {
  tone: "error" | "success" | "info";
  children: ReactNode;
}) {
  if (!children) return null;

  const toneClass =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : tone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-amber-200 bg-amber-50 text-amber-900";

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${toneClass}`}
    >
      {tone === "success" ? (
        <CircleCheck className="mt-0.5 size-4 shrink-0" />
      ) : (
        <CircleAlert className="mt-0.5 size-4 shrink-0" />
      )}
      <div className="whitespace-pre-line">{children}</div>
    </div>
  );
}

export function ErpLoading({ label }: { label: string }) {
  return (
    <div className="flex h-32 items-center justify-center text-slate-500">
      <LoaderCircle className="mr-2 size-5 animate-spin" />
      {label}
    </div>
  );
}

export function ErpEmpty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
      <Inbox className="mx-auto mb-2 size-7 text-slate-400" />
      <p className="font-medium text-slate-700">{title}</p>
      {hint ? <p className="mt-1 text-sm text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function ErpSection({
  title,
  description,
  icon,
  children,
  footer,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className={erpCardClass}>
      <div className="mb-5 flex items-start gap-3">
        {icon ? <div className="rounded-xl bg-blue-50 p-2 text-blue-600">{icon}</div> : null}
        <div>
          <h2 className="font-semibold text-slate-900">{title}</h2>
          {description ? <p className="text-sm text-slate-500">{description}</p> : null}
        </div>
      </div>
      {children}
      {footer ? <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div> : null}
    </section>
  );
}
