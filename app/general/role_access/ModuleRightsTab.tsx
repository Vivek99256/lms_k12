"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Layers, Loader2, Save, Search } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/g2g/accordion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/lib/erp-legacy";
import {
  loadRoleModules,
  saveRoleRights,
  type MenuItem,
  type ModuleNode,
  type RightsChange,
  type Role,
  type Rights,
  type SaveResult,
} from "./api";
import { NO_RIGHTS, PanelHeader, RIGHT_KEYS, Strip, fullKeepingExtras, hasAny, sameRights, withToggle } from "./shared";

type Column = "all" | "some" | "none";

/**
 * One role's rights, module by module, laid out like Organization Management -> Role and
 * Permissions: an accordion of modules, each a table with a checkbox per right at the top of
 * the column and a "Quick select" button per row.
 *
 * Edits are a draft keyed by MENU id, not by row, so a menu several modules list (Visitor
 * Report sits in two) changes everywhere at once and is saved once. Only menus whose rights
 * differ from what the server holds are sent, so a save never touches a menu you did not change.
 */
export function ModuleRightsTab({ role, onSaved }: { role: Role | undefined; onSaved: () => void }) {
  const roleId = role?.id ?? 0;
  const [modules, setModules] = useState<ModuleNode[]>([]);
  const [saved, setSaved] = useState<Record<number, Rights>>({});
  const [draft, setDraft] = useState<Record<number, Rights>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SaveResult | null>(null);
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  const [openGroups, setOpenGroups] = useState<string[]>([]);

  const adminRole = Boolean(role?.protected);

  const load = useCallback(async (id: number) => {
    setError("");
    setResult(null);
    if (!id) {
      setModules([]);
      setSaved({});
      setDraft({});
      return;
    }
    setLoading(true);
    try {
      const data = await loadRoleModules(id);
      const state: Record<number, Rights> = {};
      for (const node of data.modules) {
        if (node.moduleMenuId && node.moduleMenu) state[node.moduleMenuId] = node.moduleMenu.rights;
        for (const tab of node.tabs) for (const item of tab.items) state[item.menuId] = item.rights;
      }
      setModules(data.modules);
      setSaved(state);
      setDraft(state);
      // Open the first module; the rest are one click away.
      setOpenKeys(data.modules[0] ? [data.modules[0].key] : []);
      setOpenGroups(data.modules[0] ? [data.modules[0].group || "Other"] : []);
    } catch (value: unknown) {
      setError(errorMessage(value, "Couldn't load this role's rights. Try again."));
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

  const changed = useMemo(
    () => Object.keys(draft).filter((id) => saved[Number(id)] && !sameRights(draft[Number(id)], saved[Number(id)])).map(Number),
    [draft, saved]
  );

  const setMany = useCallback((items: MenuItem[], update: (current: Rights) => Rights) => {
    setDraft((current) => {
      const out = { ...current };
      for (const item of items) out[item.menuId] = update(current[item.menuId] ?? item.rights);
      return out;
    });
  }, []);

  async function save() {
    if (!roleId || changed.length === 0) return;
    if (
      adminRole &&
      !window.confirm(
        `Change the Admin role?\n\n${changed.length} menu${changed.length === 1 ? "" : "s"} will change for every admin at the school. You can undo it from History.`
      )
    ) {
      return;
    }
    setSaving(true);
    setError("");
    setResult(null);
    try {
      const changes: RightsChange[] = changed.map((id) => ({ menu_id: id, ...draft[id] }));
      const outcome = await saveRoleRights(roleId, changes, note.trim(), adminRole);
      setResult(outcome);
      setNote("");
      await load(roleId);
      setResult(outcome);
      onSaved();
    } catch (value: unknown) {
      setError(errorMessage(value, "Couldn't save these rights. Try again."));
    } finally {
      setSaving(false);
    }
  }

  const term = search.trim().toLowerCase();
  const shown = useMemo(() => {
    if (!term) return modules;
    return modules
      .map((node) => {
        if (node.label.toLowerCase().includes(term) || node.group.toLowerCase().includes(term)) return node;
        const tabs = node.tabs
          .map((tab) => ({ ...tab, items: tab.items.filter((item) => item.name.toLowerCase().includes(term)) }))
          .filter((tab) => tab.items.length > 0);
        return { ...node, tabs };
      })
      .filter((node) => node.tabs.length > 0);
  }, [modules, term]);

  const column = (items: MenuItem[], key: keyof Rights): Column => {
    const on = items.filter((item) => (draft[item.menuId] ?? item.rights)[key]).length;
    return on === 0 ? "none" : on === items.length ? "all" : "some";
  };
  const isFull = (rights: Rights) => rights.view && rights.add && rights.edit && rights.delete;

  const hasChanges = changed.length > 0;
  // The five main sidebar modules, each holding its own modules, in the order they come.
  const groups = useMemo(() => {
    const out: Array<{ name: string; nodes: ModuleNode[] }> = [];
    for (const node of shown) {
      const name = node.group || "Other";
      let group = out.find((entry) => entry.name === name);
      if (!group) {
        group = { name, nodes: [] };
        out.push(group);
      }
      group.nodes.push(node);
    }
    return out;
  }, [shown]);

  const openAll = term ? shown.map((node) => node.key) : openKeys;
  const openGroupNames = term ? groups.map((group) => group.name) : openGroups;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader
        title={role ? `${role.name} Permissions` : "Permissions"}
        description="Rights apply to the live menu tree. View is what puts a screen in this role's sidebar; Add, Edit, Delete, Dashboard and Mobile need View."
        action={
          <Button
            onClick={() => void save()}
            disabled={!hasChanges || saving || !role}
            className={cn(
              "cursor-pointer shadow-sm transition-all duration-300 active:scale-95",
              hasChanges && !saving
                ? "bg-primary text-primary-foreground hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-md"
                : "bg-muted text-muted-foreground"
            )}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {saving ? "Saving..." : hasChanges ? `Save Changes (${changed.length})` : "Saved"}
          </Button>
        }
      />

      <Strip tone="error">{error}</Strip>
      <Strip tone="success">
        {result
          ? [
              result.message,
              result.autoGranted.length > 0 ? `Also granted so the menus show in the sidebar: ${result.autoGranted.map((m) => m.name).join(", ")}.` : "",
              result.rejected.length > 0
                ? `Not changed: ${result.rejected.map((m) => `${m.name ?? `menu ${m.menuId}`} (${m.reason})`).join("; ")}`
                : "",
            ]
              .filter(Boolean)
              .join("\n")
          : ""}
      </Strip>

      {!role ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
          <Layers className="h-12 w-12 opacity-20" />
          <p>Select a role from the list to configure permissions.</p>
        </div>
      ) : loading ? (
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-muted/20 p-6">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-40 animate-pulse rounded-xl border bg-muted/30" />
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
                placeholder="Find a module or menu..."
                aria-label="Find a module or menu"
                className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <input
              type="text"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Why? (optional, kept in History)"
              aria-label="Reason for the change"
              maxLength={255}
              disabled={!hasChanges}
              className="h-9 min-w-[14rem] flex-1 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setOpenGroups(groups.map((group) => group.name));
                setOpenKeys(shown.map((node) => node.key));
              }}
            >
              Expand all
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setOpenGroups([]);
                setOpenKeys([]);
              }}
            >
              Collapse all
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDraft(saved)} disabled={!hasChanges || saving}>
              Discard
            </Button>
          </div>

          {shown.length === 0 ? (
            <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              {term
                ? "Nothing matches that search."
                : "No menus are assigned to this role. A role can only be given menus that are assigned to it."}
            </div>
          ) : (
            <div className="space-y-5">
              {groups.map((group) => {
                const groupItems = group.nodes.flatMap((node) => node.tabs.flatMap((tab) => tab.items));
                const groupGranted = groupItems.filter((item) => hasAny(draft[item.menuId] ?? item.rights)).length;
                const groupOpen = openGroupNames.includes(group.name);

                return (
                  <section key={group.name} className="overflow-hidden rounded-xl border bg-card shadow-sm">
                    <button
                      type="button"
                      aria-expanded={groupOpen}
                      onClick={() =>
                        setOpenGroups((current) =>
                          current.includes(group.name) ? current.filter((name) => name !== group.name) : [...current, group.name]
                        )
                      }
                      className="flex w-full cursor-pointer items-center justify-between gap-4 bg-muted/20 px-6 py-4 text-left transition-colors hover:bg-muted/40"
                    >
                      <div className="flex items-center gap-3">
                        <div className="shrink-0 rounded-md bg-primary/10 p-2">
                          <Layers className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h2 className="text-lg font-bold tracking-tight text-foreground">{group.name}</h2>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {group.nodes.length} module{group.nodes.length === 1 ? "" : "s"} · {groupGranted} of {groupItems.length} screens granted
                          </p>
                        </div>
                      </div>
                      <ChevronDown className={cn("size-5 text-muted-foreground transition-transform", groupOpen && "rotate-180")} />
                    </button>

                    {groupOpen ? (
                      <div className="border-t bg-muted/10 p-4">
            <Accordion
              type="multiple"
              value={openAll}
              onValueChange={(value) => setOpenKeys(Array.isArray(value) ? value : [value])}
              className="space-y-4 border-0"
            >
              {group.nodes.map((node) => {
                const items = node.tabs.flatMap((tab) => tab.items);
                const granted = items.filter((item) => hasAny(draft[item.menuId] ?? item.rights)).length;

                return (
                  <AccordionItem
                    key={node.key}
                    value={node.key}
                    className="overflow-hidden rounded-xl border bg-card px-0 shadow-sm transition-all duration-300 hover:shadow-md data-[state=open]:border-primary/20"
                  >
                    <AccordionTrigger className="group cursor-pointer bg-muted/10 px-6 py-4 transition-colors duration-300 hover:bg-muted/30 hover:no-underline">
                      <div className="flex items-center gap-3 text-left">
                        <div className="shrink-0 rounded-md bg-primary/10 p-2 transition-colors duration-300 group-hover:bg-primary/20">
                          <Layers className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          {node.group ? (
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{node.group}</p>
                          ) : null}
                          <h3 className="text-base font-semibold text-foreground">{node.label}</h3>
                          <p className="mt-0.5 text-xs font-normal text-muted-foreground">
                            {granted} of {items.length} screens granted
                          </p>
                        </div>
                      </div>
                    </AccordionTrigger>

                    <AccordionContent className="p-0 text-foreground">
                      <div className="w-full overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead className="border-y bg-muted/10 text-xs uppercase text-muted-foreground">
                            <tr>
                              <th className="px-6 py-3 font-semibold">Menu / Screen</th>
                              {RIGHT_KEYS.map((r) => {
                                const state = column(items, r.key);
                                return (
                                  <th
                                    key={r.key}
                                    className={cn(
                                      "px-4 py-3 text-center font-semibold",
                                      r.key === "dashboard" ? "w-28 border-l" : "w-24"
                                    )}
                                  >
                                    <div className="flex flex-col items-center gap-2">
                                      <span>{r.label}</span>
                                      <Checkbox
                                        className="cursor-pointer"
                                        aria-label={`${r.label} for every screen in ${node.label}`}
                                        checked={state === "all"}
                                        indeterminate={state === "some"}
                                        onCheckedChange={(on) => setMany(items, (current) => withToggle(current, r.key, !!on))}
                                      />
                                    </div>
                                  </th>
                                );
                              })}
                              <th className="w-32 border-l px-6 py-3 text-right font-semibold">Quick Select</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/50">
                            {node.tabs.map((tab) => (
                              <TabRows
                                key={tab.key}
                                label={tab.label}
                                items={tab.items}
                                draft={draft}
                                saved={saved}
                                isFull={isFull}
                                onChange={(menu, next) => setMany([menu], () => next)}
                                onAll={(on) => setMany(tab.items, (current) => (on ? fullKeepingExtras(current) : NO_RIGHTS))}
                              />
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
                      </div>
                    ) : null}
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

/** One tab of a module: a sub-heading row, then its menus as tree rows. */
function TabRows({
  label,
  items,
  draft,
  saved,
  isFull,
  onChange,
  onAll,
}: {
  label: string;
  items: MenuItem[];
  draft: Record<number, Rights>;
  saved: Record<number, Rights>;
  isFull: (rights: Rights) => boolean;
  onChange: (item: MenuItem, next: Rights) => void;
  onAll: (on: boolean) => void;
}) {
  const allFull = items.every((item) => isFull(draft[item.menuId] ?? item.rights));

  return (
    <>
      <tr className="bg-muted/20">
        <td className="px-6 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground" colSpan={RIGHT_KEYS.length + 1}>
          {label}
        </td>
        <td className="border-l px-6 py-2 text-right">
          <Button variant="ghost" size="sm" onClick={() => onAll(!allFull)} className="h-7 cursor-pointer text-xs hover:bg-primary/10 hover:text-primary">
            {allFull ? "Deselect All" : "Select All"}
          </Button>
        </td>
      </tr>
      {items.map((item, index) => {
        const current = draft[item.menuId] ?? item.rights;
        const dirty = saved[item.menuId] ? !sameRights(current, saved[item.menuId]) : false;
        const full = isFull(current);
        return (
          <tr key={item.menuId} className={cn("transition-colors hover:bg-muted/30", dirty && "bg-amber-50/70")}>
            <td className="px-6 py-3 text-foreground">
              <div className="flex items-center gap-2 pl-5 font-medium">
                <span aria-hidden className="select-none text-muted-foreground/40">
                  {index === items.length - 1 ? "└" : "├"}
                </span>
                <span>{item.name}</span>
                {item.inModules > 1 ? (
                  <span className="text-[11px] font-normal text-muted-foreground" title="The same menu is listed in other modules; a change applies everywhere.">
                    also in {item.inModules - 1} other module{item.inModules - 1 === 1 ? "" : "s"}
                  </span>
                ) : null}
              </div>
            </td>
            {RIGHT_KEYS.map((r) => (
              <td
                key={r.key}
                className={cn(
                  "px-4 py-3 text-center",
                  r.key === "dashboard" && "border-l",
                  (r.key === "dashboard" || r.key === "mobile") && "bg-muted/5"
                )}
              >
                <Checkbox
                  checked={current[r.key]}
                  aria-label={`${r.label} on ${item.name}`}
                  onCheckedChange={(on) => onChange(item, withToggle(current, r.key, !!on))}
                  className="inline-block cursor-pointer transition-transform hover:scale-110 active:scale-95"
                />
              </td>
            ))}
            <td className="border-l px-6 py-3 text-right">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onChange(item, full ? NO_RIGHTS : fullKeepingExtras(current))}
                className="h-7 cursor-pointer text-xs transition-all duration-200 hover:bg-primary/10 hover:text-primary active:scale-95"
              >
                {full ? "Deselect All" : "Select All"}
              </Button>
            </td>
          </tr>
        );
      })}
    </>
  );
}
