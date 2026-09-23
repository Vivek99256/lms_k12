'use client';

import { ContentTypeEditPage } from '../../../components/content-type-form';
import { trueFalseApi } from '../../../data/h5p-content-types';
import {
  TrueFalseEditor,
  emptyTrueFalseState,
  trueFalseStateFromRow,
  trueFalseToPayload,
  validateTrueFalseState,
} from '../../components/editor';

export default function TrueFalseEditPage() {
  return ContentTypeEditPage({
    path: 'h5p_true_false',
    noun: 'true or false activity',
    createTitle: '',
    createDescription: '',
    editTitle: 'Edit true or false activity',
    editDescription: 'Changes apply to the next attempt. Attempts already taken keep their result.',
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
