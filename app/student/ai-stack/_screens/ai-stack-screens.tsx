'use client';

import { BookMarked, Cpu, FileText, Gauge, History, ShieldAlert, SlidersHorizontal, Terminal, Workflow } from 'lucide-react';

import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { StudentsActivityScreen } from '@/app/student/ai-stack/_screens/students-activity-screen';
import { StudentsAutomationsScreen } from '@/app/student/ai-stack/_screens/students-automations-screen';
import { StudentsGuardrailsScreen } from '@/app/student/ai-stack/_screens/students-guardrails-screen';
import { StudentsKnowledgeBaseScreen } from '@/app/student/ai-stack/_screens/students-knowledge-base-screen';
import { StudentsModelsScreen } from '@/app/student/ai-stack/_screens/students-models-screen';
import { StudentsPoliciesScreen } from '@/app/student/ai-stack/_screens/students-policies-screen';
import { StudentsPromptsScreen } from '@/app/student/ai-stack/_screens/students-prompts-screen';
import { StudentsTemplatesScreen } from '@/app/student/ai-stack/_screens/students-templates-screen';
import { StudentsUsageCostScreen } from '@/app/student/ai-stack/_screens/students-usage-cost-screen';

/**
 * Student → AI Stack tabs.
 *
 * The AI services and automation behind the Student module. This is the plumbing view —
 * what the module runs on — as distinct from Intelligence, which is what that plumbing
 * produces. Nothing here touches the separate AI Administration module.
 *
 * ALL NINE TABS ARE LIVE, AND ALL NINE ARE STUDENT-ONLY
 *
 * Each renders its own screen in this folder, and each is decentralised in the sense that
 * matters to the person using it: it shows only Student configuration, and a save from it
 * cannot be filed against another module. The module is never a control the operator can
 * reach.
 *
 * DECENTRALISED IS NOT DUPLICATED
 *
 * There is no second AI stack under the Student module. Every screen calls the same client,
 * the same endpoint and the same table as the central AI console, scoped to `students`:
 *
 *   Policies       → ai_policies with a `module` assignment for students
 *   Models         → the central provider/model resolution, READ-ONLY (see below)
 *   Prompts        → ai_templates, module_key = students, kind = prompt
 *   Templates      → ai_templates, module_key = students, kind = report
 *   Knowledge Base → the read-only Student MCP tools, from the backend tool registry
 *   Automations    → `ai_agents` (the agent the chatbot runs) + the central Agent
 *                    Management engine, module = students
 *   Usage & Cost   → ai_conversations.module_key, Student generations, the quota
 *   Guardrails     → the five places a Student guardrail is actually enforced
 *   Activity       → ai_audit_logs rows under `module.students.*`
 *
 * So a change to any of those contracts breaks both the central screen and this one at
 * compile time, rather than leaving this one quietly wrong. No table, column or store was
 * added to make these tabs Student-specific — every module filter is a column the schema
 * already had.
 *
 * WHY THE KEY IS `students` AND THE ROUTE IS `student`
 *
 * `ai_modules` has carried two student modules since the workspace was seeded: `student`,
 * the entity-bound one for a single child's record, and `students`, the lists-and-
 * administration one this menu actually is. This stack belongs to the second, so every
 * screen scopes to `students` and the per-child module is left exactly as it is. The menu
 * slug is `student`, because it is derived from the level-2 menu's own name; the two
 * spellings are each correct for what they name and neither is typed into a screen.
 *
 * WHY MODELS IS HERE WHEN FEES DROPPED IT
 *
 * Fees removed its Models tab because a per-module model *editor* is a second place to
 * change one estate-wide setting. That reasoning is right and is kept: this tab writes
 * nothing. It reports which provider and model the module currently resolves to and through
 * which rule, and every control on it is a link to the central console. Attendance and
 * Admissions made the same call.
 *
 * NO TAB DOES ANOTHER TAB'S JOB. Prompts and Templates are both `ai_templates` rows and are
 * split by `kind`, because a prompt is text sent to a model and a report is a layout filled
 * from enrolment records. Guardrails reads what the other tabs configure and offers no
 * second place to change it.
 */
export const STUDENTS_AI_STACK_SCREENS: ModuleStaticScreen[] = [
  {
    // Live. `ai_policies` rows carrying a `module` assignment for the Student module, plus
    // a read-only view of the caller's own `agents.students` rights — because "what may the
    // AI do" and "who may make it do that" are the two halves of one question and only the
    // first of them is a policy.
    id: 'policies',
    label: 'Policies',
    icon: SlidersHorizontal,
    render: () => <StudentsPoliciesScreen />,
  },
  {
    // Live, and read-only. See the note above.
    id: 'models',
    label: 'Models',
    icon: Cpu,
    render: () => <StudentsModelsScreen />,
  },
  {
    // Live. `ai_templates` rows for the Student module with `kind = 'prompt'` — the other
    // half of the store Templates reads.
    id: 'prompts',
    label: 'Prompts',
    icon: Terminal,
    render: () => <StudentsPromptsScreen />,
  },
  {
    // Live. The Student module's own report layouts, and the place a report is built from
    // one. Preview, edit, print and send all happen on `/ai-reports/{id}`, which the build
    // hands you a link to rather than reimplementing.
    id: 'templates',
    label: 'Templates',
    icon: FileText,
    render: () => <StudentsTemplatesScreen />,
  },
  {
    // Live. The read-only Student MCP tools the assistant draws on, plus the indexed
    // documents, each checkable against real records.
    id: 'knowledge-base',
    label: 'Knowledge Base',
    icon: BookMarked,
    render: () => <StudentsKnowledgeBaseScreen />,
  },
  {
    // Live. The Academic Risk Agent this module is bound to — the same manifest the chatbot
    // runs, with its run log, its cases and its approval queue — above the tool agents on
    // the central Agent Management engine, scoped to module="students".
    id: 'automations',
    label: 'Automations',
    icon: Workflow,
    render: () => <StudentsAutomationsScreen />,
  },
  {
    // Live. Aggregated from ai_conversations.module_key, Student generations and the
    // resolved credential's quota. Cost is measured or blank, never estimated.
    id: 'usage-cost',
    label: 'Usage & Cost',
    icon: Gauge,
    render: () => <StudentsUsageCostScreen />,
  },
  {
    // Live. Reads the guardrails from the five places they are enforced, and lists the
    // requests they refused.
    id: 'guardrails',
    label: 'Guardrails',
    icon: ShieldAlert,
    render: () => <StudentsGuardrailsScreen />,
  },
  {
    // Live. The execution ledger: what ran in the Student module, which AI record it used,
    // who did it and how it ended. `ai_audit_logs` rows under `module.students.*`.
    id: 'activity',
    label: 'Activity',
    icon: History,
    render: () => <StudentsActivityScreen />,
  },
];
