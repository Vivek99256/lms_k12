/**
 * Which existing viewer may show a Course Presentation output.
 *
 * The decision rests on what the SERVER returned for a stored item (how the existing Classroom Resource list already
 * tells them apart), compared with the viewer the server's fit result named for the selected format. A label chosen
 * by the client is never what picks the renderer, and an item that does not match is refused, not shown in a viewer
 * that cannot render it.
 *
 * Existing viewers (verified in the code base):
 *   study_deck          the study-deck player, reached by the deep link `/student/study-deck/<chapter>?content=<id>`
 *   branching_scenario  the H5P branching-scenario player, `/h5p/h5p_branching_scenario/<id>`
 *   study_document      the in-place study-document viewer (revision notes, remedial class, classroom activities)
 * No viewer exists for scenario lessons, video lessons, simulations or Socratic dialogue.
 */
export type CpViewer = 'study_deck' | 'branching_scenario' | 'study_document';

export interface StoredOutput {
  /** The item's server-issued deep link, if any. */
  deepLink?: string | null;
  /** Set by the server on a study document (revision notes, remedial class, activities). */
  studyDocKind?: string | null;
}

/** What a stored item really is, from the fields the server set on it. */
export function storedOutputType(item: StoredOutput | null | undefined): CpViewer | null {
  if (!item) return null;
  const link = item.deepLink ?? '';
  if (/^\/student\/study-deck\/\d+\?content=\d+$/.test(link)) return 'study_deck';
  if (/^\/h5p\/h5p_branching_scenario\/\d+$/.test(link)) return 'branching_scenario';
  if (item.studyDocKind) return 'study_document';
  return null;
}

export type ViewerRoute = { ok: true; viewer: CpViewer } | { ok: false; reason: string };

/**
 * @param selectedViewer the `viewer_type` the server returned for the selected format (null: no viewer exists)
 * @param stored the stored output to open
 */
export function resolveViewer(selectedViewer: string | null | undefined, stored: StoredOutput | null | undefined): ViewerRoute {
  if (!selectedViewer) return { ok: false, reason: 'No viewer exists for this format yet.' };
  if (selectedViewer !== 'study_deck' && selectedViewer !== 'branching_scenario' && selectedViewer !== 'study_document') {
    return { ok: false, reason: 'This format names a viewer that is not available.' };
  }
  const actual = storedOutputType(stored);
  if (actual === null) return { ok: false, reason: 'The stored item is not a kind of content this screen can open.' };
  if (actual !== selectedViewer) return { ok: false, reason: 'The stored item is not the format that was selected, so it will not be shown in that viewer.' };
  return { ok: true, viewer: selectedViewer };
}
