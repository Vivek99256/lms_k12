'use client';

import Link from 'next/link';

import { FEES_PLATFORM_MODULE } from '@/app/fees/_lib/fees-platform-scope';
import { WorkflowConsole } from '@/app/platform-services/workflow/_components/WorkflowConsole';

/**
 * Fees → Workflow.
 *
 * THE SAME CONSOLE, NOT A SECOND ONE. This mounts the platform-services
 * workflow screen with its module pinned to Fees, exactly as Fees →
 * Communication mounts the notification settings with `module: 'fees'`. There is
 * no Fees copy of the approval-chain editor, no Fees copy of the create / edit /
 * delete / activate calls, and no Fees workflow table: a fee-concession chain
 * saved here is the same row the Platform services screen shows, because it is
 * the same component writing through the same endpoints.
 *
 * WHY A SEPARATE PAGE IS STILL WORTH IT. A fees administrator should not have to
 * know that approvals live in a platform console, nor be shown fifteen other
 * modules' approval points to reach two of their own. The rail that would offer
 * that choice is dropped here; the scope is the page.
 *
 * SCOPING HAPPENS AT THE API, NOT IN THE BROWSER. The console sends
 * `module=fees` to GET /api/platform/workflow, so non-Fees points never arrive.
 * Rights are unchanged and still `platform.workflow` — this page shows what the
 * operator may see and disables what they may not, the same way the central
 * screen does, rather than inventing a Fees-only permission the backend would
 * not honour.
 */
export default function FeesWorkflowPage() {
  return (
    <WorkflowConsole
      module={FEES_PLATFORM_MODULE}
      breadcrumb={[
        <Link key="fees" href="/fees/dashboard" className="hover:text-slate-700 hover:underline">
          Fees
        </Link>,
        'Workflow',
      ]}
      title="Fees workflow"
      description="Every fees action that can pause for a sign-off — concessions, refunds, cancellations and the rest — and the approval chain each one runs through at this institute."
    />
  );
}
