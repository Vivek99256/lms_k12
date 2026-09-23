'use client';

/**
 * The seam between the Admission module and the Admission AI Stack.
 *
 * WHAT THIS FILE IS FOR
 *
 * Admission screens do admission work — they take an enquiry, register a candidate,
 * confirm a place. They should not also each know how to find the configured Admissions
 * agent, which prompt is published this week, or what an execution ledger entry looks
 * like. This is the one place that knows, so an Admission screen adds AI by calling one
 * function.
 *
 * It is `lib/attendance/attendance-ai-stack.ts` with admission operations in it,
 * deliberately: the two files call the same clients, resolve records the same way, and
 * record to the same ledger. The Fees and Attendance files are untouched by this one —
 * nothing here imports from them and nothing there imports from here — because a shared
 * "module AI stack" abstraction is worth writing once several modules have proved they
 * need the same shape, and folding a working module into one on the way past is how the
 * working module breaks.
 *
 * WHAT IS DECLARED HERE AND WHAT IS LOOKED UP
 *
 * Declared: the catalogue of Admission operations and which AI capability each one leans
 * on. That mapping is application knowledge — it belongs next to the Admission routes —
 * and it is a short, readable list rather than a table somebody has to maintain.
 *
 * Looked up, always, at runtime: every actual record. The agent comes from the Agent
 * Management engine's own store, the prompt and report template from `ai_templates` where
 * `module_key = 'admissions'`. Nothing in this file contains a template key, an agent name
 * or an id. If an administrator publishes a new Admission prompt, the next operation uses
 * it without an edit here; if they retire all of them, operations still complete and the
 * ledger honestly records that no template was used.
 *
 * WHY RECORDING NEVER BLOCKS
 *
 * An enquiry has been taken and a family has been answered before any of this runs. Every
 * entry point below is best-effort: it resolves what it can, records what it can, and
 * returns false rather than throwing. Losing a ledger line is bad; failing an officer's
 * enquiry save because the audit table was busy is worse. Nothing in this file is on the
 * critical path of an Admission operation, and nothing in it may become so.
 */

import { fetchAgents } from '@/lib/agents/client';
import type { Agent } from '@/lib/agents/types';
import { recordModuleActivitySafely, type RecordModuleActivityInput } from '@/lib/intelligence/ai-module';
import { fetchTemplates, type AiTemplateRow } from '@/lib/intelligence/ai-templates';
import type { WorkspaceSession } from '@/lib/intelligence/workspace';

/**
 * The `ai_modules` key, which is `admissions` and not `admission`.
 *
 * The menu slug the category route carries is `admission` — it is derived from the
 * level-2 menu's own name — while the workspace has keyed this module `admissions` since
 * the AI Workspace was first seeded. Both spellings are correct for what they name, and
 * this constant is the one every AI call uses, so a screen never has to decide which.
 */
export const ADMISSIONS_MODULE = 'admissions';

/**
 * The route the Admission AI Stack reports itself as.
 *
 * `/api/ai/workspace/*` resolves which module a call belongs to from the route it is
 * given, so a report built from this screen has to say where it was built from. It is
 * declared once here rather than typed into each screen, because a typo would resolve to
 * the general module and the call would come back "this page is not a module a report can
 * be built from" with nothing to suggest why.
 *
 * This is the category route, and the `admissions` row in `ai_modules` carries the pattern
 * that matches it.
 */
export const ADMISSIONS_AI_STACK_ROUTE = '/modules/admission/ai-stack';

const SESSION_KEYS = { user: 'userData', menu: 'menuContext', year: 'selectedAcademicYear' };

/**
 * The signed-in session, for the workspace calls these screens make.
 *
 * Reads exactly what `hooks/use-ai-workspace.ts` reads, in the same order, so a report
 * built from this tab is scoped identically to one built from the assistant panel. There
 * is no default institute and no default year, and there must never be one: the backend
 * derives the tenant from the bearer token, and a default here could only ever be wrong in
 * the direction of showing one school another school's families.
 */
