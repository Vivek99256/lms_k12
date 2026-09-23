"use client";

import { useMemo } from "react";
import { CheckCheck, Info, ListChecks, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ErpSection, erpInputClass, erpSelectClass } from "@/components/erp/erp-ui";
import {
  TASK_ORIGIN_LABELS,
  dueDateFor,
  unmappedSteps,
  type ProcessSpec,
  type TaskDraft,
  type TaskPriority,
} from "@/lib/process";
import { ActorBadge, OriginBadge, RuleChip } from "./process-ui";

/**
 * Step 4 - the Tasks.
 *
 * The screen has to earn one thing: explain why the tasks are not simply the
 * steps. For 6.9.4 that is stark - none of its seven steps belongs to a member
 * of staff, so a step-per-task conversion would produce nothing to assign,
 * while the procedure obviously does create teacher obligations. Those come
 * from its preconditions, from BR-07's requirement that a person owns whatever
 * the engine computes, and from the handovers it declares.
 *
 * So each draft shows where it came from, and the steps that produced no task
 * are listed too. A reviewer should be able to see the coverage, not take it on
 * trust.
 */

const PRIORITIES: TaskPriority[] = ["High", "Medium", "Low"];

const ORIGIN_ORDER: Array<TaskDraft["origin"]> = ["precondition", "gate", "step", "output", "learner_activity"];

const ORIGIN_RATIONALE: Record<TaskDraft["origin"], string> = {
  precondition:
    "Master data and configuration the procedure depends on. Until these hold, the process cannot run at all.",
  gate:
    "The engine performs these steps unattended, and the SOP gives the AI ownership of no record - so a named person verifies the output and logs the acceptance (6.15.6, BR-07).",
  step: "Steps whose actor is Teacher or Teacher + AI. Directly assignable work inside the procedure.",
  output: "Where this procedure hands over. Raised so nothing it produces is left unactioned.",
  learner_activity:
    "Steps the learner performs. Recorded for completeness and delivered by the PAL workspace itself - Task Management assigns to staff, so these are never published.",
};

