import { randomUUID } from 'node:crypto';

import type { Authorizer } from './acting-user';
import { executeTool } from './executors';
import { findTool, isKnownModule, rbacModuleKey, validateToolsForModule } from './registry';
import type { AgentStore } from './store';
import type { ActingUser, Agent, AgentRun, AgentStatus, CreateAgentInput, RunAgentInput } from './types';

/**
 * The engine: create, change status, run, and log.
 *
 * Every entry point takes the acting user and an authorizer and does the check
 * itself, so a route cannot forget it. The order inside `runAgent` is the audit
 * contract:
 *
 *   1. find the agent in the caller's tenant (a foreign tenant's id is "not found")
 *   2. ask Laravel whether THIS user may `update` agents.<module>
 *   3. if not — write a `denied` run under their name and stop
 *   4. otherwise execute exactly one tool from the allow-list
 *   5. write the run, success or failure, with what went in and what came out
 *
 * A refusal is logged, not swallowed: an auditor should be able to see who tried.
 */

export class AgentEngineError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AgentEngineError';
    this.status = status;
  }
}

/** A refused run. Carries the `denied` row so the route can return it alongside the 403. */
export class AgentEngineDenied extends AgentEngineError {
  readonly run: AgentRun;

  constructor(message: string, run: AgentRun) {
    super(message, 403);
    this.name = 'AgentEngineDenied';
    this.run = run;
  }
}

export interface EngineContext {
  store: AgentStore;
  actor: ActingUser;
  authorize: Authorizer;
  /** Injected for tests; defaults to the wall clock. */
  now?: () => Date;
}

