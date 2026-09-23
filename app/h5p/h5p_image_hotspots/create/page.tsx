'use client';

import { ContentTypeCreatePage } from '../../components/content-type-form';
import { imageHotspotsApi } from '../../data/h5p-content-types';
import {
  ImageHotspotsEditor,
  emptyHotspotsState,
  hotspotsStateFromRow,
  hotspotsToPayload,
  validateHotspotsState,
} from '../components/editor';

export default function ImageHotspotsCreatePage() {
  return ContentTypeCreatePage({
    path: 'h5p_image_hotspots',
    noun: 'image hotspots activity',
    createTitle: 'New image hotspots activity',
    createDescription: 'Upload a diagram, then click it to place hotspots',
    editTitle: '',
    editDescription: '',
    api: imageHotspotsApi,
    emptyState: emptyHotspotsState,
    stateFromRow: hotspotsStateFromRow,
    toPayload: hotspotsToPayload,
    validate: validateHotspotsState,
    renderEditor: ({ state, onChange, disabled }) => (
      <ImageHotspotsEditor state={state} onChange={onChange} disabled={disabled} />
    ),
  });
}
