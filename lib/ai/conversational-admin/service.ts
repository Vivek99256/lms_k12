import type { ActingUser } from '@/lib/agents/types';
import type { Authorizer } from '@/lib/agents/acting-user';

import { getProjectAdapter, listProjectAdapters, normaliseProjectId } from '../project-resolver';
import { mintServiceToken, summariseToken } from './service-token';
import type { ConversationalAdminStore } from './store';
import {
  CHANNEL_LANGUAGES,
  SUGGESTED_PROMPT_SOURCES,
  defaultChannelSettings,
  type ChannelSettingsInput,
  type ProjectAdminRow,
  type ProjectChannelSettings,
  type RotatedToken,
} from './types';

/**
 * The operations behind /api/conversational-ai/*.
 *
 * Reads need a signed-in session (the routes refuse anonymous callers). Writes
 * additionally ask Laravel whether THIS user may `update` the RBAC module
 * `conversational_ai` — the same /api/permissions endpoint and the same
 * fail-closed rule as the agent engine: an unregistered key means denied, and
 * the reason is what the screen shows. Nothing here grants by configuration.
 */

export const RBAC_MODULE_KEY = 'conversational_ai';

export interface AdminContext {
  store: ConversationalAdminStore;
  actor: ActingUser;
  authorize: Authorizer;
}

export class ConversationalAdminError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'ConversationalAdminError';
    this.status = status;
  }
}

function actorLabel(actor: ActingUser): string | null {
  const name = (actor.user_name || '').trim();
  const id = (actor.user_id || '').trim();
  if (name && id) return `${name} (${id})`;
  return name || id || null;
}

async function requireUpdateRight(context: AdminContext) {
  const decision = await context.authorize(RBAC_MODULE_KEY, 'update');
  if (!decision.allowed) throw new ConversationalAdminError(decision.reason ?? 'Not permitted.', 403);
}

function requireAdapter(projectId: string) {
  const adapter = getProjectAdapter(projectId);
  if (!adapter) throw new ConversationalAdminError(`"${projectId || '(none)'}" is not a registered project.`, 404);
  return adapter;
}

/** One row per registered adapter: descriptor, effective settings, token summary. */
export async function listProjects(context: AdminContext): Promise<ProjectAdminRow[]> {
  const tokens = new Map((await context.store.listTokens()).map((token) => [token.project_id, token]));
  return Promise.all(
    listProjectAdapters().map(async (adapter) => {
      const stored = await context.store.getSettings(adapter.projectId);
      const token = adapter.kind === 'external' ? tokens.get(adapter.projectId) : undefined;
      return {
        adapter,
        settings: stored ?? defaultChannelSettings(adapter.projectId),
        token: token ? summariseToken(token) : null,
      };
    }),
  );
}

function validateSettings(projectId: string, current: ProjectChannelSettings, input: ChannelSettingsInput): ProjectChannelSettings {
  const next = { ...current, project_id: projectId };

  for (const key of ['voice_enabled', 'show_ask_tab', 'show_create_tab'] as const) {
    if (input[key] === undefined) continue;
    if (typeof input[key] !== 'boolean') throw new ConversationalAdminError(`${key} must be true or false.`);
    next[key] = input[key];
  }

  if (input.default_language !== undefined) {
    const language = String(input.default_language).trim();
    if (!CHANNEL_LANGUAGES.some((option) => option.value === language)) {
      throw new ConversationalAdminError(`"${language}" is not a supported language.`);
    }
    next.default_language = language;
  }

  if (input.suggested_prompt_source !== undefined) {
    const source = String(input.suggested_prompt_source).trim();
    if (!SUGGESTED_PROMPT_SOURCES.some((option) => option.value === source)) {
      throw new ConversationalAdminError(`"${source}" is not a suggested-prompt source.`);
    }
    next.suggested_prompt_source = source as ProjectChannelSettings['suggested_prompt_source'];
  }

  return next;
}

export async function updateSettings(context: AdminContext, projectId: string, input: ChannelSettingsInput): Promise<ProjectChannelSettings> {
  const id = normaliseProjectId(projectId);
  const adapter = requireAdapter(id);
  await requireUpdateRight(context);

  const current = (await context.store.getSettings(adapter.projectId)) ?? defaultChannelSettings(adapter.projectId);
  const next = validateSettings(adapter.projectId, current, input ?? {});
  next.updated_at = new Date().toISOString();
  next.updated_by = actorLabel(context.actor);
  return context.store.putSettings(next);
}

/** Issue a fresh token for an external project. The previous one stops working at once. */
export async function rotateServiceToken(context: AdminContext, projectId: string): Promise<RotatedToken> {
  const id = normaliseProjectId(projectId);
  const adapter = requireAdapter(id);
  if (adapter.kind !== 'external') {
    throw new ConversationalAdminError(`${adapter.label} is the host project and does not use a service token.`, 400);
  }
  await requireUpdateRight(context);

  const { plaintext, stored } = mintServiceToken(adapter.projectId, actorLabel(context.actor));
  await context.store.putToken(stored);
  return { summary: summariseToken(stored), plaintext };
}
