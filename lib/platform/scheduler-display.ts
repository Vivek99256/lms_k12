/** Pure display rules for a scheduled task row, kept apart from the screen so they can be tested. */
export interface SchedulerTaskLike {
  has_job: boolean;
  last_run_status: 'ok' | 'failed' | null;
  last_run_message?: string | null;
}

/** Tasks without a job cannot run, so they cannot be switched on or run now. */
export function canRunOrToggle(task: Pick<SchedulerTaskLike, 'has_job'>): boolean {
  return task.has_job === true;
}

export const NO_JOB_LABEL = 'No job yet';
export const NO_JOB_HINT = 'No job is built for this task yet, so it cannot run or be switched on.';

/** The summary shown beside the status: only for tasks with a job whose last run was ok and left a message. */
export function lastRunSummary(task: SchedulerTaskLike): string | null {
  if (!task.has_job || task.last_run_status !== 'ok') return null;
  const text = (task.last_run_message ?? '').trim();
  return text === '' ? null : text;
}
