import { API_BASE_URL } from '@/app/components/utils/api_url';
import { buildSessionContext } from '@/lib/erp-client';
import type { ImageEditorAdapter, ImageEditResult, ImageSearch, ImageTarget, UploadOptions } from '@/lib/study-deck/imageEditing';

import { CoursePresentationApiError, request } from './api';

/**
 * The picture editor's adapter for a draft that is waiting for review (next_lms_erp `lms/course-presentation/draft-image/*`). It serves the
 * drafts of every format the Course Presentation flow makes: a study deck or Classroom Presentation (slide pictures) and a story lesson
 * (scene pictures).
 *
 * The server owns every rule: which pictures can be edited, which may be used, what is stored, and that an approved draft is never changed.
 * This file only asks, and checks an upload in the browser first so an obvious mistake is caught before a file is sent. A picture found by
 * search is named by an id the server gave out; no address is ever sent back.
 */

export const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const MIN_SIDE = 200;

/** What is wrong with a file before it is sent, or null. The server checks again from the bytes. */
export function checkUploadFile(file: { type: string; size: number }): string | null {
  if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) return 'Choose a PNG, JPEG or WebP picture.';
  if (file.size > MAX_UPLOAD_BYTES) return `That file is ${(file.size / 1048576).toFixed(1)} MB; the limit is ${MAX_UPLOAD_BYTES / 1048576} MB.`;
  if (file.size === 0) return 'That file is empty.';
  return null;
}

export function checkUploadSize(width: number, height: number): string | null {
  return width < MIN_SIDE || height < MIN_SIDE ? `The picture is ${width}×${height}. It must be at least ${MIN_SIDE} pixels on each side to be clear on a slide.` : null;
}

/** The pixel size of a picture file, read in the browser; rejects when the file is not a picture it can decode. */
export function readImageSize(file: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file is not a picture this browser can read.'));
    };
    img.src = url;
  });
}

/** The query fields that name a picture: the slide, and the scene when it is a story's. */
const where = (chapterId: number, run: string, target: ImageTarget): Record<string, string> => ({
  chapter_id: String(chapterId),
  run,
  slide: String(target.slide),
  ...(target.node !== undefined ? { node: target.node } : {}),
});

/**
 * Can this user change pictures at all? Asked of the server's own permission gate, so the controls are shown only to a user whose change the
 * server would accept. Any refusal or failure hides them (they are never a way around the server).
 */
export async function fetchDraftImageAccess(signal?: AbortSignal): Promise<boolean> {
  try {
    const res = await request<{ can_edit?: boolean }>('GET', 'draft-image/access', {}, signal);
    return res.can_edit === true;
  } catch {
    return false;
  }
}

export function createDraftImageAdapter(chapterId: number, run: string): ImageEditorAdapter {
  return {
    search: (target, query, signal) =>
      request<ImageSearch & { status_code: number }>('GET', 'draft-image/search', { ...where(chapterId, run, target), ...(query?.trim() ? { q: query.trim() } : {}) }, signal),
    setFromCandidate: (target, candidateId) => request<ImageEditResult>('POST', 'draft-image/replace', { ...where(chapterId, run, target), candidate_id: candidateId }),
    setFromUpload: (target, file, options) => uploadPicture(chapterId, run, target, file, options),
    remove: (target) => request<ImageEditResult>('POST', 'draft-image/remove', where(chapterId, run, target)),
    restore: (target) => request<ImageEditResult>('POST', 'draft-image/restore', where(chapterId, run, target)),
  };
}

/**
 * Sends the picture file. XHR rather than fetch so the upload can report its progress; a failed or cancelled upload changes nothing on the
 * server (the draft is only edited once the whole file has arrived and passed the checks).
 */
export function uploadPicture(chapterId: number, run: string, target: ImageTarget, file: File, options: UploadOptions): Promise<ImageEditResult> {
  const { token } = buildSessionContext();
  if (!token) return Promise.reject(new CoursePresentationApiError('Your session has expired. Please sign in again.', 401));

  const body = new FormData();
  for (const [key, value] of Object.entries(where(chapterId, run, target))) body.set(key, value);
  body.set('rights_confirmed', '1');
  body.set('image', file);
  if (options.credit?.trim()) body.set('credit', options.credit.trim());
  if (options.alt?.trim()) body.set('alt', options.alt.trim());

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}/api/lms/course-presentation/draft-image/replace`);
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (e) => e.lengthComputable && options.onProgress?.(e.loaded / e.total);
    xhr.onerror = () => reject(new CoursePresentationApiError('The upload could not reach the server. Check your connection and try again. Your picture is unchanged.', 0));
    xhr.onabort = () => reject(new CoursePresentationApiError('The upload was cancelled. Your picture is unchanged.', 0));
    xhr.ontimeout = () => reject(new CoursePresentationApiError('The upload took too long. Your picture is unchanged.', 0));
    xhr.onload = () => {
      let raw: Record<string, unknown> = {};
      try {
        raw = JSON.parse(xhr.responseText) as Record<string, unknown>;
      } catch {
        /* a failing server may answer with a page; never show it raw */
      }
      if (xhr.status >= 200 && xhr.status < 300 && Number(raw.status_code) === 1) return resolve(raw as unknown as ImageEditResult);
      if (xhr.status === 401) return reject(new CoursePresentationApiError('Your session has expired. Please sign in again.', 401));
      if (xhr.status === 413) return reject(new CoursePresentationApiError('That file is too large for the server.', 413));
      const message = typeof raw.message === 'string' && raw.message !== '' ? raw.message : `The picture could not be changed (${xhr.status}).`;
      reject(new CoursePresentationApiError(message, xhr.status));
    };
    options.signal?.addEventListener('abort', () => xhr.abort());
    xhr.send(body);
  });
}
