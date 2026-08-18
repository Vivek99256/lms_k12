"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ErpAlert, ErpEmpty, ErpLoading, ErpPageHeader } from "@/components/erp/erp-ui";
import {
  OnboardingLegend,
  OnboardingPanel,
  ProgressMeter,
} from "./_components/onboarding-ui";
import {
  errorMessage,
  loadOnboardingOverview,
  type OnboardingOverview,
} from "./_lib/onboarding-api";
import { loadMenuMasterItems, type MenuItemRecord } from "./api";

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
  const [menuItems, setMenuItems] = useState<MenuItemRecord[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);

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

  useEffect(() => {
    let active = true;

    (async () => {
      setMenuLoading(true);
      try {
        const items = await loadMenuMasterItems();
        if (active) setMenuItems(items);
      } catch {
        if (active) setMenuItems([]);
      } finally {
        if (active) setMenuLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const summary = overview?.summary;

  const visibleMenuItems = useMemo(() => {
    const term = query.trim().toLowerCase();
    return menuItems.filter((item) => {
      const menuType = item.menu_type.trim().toUpperCase();
      // Exclude REPORT rows from tblmenumaster.
      if (menuType === "REPORT") return false;
      const name = item.name.trim().toLowerCase();
      // Drop validation and integration items from the zigzag.
      if (name.includes("validation") || name.includes("integration")) return false;
      if (!term) return true;
      return (
        item.name.trim().toLowerCase().includes(term) ||
        item.menu_title.trim().toLowerCase().includes(term)
      );
    });
  }, [menuItems, query]);

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <ErpPageHeader
        title="Onboarding"
        description="Work through the setup menu plan for your institute, straight from tblmenumaster. REPORT, validation, and integration items are hidden by default."
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
              <OnboardingLegend currentUserName={overview.context.currentUserName} />
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
              placeholder="Search menu items"
              aria-label="Search menu items"
              className="pl-9"
            />
          </div>

          {menuLoading ? (
            <ErpLoading label="Loading menu plan…" />
          ) : visibleMenuItems.length === 0 ? (
            <ErpEmpty
              title={query ? "No menu items match that search" : "No menu items found"}
              hint={
                query
                  ? "Try a different menu name."
                  : "The menu plan returned no items to set up."
              }
            />
          ) : (
            <div className="relative mx-auto max-w-3xl">
              {/* Centre spine of the zigzag. */}
              <span
                className="pointer-events-none absolute left-1/2 top-0 hidden w-px -translate-x-1/2 bg-gradient-to-b from-violet-200 via-slate-200 to-violet-200 sm:block"
                aria-hidden
                style={{ height: "100%" }}
              />
              <ol className="space-y-6">
                {visibleMenuItems.map((item, index) => {
                  const side: "left" | "right" = index % 2 === 0 ? "left" : "right";
                  const menuType = item.menu_type.trim().toUpperCase();
                  const rawLink = item.link.trim();
                  const isSafeLink =
                    rawLink !== "" &&
                    rawLink !== "#" &&
                    !rawLink.startsWith("javascript:") &&
                    !rawLink.startsWith("void(");
                  const route = isSafeLink ? rawLink.replace(/^\/+/, "") : "#";

                  return (
                    <li
                      key={item.id}
                      className={`flex ${side === "left" ? "sm:justify-start" : "sm:justify-end"}`}
                    >
                      <div className="relative w-full sm:w-[calc(50%-1.25rem)]">
                        {/* Node on the spine. */}
                        <span
                          className="absolute top-1/2 hidden size-3 -translate-y-1/2 rounded-full border-2 border-white bg-violet-500 sm:block"
                          style={{
                            [side === "left" ? "right" : "left"]: "-0.95rem",
                          }}
                          aria-hidden
                        />
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-violet-300 hover:shadow-md">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="font-semibold text-slate-900">{item.name}</h3>
                              <p className="mt-0.5 text-sm text-slate-500">{item.menu_title}</p>
                            </div>
                            <span
                              className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                                menuType === "MASTER"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-emerald-100 text-emerald-700"
                              }`}
                            >
                              {menuType}
                            </span>
                          </div>
                          {isSafeLink && route !== "#" ? (
                            <a
                              href={`/${route}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-violet-700 hover:underline"
                            >
                              Open setup
                              <ArrowRight className="size-3.5" aria-hidden />
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </>
      )}
    </div>
  );
}
