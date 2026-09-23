'use client';

import { BookMarked, Cpu, FileText, Gauge, History, ShieldAlert, SlidersHorizontal, Terminal, Workflow } from 'lucide-react';

import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { AdmissionsActivityScreen } from '@/app/admissions/ai-stack/_screens/admissions-activity-screen';
import { AdmissionsAutomationsScreen } from '@/app/admissions/ai-stack/_screens/admissions-automations-screen';
import { AdmissionsGuardrailsScreen } from '@/app/admissions/ai-stack/_screens/admissions-guardrails-screen';
import { AdmissionsKnowledgeBaseScreen } from '@/app/admissions/ai-stack/_screens/admissions-knowledge-base-screen';
import { AdmissionsModelsScreen } from '@/app/admissions/ai-stack/_screens/admissions-models-screen';
import { AdmissionsPoliciesScreen } from '@/app/admissions/ai-stack/_screens/admissions-policies-screen';
import { AdmissionsPromptsScreen } from '@/app/admissions/ai-stack/_screens/admissions-prompts-screen';
import { AdmissionsTemplatesScreen } from '@/app/admissions/ai-stack/_screens/admissions-templates-screen';
import { AdmissionsUsageCostScreen } from '@/app/admissions/ai-stack/_screens/admissions-usage-cost-screen';

/**
 * Admission → AI Stack tabs.
 *
 * The AI services and automation behind the Admission module. This is the plumbing view —
 * what the module runs on — as distinct from Intelligence, which is what that plumbing
 * produces. Nothing here touches the separate AI Administration module.
 *
 * ALL NINE TABS ARE LIVE, AND ALL NINE ARE ADMISSION-ONLY
 *
 * Each renders its own screen in this folder, and each is decentralised in the sense that
 * matters to the person using it: it shows only Admission configuration, and a save from it
 * cannot be filed against another module. The module is never a control the operator can
 * reach.
 *
 * DECENTRALISED IS NOT DUPLICATED
 *
 * There is no second AI stack under Admissions. Every screen calls the same client, the
 * same endpoint and the same table as the central AI console, scoped to Admissions:
 *
 *   Policies       → ai_policies with a `module` assignment for admissions
 *   Models         → the central provider/model resolution, READ-ONLY (see below)
 *   Prompts        → ai_templates, module_key = admissions, kind = prompt
 *   Templates      → ai_templates, module_key = admissions, kind = report
 *   Knowledge Base → the read-only Admission MCP tools, from the backend tool registry
 *   Automations    → `ai_agents` (the agent the chatbot runs) + the central Agent
 *                    Management engine, module = admissions
 *   Usage & Cost   → ai_conversations.module_key, Admission generations, the quota
 *   Guardrails     → the five places an Admission guardrail is actually enforced
 *   Activity       → ai_audit_logs rows under `module.admissions.*`
 *
 * So a change to any of those contracts breaks both the central screen and this one at
 * compile time, rather than leaving this one quietly wrong. No table, column or store was
 * added to make these tabs Admission-specific — every module filter is a column the schema
 * already had.
 *
 * WHY MODELS IS HERE WHEN FEES DROPPED IT
 *
 * Fees removed its Models tab because a per-module model *editor* is a second place to
 * change one estate-wide setting. That reasoning is right and is kept: this tab writes
 * nothing. It reports which provider and model Admissions currently resolves to and through
 * which rule, and every control on it is a link to the central console. A reader standing
 * in Admissions gets their question answered without a second source of truth being
 * created. Attendance made the same call.
 *
 * NO TAB DOES ANOTHER TAB'S JOB. Prompts and Templates are both `ai_templates` rows and are
 * split by `kind`, because a prompt is text sent to a model and a report is a layout filled
 * from admission records. Guardrails reads what the other tabs configure and offers no
 * second place to change it.
 */
export const ADMISSIONS_AI_STACK_SCREENS: ModuleStaticScreen[] = [
  {
    // Live. `ai_policies` rows carrying a `module` assignment for Admissions, plus a
    // read-only view of the caller's own `agents.admissions` rights — because "what may the
    // AI do" and "who may make it do that" are the two halves of one question and only the
    // first of them is a policy.
    id: 'policies',
    label: 'Policies',
    icon: SlidersHorizontal,
    render: () => <AdmissionsPoliciesScreen />,
  },
  {
    // Live, and read-only. See the note above.
    id: 'models',
    label: 'Models',
    icon: Cpu,
    render: () => <AdmissionsModelsScreen />,
  },
  {
    // Live. `ai_templates` rows for Admissions with `kind = 'prompt'` — the other half of
    // the store Templates reads.
    id: 'prompts',
    label: 'Prompts',
    icon: Terminal,
    render: () => <AdmissionsPromptsScreen />,
  },
  {
    // Live. The Admission module's own report layouts, and the place a report is built from
    // one. Preview, edit, print and send all happen on `/ai-reports/{id}`, which the build
    // hands you a link to rather than reimplementing.
    id: 'templates',
    label: 'Templates',
    icon: FileText,
    render: () => <AdmissionsTemplatesScreen />,
  },
  {
    // Live. The read-only Admission MCP tools the assistant draws on, plus the indexed
    // documents, each checkable against real records.
    id: 'knowledge-base',
    label: 'Knowledge Base',
    icon: BookMarked,
    render: () => <AdmissionsKnowledgeBaseScreen />,
  },
  {
    // Live. The registered Admissions Agent — the same manifest the chatbot runs, with its
    // run log, its cases and its approval queue — above the tool agents on the central
    // Agent Management engine, scoped to module="admissions".
    id: 'automations',
    label: 'Automations',
    icon: Workflow,
    render: () => <AdmissionsAutomationsScreen />,
  },
  {
    // Live. Aggregated from ai_conversations.module_key, Admission generations and the
    // resolved credential's quota. Cost is measured or blank, never estimated.
    id: 'usage-cost',
    label: 'Usage & Cost',
    icon: Gauge,
    render: () => <AdmissionsUsageCostScreen />,
  },
  {
    // Live. Reads the guardrails from the five places they are enforced, and lists the
    // requests they refused.
    id: 'guardrails',
    label: 'Guardrails',
    icon: ShieldAlert,
    render: () => <AdmissionsGuardrailsScreen />,
  },
  {
    // Live. The execution ledger: what ran in Admissions, which AI record it used, who did
    // it and how it ended. `ai_audit_logs` rows under `module.admissions.*`.
    id: 'activity',
    label: 'Activity',
    icon: History,
    render: () => <AdmissionsActivityScreen />,
  },
];
