'use client';

/**
 * Client for the Knowledge Graph's own centralized settings —
 * `/api/ai/knowledge-graph/settings*`.
 *
 * Shaped like `ai-module.ts` on purpose: same session read, same envelope
 * handling. `index`/`save`/`clear` are the admin screen's calls — refused
 * server-side (via `AdministratorCheck`) for anyone else, so a non-admin's
 * attempt simply fails with the backend's own message rather than being
 * hidden here. `fetchResolvedKnowledgeGraphSettings` is the decentralized
 * read: no admin gate, meant to be called by any module deciding whether to
 * render its own Knowledge Graph tab — see KnowledgeGraphSettingsResolver on
 * the backend.
 *
 * The `*Tree*` functions are a separate concern: the Centralized Explorer's
 * own module -> submodule tree (`GraphModuleBrowser::erpModules()`/
 * `erpSubmodules()`), not a product module's tab visibility. See
 * `kg_explorer_tree_settings` on the backend for why these are not the same
 * table or the same key vocabulary as the functions above.
 */

import { resolveAiBaseUrl } from '@/app/components/utils/api_url';
import type { AiEnvelope } from './types';

export interface KnowledgeGraphModuleSetting {
  module: string;
  module_label: string;
  enabled: boolean;
  /** Which level of the precedence chain decided this. */
  source: 'institute_module' | 'institute_default' | 'platform_module' | 'platform_default' | 'default';
}

export interface KnowledgeGraphWildcardSetting {
  enabled: boolean;
  updated_at: string | null;
}

export interface KnowledgeGraphSettingsOverview {
  modules: KnowledgeGraphModuleSetting[];
  /** This school's own wildcard override, or null when it has not set one. */
  institute_default: KnowledgeGraphWildcardSetting | null;
  /** The platform's own wildcard default, set directly in the database — read-only here. */
  platform_default: KnowledgeGraphWildcardSetting | null;
}

export interface KnowledgeGraphSettingSaved {
  module_key: string | null;
  enabled: boolean;
  scope: 'platform' | 'institute';
  updated_at: string | null;
}

export interface KnowledgeGraphSettingCleared {
  module_key: string | null;
  cleared: boolean;
  enabled: boolean;
}

export interface KnowledgeGraphResolvedSettings {
  modules: Record<string, boolean>;
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
    throw new Error('Sign in to manage Knowledge Graph settings.');
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
    throw new Error('The Knowledge Graph settings API returned a non-JSON response.');
  }

  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || `The request failed (${response.status}).`);
  }

  return payload.data as T;
}

/** Every module this school has, resolved, plus the institute and platform defaults. Admin only. */
export function fetchKnowledgeGraphSettings(): Promise<KnowledgeGraphSettingsOverview> {
  return call<KnowledgeGraphSettingsOverview>('/knowledge-graph/settings');
}

/**
 * Save this school's choice for one module, or its own institute-wide default
 * when `moduleKey` is null. Admin only; always scoped to the caller's school —
 * see KnowledgeGraphSettingsController's docblock for why the platform default
 * is never reachable from here.
 */
export function saveKnowledgeGraphSetting(
  moduleKey: string | null,
  enabled: boolean
): Promise<KnowledgeGraphSettingSaved> {
  return call<KnowledgeGraphSettingSaved>('/knowledge-graph/settings', {
    method: 'POST',
    body: { module_key: moduleKey, enabled },
  });
}

/** Remove this school's own override for one module (or its institute-wide default). Admin only. */
export function clearKnowledgeGraphSetting(moduleKey: string | null): Promise<KnowledgeGraphSettingCleared> {
  const query = moduleKey ? `?module_key=${encodeURIComponent(moduleKey)}` : '';
  return call<KnowledgeGraphSettingCleared>(`/knowledge-graph/settings${query}`, { method: 'DELETE' });
}

/**
 * The decentralized read every module calls instead of keeping a Knowledge
 * Graph setting of its own. No admin gate on the backend route; callers
 * should still fail soft (default every module to enabled) rather than let a
 * network error hide a tab that should be showing.
 */
