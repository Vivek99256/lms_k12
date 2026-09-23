'use client';

import { ContentTypeListPage } from '../components/content-type-list';
import { imageHotspotsApi, type H5pImageHotspots } from '../data/h5p-content-types';

/**
 * Image hotspots — list page.
 *
 * The shared list component carries every action (create, edit, duplicate,
 * publish, export, import, delete) and the student filter; this file is the
 * words and the columns. Not to be confused with `/h5p/scenario_based`, which
 * is the older, simpler image-hotspot type over h5p_scenarios.
 */
export default function ImageHotspotsListPage() {
  return (
    <ContentTypeListPage<H5pImageHotspots>
      path="h5p_image_hotspots"
      title="Image hotspots"
      description="Interactive images whose hotspots open text, pictures or rich content"
      noun="image hotspots activity"
      emptyHint="Upload a diagram and place hotspots on it, or import an existing .h5p package."
      api={imageHotspotsApi as never}
      searchText={(row) => `${row.task_description ?? ''} ${row.background_alt ?? ''}`}
      columns={[
        { header: 'Hotspots', numeric: true, render: (row) => row.points?.length ?? 0 },
        {
          header: 'Popups',
          render: (row) => {
            // What a teacher scanning the list actually wants to know about
            // this type: whether the popups are words or pictures.
            const kinds = new Set((row.points ?? []).map((point) => point.popup_type));
            return kinds.size === 0 ? '—' : [...kinds].join(', ');
          },
        },
        { header: 'Pass mark', numeric: true, render: (row) => `${row.pass_percentage}%` },
      ]}
    />
  );
}
