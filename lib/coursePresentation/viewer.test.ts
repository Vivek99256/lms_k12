import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveViewer, storedOutputType } from './viewer';

const deck = { deepLink: '/student/study-deck/8592?content=61500' };
const scenario = { deepLink: '/h5p/h5p_branching_scenario/12' };
const doc = { studyDocKind: 'revision_notes' };

test('a stored item is classified from the fields the server set', () => {
  assert.equal(storedOutputType(deck), 'study_deck');
  assert.equal(storedOutputType(scenario), 'branching_scenario');
  assert.equal(storedOutputType(doc), 'study_document');
  assert.equal(storedOutputType({ deepLink: '/h5p/scenario_based/3' }), null);
  assert.equal(storedOutputType({ deepLink: 'https://evil.example/student/study-deck/1?content=2' }), null);
  assert.equal(storedOutputType(null), null);
});

test('each format reaches its own viewer', () => {
  assert.deepEqual(resolveViewer('study_deck', deck), { ok: true, viewer: 'study_deck' });
  assert.deepEqual(resolveViewer('branching_scenario', scenario), { ok: true, viewer: 'branching_scenario' });
  assert.deepEqual(resolveViewer('study_document', doc), { ok: true, viewer: 'study_document' });
});

test('an output is never shown in a viewer that is not its own', () => {
  for (const [viewer, item] of [['study_deck', scenario], ['study_deck', doc], ['branching_scenario', deck], ['study_document', deck]] as const) {
    const r = resolveViewer(viewer, item);
    assert.equal(r.ok, false, `${viewer} must refuse ${JSON.stringify(item)}`);
  }
});

test('a format with no viewer, or a made-up viewer, is refused', () => {
  assert.equal(resolveViewer(null, deck).ok, false);
  assert.equal(resolveViewer(undefined, deck).ok, false);
  assert.equal(resolveViewer('video_player', deck).ok, false);
  assert.equal(resolveViewer('study_deck', null).ok, false);
});
