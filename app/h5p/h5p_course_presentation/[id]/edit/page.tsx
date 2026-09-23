'use client';

import { ContentTypeEditPage } from '../../../components/content-type-form';
import { coursePresentationApi } from '../../../data/h5p-content-types';
import {
  CoursePresentationEditor,
  emptyPresentationState,
  presentationStateFromRow,
  presentationToPayload,
  validatePresentationState,
} from '../../components/editor';

export default function CoursePresentationEditPage() {
  return ContentTypeEditPage({
    path: 'h5p_course_presentation',
    noun: 'presentation',
    createTitle: '',
    createDescription: '',
    editTitle: 'Edit course presentation',
    editDescription: 'Changes apply to the next attempt. Attempts already taken keep their result.',
    api: coursePresentationApi,
    emptyState: emptyPresentationState,
    stateFromRow: presentationStateFromRow,
    toPayload: presentationToPayload,
    validate: validatePresentationState,
    renderEditor: ({ state, onChange, disabled }) => (
      <CoursePresentationEditor state={state} onChange={onChange} disabled={disabled} />
    ),
  });
}
