/**
 * What View/Open may do with a stored document URL (a lesson plan .pdf or .docx, a link).
 *
 * The page opens the complete public URL in a new tab: a PDF shows in the browser's viewer and a .docx, which browsers
 * cannot display, is downloaded. A URL that is missing, is not http(s), or is only a folder (the Spaces base path with no
 * file name) is refused with a message instead of opening a broken page or doing nothing. The CDN sends no CORS headers,
 * so the browser cannot ask whether the file exists; that is checked when the file is stored.
 */
export type DocumentTarget = { ok: true; url: string } | { ok: false; message: string };

export const MISSING_DOCUMENT_MESSAGE = 'This resource has no file to open yet. Reload the page, and if it still fails, ask an administrator to check it.';
export const INCOMPLETE_DOCUMENT_MESSAGE = 'This resource has an incomplete file address, so it was not opened. Ask an administrator to check it.';

export function documentTarget(url: string | null | undefined): DocumentTarget {
  const raw = (url ?? '').trim();
  if (raw === '') return { ok: false, message: MISSING_DOCUMENT_MESSAGE };
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, message: INCOMPLETE_DOCUMENT_MESSAGE };
  }
  const isWeb = parsed.protocol === 'https:' || parsed.protocol === 'http:';
  const isFolderOnly = parsed.pathname.endsWith('/');
  if (!isWeb || isFolderOnly) {
    return { ok: false, message: INCOMPLETE_DOCUMENT_MESSAGE };
  }
  return { ok: true, url: raw };
}