function newId(prefix: 'agt' | 'run'): string {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

function requireActor(actor: ActingUser) {
  if (!actor.tenant_id) throw new AgentEngineError('Your session has no institute. Reselect the institute and try again.', 401);
  if (!actor.user_id) throw new AgentEngineError('Your session has no user id. Sign in again.', 401);
}

export async function listAgents(context: EngineContext, filter?: { module?: string; status?: AgentStatus }) {
  requireActor(context.actor);
  return context.store.listAgents(context.actor.tenant_id, filter);
}

export async function listRuns(context: EngineContext, filter?: { module?: string; agentId?: string; limit?: number }) {
  requireActor(context.actor);
  return context.store.listRuns(context.actor.tenant_id, filter);
}

export async function createAgent(context: EngineContext, input: CreateAgentInput): Promise<Agent> {
  requireActor(context.actor);

  const name = (input.name ?? '').trim();
  if (!name) throw new AgentEngineError('Give the agent a name.', 400);
  if (name.length > 80) throw new AgentEngineError('Keep the name under 80 characters.', 400);

  const moduleKey = (input.module ?? '').trim();
  if (!isKnownModule(moduleKey)) throw new AgentEngineError(`"${moduleKey || '(none)'}" is not a known module.`, 400);

  const toolsAllowed = Array.from(new Set((input.tools_allowed ?? []).map((key) => String(key).trim()).filter(Boolean)));
  const toolProblem = validateToolsForModule(moduleKey, toolsAllowed);
  if (toolProblem) throw new AgentEngineError(toolProblem, 400);

  const status = input.status === 'active' ? 'active' : 'draft';

  const decision = await context.authorize(rbacModuleKey(moduleKey), 'create');
  if (!decision.allowed) throw new AgentEngineError(decision.reason ?? 'Not permitted.', 403);

  const stamp = (context.now?.() ?? new Date()).toISOString();
  const agent: Agent = {
    id: newId('agt'),
    name,
    description: (input.description ?? '').trim(),
    module: moduleKey,
    tenant_id: context.actor.tenant_id,
    tools_allowed: toolsAllowed,
    instructions: (input.instructions ?? '').trim(),
    trigger: 'manual',
    status,
    created_by: context.actor.user_id,
    created_by_name: context.actor.user_name,
    created_at: stamp,
    updated_at: stamp,
  };

  return context.store.insertAgent(agent);
}

const STATUS_TRANSITIONS: Record<AgentStatus, AgentStatus[]> = {
  draft: ['active', 'archived'],
  active: ['paused', 'archived'],
  paused: ['active', 'archived'],
  archived: [],
};

export async function setAgentStatus(context: EngineContext, agentId: string, status: AgentStatus): Promise<Agent> {
  requireActor(context.actor);

  const agent = await context.store.getAgent(context.actor.tenant_id, agentId);
  if (!agent) throw new AgentEngineError('That agent does not exist in this institute.', 404);

  if (!STATUS_TRANSITIONS[agent.status].includes(status)) {
    throw new AgentEngineError(`An agent cannot go from ${agent.status} to ${status}.`, 400);
  }

  const decision = await context.authorize(rbacModuleKey(agent.module), 'update');
  if (!decision.allowed) throw new AgentEngineError(decision.reason ?? 'Not permitted.', 403);

  return context.store.updateAgent({ ...agent, status, updated_at: (context.now?.() ?? new Date()).toISOString() });
}

export interface RunOutcome {
  run: AgentRun;
}

export async function runAgent(context: EngineContext, agentId: string, input: RunAgentInput = {}): Promise<RunOutcome> {
  requireActor(context.actor);

  const agent = await context.store.getAgent(context.actor.tenant_id, agentId);
  if (!agent) throw new AgentEngineError('That agent does not exist in this institute.', 404);

  const startedAt = context.now?.() ?? new Date();
  const args = input.arguments && typeof input.arguments === 'object' && !Array.isArray(input.arguments) ? input.arguments : {};
  const requestedTool = (input.tool ?? '').trim();
  const toolKey = requestedTool || agent.tools_allowed.find((key) => findTool(key)?.available) || '';

  const base = {
    id: newId('run'),
    agent_id: agent.id,
    agent_name: agent.name,
    module: agent.module,
    tenant_id: agent.tenant_id,
    started_at: startedAt.toISOString(),
    acting_user_id: context.actor.user_id,
    acting_user_name: context.actor.user_name,
    acting_profile_id: context.actor.profile_id,
    acting_profile_name: context.actor.profile_name,
    trigger: 'manual' as const,
    input: { tool: toolKey || null, arguments: args },
  };

  const finish = (partial: Pick<AgentRun, 'status' | 'output' | 'tools_used' | 'error'>): AgentRun => {
    const finishedAt = context.now?.() ?? new Date();
    return {
      ...base,
      ...partial,
      finished_at: finishedAt.toISOString(),
      duration_ms: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
    };
  };

  // Rights first, before the engine even looks at whether the request makes
  // sense — a caller with no rights learns nothing about the agent's shape.
  const decision = await context.authorize(rbacModuleKey(agent.module), 'update');
  if (!decision.allowed) {
    const run = await context.store.appendRun(finish({ status: 'denied', output: null, tools_used: [], error: decision.reason }));
    throw new AgentEngineDenied(decision.reason ?? 'Not permitted.', run);
  }

  if (agent.status !== 'active') {
    const run = await context.store.appendRun(
      finish({ status: 'failure', output: null, tools_used: [], error: `The agent is ${agent.status}; only active agents run.` }),
    );
    return { run };
  }

  if (!toolKey || !agent.tools_allowed.includes(toolKey)) {
    const run = await context.store.appendRun(
      finish({
        status: 'failure',
        output: null,
        tools_used: [],
        error: toolKey ? `"${toolKey}" is not on this agent's allow-list.` : 'The agent has no runnable tool on its allow-list.',
      }),
    );
    return { run };
  }

  try {
    const { output } = executeTool(toolKey, args);
    const run = await context.store.appendRun(finish({ status: 'success', output, tools_used: [toolKey], error: null }));
    return { run };
  } catch (error) {
    const run = await context.store.appendRun(
      finish({ status: 'failure', output: null, tools_used: [toolKey], error: error instanceof Error ? error.message : 'The tool failed.' }),
    );
    return { run };
  }
}
