import type { CpPreflight } from './api';
import { previewAddress } from './previewAddress';

export interface ResolvedContent {
  url: string;
  label: string;
  kind: 'stored_presentation' | 'stored_story' | 'stored_resource' | 'template_preview';
  title?: string;
}

/**
 * Resolves content and player URL for a selected teaching method and format.
 * Returns null if no content exists for the selection, indicating the create/generate state should be shown.
 */
export function resolveSelectedContent(
  chapterId: number,
  pedagogy: string | null,
  format: string | null,
  preflight: CpPreflight | null,
): ResolvedContent | null {
  if (!pedagogy || !format || !preflight) return null;

  // 1. Check existing stored resources made for exactly this format AND teaching method. An item stored for another
  //    method, or without one (the chapter's original presentation), is never opened under this choice.
  const resources = preflight.existing_resources ?? [];
  const matchingResource = resources.find(
    (r) => (r.format ?? 'interactive_slides') === format && r.method === pedagogy,
  );

  if (matchingResource && typeof matchingResource.ref === 'number') {
    const url = `/student/study-deck/${chapterId}?content=${matchingResource.ref}`;
    if (format === 'branching_scenario') {
      return {
        url,
        label: 'Open Branching Scenario',
        kind: 'stored_story',
        title: matchingResource.title,
      };
    }
    if (format === 'interactive_slides') {
      return {
        url,
        label: 'Open PowerPoint',
        kind: 'stored_presentation',
        title: matchingResource.title,
      };
    }
    return {
      url,
      label: `Open ${matchingResource.type || 'Content'}`,
      kind: 'stored_resource',
      title: matchingResource.title,
    };
  }

  // 2. Check template availability for this format
  if (preflight.fit?.template?.available) {
    const url = previewAddress(chapterId, { pedagogy, format });
    if (format === 'interactive_slides') {
      return {
        url,
        label: 'Open PowerPoint',
        kind: 'template_preview',
        title: 'Classroom Presentation',
      };
    }
    return {
      url,
      label: 'Open Preview',
      kind: 'template_preview',
    };
  }

  // 3. No content exists for this format
  return null;
}
