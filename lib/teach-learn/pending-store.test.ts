import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { PendingResource } from '@/lib/teach-learn/catalogue-agent-client';
import { KEEP_MS, loadPending, mergePending, removePending, resourceKey, savePending, type StorageLike } from './pending-store';

const memory = (): StorageLike & { data: Record<string, string> } => {
  const data: Record<string, string> = {};
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
};

const deck: PendingResource = { kind: 'presentation', chapter_id: 8614, run: 'r1', resource_type: 'Presentation', status: 'generating' };
const doc: PendingResource = { kind: 'document', chapter_id: 8614, document_kind: 'revision_notes', resource_type: 'Revision Notes', status: 'generating' };

describe('pending store', () => {
  it('remembers what was started and brings it back after a refresh', () => {
    const storage = memory();
    savePending(storage, '1', mergePending([], [deck, doc], 1000));

    const back = loadPending(storage, '1', 2000);
    assert.deepEqual(back.map((e) => resourceKey(e.resource)), ['p:8614:r1', 'd:8614:revision_notes']);
  });

  it('keeps one school\'s list apart from another\'s', () => {
    const storage = memory();
    savePending(storage, '1', mergePending([], [deck], 1000));
    assert.deepEqual(loadPending(storage, '2', 2000), []);
  });

  it('does not add an item twice and keeps its first time', () => {
    const first = mergePending([], [deck], 1000);
    const again = mergePending(first, [deck, doc], 5000);
    assert.equal(again.length, 2);
    assert.equal(again[0].savedAt, 1000);
    assert.equal(again[1].savedAt, 5000);
  });

  it('drops an item that is more than a day old', () => {
    const storage = memory();
    savePending(storage, '1', mergePending([], [deck], 1000));
    assert.deepEqual(loadPending(storage, '1', 1000 + KEEP_MS + 1), []);
  });

  it('ignores damaged or foreign data in the browser store', () => {
    const storage = memory();
    storage.setItem('aiStackPendingResources:1', '{not json');
    assert.deepEqual(loadPending(storage, '1'), []);

    storage.setItem('aiStackPendingResources:1', JSON.stringify([{ resource: { kind: 'presentation', chapter_id: -1, run: 'x' }, savedAt: 1 }, { resource: { kind: 'other' }, savedAt: 1 }, 'x']));
    assert.deepEqual(loadPending(storage, '1', 2), []);
  });

  it('removes finished items by key', () => {
    const list = mergePending([], [deck, doc], 1000);
    assert.deepEqual(removePending(list, ['p:8614:r1']).map((e) => resourceKey(e.resource)), ['d:8614:revision_notes']);
  });
});
