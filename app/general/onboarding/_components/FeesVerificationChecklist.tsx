"use client";

import Link from "next/link";
import { Check, LoaderCircle, RotateCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressMeter } from "./onboarding-ui";
import type { FeesVerificationStatus } from "@/app/fees/_lib/fees-verification";

/**
 * Live verification checklist for the Fees "Verify the Fees data" step.
 *
 * The ticks are derived, never clicked: each line reflects whether that report
 * currently returns rows, resolved by `getVerificationStatus()`. A line that
 * could not be read is shown as pending with its reason rather than silently
 * counted as done, so the totals never overstate how far the school has got.
 */
export function FeesVerificationChecklist({
  status,
  loading,
  error,
  onRefresh,
}: {
  status: FeesVerificationStatus | null;
  loading: boolean;
  error: string;
  onRefresh: () => void;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900">Verify Fees data</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            A report is ticked once it returns records for this academic year. Open any
            report to reconcile it against the school&apos;s own registers.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onRefresh}
          disabled={loading}
          aria-label="Re-check verification status"
        >
          {loading ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <RotateCw className="size-4" />
          )}
        </Button>
      </div>

      {status ? (
        <div className="mb-4 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2.5">
          <p className="text-sm font-semibold text-slate-800 tabular-nums">
            {status.completedCount} / {status.items.length} reports verified
          </p>
          <div className="mt-2">
            <ProgressMeter
              percent={status.completionPercentage}
              label={
                status.isComplete
                  ? "All reports verified"
                  : `${status.pendingCount} report${status.pendingCount === 1 ? "" : "s"} pending`
              }
            />
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="mb-3 flex items-start gap-1.5 text-xs text-amber-700">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}

      <ul className="space-y-2">
        {(status?.items ?? []).map((item) => (
          <li key={item.key} className="flex items-start gap-2 text-sm">
            {/* A derived state, so this is a status icon rather than a checkbox —
                it is deliberately not clickable: ticking it by hand would claim
                data the reports do not show. */}
            <span
              role="img"
              aria-label={item.verified ? "Verified" : "Pending"}
              className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border ${
                item.verified
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-slate-300 bg-white"
              }`}
            >
              {item.verified ? <Check className="size-3" aria-hidden /> : null}
            </span>
            <span className="min-w-0">
              <Link
                href={item.href}
                className={`underline-offset-2 hover:underline ${
                  item.verified ? "text-slate-500" : "text-indigo-700"
                }`}
              >
                {item.label}
              </Link>
              {item.error ? (
                <span className="block text-xs text-amber-700">{item.error}</span>
              ) : !item.verified && !loading ? (
                <span className="block text-xs text-slate-400">No records found yet</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>

      {loading && !status ? (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
          <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
          Checking reports…
        </p>
      ) : null}
    </section>
  );
}
