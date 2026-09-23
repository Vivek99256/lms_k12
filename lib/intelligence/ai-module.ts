'use client';

/**
 * Client for one module's own AI usage and guardrails — `/api/ai/modules/{key}/*`.
 *
 * Shaped like `ai-policies.ts` and `ai-templates.ts` on purpose: same session read,
 * same envelope handling, same "the institute is never a parameter" rule. The module
 * key is the only thing a caller names, and it cannot widen access — the backend
 * derives the tenant from the bearer token and at worst the key matches no rows.
 *
 * WHY THE TYPES ADMIT ABSENCE EVERYWHERE
 *
 * Because the backend does. A count is a number; a cost is `number | null` with a
 * `cost_reason` beside it, and a section can come back `available: false` naming the
 * table this estate has not migrated. A screen built on types that promised figures
 * would have to invent them, which is the one thing these screens must not do.
 */

import { resolveAiBaseUrl } from '@/app/components/utils/api_url';
import type { AiEnvelope } from './types';

export interface AiModuleIdentity {
  key: string;
  label: string;
  /** False when the module has no `ai_modules` row — nothing can route its AI yet. */
  registered: boolean;
  status?: number;
  scope?: 'platform' | 'institute';
  /** conversational | generative | agent | workflow | ontology → on or off. */
  capabilities: Record<string, boolean>;
}

/** A section the estate cannot answer, and which table is missing. */
interface Unavailable {
  available: false;
  reason: string;
}

export interface AiModuleTurnDetail {
  available: boolean;
  total?: number;
  avg_duration_ms?: number | null;
  max_duration_ms?: number | null;
  by_status?: Record<string, number>;
  by_intent?: Array<{ intent: string; count: number }>;
}

export type AiModuleConversations =
  | Unavailable
  | {
      available: true;
      total: number;
      turns_recorded_on_conversation: number;
      distinct_users: number;
      first_activity: string | null;
      last_activity: string | null;
      by_status: Record<string, number>;
      turn_detail: AiModuleTurnDetail;
    };

export interface AiModuleRate {
  provider: string;
  model_id: string;
  label: string;
  /** Null when no price is published for the model. Cost then stays null too. */
  input_per_1k: number | null;
  output_per_1k: number | null;
}

export interface AiModuleTokens {
  outputs: number;
  reviewed: number;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  avg_latency_ms: number | null;
  rate: AiModuleRate | null;
  cost: number | null;
  /** `recorded` came from the output rows, `computed` from tokens × rate. */
  cost_source: 'recorded' | 'computed' | 'unavailable';
  /** Why there is no money figure. Shown verbatim rather than paraphrased. */
  cost_reason: string | null;
}

export type AiModuleGeneration =
  | Unavailable
  | {
      available: true;
      total: number;
      by_status: Record<string, number>;
      tokens: AiModuleTokens;
    };

export type AiModuleReports =
  | Unavailable
  | {
      available: true;
      total: number;
      rows_reported: number;
      last_created: string | null;
      by_tool: Array<{ tool: string; count: number }>;
    };

export type AiModuleProvider =
  | Unavailable
  | {
      available: true;
      /** False when the module shares an unbound credential with every other module. */
      bound: boolean;
      provider: string | null;
      model: string | null;
      daily_limit: number | null;
      scope: 'platform' | 'institute' | null;
      daily_calls: Array<{ date: string; count: number }> | null;
    };

export interface AiModuleTurn {
  id: number;
  question: string;
  intent: string | null;
  confidence: number | null;
  status: string;
  duration_ms: number | null;
  user_id: number | null;
  conversation: string;
  created_at: string | null;
}

export interface AiModuleUsage {
  module: AiModuleIdentity;
  conversations: AiModuleConversations;
  generation: AiModuleGeneration;
  reports: AiModuleReports;
  provider: AiModuleProvider;
  recent_turns: AiModuleTurn[];
  daily: Array<{ date: string; turns: number }>;
}

export type AiModuleReview =
  | Unavailable
  | {
      available: true;
      templates: number;
      published: number;
      requires_review: number;
      allowed_as_evidence: number;
    };

/** One request a rule refused, with the verdict and the reason recorded. */
export interface AiModuleRefusal {
  id: number;
  reference: string;
  template_key: string | null;
  purpose: string | null;
  status: string;
  reason: string | null;
  provider: string | null;
  model: string | null;
  requested_by: number | null;
  requested_by_role: string | null;
  created_at: string | null;
}

export interface AiModuleGuardrails {
  module: AiModuleIdentity;
  capabilities: Record<string, boolean>;
  review: AiModuleReview;
  refusals: AiModuleRefusal[];
  refusal_counts: Array<{ status: string; count: number }>;
}

function readSession(): { token: string; instituteId: string; baseUrl: string } | null {
  if (typeof window === 'undefined') return null;

  try {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}') as Record<string, unknown>;
    const menuContext = JSON.parse(localStorage.getItem('menuContext') || '{}') as Record<string, unknown>;

    const token = String(
      userData.user_token ?? userData.token ?? menuContext.user_token ?? menuContext.token ?? ''
    );

    if (!token) return null;

    return {
      token,
      instituteId: String(userData.sub_institute_id ?? menuContext.sub_institute_id ?? ''),
      baseUrl: String(userData.host_name ?? ''),
    };
  } catch {
    return null;
  }
}

