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
  /** What a provider must be able to do to serve this module (chat, json, vision, ...). */
  requires: string[];
  min_output_tokens: number | null;
  /** The module whose configuration this one uses when it has none of its own. */
  inherits: string | null;
  /** `none` when the module makes no model call at all. */
  runtime: 'model' | 'none';
  /** What is missing, in words an administrator can act on. */
  gap: string | null;
}

/** How usable a stored credential is, as judged by asking the provider. */
export interface AiCredentialStatus {
  status: 'ready' | 'present' | 'invalid' | 'absent' | 'not_required';
  label: string;
  detail: string | null;
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
  description?: string | null;
  best_for?: string | null;
  strengths?: string | null;
  limitations?: string | null;
  context_tokens?: number | null;
}

export interface AiConfigurationOptions {
  modules: AiModuleOption[];
  providers: AiProviderOption[];
  models: Record<string, AiModelOption[]>;
  /** False until the `priority` column has been added; ordering is then newest-first. */
  priority_supported: boolean;
}

export interface AiCompatibleModel {
  id: number;
  model_id: string;
  label: string;
  /** Fits what the module needs. */
  compatible: boolean;
  /** The provider itself confirmed the model — not merely the catalogue. */
  verified: boolean;
  reasons: string[];
  max_output_tokens: number | null;
  context_tokens: number | null;
  description?: string | null;
  best_for?: string | null;
  strengths?: string | null;
  limitations?: string | null;
}

export interface AiCompatibleProvider {
  provider: string;
  label: string;
  capable: boolean;
  selectable: boolean;
  /** `configured` is saved for the module; `best_fit` is this module's top unconfigured choice. */
  status: 'configured' | 'best_fit' | 'compatible' | 'not_capable';
  /** The module's own code was built and run against this provider. */
  proven: boolean;
  /** Why it sits where it does for this module. */
  fit: string | null;
  /** Capable AND its key was accepted by the provider — safe to run on. */
  ready: boolean;
  /** 1 = first priority; null for a provider that cannot serve the module. */
  rank: number | null;
  reasons: string[];
  capabilities: string[];
  credential: AiCredentialStatus;
  configured: { id: number; priority: number | null; model: string | null; scope: string } | null;
  models: AiCompatibleModel[];
  docs: string | null;
}

export interface AiModuleCompatibility {
  module: string;
  module_label: string;
  runtime: 'model' | 'none';
  gap: string | null;
  requires: { key: string; label: string }[];
  min_output_tokens: number | null;
  priority_supported: boolean;
  providers: AiCompatibleProvider[];
}

export interface AiConfigurationRow {
  id: number;
  ai_module: string | null;
  module_label: string;
  module_wired: boolean;
  module_runtime: 'model' | 'none' | null;
  /** 1 = tried first for its module; null = unranked. */
  priority: number | null;
  credential: AiCredentialStatus;
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

/** One provider a module may call, in the order it will try them. */
export interface AiResolvedChainLeg {
  order: number;
  provider: string;
  provider_label: string;
  model: string | null;
  priority: number | null;
  source: string;
  key_id: number | string | null;
  has_key: boolean;
  credential?: AiCredentialStatus;
}

/** What a module resolves to right now, including modules with nothing saved. */
export interface AiResolvedRow {
  module: string;
  module_label: string;
  description: string;
  wired: boolean;
  runtime: 'model' | 'none';
  gap: string | null;
  requires: string[];
  /** Null when nothing usable is configured — there is no provider to name. */
  provider: string | null;
  provider_label: string | null;
  model: string | null;
  source: 'module' | 'module_platform' | 'pool' | 'pool_platform' | 'config';
  scope: string;
  key_id: number | string | null;
  has_key: boolean;
  driveable: boolean;
  inherited_from: string | null;
  chain: AiResolvedChainLeg[];
  credential: AiCredentialStatus;
}

export interface AiConfigurationIndex {
  sub_institute_id: string | number;
  priority_supported: boolean;
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
  /** 1 = tried first. Only honoured once the priority column exists. */
  priority?: number | null;
}

export interface AiConfigurationSaved {
  configuration: AiConfigurationRow;
  /** What the provider said about the key that was just saved. */
  credential: AiCredentialStatus | null;
  /** The "what each module calls" table, re-resolved straight after the write. */
  resolved: AiResolvedRow[];
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

export function createAiConfiguration(payload: AiConfigurationPayload): Promise<AiConfigurationSaved> {
  return call('/configuration', 'POST', payload);
}

export function updateAiConfiguration(id: number, payload: AiConfigurationPayload): Promise<AiConfigurationSaved> {
  return call(`/configuration/${id}`, 'PUT', payload);
}

/** Which providers and models can really serve one module, best first. */
export function fetchAiCompatibility(module: string): Promise<AiModuleCompatibility> {
  return call<AiModuleCompatibility>(`/configuration/compatibility?module=${encodeURIComponent(module)}`);
}

/** Set a module's provider order: configuration ids, first choice first. */
export function reorderAiConfigurations(
  module: string,
  order: number[]
): Promise<{ configurations: AiConfigurationRow[]; resolved: AiResolvedRow[] }> {
  return call('/configuration/reorder', 'POST', { ai_module: module, order });
}

/** Ask the provider whether a stored key is accepted. */
export function verifyAiConfiguration(id: number): Promise<{ id: number; credential: AiCredentialStatus }> {
  return call(`/configuration/${id}/verify`, 'POST');
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
