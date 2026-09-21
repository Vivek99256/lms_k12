'use client';

import { ContentTypeEditPage } from '../../../components/content-type-form';
import { arithmeticQuizApi } from '../../../data/h5p-content-types';
import {
  ArithmeticQuizEditor,
  arithmeticStateFromRow,
  arithmeticToPayload,
  emptyArithmeticState,
  validateArithmeticState,
} from '../../components/editor';

export default function ArithmeticQuizEditPage() {
  return ContentTypeEditPage({
    path: 'h5p_arithmetic_quiz',
    noun: 'arithmetic quiz',
    createTitle: '',
    createDescription: '',
    editTitle: 'Edit arithmetic quiz',
    editDescription: 'Changes apply to the next attempt. Attempts already taken keep their result.',
    api: arithmeticQuizApi,
    emptyState: emptyArithmeticState,
    stateFromRow: arithmeticStateFromRow,
    toPayload: arithmeticToPayload,
    validate: validateArithmeticState,
    renderEditor: ({ state, onChange, disabled }) => (
      <ArithmeticQuizEditor state={state} onChange={onChange} disabled={disabled} />
    ),
  });
}
