'use client'

/**
 * Task Management > "What this task builds" (competency mapping) data layer.
 *
 * Ported from G2G's `services/competency/task-competency-inline.ts`
 * (`taskCompetencyInlineService.forTask` / `.save`), backing
 * `TaskCompetencyInlinePanel` (`_components/task-competency-inline-panel.tsx`)
 * inside `create-task-modal.tsx`.
 *
 * Adaptation: G2G's `apiClient.get/post` (`LaravelContext` first argument,
 * via `withLaravelParams`) -> this module's `taskApiGet`/`taskApiPost`
 * (`_lib/task-session.ts`), which take a `TaskSession` (`getTaskSession()`).
 *
 * Endpoint paths are unchanged from the source (`/competency/task-map/for-task`,
 * `/competency/task-map`) - these are pre-`/task-management` routes registered
 * directly under the `api.session` group, the same pattern
 * `saveJobRoleTaskToLibrary`'s `/competency/library/jobrole-tasks` already
 * uses in `my-tasks-api.ts`, so `taskApiGet`/`taskApiPost` (which always send
 * `${baseUrl}/api${path}`) are the right transport - no extra `/api` prefix
 * needed beyond what they already add.
 */

import { taskApiGet, taskApiPost, toTaskBody, toTaskParams, type TaskSession } from './task-session'

export interface TaskCompetency {
  id: number
  name: string
  code: string | null
  criticality: string | null
  items: number
  items_rated: number
  /** null means UNRATED. Never 0 - "scored nothing" is a different fact. */
  rating: number | null
}

export interface TaskCompetencyView {
  jobrole_task_id: number
  task: string
  jobrole: string | null
  user_id: number | null
  competencies: TaskCompetency[]
  available: { id: number; name: string; code: string | null }[]
  empty_is_expected: boolean
  empty_reason: string | null
}

interface ForTaskResponse {
  status: number
  message?: string
  data: Omit<TaskCompetencyView, 'empty_is_expected' | 'empty_reason'>
  empty_is_expected: boolean
  empty_reason: string | null
}

interface SaveResponse {
  status: number
  message?: string
}

export const competencyApi = {
  /**
   * What this task exercises, and where the person being assigned it stands.
   *
   * `userId` is optional - omit it to see the mapping alone. When supplied,
   * each competency carries that person's rolled-up rating from its KASBA
   * items.
   */
  async forTask(session: TaskSession, jobroleTaskId: number, userId: number | null): Promise<TaskCompetencyView> {
    const res = await taskApiGet<ForTaskResponse>(
      session,
      '/competency/task-map/for-task',
      toTaskParams(session, {
        jobrole_task_id: String(jobroleTaskId),
        ...(userId ? { user_id: String(userId) } : {}),
      }),
    )

    return {
      ...res.data,
      empty_is_expected: res.empty_is_expected,
      empty_reason: res.empty_reason,
    }
  },

  /**
   * Replace this task's competencies with exactly this set.
   *
   * PASS THE WHOLE LIST. This is a sync: anything omitted is removed. The
   * panel that calls it holds the full current set and sends it every time,
   * including on a single add or remove.
   */
  async save(session: TaskSession, jobroleTaskId: number, competencyIds: number[]): Promise<{ saved: boolean; message: string }> {
    const res = await taskApiPost<SaveResponse>(
      session,
      '/competency/task-map',
      toTaskBody(session, {
        jobrole_task_id: jobroleTaskId,
        items: competencyIds.map((id) => ({ competency_id: id })),
      }),
    )
    return { saved: res.status === 1, message: res.message ?? '' }
  },
}
