'use client';

/**
 * Client for governed generation — `POST /api/ai/generate`.
 *
 * A separate file for the same reason `ai-policies.ts` and `ai-templates.ts` are:
 * these are the calls that make a model write something, and they are worth being able
 * to find in one place. Same session read, same envelope handling, same rule that the
 * institute is never a parameter.
 *
 * WHY MODULE SCREENS SHOULD CALL THIS AND NOT A MODEL
 *
 * Everything that makes generation safe happens on the other side of this call, and
 * none of it can be reproduced in the browser:
 *
 *   · the AI policy for this school is resolved and can refuse the request outright,
 *     which is how a rule set on the Fees Policies tab actually reaches a text field;
 *   · the prompt is the stored `ai_templates` row for `template_key`, so what the model
 *     is told is the version an administrator published, not a string in a component;
 *   · the request and its output are written to `ai_generation_requests` /
 *     `ai_generation_outputs`, which is what the Usage & Cost and Guardrails tabs read.
 *
 * So a field that generates through here is governed, costed and auditable by
 * construction, and one that called a model directly would be none of the three.
 *
 * A REFUSAL IS A RESULT, NOT A BUG. The API answers 403 when policy forbids the
 * operation and 422 when the output failed safety or schema validation. Both arrive
 * here as an `AiGenerationError` carrying the reason, because "the policy would not
 * allow that" is something the person at the keyboard needs to read.
 */

import { resolveAiBaseUrl } from '@/app/components/utils/api_url';
import type { AiEnvelope } from './types';

export interface AiGenerationResult {
  succeeded: boolean;
  /** Always true — generated content stays distinguishable from fact. */
  is_generated: boolean;
  content: string | null;
  structured: Record<string, unknown> | unknown[] | null;
  /** The `ai_generation_requests` row, so a caller can cite what produced this. */
  request_id: number | null;
  output_id: number | null;
  provider: string | null;
  model: string | null;
  schema_valid: boolean;
  schema_errors: unknown;
  safety_passed: boolean;
  /** True when the template says a person must read this before it is used. */
  requires_review: boolean;
  error: string | null;
  latency_ms: number | null;
}

export interface AiGenerationInput {
  /** The published `ai_templates` row to render. Never a prompt written inline. */
  template_key: string;
  /** Why this ran, recorded on the request row. */
  purpose: string;
  variables?: Record<string, unknown>;
  subject_entity_key?: string | null;
  subject_id?: number | null;
}

export class AiGenerationError extends Error {
  readonly status: number;

  /** True when an AI policy refused the request rather than the model failing. */
  readonly refusedByPolicy: boolean;

  readonly detail: unknown;

  constructor(message: string, status: number, detail: unknown = null) {
    super(message);
    this.name = 'AiGenerationError';
    this.status = status;
    this.refusedByPolicy = status === 403;
    this.detail = detail;
  }
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

export async function generateContent(input: AiGenerationInput): Promise<AiGenerationResult> {
  const session = readSession();

  if (!session) {
    throw new AiGenerationError('Sign in to use AI assistance.', 401);
  }

  const response = await fetch(`${resolveAiBaseUrl(session.baseUrl)}/api/ai/generate`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.token}`,
      ...(session.instituteId.trim() ? { 'X-MCP-Institute-Id': session.instituteId } : {}),
    },
    body: JSON.stringify(input),
  });

  const text = await response.text();
  let payload: AiEnvelope<AiGenerationResult> & { errors?: unknown };

  try {
    payload = (text.trim() ? JSON.parse(text) : {}) as typeof payload;
  } catch {
    throw new AiGenerationError('The AI service returned a non-JSON response.', response.status);
  }

  if (!response.ok || payload.success === false) {
    throw new AiGenerationError(
      payload.message || `Generation failed (${response.status}).`,
      response.status,
      payload.errors ?? null
    );
  }

  return payload.data as AiGenerationResult;
}
