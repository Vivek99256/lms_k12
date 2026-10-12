/**
 * The study deck's classroom PDF: a second file of the same content item. Opening the item still goes to the
 * interactive player (its `deep_link`); this only adds a download. Nothing here knows a URL: the backend says
 * whether a PDF exists (`pdf_url` on the content row) and serves it from `POST /api/lms-study-deck/pdf`, which
 * checks that the content item belongs to the chapter and school in the request.
 */

/** The fields of a Classroom Resource row this feature reads. */
export interface PdfCapableRow {
  /** Present only for a study deck whose PDF is really stored. */
  pdf_url?: string | null;
}

/** A PDF is offered only when the backend reported one. */
export function hasStudyDeckPdf(row: PdfCapableRow | null | undefined): boolean {
  return typeof row?.pdf_url === 'string' && row.pdf_url.trim() !== '';
}

/** The body of `POST /api/lms-study-deck/pdf`. The file is found by the server from the content row, never from here. */
export function studyDeckPdfRequest(chapterId: number, contentId: number, instituteId: number): Record<string, number> {
  return {
    chapter_id: chapterId,
    content_id: contentId,
    ...(Number.isFinite(instituteId) && instituteId > 0 ? { sub_institute_id: instituteId } : {}),
  };
}

/** A download name from the item's title ("Chapter Study Deck" -> "chapter-study-deck.pdf"). */
export function pdfFileNameFromTitle(title: string | null | undefined): string {
  const slug = String(title ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return (slug || 'study-deck') + '.pdf';
}

/** A safe download name: the server's, when it sent one, otherwise a plain default. */
export function pdfDownloadName(contentDisposition: string | null | undefined, fallback = 'study-deck.pdf'): string {
  // A cross-origin response hides this header from the page, so the caller's own name is the usual answer.
  const match = /filename="?([^";]+)"?/i.exec(contentDisposition ?? '');
  const name = (match?.[1] ?? '').replace(/[^A-Za-z0-9._-]+/g, '_');
  return name.toLowerCase().endsWith('.pdf') ? name : fallback;
}
