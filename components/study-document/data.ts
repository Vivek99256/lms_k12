'use client';

import { API_BASE_URL } from '@/app/components/utils/api_url';
import { readApiJson } from '@/app/h5p/data/h5p';
import { fetchWholeChapter } from '@/app/h5p/data/question-bank-library';
import type { BankQuestion } from '@/lib/h5p/question-bank-h5p-map';
import { imageUrlsRequest, resolveDeckImages } from '@/lib/study-deck/images';
import { documentPdfRequest, documentRequest, type PdfVariant } from '@/lib/study-document/api';
import { parseDocument } from '@/lib/study-document/document';
import type { StudyDocument } from '@/lib/study-document/types';

/**
 * Where a study document's data comes from. Everything here is a READ, through endpoints that already exist.
 *
 * document  its structured source, `POST /api/lms-study-deck` with the content item named (the same endpoint the study
 *           deck's player reads, which serves a document when the item is one). Its diagrams are rows in the database; the
 *           API sends each as an address the browser can load.
 * pdf       its PDF, `POST /api/lms-study-deck/pdf`. `inline` asks for it to be shown where the reader already is; the
 *           bytes come back to this page and are shown from memory, so no route changes and no tab opens.
 * bank      the chapter's question-bank rows, `POST /api/lms-question-bank`, the same rows every other module plays. A
 *           document holds question ids and activity choices, never question text.
 */

const FAILED = 'Couldn’t open this document.';

async function fetchImageUrls(ids: number[], instituteId: number, signal?: AbortSignal): Promise<Record<string, string>> {
  const res = await fetch(`${API_BASE_URL}/api/lms-study-deck/image-urls`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify(imageUrlsRequest(ids, instituteId)),
  });
  const raw = await readApiJson(res, 'Couldn’t load the document pictures');
  if (!res.ok || raw.status_code === 0) throw new Error((raw.message as string) || 'Couldn’t load the document pictures.');

  return (raw.data ?? {}) as Record<string, string>;
}

export interface LoadArgs {
  chapterId: number;
  contentId: number;
  instituteId: number;
  signal?: AbortSignal;
}

export async function loadStudyDocument({ chapterId, contentId, instituteId, signal }: LoadArgs): Promise<StudyDocument> {
  const res = await fetch(`${API_BASE_URL}/api/lms-study-deck`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify(documentRequest(chapterId, contentId, instituteId)),
  });
  const raw = await readApiJson(res, FAILED);
  if (!res.ok || raw.status_code === 0) throw new Error((raw.message as string) || FAILED);

  // The API sends addresses already; this only fills in any picture it left as a reference.
  return resolveDeckImages(parseDocument(raw.data), (ids) => fetchImageUrls(ids, instituteId, signal));
}

/** The PDF's bytes, to be shown from memory (or saved). Throws with the server's reason when it will not give them. */
export async function loadDocumentPdf({ chapterId, contentId, instituteId, signal, variant, inline = true }: LoadArgs & { variant: PdfVariant; inline?: boolean }): Promise<Blob> {
  const res = await fetch(`${API_BASE_URL}/api/lms-study-deck/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/pdf' },
    signal,
    body: JSON.stringify(documentPdfRequest(chapterId, contentId, instituteId, { variant, inline })),
  });
  if (!res.ok) {
    let message = 'Couldn’t open the PDF.';
    try {
      message = ((await res.json()) as { message?: string }).message || message;
    } catch {
      /* keep the default */
    }
    throw new Error(message);
  }

  // Typed by us, whatever the server said, so the browser's viewer always treats it as a PDF.
  return new Blob([await res.arrayBuffer()], { type: 'application/pdf' });
}

/** Save a PDF the viewer already holds: a link to the bytes in memory, clicked once. Nothing is navigated. */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** The chapter's question-bank rows. The document picks out the ones it names. */
export async function loadBank(chapterId: number, signal?: AbortSignal): Promise<BankQuestion[]> {
  return (await fetchWholeChapter(chapterId, signal)) as unknown as BankQuestion[];
}
