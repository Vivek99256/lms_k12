import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { listProjectAdapters, registerProjectAdapters, resolveProjectAdapter, UnknownProjectError } from '../project-resolver';
import { authenticateServiceRequest, hashServiceToken } from './service-token';
import { listProjects, rotateServiceToken, updateSettings, type AdminContext } from './service';
import { MemoryConversationalAdminStore } from './store';

function context(allowed = true): AdminContext {
  return {
    store: new MemoryConversationalAdminStore(),
    actor: { tenant_id: '1', user_id: '42', user_name: 'Asha', profile_id: '1', profile_name: 'Admin' },
    authorize: async () => (allowed ? { allowed: true, reason: null } : { allowed: false, reason: 'Your role does not have update rights.' }),
  };
}

function requestWith(headers: Record<string, string>): Pick<Request, 'headers'> {
  return { headers: new Headers(headers) };
}

describe('project resolver', () => {
  it('registers the host and the external projects, host first', () => {
    const ids = listProjectAdapters().map((adapter) => adapter.projectId);
    assert.equal(ids[0], 'lms_k12');
    assert.ok(ids.includes('g2g'));
    assert.ok(ids.includes('enterprise_brain'));
  });

  it('resolves by the x-project-id header and refuses an unknown id', () => {
    assert.equal(resolveProjectAdapter(requestWith({ 'x-project-id': 'G2G' })).projectId, 'g2g');
    assert.equal(resolveProjectAdapter(requestWith({})).projectId, 'lms_k12');
    assert.throws(() => resolveProjectAdapter(requestWith({ 'x-project-id': 'nope' })), UnknownProjectError);
  });

  it('rejects a malformed id at registration', () => {
    assert.throws(() =>
      registerProjectAdapters([{ projectId: 'Bad Id', label: 'x', description: '', kind: 'external', implemented: false }]),
    );
  });
});

describe('conversational admin service', () => {
  it('lists every registered adapter with default settings and no token', async () => {
    const rows = await listProjects(context());
    assert.deepEqual(
      rows.map((row) => row.adapter.projectId),
      listProjectAdapters().map((adapter) => adapter.projectId),
    );
    for (const row of rows) {
      assert.equal(row.settings.voice_enabled, true);
      assert.equal(row.settings.updated_at, null);
      assert.equal(row.token, null);
    }
  });

  it('updates settings, validates values and records who saved', async () => {
    const ctx = context();
    const saved = await updateSettings(ctx, 'g2g', { voice_enabled: false, default_language: 'hi-IN', suggested_prompt_source: 'none' });
    assert.equal(saved.voice_enabled, false);
    assert.equal(saved.default_language, 'hi-IN');
    assert.equal(saved.suggested_prompt_source, 'none');
    assert.equal(saved.updated_by, 'Asha (42)');
    assert.ok(saved.updated_at);

    await assert.rejects(updateSettings(ctx, 'g2g', { default_language: 'fr-FR' }), /not a supported language/);
    await assert.rejects(updateSettings(ctx, 'g2g', { show_ask_tab: 'yes' as unknown as boolean }), /true or false/);
    await assert.rejects(updateSettings(ctx, 'unknown', {}), /not a registered project/);
  });

  it('refuses writes when Laravel denies the update right', async () => {
    await assert.rejects(updateSettings(context(false), 'g2g', { voice_enabled: false }), /does not have update rights/);
    await assert.rejects(rotateServiceToken(context(false), 'g2g'), /does not have update rights/);
  });

  it('rotates a token, stores only its hash, and authenticates the new one', async () => {
    const ctx = context();
    await assert.rejects(rotateServiceToken(ctx, 'lms_k12'), /host project/);

    const first = await rotateServiceToken(ctx, 'enterprise_brain');
    assert.match(first.plaintext, /^cai_enterprise_brain_[0-9a-f]{40}$/);
    assert.equal(first.summary.masked, `••••••••${first.plaintext.slice(-4)}`);

    const stored = await ctx.store.getToken('enterprise_brain');
    assert.equal(stored?.hash, hashServiceToken(first.plaintext));
    assert.ok(!JSON.stringify(stored).includes(first.plaintext));

    const good = await authenticateServiceRequest(ctx.store, requestWith({ 'x-project-id': 'enterprise_brain', 'x-service-token': first.plaintext }));
    assert.equal(good.ok, true);
    const viaBearer = await authenticateServiceRequest(ctx.store, requestWith({ 'x-project-id': 'enterprise_brain', authorization: `Bearer ${first.plaintext}` }));
    assert.equal(viaBearer.ok, true);

    const second = await rotateServiceToken(ctx, 'enterprise_brain');
    const old = await authenticateServiceRequest(ctx.store, requestWith({ 'x-project-id': 'enterprise_brain', 'x-service-token': first.plaintext }));
    assert.equal(old.ok, false);
    const fresh = await authenticateServiceRequest(ctx.store, requestWith({ 'x-project-id': 'enterprise_brain', 'x-service-token': second.plaintext }));
    assert.equal(fresh.ok, true);

    const rows = await listProjects(ctx);
    const brain = rows.find((row) => row.adapter.projectId === 'enterprise_brain');
    assert.equal(brain?.token?.last4, second.plaintext.slice(-4));
  });

  it('fails closed on missing header, wrong project, host project and unissued token', async () => {
    const ctx = context();
    const cases = [
      requestWith({ 'x-service-token': 'cai_g2g_x' }),
      requestWith({ 'x-project-id': 'nope', 'x-service-token': 'cai_nope_x' }),
      requestWith({ 'x-project-id': 'lms_k12', 'x-service-token': 'cai_lms_k12_x' }),
      requestWith({ 'x-project-id': 'g2g' }),
      requestWith({ 'x-project-id': 'g2g', 'x-service-token': 'cai_g2g_never_issued' }),
    ];
    for (const request of cases) {
      const result = await authenticateServiceRequest(ctx.store, request);
      assert.equal(result.ok, false);
    }
  });
});
