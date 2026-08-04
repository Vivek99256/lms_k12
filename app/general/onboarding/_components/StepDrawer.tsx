"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Ban,
  Database,
  FileText,
  LoaderCircle,
  Play,
  SkipForward,
  TriangleAlert,
  X,
  MonitorPlay,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { erpSelectClass } from "@/components/erp/erp-ui";
import { mapApiLinkToRoute } from "@/app/data/routeMapper";
import { OwnerMarker, StatusBadge } from "./onboarding-ui";
import type {
  OnboardingStep,
  OnboardingUser,
  StepStatus,
  StepUpdate,
} from "../_lib/onboarding-api";

/**
 * Detail surface for one journey step.
 *
 * Renders as a right-hand drawer on desktop and a full-height sheet on mobile.
 * The controls offered depend on how the step proves completion:
 *
 *  - `table_rows` steps cannot be marked complete by hand — the API rejects it —
 *    so the primary action deep-links to the screen where the records are
 *    actually created, and the panel explains what the system is looking for.
 *  - `manual` steps have no table to inspect, so an explicit, attributed
 *    sign-off is the only possible evidence and the control is offered.
 */
export function StepDrawer({
  step,
  stepNumber,
  saving,
  users,
  onClose,
  onSave,
}: {
  step: OnboardingStep | null;
  stepNumber: number;
  saving: boolean;
  /** Live staff list for this institute — never a static list. */
  users: OnboardingUser[];
  onClose: () => void;
  onSave: (stepId: number, update: StepUpdate) => Promise<void>;
}) {
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setNotes(step?.state.notes ?? "");
  }, [step?.id, step?.state.notes]);

  useEffect(() => {
    if (!step) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, onClose]);

  if (!step) return null;

  const derived = step.proof.type === "table_rows";
  const target = step.action.route ? mapApiLinkToRoute(step.action.route) : "";
  const canNavigate = Boolean(target) && target !== "#";
  const notesChanged = notes.trim() !== (step.state.notes ?? "").trim();

  const setStatus = (status: StepStatus) =>
    onSave(step.id, { status, notes: notes.trim() });

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/20" onClick={onClose} aria-hidden />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Step ${stepNumber}: ${step.title}`}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 p-5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Step {stepNumber}
            </p>
            <h2 className="mt-0.5 text-lg font-semibold text-slate-900">{step.title}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={step.status} />
              {!step.isRequired ? (
                <span className="text-xs text-slate-500">Optional</span>
              ) : null}
            </div>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close step details">
            <X className="size-4" />
          </Button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {step.description ? (
            <p className="text-sm leading-relaxed text-slate-600">{step.description}</p>
          ) : null}

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Who does this
            </p>
            <div className="flex flex-col gap-3">
              <OwnerMarker
                owner={step.owner}
                role={step.owner === "TRIZ" ? step.trizRole : step.schoolRole}
                lead
              />
              <OwnerMarker
                owner={step.owner === "TRIZ" ? "SCHOOL" : "TRIZ"}
                role={step.owner === "TRIZ" ? step.schoolRole : step.trizRole}
              />
            </div>
          </div>

          {/* How this step proves itself — the transparency the legacy screen lacked. */}
          <div
            className={`rounded-xl border p-4 ${step.status === "misconfigured"
                ? "border-amber-200 bg-amber-50"
                : "border-slate-200 bg-white"
              }`}
          >
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {step.status === "misconfigured" ? (
                <TriangleAlert className="size-3.5 text-amber-600" aria-hidden />
              ) : (
                <Database className="size-3.5" aria-hidden />
              )}
              How completion is measured
            </p>

            {derived ? (
              <div className="space-y-1.5 text-sm text-slate-600">
                <p>
                  Completed automatically once at least{" "}
                  <strong className="text-slate-900">{step.proof.minRows}</strong>{" "}
                  {step.proof.minRows === 1 ? "record exists" : "records exist"} in{" "}
                  <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs text-slate-700">
                    {step.proof.table}
                  </code>
                  {step.proof.scope === "tenant_year"
                    ? " for this institute and academic year."
                    : " for this institute."}
                </p>
                {step.proof.reason ? (
                  <p
                    className={
                      step.status === "misconfigured" ? "text-amber-800" : "text-slate-500"
                    }
                  >
                    {step.proof.reason}
                  </p>
                ) : (
                  <p className="text-emerald-700">
                    Found {step.proof.atLeast ? "at least " : ""}
                    {step.proof.rowCount} matching{" "}
                    {step.proof.rowCount === 1 ? "record" : "records"}.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-600">
                This step has no records to check, so it is completed by an explicit sign-off
                from the person who did the work.
              </p>
            )}
          </div>

          {(step.action.youtubeLink || step.action.pdfLink) && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Training material
              </p>
              <div className="flex flex-wrap gap-2">
                {step.action.youtubeLink ? (
                  <a
                    href={step.action.youtubeLink}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    <MonitorPlay className="size-4 text-rose-600" aria-hidden />
                    Watch walkthrough
                  </a>
                ) : null}
                {step.action.pdfLink ? (
                  <a
                    href={step.action.pdfLink}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    <FileText className="size-4 text-slate-500" aria-hidden />
                    Open guide
                  </a>
                ) : null}
              </div>
            </div>
          )}

          <div>
            <Label
              htmlFor={`step-assignee-${step.id}`}
              className="text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Assigned to
            </Label>
            {/* Options come straight from `tbluser` for this institute — the
                list is whatever staff the school actually has. */}
            <select
              id={`step-assignee-${step.id}`}
              value={step.state.assignedToId ? String(step.state.assignedToId) : ""}
              disabled={saving || users.length === 0}
              onChange={(event) => {
                const id = Number(event.target.value);
                const picked = users.find((user) => user.id === id);
                void onSave(step.id, {
                  assignedToId: picked ? picked.id : 0,
                  assignedToName: picked ? picked.name : "",
                });
              }}
              className={`mt-1.5 ${erpSelectClass}`}
            >
              <option value="">
                {users.length === 0 ? "No staff records found" : "Unassigned"}
              </option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                  {user.profileName ? ` — ${user.profileName}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor={`step-notes-${step.id}`} className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Notes
            </Label>
            <Textarea
              id={`step-notes-${step.id}`}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              maxLength={5000}
              placeholder="Record what was agreed, who was trained, or why this step is blocked."
              className="mt-1.5"
            />
            {step.state.updatedByName ? (
              <p className="mt-1.5 text-xs text-slate-400">
                Last updated by {step.state.updatedByName}
                {step.state.updatedAt ? ` on ${step.state.updatedAt}` : ""}
              </p>
            ) : null}
          </div>
        </div>

        <footer className="space-y-2 border-t border-slate-200 p-5">
          {canNavigate ? (
            <Link href={target} className={buttonVariants({ size: "lg", className: "w-full" })}>
              Open {step.proof.table ? "setup screen" : "module"}
              <ArrowUpRight className="size-4" />
            </Link>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {!derived && step.status !== "completed" ? (
              <Button
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={() => setStatus("completed")}
              >
                {saving ? (
                  <LoaderCircle className="size-3.5 animate-spin" />
                ) : (
                  <Play className="size-3.5" />
                )}
                Mark complete
              </Button>
            ) : null}

            {step.status !== "in_progress" && step.status !== "completed" ? (
              <Button
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={() => setStatus("in_progress")}
              >
                Start
              </Button>
            ) : null}

            {step.status !== "skipped" ? (
              <Button
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={() => setStatus("skipped")}
              >
                <SkipForward className="size-3.5" />
                Not applicable
              </Button>
            ) : null}

            {step.status !== "blocked" ? (
              <Button
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={() => setStatus("blocked")}
              >
                <Ban className="size-3.5" />
                Blocked
              </Button>
            ) : null}

            {notesChanged ? (
              <Button
                size="sm"
                disabled={saving}
                onClick={() => onSave(step.id, { notes: notes.trim() })}
              >
                {saving ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
                Save notes
              </Button>
            ) : null}
          </div>

          {derived ? (
            <p className="text-xs text-slate-400">
              This step completes on its own once the records exist — it cannot be ticked
              manually.
            </p>
          ) : null}
        </footer>
      </aside>
    </>
  );
}
