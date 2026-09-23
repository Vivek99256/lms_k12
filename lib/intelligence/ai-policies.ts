'use client';

import { resolveAiBaseUrl } from '@/app/components/utils/api_url';
import type { AiEnvelope } from './types';

export interface AiPolicyOption {
  value: string;
  label: string;
}

export interface AiPolicyRuleCatalogItem {
  key: string;
  label: string;
  default: boolean;
}

export interface AiPolicyAssignment {
  id: number;
  policy_id: number;
  scope_type: string;
  scope_id: number | null;
  sub_institute_id: number | null;
  status: number;
}

export interface AiPolicyRow {
  id: number;
  sub_institute_id: number | null;
  name: string;
  description: string | null;
  policy_type: string;
  is_example?: number;
  status: number;
  require_disclosure: number;
  require_acknowledgement: number;
  ai_detection_required: number;
  plagiarism_check_required: number;
  detection_provider: string | null;
  detection_threshold: number | null;
  rules: Record<string, boolean>;
  assignments: AiPolicyAssignment[];
}

export interface AiPolicyOptions {
  policy_types: AiPolicyOption[];
  rule_catalogue: AiPolicyRuleCatalogItem[];
  scope_types: AiPolicyOption[];
}

export interface AiPolicyIndex {
  sub_institute_id: string | number;
  policies: AiPolicyRow[];
}

export interface AiPolicyPayload {
  name: string;
  description?: string | null;
  policy_type: string;
  status?: number;
  require_disclosure?: number;
  require_acknowledgement?: number;
  ai_detection_required?: number;
  plagiarism_check_required?: number;
  detection_provider?: string | null;
  detection_threshold?: number | null;
  rules: Record<string, boolean>;
  assignments: Array<{
    scope_type: string;
    scope_id: number | null;
    status?: number;
  }>;
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

async function call<T>(path: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', body?: unknown): Promise<T> {
  const session = readSession();

  if (!session) {
    throw new Error('Sign in to manage AI policies.');
  }

  const baseUrl = resolveAiBaseUrl(session.baseUrl);

  const response = await fetch(`${baseUrl}/api/ai${path}`, {
    method,
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${session.token}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(session.instituteId.trim() ? { 'X-MCP-Institute-Id': session.instituteId } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
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

export function fetchAiPolicyOptions(): Promise<AiPolicyOptions> {
  return call<AiPolicyOptions>('/policies/options');
}

export function fetchAiPolicies(): Promise<AiPolicyIndex> {
  return call<AiPolicyIndex>('/policies');
}

export function createAiPolicy(payload: AiPolicyPayload): Promise<{ policy: AiPolicyRow }> {
  return call('/policies', 'POST', payload);
}

export function updateAiPolicy(id: number, payload: AiPolicyPayload): Promise<{ policy: AiPolicyRow }> {
  return call(`/policies/${id}`, 'PUT', payload);
}

export function retireAiPolicy(id: number): Promise<{ id: number }> {
  return call(`/policies/${id}`, 'DELETE');
}
