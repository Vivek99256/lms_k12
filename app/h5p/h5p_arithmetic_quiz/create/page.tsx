'use client';

import { ContentTypeCreatePage } from '../../components/content-type-form';
import { arithmeticQuizApi } from '../../data/h5p-content-types';
import {
  ArithmeticQuizEditor,
  arithmeticStateFromRow,
  arithmeticToPayload,
  emptyArithmeticState,
  validateArithmeticState,
} from '../components/editor';

export default function ArithmeticQuizCreatePage() {
  return ContentTypeCreatePage({
    path: 'h5p_arithmetic_quiz',
    noun: 'arithmetic quiz',
    createTitle: 'New arithmetic quiz',
    createDescription: 'Choose the operations and the difficulty — the questions generate themselves',
    editTitle: '',
    editDescription: '',
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
