'use client';

import { ContentTypeEditPage } from '../../../components/content-type-form';
import { imageHotspotsApi } from '../../../data/h5p-content-types';
import {
  ImageHotspotsEditor,
  emptyHotspotsState,
  hotspotsStateFromRow,
  hotspotsToPayload,
  validateHotspotsState,
} from '../../components/editor';

export default function ImageHotspotsEditPage() {
  return ContentTypeEditPage({
    path: 'h5p_image_hotspots',
    noun: 'image hotspots activity',
    createTitle: '',
    createDescription: '',
    editTitle: 'Edit image hotspots activity',
    editDescription: 'Click the image to add a hotspot, or select one to change what it opens.',
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
