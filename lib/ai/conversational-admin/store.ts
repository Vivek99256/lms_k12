import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { ProjectChannelSettings, StoredServiceToken } from './types';

/**
 * Where per-project channel settings and service-token hashes live.
 *
 * SERVER ONLY:
 * Persists each module's configuration independently to Laravel backend database
 * (`ai_live_chat_settings` table via `/api/ai/conversation/settings`)
 * with a resilient local cache.
 *
 * Fully resilient to serverless/read-only environments (e.g. AWS Lambda / Vercel /var/task):
 * If filesystem writes fail or the environment is read-only, it falls back to memory
 * and does not crash, while remote database persistence continues to succeed.
 */

export interface ConversationalAdminStore {
  getSettings(projectId: string): Promise<ProjectChannelSettings | null>;
  putSettings(settings: ProjectChannelSettings): Promise<ProjectChannelSettings>;
  getToken(projectId: string): Promise<StoredServiceToken | null>;
  listTokens(): Promise<StoredServiceToken[]>;
  putToken(token: StoredServiceToken): Promise<StoredServiceToken>;
}

interface StoreShape {
  settings: Record<string, ProjectChannelSettings>;
  tokens: Record<string, StoredServiceToken>;
}

function emptyStore(): StoreShape {
  return { settings: {}, tokens: {} };
}

function resolveBackendUrl(): string {
  const aiOverride = (process.env.NEXT_PUBLIC_AI_BASE_URL || '').trim();
  if (aiOverride) return aiOverride.replace(/\/$/, '');

  const prodUrl = (process.env.NEXT_PUBLIC_API_BASE_URL_PROD || '').trim();
  const devUrl = (process.env.NEXT_PUBLIC_API_BASE_URL_DEV || '').trim();

  if (process.env.NODE_ENV === 'production') {
    return (prodUrl || 'https://dev.triz.co.in').replace(/\/$/, '');
  }

  return (devUrl || 'http://127.0.0.1:8000').replace(/\/$/, '');
}

