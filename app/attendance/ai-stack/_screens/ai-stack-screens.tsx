'use client';

import { BookMarked, Cpu, FileText, Gauge, History, ShieldAlert, SlidersHorizontal, Terminal, Workflow } from 'lucide-react';

import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { AiStackModelsScreen } from '@/app/_components/ai-stack/models-screen';
import { AttendanceActivityScreen } from '@/app/attendance/ai-stack/_screens/attendance-activity-screen';
import { AttendanceAutomationsScreen } from '@/app/attendance/ai-stack/_screens/attendance-automations-screen';
import { AttendanceGuardrailsScreen } from '@/app/attendance/ai-stack/_screens/attendance-guardrails-screen';
import { AttendanceKnowledgeBaseScreen } from '@/app/attendance/ai-stack/_screens/attendance-knowledge-base-screen';
import { AttendancePoliciesScreen } from '@/app/attendance/ai-stack/_screens/attendance-policies-screen';
import { AttendancePromptsScreen } from '@/app/attendance/ai-stack/_screens/attendance-prompts-screen';
import { AttendanceTemplatesScreen } from '@/app/attendance/ai-stack/_screens/attendance-templates-screen';
import { AttendanceUsageCostScreen } from '@/app/attendance/ai-stack/_screens/attendance-usage-cost-screen';

/**
 * Attendance → AI Stack tabs.
 *
 * The AI services and automation behind the Attendance module. This is the plumbing view —
 * what the module runs on — as distinct from Intelligence, which is what that plumbing
 * produces. Nothing here touches the separate AI Administration module.
 *
 * ALL NINE TABS ARE LIVE, AND ALL NINE ARE ATTENDANCE-ONLY
 *
 * Each renders its own screen in this folder, and each is decentralised in the sense that
 * matters to the person using it: it shows only Attendance configuration, and a save from
 * it cannot be filed against another module. The module is never a control the operator
 * can reach.
 *
 * DECENTRALISED IS NOT DUPLICATED
 *
 * There is no second AI stack under Attendance. Every screen calls the same client, the
 * same endpoint and the same table as the central AI console, scoped to Attendance:
 *
 *   Policies       → ai_policies with a `module` assignment for attendance
 *   Models         → the central provider/model resolution, READ-ONLY (see below)
 *   Prompts        → ai_templates, module_key = attendance, kind = prompt
 *   Templates      → ai_templates, module_key = attendance, kind = report
 *   Knowledge Base → the read-only Attendance MCP tools, from the backend tool registry
 *   Automations    → `ai_agents` (the agent the chatbot runs) + the central Agent
 *                    Management engine, module = attendance
 *   Usage & Cost   → ai_conversations.module_key, Attendance generations, the quota
 *   Guardrails     → the five places an Attendance guardrail is actually enforced
 *   Activity       → ai_audit_logs rows under `module.attendance.*`
 *
 * So a change to any of those contracts breaks both the central screen and this one at
 * compile time, rather than leaving this one quietly wrong. No table, column or store was
 * added to make these tabs Attendance-specific — every module filter is a column the
 * schema already had.
 *
 * WHY MODELS IS HERE WHEN FEES DROPPED IT
 *
 * Fees removed its Models tab because a per-module model *editor* is a second place to
 * change one estate-wide setting. That reasoning is right and is kept: this tab writes
 * nothing. It reports which provider and model Attendance currently resolves to and
 * through which rule, and every control on it is a link to the central console. A reader
 * standing in Attendance gets their question answered without a second source of truth
 * being created.
 *
 * NO TAB DOES ANOTHER TAB'S JOB. Prompts and Templates are both `ai_templates` rows and
 * are split by `kind`, because a prompt is text sent to a model and a report is a layout
 * filled from attendance records. Guardrails reads what the other tabs configure and
 * offers no second place to change it.
 */
export const ATTENDANCE_AI_STACK_SCREENS: ModuleStaticScreen[] = [
  {
    // Live. `ai_policies` rows carrying a `module` assignment for Attendance, plus a
    // read-only view of the caller's own `agents.attendance` rights — because "what may
    // the AI do" and "who may make it do that" are the two halves of one question and
    // only the first of them is a policy.
    id: 'policies',
    label: 'Policies',
    icon: SlidersHorizontal,
    render: () => <AttendancePoliciesScreen />,
  },
  {
    // Live. Uses the shared `AiStackModelsScreen` — the same component Exam, New PAL and
    // every other module's AI Stack use — rather than Attendance's own former hand-rolled
    // screen. That old screen (`attendance-models-screen.tsx`, kept in this folder but no
    // longer wired in) read `fetchAiConfigurations().resolved` and searched it for
    // `row.module === 'attendance'`. That search could never succeed: `resolved` is built
    // by `AiConfigurationResolver::overview()`, which enumerates `AiModuleRegistry` — AI
    // CAPABILITY keys ('conversational_ai', 'generative_ai', 'agent_reasoning', …), never
    // a product module like 'attendance'. So the tab reported "no row for attendance" on
    // every estate, unconditionally — nothing to do with `ai_modules` being unregistered,
    // and no amount of re-running migrations could have fixed it. The shared screen reads
    // `ai_module_model_bindings` through `fetchModuleModels('attendance')` instead, which
    // is keyed by the real product module and is exactly how Fees' own Models tab (the
    // origin of this shared component) already works.
    id: 'models',
    label: 'Models',
    icon: Cpu,
    render: () => <AiStackModelsScreen module={{ key: 'attendance', label: 'Attendance' }} />,
  },
  {
    // Live. `ai_templates` rows for Attendance with `kind = 'prompt'` — the other half of
    // the store Templates reads.
    id: 'prompts',
    label: 'Prompts',
    icon: Terminal,
    render: () => <AttendancePromptsScreen />,
  },
  {
    // Live. The Attendance module's own report layouts, and the place a report is built
    // from one. Preview, edit, print and send all happen on `/ai-reports/{id}`, which the
    // build hands you a link to rather than reimplementing.
    id: 'templates',
    label: 'Templates',
    icon: FileText,
    render: () => <AttendanceTemplatesScreen />,
  },
  {
    // Live. The read-only Attendance MCP tools the assistant draws on, plus the indexed
    // documents, each checkable against real records.
    id: 'knowledge-base',
    label: 'Knowledge Base',
    icon: BookMarked,
    render: () => <AttendanceKnowledgeBaseScreen />,
  },
  {
    // Live. The registered Attendance Agent — the same manifest the chatbot runs, with its
    // run log, its cases and its approval queue — above the tool agents on the central
    // Agent Management engine, scoped to module="attendance".
    id: 'automations',
    label: 'Automations',
    icon: Workflow,
    render: () => <AttendanceAutomationsScreen />,
  },
  {
    // Live. Aggregated from ai_conversations.module_key, Attendance generations and the
    // resolved credential's quota. Cost is measured or blank, never estimated.
    id: 'usage-cost',
    label: 'Usage & Cost',
    icon: Gauge,
    render: () => <AttendanceUsageCostScreen />,
  },
  {
    // Live. Reads the guardrails from the five places they are enforced, and lists the
    // requests they refused.
    id: 'guardrails',
    label: 'Guardrails',
    icon: ShieldAlert,
    render: () => <AttendanceGuardrailsScreen />,
  },
  {
    // Live. The execution ledger: what ran in Attendance, which AI record it used, who did
    // it and how it ended. `ai_audit_logs` rows under `module.attendance.*`.
    id: 'activity',
    label: 'Activity',
    icon: History,
    render: () => <AttendanceActivityScreen />,
  },
];
