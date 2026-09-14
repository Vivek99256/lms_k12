'use client';

import { resolveAiBaseUrl } from '@/app/components/utils/api_url';
import type { AiEnvelope } from './types';

/**
 * Client for AI Provider & Model Management — `/api/ai/configuration`.
 *
 * The write half of what `ai-capabilities.ts` reads. It is a separate file for the
 * same reason the controller behind it is a separate controller: the endpoints that
 * can change a credential are worth being able to find in one place.
 *
 * NOTHING HERE NAMES A SCHOOL, and nothing here ever receives an API key back. A
 * configuration arrives with `key_preview` — four characters either side of a mask —
 * which is enough to tell two credentials apart and not enough to use one. The key
 * travels in one direction only: into `save()`.
 */

export interface AiModuleOption {
  key: string;
  label: string;
  description: string;
  /** True when this module resolves its provider through the saved configuration. */
  wired: boolean;
  consumer: string;
}

export interface AiProviderOption {
  key: string;
  label: string;
  /** False when the platform has no client that can call this provider yet. */
  driveable: boolean;
  api_type: string;
  docs: string;
}

export interface AiModelOption {
  id: number;
  provider: string;
  model_id: string;
  label: string;
  max_output_tokens: number | null;
  input_cost_per_1k: number | null;
  output_cost_per_1k: number | null;
  sort_order: number;
  status: number;
  /** `platform` rows are shared estate-wide and read-only to a school. */
  scope: 'platform' | 'institute';
}

export interface AiConfigurationOptions {
  modules: AiModuleOption[];
  providers: AiProviderOption[];
  models: Record<string, AiModelOption[]>;
  active_driver: string;
}

export interface AiConfigurationRow {
  id: number;
  ai_module: string | null;
  module_label: string;
  module_wired: boolean;
  provider: string;
  provider_label: string;
  api_type: string;
  model: string | null;
  account_email: string | null;
  api_limit: string | null;
  status: number;
  scope: 'platform' | 'institute';
  editable: boolean;
  key_preview: string | null;
  updated_at: string | null;
}

/** What a module resolves to right now, including modules with nothing saved. */
export interface AiResolvedRow {
  module: string;
  module_label: string;
  description: string;
  wired: boolean;
  provider: string;
  provider_label: string;
  model: string | null;
  source: 'module' | 'module_platform' | 'pool' | 'pool_platform' | 'env' | 'config';
  scope: string;
  key_id: number | string | null;
  has_key: boolean;
  driveable: boolean;
}

export interface AiConfigurationIndex {
  sub_institute_id: string | number;
  configurations: AiConfigurationRow[];
  resolved: AiResolvedRow[];
}

export interface AiModelIndex {
  sub_institute_id: string | number;
  providers: AiProviderOption[];
  models: Record<string, AiModelOption[]>;
}

export interface AiConfigurationPayload {
  ai_module: string;
  provider: string;
  model: string | null;
  /** Omitted on edit to leave the stored credential untouched. */
  api_key?: string;
  account_email?: string | null;
  api_limit?: number | null;
  status?: number;
}

export interface AiModelPayload {
  provider: string;
  model_id: string;
  label: string;
  max_output_tokens?: number | null;
  input_cost_per_1k?: number | null;
  output_cost_per_1k?: number | null;
  sort_order?: number;
  status?: number;
}

export class AiConfigurationError extends Error {
  readonly status: number;

  /** Field-level messages from Laravel's validator, so a form can mark its own inputs. */
  readonly fieldErrors: Record<string, string[]>;

  constructor(message: string, status: number, fieldErrors: Record<string, string[]> = {}) {
    super(message);
    this.name = 'AiConfigurationError';
    this.status = status;
    this.fieldErrors = fieldErrors;
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

async function call<T>(
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: unknown
): Promise<T> {
  const session = readSession();

  if (!session) {
    throw new AiConfigurationError('Sign in to manage AI configuration.', 401);
  }

  const baseUrl = resolveAiBaseUrl(session.baseUrl);

  const response = await fetch(`${baseUrl}/api/ai${path}`, {
    method,
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${session.token}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      // Only sent when the session carries one: an empty header reads as a deliberate
      // request for institute "".
      ...(session.instituteId.trim() ? { 'X-MCP-Institute-Id': session.instituteId } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  const text = await response.text();
  let payload: AiEnvelope<T> & { errors?: Record<string, string[]> | null };

  try {
    payload = (text.trim() ? JSON.parse(text) : {}) as typeof payload;
  } catch {
    throw new AiConfigurationError('The AI console returned a non-JSON response.', response.status);
  }

  if (!response.ok || payload.success === false) {
    throw new AiConfigurationError(
      payload.message || `The request failed (${response.status}).`,
      response.status,
      (payload.errors as Record<string, string[]>) ?? {}
    );
  }

  return payload.data as T;
}

export function fetchAiConfigurationOptions(): Promise<AiConfigurationOptions> {
  return call<AiConfigurationOptions>('/configuration/options');
}

export function fetchAiConfigurations(): Promise<AiConfigurationIndex> {
  return call<AiConfigurationIndex>('/configuration');
}

export function createAiConfiguration(
  payload: AiConfigurationPayload
): Promise<{ configuration: AiConfigurationRow }> {
  return call('/configuration', 'POST', payload);
}

export function updateAiConfiguration(
  id: number,
  payload: AiConfigurationPayload
): Promise<{ configuration: AiConfigurationRow }> {
  return call(`/configuration/${id}`, 'PUT', payload);
}

export function retireAiConfiguration(id: number): Promise<{ id: number }> {
  return call(`/configuration/${id}`, 'DELETE');
}

export function fetchAiModels(): Promise<AiModelIndex> {
  return call<AiModelIndex>('/configuration-models');
}

export function createAiModel(payload: AiModelPayload): Promise<{ model: AiModelOption }> {
  return call('/configuration-models', 'POST', payload);
}

export function updateAiModel(id: number, payload: AiModelPayload): Promise<{ model: AiModelOption }> {
  return call(`/configuration-models/${id}`, 'PUT', payload);
}