async function fetchSettingsFromBackend(projectId: string): Promise<ProjectChannelSettings | null> {
  try {
    const baseUrl = resolveBackendUrl();
    const res = await fetch(`${baseUrl}/api/ai/conversation/settings?project_id=${encodeURIComponent(projectId)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(3500),
    });

    if (res.ok) {
      const payload = await res.json();
      if (payload?.data && typeof payload.data === 'object' && payload.data.project_id) {
        return payload.data as ProjectChannelSettings;
      }
    }
  } catch {
    // Graceful fallback to memory/local cache
  }
  return null;
}

async function syncSettingsToBackend(settings: ProjectChannelSettings): Promise<void> {
  try {
    const baseUrl = resolveBackendUrl();
    await fetch(`${baseUrl}/api/ai/conversation/settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        project_id: settings.project_id,
        voice_enabled: settings.voice_enabled,
        default_language: settings.default_language,
        show_ask_tab: settings.show_ask_tab,
        show_create_tab: settings.show_create_tab,
        suggested_prompt_source: settings.suggested_prompt_source,
        updated_by: settings.updated_by,
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Non-blocking fallback
  }
}

export class MemoryConversationalAdminStore implements ConversationalAdminStore {
  private data: StoreShape = emptyStore();

  async getSettings(projectId: string) {
    return this.data.settings[projectId] ?? null;
  }

  async putSettings(settings: ProjectChannelSettings) {
    this.data.settings[settings.project_id] = settings;
    return settings;
  }

  async getToken(projectId: string) {
    return this.data.tokens[projectId] ?? null;
  }

  async listTokens() {
    return Object.values(this.data.tokens);
  }

  async putToken(token: StoredServiceToken) {
    this.data.tokens[token.project_id] = token;
    return token;
  }
}

export class JsonFileConversationalAdminStore implements ConversationalAdminStore {
  private queue: Promise<unknown> = Promise.resolve();
  private memoryCache: StoreShape = emptyStore();

  constructor(private readonly filePath: string) {}

  private async load(): Promise<StoreShape> {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, 'utf8')) as Partial<StoreShape>;
      const settings = parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : {};
      const tokens = parsed.tokens && typeof parsed.tokens === 'object' ? parsed.tokens : {};

      // Purge removed platforms if present in cache
      delete settings['brain'];
      delete settings['enterprise'];
      delete tokens['brain'];
      delete tokens['enterprise'];

      this.memoryCache = {
        settings: { ...this.memoryCache.settings, ...settings },
        tokens: { ...this.memoryCache.tokens, ...tokens },
      };
      return this.memoryCache;
    } catch {
      // Missing file, unreadable or read-only filesystem (e.g. /var/task): return memory cache
      return this.memoryCache;
    }
  }

  private async save(data: StoreShape) {
    try {
      delete data.settings['brain'];
      delete data.settings['enterprise'];
      delete data.tokens['brain'];
      delete data.tokens['enterprise'];

      await mkdir(path.dirname(this.filePath), { recursive: true });
      const temp = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
      await writeFile(temp, JSON.stringify(data, null, 2), 'utf8');
      await rename(temp, this.filePath);
    } catch (error) {
      // In serverless / read-only environments (/var/task), local disk is not writable.
      // Database persistence (ai_live_chat_settings via Laravel API) is the primary truth.
    }
  }

  private mutate<T>(work: (data: StoreShape) => T): Promise<T> {
    const next = this.queue.then(async () => {
      const data = await this.load();
      const result = work(data);
      this.memoryCache = data;
      await this.save(data);
      return result;
    });
    this.queue = next.catch(() => undefined);
    return next;
  }

  async getSettings(projectId: string) {
    // 1. Check live backend database first for this specific module
    const backendSettings = await fetchSettingsFromBackend(projectId);
    if (backendSettings) {
      void this.mutate((data) => {
        data.settings[projectId] = backendSettings;
        return backendSettings;
      });
      return backendSettings;
    }

    // 2. Fallback to cache for this specific module
    const local = await this.load();
    return local.settings[projectId] ?? null;
  }

  async putSettings(settings: ProjectChannelSettings) {
    // Module-specific update: store only for the target project
    const saved = await this.mutate((data) => {
      data.settings[settings.project_id] = settings;
      return settings;
    });

    // Persist to Laravel database for this specific module
    await syncSettingsToBackend(settings);

    return saved;
  }

  async getToken(projectId: string) {
    return (await this.load()).tokens[projectId] ?? null;
  }

  async listTokens() {
    return Object.values((await this.load()).tokens);
  }

  putToken(token: StoredServiceToken) {
    return this.mutate((data) => {
      data.tokens[token.project_id] = token;
      return token;
    });
  }
}

function resolveStorePath(): string {
  if (process.env.CONVERSATIONAL_AI_STORE_PATH) {
    return process.env.CONVERSATIONAL_AI_STORE_PATH.trim();
  }

  const cwd = process.cwd();
  // Serverless environments (AWS Lambda, Vercel, /var/task) have read-only root directories.
  // os.tmpdir() (/tmp) is always writable in these environments.
  if (
    cwd.startsWith('/var/task') ||
    Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME) ||
    Boolean(process.env.VERCEL)
  ) {
    return path.join(os.tmpdir(), 'conversational-ai.json');
  }

  return path.join(cwd, '.data', 'conversational-ai.json');
}

/** Process-wide store, held on globalThis so dev reloads share one write queue. */
export function getConversationalAdminStore(): ConversationalAdminStore {
  const holder = globalThis as typeof globalThis & { __conversationalAdminStore?: ConversationalAdminStore };
  if (!holder.__conversationalAdminStore) {
    const filePath = resolveStorePath();
    holder.__conversationalAdminStore = new JsonFileConversationalAdminStore(filePath);
  }
  return holder.__conversationalAdminStore;
}
