'use client';

import { GitBranch } from 'lucide-react';

import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { FEES_PLATFORM_MODULE } from '@/app/fees/_lib/fees-platform-scope';
import { WorkflowConsole } from '@/app/platform-services/workflow/_components/WorkflowConsole';

/**
 * Fees → Workflow tabs.
 *
 * ONE TAB, RENDERING THE CENTRAL CONSOLE. This is the same arrangement Fees →
 * Communication uses: the category page supplies the Fees frame, and the tab
 * renders the platform console scoped to `module=fees`. There is no Fees copy of
 * the approval-chain editor and no Fees workflow table — a chain saved here is
 * the row Platform services shows, written through the same endpoints.
 *
 * `embedded` drops the console's own page chrome, because the category page has
 * already drawn it.
 */
export const FEES_WORKFLOW_SCREENS: ModuleStaticScreen[] = [
  {
    id: 'workflow-approvals',
    label: 'Approvals',
    icon: GitBranch,
    render: () => (
      <WorkflowConsole
        embedded
        module={FEES_PLATFORM_MODULE}
        title="Fees approval workflows"
        description="Every fees action that can pause for a sign-off — concessions, refunds and cancellations — and the chain each one runs through."
      />
    ),
  },
];
