'use client';

/**
 * The seam between the Attendance module and the Attendance AI Stack.
 *
 * WHAT THIS FILE IS FOR
 *
 * Attendance screens do attendance work — they mark registers, show a day, print a
 * monthly sheet. They should not also each know how to find the configured Attendance
 * agent, which prompt is published this week, or what an execution ledger entry looks
 * like. This is the one place that knows, so an Attendance screen adds AI by calling one
 * function.
 *
 * It is `lib/fees/fees-ai-stack.ts` with attendance operations in it, deliberately: the
 * two files call the same clients, resolve records the same way, and record to the same
 * ledger. The Fees file is untouched by this one — nothing here imports from it and
 * nothing there imports from here — because a shared "module AI stack" abstraction is
 * worth writing once two modules have proved they need the same shape, and folding a
 * working module into one on the way past is how the working module breaks.
 *
 * WHAT IS DECLARED HERE AND WHAT IS LOOKED UP
 *
 * Declared: the catalogue of Attendance operations and which AI capability each one leans
 * on. That mapping is application knowledge — it belongs next to the Attendance routes —
 * and it is a short, readable list rather than a table somebody has to maintain.
 *
 * Looked up, always, at runtime: every actual record. The agent comes from the Agent
 * Management engine's own store, the prompt and report template from `ai_templates` where
 * `module_key = 'attendance'`. Nothing in this file contains a template key, an agent
 * name or an id. If an administrator publishes a new Attendance prompt, the next
 * operation uses it without an edit here; if they retire all of them, operations still
 * complete and the ledger honestly records that no template was used.
 *
 * WHY RECORDING NEVER BLOCKS
 *
 * A register has been marked and a parent has been told before any of this runs. Every
 * entry point below is best-effort: it resolves what it can, records what it can, and
 * returns false rather than throwing. Losing a ledger line is bad; failing a teacher's
 * register save because the audit table was busy is worse. Nothing in this file is on the
 * critical path of an Attendance operation, and nothing in it may become so.
 */

import { fetchAgents } from '@/lib/agents/client';
import type { Agent } from '@/lib/agents/types';
import { recordModuleActivitySafely, type RecordModuleActivityInput } from '@/lib/intelligence/ai-module';
import { fetchTemplates, type AiTemplateRow } from '@/lib/intelligence/ai-templates';
import type { WorkspaceSession } from '@/lib/intelligence/workspace';

export const ATTENDANCE_MODULE = 'attendance';

/**
 * The route the Attendance AI Stack reports itself as.
 *
 * `/api/ai/workspace/*` resolves which module a call belongs to from the route it is
 * given, so a report built from this screen has to say where it was built from. It is
 * declared once here rather than typed into each screen, because a typo would resolve to
 * the general module and the call would come back "this page is not a module a report can
 * be built from" with nothing to suggest why.
 */
export const ATTENDANCE_AI_STACK_ROUTE = '/modules/attendance/ai-stack';

const SESSION_KEYS = { user: 'userData', menu: 'menuContext', year: 'selectedAcademicYear' };

/**
 * The signed-in session, for the workspace calls these screens make.
 *
 * Reads exactly what `hooks/use-ai-workspace.ts` reads, in the same order, so a report
 * built from this tab is scoped identically to one built from the assistant panel. There
 * is no default institute and no default year, and there must never be one: the backend
 * derives the tenant from the bearer token, and a default here could only ever be wrong
 * in the direction of showing one school another school's children.
 */
