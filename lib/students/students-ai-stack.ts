'use client';

/**
 * The seam between the Student module and the Student AI Stack.
 *
 * WHAT THIS FILE IS FOR
 *
 * Student screens do student work — they admit a child to a class, fix a spelling, print
 * an ID card, run a strength report. They should not also each know how to find the
 * configured Student agent, which prompt is published this week, or what an execution
 * ledger entry looks like. This is the one place that knows, so a Student screen adds AI
 * by calling one function.
 *
 * It is `lib/attendance/attendance-ai-stack.ts` with student operations in it,
 * deliberately: the two files call the same clients, resolve records the same way, and
 * record to the same ledger. The Fees and Attendance files are untouched by this one —
 * nothing here imports from them and nothing there imports from here — because a shared
 * "module AI stack" abstraction is worth writing once several modules have proved they
 * need the same shape, and folding a working module into one on the way past is how the
 * working module breaks.
 *
 * WHY THE KEY IS `students` AND NOT `student`
 *
 * `ai_modules` carries both, and they are different modules. `student` is the
 * entity-bound one — a single child's record, reached from `/lms/student-analysis/:id` —
 * and it already has the academic-risk agent and its ontology views. `students` is the
 * module the Student menu actually is: lists, directories, registers and reports over a
 * cohort. This AI Stack is that module's, so every call here is scoped to `students`, and
 * the per-child module is left exactly as it is.
 *
 * WHAT IS DECLARED HERE AND WHAT IS LOOKED UP
 *
 * Declared: the catalogue of Student operations and which AI capability each one leans on.
 * That mapping is application knowledge — it belongs next to the Student routes — and it
 * is a short, readable list rather than a table somebody has to maintain.
 *
 * Looked up, always, at runtime: every actual record. The agent comes from the Agent
 * Management engine's own store, the prompt and report template from `ai_templates` where
 * `module_key = 'students'`. Nothing in this file contains a template key, an agent name
 * or an id.
 *
 * WHY RECORDING NEVER BLOCKS
 *
 * A record has been saved and a card has been printed before any of this runs. Every entry
 * point below is best-effort: it resolves what it can, records what it can, and returns
 * false rather than throwing. Losing a ledger line is bad; failing a registrar's save
 * because the audit table was busy is worse. Nothing in this file is on the critical path
 * of a Student operation, and nothing in it may become so.
 */

import { fetchAgents } from '@/lib/agents/client';
import type { Agent } from '@/lib/agents/types';
import { recordModuleActivitySafely, type RecordModuleActivityInput } from '@/lib/intelligence/ai-module';
import { fetchTemplates, type AiTemplateRow } from '@/lib/intelligence/ai-templates';
import type { WorkspaceSession } from '@/lib/intelligence/workspace';

/** The `ai_modules` key — see the note at the top about `students` versus `student`. */
export const STUDENTS_MODULE = 'students';

/**
 * The route the Student AI Stack reports itself as.
 *
 * `/api/ai/workspace/*` resolves which module a call belongs to from the route it is
 * given, so a report built from this screen has to say where it was built from. It is
 * declared once here rather than typed into each screen, because a typo would resolve to
 * the general module and the call would come back "this page is not a module a report can
 * be built from" with nothing to suggest why.
 */
export const STUDENTS_AI_STACK_ROUTE = '/modules/student/ai-stack';

const SESSION_KEYS = { user: 'userData', menu: 'menuContext', year: 'selectedAcademicYear' };

/**
 * The signed-in session, for the workspace calls these screens make.
 *
 * Reads exactly what `hooks/use-ai-workspace.ts` reads, in the same order, so a report
 * built from this tab is scoped identically to one built from the assistant panel. There
 * is no default institute and no default year, and there must never be one: the backend
 * derives the tenant from the bearer token, and a default here could only ever be wrong in
 * the direction of showing one school another school's children.
 */
