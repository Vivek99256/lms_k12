import type { AgentModuleKey } from './types';

/**
 * Module and tool catalogues.
 *
 * MODULE SCOPING LIVES HERE, NOT IN THE UI. Create Agent shows only the tools
 * whose `module` is the selected one (or `shared`), and the server re-checks the
 * same list on create — so a request that names a Fees tool for a G2G agent is
 * refused whichever way it arrives.
 *
 * RBAC KEY PER MODULE. Rights are asked of Laravel as `agents.<module>` through
 * the same /api/permissions endpoint the content screens use. The key must be
 * registered in the backend's config/rbac_modules.php; an unregistered key comes
 * back deny-all, which is the correct failure — configuration never grants.
 *
 * `available: false` marks a tool that exists in the catalogue so it can be
 * planned for, but has no executor yet. It is shown disabled and cannot be put on
 * an allow-list, so no run can ever fail on "not wired".
 */

export interface AgentModule {
  key: AgentModuleKey;
  label: string;
  description: string;
}

export type ToolRisk = 'read' | 'draft' | 'write';
export type ToolKind = 'local' | 'mcp' | 'intelligence';

export interface AgentTool {
  key: string;
  label: string;
  description: string;
  /** Owning module, or `shared` for tools every module may use. */
  module: AgentModuleKey | 'shared';
  /** read = looks at data · draft = produces text, changes nothing · write = changes records. */
  risk: ToolRisk;
  /** local = runs in this engine · mcp = governed MCP tool · intelligence = backend domain agent. */
  kind: ToolKind;
  /** False until an executor exists. Never selectable. */
  available: boolean;
  /** Example arguments, pre-filled in the Run dialog so the operator sees the shape. */
  exampleInput: Record<string, unknown>;
}

export const SHARED_MODULE = 'shared';

export const AGENT_MODULES: AgentModule[] = [
  { key: 'fees', label: 'Fees', description: 'Fee structures, collection, dues and reminders.' },
  { key: 'g2g', label: 'G2G', description: 'Good-to-great learning and growth workflows.' },
  { key: 'admissions', label: 'Admissions', description: 'Enquiries, registrations and confirmations.' },
  { key: 'students', label: 'Students', description: 'Student records and profiles.' },
  { key: 'lms', label: 'LMS', description: 'Courses, content and assessments.' },
  { key: 'hrit', label: 'HR', description: 'Staff, leave and payroll.' },
];

export const AGENT_TOOLS: AgentTool[] = [
  // ---- Fees ---------------------------------------------------------------
  {
    key: 'fees.draft_reminder',
    label: 'Draft a fee reminder',
    description: 'Writes a reminder message for one family from the details you give it. Sends nothing.',
    module: 'fees',
    risk: 'draft',
    kind: 'local',
    available: true,
    exampleInput: { student_name: 'Aarav Shah', class_name: 'Grade 6-B', amount: 12500, due_date: '2026-07-15', tone: 'gentle' },
  },
  {
    key: 'fees.list_defaulters',
    label: 'List fee defaulters',
    description: 'Reads the defaulter report for a class or the whole school.',
    module: 'fees',
    risk: 'read',
    kind: 'mcp',
    available: false,
    exampleInput: { class_id: null, as_of: '2026-07-01' },
  },
  {
    key: 'fees.fee_structure',
    label: 'Read a fee structure',
    description: 'Reads the fee heads and amounts for a class and term.',
    module: 'fees',
    risk: 'read',
    kind: 'mcp',
    available: false,
    exampleInput: { class_id: 12, term_id: 2 },
  },
  // ---- G2G ----------------------------------------------------------------
  {
    key: 'g2g.draft_growth_note',
    label: 'Draft a growth note',
    description: 'Writes a short growth note for a learner from the observations you give it.',
    module: 'g2g',
    risk: 'draft',
    kind: 'local',
    available: true,
    exampleInput: { learner_name: 'Diya Patel', strengths: ['curiosity'], next_step: 'reads one chapter a day' },
  },
  {
    key: 'g2g.progress_snapshot',
    label: 'Read a progress snapshot',
    description: "Reads a learner's latest G2G progress figures.",
    module: 'g2g',
    risk: 'read',
    kind: 'mcp',
    available: false,
    exampleInput: { learner_id: 4021 },
  },
  // ---- Admissions ---------------------------------------------------------
  {
    key: 'admissions.enquiry_followup',
    label: 'Draft an enquiry follow-up',
    description: 'Writes a follow-up message to a family that enquired and has not registered.',
    module: 'admissions',
    risk: 'draft',
    kind: 'local',
    available: true,
    exampleInput: { parent_name: 'Mrs Rao', child_name: 'Kabir', grade_applied: 'Grade 1', enquiry_date: '2026-06-02' },
  },
  // ---- Students -----------------------------------------------------------
  {
    key: 'students.risk_scan',
    label: 'Run the student risk scan',
    description: 'Runs the backend student-risk detector over a cohort.',
    module: 'students',
    risk: 'read',
    kind: 'intelligence',
    available: false,
    exampleInput: { limit: 50 },
  },
  // ---- Shared -------------------------------------------------------------
  {
    key: 'shared.compose_note',
    label: 'Compose a note',
    description: 'Turns a heading and bullet points into a short, plain-language note.',
    module: SHARED_MODULE,
    risk: 'draft',
    kind: 'local',
    available: true,
    exampleInput: { heading: 'Term-2 fee schedule', points: ['Due 15 July', 'Pay online or at the office'] },
  },
];

export function findModule(key: string): AgentModule | undefined {
  return AGENT_MODULES.find((module) => module.key === key);
}

export function isKnownModule(key: string): boolean {
  return Boolean(findModule(key));
}

/** The Laravel permission key an agent in this module is gated on. */
export function rbacModuleKey(module: AgentModuleKey): string {
  return `agents.${module}`;
}

/** Tools a Create Agent form may offer for one module: the module's own plus shared. */
export function toolsForModule(module: AgentModuleKey): AgentTool[] {
  return AGENT_TOOLS.filter((tool) => tool.module === module || tool.module === SHARED_MODULE);
}

export function findTool(key: string): AgentTool | undefined {
  return AGENT_TOOLS.find((tool) => tool.key === key);
}

/**
 * The reason an allow-list is not acceptable for a module, or null if it is.
 *
 * Duplicates are tolerated (the engine de-duplicates); an empty list, an unknown
 * key, a key from another module, or a tool with no executor are not.
 */
export function validateToolsForModule(module: AgentModuleKey, toolKeys: string[]): string | null {
  const unique = Array.from(new Set(toolKeys));
  if (!unique.length) return 'Choose at least one tool.';

  const offered = new Set(toolsForModule(module).map((tool) => tool.key));
  for (const key of unique) {
    const tool = findTool(key);
    if (!tool) return `Unknown tool "${key}".`;
    if (!offered.has(key)) return `"${tool.label}" belongs to ${tool.module}, not ${module}.`;
    if (!tool.available) return `"${tool.label}" is not available yet.`;
  }
  return null;
}
