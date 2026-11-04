import React from 'react';
import { Compass } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

/**
 * Covers both real empty cases: no `?chapterId=` on the route at all, and a
 * chapter with zero attempt history anywhere (no diagnostic, no practice, no
 * mastery row). Neither is an error — a chapter nobody has touched yet is the
 * ordinary starting point of this page.
 */
export function EmptyChapterState({ chapterName }: { chapterName?: string | null }) {
  return (
    <EmptyState
      icon={<Compass className="h-8 w-8" />}
      title="No journey yet for this chapter"
      description={
        chapterName
          ? `Nothing has been attempted in ${chapterName} yet. Take the chapter diagnostic to begin the climb.`
          : 'Nothing has been attempted in this chapter yet. Take the chapter diagnostic to begin the climb.'
      }
    />
  );
}