export function readStudentsWorkspaceSession(): WorkspaceSession {
  if (typeof window === 'undefined') return {};

  try {
    const userData = JSON.parse(localStorage.getItem(SESSION_KEYS.user) || '{}') as Record<string, unknown>;
    const menuContext = JSON.parse(localStorage.getItem(SESSION_KEYS.menu) || '{}') as Record<string, unknown>;

    return {
      token: String(userData.user_token ?? userData.token ?? menuContext.user_token ?? menuContext.token ?? ''),
      baseUrl: String(userData.host_name ?? ''),
      instituteId: String(userData.sub_institute_id ?? menuContext.sub_institute_id ?? ''),
      academicYear: String(
        localStorage.getItem(SESSION_KEYS.year) ?? userData.syear ?? userData.academic_year_id ?? '',
      ),
      termId: String(userData.term_id ?? userData.marking_period_id ?? menuContext.term_id ?? ''),
    };
  } catch {
    return {};
  }
}

/**
 * The Student operations worth recording, and the AI capability each leans on.
 *
 * `capability` names an `ai_modules` capability flag, so a ledger entry can be read
 * against what the Guardrails tab says Students is allowed to do. `uses` says which kind
 * of AI Stack record to resolve for it — and `none` is a real and common answer: a record
 * corrected by a registrar is a Student operation that used no AI, and the ledger should
 * say so rather than attach a template that had nothing to do with it.
 */
export type StudentsOperationKey =
  | 'students_viewed'
  | 'student_viewed'
  | 'student_record_updated'
  | 'students_summary'
  | 'record_quality_analysed'
  | 'class_roll_report'
  | 'contact_sheet_report'
  | 'profile_note_drafted'
  | 'parent_record_request_drafted'
  | 'students_agent_run';

export type StudentsCapability = 'conversational' | 'generative' | 'agent' | 'workflow' | 'ontology';

export interface StudentsOperationSpec {
  key: StudentsOperationKey;
  label: string;
  capability: StudentsCapability | null;
  /** Which AI Stack record, if any, this operation resolves and records. */
  uses: 'report_template' | 'prompt' | 'agent' | 'none';
  /**
   * A hint for choosing between several published records of the right kind.
   *
   * Matched against the template key and name, case-insensitively. It is a preference,
   * never a requirement: when nothing matches, the newest published record of that kind is
   * used, and when there is none the operation records without one.
   */
  prefers?: string[];
}

export const STUDENTS_OPERATIONS: Record<StudentsOperationKey, StudentsOperationSpec> = {
  students_viewed: {
    key: 'students_viewed',
    label: 'Students viewed',
    capability: 'conversational',
    uses: 'none',
  },
  student_viewed: {
    key: 'student_viewed',
    label: 'Student record opened',
    capability: 'conversational',
    uses: 'none',
  },
  student_record_updated: {
    key: 'student_record_updated',
    label: 'Student record updated',
    // A record edit is a Student transaction, not a model call. It is recorded because the
    // ledger has to show what happened in the module, and marked `workflow` because that
    // is the capability a record change belongs to when one is attached to it.
    capability: 'workflow',
    uses: 'none',
  },
  students_summary: {
    key: 'students_summary',
    label: 'Student cohort summary',
    capability: 'generative',
    uses: 'prompt',
    prefers: ['summary'],
  },
  record_quality_analysed: {
    key: 'record_quality_analysed',
    label: 'Student record completeness analysed',
    capability: 'generative',
    uses: 'prompt',
    prefers: ['record_quality', 'quality', 'completeness'],
  },
  class_roll_report: {
    key: 'class_roll_report',
    label: 'Class roll report',
    capability: 'generative',
    uses: 'report_template',
    // 'roll' first, so the roll layout is preferred over the contact sheet when both are
    // published — the two answer different questions and the names say which.
    prefers: ['roll', 'class', 'report'],
  },
  contact_sheet_report: {
    key: 'contact_sheet_report',
    label: 'Student contact sheet',
    capability: 'generative',
    uses: 'report_template',
    prefers: ['contact', 'sheet'],
  },
  profile_note_drafted: {
    key: 'profile_note_drafted',
    label: 'Student profile note drafted',
    capability: 'generative',
    uses: 'prompt',
    prefers: ['profile', 'note'],
  },
  parent_record_request_drafted: {
    key: 'parent_record_request_drafted',
    label: 'Record request to a parent drafted',
    capability: 'generative',
    uses: 'prompt',
    // 'parent' first, and it matters. These hints are matched against published prompt
    // keys in order, and the nearest wrong match here is the cohort summary prompt — whose
    // grounding variables are `records` and `metrics`. A parent-message screen sends one
    // student and a list of missing fields, never those, so falling through to the summary
    // would refuse every draft for want of grounding and show a 422. This is the failure
    // the Fees remark prompts were published to end; it is avoided here by asking for the
    // prompt that writes a message.
    prefers: ['parent', 'record_request', 'request', 'message'],
  },
  students_agent_run: {
    key: 'students_agent_run',
    label: 'Student agent run',
    capability: 'agent',
    uses: 'agent',
  },
};

