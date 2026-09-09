import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { ProjectChannelSettings, StoredServiceToken } from './types';

/**
 * Where per-project channel settings and service-token hashes live.
 *
 * SERVER ONLY, and the same shape of adapter as lib/agents/store.ts: an interface
 * so the backend can change, a JSON file today (`.data/conversational-ai.json`,
 * gitignored) so the flow works on a developer machine, and a memory version for
 * tests and hosts with no writable disk. When Laravel grows the matching tables
 * this interface is what its adapter implements.
 *
 * Writes go through one promise chain and a temp-file rename, for the same
 * reasons the agents store does: no interleaved read-modify-write, no truncated
 * file after a crash.
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

  constructor(private readonly filePath: string) {}

  private async load(): Promise<StoreShape> {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, 'utf8')) as Partial<StoreShape>;
      return {
        settings: parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : {},
        tokens: parsed.tokens && typeof parsed.tokens === 'object' ? parsed.tokens : {},
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyStore();
      throw error;
    }
  }

  private async save(data: StoreShape) {
    await mkdir(path.dirname(this.filePath), { recursive: true });
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
    return (await this.load()).settings[projectId] ?? null;
  }

  putSettings(settings: ProjectChannelSettings) {
    return this.mutate((data) => {
      data.settings[settings.project_id] = settings;
      return settings;
    });
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
