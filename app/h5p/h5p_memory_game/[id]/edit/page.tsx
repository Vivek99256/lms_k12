'use client';

import { ContentTypeEditPage } from '../../../components/content-type-form';
import { memoryGameApi } from '../../../data/h5p-content-types';
import {
  MemoryGameEditor,
  emptyMemoryState,
  memoryStateFromRow,
  memoryToPayload,
  validateMemoryState,
} from '../../components/editor';

export default function MemoryGameEditPage() {
  return ContentTypeEditPage({
    path: 'h5p_memory_game',
    noun: 'memory game',
    createTitle: '',
    createDescription: '',
    editTitle: 'Edit memory game',
    editDescription: 'Changes apply to the next attempt. Attempts already taken keep their result.',
    api: memoryGameApi,
    emptyState: emptyMemoryState,
    stateFromRow: memoryStateFromRow,
    toPayload: memoryToPayload,
    validate: validateMemoryState,
    renderEditor: ({ state, onChange, disabled }) => (
      <MemoryGameEditor state={state} onChange={onChange} disabled={disabled} />
    ),
  });
}