export function fetchResolvedKnowledgeGraphSettings(): Promise<KnowledgeGraphResolvedSettings> {
  return call<KnowledgeGraphResolvedSettings>('/knowledge-graph/settings/resolved');
}

// ---------------------------------------------------------------------------
// The Explorer's own browse tree — module -> submodule -> node types.
// ---------------------------------------------------------------------------

export interface KnowledgeGraphTreeNodeType {
  label: string;
  enabled: boolean;
}

export interface KnowledgeGraphTreeSubmodule {
  label: string;
  /** False when ModuleGraphMapper found no real GraphSchema labels for it. */
  mapped: boolean;
  /** The real node types (GraphSchema labels) this submodule resolves to, each individually switchable. */
  node_types: KnowledgeGraphTreeNodeType[];
  /**
   * The `ai_modules.module_key` whose tab is the same concept as this
   * submodule (e.g. "Fees" <-> `fees`), or null when none matches. Switching
   * either one off switches both off — see KnowledgeGraphSettingsController's
   * docblock.
   */
  linked_module_key: string | null;
  enabled: boolean;
}

export interface KnowledgeGraphTreeModule {
  label: string;
  enabled: boolean;
  submodules: KnowledgeGraphTreeSubmodule[];
}

export interface KnowledgeGraphTreeOverview {
  modules: KnowledgeGraphTreeModule[];
}

export interface KnowledgeGraphTreeSaved {
  module_label: string;
  submodule_label: string | null;
  node_type: string | null;
  enabled: boolean;
  scope: 'platform' | 'institute';
  updated_at: string | null;
}

export interface KnowledgeGraphTreeCleared {
  module_label: string;
  submodule_label: string | null;
  node_type: string | null;
  cleared: boolean;
  enabled: boolean;
}

/** The Explorer's five ERP modules, their real submodules, and each one's resolved state. Admin only. */
export function fetchKnowledgeGraphTree(): Promise<KnowledgeGraphTreeOverview> {
  return call<KnowledgeGraphTreeOverview>('/knowledge-graph/settings/tree');
}

/**
 * Save a module's own switch, one of its submodules' (when `submoduleLabel`
 * is given), or one node type within that submodule (when `nodeType` is also
 * given). Admin only.
 */
export function saveKnowledgeGraphTreeSetting(
  moduleLabel: string,
  submoduleLabel: string | null,
  enabled: boolean,
  nodeType?: string | null
): Promise<KnowledgeGraphTreeSaved> {
  return call<KnowledgeGraphTreeSaved>('/knowledge-graph/settings/tree', {
    method: 'POST',
    body: { module_label: moduleLabel, submodule_label: submoduleLabel, node_type: nodeType ?? null, enabled },
  });
}

/** Return a module's, one submodule's, or one node type's switch to whatever the rest of the chain decides. Admin only. */
export function clearKnowledgeGraphTreeSetting(
  moduleLabel: string,
  submoduleLabel: string | null,
  nodeType?: string | null
): Promise<KnowledgeGraphTreeCleared> {
  const params = new URLSearchParams({ module_label: moduleLabel });
  if (submoduleLabel) params.set('submodule_label', submoduleLabel);
  if (nodeType) params.set('node_type', nodeType);
  return call<KnowledgeGraphTreeCleared>(`/knowledge-graph/settings/tree?${params.toString()}`, { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// The live Neo4j inventory — every node label the graph actually holds.
// ---------------------------------------------------------------------------

export interface KnowledgeGraphLiveLabel {
  label: string;
  /** Live count right now — this school's own nodes plus every global (tenant-less) one. */
  count: number;
  /** False means GraphSchema does not recognise this label at all — an orphan or unexpected write. */
  known: boolean;
}

export interface KnowledgeGraphLiveInventory {
  labels: KnowledgeGraphLiveLabel[];
}

/**
 * Every node label Neo4j actually holds right now, with its live count —
 * "what we actually know", unfiltered by ModuleGraphMapper's curated
 * per-submodule subset the tree above shows. Admin only.
 */
export function fetchKnowledgeGraphLiveInventory(): Promise<KnowledgeGraphLiveInventory> {
  return call<KnowledgeGraphLiveInventory>('/knowledge-graph/settings/live-inventory');
}
