'use client';

import { BookMarked, FileText, Gauge, History, ShieldAlert, Terminal, Workflow } from 'lucide-react';

import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { FeesActivityScreen } from '@/app/fees/ai-stack/_screens/fees-activity-screen';
import { FeesAutomationsScreen } from '@/app/fees/ai-stack/_screens/fees-automations-screen';
import { FeesGuardrailsScreen } from '@/app/fees/ai-stack/_screens/fees-guardrails-screen';
import { FeesKnowledgeBaseScreen } from '@/app/fees/ai-stack/_screens/fees-knowledge-base-screen';
import { FeesPromptsScreen } from '@/app/fees/ai-stack/_screens/fees-prompts-screen';
import { FeesTemplatesScreen } from '@/app/fees/ai-stack/_screens/fees-templates-screen';
import { FeesUsageCostScreen } from '@/app/fees/ai-stack/_screens/fees-usage-cost-screen';

/**
 * Fees → AI Stack tabs.
 *
 * The AI services and automation behind the Fees module. This is the plumbing view —
 * what the module runs on — as distinct from Intelligence, which is what that plumbing
 * produces. Nothing here touches the separate AI Administration module.
 *
 * ALL EIGHT TABS ARE LIVE, AND ALL EIGHT ARE FEES-ONLY
 *
 * Each renders its own screen in this folder, and each is decentralised in the sense
 * that matters to the person using it: it shows only Fees configuration, and a save
 * from it cannot be filed against another module. The module is never a control the
 * operator can reach.
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
   * Policies and Models are deliberately absent.
   *
   * Both are estate-wide settings with one central console — AI & Intelligence →
   * Policies and → Models — and both wrote to the very same tables this module would
   * have shown: `ai_policies`, and `ai_models` / `ai_api_keys`. Two screens onto one
   * row is not configurability, it is two places to look when the answer disagrees,
   * and a per-module model binding invites a school to run Fees on a model nobody
   * else is using without meaning to.
   *
   * Removing the tabs changes no data and no behaviour: Fees resolves its provider,
   * model and policy through `AiConfigurationResolver` and `AiPolicyResolver`, which
   * read the central tables and never consulted this screen. The screen components
   * remain in the tree, unrouted, so restoring a tab is one entry here.
   */
  {
    // Live. `ai_templates` rows for Fees with `kind = 'prompt'` — the other half of
    // the store Templates reads. See fees-prompts-screen.tsx.
    id: 'prompts',
    label: 'Prompts',
    icon: Terminal,
    render: () => <FeesPromptsScreen />,
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
    // Live. The read-only Fees MCP tools the assistant draws on, plus the indexed
    // documents, each checkable against real records. See fees-knowledge-base-screen.tsx.
    id: 'knowledge-base',
    label: 'Knowledge Base',
    icon: BookMarked,
    render: () => <FeesKnowledgeBaseScreen />,
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
    // Live. Aggregated from ai_conversations.module_key, Fees template generations and
    // the Fees credential's quota. Cost is measured or blank, never estimated.
    // See fees-usage-cost-screen.tsx.
    id: 'usage-cost',
    label: 'Usage & Cost',
    icon: Gauge,
    render: () => <FeesUsageCostScreen />,
  },
  {
    // Live. Reads the guardrails from the four places they are enforced, and lists the
    // requests they refused. See fees-guardrails-screen.tsx.
    id: 'guardrails',
    label: 'Guardrails',
    icon: ShieldAlert,
    render: () => <FeesGuardrailsScreen />,
  },
  {
    // Live. The execution ledger: what ran in Fees, which AI record it used, who did it
    // and how it ended. `ai_audit_logs` rows under `module.fees.*`, written by the Fees
    // screens themselves as they finish. See fees-activity-screen.tsx.
    id: 'activity',
    label: 'Activity',
    icon: History,
    render: () => <FeesActivityScreen />,
  },
];
