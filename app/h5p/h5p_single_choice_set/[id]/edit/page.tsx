'use client';

import { ContentTypeEditPage } from '../../../components/content-type-form';
import { singleChoiceSetApi } from '../../../data/h5p-content-types';
import {
  SingleChoiceSetEditor,
  emptySingleChoiceState,
  singleChoiceStateFromRow,
  singleChoiceToPayload,
  validateSingleChoiceState,
} from '../../components/editor';

export default function SingleChoiceSetEditPage() {
  return ContentTypeEditPage({
    path: 'h5p_single_choice_set',
    noun: 'single choice set',
    createTitle: '',
    createDescription: '',
    editTitle: 'Edit single choice set',
    editDescription: 'Changes apply to the next attempt. Attempts already taken keep their result.',
    api: singleChoiceSetApi,
    emptyState: emptySingleChoiceState,
    stateFromRow: singleChoiceStateFromRow,
    toPayload: singleChoiceToPayload,
    validate: validateSingleChoiceState,
    renderEditor: ({ state, onChange, disabled }) => (
      <SingleChoiceSetEditor state={state} onChange={onChange} disabled={disabled} />
    ),
  });
}
