"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, ChevronDown, ChevronRight, History as HistoryIcon, Loader2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/lib/erp-legacy";
import { loadHistory, loadHistoryDetail, undoBatch, type HistoryBatch, type HistoryEntry, type Role } from "./api";
import { PanelHeader, RightsChips, Strip, formatWhen, scrollBody } from "./shared";

const KIND: Record<HistoryBatch["kind"], { label: string; className: string }> = {
  manual: { label: "Edited", className: "bg-primary/10 text-primary" },
  copy: { label: "Copied", className: "bg-sky-50 text-sky-700" },
  undo: { label: "Undone", className: "bg-muted text-muted-foreground" },
};

/**
 * Every change to a role's rights: who made it, when, and what each menu went from and to.
 * A change can be undone; a menu changed again since is left alone and reported, so an undo
 * can never erase a newer decision.
 *
 * Shows the role selected on the left; "Show all roles" lifts that filter.
 */
export function HistoryTab({
  roles,
  role,
  refreshKey,
  onUndone,
}: {
  roles: Role[];
  role: Role | undefined;
  refreshKey: number;
  onUndone: () => void;
}) {
  const [allRoles, setAllRoles] = useState(false);
  const [batches, setBatches] = useState<HistoryBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, HistoryEntry[]>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const filterId = allRoles ? 0 : (role?.id ?? 0);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setBatches(await loadHistory(filterId || undefined));
    } catch (value: unknown) {
      setError(errorMessage(value, "Couldn't load the history. Try again."));
      setBatches([]);
    } finally {
      setLoading(false);
    }
  }, [filterId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load, refreshKey]);

  async function toggle(batchId: string) {
    if (open === batchId) {
      setOpen(null);
      return;
    }
    setOpen(batchId);
    if (detail[batchId]) return;
    try {
      const entries = await loadHistoryDetail(batchId);
      setDetail((current) => ({ ...current, [batchId]: entries }));
    } catch (value: unknown) {
      setError(errorMessage(value, "Couldn't load that change. Try again."));
    }
  }

  async function undo(batch: HistoryBatch) {
    const adminRole = roles.find((entry) => entry.id === batch.roleId)?.protected ?? false;
    const ok = window.confirm(
      `Undo this change to "${batch.role}"?` +
        (adminRole ? "\n\nThis is an Admin role: it applies to every admin at the school." : "") +
        "\n\nMenus changed again since are left as they are."
    );
    if (!ok) return;

    setBusy(batch.batchId);
    setError("");
    setNotice("");
    try {
      const result = await undoBatch(batch.batchId, adminRole);
      setNotice(
        result.skipped.length > 0
          ? `${result.message}\nLeft as they are: ${result.skipped.map((s) => `${s.name} (${s.reason})`).join("; ")}`
          : result.message
      );
      setDetail((current) => {
        const next = { ...current };
        delete next[batch.batchId];
        return next;
      });
      await load();
      onUndone();
    } catch (value: unknown) {
      setError(errorMessage(value, "Couldn't undo that change. Try again."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader
        title={filterId && role ? `${role.name} history` : "Change history"}
        description="Who changed which role's rights, when, and what changed. Undo puts a change back."
        action={
          role ? (
            <Button variant="outline" size="sm" onClick={() => setAllRoles((current) => !current)}>
              {allRoles ? `Show only ${role.name}` : "Show all roles"}
            </Button>
          ) : null
        }
      />
      <Strip tone="error">{error}</Strip>
      <Strip tone="success">{notice}</Strip>

      <div className={scrollBody}>
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading history...
          </div>
        ) : batches.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">
            <HistoryIcon className="mx-auto mb-2 h-7 w-7 opacity-40" />
            No changes recorded yet. Changes made from this screen from now on will be listed here.
          </div>
        ) : (
          batches.map((batch) => {
            const isOpen = open === batch.batchId;
            return (
              <div key={batch.batchId} className="overflow-hidden rounded-xl border bg-card shadow-sm">
                <div className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
                    onClick={() => void toggle(batch.batchId)}
                    aria-expanded={isOpen}
                  >
                    {isOpen ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", KIND[batch.kind].className)}>{KIND[batch.kind].label}</span>
                    <span className="truncate font-medium text-foreground">{batch.role || `Role ${batch.roleId}`}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {batch.menus} menu{batch.menus === 1 ? "" : "s"}
                    </span>
                  </button>
                  <div className="text-right text-xs text-muted-foreground">
                    <div>{formatWhen(batch.at)}</div>
                    <div>{batch.actor || "Unknown"}</div>
                  </div>
                  {batch.undoable ? (
                    <Button size="sm" variant="outline" onClick={() => void undo(batch)} disabled={busy !== null}>
                      {busy === batch.batchId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Undo2 className="mr-2 h-4 w-4" />}
                      Undo
                    </Button>
                  ) : null}
                </div>
                {batch.note ? <p className="border-t bg-muted/10 px-5 py-2 text-sm text-muted-foreground">{batch.note}</p> : null}
                {isOpen ? (
                  <div className="border-t">
                    {!detail[batch.batchId] ? (
                      <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
                      </div>
                    ) : (
                      <table className="w-full text-left text-sm">
                        <thead className="border-b bg-muted/10 text-xs uppercase text-muted-foreground">
                          <tr>
                            <th className="px-5 py-2 font-semibold">Menu / Screen</th>
                            <th className="px-3 py-2 font-semibold">Before</th>
                            <th className="px-1 py-2" />
                            <th className="px-3 py-2 font-semibold">After</th>
                            <th className="px-3 py-2" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                          {detail[batch.batchId].map((entry) => (
                            <tr key={entry.menuId} className="hover:bg-muted/30">
                              <td className="px-5 py-2 text-foreground">
                                {entry.name}
                                {entry.source === "ancestor" ? <span className="ml-2 text-[11px] text-muted-foreground">parent, granted automatically</span> : null}
                              </td>
                              <td className="px-3 py-2">
                                <RightsChips rights={entry.before} />
                              </td>
                              <td className="px-1 py-2 text-muted-foreground/50">
                                <ArrowRight className="size-3.5" />
                              </td>
                              <td className="px-3 py-2">
                                <RightsChips rights={entry.after} />
                              </td>
                              <td className="px-3 py-2 text-xs text-muted-foreground">{entry.undone ? "undone" : ""}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
