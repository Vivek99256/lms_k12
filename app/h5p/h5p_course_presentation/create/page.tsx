'use client';

import { ContentTypeCreatePage } from '../../components/content-type-form';
import { coursePresentationApi } from '../../data/h5p-content-types';
import {
  CoursePresentationEditor,
  emptyPresentationState,
  presentationStateFromRow,
  presentationToPayload,
  validatePresentationState,
} from '../components/editor';

export default function CoursePresentationCreatePage() {
  return ContentTypeCreatePage({
    path: 'h5p_course_presentation',
    noun: 'presentation',
    createTitle: 'New course presentation',
    createDescription: 'Slides carrying text, media and questions',
    editTitle: '',
    editDescription: '',
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
