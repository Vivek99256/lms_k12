'use client';

/**
 * The seam between the Fees module and the Fees AI Stack.
 *
 * WHAT THIS FILE IS FOR
 *
 * Fees screens do fee work — they collect money, print receipts, run reports. They
 * should not also each know how to find the configured Fees agent, which prompt is
 * published this week, or what an execution ledger entry looks like. This is the one
 * place that knows, so a Fees screen adds AI by calling one function.
 *
 * WHAT IS DECLARED HERE AND WHAT IS LOOKED UP
 *
 * Declared: the catalogue of Fees operations and which AI capability each one leans on.
 * That mapping is application knowledge — it belongs next to the Fees routes, for the
 * same reason `module-handoff.ts` keeps route knowledge out of Laravel — and it is a
 * short, readable list rather than a table somebody has to maintain.
 *
 * Looked up, always, at runtime: every actual record. The agent comes from the Agent
 * Management engine's own store, the prompt and report template from `ai_templates`
 * where `module_key = 'fees'`. Nothing in this file contains a template key, an agent
 * name or an id. If an administrator publishes a new Fees prompt, the next operation
 * uses it without an edit here; if they retire all of them, operations still complete
 * and the ledger honestly records that no template was used.
 *
 * WHY RECORDING NEVER BLOCKS
 *
 * A fee has been collected and a receipt issued before any of this runs. Every entry
 * point below is best-effort: it resolves what it can, records what it can, and returns
 * false rather than throwing. Losing a ledger line is bad; failing a parent's payment
 * because the audit table was busy is worse. Nothing in this file is on the critical
 * path of a Fees operation, and nothing in it may become so.
 */

import { fetchAgents } from '@/lib/agents/client';
import type { Agent } from '@/lib/agents/types';
import { recordModuleActivitySafely, type RecordModuleActivityInput } from '@/lib/intelligence/ai-module';
import { fetchTemplates, type AiTemplateRow } from '@/lib/intelligence/ai-templates';

export const FEES_MODULE = 'fees';

/**
 * The Fees operations worth recording, and the AI capability each leans on.
 *
 * `capability` names an `ai_modules` capability flag, so a ledger entry can be read
 * against what the Guardrails tab says Fees is allowed to do. `uses` says which kind of
 * AI Stack record to resolve for it — and `none` is a real and common answer: a plain
 * fee collection is a Fees operation that used no AI, and the ledger should say so
 * rather than attach a template that had nothing to do with it.
 */
export type FeesOperationKey =
  | 'fee_collection'
  | 'other_fee_collection'
  | 'fee_cancellation'
  | 'fee_report'
  | 'defaulter_report'
  | 'student_fee_details'
  | 'online_payment'
  | 'remarks_drafted'
  | 'circular_drafted'
  | 'communication_drafted'
  | 'reminder_drafted';

export type FeesCapability = 'conversational' | 'generative' | 'agent' | 'workflow' | 'ontology';

