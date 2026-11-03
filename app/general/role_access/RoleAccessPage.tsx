"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, ShieldCheck, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/lib/erp-legacy";
import { loadRoles, type Role } from "./api";
import { CopyRightsTab } from "./CopyRightsTab";
import { EffectiveAccessTab } from "./EffectiveAccessTab";
import { HistoryTab } from "./HistoryTab";
import { ModuleRightsTab } from "./ModuleRightsTab";

/**
 * The colour tokens of the Role and Permissions screen. That screen gets a blue primary from its
 * own stylesheet (g2g/globals.css, loaded only under /organization-management); the rest of the
 * app's primary is near-black. Setting them here, on this page's root only, gives this screen the
 * same blue role card, icons, buttons and ticked checkboxes without touching anything else.
 */
const PAGE_THEME = {
  "--primary": "hsl(221 83% 53%)",
  "--primary-foreground": "hsl(0 0% 100%)",
  "--ring": "hsl(221 83% 53%)",
  "--muted": "hsl(210 20% 96%)",
  "--accent": "hsl(210 20% 96%)",
} as React.CSSProperties;

type TabKey = "modules" | "copy" | "effective" | "history";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "modules", label: "Module-wise rights" },
  { key: "copy", label: "Copy rights" },
  { key: "effective", label: "Who can see what" },
  { key: "history", label: "History" },
];

/**
 * Roles & Access.
 *
 * Laid out like Organization Management -> Role and Permissions: the roles in a card on the
 * left, the selected role's permissions in a card on the right. On top of that screen's matrix
 * this adds copying rights from another role, a "who can see what" check for a person, and an
 * undoable history of every change.
 *
 * The role chosen on the left is shared by every tab that works on a role, so switching tab
 * keeps your place.
 */
export function RoleAccessPage() {
  const [tab, setTab] = useState<TabKey>("modules");
  const [roles, setRoles] = useState<Role[]>([]);
  const [roleId, setRoleId] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  // Bumped whenever rights change, so History and the role counts catch up.
  const [version, setVersion] = useState(0);

  const refreshRoles = useCallback(async () => {
    try {
      const list = await loadRoles();
      setRoles(list);
      // Open on the first role, the way the Role and Permissions screen does.
      setRoleId((current) => (current && list.some((role) => role.id === current) ? current : (list[0]?.id ?? 0)));
      setError("");
    } catch (value: unknown) {
      setError(errorMessage(value, "Couldn't load the roles. Try again."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Browser storage holds the ERP session, so this runs after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshRoles();
  }, [refreshRoles]);

  const changed = useCallback(() => {
    setVersion((current) => current + 1);
    void refreshRoles();
  }, [refreshRoles]);

  const filteredRoles = useMemo(
    () => roles.filter((role) => role.name.toLowerCase().includes(search.trim().toLowerCase())),
    [roles, search]
  );
  const activeRole = roles.find((role) => role.id === roleId);

  return (
    <div style={PAGE_THEME} className="flex h-[calc(100vh-4rem)] min-h-[34rem] w-full gap-6 overflow-hidden p-6 md:p-8">
      {/* Left: the roles */}
      <aside className="flex w-80 shrink-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex h-[104px] shrink-0 flex-col justify-center gap-3 border-b bg-muted/20 px-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Access Roles
          </h2>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search roles..."
              aria-label="Search roles"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto p-2">
          {loading ? (
            <div className="space-y-2 p-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-14 animate-pulse rounded-lg bg-muted/40" />
              ))}
            </div>
          ) : filteredRoles.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No roles found.</div>
          ) : (
            filteredRoles.map((role) => (
              <button
                key={role.id}
                type="button"
                onClick={() => setRoleId(role.id)}
                className={cn(
                  "flex w-full cursor-pointer flex-col gap-1 rounded-lg border px-3 py-3 text-left transition-all duration-300 active:scale-[0.98]",
                  roleId === role.id
                    ? "border-primary/20 bg-primary/10 shadow-sm"
                    : "border-transparent hover:bg-muted/60 hover:shadow-sm"
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <span className={cn("text-sm font-medium", roleId === role.id ? "font-semibold text-primary" : "text-foreground")}>
                    {role.name}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" /> {role.users}
                  </span>
                </div>
                <span className="line-clamp-1 text-xs text-muted-foreground">
                  {role.protected ? "Admin role · " : ""}
                  {role.menusGranted} of {role.menusAssignable} menus granted
                </span>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Right: what the selected role can do */}
      <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex shrink-0 flex-wrap gap-1 border-b bg-muted/10 px-4 pt-3" role="tablist" aria-label="Roles and access views">
          {TABS.map((entry) => (
            <button
              key={entry.key}
              type="button"
              role="tab"
              aria-selected={tab === entry.key}
              onClick={() => setTab(entry.key)}
              className={cn(
                "-mb-px cursor-pointer rounded-t-lg border border-b-0 px-4 py-2 text-sm font-medium transition-colors",
                tab === entry.key
                  ? "border-border bg-card text-primary"
                  : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>

        {error ? (
          <div className="shrink-0 border-b border-destructive/20 bg-destructive/5 px-6 py-3 text-sm text-destructive">{error}</div>
        ) : null}

        {loading ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Loading roles...</div>
        ) : tab === "modules" ? (
          <ModuleRightsTab role={activeRole} onSaved={changed} />
        ) : tab === "copy" ? (
          <CopyRightsTab roles={roles} target={activeRole} onApplied={changed} />
        ) : tab === "effective" ? (
          <EffectiveAccessTab />
        ) : (
          <HistoryTab roles={roles} role={activeRole} refreshKey={version} onUndone={changed} />
        )}
      </section>
    </div>
  );
}
