"use client";

import { useState } from "react";
import { ArrowRight, Copy, Eye, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/lib/erp-legacy";
import { applyCopy, previewCopy, type CopyMode, type CopyPreview, type Role, type SaveResult } from "./api";
import { PanelHeader, RightsChips, RoleSelect, Strip, scrollBody } from "./shared";

const MODES: Array<{ key: CopyMode; title: string; text: string }> = [
  {
    key: "merge",
    title: "Add what is missing",
    text: "The role keeps everything it has and also gains whatever the source has. Nothing is taken away.",
  },
  {
    key: "replace",
    title: "Make it match",
    text: "The role ends up with exactly the source's rights. Menus the source does not have are removed from it.",
  },
];

/**
 * Copy one role's rights onto the role selected on the left, with a preview of every menu that
 * would change.
 *
 * The preview and the apply are computed by the same server code, and nothing is written until
 * "Apply" is pressed. Applying records one change in History, so it can be undone.
 */
export function CopyRightsTab({ roles, target, onApplied }: { roles: Role[]; target: Role | undefined; onApplied: () => void }) {
  const [sourceId, setSourceId] = useState(0);
  const [mode, setMode] = useState<CopyMode>("merge");
  const [preview, setPreview] = useState<CopyPreview | null>(null);
  const [result, setResult] = useState<SaveResult | null>(null);
  const [busy, setBusy] = useState<"preview" | "apply" | null>(null);
  const [error, setError] = useState("");

  const targetId = target?.id ?? 0;
  const ready = targetId > 0 && sourceId > 0 && sourceId !== targetId;

  function reset() {
    setPreview(null);
    setResult(null);
    setError("");
  }

  async function runPreview() {
    setBusy("preview");
    setError("");
    setResult(null);
    try {
      setPreview(await previewCopy(targetId, sourceId, mode));
    } catch (value: unknown) {
      setPreview(null);
      setError(errorMessage(value, "Couldn't compare these roles. Try again."));
    } finally {
      setBusy(null);
    }
  }

  async function runApply() {
    if (!preview || preview.differences === 0) return;
    const ok = window.confirm(
      `Change ${preview.differences} menu${preview.differences === 1 ? "" : "s"} for "${preview.target.name}" using "${preview.source.name}"?` +
        (target?.protected ? "\n\nThis is an Admin role: the change applies to every admin at the school." : "") +
        "\n\nYou can undo this from History."
    );
    if (!ok) return;

    setBusy("apply");
    setError("");
    try {
      const outcome = await applyCopy(targetId, sourceId, mode, Boolean(target?.protected));
      setResult(outcome.result);
      setPreview(null);
      onApplied();
    } catch (value: unknown) {
      setError(errorMessage(value, "Couldn't copy these rights. Try again."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader
        title="Copy rights"
        description="Set a role up quickly by starting from one that already has the right access. You see every change before anything is saved."
      />
      <Strip tone="error">{error}</Strip>
      <Strip tone="success">{result ? `${result.message} It is in History if you need to undo it.` : ""}</Strip>

      {!target ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
          <ShieldCheck className="h-12 w-12 opacity-20" />
          <p>Select the role to change from the list on the left.</p>
        </div>
      ) : (
        <div className={scrollBody}>
          <section className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
              <div className="space-y-2">
                <Label htmlFor="copy-source">Copy from</Label>
                <RoleSelect
                  id="copy-source"
                  roles={roles}
                  value={sourceId}
                  exclude={targetId}
                  placeholder="Select the role to copy from"
                  onChange={(id) => {
                    setSourceId(id);
                    reset();
                  }}
                />
              </div>
              <ArrowRight className="mx-auto hidden size-5 text-muted-foreground sm:mb-3 sm:block" />
              <div className="space-y-2">
                <Label>Copy to</Label>
                <div className="flex h-11 items-center rounded-xl border bg-muted/30 px-3 text-sm font-medium text-foreground">
                  {target.name}
                  {target.protected ? <span className="ml-2 text-xs font-normal text-muted-foreground">(admin role)</span> : null}
                </div>
                <p className="text-xs text-muted-foreground">Change this by choosing another role on the left.</p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {MODES.map((option) => (
                <label
                  key={option.key}
                  className={cn(
                    "cursor-pointer rounded-xl border p-3 text-sm transition",
                    mode === option.key ? "border-primary/40 bg-primary/5" : "hover:border-muted-foreground/30"
                  )}
                >
                  <div className="flex items-center gap-2 font-semibold text-foreground">
                    <input
                      type="radio"
                      name="copy-mode"
                      className="accent-[var(--primary)]"
                      checked={mode === option.key}
                      onChange={() => {
                        setMode(option.key);
                        reset();
                      }}
                    />
                    {option.title}
                  </div>
                  <p className="mt-1 text-muted-foreground">{option.text}</p>
                </label>
              ))}
            </div>

            {target.protected ? (
              <p className="mt-3 text-sm text-amber-700">
                The target is an Admin role. Copying onto it changes what every admin can open, and you will be asked to confirm.
              </p>
            ) : null}

            <div className="mt-5 flex justify-end">
              <Button onClick={() => void runPreview()} disabled={!ready || busy !== null}>
                {busy === "preview" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
                Preview changes
              </Button>
            </div>
          </section>

          {preview ? (
            <section className="rounded-xl border bg-card shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/10 px-6 py-4">
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    {preview.source.name} → {preview.target.name}
                  </h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {preview.differences === 0
                      ? "These two roles already match for the menus the target can be given."
                      : `${preview.granting} menu${preview.granting === 1 ? "" : "s"} would be granted, ${preview.revoking} removed, ${
                          preview.differences - preview.granting - preview.revoking
                        } adjusted.`}
                  </p>
                </div>
                <Button onClick={() => void runApply()} disabled={preview.differences === 0 || busy !== null}>
                  {busy === "apply" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}
                  Apply {preview.differences} change{preview.differences === 1 ? "" : "s"}
                </Button>
              </div>

              {preview.notAssignable > 0 ? (
                <p className="border-b bg-muted/20 px-6 py-2 text-sm text-muted-foreground">
                  {preview.notAssignable} menu{preview.notAssignable === 1 ? " the source has is" : "s the source has are"} not assigned to{" "}
                  {preview.target.name}, so {preview.notAssignable === 1 ? "it" : "they"} will be skipped.
                </p>
              ) : null}

              {preview.differences === 0 ? (
                <div className="p-10 text-center text-sm text-muted-foreground">Nothing to change.</div>
              ) : (
                <div className="max-h-[28rem] overflow-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 border-b bg-muted/30 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-6 py-3 font-semibold">Menu / Screen</th>
                        <th className="px-4 py-3 font-semibold">Now</th>
                        <th className="px-1 py-3" />
                        <th className="px-4 py-3 font-semibold">After</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {preview.changes.map((change) => (
                        <tr key={change.menuId} className="hover:bg-muted/30">
                          <td className="px-6 py-2.5 text-foreground">{change.name}</td>
                          <td className="px-4 py-2.5">
                            <RightsChips rights={change.before} />
                          </td>
                          <td className="px-1 py-2.5 text-muted-foreground/50">
                            <ArrowRight className="size-3.5" />
                          </td>
                          <td className="px-4 py-2.5">
                            <RightsChips rights={change.after} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {preview.differences > preview.changes.length ? (
                <p className="border-t px-6 py-2 text-xs text-muted-foreground">
                  Showing the first {preview.changes.length} of {preview.differences}.
                </p>
              ) : null}
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
