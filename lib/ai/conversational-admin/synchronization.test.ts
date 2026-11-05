import test from 'node:test';
import assert from 'node:assert/strict';

import { MemoryConversationalAdminStore } from './store';
import { defaultChannelSettings } from './types';
import { listProjectAdapters } from '../project-resolver';

test('Project registry includes only the original platforms (lms_k12, g2g, enterprise_brain)', () => {
  const adapters = listProjectAdapters();
  const projectIds = adapters.map((a) => a.projectId);

  // Must include original 3
  assert.ok(projectIds.includes('lms_k12'), 'lms_k12 must be registered');
  assert.ok(projectIds.includes('g2g'), 'g2g must be registered');
  assert.ok(projectIds.includes('enterprise_brain'), 'enterprise_brain must be registered');

  // Must NOT include brain or enterprise
  assert.equal(projectIds.includes('brain'), false, 'brain must NOT be in project registry');
  assert.equal(projectIds.includes('enterprise'), false, 'enterprise must NOT be in project registry');
  assert.equal(projectIds.length, 3, 'There must be exactly 3 registered project adapters');
});

test('Channel settings are module-specific and do not automatically affect other modules', async () => {
  const store = new MemoryConversationalAdminStore();

  // 1. Save settings for LMS K-12: Voice disabled, Hindi selected
  const lmsSettings = {
    ...defaultChannelSettings('lms_k12'),
    voice_enabled: false,
    default_language: 'hi-IN',
    updated_at: new Date().toISOString(),
    updated_by: 'Kalpesh Sheth (7013)',
  };
  await store.putSettings(lmsSettings);

  // 2. Save settings for G2G: Voice enabled, English selected
  const g2gSettings = {
    ...defaultChannelSettings('g2g'),
    voice_enabled: true,
    default_language: 'en-IN',
    updated_at: new Date().toISOString(),
    updated_by: 'Kalpesh Sheth (7013)',
  };
  await store.putSettings(g2gSettings);

  // 3. Verify LMS K-12 has its own configuration
  const fetchedLms = await store.getSettings('lms_k12');
  assert.ok(fetchedLms);
  assert.equal(fetchedLms.voice_enabled, false, 'LMS K-12 voice must be disabled');
  assert.equal(fetchedLms.default_language, 'hi-IN', 'LMS K-12 language must be Hindi');

  // 4. Verify G2G has its own configuration and was NOT overridden by LMS K-12
  const fetchedG2g = await store.getSettings('g2g');
  assert.ok(fetchedG2g);
  assert.equal(fetchedG2g.voice_enabled, true, 'G2G voice must be enabled');
  assert.equal(fetchedG2g.default_language, 'en-IN', 'G2G language must be English');

  // 5. Verify Enterprise Brain is unaffected
  const fetchedEb = await store.getSettings('enterprise_brain');
  assert.equal(fetchedEb, null, 'Enterprise Brain has not been configured and remains separate');
});
