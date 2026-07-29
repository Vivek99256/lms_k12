import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Local stand-in for `StatCard` from `@platform/components-core`.
 *
 * The design-system packages (`@platform/tokens-core`, `@platform/components-core`)
 * are not merged into this repo yet — they are absent from package.json,
 * package-lock.json and node_modules. This component exists so the Fees
 * dashboard can run today against the real API.
 *
 * The prop surface is deliberately identical to the DS StatCard, so when the
 * package lands the migration is a single import swap in
 * `app/fees/_components/fees-dashboard.tsx`:
 *
 *   - import { StatCard } from "@/components/ui/stat-card";
 *   + import { StatCard } from "@platform/components-core";
 */
export interface StatCardProps extends Omit<React.ComponentProps<"div">, "children"> {
  label: string
  value: string | number
  /** Optional supporting line under the value (e.g. the scoped month). */
  hint?: string
}

export function StatCard({ label, value, hint, className, ...props }: StatCardProps) {
  return (
    <div
      data-slot="stat-card"
      className={cn(
        "rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm",
        className
      )}
      {...props}
    >
      <div className="text-xs font-medium tracking-wide text-slate-500 uppercase">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-slate-900 tabular-nums">
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </div>
  )
}
