'use client';

import { GitBranch, History, Layers, PenTool, ShieldCheck, Zap } from 'lucide-react';

import type { FeesStaticScreen } from '@/app/fees/_components/fees-category-page';
import { FeesPlaceholderScreen } from '@/app/fees/_components/fees-placeholder-screen';

/**
 * Fees → Process Builder tabs.
 *
 * Scaffolding for designing fees processes and approval flows. Nothing here is
 * built yet — note in particular that this is not wired to the AI module's
 * existing "Workflows" screen, which belongs to that module and is not Fees'
 * to reuse. Each tab renders the shared placeholder.
 */
export const FEES_PROCESS_BUILDER_SCREENS: FeesStaticScreen[] = [
  {
    id: 'process-library',
    label: 'Process Library',
    icon: Layers,
    render: () => (
      <FeesPlaceholderScreen
        title="Process Library"
        summary="Every fees process defined for this institute, in one list."
        points={[
          'Processes with their purpose, owner and current state.',
          'Which are live, which are drafts, and which are retired.',
          'Duplicate an existing process as the start of a new one.',
        ]}
      />
    ),
  },
  {
    id: 'designer',
    label: 'Designer',
    icon: PenTool,
    render: () => (
      <FeesPlaceholderScreen
        title="Designer"
        summary="Lay out the steps of a fees process and how they connect."
        points={[
          'Steps, branches and the conditions that route between them.',
          'The form or screen each step puts in front of a person.',
          'Validation of a draft before it can be published.',
        ]}
      />
    ),
  },
  {
    id: 'approval-flows',
    label: 'Approval Flows',
    icon: ShieldCheck,
    render: () => (
      <FeesPlaceholderScreen
        title="Approval Flows"
        summary="Who has to approve a fees action, and in what order."
        points={[
          'Approval chains for concessions, cancellations and refunds.',
          'Thresholds that decide when an approval is required at all.',
          'Delegation and escalation when an approver is unavailable.',
        ]}
      />
    ),
  },
  {
    id: 'triggers-rules',
    label: 'Triggers & Rules',
    icon: Zap,
    render: () => (
      <FeesPlaceholderScreen
        title="Triggers & Rules"
        summary="What starts a process, and the rules it follows once running."
        points={[
          'Triggers on events, schedules or thresholds being crossed.',
          'Rules expressed against fees data, with a dry-run preview.',
          'Conflicts flagged when two rules would fire on the same event.',
        ]}
      />
    ),
  },
  {
    id: 'versions',
    label: 'Versions',
    icon: GitBranch,
    render: () => (
      <FeesPlaceholderScreen
        title="Versions"
        summary="The change history of a process, and the ability to go back."
        points={[
          'Each published version with who changed what.',
          'A comparison between any two versions.',
          'Roll back to an earlier version without losing the later one.',
        ]}
      />
    ),
  },
  {
    id: 'run-history',
    label: 'Run History',
    icon: History,
    render: () => (
      <FeesPlaceholderScreen
        title="Run History"
        summary="Every execution of a process and how it ended."
        points={[
          'Runs with their trigger, duration and outcome.',
          'The step a failed run stopped on, and why.',
          'Retry a failed run, or cancel one that is stuck.',
        ]}
      />
    ),
  },
];
