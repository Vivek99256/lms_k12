'use client';

import { SchedulerConsole } from './_components/SchedulerConsole';

/**
 * Platform services -> Scheduler.
 *
 * Module and component-wise scheduled activity: what runs, when, and whether it
 * is switched on for this institute. The catalogue comes from
 * GET /api/platform/registry; the schedules are this institute's overrides on top
 * of the shipped defaults.
 */
export default function SchedulerPage() {
  return <SchedulerConsole />;
}
