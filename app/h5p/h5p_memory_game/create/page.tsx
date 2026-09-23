'use client';

import { ContentTypeCreatePage } from '../../components/content-type-form';
import { memoryGameApi } from '../../data/h5p-content-types';
import {
  MemoryGameEditor,
  emptyMemoryState,
  memoryStateFromRow,
  memoryToPayload,
  validateMemoryState,
} from '../components/editor';

export default function MemoryGameCreatePage() {
  return ContentTypeCreatePage({
    path: 'h5p_memory_game',
    noun: 'memory game',
    createTitle: 'New memory game',
    createDescription: 'Each row makes two cards — pictures, words, or one of each',
    editTitle: '',
    editDescription: '',
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
