'use client'

/**
 * Task Management > Reports & Analysis API client.
 *
 * Ported from G2G's `services/task/index.ts` (`taskService.getProductivityReport`,
 * `taskService.getDelaysReport`, `taskService.getRejectedTaskLearning`) — the
 * org-wide reports `tm-reports.tsx` renders (Productivity, Delays, and the
 * Task Management -> LMS learning hand-off). Endpoint paths and response
 * shapes are preserved exactly as in G2G; only the transport changed to this
 * module's shared `taskApiGet` + `TaskSession` (`_lib/task-session.ts`)
 * instead of G2G's `apiClient` + `LaravelContext`.
 */

import { taskApiGet, toTaskParams, type TaskSession } from './task-session'
import type { DelayReport, ProductivityRow } from './task-types'

export interface RejectedTaskLearningResponse {
  status: number
  message: string
  data?: unknown
}

export const reportsService = {
  getProductivityReport: (session: TaskSession) =>
    taskApiGet<{ status: 1; message: string; data: { rows: ProductivityRow[] } }>(
      session,
      '/task-management/reports/productivity',
      toTaskParams(session),
    ),

  getDelaysReport: (session: TaskSession) =>
    taskApiGet<{ status: 1; message: string; data: DelayReport }>(
      session,
      '/task-management/reports/delays',
      toTaskParams(session),
    ),

  /**
   * The Task Management -> LMS hand-off: tasks rejected in review, mapped
   * through their required skills to recommended courses. Legacy route (not
   * `/task-management/*`), so it takes `user_id` + `type: 'API'` like the
   * rest of this module's legacy calls.
   */
  getRejectedTaskLearning: (session: TaskSession, userId?: string) =>
    taskApiGet<RejectedTaskLearningResponse>(
      session,
      '/user-rejected-tasks-courses',
      toTaskParams(session, { user_id: userId ?? session.userId }),
    ),
}
