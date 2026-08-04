"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CircleCheck, ListChecks, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ErpAlert, ErpEmpty, ErpLoading, ErpPageHeader } from "@/components/erp/erp-ui";
import {
  OnboardingLegend,
  OnboardingPanel,
  ProgressMeter,
  StatusBadge,
} from "./_components/onboarding-ui";
import {
  errorMessage,
  loadOnboardingOverview,
  type OnboardingOverview,
} from "./_lib/onboarding-api";

/**
 * Onboarding home — one card per module, each showing derived progress and the
 * next step that is actually outstanding.
 *
 * Replaces the legacy Blade screen at /Onboarding, which rendered every module
 * as a Master/Entry/Report accordion and branched on hardcoded menu ids for the
 * only two modules that had a real flow.
 */
export default function OnboardingPage() {
  const [overview, setOverview] = useState<OnboardingOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError("");

    try {
      setOverview(await loadOnboardingOverview());
    } catch (caught) {
      setError(errorMessage(caught, "Could not load the onboarding overview."));
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const modules = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term || !overview) return overview?.modules ?? [];

    return overview.modules.filter(
      (module) =>
        module.moduleName.toLowerCase().includes(term) ||
        module.description.toLowerCase().includes(term) ||
        module.menuTitle.toLowerCase().includes(term)
    );
  }, [overview, query]);

  const summary = overview?.summary;

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <ErpPageHeader
        title="Onboarding"
        description="Track how far each module has been set up for your institute. Progress is measured from the records in the system, not from a checklist."
        onRefresh={() => void load(true)}
        refreshing={refreshing}
      />

      {error ? <ErpAlert tone="error">{error}</ErpAlert> : null}

      {loading ? (
        <ErpLoading label="Loading onboarding progress…" />
      ) : !overview ? null : (
        <>
          <OnboardingPanel
            title={overview.context.schoolName || "Institute readiness"}
            description={`Academic year ${overview.context.syear || "—"} · ${overview.modules.length
              } modules in scope`}
          >
            <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <ProgressMeter
                percent={summary?.percentComplete ?? 0}
                label="Overall completion"
              />
              <dl className="flex gap-6 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">Steps done</dt>
                  <dd className="font-semibold tabular-nums text-slate-900">
                    {summary?.requiredCompleted ?? 0}
                    <span className="text-slate-400"> / {summary?.requiredSteps ?? 0}</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Modules complete</dt>
                  <dd className="font-semibold tabular-nums text-slate-900">
                    {overview.modules.filter((module) => module.summary.isComplete).length}
                    <span className="text-slate-400"> / {overview.modules.length}</span>
                  </dd>
                </div>
              </dl>
            </div>
            <div className="mt-5 border-t border-slate-100 pt-4">
              <OnboardingLegend />
            </div>
          </OnboardingPanel>

          <div className="relative max-w-sm">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search modules"
              aria-label="Search modules"
              className="pl-9"
            />
          </div>

          {modules.length === 0 ? (
            <ErpEmpty
              title={query ? "No modules match that search" : "No onboarding journeys are configured"}
              hint={
                query
                  ? "Try a different module name."
                  : "Ask your administrator to install the onboarding journey template."
              }
            />
          ) : (
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {modules.map((module) => (
                <li key={module.moduleKey}>
                  <Link
                    href={`/general/onboarding/${module.moduleKey}`}
                    className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-violet-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-slate-900">{module.moduleName}</h3>
                        <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">
                          {module.description}
                        </p>
                      </div>
                      {module.summary.isComplete ? (
                        <CircleCheck className="size-5 shrink-0 text-emerald-500" aria-hidden />
                      ) : (
                        <ListChecks className="size-5 shrink-0 text-slate-300" aria-hidden />
                      )}
                    </div>

                    <div className="mt-4">
                      <ProgressMeter
                        percent={module.summary.percentComplete}
                        label={`${module.summary.requiredCompleted} of ${module.summary.requiredSteps} steps`}
                      />
                    </div>

                    <div className="mt-4 flex items-end justify-between gap-3 border-t border-slate-100 pt-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          {module.nextStep ? "Next up" : "Status"}
                        </p>
                        {module.nextStep ? (
                          <p className="truncate text-sm text-slate-700">
                            {module.nextStep.title}
                          </p>
                        ) : (
                          <StatusBadge status="completed" />
                        )}
                      </div>
                      <ArrowRight
                        className="size-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-violet-600"
                        aria-hidden
                      />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
