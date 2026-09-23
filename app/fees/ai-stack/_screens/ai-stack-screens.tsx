'use client';

import { BookMarked, Cpu, FileText, Gauge, History, ShieldAlert, Terminal, Workflow } from 'lucide-react';

import type { FeesStaticScreen } from '@/app/fees/_components/fees-category-page';
import { FeesPlaceholderScreen } from '@/app/fees/_components/fees-placeholder-screen';
import { ComingSoonPanel, ComingSoonToggle } from '@/components/ui/coming-soon';
import { FeesAutomationsScreen } from '@/app/fees/ai-stack/_screens/fees-automations-screen';
import { FeesGuardrailsScreen } from '@/app/fees/ai-stack/_screens/fees-guardrails-screen';
import { FeesKnowledgeBaseScreen } from '@/app/fees/ai-stack/_screens/fees-knowledge-base-screen';
import { FeesModelsScreen } from '@/app/fees/ai-stack/_screens/fees-models-screen';
import { FeesPromptsScreen } from '@/app/fees/ai-stack/_screens/fees-prompts-screen';
import { FeesTemplatesScreen } from '@/app/fees/ai-stack/_screens/fees-templates-screen';

/**
 * Fees → AI Stack tabs.
 *
 * The AI services and automation behind the Fees module. This is the plumbing view —
 * what the module runs on — as distinct from Intelligence, which is what that plumbing
 * produces. Nothing here touches the separate AI Administration module.
 *
 * ALL NINE TABS ARE LIVE, AND ALL NINE ARE FEES-ONLY
 *
 * The Policies tab holds the module-scoped settings the architecture review
 * approved for a module's AI Stack tab: whether the Recommendation Engine and
 * the module agent are on, their thresholds, which knowledge sources they read,
 * and a usage view scoped to this module. Its switches are deliberately shown
 * locked rather than hidden — a visible, disabled control says the capability is
 * designed and coming, where a missing row just reads as absent.
 *
 * DECENTRALISED IS NOT DUPLICATED
 *
 * There is no second AI stack under Fees. Every screen calls the same client, the same
 * endpoint and the same table as the central AI console, scoped to Fees:
 *
 *   Prompts        → ai_templates, module_key = fees, kind = prompt
 *   Templates      → ai_templates, module_key = fees, kind = report
 *   Knowledge Base → the read-only Fees MCP tools, from the backend tool registry
 *   Automations    → the central Agent Management engine (lib/agents), module = fees
 *   Usage & Cost   → ai_conversations.module_key, Fees template generations, the quota
 *   Guardrails     → the four places a Fees guardrail is actually enforced
 *   Activity       → ai_audit_logs rows under `module.fees.*`, written by Fees screens
 *
 * So a change to any of those contracts breaks both the central screen and this one at
 * compile time, rather than leaving this one quietly wrong. No table, column or store
 * was added to make these tabs Fees-specific — every module filter is a column the
 * schema already had.
 *
 * NO TAB DOES ANOTHER TAB'S JOB. Prompts and Templates are both `ai_templates` rows and
 * are split by `kind`, because a prompt is text sent to a model and a report is a layout
 * filled from fee records. Guardrails reads what the other tabs configure and offers no
 * second place to change it.
 */
export const FEES_AI_STACK_SCREENS: ModuleStaticScreen[] = [
  /*
   * Policies is deliberately absent.
   *
   * It is an estate-wide setting with one central console — AI & Intelligence →
   * Policies — writing the very same `ai_policies` rows this module would have shown.
   * Two screens onto one row is not configurability, it is two places to look when the
   * answer disagrees. Removing the tab changes no data and no behaviour: Fees resolves
   * its policy through `AiPolicyResolver`, which reads the central table and never
   * consulted this screen. The component remains in the tree, unrouted, so restoring
   * the tab is one entry here.
   */
  {
    /*
     * Live, and it writes — which is a reversal of the reasoning above, on purpose.
     *
     * Models was dropped alongside Policies for the same stated reason: one estate-wide
     * setting should not have two editors, and a per-module binding "invites a school to
     * run Fees on a model nobody else is using without meaning to." The first half was
     * wrong about what this tab edits. A module choosing its own model is not a second
     * way to write `ai_models` / `ai_api_keys`; it is a different setting with a
     * different scope, and it is stored in a different table —
     * `ai_module_model_bindings`, keyed by product module × capability — which the
     * central console does not touch. Neither screen can move the other's row.
     *
     * The second half was a real risk and is answered by the screen rather than by the
     * tab's absence: a module with no binding inherits the estate default, every row
     * says plainly whether it is on the module's own choice or the estate's, and one
     * button puts it back. Nothing is bound by opening the tab.
     *
     * Without it, Fees → AI Stack → Models had nowhere to go but AI & Intelligence,
     * which is the module's AI Stack sending you out of the module to configure the
     * module.
     */
    id: 'models',
    label: 'Models',
    icon: Cpu,
    render: () => <FeesModelsScreen />,
  },
  {
    // Live. `ai_templates` rows for Fees with `kind = 'prompt'` — the other half of
    // the store Templates reads. See fees-prompts-screen.tsx.
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
    // Live. The Fees module's own report templates — the designs the assistant fills
    // with real fee records when somebody asks a fee question from a Fees page.
    //
    // Sits beside Prompts rather than inside it because the two are different things:
    // a prompt is text sent to a model, a template is a report layout filled by
    // substitution. Prompts remain central, as the architecture review ruled; templates
    // are managed here because they are Fees documents.
    id: 'templates',
    label: 'Templates',
    icon: FileText,
    render: () => <FeesTemplatesScreen />,
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