export function StepTasks({
  spec,
  tasks,
  onTaskChange,
  onBulkSelect,
  publishFrom,
  disabled,
}: {
  spec: ProcessSpec;
  tasks: TaskDraft[];
  onTaskChange: (key: string, next: Partial<TaskDraft>) => void;
  /** Set `selected` on many drafts at once; `keys` null means every assignable draft. */
  onBulkSelect: (keys: string[] | null, selected: boolean) => void;
  publishFrom: Date;
  disabled: boolean;
}) {
  const grouped = useMemo(
    () =>
      ORIGIN_ORDER.map((origin) => ({
        origin,
        drafts: tasks.filter((task) => task.origin === origin),
      })).filter((group) => group.drafts.length),
    [tasks]
  );

  const gaps = useMemo(() => unmappedSteps(spec, tasks), [spec, tasks]);
  const selected = tasks.filter((task) => task.selected);
  const assignable = tasks.filter((task) => task.assignable);

  /** What publishing right now would actually create. */
  const summary = useMemo(() => {
    const byPriority = { High: 0, Medium: 0, Low: 0 } as Record<TaskPriority, number>;
    for (const task of selected) byPriority[task.priority] += 1;
    const dates = selected.map((task) => dueDateFor(task, publishFrom)).sort();
    return { byPriority, earliest: dates[0], latest: dates[dates.length - 1] };
  }, [selected, publishFrom]);

  return (
    <ErpSection
      title="4. Tasks"
      description={`${tasks.length} drafts derived from the process; ${selected.length} selected for Task management.`}
      icon={<ListChecks className="size-5" />}
    >
      {/* Selection summary. What is about to be created, before you scroll
          through twelve cards to work it out. */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="text-sm text-slate-700">
          {selected.length ? (
            <>
              <span className="font-medium text-slate-900">
                {selected.length} {selected.length === 1 ? "task" : "tasks"}
              </span>{" "}
              will be created
              <span className="text-slate-500">
                {" "}
                &mdash; {summary.byPriority.High} high, {summary.byPriority.Medium} medium, {summary.byPriority.Low} low
                {summary.earliest ? `, due ${summary.earliest}` : ""}
                {summary.latest && summary.latest !== summary.earliest ? ` to ${summary.latest}` : ""}
              </span>
            </>
          ) : (
            <span className="text-slate-500">No tasks selected. Nothing will be published.</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || selected.length === assignable.length}
            onClick={() => onBulkSelect(null, true)}
          >
            <CheckCheck className="size-3.5" />
            Select all {assignable.length}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || !selected.length}
            onClick={() => onBulkSelect(null, false)}
          >
            <Square className="size-3.5" />
            Clear
          </Button>
        </div>
      </div>

      <p className="mb-5 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <Info className="mt-0.5 size-3.5 shrink-0 text-blue-500" aria-hidden />
        <span>
          A workflow step and a task are not the same thing. A step is what happens inside the procedure, whoever or
          whatever performs it; a task is work owned by a named person. Tasks are derived from the procedure&apos;s
          preconditions, its staff steps, the human gates its AI steps require, and its handovers.
        </span>
      </p>

      <div className="space-y-6">
        {grouped.map(({ origin, drafts }) => {
          const groupAssignable = drafts.filter((task) => task.assignable);
          const allOn = groupAssignable.length > 0 && groupAssignable.every((task) => task.selected);

          return (
          <div key={origin}>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <OriginBadge origin={origin} />
              <span className="text-sm font-medium text-slate-700">
                {drafts.length} {drafts.length === 1 ? "task" : "tasks"}
              </span>
              {groupAssignable.length ? (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onBulkSelect(groupAssignable.map((task) => task.key), !allOn)}
                  className="text-xs font-medium text-blue-600 underline-offset-2 hover:underline disabled:opacity-50"
                >
                  {allOn ? "Clear group" : "Select group"}
                </button>
              ) : null}
            </div>
            <p className="mb-3 text-xs text-slate-500">{ORIGIN_RATIONALE[origin]}</p>

            <div className="space-y-3">
              {drafts.map((task) => (
                <TaskCard
                  key={task.key}
                  task={task}
                  spec={spec}
                  publishFrom={publishFrom}
                  disabled={disabled}
                  onChange={(next) => onTaskChange(task.key, next)}
                />
              ))}
            </div>
          </div>
          );
        })}
      </div>

      {gaps.length ? (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-sm font-medium text-slate-700">
            {gaps.length} {gaps.length === 1 ? "step produced" : "steps produced"} no task
          </p>
          <ul className="mt-1.5 space-y-1 text-xs text-slate-600">
            {gaps.map((step) => (
              <li key={step.no}>
                <span className="font-mono">Step {step.no}</span> - {step.systemAction || step.userAction}. Runs
                unattended and moves no learner-visible record, so no human owns an outcome here.
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </ErpSection>
  );
}

function TaskCard({
  task,
  spec,
  publishFrom,
  disabled,
  onChange,
}: {
  task: TaskDraft;
  spec: ProcessSpec;
  publishFrom: Date;
  disabled: boolean;
  onChange: (next: Partial<TaskDraft>) => void;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        task.selected ? "border-blue-200 bg-blue-50/40" : "border-slate-200 bg-white"
      } ${task.assignable ? "" : "opacity-75"}`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 size-4 shrink-0 rounded border-slate-300 disabled:cursor-not-allowed"
          checked={task.selected}
          disabled={disabled || !task.assignable}
          aria-label={`Include "${task.title}"`}
          onChange={(event) => onChange({ selected: event.target.checked })}
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] text-slate-400">{task.key}</span>
            <h4 className="font-medium text-slate-900">{task.title}</h4>
          </div>

          <p className="mt-1 text-sm leading-6 text-slate-600">{task.description}</p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ActorBadge actor={task.actor} />
            <span className="text-xs text-slate-500">Owner: {task.owner}</span>
            {task.stepNos.length ? (
              <span className="text-xs text-slate-500">Covers step {task.stepNos.join(", ")}</span>
            ) : null}
            {task.ruleRefs.map((ruleId) => (
              <RuleChip key={ruleId} id={ruleId} title={spec.businessRules.find((rule) => rule.id === ruleId)?.rule} />
            ))}
          </div>

          {task.assignable ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600">Priority</span>
                <select
                  className={`${erpSelectClass} h-9 text-xs`}
                  value={task.priority}
                  disabled={disabled}
                  onChange={(event) => onChange({ priority: event.target.value as TaskPriority })}
                >
                  {PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600">Due in (days)</span>
                <input
                  type="number"
                  min={0}
                  max={365}
                  className={`${erpInputClass} h-9 text-xs`}
                  value={task.dueOffsetDays}
                  disabled={disabled}
                  onChange={(event) => onChange({ dueOffsetDays: Math.max(0, Number(event.target.value) || 0) })}
                />
              </label>

              <div className="space-y-1">
                <span className="text-xs font-medium text-slate-600">Due date</span>
                <p className="flex h-9 items-center font-mono text-xs text-slate-700">{dueDateFor(task, publishFrom)}</p>
              </div>
            </div>
          ) : (
            <p className="mt-3 rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-600">
              Not published as a task - {TASK_ORIGIN_LABELS[task.origin].toLowerCase()}.
            </p>
          )}

          <dl className="mt-3 grid gap-x-4 gap-y-1 text-xs text-slate-500 sm:grid-cols-[80px_1fr]">
            <dt className="font-medium">KRA</dt>
            <dd>{task.kra}</dd>
            <dt className="font-medium">KPA</dt>
            <dd>{task.kpa}</dd>
            <dt className="font-medium">Observed</dt>
            <dd>{task.observationPoint || "-"}</dd>
          </dl>
        </div>
      </div>
    </div>
  );
}
