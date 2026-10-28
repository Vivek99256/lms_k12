import assert from 'node:assert/strict';
import test from 'node:test';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { ImageEditDialog } from '../../components/study-deck/ImageEditDialog';
import type { ImageEditorAdapter, ImageEditState } from '../study-deck/imageEditing';
import type { DeckImage } from '../study-deck/types';
import { CoursePresentationApiError } from './api';
import { checkUploadFile, checkUploadSize, createDraftImageAdapter, fetchDraftImageAccess } from './draftImages';

// The session the client reads its bearer token from (a browser's storage).
const store = { getItem: (key: string) => (key === 'userData' ? JSON.stringify({ token: 'tok' }) : null) };
Object.assign(globalThis, { window: {}, localStorage: store, sessionStorage: store });

const image = (id: number) => ({ type: 'photo', url: `https://api.test/images/${id}`, alt: `alt ${id}`, caption: null, width: 400, height: 300, licence: 'BY 2.0', source_url: null, creator: null, attribution: '', attribution_required: false }) as unknown as DeckImage;

// ---------------------------------------------------------------------------------------------------------------------
// Checking a file before it is sent

test('only PNG, JPEG and WebP pictures of a sensible size are sent', () => {
  assert.equal(checkUploadFile({ type: 'image/png', size: 1000 }), null);
  assert.equal(checkUploadFile({ type: 'image/webp', size: 8 * 1024 * 1024 }), null);
  assert.match(checkUploadFile({ type: 'image/gif', size: 1000 }) ?? '', /PNG, JPEG or WebP/);
  assert.match(checkUploadFile({ type: 'application/pdf', size: 1000 }) ?? '', /PNG, JPEG or WebP/);
  assert.match(checkUploadFile({ type: 'image/png', size: 9 * 1024 * 1024 }) ?? '', /limit is 8 MB/);
  assert.match(checkUploadFile({ type: 'image/png', size: 0 }) ?? '', /empty/);
});

test('a picture too small to be clear on a slide is refused with its size', () => {
  assert.equal(checkUploadSize(640, 480), null);
  assert.equal(checkUploadSize(200, 200), null);
  assert.match(checkUploadSize(150, 900) ?? '', /150×900.*at least 200/);
});

// ---------------------------------------------------------------------------------------------------------------------
// The draft adapter's calls

const answer = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

function stubFetch(handler: (url: string, init: RequestInit | undefined) => Promise<Response>): { calls: { url: string; init?: RequestInit }[]; restore: () => void } {
  const original = globalThis.fetch;
  const calls: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = ((url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return handler(String(url), init);
  }) as typeof fetch;
  return { calls, restore: () => void (globalThis.fetch = original) };
}

const RUN = 'ra426fa8762b0';
const result = { status_code: 1, slide: 2, node: null, action: 'replace', image: image(5), can_restore: true, state: { has_image: true, can_add: false, can_replace: true, can_remove: true, reason: null } };

test('search names the slide by run and number, plus the scene for a story, with the teacher\'s words when given', async () => {
  const f = stubFetch(() => answer(200, { status_code: 1, query: 'rain', candidates: [], note: null }));
  try {
    const adapter = createDraftImageAdapter(8592, RUN);
    await adapter.search({ slide: 2 }, ' rain clouds ');
    const { url, init } = f.calls[0];
    assert.match(url, /draft-image\/search\?/);
    assert.match(url, /chapter_id=8592/);
    assert.match(url, new RegExp(`run=${RUN}`));
    assert.match(url, /slide=2/);
    assert.match(url, /q=rain\+clouds/);
    assert.doesNotMatch(url, /node=/);
    assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer tok');
    await adapter.search({ slide: 3, node: 'a1/s1' });
    assert.match(f.calls[1].url, /node=a1%2Fs1/);
    assert.doesNotMatch(f.calls[1].url, /q=/, 'no words: the server uses the slide\'s own');
  } finally {
    f.restore();
  }
});

test('add, replace, remove and restore each call their own endpoint with the target only', async () => {
  const f = stubFetch(() => answer(200, result));
  try {
    const adapter = createDraftImageAdapter(8592, RUN);
    await adapter.setFromCandidate({ slide: 2 }, 'abcdef0123456789');
    await adapter.remove({ slide: 3, node: 'a1/e1' });
    await adapter.restore({ slide: 2 });

    assert.match(f.calls[0].url, /draft-image\/replace$/);
    assert.deepEqual(Object.keys(JSON.parse(String(f.calls[0].init?.body))).sort(), ['candidate_id', 'chapter_id', 'run', 'slide'], 'a candidate id only: never an address or a licence');
    assert.match(f.calls[1].url, /draft-image\/remove$/);
    assert.equal(JSON.parse(String(f.calls[1].init?.body)).node, 'a1/e1');
    assert.match(f.calls[2].url, /draft-image\/restore$/);
    assert.equal(f.calls.every((c) => c.init?.method === 'POST'), true);
  } finally {
    f.restore();
  }
});

