'use client';

import { BookMarked, Cpu, Gauge, ShieldAlert, Terminal, Workflow } from 'lucide-react';

import type { FeesStaticScreen } from '@/app/fees/_components/fees-category-page';
import { FeesPlaceholderScreen } from '@/app/fees/_components/fees-placeholder-screen';
import { FeesAutomationsScreen } from '@/app/fees/ai-stack/_screens/fees-automations-screen';

/**
 * Fees → AI Stack tabs.
 *
 * Scaffolding for the AI services and automation behind the Fees module. This
 * is the plumbing view — what the module runs on — as distinct from
 * Intelligence, which is what that plumbing produces. Automations is live — it
 * runs on the central Agent Management engine (lib/agents), scoped to Fees.
 * The other tabs are not wired up yet and render the shared placeholder;
 * nothing here touches the separate AI Administration module.
 */
export const FEES_AI_STACK_SCREENS: FeesStaticScreen[] = [
  {
    id: 'models',
    label: 'Models',
    icon: Cpu,
    render: () => (
      <FeesPlaceholderScreen
        title="Models"
        summary="The models Fees calls, and which task each one serves."
        points={[
          'Model per task — forecasting, classification, summarisation.',
          'Version in use, and what it replaced.',
          'Fallback model when the primary is unavailable.',
        ]}
      />
    ),
  },
  {
    id: 'prompts',
    label: 'Prompts',
    icon: Terminal,
    render: () => (
      <FeesPlaceholderScreen
        title="Prompts"
        summary="The prompts behind each Fees AI feature, kept out of the code."
        points={[
          'Prompt per feature, with the fees fields it is given.',
          'Version history, and which version is live.',
          'Test a change against sample data before publishing it.',
        ]}
      />
    ),
  },
  {
    id: 'knowledge-base',
    label: 'Knowledge Base',
    icon: BookMarked,
    render: () => (
      <FeesPlaceholderScreen
        title="Knowledge Base"
        summary="The fees material the AI is allowed to draw on when answering."
        points={[
          'Indexed sources: policies, circulars, fee structures and guides.',
          'When each source was last refreshed.',
          'Scope rules limiting what may be surfaced to whom.',
        ]}
      />
    ),
  },
  {
    id: 'automations',
    label: 'Automations',
    icon: Workflow,
    // The one built tab: the Fee reminder drafter on the central Agent
    // Management engine, scoped to module="fees". See fees-automations-screen.tsx.
    render: () => <FeesAutomationsScreen />,
  },
  {
    id: 'usage-cost',
    label: 'Usage & Cost',
    icon: Gauge,
    render: () => (
      <FeesPlaceholderScreen
        title="Usage & Cost"
        summary="What the Fees module is consuming, and what it costs."
        points={[
          'Requests and tokens by feature over time.',
          'Spend against budget, with alerts before the cap.',
          'The features driving the most consumption.',
        ]}
      />
    ),
  },
  {
    id: 'guardrails',
    label: 'Guardrails',
    icon: ShieldAlert,
    render: () => (
      <FeesPlaceholderScreen
        title="Guardrails"
        summary="The limits Fees AI operates within."
        points={[
          'Which fee and student fields may be sent to a model.',
          'Actions that always require a person to confirm.',
          'Blocked requests, with the rule that stopped each one.',
        ]}
      />
    ),
  },
];
