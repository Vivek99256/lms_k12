'use client';

/**
 * Client for Template Management — `/api/ai/templates`.
 *
 * Shaped like `ai-policies.ts` and `ai-configuration.ts` on purpose: same session
 * read, same envelope handling, same "the institute is never a parameter" rule. Three
 * near-identical `call()` helpers is a duplication worth keeping until there is a
 * fourth — merging them would put every AI admin screen behind one module, and the
 * thing they have in common is thirty lines of fetch, not a concept.
 *
 * NOTHING HERE NAMES A SCHOOL
 *
 * `McpContextHydrator` derives the institute from the bearer token on the server. The
 * `X-MCP-Institute-Id` header is read from the signed-in session and only helps the
 * backend choose when a token spans several. There is no default institute id in this
 * file and there must never be one.
 */

import { resolveAiBaseUrl } from '@/app/components/utils/api_url';
import type { AiEnvelope } from './types';

/** The module selector's value for "not one module — all of them". */
export const SHARED_MODULE_KEY = '__shared__';

export interface TemplateModule {
  key: string;
  label: string;
  description: string | null;
  icon: string | null;
  shared: boolean;
}

export interface TemplateVariableDoc {
  key: string;
  label: string;
  description: string;
  /** Whether this variable carries the data a grounded answer has to rest on. */
  grounding: boolean;
}

export interface TemplateVariable {
  key: string;
  label?: string | null;
  required?: boolean;
  type?: string | null;
  grounding?: boolean;
}

/**
 * What a template is.
 *
 * `prompt` is sent to a model, which writes prose. `report` is an HTML layout whose
 * `<<placeholders>>` are filled by substitution from rows an MCP tool fetched — no
 * model touches the figures, which is why a report can state a fee amount and a prompt
 * can only describe one.
 */
export type TemplateKind = 'prompt' | 'report';

/** An MCP tool a report layout can draw its rows from. */
export interface TemplateDataSource {
  name: string;
  module: string;
  label: string;
  description: string;
  arguments: Array<{ key: string; type: string; description: string; required: boolean }>;
}

/** A placeholder a report layout may use. `row` ones repeat inside a rows block. */
export interface ReportPlaceholder {
  key: string;
  label: string;
  scope: 'report' | 'row';
}

export interface AiTemplateRow {
  id: number;
  template_key: string;
  name: string;
  description: string | null;
  module_key: string;
  module_label: string;
  kind: TemplateKind;
  html_layout: string | null;
  data_source: string | null;
  data_arguments: Record<string, unknown>;
  domain: string;
  category: string | null;
  version: number;
  status: string;
  system_prompt: string | null;
  user_prompt: string;
  variables: TemplateVariable[];
  output_format: string;
  output_schema: Record<string, unknown> | unknown[];
  provider: string | null;
  model: string | null;
  temperature: number | null;
  max_tokens: number | null;
  safety_rules: string[];
  allow_as_evidence: boolean;
  requires_review: boolean;

  sub_institute_id: number | null;
  /** A shared baseline row. Visible to every school, editable by none of them. */
  is_platform: boolean;
  /** False when editing would write this school its own copy instead. */
  editable_in_place: boolean;

  /** Whether the module's AI panel currently offers this template. */
  offered_in_module: boolean;
  offer_label: string | null;
  offer_module_key: string | null;

  grounding_variables: string[];
  unresolvable_variables: string[];

  updated_at: string | null;
}

export interface TemplateBranding {
  /** The school's own name, from its fee receipt letterhead. Null when it has set none. */
  institute_name: string | null;
  logo_url: string | null;
  sub_institute_id: number | string | null;
}

export interface AiTemplateOptions {
  modules: TemplateModule[];
  shared_key: string;
  variables: TemplateVariableDoc[];
  grounding_variables: string[];
  statuses: string[];
  kinds: TemplateKind[];
  output_formats: string[];
  categories: string[];
  /** The signed-in school's own name and logo. Never hardcoded by a caller. */
  branding: TemplateBranding;
  /** Read-only MCP tools a report layout can bind to. Write tools are never listed. */
  data_sources: TemplateDataSource[];
  report_placeholders: ReportPlaceholder[];
}

export interface AiTemplateIndex {
  sub_institute_id: string | number;
  module_key: string | null;
  module_label: string;
  templates: AiTemplateRow[];
  counts: { total: number; published: number; offered: number };
}

export interface AiTemplatePayload {
  name: string;
  description?: string | null;
  template_key?: string | null;
  module_key: string;
  kind?: TemplateKind;
  /** Save for every sub_institute_id rather than only the signed-in one. */
  shared?: boolean;
  /** Report only — required by the API when `kind` is 'report'. */
  html_layout?: string | null;
  data_source?: string | null;
  data_arguments?: Record<string, unknown>;
  domain?: string | null;
  category?: string | null;
  status: string;
  system_prompt?: string | null;
  user_prompt: string;
  variables?: TemplateVariable[];
  output_format?: string;
  safety_rules?: string[];
  allow_as_evidence?: boolean;
  requires_review?: boolean;
  offer_in_module?: boolean;
  suggestion_label?: string | null;
  requires_entity?: boolean;
  /** Publish as a new version and archive the current one, instead of editing in place. */
  new_version?: boolean;
}

export interface TemplatePreview {
  system: string | null;
  user: string;
  /** Placeholders nothing filled — each one reaches the model as literal `{{name}}`. */
  unresolved: string[];
  values: Record<string, string>;
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
    throw new Error('Sign in to manage AI templates.');
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
    // Validation failures carry the useful sentence — "a published template must
    // include at least one data variable" — under `errors`, not `message`. Surfacing
    // only `message` would show "The request was not valid." and hide the reason.
    const errors = (payload as { errors?: Record<string, string[]> }).errors;
    const first = errors ? Object.values(errors).flat()[0] : undefined;

    throw new Error(first || payload.message || `The request failed (${response.status}).`);
  }

  return payload.data as T;
}

export function fetchTemplateOptions(): Promise<AiTemplateOptions> {
  return call<AiTemplateOptions>('/templates/options');
}

/** Templates for one module. Omit `moduleKey` for every template the school can see. */
export function fetchTemplates(moduleKey?: string | null): Promise<AiTemplateIndex> {
  const query = moduleKey ? `?module_key=${encodeURIComponent(moduleKey)}` : '';

  return call<AiTemplateIndex>(`/templates/catalog${query}`);
}

export function fetchTemplate(id: number): Promise<{ template: AiTemplateRow }> {
  return call(`/templates/${id}`);
}

export function createTemplate(payload: AiTemplatePayload): Promise<{ template: AiTemplateRow }> {
  return call('/templates', 'POST', payload);
}

export function updateTemplate(
  id: number,
  payload: AiTemplatePayload
): Promise<{ template: AiTemplateRow; action: string }> {
  return call(`/templates/${id}`, 'PUT', payload);
}

export function retireTemplate(id: number): Promise<{ id: number }> {
  return call(`/templates/${id}`, 'DELETE');
}

/**
 * Render the prompts with sample values. No model is called and nothing is stored —
 * this answers "did my placeholder land where I meant it to", which is a question
 * about the text and not about the model.
 */
export function previewTemplate(input: {
  system_prompt?: string | null;
  user_prompt: string;
  values?: Record<string, string>;
}): Promise<TemplatePreview> {
  return call<TemplatePreview>('/templates/preview', 'POST', input);
}
