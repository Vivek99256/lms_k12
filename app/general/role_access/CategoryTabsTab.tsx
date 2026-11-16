"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Layers, Loader2, Save, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/lib/erp-legacy";
import { loadRoleCategories, saveRoleCategories, type CategoryChange, type CategoryModule, type Role } from "./api";
import { PanelHeader, Strip } from "./shared";

const keyOf = (module: string, tab: string) => `${module}|${tab}`;

/**
 * The tabs along the top of each module (Operations, Reports, Intelligence, Onboarding, Process
 * Builder, Workflow, Audit Trail, Knowledge Graph ...). They are not menus, so the module-wise
 * rights table cannot reach them; this tick-list does. A ticked tab is visible to the role.
 */
export function CategoryTabsTab({ role, onSaved }: { role: Role | undefined; onSaved: () => void }) {
  const roleId = role?.id ?? 0;
  const [modules, setModules] = useState<CategoryModule[]>([]);
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const adminRole = Boolean(role?.protected);

  const load = useCallback(async (id: number) => {
    setError("");
    setMessage("");
    if (!id) {
      setModules([]);
      setSaved({});
      setDraft({});
      return;
    }
    setLoading(true);
    try {
      const list = await loadRoleCategories(id);
      const state: Record<string, boolean> = {};
      for (const node of list) for (const tab of node.tabs) state[keyOf(node.module, tab.key)] = tab.visible;
      setModules(list);
      setSaved(state);
      setDraft(state);
    } catch (value: unknown) {
      setError(errorMessage(value, "Couldn't load this role's module tabs. Try again."));
      setModules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Browser storage holds the ERP session, so loading runs after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(roleId);
  }, [roleId, load]);

  const changes = useMemo<CategoryChange[]>(() => {
    const out: CategoryChange[] = [];
    for (const node of modules) {
      for (const tab of node.tabs) {
        const key = keyOf(node.module, tab.key);
        if (draft[key] !== saved[key]) out.push({ module: node.module, category_key: tab.key, visible: draft[key] });
      }
    }
    return out;
  }, [modules, draft, saved]);

  const term = search.trim().toLowerCase();
  const shown = useMemo(
    () =>
      term
        ? modules.filter((node) => node.label.toLowerCase().includes(term) || node.tabs.some((tab) => tab.label.toLowerCase().includes(term)))
        : modules,
    [modules, term]
  );

  function setModule(node: CategoryModule, on: boolean) {
    setDraft((current) => {
      const out = { ...current };
      for (const tab of node.tabs) out[keyOf(node.module, tab.key)] = on;
      return out;
    });
  }

  async function save() {
    if (!roleId || changes.length === 0) return;
    if (
      adminRole &&
      !window.confirm(`Change the Admin role?\n\n${changes.length} tab${changes.length === 1 ? "" : "s"} will change for every admin at the school.`)
    ) {
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const text = await saveRoleCategories(roleId, changes, adminRole);
      await load(roleId);
      setMessage(text);
      onSaved();
    } catch (value: unknown) {
      setError(errorMessage(value, "Couldn't save these tabs. Try again."));
    } finally {
      setSaving(false);
    }
  }

  const hasChanges = changes.length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader
        title={role ? `${role.name} · Module tabs` : "Module tabs"}
        description="The tabs along the top of each module. Untick a tab to hide it from this role; every tab is visible until you change it. Menus inside a tab are still controlled in Module-wise rights."
        action={
          <Button
            onClick={() => void save()}
            disabled={!hasChanges || saving || !role}
            className={cn("cursor-pointer shadow-sm", hasChanges && !saving ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {saving ? "Saving..." : hasChanges ? `Save Changes (${changes.length})` : "Saved"}
          </Button>
        }
      />
      <Strip tone="error">{error}</Strip>
      <Strip tone="success">{message}</Strip>

      {!role ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
          <Layers className="h-12 w-12 opacity-20" />
          <p>Select a role from the list to configure its module tabs.</p>
        </div>
      ) : loading ? (
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-muted/20 p-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-xl border bg-muted/30" />
          ))}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto bg-muted/20 p-6">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[16rem] flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Find a module or tab..."
                aria-label="Find a module or tab"
                className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <Button variant="ghost" size="sm" onClick={() => setDraft(saved)} disabled={!hasChanges || saving}>
              Discard
            </Button>
          </div>

          {shown.length === 0 ? (
            <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              {term ? "Nothing matches that search." : "No module tabs are configured."}
            </div>
          ) : (
            <div className="space-y-3">
              {shown.map((node) => {
                const on = node.tabs.filter((tab) => draft[keyOf(node.module, tab.key)]).length;
                return (
                  <section key={node.module} className="rounded-xl border bg-card p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-foreground">{node.label}</h3>
                        <p className="text-xs text-muted-foreground">
                          {on} of {node.tabs.length} tabs visible
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setModule(node, true)}>
                          Show all
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setModule(node, false)}>
                          Hide all
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {node.tabs.map((tab) => {
                        const key = keyOf(node.module, tab.key);
                        const dirty = draft[key] !== saved[key];
                        return (
                          <label
                            key={key}
                            className={cn(
                              "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted/40",
                              dirty && "border-amber-300 bg-amber-50/70"
                            )}
                          >
                            <Checkbox
                              checked={Boolean(draft[key])}
                              aria-label={`${tab.label} in ${node.label}`}
                              onCheckedChange={(value) => setDraft((current) => ({ ...current, [key]: !!value }))}
                            />
                            <span className={cn(!draft[key] && "text-muted-foreground line-through")}>{tab.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
