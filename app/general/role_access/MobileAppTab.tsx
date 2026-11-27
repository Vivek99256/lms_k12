"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Save, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/lib/erp-legacy";
import { loadMobileModules, saveMobileModules, type MobileModules, type Role } from "./api";
import { PanelHeader, Strip } from "./shared";

/**
 * Mobile app: the native app screens this role can open. Ticking a module here is what makes it
 * appear in the app's menu for everyone with this role; unticking removes it. The app picks the
 * change up the next time it opens or comes back to the foreground.
 */
export function MobileAppTab({ role, onSaved }: { role: Role | undefined; onSaved: () => void }) {
  const roleId = role?.id ?? 0;
  const [data, setData] = useState<MobileModules | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const adminRole = Boolean(role?.protected);

  const load = useCallback(async (id: number) => {
    setError("");
    setMessage("");
    if (!id) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      const next = await loadMobileModules(id);
      const on = new Set(next.groups.flatMap((group) => group.modules.filter((module) => module.enabled).map((module) => module.key)));
      setData(next);
      setSaved(on);
      setDraft(new Set(on));
    } catch (value: unknown) {
      setError(errorMessage(value, "Couldn't load this role's mobile modules. Try again."));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Browser storage holds the ERP session, so loading runs after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(roleId);
  }, [roleId, load]);

  const added = useMemo(() => [...draft].filter((key) => !saved.has(key)).length, [draft, saved]);
  const removed = useMemo(() => [...saved].filter((key) => !draft.has(key)).length, [draft, saved]);
  const hasChanges = added + removed > 0;

  function toggle(key: string, on: boolean) {
    setDraft((current) => {
      const next = new Set(current);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function setGroup(keys: string[], on: boolean) {
    setDraft((current) => {
      const next = new Set(current);
      for (const key of keys) {
        if (on) next.add(key);
        else next.delete(key);
      }
      return next;
    });
  }

  async function save() {
    if (!roleId || !hasChanges) return;
    if (adminRole && !window.confirm("Change the Admin role?\n\nThe app menu changes for every admin at the school.")) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const text = await saveMobileModules(roleId, [...draft], adminRole);
      await load(roleId);
      setMessage(text);
      onSaved();
    } catch (value: unknown) {
      setError(errorMessage(value, "Couldn't save the mobile modules. Try again."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader
        title={role ? `${role.name} · Mobile app` : "Mobile app"}
        description={
          data?.audience === "student"
            ? "The screens students and parents can open in the app. Only ticked modules appear in their menu."
            : "The screens this role can open in the app. Only ticked modules appear in their menu."
        }
        action={
          <Button
            onClick={() => void save()}
            disabled={!hasChanges || saving || !role}
            className={cn("cursor-pointer shadow-sm", hasChanges && !saving ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {saving ? "Saving..." : hasChanges ? `Save Changes (+${added} −${removed})` : "Saved"}
          </Button>
        }
      />
      <Strip tone="error">{error}</Strip>
      <Strip tone="success">{message}</Strip>

      {!role ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
          <Smartphone className="h-12 w-12 opacity-20" />
          <p>Select a role from the list to choose its mobile modules.</p>
        </div>
      ) : loading || !data ? (
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-muted/20 p-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-xl border bg-muted/30" />
          ))}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto bg-muted/20 p-6">
          <div className="mb-4 flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>
              <strong className="text-foreground">{draft.size}</strong> of {data.total} modules on
            </span>
            <Button variant="ghost" size="sm" onClick={() => setDraft(new Set(saved))} disabled={!hasChanges || saving}>
              Discard
            </Button>
          </div>
          <div className="space-y-3">
            {data.groups.map((group) => {
              const keys = group.modules.map((module) => module.key);
              const on = keys.filter((key) => draft.has(key)).length;
              return (
                <section key={group.title} className="rounded-xl border bg-card p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-foreground">{group.title}</h3>
                      <p className="text-xs text-muted-foreground">
                        {on} of {keys.length} on
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setGroup(keys, true)}>
                        Select all
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setGroup(keys, false)}>
                        Clear
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {group.modules.map((module) => {
                      const dirty = draft.has(module.key) !== saved.has(module.key);
                      return (
                        <label
                          key={module.key}
                          className={cn(
                            "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted/40",
                            dirty && "border-amber-300 bg-amber-50/70"
                          )}
                        >
                          <Checkbox
                            checked={draft.has(module.key)}
                            aria-label={`${module.title} in the mobile app`}
                            onCheckedChange={(value) => toggle(module.key, !!value)}
                          />
                          <span className={cn(!draft.has(module.key) && "text-muted-foreground")}>{module.title}</span>
                        </label>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
