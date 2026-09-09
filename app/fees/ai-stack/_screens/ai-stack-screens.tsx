'use client';

import { BookMarked, Cpu, Gauge, ShieldAlert, SlidersHorizontal, Terminal, Workflow } from 'lucide-react';

import type { FeesStaticScreen } from '@/app/fees/_components/fees-category-page';
import { FeesPlaceholderScreen } from '@/app/fees/_components/fees-placeholder-screen';
import { ComingSoonPanel, ComingSoonToggle } from '@/components/ui/coming-soon';

/**
 * Fees → AI Stack tabs.
 *
 * Scaffolding for the AI services and automation behind the Fees module. This
 * is the plumbing view — what the module runs on — as distinct from
 * Intelligence, which is what that plumbing produces. Nothing is wired up yet,
 * and nothing here touches the separate AI Administration module; each tab
 * renders the shared placeholder.
 *
 * The Policies tab holds the module-scoped settings the architecture review
 * approved for a module's AI Stack tab: whether the Recommendation Engine and
 * the module agent are on, their thresholds, which knowledge sources they read,
 * and a usage view scoped to this module. Its switches are deliberately shown
 * locked rather than hidden — a visible, disabled control says the capability is
 * designed and coming, where a missing row just reads as absent.
 *
 * NOTE for whoever wires this up: the Models and Prompts tabs below are
 * engine-level concerns (model management, prompt management). The same review
 * ruled those stay central and must not be re-implemented per module, so they
 * likely want to become links into the central AI console rather than editable
 * screens here.
 */
export const FEES_AI_STACK_SCREENS: FeesStaticScreen[] = [
  {
    id: 'policies',
    label: 'Policies',
    icon: SlidersHorizontal,
    render: () => (
      <ComingSoonPanel
        title="Fees AI policies"
        summary="What the central AI engines are allowed to do for Fees. The switches are shown locked until each engine is wired to this module — the setting exists, it is just not connected yet."
      >
        <div className="space-y-3">
          <ComingSoonToggle
            roadmapId="fees.ai-stack.recommendation-engine"
            label="Recommendation engine"
            description="Rank collection actions and flag likely defaulters for this module."
            hint="Will carry a confidence threshold below which a recommendation is not shown."
          />
          <ComingSoonToggle
            roadmapId="fees.ai-stack.agent"
            label="Fees agent"
            description="Let an agent carry out fees tasks on a person's behalf."
            hint="Will carry an approval threshold above which a person must confirm before anything runs."
          />
          <ComingSoonToggle
            roadmapId="fees.ai-stack.knowledge-source"
            label="Knowledge sources"
            description="Point the knowledge and retrieval layer at fees policies, circulars and structures."
          />
          <ComingSoonToggle
            roadmapId="fees.ai-stack.usage-audit"
            label="Usage and audit view"
            description="See what the AI did in Fees, what it cost, and who approved it."
          />
        </div>
      </ComingSoonPanel>
    ),
  },
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
    render: () => (
      <FeesPlaceholderScreen
        title="Automations"
        summary="AI-driven jobs that run against fees data on their own."
        points={[
          'Automations with their schedule or trigger.',
          'What each is permitted to do without a person confirming.',
          'Recent runs and what they changed.',
        ]}
      />
    ),
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
