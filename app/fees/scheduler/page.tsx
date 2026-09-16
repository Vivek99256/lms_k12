'use client';

import Link from 'next/link';

import { FEES_PLATFORM_MODULE } from '@/app/fees/_lib/fees-platform-scope';
import { SchedulerConsole } from '@/app/platform-services/scheduler/_components/SchedulerConsole';

/**
 * Fees → Scheduler.
 *
 * THE SAME CONSOLE, NOT A SECOND ONE — the counterpart of the workflow page
 * beside it, and the same arrangement Fees → Communication already uses for
 * notifications. Rescheduling the due-date reminder here writes the one override
 * row the Platform services screen reads, through PUT /api/platform/scheduler.
 * There is no Fees cron table and no Fees dispatcher.
 *
 * SCOPING HAPPENS AT THE API, NOT IN THE BROWSER: `module=fees` on the request,
 * so no other module's tasks are ever delivered to this page. Rights stay
 * `platform.scheduler` — a page cannot grant what the endpoint will refuse, so
 * it does not pretend to.
 *
 * THIS SCREEN STILL ONLY CONFIGURES. Nothing here starts a job, and "Last run"
 * is written by whatever ran it. That separation is what makes the schedules
 * safe to edit while the work is running, and it does not change for being
 * mounted under Fees.
 */
export default function FeesSchedulerPage() {
  return (
    <SchedulerConsole
      module={FEES_PLATFORM_MODULE}
      breadcrumb={[
        <Link key="fees" href="/fees/dashboard" className="hover:text-slate-700 hover:underline">
          Fees
        </Link>,
        'Scheduler',
      ]}
      title="Fees scheduler"
      description="Every recurring fees activity the ERP runs — due-date reminders, defaulter sweeps, reconciliation and the rest: when each runs, whether it is switched on, and when it last did."
    />
  );
}
