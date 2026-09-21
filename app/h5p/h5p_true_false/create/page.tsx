'use client';

import { ContentTypeCreatePage } from '../../components/content-type-form';
import { trueFalseApi } from '../../data/h5p-content-types';
import {
  TrueFalseEditor,
  emptyTrueFalseState,
  trueFalseStateFromRow,
  trueFalseToPayload,
  validateTrueFalseState,
} from '../components/editor';

export default function TrueFalseCreatePage() {
  return ContentTypeCreatePage({
    path: 'h5p_true_false',
    noun: 'true or false activity',
    createTitle: 'New true or false activity',
    createDescription: 'Write the statements — ask all of them, or a different few each attempt',
    editTitle: '',
    editDescription: '',
    api: trueFalseApi,
    emptyState: emptyTrueFalseState,
    stateFromRow: trueFalseStateFromRow,
    toPayload: trueFalseToPayload,
    validate: validateTrueFalseState,
    renderEditor: ({ state, onChange, disabled }) => (
      <TrueFalseEditor state={state} onChange={onChange} disabled={disabled} />
    ),
  });
}
