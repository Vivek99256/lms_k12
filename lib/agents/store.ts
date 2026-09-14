import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { Agent, AgentRun } from './types';

/**
 * Where agents and their runs live.
 *
 * SERVER ONLY. This module touches the filesystem; the browser reaches it through
 * app/api/agents/* and never imports it.
 *
 * THE STORE IS AN INTERFACE SO THE BACKEND CAN CHANGE WITHOUT THE ENGINE NOTICING.
 * v1 persists to a JSON file (`.data/agents.json`, gitignored) so the whole flow —
 * create, run, log, RBAC refusal — works end to end on a developer machine today.
 * The Laravel adapter, when next_lms_erp grows `ai_agents` / `ai_agent_runs`
 * tables, implements this same interface against those endpoints. Nothing in
 * engine.ts or the routes knows which one is behind it.
 *
 * Known limit of the file adapter: on a serverless host the filesystem is
 * ephemeral, so rows survive a request but not necessarily a cold start. That is
 * acceptable for local end-to-end testing and is why the interface exists.
 *
 * EVERY READ IS TENANT-SCOPED. There is no "list all agents" — a caller can only
 * ask for the tenant its session belongs to.
 */

export interface AgentListFilter {
  module?: string;
  status?: Agent['status'];
}

export interface RunListFilter {
  module?: string;
  agentId?: string;
  limit?: number;
}

export interface AgentStore {
  listAgents(tenantId: string, filter?: AgentListFilter): Promise<Agent[]>;
  getAgent(tenantId: string, id: string): Promise<Agent | null>;
  insertAgent(agent: Agent): Promise<Agent>;
  updateAgent(agent: Agent): Promise<Agent>;
  listRuns(tenantId: string, filter?: RunListFilter): Promise<AgentRun[]>;
  appendRun(run: AgentRun): Promise<AgentRun>;
}

interface StoreShape {
  agents: Agent[];
  runs: AgentRun[];
}

function emptyStore(): StoreShape {
  return { agents: [], runs: [] };
}

function applyAgentFilter(agents: Agent[], tenantId: string, filter?: AgentListFilter): Agent[] {
  return agents
    .filter((agent) => agent.tenant_id === tenantId)
    .filter((agent) => !filter?.module || agent.module === filter.module)
    .filter((agent) => !filter?.status || agent.status === filter.status)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

function applyRunFilter(runs: AgentRun[], tenantId: string, filter?: RunListFilter): AgentRun[] {
  const limit = filter?.limit && filter.limit > 0 ? filter.limit : 200;
  return runs
    .filter((run) => run.tenant_id === tenantId)
    .filter((run) => !filter?.module || run.module === filter.module)
    .filter((run) => !filter?.agentId || run.agent_id === filter.agentId)
    .sort((a, b) => b.started_at.localeCompare(a.started_at))
    .slice(0, limit);
}

/** In-memory store: the engine's tests use it, and so does a host with no writable disk. */
export class MemoryAgentStore implements AgentStore {
  private data: StoreShape = emptyStore();

  async listAgents(tenantId: string, filter?: AgentListFilter) {
    return applyAgentFilter(this.data.agents, tenantId, filter);
  }

  async getAgent(tenantId: string, id: string) {
    return this.data.agents.find((agent) => agent.tenant_id === tenantId && agent.id === id) ?? null;
  }

  async insertAgent(agent: Agent) {
    this.data.agents.push(agent);
    return agent;
  }

  async updateAgent(agent: Agent) {
    const index = this.data.agents.findIndex((row) => row.tenant_id === agent.tenant_id && row.id === agent.id);
    if (index === -1) throw new Error(`Agent ${agent.id} does not exist.`);
    this.data.agents[index] = agent;
    return agent;
  }

  async listRuns(tenantId: string, filter?: RunListFilter) {
    return applyRunFilter(this.data.runs, tenantId, filter);
  }

  async appendRun(run: AgentRun) {
    this.data.runs.push(run);
    return run;
  }
}

/**
 * JSON-file store.
 *
 * Writes are serialised through one promise chain so two requests landing
 * together cannot interleave a read-modify-write and lose a row. The file is
 * written to a temp name and renamed into place, so a crash mid-write leaves the
 * previous file intact rather than a truncated one.
 */
export class JsonFileAgentStore implements AgentStore {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  private async load(): Promise<StoreShape> {
    try {
      const text = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(text) as Partial<StoreShape>;
      return {
        agents: Array.isArray(parsed.agents) ? parsed.agents : [],
        runs: Array.isArray(parsed.runs) ? parsed.runs : [],
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

  /** Run one read-modify-write after every previous one has finished. */
  private mutate<T>(work: (data: StoreShape) => T): Promise<T> {
    const next = this.queue.then(async () => {
      const data = await this.load();
      const result = work(data);
      await this.save(data);
      return result;
    });
    // Keep the chain alive after a failure, or every later write would reject too.
    this.queue = next.catch(() => undefined);
    return next;
  }

  async listAgents(tenantId: string, filter?: AgentListFilter) {
    return applyAgentFilter((await this.load()).agents, tenantId, filter);
  }

  async getAgent(tenantId: string, id: string) {
    const { agents } = await this.load();
    return agents.find((agent) => agent.tenant_id === tenantId && agent.id === id) ?? null;
  }

  insertAgent(agent: Agent) {
    return this.mutate((data) => {
      data.agents.push(agent);
      return agent;
    });
  }

  updateAgent(agent: Agent) {
    return this.mutate((data) => {
      const index = data.agents.findIndex((row) => row.tenant_id === agent.tenant_id && row.id === agent.id);
      if (index === -1) throw new Error(`Agent ${agent.id} does not exist.`);
      data.agents[index] = agent;
      return agent;
    });
  }

  async listRuns(tenantId: string, filter?: RunListFilter) {
    return applyRunFilter((await this.load()).runs, tenantId, filter);
  }

  appendRun(run: AgentRun) {
    return this.mutate((data) => {
      data.runs.push(run);
      return run;
    });
  }
}

/**
 * The process-wide store the API routes use.
 *
 * Held on `globalThis` so Next's dev-mode module reloads reuse one instance
 * rather than racing several write queues against the same file.
 */
export function getAgentStore(): AgentStore {
  const holder = globalThis as typeof globalThis & { __agentStore?: AgentStore };
  if (!holder.__agentStore) {
    const filePath = (process.env.AGENTS_STORE_PATH || '').trim() || path.join(process.cwd(), '.data', 'agents.json');
    holder.__agentStore = new JsonFileAgentStore(filePath);
  }
  return holder.__agentStore;
}