test('a refusal is shown in the server\'s own words: approved draft, bad picture, no permission, failed save', async () => {
  for (const [status, message, shown] of [
    [409, 'This presentation is already approved and stored, so its pictures cannot be changed here.', /already approved/],
    [422, 'This picture cannot be used: licence "ARR" is not accepted.', /licence "ARR"/],
    [403, 'You are not authorised to do this.', /not authorised/],
    [500, 'The draft could not be saved, so nothing was changed. Your original picture is still in place.', /original picture is still in place/],
  ] as const) {
    const f = stubFetch(() => answer(status, { status_code: 0, message }));
    try {
      await assert.rejects(() => createDraftImageAdapter(8592, RUN).remove({ slide: 2 }), (e: unknown) => e instanceof CoursePresentationApiError && e.status === status && shown.test(e.message));
    } finally {
      f.restore();
    }
  }
  const expired = stubFetch(() => answer(401, {}));
  try {
    await assert.rejects(() => createDraftImageAdapter(8592, RUN).restore({ slide: 2 }), /session has expired/);
  } finally {
    expired.restore();
  }
});

test('a search that fails on the network reports an error instead of hanging', async () => {
  const f = stubFetch(() => Promise.reject(new TypeError('Failed to fetch')));
  try {
    await assert.rejects(() => createDraftImageAdapter(8592, RUN).search({ slide: 2 }), /Failed to fetch/);
  } finally {
    f.restore();
  }
});

test('the editing controls are offered only to a user the server lets in', async () => {
  const allowed = stubFetch(() => answer(200, { status_code: 1, can_edit: true }));
  try {
    assert.equal(await fetchDraftImageAccess(), true);
    assert.match(allowed.calls[0].url, /draft-image\/access/);
  } finally {
    allowed.restore();
  }
  for (const status of [401, 403, 500]) {
    const denied = stubFetch(() => answer(status, { status_code: 0, message: 'no' }));
    try {
      assert.equal(await fetchDraftImageAccess(), false, `status ${status} hides the controls`);
    } finally {
      denied.restore();
    }
  }
  const down = stubFetch(() => Promise.reject(new TypeError('offline')));
  try {
    assert.equal(await fetchDraftImageAccess(), false);
  } finally {
    down.restore();
  }
});

// ---------------------------------------------------------------------------------------------------------------------
// The dialog

const none: ImageEditorAdapter = {
  search: async () => ({ query: '', candidates: [], note: null }),
  setFromCandidate: async () => result as never,
  setFromUpload: async () => result as never,
  remove: async () => result as never,
  restore: async () => result as never,
};
const st = (over: Partial<ImageEditState> = {}): ImageEditState => ({ has_image: true, can_add: false, can_replace: true, can_remove: true, can_restore: false, reason: null, ...over });
const dialog = (state: ImageEditState, current: DeckImage | null = image(2)) =>
  renderToStaticMarkup(createElement(ImageEditDialog, { adapter: none, target: { slide: 2 }, title: 'Slide 2: Rain', current, state, onClose: () => {}, onChanged: () => {} }));

test('changing a picture opens on search and upload, shows the current picture, and offers Replace, Remove and Cancel', () => {
  const html = dialog(st());
  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-modal="true"/);
  assert.match(html, />Change image</);
  assert.match(html, /Slide 2: Rain\. Only this picture changes/);
  assert.match(html, /Search images/);
  assert.match(html, /Upload image/);
  assert.match(html, /role="tablist"/);
  assert.match(html, /src="https:\/\/api.test\/images\/2"/, 'the current picture is shown');
  assert.match(html, /Choose a picture to preview it here/);
  assert.match(html, /data-testid="replace-image"[^>]*disabled/, 'nothing is chosen: Replace is off');
  assert.match(html, />Replace image</);
  assert.match(html, /data-testid="remove-image"/);
  assert.match(html, />Cancel</);
  assert.doesNotMatch(html, /data-testid="restore-image"/, 'nothing to restore yet');
});

test('a slide with no picture is offered Add image, and no Remove', () => {
  const html = dialog(st({ has_image: false, can_add: true, can_replace: false, can_remove: false }), null);
  assert.match(html, /<p id="image-edit-title"[^>]*>Add image</);
  assert.match(html, />Add image</);
  assert.match(html, /data-testid="no-current"/);
  assert.doesNotMatch(html, /data-testid="remove-image"/);
});

test('Restore original is offered only for a picture that has been changed', () => {
  assert.doesNotMatch(dialog(st()), /Restore original/);
  assert.match(dialog(st({ can_restore: true })), /data-testid="restore-image"/);
});

test('a picture that cannot be changed safely says why and offers neither search, upload nor replace', () => {
  const html = dialog(st({ can_replace: false, can_remove: false, reason: 'This picture carries numbered pins that readers open.' }));
  assert.match(html, /data-testid="cannot-pick"/);
  assert.match(html, /numbered pins/);
  assert.doesNotMatch(html, /Search images/);
  assert.doesNotMatch(html, /data-testid="replace-image"/);
  assert.doesNotMatch(html, /data-testid="remove-image"/);
});