export function readAdmissionsWorkspaceSession(): WorkspaceSession {
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
 * The Admission operations worth recording, and the AI capability each leans on.
 *
 * `capability` names an `ai_modules` capability flag, so a ledger entry can be read
 * against what the Guardrails tab says Admissions is allowed to do. `uses` says which kind
 * of AI Stack record to resolve for it — and `none` is a real and common answer: an
 * enquiry taken at the front desk is an Admission operation that used no AI, and the
 * ledger should say so rather than attach a template that had nothing to do with it.
 */
export type AdmissionsOperationKey =
  | 'enquiries_viewed'
  | 'enquiry_viewed'
  | 'admission_confirmed'
  | 'admissions_summary'
  | 'pending_admissions_analysed'
  | 'enquiry_pipeline_report'
  | 'registrations_day_report'
  | 'family_follow_up_drafted'
  | 'officer_note_drafted'
  | 'admissions_agent_run';

export type AdmissionsCapability = 'conversational' | 'generative' | 'agent' | 'workflow' | 'ontology';

export interface AdmissionsOperationSpec {
  key: AdmissionsOperationKey;
  label: string;
  capability: AdmissionsCapability | null;
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

export const ADMISSIONS_OPERATIONS: Record<AdmissionsOperationKey, AdmissionsOperationSpec> = {
  enquiries_viewed: {
    key: 'enquiries_viewed',
    label: 'Admission enquiries viewed',
    capability: 'conversational',
    uses: 'none',
  },
  enquiry_viewed: {
    key: 'enquiry_viewed',
    label: 'Admission enquiry opened',
    capability: 'conversational',
    uses: 'none',
  },
  admission_confirmed: {
    key: 'admission_confirmed',
    label: 'Admission confirmed',
    // Confirming is an Admission transaction, not a model call. It is recorded because the
    // ledger has to show what happened in Admissions, and marked `workflow` because that
    // is the capability a confirmation belongs to when one is attached to it.
    capability: 'workflow',
    uses: 'none',
  },
  admissions_summary: {
    key: 'admissions_summary',
    label: 'Admissions summary',
    capability: 'generative',
    uses: 'prompt',
    prefers: ['summary'],
  },
  pending_admissions_analysed: {
    key: 'pending_admissions_analysed',
    label: 'Pending admissions analysed',
    capability: 'generative',
    uses: 'prompt',
    prefers: ['pending', 'stall', 'analysis'],
  },
  enquiry_pipeline_report: {
    key: 'enquiry_pipeline_report',
    label: 'Admission enquiry report',
    capability: 'generative',
    uses: 'report_template',
    // 'enquiry' first, so the pipeline layout is preferred over the day sheet when both
    // are published — the two answer different questions and the names say which.
    prefers: ['enquiry', 'pipeline', 'report'],
  },
  registrations_day_report: {
    key: 'registrations_day_report',
    label: 'Admission registrations day sheet',
    capability: 'generative',
    uses: 'report_template',
    prefers: ['registration', 'today', 'day'],
  },
  family_follow_up_drafted: {
    key: 'family_follow_up_drafted',
    label: 'Admission follow-up to a family drafted',
    capability: 'generative',
    uses: 'prompt',
    // 'follow_up' first, and it matters. These hints are matched against published prompt
    // keys in order, and the nearest wrong match here is the cohort summary prompt — whose
    // grounding variables are `records` and `metrics`. A family-message screen sends one
    // enquiry and its status, never those, so falling through to the summary would refuse
    // every draft for want of grounding and show a 422. This is the failure the Fees
    // remark prompts were published to end; it is avoided here by asking for the prompt
    // that writes a message.
    prefers: ['follow_up', 'follow-up', 'enquiry_follow', 'message'],
  },
  officer_note_drafted: {
    key: 'officer_note_drafted',
    label: 'Admission office note drafted',
    capability: 'generative',
    uses: 'prompt',
    prefers: ['officer', 'note'],
  },
  admissions_agent_run: {
    key: 'admissions_agent_run',
    label: 'Admissions agent run',
    capability: 'agent',
    uses: 'agent',
  },
};

/** Everything configured for Admissions right now, as the database and engine report it. */
export interface AdmissionsAiStackSnapshot {
  /** Published, offered report layouts for Admissions. */
  reportTemplates: AiTemplateRow[];
  /** Published Admission prompts. */
  prompts: AiTemplateRow[];
  /** Active Admission agents from the Agent Management engine. */
  agents: Agent[];
  /** True when neither store could be read — the caller records without artefacts. */
  degraded: boolean;
}

const EMPTY_SNAPSHOT: AdmissionsAiStackSnapshot = {
  reportTemplates: [],
  prompts: [],
  agents: [],
  degraded: true,
};

/**
 * One in-flight load shared by every caller in the page.
 *
 * An enquiry screen, a report screen and a text field can all ask at once; they should
 * cause one pair of requests, not three. Cached for the lifetime of the page — long enough
 * that typing in a field is instant, short enough that a template published in another tab
 * is picked up on the next navigation.
 */
let snapshotPromise: Promise<AdmissionsAiStackSnapshot> | null = null;

export function resolveAdmissionsAiStack(): Promise<AdmissionsAiStackSnapshot> {
  if (!snapshotPromise) {
    snapshotPromise = loadSnapshot().catch(() => EMPTY_SNAPSHOT);
  }

  return snapshotPromise;
}

/** Drop the cache, so a screen that has just published a template sees it. */
export function refreshAdmissionsAiStack(): void {
  snapshotPromise = null;
}

async function loadSnapshot(): Promise<AdmissionsAiStackSnapshot> {
  // Settled, not all: the template store and the agent engine are different systems and
  // one being unreachable must not cost the caller the other.
  const [templates, agents] = await Promise.allSettled([
    fetchTemplates(ADMISSIONS_MODULE),
    fetchAgents({ module: ADMISSIONS_MODULE }),
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
 * Preference is a nudge, not a rule: a spec that prefers "enquiry" gets the pipeline
 * layout when one exists and the newest published layout when it does not. Returning
 * something reasonable matters more than returning nothing, and returning nothing is still
 * correct when the module has published nothing at all.
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

/** The report layout an Admission report operation should cite, or null when none is published. */
export async function admissionsReportTemplateFor(
  operation: AdmissionsOperationKey,
): Promise<AiTemplateRow | null> {
  const spec = ADMISSIONS_OPERATIONS[operation];
  const snapshot = await resolveAdmissionsAiStack();

  return pick(snapshot.reportTemplates, spec?.prefers);
}

/** The prompt an Admission generative operation should use, or null when none is published. */
export async function admissionsPromptFor(operation: AdmissionsOperationKey): Promise<AiTemplateRow | null> {
  const spec = ADMISSIONS_OPERATIONS[operation];
  const snapshot = await resolveAdmissionsAiStack();

  return pick(snapshot.prompts, spec?.prefers);
}

/** The active Admission agent that may run one tool, or null when none is configured. */
export async function admissionsAgentForTool(toolKey: string): Promise<Agent | null> {
  const snapshot = await resolveAdmissionsAiStack();

  return snapshot.agents.find((agent) => agent.tools_allowed.includes(toolKey)) ?? null;
}

/** What an Admission screen knows about the thing it just did. */
export interface AdmissionsOperationDetails {
  status?: RecordModuleActivityInput['status'];
  /** A sentence a person reading the ledger would want. */
  message?: string;
  /** The enquiry this was about, when it was about one. */
  enquiryId?: number | null;
  enquiryLabel?: string | null;
  /** Report name, enquiry number, run reference — whatever identifies this run. */
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
 * Record one Admission operation in the AI Stack ledger.
 *
 * Resolves whatever the operation's spec says it uses, unless the caller has already
 * supplied it, then writes the entry. Returns whether the entry landed; callers are
 * expected to ignore that, and none of them should await it on a path a user is waiting
 * on.
 */
export async function recordAdmissionsOperation(
  operation: AdmissionsOperationKey,
  details: AdmissionsOperationDetails = {},
): Promise<boolean> {
  const spec = ADMISSIONS_OPERATIONS[operation];

  if (!spec) {
    console.warn(`[admissions-ai] "${operation}" is not a known Admission operation; not recorded.`);
    return false;
  }

  let templateId = details.templateId ?? null;
  let promptId = details.promptId ?? null;
  let agent = details.agent ?? null;

  try {
    if (spec.uses === 'report_template' && templateId === null) {
      templateId = (await admissionsReportTemplateFor(operation))?.id ?? null;
    } else if (spec.uses === 'prompt' && promptId === null) {
      promptId = (await admissionsPromptFor(operation))?.id ?? null;
    } else if (spec.uses === 'agent' && agent === null && details.tool) {
      agent = await admissionsAgentForTool(details.tool);
    }
  } catch {
    // Resolution is a nicety. An entry naming no artefact is still a true entry, and far
    // better than no entry at all.
  }

  return recordModuleActivitySafely(ADMISSIONS_MODULE, {
    operation,
    operation_label: spec.label,
    capability: spec.capability,
    status: details.status ?? 'completed',
    message: details.message,
    subject_entity_key: details.enquiryId ? 'enquiry' : undefined,
    subject_id: details.enquiryId ?? undefined,
    subject_label: details.enquiryLabel ?? undefined,
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
 * Fire-and-forget form, for the end of an Admission operation that has already succeeded.
 *
 * Exists so a call site cannot accidentally make the ledger part of a user's wait: this
 * returns nothing to await, and swallows everything.
 */
export function logAdmissionsOperation(
  operation: AdmissionsOperationKey,
  details: AdmissionsOperationDetails = {},
): void {
  void recordAdmissionsOperation(operation, details).catch(() => undefined);
}