export function readAttendanceWorkspaceSession(): WorkspaceSession {
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
 * The Attendance operations worth recording, and the AI capability each leans on.
 *
 * `capability` names an `ai_modules` capability flag, so a ledger entry can be read
 * against what the Guardrails tab says Attendance is allowed to do. `uses` says which
 * kind of AI Stack record to resolve for it — and `none` is a real and common answer: a
 * register marked by a class teacher is an Attendance operation that used no AI, and the
 * ledger should say so rather than attach a template that had nothing to do with it.
 */
export type AttendanceOperationKey =
  | 'register_marked'
  | 'attendance_viewed'
  | 'student_attendance_viewed'
  | 'attendance_summary'
  | 'low_attendance_report'
  | 'class_attendance_report'
  | 'parent_notification_drafted'
  | 'teacher_follow_up_drafted'
  | 'absence_analysis'
  | 'attendance_agent_run';

export type AttendanceCapability = 'conversational' | 'generative' | 'agent' | 'workflow' | 'ontology';

export interface AttendanceOperationSpec {
  key: AttendanceOperationKey;
  label: string;
  capability: AttendanceCapability | null;
  /** Which AI Stack record, if any, this operation resolves and records. */
  uses: 'report_template' | 'prompt' | 'agent' | 'none';
  /**
   * A hint for choosing between several published records of the right kind.
   *
   * Matched against the template key and name, case-insensitively. It is a preference,
   * never a requirement: when nothing matches, the newest published record of that kind
   * is used, and when there is none the operation records without one.
   */
  prefers?: string[];
}

export const ATTENDANCE_OPERATIONS: Record<AttendanceOperationKey, AttendanceOperationSpec> = {
  register_marked: {
    key: 'register_marked',
    label: 'Register marked',
    // Marking is an Attendance transaction, not a model call. It is recorded because the
    // ledger has to show what happened in Attendance, and marked `workflow` because that
    // is the capability a register save belongs to when one is attached to it.
    capability: 'workflow',
    uses: 'none',
  },
  attendance_viewed: {
    key: 'attendance_viewed',
    label: 'Attendance viewed',
    capability: 'conversational',
    uses: 'none',
  },
  student_attendance_viewed: {
    key: 'student_attendance_viewed',
    label: "Student's attendance viewed",
    capability: 'conversational',
    uses: 'none',
  },
  attendance_summary: {
    key: 'attendance_summary',
    label: 'Attendance summary',
    capability: 'generative',
    uses: 'prompt',
    prefers: ['summary'],
  },
  low_attendance_report: {
    key: 'low_attendance_report',
    label: 'Low attendance report',
    capability: 'generative',
    uses: 'report_template',
    // 'low' first, so the low-attendance layout is preferred over the class sheet when
    // both are published — the two answer different questions and the names say which.
    prefers: ['low', 'absence', 'report'],
  },
  class_attendance_report: {
    key: 'class_attendance_report',
    label: 'Class attendance report',
    capability: 'generative',
    uses: 'report_template',
    prefers: ['class', 'report'],
  },
  parent_notification_drafted: {
    key: 'parent_notification_drafted',
    label: 'Attendance message to a parent drafted',
    capability: 'generative',
    uses: 'prompt',
    // 'parent' first, and it matters. These hints are matched against published prompt
    // keys in order, and the nearest wrong match here is the cohort summary prompt —
    // whose grounding variables are `records` and `metrics`. A parent-message screen
    // sends one student and some day counts, never those, so falling through to the
    // summary would refuse every draft for want of grounding and show a 422. This is
    // the failure the Fees remark prompts were published to end; it is avoided here by
    // asking for the prompt that writes a message.
    prefers: ['parent', 'notification', 'message'],
  },
  teacher_follow_up_drafted: {
    key: 'teacher_follow_up_drafted',
    label: 'Attendance follow-up note drafted',
    capability: 'generative',
    uses: 'prompt',
    prefers: ['follow_up', 'follow-up', 'teacher', 'note'],
  },
  absence_analysis: {
    key: 'absence_analysis',
    label: 'Absenteeism analysed',
    capability: 'generative',
    uses: 'prompt',
    prefers: ['low_attendance', 'low', 'trend'],
  },
  attendance_agent_run: {
    key: 'attendance_agent_run',
    label: 'Attendance agent run',
    capability: 'agent',
    uses: 'agent',
  },
};

/** Everything configured for Attendance right now, as the database and engine report it. */
export interface AttendanceAiStackSnapshot {
  /** Published, offered report layouts for Attendance. */
  reportTemplates: AiTemplateRow[];
  /** Published Attendance prompts. */
  prompts: AiTemplateRow[];
  /** Active Attendance agents from the Agent Management engine. */
  agents: Agent[];
  /** True when neither store could be read — the caller records without artefacts. */
  degraded: boolean;
}

const EMPTY_SNAPSHOT: AttendanceAiStackSnapshot = {
  reportTemplates: [],
  prompts: [],
  agents: [],
  degraded: true,
};

/**
 * One in-flight load shared by every caller in the page.
 *
 * A register screen, a report screen and a text field can all ask at once; they should
 * cause one pair of requests, not three. Cached for the lifetime of the page — long
 * enough that typing in a field is instant, short enough that a template published in
 * another tab is picked up on the next navigation.
 */
let snapshotPromise: Promise<AttendanceAiStackSnapshot> | null = null;

export function resolveAttendanceAiStack(): Promise<AttendanceAiStackSnapshot> {
  if (!snapshotPromise) {
    snapshotPromise = loadSnapshot().catch(() => EMPTY_SNAPSHOT);
  }

  return snapshotPromise;
}

/** Drop the cache, so a screen that has just published a template sees it. */
export function refreshAttendanceAiStack(): void {
  snapshotPromise = null;
}

async function loadSnapshot(): Promise<AttendanceAiStackSnapshot> {
  // Settled, not all: the template store and the agent engine are different systems and
  // one being unreachable must not cost the caller the other.
  const [templates, agents] = await Promise.allSettled([
    fetchTemplates(ATTENDANCE_MODULE),
    fetchAgents({ module: ATTENDANCE_MODULE }),
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
 * Preference is a nudge, not a rule: a spec that prefers "low" gets the low-attendance
 * layout when one exists and the newest published layout when it does not. Returning
 * something reasonable matters more than returning nothing, and returning nothing is
 * still correct when the module has published nothing at all.
 */
function pick(rows: AiTemplateRow[], prefers: string[] = []): AiTemplateRow | null {
  if (rows.length === 0) return null;

  for (const hint of prefers) {
    const needle = hint.toLowerCase();
    const match = rows.find(
      (row) =>
        row.template_key.toLowerCase().includes(needle) || row.name.toLowerCase().includes(needle),
    );
    if (match) return match;
  }

  // Newest first. `updated_at` can be null on rows that predate the column.
  return [...rows].sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))[0] ?? null;
}

/** The report layout an Attendance report operation should cite, or null when none is published. */
export async function attendanceReportTemplateFor(
  operation: AttendanceOperationKey,
): Promise<AiTemplateRow | null> {
  const spec = ATTENDANCE_OPERATIONS[operation];
  const snapshot = await resolveAttendanceAiStack();

  return pick(snapshot.reportTemplates, spec?.prefers);
}

/** The prompt an Attendance generative operation should use, or null when none is published. */
export async function attendancePromptFor(
  operation: AttendanceOperationKey,
): Promise<AiTemplateRow | null> {
  const spec = ATTENDANCE_OPERATIONS[operation];
  const snapshot = await resolveAttendanceAiStack();

  return pick(snapshot.prompts, spec?.prefers);
}

/** The active Attendance agent that may run one tool, or null when none is configured. */
export async function attendanceAgentForTool(toolKey: string): Promise<Agent | null> {
  const snapshot = await resolveAttendanceAiStack();

  return snapshot.agents.find((agent) => agent.tools_allowed.includes(toolKey)) ?? null;
}

/** What an Attendance screen knows about the thing it just did. */
export interface AttendanceOperationDetails {
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
 * Record one Attendance operation in the AI Stack ledger.
 *
 * Resolves whatever the operation's spec says it uses, unless the caller has already
 * supplied it, then writes the entry. Returns whether the entry landed; callers are
 * expected to ignore that, and none of them should await it on a path a user is waiting
 * on.
 */
export async function recordAttendanceOperation(
  operation: AttendanceOperationKey,
  details: AttendanceOperationDetails = {},
): Promise<boolean> {
  const spec = ATTENDANCE_OPERATIONS[operation];

  if (!spec) {
    console.warn(`[attendance-ai] "${operation}" is not a known Attendance operation; not recorded.`);
    return false;
  }

  let templateId = details.templateId ?? null;
  let promptId = details.promptId ?? null;
  let agent = details.agent ?? null;

  try {
    if (spec.uses === 'report_template' && templateId === null) {
      templateId = (await attendanceReportTemplateFor(operation))?.id ?? null;
    } else if (spec.uses === 'prompt' && promptId === null) {
      promptId = (await attendancePromptFor(operation))?.id ?? null;
    } else if (spec.uses === 'agent' && agent === null && details.tool) {
      agent = await attendanceAgentForTool(details.tool);
    }
  } catch {
    // Resolution is a nicety. An entry naming no artefact is still a true entry, and far
    // better than no entry at all.
  }

  return recordModuleActivitySafely(ATTENDANCE_MODULE, {
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
 * Fire-and-forget form, for the end of an Attendance operation that has already
 * succeeded.
 *
 * Exists so a call site cannot accidentally make the ledger part of a user's wait: this
 * returns nothing to await, and swallows everything.
 */
export function logAttendanceOperation(
  operation: AttendanceOperationKey,
  details: AttendanceOperationDetails = {},
): void {
  void recordAttendanceOperation(operation, details).catch(() => undefined);
}
