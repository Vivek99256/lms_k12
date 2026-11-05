import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { ProjectChannelSettings, StoredServiceToken } from './types';

/**
 * Where per-project channel settings and service-token hashes live.
 *
 * SERVER ONLY:
 * Persists each module's configuration independently to Laravel backend database
 * (`ai_live_chat_settings` table via `/api/ai/conversation/settings`)
 * with a resilient local JSON file cache (`.data/conversational-ai.json`).
 *
 * Voice and Language settings are MODULE-SPECIFIC:
 * Changes to one module (e.g. LMS K-12) do NOT affect other modules (e.g. Enterprise Brain, G2G).
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
  const envUrl = (process.env.NEXT_PUBLIC_AI_BASE_URL || '').trim() ||
                 (process.env.NEXT_PUBLIC_API_BASE_URL_DEV || '').trim() ||
                 'http://127.0.0.1:8000';
  return envUrl.replace(/\/$/, '');
}

async function fetchSettingsFromBackend(projectId: string): Promise<ProjectChannelSettings | null> {
  try {
    const baseUrl = resolveBackendUrl();
    const res = await fetch(`${baseUrl}/api/ai/conversation/settings?project_id=${encodeURIComponent(projectId)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(2500),
    });

    if (res.ok) {
      const payload = await res.json();
      if (payload?.data && typeof payload.data === 'object' && payload.data.project_id) {
        return payload.data as ProjectChannelSettings;
      }
    }
  } catch {
    // Graceful fallback to local cache
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
      signal: AbortSignal.timeout(4000),
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
    // Module-specific: store only for the target project
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

      return { settings, tokens };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyStore();
      throw error;
    }
  }

  private async save(data: StoreShape) {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    delete data.settings['brain'];
    delete data.settings['enterprise'];
    delete data.tokens['brain'];
    delete data.tokens['enterprise'];

    const temp = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temp, JSON.stringify(data, null, 2), 'utf8');
    await rename(temp, this.filePath);
  }

  private mutate<T>(work: (data: StoreShape) => T): Promise<T> {
    const next = this.queue.then(async () => {
      const data = await this.load();
      const result = work(data);
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

    // 2. Fallback to local cache for this specific module
    const local = await this.load();
    return local.settings[projectId] ?? null;
  }

  async putSettings(settings: ProjectChannelSettings) {
    // Module-specific update: store only for the target project
    const saved = await this.mutate((data) => {
      data.settings[settings.project_id] = settings;
      return settings;
    });

    // Asynchronously push to Laravel database for this specific module
    void syncSettingsToBackend(settings);

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

/** Process-wide store, held on globalThis so dev reloads share one write queue. */
export function getConversationalAdminStore(): ConversationalAdminStore {
  const holder = globalThis as typeof globalThis & { __conversationalAdminStore?: ConversationalAdminStore };
  if (!holder.__conversationalAdminStore) {
    const filePath =
      (process.env.CONVERSATIONAL_AI_STORE_PATH || '').trim() || path.join(process.cwd(), '.data', 'conversational-ai.json');
    holder.__conversationalAdminStore = new JsonFileConversationalAdminStore(filePath);
  }
  return holder.__conversationalAdminStore;
}