/** Everything configured for Students right now, as the database and engine report it. */
export interface StudentsAiStackSnapshot {
  /** Published, offered report layouts for Students. */
  reportTemplates: AiTemplateRow[];
  /** Published Student prompts. */
  prompts: AiTemplateRow[];
  /** Active Student agents from the Agent Management engine. */
  agents: Agent[];
  /** True when neither store could be read — the caller records without artefacts. */
  degraded: boolean;
}

const EMPTY_SNAPSHOT: StudentsAiStackSnapshot = {
  reportTemplates: [],
  prompts: [],
  agents: [],
  degraded: true,
};

/**
 * One in-flight load shared by every caller in the page.
 *
 * A directory screen, a report screen and a text field can all ask at once; they should
 * cause one pair of requests, not three. Cached for the lifetime of the page — long enough
 * that typing in a field is instant, short enough that a template published in another tab
 * is picked up on the next navigation.
 */
let snapshotPromise: Promise<StudentsAiStackSnapshot> | null = null;

export function resolveStudentsAiStack(): Promise<StudentsAiStackSnapshot> {
  if (!snapshotPromise) {
    snapshotPromise = loadSnapshot().catch(() => EMPTY_SNAPSHOT);
  }

  return snapshotPromise;
}

/** Drop the cache, so a screen that has just published a template sees it. */
export function refreshStudentsAiStack(): void {
  snapshotPromise = null;
}

async function loadSnapshot(): Promise<StudentsAiStackSnapshot> {
  // Settled, not all: the template store and the agent engine are different systems and
  // one being unreachable must not cost the caller the other.
  const [templates, agents] = await Promise.allSettled([
    fetchTemplates(STUDENTS_MODULE),
    fetchAgents({ module: STUDENTS_MODULE }),
  ]);

  const rows = templates.status === 'fulfilled' ? templates.value.templates : [];
  const published = rows.filter((row) => row.status === 'published');

  return {
    reportTemplates: published.filter((row) => row.kind === 'report'),
    prompts: published.filter((row) => row.kind === 'prompt'),
    agents: agents.status === 'fulfilled' ? agents.value.filter((agent) => agent.status === 'active') : [],
    degraded: templates.status === 'rejected' && agents.status === 'rejected',
  };
}

/**
 * Pick the record an operation should use, from what is actually published.
 *
 * Preference is a nudge, not a rule: a spec that prefers "roll" gets the roll layout when
 * one exists and the newest published layout when it does not. Returning something
 * reasonable matters more than returning nothing, and returning nothing is still correct
 * when the module has published nothing at all.
 */
function pick(rows: AiTemplateRow[], prefers: string[] = []): AiTemplateRow | null {
  if (rows.length === 0) return null;

  for (const hint of prefers) {
    const needle = hint.toLowerCase();
    const match = rows.find(
      (row) => row.template_key.toLowerCase().includes(needle) || row.name.toLowerCase().includes(needle),
    );
    if (match) return match;
  }

  // Newest first. `updated_at` can be null on rows that predate the column.
  return [...rows].sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))[0] ?? null;
}

