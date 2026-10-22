/**
 * The address of the existing study-deck viewer when it shows a Course Presentation PREVIEW (a template filled from the
 * chapter's stored data), and how the viewer page reads it back. Only simple keys are accepted, so nothing else in an
 * address can steer the request the viewer makes.
 */
const KEY = /^[a-z][a-z0-9_]{0,63}$/;

/** What a source-data preview is called wherever it is offered or shown: it is never presented as a generated presentation. */
export const CHAPTER_DATA_PREVIEW_TITLE = 'Chapter Data Preview — Not a Generated Presentation';

export interface PreviewRequest {
  pedagogy: string;
  format: string;
}

export function previewAddress(chapterId: number, request: PreviewRequest): string {
  return `/student/study-deck/${chapterId}?source=preview&pedagogy=${request.pedagogy}&format=${request.format}`;
}

const RUN = /^r[0-9a-f]{12}$/;

/** The address of the viewer when it plays a draft that is waiting for review (nothing is stored yet). */
export function draftAddress(chapterId: number, run: string): string {
  return `/student/study-deck/${chapterId}?draft=${run}`;
}

/** The draft a viewer address asks for, or null when it asks for none or the id is not a run id. */
export function readDraftRun(params: Pick<URLSearchParams, 'get'> | null | undefined): string | null {
  const run = params?.get('draft') ?? null;

  return run !== null && RUN.test(run) ? run : null;
}

/** The preview a viewer address asks for, or null when it asks for none (or for anything malformed). */
export function readPreviewRequest(params: Pick<URLSearchParams, 'get'> | null | undefined): PreviewRequest | null {
  if (params?.get('source') !== 'preview') return null;
  const pedagogy = params.get('pedagogy');
  const format = params.get('format');

  return pedagogy !== null && format !== null && KEY.test(pedagogy) && KEY.test(format) ? { pedagogy, format } : null;
}
