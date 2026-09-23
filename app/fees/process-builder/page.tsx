'use client';

import { AddProcessPage } from '@/app/general/add_process/AddProcessPage';

/**
 * Fees → Process Builder.
 *
 * Not a tab strip over Fees menus: building a process is the same SOP → Process,
 * Workflow and Tasks converter everywhere, already built and backed by real data
 * under /general/add_process. This route renders that same screen rather than
 * the placeholder tabs it used to show. The Fees category bar above is where
 * the user came from, so the screen needs no Back button of its own.
 */
export default function Page() {
  return <AddProcessPage />;
}
