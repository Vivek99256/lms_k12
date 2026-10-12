'use client';

import { resolveAiBaseUrl } from '@/app/components/utils/api_url';
import type { AiEnvelope } from './types';

/**
 * Client for the AI & Intelligence console — `/api/ai/capabilities`.
 *
 * NOTHING HERE NAMES A SCHOOL
 *
 * The institute is not a parameter. `McpContextHydrator` derives it from the bearer
 * token on the server, so the only thing this file sends is that token; the
 * `X-MCP-Institute-Id` header below mirrors what the workspace client already does
 * and lets the backend pick the right one when a token spans several, but it is
 * read from the signed-in session, never written down. There is no default institute
 * id in this file and there must never be one — a fallback tenant id is how one
 * school's console ends up showing another school's rows.
 */

export type CapabilityState = 'live' | 'empty' | 'unavailable';

export interface CapabilityMetric {
  key: string;
  label: string;
  value: number;
}

export interface CapabilityTable {
  columns: Array<{ key: string; label: string }>;
  rows: Array<Record<string, string | null>>;
}

export interface CapabilitySummary {
  key: string;
  state: CapabilityState;
  count: number;
  primary_table?: string;
  missing_tables?: string[];
}

export interface CapabilityDetail {
  key: string;
  sub_institute_id: string | number;
  state: CapabilityState;
  metrics: CapabilityMetric[];
  table: CapabilityTable | null;
  missing_tables?: string[];
}

export interface CapabilityIndex {
  sub_institute_id: string | number;
  capabilities: CapabilitySummary[];
}

/**
 * The signed-in session, read from where the rest of the app keeps it.
 *
 * Returns null when there is no token — the caller renders a signed-out state
 * rather than firing a request that can only 401.
 */
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

export class AiCapabilityError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AiCapabilityError';
    this.status = status;
  }
}

async function get<T>(path: string): Promise<T> {
  const session = readSession();

  if (!session) {
    throw new AiCapabilityError('Sign in to view AI capabilities.', 401);
  }

  const baseUrl = resolveAiBaseUrl(session.baseUrl);

  const response = await fetch(`${baseUrl}/api/ai/capabilities${path}`, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${session.token}`,
      // Only sent when the session actually carries one. An empty header is worse
      // than none: it reads as a deliberate request for institute "".
      ...(session.instituteId.trim() ? { 'X-MCP-Institute-Id': session.instituteId } : {}),
    },
  });

  const text = await response.text();
  let payload: AiEnvelope<T>;

  try {
    payload = (text.trim() ? JSON.parse(text) : {}) as AiEnvelope<T>;
  } catch {
    throw new AiCapabilityError('The AI console returned a non-JSON response.', response.status);
  }

  if (!response.ok || payload.success === false) {
    throw new AiCapabilityError(
      payload.message || `The AI console request failed (${response.status}).`,
      response.status
    );
  }

  return payload.data as T;
}

export function fetchCapabilities(): Promise<CapabilityIndex> {
  return get<CapabilityIndex>('');
}

export function fetchCapability(slug: string): Promise<CapabilityDetail> {
  return get<CapabilityDetail>(`/${encodeURIComponent(slug)}`);
}

// ---------------------------------------------------------------------------
// Knowledge & RAG — `POST /api/ai/knowledge-rag/ask`.
//
// The one real action this capability has today: ask a free-text question
// and get back an answer grounded in this institute's own ingested
// curriculum content, or an honest `insufficient_evidence` /
// `model_unavailable` when it cannot. Not nested under `/capabilities` like
// the rest of this file — that path is the read-only "what's configured"
// panel every capability shares; this is the one capability-specific action
// that exists so far.

export interface KnowledgeRagSource {
  content_master_id: number;
  title: string;
  score: number;
}

export interface KnowledgeRagAnswer {
  status: 'ok' | 'insufficient_evidence' | 'model_unavailable';
  answer: string | null;
  message: string | null;
  sources: KnowledgeRagSource[];
}

export async function askKnowledgeRag(question: string): Promise<KnowledgeRagAnswer> {
  const session = readSession();

  if (!session) {
    throw new AiCapabilityError('Sign in to ask the Knowledge & RAG assistant.', 401);
  }

  const baseUrl = resolveAiBaseUrl(session.baseUrl);

  const response = await fetch(`${baseUrl}/api/ai/knowledge-rag/ask`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.token}`,
      ...(session.instituteId.trim() ? { 'X-MCP-Institute-Id': session.instituteId } : {}),
    },
    body: JSON.stringify({ question }),
  });

  const text = await response.text();
  let payload: AiEnvelope<KnowledgeRagAnswer>;

  try {
    payload = (text.trim() ? JSON.parse(text) : {}) as AiEnvelope<KnowledgeRagAnswer>;
  } catch {
    throw new AiCapabilityError('The Knowledge & RAG assistant returned a non-JSON response.', response.status);
  }

  if (!response.ok || payload.success === false) {
    throw new AiCapabilityError(
      payload.message || `The Knowledge & RAG assistant request failed (${response.status}).`,
      response.status
    );
  }

  return payload.data as KnowledgeRagAnswer;
}
