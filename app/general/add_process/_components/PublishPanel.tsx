"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleCheck, CircleX, LoaderCircle, Send, UserCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ErpAlert, ErpSection, erpSelectClass } from "@/components/erp/erp-ui";
import type { TaskDraft } from "@/lib/process";
import {
  loadAssignmentDirectory,
  publishTasks,
  type AssignmentDirectory,
  type PublishReport,
} from "../_lib/task-publisher";

/**
 * Publishing the selected drafts into People & Competency > Task management.
 *
 * The panel exists because the converter cannot know who does the work. It can
 * derive that "someone must confirm the chapter is registered with tagged
 * concepts before the next attempt window" - it cannot know that in this school
 * that is the Science coordinator. So the last step of the conversion is a
 * person naming names, and only then does anything leave this screen.
 *
 * Assignment reuses Task Management's own department -> job role -> employee
 * directory, so the tasks land looking exactly like tasks raised in that module.
 */
export function PublishPanel({
  drafts,
  processLabel,
  disabled,
}: {
  drafts: TaskDraft[];
  processLabel: string;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [directory, setDirectory] = useState<AssignmentDirectory | null>(null);
  const [loading, setLoading] = useState(false);
  const [department, setDepartment] = useState("");
  const [jobRole, setJobRole] = useState("");
  const [assignees, setAssignees] = useState<string[]>([]);
  const [observerId, setObserverId] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [report, setReport] = useState<PublishReport | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setDirectory(await loadAssignmentDirectory());
    } catch (value: unknown) {
      setError(value instanceof Error ? value.message : "The assignment directory could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * The directory is fetched when the panel is opened, not when the page
   * renders. Converting a procedure is not a statement of intent to publish -
   * most sessions will convert, read and save without assigning anything - and
   * loading it eagerly meant every conversion fired a request nobody asked for
   * and surfaced a session error to people who were only reading.
   */
  useEffect(() => {
    if (!open || directory || loading) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [open, directory, loading, load]);

  const departments = useMemo(() => Object.keys(directory?.byDepartment ?? {}).sort(), [directory]);
  const roles = useMemo(() => directory?.byDepartment[department] ?? [], [directory, department]);
  const employees = useMemo(() => roles.find((role) => role.id === jobRole)?.employees ?? [], [roles, jobRole]);

  const selected = drafts.filter((draft) => draft.selected && draft.assignable);
  const departmentId = roles.find((role) => role.id === jobRole)?.departmentId;
  const canPublish = selected.length > 0 && (assignees.length > 0 || Boolean(departmentId)) && Boolean(observerId);

  function toggleAssignee(id: string) {
    setAssignees((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]));
  }

  async function publish() {
    setPublishing(true);
    setError("");
    setReport(null);
    try {
      setReport(
        await publishTasks({
          drafts: selected,
          assignment: { assigneeIds: assignees, observerId, departmentId },
        })
      );
    } catch (value: unknown) {
      setError(value instanceof Error ? value.message : "The tasks could not be published.");
    } finally {
      setPublishing(false);
    }
  }

  if (!open) {
    return (
      <ErpSection
        title="Assign and publish"
        description={`Raise the selected drafts as real tasks in People & Competency > Task management for ${processLabel}.`}
        icon={<UserCheck className="size-5" />}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            {selected.length ? (
              <>
                <span className="font-medium text-slate-900">
                  {selected.length} {selected.length === 1 ? "task is" : "tasks are"} ready to assign.
                </span>{" "}
                Nothing is raised until you choose who does the work.
              </>
            ) : (
              "No tasks are selected yet. Choose some in step 4 first."
            )}
          </p>
          <Button type="button" onClick={() => setOpen(true)} disabled={disabled || !selected.length}>
            <UserCheck className="size-4" />
            Choose assignees
          </Button>
        </div>
      </ErpSection>
    );
  }

  return (
    <ErpSection
      title="Assign and publish"
      description={`Publish the selected drafts into People & Competency > Task management for ${processLabel}.`}
      icon={<UserCheck className="size-5" />}
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={publishing}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void publish()} disabled={disabled || publishing || !canPublish}>
            {publishing ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
            Publish {selected.length} {selected.length === 1 ? "task" : "tasks"}
          </Button>
        </>
      }
    >
      <ErpAlert tone="error">{error}</ErpAlert>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="department">Department *</Label>
          <select
            id="department"
            className={erpSelectClass}
            value={department}
            disabled={disabled || loading}
            onChange={(event) => {
              setDepartment(event.target.value);
              setJobRole("");
              setAssignees([]);
            }}
          >
            <option value="">{loading ? "Loading directory..." : "Select a department"}</option>
            {departments.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="jobRole">Job role *</Label>
          <select
            id="jobRole"
            className={erpSelectClass}
            value={jobRole}
            disabled={disabled || !department}
            onChange={(event) => {
              setJobRole(event.target.value);
              setAssignees([]);
            }}
          >
            <option value="">Select a job role</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label>Assign to</Label>
          {employees.length ? (
            <div className="flex flex-wrap gap-2">
              {employees.map((employee) => {
                const active = assignees.includes(employee.id);
                return (
                  <button
                    key={employee.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleAssignee(employee.id)}
                    className={`rounded-full border px-3 py-1 text-sm transition ${
                      active
                        ? "border-blue-500 bg-blue-500 text-white"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {employee.name}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              {jobRole
                ? "No employees are mapped to this job role. The tasks will be allocated to the department."
                : "Pick a job role to list its employees."}
            </p>
          )}
          <p className="text-xs text-slate-500">
            Every selected task is assigned to the same people. Publish in batches if different tasks belong to
            different owners - the derivation names an owner on each draft.
          </p>
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="observer">Observer *</Label>
          <select
            id="observer"
            className={erpSelectClass}
            value={observerId}
            disabled={disabled || loading}
            onChange={(event) => setObserverId(event.target.value)}
          >
            <option value="">Select who verifies completion</option>
            {(directory?.users ?? []).map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500">
            The observer checks each task against its observation point. For a human gate that is the person
            accountable for the AI output being accepted.
          </p>
        </div>
      </div>

      {report ? (
        <div className="mt-5 rounded-xl border border-slate-200 p-4">
          <p className="text-sm font-medium text-slate-800">
            {report.created} created, {report.failed} failed
          </p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {report.outcomes.map((outcome) => (
              <li key={outcome.key} className="flex items-start gap-2">
                {outcome.ok ? (
                  <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
                ) : (
                  <CircleX className="mt-0.5 size-4 shrink-0 text-red-600" aria-hidden />
                )}
                <span className={outcome.ok ? "text-slate-700" : "text-red-700"}>
                  <span className="font-medium">{outcome.title}</span>
                  {outcome.taskId ? <span className="ml-1 font-mono text-xs text-slate-500">#{outcome.taskId}</span> : null}
                  <span className="ml-1 text-slate-500">- {outcome.message}</span>
                </span>
              </li>
            ))}
          </ul>
          {report.failed ? (
            <p className="mt-2 text-xs text-slate-500">
              Failed tasks can be republished on their own - each create carries an idempotency key, so retrying will
              not double-raise the ones that succeeded.
            </p>
          ) : null}
        </div>
      ) : null}
    </ErpSection>
  );
}