async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const session = readSession();

  if (!session) {
    throw new Error('Sign in to read AI usage for this module.');
  }

  const response = await fetch(`${resolveAiBaseUrl(session.baseUrl)}/api/ai${path}`, {
    method: init.method ?? 'GET',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${session.token}`,
      ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(session.instituteId.trim() ? { 'X-MCP-Institute-Id': session.instituteId } : {}),
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });

  const text = await response.text();
  let payload: AiEnvelope<T>;

  try {
    payload = (text.trim() ? JSON.parse(text) : {}) as AiEnvelope<T>;
  } catch {
    throw new Error('The AI console returned a non-JSON response.');
  }

  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || `The request failed (${response.status}).`);
  }

  return payload.data as T;
}

export function fetchModuleUsage(moduleKey: string): Promise<AiModuleUsage> {
  return call<AiModuleUsage>(`/modules/${encodeURIComponent(moduleKey)}/usage`);
}

export function fetchModuleGuardrails(moduleKey: string): Promise<AiModuleGuardrails> {
  return call<AiModuleGuardrails>(`/modules/${encodeURIComponent(moduleKey)}/guardrails`);
}

// ---------------------------------------------------------------------------
// Activity — the execution ledger
// ---------------------------------------------------------------------------

/**
 * The AI Stack records one operation used.
 *
 * Every slot is optional and each is a real configured record: a template or prompt
 * resolved by the backend out of `ai_templates` (and refused outright if it belongs to
 * another module), an agent as the Agent Management engine issued it. An operation that
 * used no template reports none — a ledger row saying "no template" is worth more than
 * one that names a plausible file.
 */
export interface AiModuleActivityArtifact {
  id: number;
  key: string;
  name: string;
  kind: string;
  version: number;
  status: string;
}

export interface AiModuleActivityUsed {
  template?: AiModuleActivityArtifact;
  prompt?: AiModuleActivityArtifact;
  agent?: { id: string | null; name: string | null; run_id: string | null; source: string };
  workflow?: string;
  tool?: string;
}

export type AiModuleActivityStatus = 'completed' | 'failed' | 'denied' | 'skipped';

export interface AiModuleActivityEntry {
  id: number;
  operation: string;
  operation_label: string | null;
  capability: string | null;
  status: AiModuleActivityStatus;
  outcome: string | null;
  message: string | null;
  actor_id: number | null;
  actor_label: string | null;
  subject_entity_key: string | null;
  subject_id: number | null;
  subject_label: string | null;
  reference: string | null;
  used: AiModuleActivityUsed;
  result: Record<string, unknown> | null;
  created_at: string | null;
}

export interface AiModuleActivity {
  module: AiModuleIdentity;
  available: boolean;
  reason?: string;
  total: number;
  entries: AiModuleActivityEntry[];
  by_operation: Array<{ operation: string; outcome: string; count: number }>;
}

/** What a module screen reports after it has finished doing something. */
export interface RecordModuleActivityInput {
  /** Stable slug for the operation, e.g. `fee_collection`. */
  operation: string;
  operation_label?: string;
  /** The `ai_modules` capability this leaned on: generative, agent, conversational… */
  capability?: string | null;
  status: AiModuleActivityStatus;
  message?: string;
  subject_entity_key?: string | null;
  subject_id?: number | null;
  subject_label?: string | null;
  reference?: string | null;
  template_id?: number | null;
  prompt_id?: number | null;
  agent_id?: string | null;
  agent_name?: string | null;
  agent_run_id?: string | null;
  workflow?: string | null;
  tool?: string | null;
  result?: Record<string, unknown> | null;
}

export function fetchModuleActivity(
  moduleKey: string,
  filter: { operation?: string; outcome?: string; subjectId?: number; limit?: number } = {},
): Promise<AiModuleActivity> {
  const params = new URLSearchParams();
  if (filter.operation) params.set('operation', filter.operation);
  if (filter.outcome) params.set('outcome', filter.outcome);
  if (filter.subjectId) params.set('subject_id', String(filter.subjectId));
  if (filter.limit) params.set('limit', String(filter.limit));
  const query = params.toString();

  return call<AiModuleActivity>(`/modules/${encodeURIComponent(moduleKey)}/activity${query ? `?${query}` : ''}`);
}

/**
 * Write one entry into the module's ledger.
 *
 * Deliberately returns rather than throws on a failed write — see
 * `recordModuleActivitySafely`, which is what module screens actually call.
 */
export function recordModuleActivity(
  moduleKey: string,
  input: RecordModuleActivityInput,
): Promise<{ recorded: boolean; id: number | null }> {
  // Undefined keys are stripped so an omitted field is genuinely omitted rather than
  // arriving as null and tripping a `nullable|integer` rule on something it shouldn't.
  const body = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));

  return call<{ recorded: boolean; id: number | null }>(
    `/modules/${encodeURIComponent(moduleKey)}/activity`,
    { method: 'POST', body },
  );
}

/**
 * Record an entry, and never let the recording break the thing being recorded.
 *
 * THIS IS THE ONE MODULE SCREENS SHOULD CALL. A fee has been collected and a receipt
 * issued by the time this runs; if the ledger write fails — offline, token expired,
 * table locked — the correct behaviour is a console warning and a returned `false`, not
 * an error thrown into a component that has already succeeded at its actual job. Losing
 * a ledger line is bad. Showing a parent an error after taking their money is worse.
 */
export async function recordModuleActivitySafely(
  moduleKey: string,
  input: RecordModuleActivityInput,
): Promise<boolean> {
  try {
    const result = await recordModuleActivity(moduleKey, input);
    return result.recorded;
  } catch (cause) {
    console.warn(`[ai-activity] ${moduleKey}.${input.operation} was not recorded:`, cause);
    return false;
  }
}
