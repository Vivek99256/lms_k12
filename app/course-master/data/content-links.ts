import type { ChapterContentAsset } from '@/app/course-master/data/chapters';

/**
 * Picking the link a browser can actually RENDER for a piece of chapter content.
 *
 * Content rows store whatever link the upload or the generator produced, and a
 * good number of them are direct file links. Handing a .pptx straight to a tab
 * does not open it - the browser has no renderer for Office formats, so it
 * offers a Save As dialog instead, and "Open" turns into a download.
 *
 * Shared by the teacher chapter screen and the student content screen so both
 * resolve links the same way.
 */

// Files the browser can only download (no native renderer). PDFs, images and
// videos are deliberately absent - those render inline in a tab.
const DOWNLOAD_ONLY_FILE_PATTERN = /\.(pptx?|docx?|xlsx?|csv|zip|rtf)(?:$|[?#])/i;

// A deck page lives on gamma.app itself. It must not match the export CDN,
// assets.api.gamma.app, whose links are .pptx files: that host ends in
// ".gamma.app/" too, so a looser pattern treated every export download as a
// viewable deck and handed the raw .pptx straight to the browser.
const GAMMA_DECK_PATTERN = /^https?:\/\/(?:www\.)?gamma\.app\//i;

function isHttpUrl(value?: string | null): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
}

// Export links are often signed URLs with no file extension in the path, so
// also treat an explicit attachment disposition or an office format hint in the
// query string as "this will download".
function isDownloadOnlyUrl(value: string): boolean {
  return (
    DOWNLOAD_ONLY_FILE_PATTERN.test(value) ||
    /response-content-disposition=[^&]*attachment/i.test(value) ||
    /[?&][^=]*=(?:pptx|docx|xlsx)(?:$|[&#])/i.test(value)
  );
}

// Word/PowerPoint/Excel files have no native browser preview, so opening one
// directly is always a download. They go through a viewer instead.
function isOfficeDocumentUrl(value: string, filename?: string | null): boolean {
  return /\.(docx?|pptx?|xlsx?)(?:$|[?#])/i.test(value) ||
    /\.(docx?|pptx?|xlsx?)(?:$|[?#])/i.test(filename ?? '');
}

/**
 * Office Online renders the document as a page, so "Open" lands on something
 * readable instead of a download. It fetches `src` server-side, which the
 * content links allow: they are public, unauthenticated URLs.
 *
 * `view.aspx` rather than the Google Docs `embedded=true` viewer because Open
 * targets a real tab, and the embedded viewer is built to sit in an iframe.
 */
function toOfficeViewerUrl(value: string): string {
  return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(value)}`;
}

/**
 * Pick the link a browser can render in a tab, from every candidate a content
 * row offers: a Gamma deck page renders natively, an Office document goes
 * through the Office Online viewer, other inline-viewable links (PDFs, images)
 * render directly, and anything left over falls back to the viewer too, so
 * "Open" never downloads.
 *
 * Candidates are classified rather than trusted by field: the same export link
 * turns up in `url` and in `filename` depending on the row, so an assumption
 * that one field holds a deck page and the other a file does not hold.
 */
export function resolveViewableUrl(
  candidates: Array<string | null | undefined>,
  filename?: string | null
): string | undefined {
  const httpCandidates = candidates.filter(isHttpUrl).map((value) => value.trim());

  if (!httpCandidates.length) {
    // Relative paths and anything else non-http are handed back untouched -
    // there is nothing to classify, and the caller's own fallbacks apply.
    return candidates.find((value) => typeof value === 'string' && value.trim() !== '') ?? undefined;
  }

  const deckLink = httpCandidates.find((value) => GAMMA_DECK_PATTERN.test(value));
  if (deckLink) return deckLink;

  const officeDocLink = httpCandidates.find((value) => isOfficeDocumentUrl(value, filename));
  if (officeDocLink) return toOfficeViewerUrl(officeDocLink);

  const inlineViewable = httpCandidates.find((value) => !isDownloadOnlyUrl(value));
  if (inlineViewable) return inlineViewable;

  return toOfficeViewerUrl(httpCandidates[0]);
}

/** The two link fields a ChapterContentAsset carries, resolved for viewing. */
export function resolveViewableContentUrl(asset: ChapterContentAsset): string | undefined {
  return resolveViewableUrl([asset.url, asset.filename], asset.filename);
}
