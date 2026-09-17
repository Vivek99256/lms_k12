'use client';

import { CalendarClock } from 'lucide-react';

import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { FEES_PLATFORM_MODULE } from '@/app/fees/_lib/fees-platform-scope';
import { SchedulerConsole } from '@/app/platform-services/scheduler/_components/SchedulerConsole';

/**
 * Fees → Scheduler tabs.
 *
 * The counterpart of the Workflow tabs beside it, and the same arrangement Fees
 * → Communication uses. Rescheduling a due-date reminder here writes the one
 * override row Platform services reads, through PUT /api/platform/scheduler:
 * there is no Fees cron table and no Fees dispatcher.
 *
 * `embedded` drops the console's own page chrome, because the category page has
 * already drawn it.
 */
export const FEES_SCHEDULER_SCREENS: ModuleStaticScreen[] = [
  {
    id: 'scheduler-tasks',
    label: 'Scheduled tasks',
    icon: CalendarClock,
    render: () => (
      <SchedulerConsole
        embedded
        module={FEES_PLATFORM_MODULE}
        title="Fees scheduled tasks"
        description="Recurring fees activity — due-date reminders, defaulter sweeps and reconciliation: when each runs, whether it is switched on, and when it last did."
      />
    ),
  },
];
