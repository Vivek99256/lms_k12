'use client';

import { API_BASE_URL } from '@/app/components/utils/api_url';

import type { Agent, AgentRun, AgentStatus, CreateAgentInput, RunAgentInput } from './types';

/**
 * Browser client for the Agent Management API.
 *
 * Talks only to this app's /api/agents routes. The session it forwards is the
 * one the rest of the LMS keeps in storage after login — the same keys Fees
 * reads in app/fees/_lib/fees-api.ts — sent as the same `x-*` headers the Fees
 * proxies use, so the server records the run against the real signed-in person.
 * No identity field ever travels in a request body.
 */

export interface AgentBrowserSession {
  baseUrl: string;
  token: string;
  subInstituteId: string;
  userId: string;
  userName: string;
  userProfileId: string;
  userProfileName: string;
}

function readRecord(storage: Storage, key: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(storage.getItem(key) || '{}') as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function firstString(sources: Record<string, unknown>[], keys: string[]): string {
  for (const source of sources) {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
      if (typeof value === 'number') return String(value);
    }
  }
  return '';
}

export function readAgentBrowserSession(): AgentBrowserSession {
  if (typeof window === 'undefined') {
    return { baseUrl: API_BASE_URL, token: '', subInstituteId: '', userId: '', userName: '', userProfileId: '', userProfileName: '' };
  }

  const sources: Record<string, unknown>[] = [];
  for (const storage of [sessionStorage, localStorage]) {
    for (const key of ['userData', 'menuContext', 'sessionData', 'auth']) {
      const record = readRecord(storage, key);
      if (Object.keys(record).length) sources.push(record);
    }
  }

  return {
    baseUrl: (API_BASE_URL || firstString(sources, ['host_name', 'hostName'])).replace(/\/$/, ''),
    token: firstString(sources, ['user_token', 'token']),
    subInstituteId: firstString(sources, ['sub_institute_id', 'subInstituteId']),
    userId: firstString(sources, ['user_id', 'userId', 'id']),
    userName: firstString(sources, ['user_name', 'first_name', 'name', 'username']),
    userProfileId: firstString(sources, ['user_profile_id', 'userProfileId', 'profile_id']),
    userProfileName: firstString(sources, ['user_profile_name', 'userProfileName', 'profile_name']),
  };
}

/** The session `x-*` headers every app-local API expects; shared with the Conversational AI admin client. */
export function buildSessionHeaders(session: AgentBrowserSession, json = false): Headers {
  const headers = new Headers();
  headers.set('Accept', 'application/json');
  if (json) headers.set('Content-Type', 'application/json');
  if (session.baseUrl) headers.set('x-laravel-base-url', session.baseUrl);
  if (session.token) headers.set('x-laravel-token', session.token);
  if (session.subInstituteId) headers.set('x-sub-institute-id', session.subInstituteId);
  if (session.userId) headers.set('x-user-id', session.userId);
  if (session.userName) headers.set('x-user-name', session.userName);
  if (session.userProfileId) headers.set('x-user-profile-id', session.userProfileId);
  if (session.userProfileName) headers.set('x-user-profile-name', session.userProfileName);
  return headers;
}

export class AgentApiError extends Error {
  readonly status: number;
  /** For a refused run, the `denied` row the server wrote. */
  readonly run: AgentRun | null;

  constructor(message: string, status: number, run: AgentRun | null = null) {
    super(message);
    this.name = 'AgentApiError';
    this.status = status;
    this.run = run;
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
    throw new AgentApiError(message, response.status, (payload?.run as AgentRun | undefined) ?? null);
  }
  return (payload?.data ?? payload) as T;
}

export function fetchAgents(filter: { module?: string; status?: AgentStatus } = {}): Promise<Agent[]> {
  const params = new URLSearchParams();
  if (filter.module) params.set('module', filter.module);
  if (filter.status) params.set('status', filter.status);
  const query = params.toString();
  return call<Agent[]>(`/api/agents${query ? `?${query}` : ''}`);
}

export function fetchRuns(filter: { module?: string; agentId?: string; limit?: number } = {}): Promise<AgentRun[]> {
  const params = new URLSearchParams();
  if (filter.module) params.set('module', filter.module);
  if (filter.agentId) params.set('agent_id', filter.agentId);
  if (filter.limit) params.set('limit', String(filter.limit));
  const query = params.toString();
  return call<AgentRun[]>(`/api/agents/runs${query ? `?${query}` : ''}`);
}

export function createAgent(input: CreateAgentInput): Promise<Agent> {
  return call<Agent>('/api/agents', { method: 'POST', body: input });
}

export function setAgentStatus(agentId: string, status: AgentStatus): Promise<Agent> {
  return call<Agent>(`/api/agents/${encodeURIComponent(agentId)}`, { method: 'PATCH', body: { status } });
}

export function runAgent(agentId: string, input: RunAgentInput = {}): Promise<AgentRun> {
  return call<{ run: AgentRun }>(`/api/agents/${encodeURIComponent(agentId)}/run`, { method: 'POST', body: input }).then(
    (result) => result.run,
  );
}
