'use client';

import { buildSessionHeaders, readAgentBrowserSession } from '@/lib/agents/client';

import type { ChannelSettingsInput, ProjectAdminRow, ProjectChannelSettings, RotatedToken } from './types';

/**
 * Browser client for /api/conversational-ai/*.
 *
 * Same transport rules as the agents client: the signed-in session travels as
 * the `x-*` headers the Fees proxies use, identity never rides in a body, and
 * every reply is unwrapped from `{ status, data }`.
 */

export class ConversationalAdminApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ConversationalAdminApiError';
    this.status = status;
  }
}

async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const session = readAgentBrowserSession();
  const response = await fetch(path, {
    method: init.method ?? 'GET',
    headers: buildSessionHeaders(session, init.body !== undefined),
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  });

  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    const message = typeof payload?.message === 'string' ? payload.message : `Request failed (${response.status}).`;
    throw new ConversationalAdminApiError(message, response.status);
  }
  return (payload?.data ?? payload) as T;
}

export function fetchProjects(): Promise<ProjectAdminRow[]> {
  return call<ProjectAdminRow[]>('/api/conversational-ai/projects');
}

export function saveProjectSettings(projectId: string, input: ChannelSettingsInput): Promise<ProjectChannelSettings> {
  return call<ProjectChannelSettings>(`/api/conversational-ai/projects/${encodeURIComponent(projectId)}/settings`, {
    method: 'PUT',
    body: input,
  });
}

export function rotateProjectToken(projectId: string): Promise<RotatedToken> {
  return call<RotatedToken>(`/api/conversational-ai/projects/${encodeURIComponent(projectId)}/token`, { method: 'POST', body: {} });
}
