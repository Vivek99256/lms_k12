/**
 * How the interface asks the backend for a study document. No fetch here: only what is asked, and the rules about which
 * copy of a PDF is offered to whom, so every rule is testable with node:test.
 *
 * A document is read through the study deck's own two endpoints, which now serve both:
 *   POST /api/lms-study-deck       its structured source (the parts the online practice is built from)
 *   POST /api/lms-study-deck/pdf   its PDF, as a download or `inline` to show in place
 * Neither is given a file name or a path: the server finds the file from the content item and checks that the item belongs
 * to the chapter and school named in the request.
 */

import type { DocumentKind } from './types';

/** `revision` is the copy that is stored (answers shown / teacher edition); `practice` is drawn on request (answers hidden / student handout). */
export type PdfVariant = 'revision' | 'practice';

export type Audience = 'teacher' | 'student';

/** The body of `POST /api/lms-study-deck` for one content item. */
export function documentRequest(chapterId: number, contentId: number, instituteId: number): Record<string, number> {
  return {
    chapter_id: chapterId,
    content_id: contentId,
    ...(Number.isFinite(instituteId) && instituteId > 0 ? { sub_institute_id: instituteId } : {}),
  };
}

/**
 * The body of `POST /api/lms-study-deck/pdf`. `inline` asks for the file to be shown where the reader already is; the
 * server only honours the two words it knows and treats anything else as a download.
 */
export function documentPdfRequest(
  chapterId: number,
  contentId: number,
  instituteId: number,
  options: { variant?: PdfVariant; inline?: boolean } = {},
): Record<string, number | string> {
  return {
    ...documentRequest(chapterId, contentId, instituteId),
    ...(options.variant === 'practice' ? { variant: 'practice' } : {}),
    ...(options.inline ? { disposition: 'inline' } : {}),
  };
}

/** The two copies of a PDF as a reader names them. */
export function variantLabels(kind: DocumentKind): Record<PdfVariant, string> {
  return kind === 'activities'
    ? { revision: 'Teacher edition', practice: 'Student handout' }
    : { revision: 'Answers shown', practice: 'Answers hidden' };
}

/**
 * Which copy opens first. A teacher opens the full copy (answers, teacher steps and keys); a student opens the copy
 * without them, so a student never lands on the answers by default.
 *
 * This is a default, not access control: the interface offers both copies to everyone, because the content endpoints are
 * not authenticated per learner (see docs). It is said plainly in the documentation and not hidden behind a button.
 */
export function defaultVariant(audience: Audience): PdfVariant {
  return audience === 'student' ? 'practice' : 'revision';
}

/**
 * Which copies the interface offers to a reader. Everyone is offered both, except that the student interface does not
 * offer a classroom activity's TEACHER edition (its steps for the teacher, its answer keys and its assessment): a student
 * has the student handout.
 *
 * Like `defaultVariant` this shapes what is offered; it does not restrict what the server will send.
 */
export function variantsOffered(kind: DocumentKind, audience: Audience): PdfVariant[] {
  return kind === 'activities' && audience === 'student' ? ['practice'] : ['revision', 'practice'];
}

/** A file name from the item's title ("Chapter 1 Remedial Class" -> "chapter-1-remedial-class.pdf"), with the copy named when it is the other one. */
export function documentFileName(title: string | null | undefined, variant: PdfVariant = 'revision'): string {
  const slug = String(title ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return `${slug || 'study-document'}${variant === 'practice' ? '-practice' : ''}.pdf`;
}

/** Can this browser show a PDF inside a page? A phone usually cannot, and is offered the download instead of a blank frame. */
export function canShowPdfInline(nav: { pdfViewerEnabled?: boolean; mimeTypes?: { length: number } } | null | undefined): boolean {
  if (!nav) return true;
  if (typeof nav.pdfViewerEnabled === 'boolean') return nav.pdfViewerEnabled;

  return true;
}