/** The report layout a Student report operation should cite, or null when none is published. */
export async function studentsReportTemplateFor(
  operation: StudentsOperationKey,
): Promise<AiTemplateRow | null> {
  const spec = STUDENTS_OPERATIONS[operation];
  const snapshot = await resolveStudentsAiStack();

  return pick(snapshot.reportTemplates, spec?.prefers);
}

/** The prompt a Student generative operation should use, or null when none is published. */
export async function studentsPromptFor(operation: StudentsOperationKey): Promise<AiTemplateRow | null> {
  const spec = STUDENTS_OPERATIONS[operation];
  const snapshot = await resolveStudentsAiStack();

  return pick(snapshot.prompts, spec?.prefers);
}

/** The active Student agent that may run one tool, or null when none is configured. */
export async function studentsAgentForTool(toolKey: string): Promise<Agent | null> {
  const snapshot = await resolveStudentsAiStack();

  return snapshot.agents.find((agent) => agent.tools_allowed.includes(toolKey)) ?? null;
}

/** What a Student screen knows about the thing it just did. */
export interface StudentsOperationDetails {
  status?: RecordModuleActivityInput['status'];
  /** A sentence a person reading the ledger would want. */
  message?: string;
  studentId?: number | null;
  studentName?: string | null;
  /** Report name, class and division, run reference — whatever identifies this run. */
  reference?: string | null;
  /** Figures and filters worth keeping. Kept small; this is a ledger, not a warehouse. */
  result?: Record<string, unknown> | null;
  /** Set when the caller already knows the artefact, e.g. the generation it just ran. */
  templateId?: number | null;
  promptId?: number | null;
  agent?: Agent | null;
  agentRunId?: string | null;
  tool?: string | null;
  workflow?: string | null;
}

/**
 * Record one Student operation in the AI Stack ledger.
 *
 * Resolves whatever the operation's spec says it uses, unless the caller has already
 * supplied it, then writes the entry. Returns whether the entry landed; callers are
 * expected to ignore that, and none of them should await it on a path a user is waiting
 * on.
 */
export async function recordStudentsOperation(
  operation: StudentsOperationKey,
  details: StudentsOperationDetails = {},
): Promise<boolean> {
  const spec = STUDENTS_OPERATIONS[operation];

  if (!spec) {
    console.warn(`[students-ai] "${operation}" is not a known Student operation; not recorded.`);
    return false;
  }

  let templateId = details.templateId ?? null;
  let promptId = details.promptId ?? null;
  let agent = details.agent ?? null;

  try {
    if (spec.uses === 'report_template' && templateId === null) {
      templateId = (await studentsReportTemplateFor(operation))?.id ?? null;
    } else if (spec.uses === 'prompt' && promptId === null) {
      promptId = (await studentsPromptFor(operation))?.id ?? null;
    } else if (spec.uses === 'agent' && agent === null && details.tool) {
      agent = await studentsAgentForTool(details.tool);
    }
  } catch {
    // Resolution is a nicety. An entry naming no artefact is still a true entry, and far
    // better than no entry at all.
  }

  return recordModuleActivitySafely(STUDENTS_MODULE, {
    operation,
    operation_label: spec.label,
    capability: spec.capability,
    status: details.status ?? 'completed',
    message: details.message,
    subject_entity_key: details.studentId ? 'student' : undefined,
    subject_id: details.studentId ?? undefined,
    subject_label: details.studentName ?? undefined,
    reference: details.reference ?? undefined,
    template_id: templateId ?? undefined,
    prompt_id: promptId ?? undefined,
    agent_id: agent?.id ?? undefined,
    agent_name: agent?.name ?? undefined,
    agent_run_id: details.agentRunId ?? undefined,
    workflow: details.workflow ?? undefined,
    tool: details.tool ?? undefined,
    result: details.result ?? undefined,
  });
}

/**
 * Fire-and-forget form, for the end of a Student operation that has already succeeded.
 *
 * Exists so a call site cannot accidentally make the ledger part of a user's wait: this
 * returns nothing to await, and swallows everything.
 */
export function logStudentsOperation(
  operation: StudentsOperationKey,
  details: StudentsOperationDetails = {},
): void {
  void recordStudentsOperation(operation, details).catch(() => undefined);
}
