import test from 'node:test';
import assert from 'node:assert/strict';

import type { Authorization, Authorizer } from './acting-user';
import { AgentEngineDenied, AgentEngineError, createAgent, listAgents, runAgent, setAgentStatus, type EngineContext } from './engine';
import { MemoryAgentStore } from './store';
import type { ActingUser } from './types';

/**
 * The audit contract, end to end against the in-memory store: an agent is
 * created and run under the caller's identity, a refusal is logged as `denied`,
 * and a tenant never sees another tenant's rows.
 */

const feesAdmin: ActingUser = { tenant_id: '101', user_id: '7', user_name: 'Priya Menon', profile_id: '2', profile_name: 'Admin' };
const feesClerk: ActingUser = { tenant_id: '101', user_id: '9', user_name: 'Rohan Das', profile_id: '5', profile_name: 'Clerk' };
const otherSchool: ActingUser = { tenant_id: '202', user_id: '7', user_name: 'Priya Menon', profile_id: '2', profile_name: 'Admin' };

const allow: Authorizer = async () => ({ allowed: true, reason: null });
const deny: Authorizer = async (moduleKey, action) => ({ allowed: false, reason: `Your role does not have ${action} rights for ${moduleKey}.` });

function context(actor: ActingUser, authorize: Authorizer, store = new MemoryAgentStore()): EngineContext {
  return { store, actor, authorize };
}

const reminderAgent = {
  name: 'Fee reminder drafter',
  module: 'fees',
  tools_allowed: ['fees.draft_reminder'],
  instructions: 'Draft polite reminders.',
  status: 'active' as const,
};

test('create records the acting user and tenant, never an agent identity', async () => {
  const agent = await createAgent(context(feesAdmin, allow), reminderAgent);
  assert.match(agent.id, /^agt_[0-9a-f]{12}$/);
  assert.equal(agent.tenant_id, '101');
  assert.equal(agent.created_by, '7');
  assert.equal(agent.created_by_name, 'Priya Menon');
  assert.equal(agent.trigger, 'manual');
  assert.deepEqual(agent.tools_allowed, ['fees.draft_reminder']);
});

test('create asks for create rights on agents.<module> and refuses without them', async () => {
  const asked: Array<[string, string]> = [];
  const spy: Authorizer = async (moduleKey, action): Promise<Authorization> => {
    asked.push([moduleKey, action]);
    return { allowed: false, reason: 'no' };
  };
  await assert.rejects(createAgent(context(feesClerk, spy), reminderAgent), (error: unknown) => {
    assert.ok(error instanceof AgentEngineError);
    assert.equal(error.status, 403);
    return true;
  });
  assert.deepEqual(asked, [['agents.fees', 'create']]);
});

test('create refuses a tool from another module before asking for rights', async () => {
  let asked = false;
  const spy: Authorizer = async () => {
    asked = true;
    return { allowed: true, reason: null };
  };
  await assert.rejects(
    createAgent(context(feesAdmin, spy), { ...reminderAgent, module: 'g2g' }),
    (error: unknown) => error instanceof AgentEngineError && error.status === 400 && /belongs to fees/.test(error.message),
  );
  assert.equal(asked, false);
});

test('a successful run logs module, tenant, the real caller, input and output', async () => {
  const store = new MemoryAgentStore();
  const agent = await createAgent(context(feesAdmin, allow, store), reminderAgent);

  const { run } = await runAgent(context(feesClerk, allow, store), agent.id, {
    arguments: { student_name: 'Aarav Shah', amount: 12500, due_date: '2026-07-15' },
  });

  assert.equal(run.status, 'success');
  assert.equal(run.module, 'fees');
  assert.equal(run.tenant_id, '101');
  assert.equal(run.agent_id, agent.id);
  assert.equal(run.acting_user_id, '9');
  assert.equal(run.acting_user_name, 'Rohan Das');
  assert.equal(run.acting_profile_name, 'Clerk');
  assert.deepEqual(run.tools_used, ['fees.draft_reminder']);
  assert.equal(run.input.tool, 'fees.draft_reminder');
  assert.match(String(run.output?.message), /₹12,500/);
  assert.equal(run.output?.sends, false);
  assert.equal(run.error, null);

  const log = await store.listRuns('101');
  assert.equal(log.length, 1);
  assert.equal(log[0].id, run.id);
});

test('a refused run is written as denied under the caller and then rejected with 403', async () => {
  const store = new MemoryAgentStore();
  const agent = await createAgent(context(feesAdmin, allow, store), reminderAgent);

  await assert.rejects(runAgent(context(feesClerk, deny, store), agent.id), (error: unknown) => {
    assert.ok(error instanceof AgentEngineDenied);
    assert.equal(error.status, 403);
    assert.equal(error.run.status, 'denied');
    assert.equal(error.run.acting_user_id, '9');
    assert.match(error.run.error ?? '', /update rights for agents\.fees/);
    return true;
  });

  const log = await store.listRuns('101');
  assert.equal(log.length, 1);
  assert.equal(log[0].status, 'denied');
  assert.deepEqual(log[0].tools_used, []);
});

test('a tool outside the allow-list fails and is logged, not executed', async () => {
  const store = new MemoryAgentStore();
  const agent = await createAgent(context(feesAdmin, allow, store), reminderAgent);
  const { run } = await runAgent(context(feesAdmin, allow, store), agent.id, { tool: 'shared.compose_note' });
  assert.equal(run.status, 'failure');
  assert.match(run.error ?? '', /not on this agent's allow-list/);
  assert.equal(run.output, null);
});

test('only an active agent runs; status changes need update rights', async () => {
  const store = new MemoryAgentStore();
  const draft = await createAgent(context(feesAdmin, allow, store), { ...reminderAgent, status: 'draft' });

  const { run } = await runAgent(context(feesAdmin, allow, store), draft.id);
  assert.equal(run.status, 'failure');
  assert.match(run.error ?? '', /is draft/);

  await assert.rejects(setAgentStatus(context(feesClerk, deny, store), draft.id, 'active'), (error: unknown) =>
    error instanceof AgentEngineError && error.status === 403);

  const activated = await setAgentStatus(context(feesAdmin, allow, store), draft.id, 'active');
  assert.equal(activated.status, 'active');
  await assert.rejects(setAgentStatus(context(feesAdmin, allow, store), draft.id, 'draft'), /cannot go from active to draft/);
});

test('tenants are isolated: another institute cannot see or run the agent', async () => {
  const store = new MemoryAgentStore();
  const agent = await createAgent(context(feesAdmin, allow, store), reminderAgent);

  assert.deepEqual(await listAgents(context(otherSchool, allow, store)), []);
  await assert.rejects(runAgent(context(otherSchool, allow, store), agent.id), (error: unknown) =>
    error instanceof AgentEngineError && error.status === 404);
  assert.equal((await store.listRuns('202')).length, 0);
});

test('a session without an institute or user cannot do anything', async () => {
  const anonymous: ActingUser = { tenant_id: '', user_id: '', user_name: '', profile_id: '', profile_name: '' };
  await assert.rejects(listAgents(context(anonymous, allow)), (error: unknown) => error instanceof AgentEngineError && error.status === 401);
});
