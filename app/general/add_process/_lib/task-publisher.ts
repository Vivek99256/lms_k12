"use client";

/**
 * Derived task drafts -> real tasks in People & Competency > Task management.
 *
 * This is the hand-off point of the whole feature, and the one place where the
 * conversion stops being a document and starts being work someone has to do.
 * It reuses Task Management's own create path (`myTasksApi.createLegacyTask`),
 * so a published task is indistinguishable from one raised in that module - it
 * lands in My Tasks, in the workload views and in the audit log with no special
 * casing anywhere.
 *
 * Two properties worth keeping:
 *
 * - Nothing publishes without a person pressing the button and choosing an
 *   assignee. The derivation proposes; a named human assigns. That is the SOP's
 *   own gate (7.4) and it is also just correct - the converter has no idea who
 *   teaches which class.
 * - Publishing is per-task and reports per-task. A partial failure (one task
 *   rejected, four created) tells you exactly which one, rather than leaving
 *   you to guess whether to retry the batch and double-create the other four.
 */

import { dueDateFor, type TaskDraft } from "@/lib/process";
import { myTasksApi } from "@/app/task-management/_lib/my-tasks-api";
import { resolveTaskSession, TASK_SESSION_ERROR, toMessage } from "@/app/task-management/_lib/task-session";

export interface PublishAssignment {
  /** Employee ids the task is allocated to. */
  assigneeIds: string[];
  /** Who observes/verifies completion. Task Management calls this `manageby`. */
  observerId: string;
  /** Fallback when no individual is chosen - the whole department gets it. */
  departmentId?: string;
}

export interface PublishOutcome {
  key: string;
  title: string;
  ok: boolean;
  message: string;
  taskId?: string;
}

export interface PublishReport {
  outcomes: PublishOutcome[];
  created: number;
  failed: number;
}

function readTaskId(payload: {
  task_id?: string | number;
  taskId?: string | number;
  id?: string | number;
  data?: { task_id?: string | number; taskId?: string | number; id?: string | number };
}): string | undefined {
  const candidate =
    payload.task_id ?? payload.taskId ?? payload.id ?? payload.data?.task_id ?? payload.data?.taskId ?? payload.data?.id;
  return candidate === undefined ? undefined : String(candidate);
}

/**
 * Publish the selected drafts.
 *
 * Sequential on purpose. These calls are few (a handful per procedure) and the
 * legacy `/task` endpoint upserts against the same allocation rows; firing them
 * in parallel has produced duplicate allocations in this codebase's history,
 * and the ordering also makes the per-task report readable.
 */
export async function publishTasks(params: {
  drafts: TaskDraft[];
  assignment: PublishAssignment;
  /** Publication date the due-date offsets are measured from. Injected for tests. */
  from?: Date;
}): Promise<PublishReport> {
  const session = resolveTaskSession();
  if (!session) throw new Error(TASK_SESSION_ERROR);

  const from = params.from ?? new Date();
  const outcomes: PublishOutcome[] = [];

  for (const draft of params.drafts) {
    if (!draft.assignable) {
      outcomes.push({
        key: draft.key,
        title: draft.title,
        ok: false,
        message: "Learner activity - Task Management assigns to staff, so this is not published.",
      });
      continue;
    }

    try {
      const payload = await myTasksApi.createLegacyTask(session, {
        title: draft.title,
        description: draft.description,
        assigneeIds: params.assignment.assigneeIds,
        departmentId: params.assignment.departmentId,
        observerId: params.assignment.observerId,
        priority: draft.priority,
        repeatDays: draft.repeatDays,
        dueDate: dueDateFor(draft, from),
        skillIds: [],
        skillNames: [],
        kra: draft.kra,
        kpa: draft.kpa,
        observationPoint: draft.observationPoint,
        // Keyed by the draft, so a retry after a timeout replays the same
        // create instead of raising the task twice.
        idempotencyKey: `process-${draft.key}-${dueDateFor(draft, from)}`,
      });

      outcomes.push({
        key: draft.key,
        title: draft.title,
        ok: true,
        message: payload.message || "Task created.",
        taskId: readTaskId(payload),
      });
    } catch (error: unknown) {
      outcomes.push({
        key: draft.key,
        title: draft.title,
        ok: false,
        message: toMessage(error, "The task could not be created."),
      });
    }
  }

  return {
    outcomes,
    created: outcomes.filter((outcome) => outcome.ok).length,
    failed: outcomes.filter((outcome) => !outcome.ok).length,
  };
}

/* ------------------------------------------------------------------ *
 * Assignment directory
 * ------------------------------------------------------------------ */

export interface DirectoryEmployee {
  id: string;
  name: string;
  departmentId?: string;
}

export interface DirectoryJobRole {
  id: string;
  name: string;
  departmentId?: string;
  employees: DirectoryEmployee[];
}

export interface AssignmentDirectory {
  /** Department name -> its job roles. Task Management's own grouping. */
  byDepartment: Record<string, DirectoryJobRole[]>;
  /** Everyone active, for the observer picker. */
  users: DirectoryEmployee[];
}

function fullName(person: { first_name?: string; middle_name?: string; last_name?: string }): string {
  return [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(" ").trim();
}

export async function loadAssignmentDirectory(): Promise<AssignmentDirectory> {
  const session = resolveTaskSession();
  if (!session) throw new Error(TASK_SESSION_ERROR);

  const [directory, users] = await Promise.all([
    myTasksApi.getAssignmentDirectory(session),
    myTasksApi.getAssignmentUsers(session).catch(() => [] as never[]),
  ]);

  const byDepartment: Record<string, DirectoryJobRole[]> = {};
  for (const [department, roles] of Object.entries(directory.data ?? {})) {
    byDepartment[department] = (roles ?? []).map((role) => ({
      id: String(role.id),
      name: role.jobrole,
      departmentId: String(role.department_id),
      employees: (role.employees ?? []).map((employee) => ({
        id: String(employee.id),
        name: fullName(employee) || `Employee ${employee.id}`,
      })),
    }));
  }

  return {
    byDepartment,
    users: (users ?? []).map((user) => ({
      id: String(user.id),
      name: fullName(user) || `Employee ${user.id}`,
      departmentId: user.department_id === undefined ? undefined : String(user.department_id),
    })),
  };
}
