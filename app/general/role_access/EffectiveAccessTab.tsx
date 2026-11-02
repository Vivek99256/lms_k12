"use client";

import { useEffect, useMemo, useState } from "react";
import { EyeOff, Loader2, Search, ShieldQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/lib/erp-legacy";
import { loadCoverage, loadEffective, searchUsers, type CoverageMenu, type EffectiveAccess, type UserHit } from "./api";
import { PanelHeader, RightsChips, Strip, scrollBody } from "./shared";

const SOURCE_LABEL: Record<string, { text: string; className: string }> = {
  role: { text: "From the role", className: "bg-primary/10 text-primary" },
  individual: { text: "Individual", className: "bg-violet-50 text-violet-700" },
  both: { text: "Role + individual", className: "bg-sky-50 text-sky-700" },
};

/**
 * "Who can see what": pick a person and see exactly which menus they can open, where each one
 * comes from (their role, an individual override, or both), and which granted menus still do
 * not show because a parent menu is not granted or the menu is not switched on for the school.
 * This works on a person, so it does not use the role chosen on the left.
 */
export function EffectiveAccessTab() {
  const [term, setTerm] = useState("");
  const [hits, setHits] = useState<UserHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [access, setAccess] = useState<EffectiveAccess | null>(null);
  const [loading, setLoading] = useState(false);
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [error, setError] = useState("");
  const [coverage, setCoverage] = useState<{ count: number; menus: CoverageMenu[] } | null>(null);
  const [coverageBusy, setCoverageBusy] = useState(false);

  // Search as the person types, after a short pause, and ignore an answer that arrives late.
  useEffect(() => {
    let live = true;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const found = await searchUsers(term);
        if (live) setHits(found);
      } catch (value: unknown) {
        if (live) setError(errorMessage(value, "Couldn't search users. Try again."));
      } finally {
        if (live) setSearching(false);
      }
    }, 300);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [term]);

  async function pick(user: UserHit) {
    setLoading(true);
    setError("");
    try {
      setAccess(await loadEffective(user.id));
    } catch (value: unknown) {
      setAccess(null);
      setError(errorMessage(value, "Couldn't load this user's access. Try again."));
    } finally {
      setLoading(false);
    }
  }

  async function showCoverage() {
    setCoverageBusy(true);
    try {
      setCoverage(await loadCoverage());
    } catch (value: unknown) {
      setError(errorMessage(value, "Couldn't check menu coverage. Try again."));
    } finally {
      setCoverageBusy(false);
    }
  }

  const modules = useMemo(() => {
    if (!access) return [];
    return access.modules
      .map((node) => ({
        ...node,
        tabs: node.tabs
          .map((tab) => ({ ...tab, items: tab.items.filter((item) => (onlyOpen ? item.source !== "none" : true)) }))
          .filter((tab) => tab.items.length > 0),
      }))
      .filter((node) => node.tabs.length > 0);
  }, [access, onlyOpen]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader
        title="Who can see what"
        description="Pick a person to see which menus they can open, where each right comes from, and which granted menus still do not show."
      />
      <Strip tone="error">{error}</Strip>

      <div className={scrollBody}>
        <section className="rounded-xl border bg-card p-6 shadow-sm">
          <label htmlFor="user-search" className="mb-2 block text-sm font-medium text-foreground">
            Find a user
          </label>
          <div className="relative max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              id="user-search"
              type="text"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Name, email or user name"
              className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-9 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {searching ? <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" /> : null}
          </div>
          {hits.length > 0 ? (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {hits.map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    onClick={() => void pick(user)}
                    className={cn(
                      "w-full cursor-pointer rounded-lg border px-3 py-2 text-left text-sm transition-all hover:bg-muted/60 active:scale-[0.98]",
                      access?.user.id === user.id ? "border-primary/20 bg-primary/10" : "border-border"
                    )}
                  >
                    <div className="font-medium text-foreground">{user.name || user.email}</div>
                    <div className="text-xs text-muted-foreground">
                      {user.role}
                      {user.email ? ` · ${user.email}` : ""}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : !searching ? (
            <p className="mt-3 text-sm text-muted-foreground">No users match that search.</p>
          ) : null}
        </section>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Working out their access...
          </div>
        ) : null}

        {access && !loading ? (
          <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/10 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{access.user.name || access.user.email}</h2>
                <p className="text-sm text-muted-foreground">
                  {access.user.role}
                  {access.user.active ? "" : " · inactive account"}
                </p>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />
                Show only menus they have rights on
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3 border-b p-6 sm:grid-cols-4">
              {[
                { label: "Menus with rights", value: access.stats.menus },
                { label: "Show in the sidebar", value: access.stats.visible },
                { label: "Granted but hidden", value: access.stats.hidden, warn: access.stats.hidden > 0 },
                { label: "Individual overrides", value: access.stats.viaIndividual },
              ].map((stat) => (
                <div key={stat.label} className={cn("rounded-lg border p-3", stat.warn ? "border-amber-200 bg-amber-50" : "bg-muted/10")}>
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{stat.label}</div>
                  <div className="mt-1 text-2xl font-bold text-foreground">{stat.value}</div>
                </div>
              ))}
            </div>

            {modules.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                No menus to show. Untick the filter above to see every menu this role could be given.
              </div>
            ) : (
              <div className="space-y-5 p-6">
                {modules.map((node, index) => (
                  <div key={node.key}>
                    {index === 0 || modules[index - 1].group !== node.group ? (
                      <h2 className="mb-3 mt-2 border-b pb-2 text-lg font-bold tracking-tight text-foreground">{node.group || "Other"}</h2>
                    ) : null}
                    <h3 className="mb-2 text-base font-semibold text-foreground">{node.label}</h3>
                    <div className="overflow-hidden rounded-lg border">
                      {node.tabs.map((tab) => (
                        <div key={tab.key}>
                          <div className="border-b bg-muted/20 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tab.label}</div>
                          <div className="divide-y divide-border/50">
                            {tab.items.map((item) => (
                              <div key={`${tab.key}-${item.menuId}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm hover:bg-muted/30">
                                <span className={cn("min-w-0 flex-1", item.source === "none" ? "text-muted-foreground" : "text-foreground")}>{item.name}</span>
                                {item.source && item.source !== "none" ? (
                                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", SOURCE_LABEL[item.source]?.className)}>
                                    {SOURCE_LABEL[item.source]?.text}
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">no rights</span>
                                )}
                                {item.source !== "none" ? <RightsChips rights={item.rights} /> : null}
                                {item.issue ? (
                                  <span className="flex items-center gap-1 text-xs text-amber-700">
                                    <EyeOff className="size-3.5" />
                                    {item.issue}
                                  </span>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : null}

        <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/10 px-6 py-4">
            <div className="flex items-start gap-3">
              <div className="rounded-md bg-primary/10 p-2">
                <ShieldQuestion className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">Menus nobody can open</h2>
                <p className="text-sm text-muted-foreground">Menus assigned to roles at this school that no role and no user has rights on.</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => void showCoverage()} disabled={coverageBusy}>
              {coverageBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              {coverage ? "Check again" : "Check now"}
            </Button>
          </div>
          <div className="p-6">
            {coverage === null ? (
              <p className="text-sm text-muted-foreground">Press &ldquo;Check now&rdquo; to list them.</p>
            ) : coverage.count === 0 ? (
              <p className="text-sm text-muted-foreground">Every assigned menu is open to at least one role.</p>
            ) : (
              <>
                <p className="mb-3 text-sm text-muted-foreground">
                  {coverage.count} menu{coverage.count === 1 ? "" : "s"}. This is normal for features the school has not switched on; it is worth a look if
                  one of these should be in use.
                </p>
                <div className="max-h-72 overflow-auto rounded-lg border">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 border-b bg-muted/30 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2 font-semibold">Menu / Screen</th>
                        <th className="px-4 py-2 font-semibold">Module</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {coverage.menus.map((menu) => (
                        <tr key={menu.menuId} className="hover:bg-muted/30">
                          <td className="px-4 py-2 text-foreground">{menu.name}</td>
                          <td className="px-4 py-2 text-muted-foreground">{menu.module}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