export interface FeesOperationSpec {
  key: FeesOperationKey;
  label: string;
  capability: FeesCapability | null;
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

export const FEES_OPERATIONS: Record<FeesOperationKey, FeesOperationSpec> = {
  fee_collection: {
    key: 'fee_collection',
    label: 'Fee collection',
    // Collection itself is a Fees transaction, not a model call. It is recorded because
    // the ledger has to show what happened in Fees, and marked `workflow` because that
    // is the capability a collection belongs to when one is attached to it.
    capability: 'workflow',
    uses: 'none',
  },
  other_fee_collection: {
    key: 'other_fee_collection',
    label: 'Other fee collection',
    capability: 'workflow',
    uses: 'none',
  },
  fee_cancellation: {
    key: 'fee_cancellation',
    label: 'Fee cancellation',
    capability: 'workflow',
    uses: 'none',
  },
  fee_report: {
    key: 'fee_report',
    label: 'Fee report',
    capability: 'generative',
    uses: 'report_template',
    prefers: ['collection', 'report'],
  },
  defaulter_report: {
    key: 'defaulter_report',
    label: 'Fee defaulter report',
    capability: 'generative',
    uses: 'report_template',
    prefers: ['defaulter', 'pending', 'arrears'],
  },
  student_fee_details: {
    key: 'student_fee_details',
    label: 'Student fee details',
    capability: 'conversational',
    uses: 'none',
  },
  online_payment: {
    key: 'online_payment',
    label: 'Online fee payment',
    capability: 'workflow',
    uses: 'none',
  },
  remarks_drafted: {
    key: 'remarks_drafted',
    label: 'Collection remarks drafted',
    capability: 'generative',
    uses: 'prompt',
    prefers: ['pending', 'summary'],
  },
  circular_drafted: {
    key: 'circular_drafted',
    label: 'Fee circular drafted',
    capability: 'generative',
    uses: 'prompt',
    prefers: ['circular', 'pending', 'summary'],
  },
  communication_drafted: {
    key: 'communication_drafted',
    label: 'Fee communication drafted',
    capability: 'generative',
    uses: 'prompt',
    prefers: ['reminder', 'pending', 'summary'],
  },
  reminder_drafted: {
    key: 'reminder_drafted',
    label: 'Fee reminder drafted',
    capability: 'agent',
    uses: 'agent',
  },
};

/** Everything configured for Fees right now, as the database and engine report it. */
export interface FeesAiStackSnapshot {
  /** Published, offered report layouts for Fees. */
  reportTemplates: AiTemplateRow[];
  /** Published Fees prompts. */
  prompts: AiTemplateRow[];
  /** Active Fees agents from the Agent Management engine. */
  agents: Agent[];
  /** True when neither store could be read — the caller records without artefacts. */
  degraded: boolean;
}

const EMPTY_SNAPSHOT: FeesAiStackSnapshot = {
  reportTemplates: [],
  prompts: [],
  agents: [],
  degraded: true,
};

/**
 * One in-flight load shared by every caller in the page.
 *
 * A fee collection screen, a report screen and a text field can all ask at once; they
 * should cause one pair of requests, not three. Cached for the lifetime of the page —
 * long enough that typing in a field is instant, short enough that a template published
 * in another tab is picked up on the next navigation.
 */
let snapshotPromise: Promise<FeesAiStackSnapshot> | null = null;

export function resolveFeesAiStack(): Promise<FeesAiStackSnapshot> {
  if (!snapshotPromise) {
    snapshotPromise = loadSnapshot().catch(() => EMPTY_SNAPSHOT);
  }

  return snapshotPromise;
}

/** Drop the cache, so a screen that has just published a template sees it. */
export function refreshFeesAiStack(): void {
  snapshotPromise = null;
}

async function loadSnapshot(): Promise<FeesAiStackSnapshot> {
  // Settled, not all: the template store and the agent engine are different systems and
  // one being unreachable must not cost the caller the other.
  const [templates, agents] = await Promise.allSettled([
    fetchTemplates(FEES_MODULE),
    fetchAgents({ module: FEES_MODULE }),
  ]);

  const rows = templates.status === 'fulfilled' ? templates.value.templates : [];
  const published = rows.filter((row) => row.status === 'published');

  return {
    reportTemplates: published.filter((row) => row.kind === 'report'),
    prompts: published.filter((row) => row.kind === 'prompt'),
    agents:
      agents.status === 'fulfilled'
        ? agents.value.filter((agent) => agent.status === 'active')
        : [],
    degraded: templates.status === 'rejected' && agents.status === 'rejected',
  };
}

/**
 * Pick the record an operation should use, from what is actually published.
 *
 * Preference is a nudge, not a rule: a spec that prefers "defaulter" gets the defaulter
 * template when one exists and the newest published layout when it does not. Returning
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

/** The report layout a Fees report operation should cite, or null when none is published. */
export async function feesReportTemplateFor(operation: FeesOperationKey): Promise<AiTemplateRow | null> {
  const spec = FEES_OPERATIONS[operation];
  const snapshot = await resolveFeesAiStack();

  return pick(snapshot.reportTemplates, spec?.prefers);
}

/** The prompt a Fees generative operation should use, or null when none is published. */
export async function feesPromptFor(operation: FeesOperationKey): Promise<AiTemplateRow | null> {
  const spec = FEES_OPERATIONS[operation];
  const snapshot = await resolveFeesAiStack();

  return pick(snapshot.prompts, spec?.prefers);
}

/** The active Fees agent that may run one tool, or null when none is configured. */
export async function feesAgentForTool(toolKey: string): Promise<Agent | null> {
  const snapshot = await resolveFeesAiStack();

  return snapshot.agents.find((agent) => agent.tools_allowed.includes(toolKey)) ?? null;
}

/** What a Fees screen knows about the thing it just did. */
export interface FeesOperationDetails {
  status?: RecordModuleActivityInput['status'];
  /** A sentence a person reading the ledger would want. */
  message?: string;
  studentId?: number | null;
  studentName?: string | null;
  /** Receipt number, report name, payment reference — whatever identifies this run. */
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
 * Record one Fees operation in the AI Stack ledger.
 *
 * Resolves whatever the operation's spec says it uses, unless the caller has already
 * supplied it, then writes the entry. Returns whether the entry landed; callers are
 * expected to ignore that, and none of them should await it on a path a user is
 * waiting on.
 */
export async function recordFeesOperation(
  operation: FeesOperationKey,
  details: FeesOperationDetails = {},
): Promise<boolean> {
  const spec = FEES_OPERATIONS[operation];

  if (!spec) {
    console.warn(`[fees-ai] "${operation}" is not a known Fees operation; not recorded.`);
    return false;
  }

  let templateId = details.templateId ?? null;
  let promptId = details.promptId ?? null;
  let agent = details.agent ?? null;

  try {
    if (spec.uses === 'report_template' && templateId === null) {
      templateId = (await feesReportTemplateFor(operation))?.id ?? null;
    } else if (spec.uses === 'prompt' && promptId === null) {
      promptId = (await feesPromptFor(operation))?.id ?? null;
    } else if (spec.uses === 'agent' && agent === null && details.tool) {
      agent = await feesAgentForTool(details.tool);
    }
  } catch {
    // Resolution is a nicety. An entry naming no artefact is still a true entry, and
    // far better than no entry at all.
  }

  return recordModuleActivitySafely(FEES_MODULE, {
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
 * Fire-and-forget form, for the end of a Fees operation that has already succeeded.
 *
 * Exists so a call site cannot accidentally make the ledger part of a user's wait: this
 * returns nothing to await, and swallows everything.
 */
export function logFeesOperation(operation: FeesOperationKey, details: FeesOperationDetails = {}): void {
  void recordFeesOperation(operation, details).catch(() => undefined);
}
