'use client';

import { HotspotActivity } from '@/app/h5p/h5p_image_hotspots/[id]/page';
import type { H5pImageHotspots } from '@/app/h5p/data/h5p-content-types';
import { buildFor, NotPlayable, scopeOfQuestion } from './shared';
import type { PlayerProps } from './types';

/**
 * Image hotspots, rendered through H5P.ImageHotspots.
 */
export function ImageHotspotsPlayer({ question, onResult }: PlayerProps) {
  const { activity, reason } = buildFor(question, 'image_hotspots');

  if (!activity || activity.kind !== 'image_hotspots') {
    return <NotPlayable reason={reason ?? 'This question cannot be played as an image hotspot.'} />;
  }

  const scope = scopeOfQuestion(question);

  return (
    <HotspotActivity
      item={activity.item as unknown as H5pImageHotspots}
      ctx={{
        chapter_id: String(scope.chapter_id ?? ''),
        standard_id: String(scope.standard_id ?? ''),
        subject_id: String(scope.subject_id ?? ''),
      }}
      onResult={(res) =>
        onResult?.({
          questionId: Number(question.id),
          score: res.score,
          maxScore: res.maxScore,
          correct: res.passed,
          durationSeconds: res.durationSeconds,
          response: res.response,
        })
      }
    />
  );
}
