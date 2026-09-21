'use client';

import { ContentTypeCreatePage } from '../../components/content-type-form';
import { singleChoiceSetApi } from '../../data/h5p-content-types';
import {
  SingleChoiceSetEditor,
  emptySingleChoiceState,
  singleChoiceStateFromRow,
  singleChoiceToPayload,
  validateSingleChoiceState,
} from '../components/editor';

export default function SingleChoiceSetCreatePage() {
  return ContentTypeCreatePage({
    path: 'h5p_single_choice_set',
    noun: 'single choice set',
    createTitle: 'New single choice set',
    createDescription: 'Write the questions — each one has exactly one right answer',
    editTitle: '',
    editDescription: '',
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
