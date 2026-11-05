import assert from 'node:assert/strict';
import test from 'node:test';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { ImageEditDialog } from '../../components/study-deck/ImageEditDialog';
import { actionSentence, withEditedImage, withEditedState, type ImageEditorAdapter, type ImageEditState } from '../study-deck/imageEditing';
import type { DeckImage, StudyDeck } from '../study-deck/types';
import { CoursePresentationApiError } from './api';
import { createStoredImageAdapter, ITEM_PICTURES_UNSUPPORTED, loadStoredImageStates, storedFailureReason, unavailableStates, viewerKind, withItemFallbacks } from './storedImages';

// The session the client reads its bearer token from (a browser's storage).
const store = { getItem: (key: string) => (key === 'userData' ? JSON.stringify({ token: 'tok' }) : null) };
Object.assign(globalThis, { window: { location: { hostname: 'localhost' } }, localStorage: store, sessionStorage: store });

const image = (id: number, over: Record<string, unknown> = {}) => ({ type: 'photo', url: `https://api.test/images/${id}`, alt: `alt ${id}`, caption: null, width: 400, height: 300, licence: 'BY 2.0', source_url: null, creator: null, attribution: '', attribution_required: false, ...over }) as unknown as DeckImage;

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

const states = { '2': { has_image: true, can_add: false, can_replace: true, can_remove: false, can_restore: false, reason: null, kind: 'photo' } };
const result = { status_code: 1, slide: 2, node: null, action: 'replace', image: image(5), can_restore: true, state: { has_image: true, can_add: false, can_replace: true, can_remove: false, reason: null, kind: 'photo' } };

// ---------------------------------------------------------------------------------------------------------------------
// Whether the controls are shown at all

test('the loader reports what the editor answered, and why when it could not', async () => {
  const ok = stubFetch(() => answer(200, { status_code: 1, slide_images: states }));
  try {
    assert.deepEqual(await loadStoredImageStates(8592, 900), { ok: true, states });
    assert.match(ok.calls[0].url, /stored-image\/states\?/);
    assert.match(ok.calls[0].url, /chapter_id=8592/);
    assert.match(ok.calls[0].url, /content_id=900/);
    assert.equal((ok.calls[0].init?.headers as Record<string, string>).Authorization, 'Bearer tok');
  } finally {
    ok.restore();
  }
  const cases: [number, unknown, RegExp][] = [
    [404, { message: 'The route api/lms/course-presentation/stored-image/states could not be found.' }, /not available on this server yet/],
    [404, {}, /not available on this server yet/],
    [401, { message: 'JWT token is required.' }, /session has expired/],
    [403, { status_code: 0, message: 'You are not authorised to do this.' }, /cannot change pictures/],
    [403, { status_code: 0, message: 'You do not have permission to create this resource.', module: 'lms.content', action: 'create' }, /content "create" right.*Sign in as a teacher/],
    [403, { status_code: 0, message: 'Changing a picture in a stored presentation is available for the pilot chapter only.' }, /pilot chapter only/],
    [404, { status_code: 0, message: 'That presentation was not found.' }, /That presentation was not found/],
    [500, {}, /cannot be changed in this presentation right now|Request failed/],
  ];
  for (const [status, body, shown] of cases) {
    const f = stubFetch(() => answer(status, body));
    try {
      const r = await loadStoredImageStates(8592, 900);
      assert.equal(r.ok, false, `status ${status} is a failure, never an empty answer`);
      assert.match(r.ok ? '' : r.reason, shown);
    } finally {
      f.restore();
    }
  }
  const down = stubFetch(() => Promise.reject(new TypeError('offline')));
  try {
    const r = await loadStoredImageStates(8592, 900);
    assert.deepEqual([r.ok, r.ok ? 0 : r.status, r.ok ? '' : r.reason], [false, 0, 'The picture editor could not be reached. Check your connection and reload.']);
  } finally {
    down.restore();
  }
  assert.match(storedFailureReason(404, 'Not found.'), /not available on this server yet/);
});

test('when the editor cannot be used, every slide with a picture still gets a disabled control carrying the reason', () => {
  const deck = { slides: [{ n: 1, image: null }, { n: 2, image: image(2) }, { n: 5, image: image(5) }] };
  const out = unavailableStates(deck, 'Picture editing is not available on this server yet.');
  assert.deepEqual(Object.keys(out), ['2', '5'], 'a slide with no picture has nothing to change');
  for (const state of Object.values(out)) {
    assert.deepEqual([state.can_add, state.can_replace, state.can_remove, state.can_restore], [false, false, false, false]);
    assert.equal(state.reason, 'Picture editing is not available on this server yet.');
  }
});

const toolsSlide = (n: number) => ({
  n,
  image: image(n),
  interaction: { kind: 'reveal', items: [{ id: 'i1', label: 'The magnifying glass', text: 'a' }, { id: 'i2', label: 'The compass', text: 'b', image: image(77) }] },
});

test('when the editor cannot be used, the items of a slide get disabled controls too, so they are never silently missing', () => {
  const out = unavailableStates({ slides: [toolsSlide(2), { n: 3, image: image(3), interaction: null }] } as never, 'Picture editing is not available on this server yet.');

  assert.deepEqual(Object.keys(out['2'].items ?? {}), ['i1', 'i2']);
  assert.equal(out['2'].items?.i1.title, 'The magnifying glass');
  assert.equal(out['2'].items?.i1.has_image, false, 'the magnifying glass has no picture of its own');
  assert.equal(out['2'].items?.i2.has_image, true);
  for (const state of Object.values(out['2'].items ?? {})) {
    assert.deepEqual([state.can_add, state.can_replace, state.can_remove, state.can_restore], [false, false, false, false]);
    assert.equal(state.reason, 'Picture editing is not available on this server yet.');
  }
  assert.equal(out['3'].items, undefined, 'a slide with no items to open has no item controls');
});

test('a server that answers for slides only still gets a disabled, explained control on every item', () => {
  const answered = { '2': { has_image: true, can_add: false, can_replace: true, can_remove: false, can_restore: false, reason: null, kind: 'photo' as const }, '3': { has_image: true, can_add: false, can_replace: true, can_remove: false, can_restore: false, reason: null } };
  const deck = { slides: [toolsSlide(2), { n: 3, image: image(3), interaction: null }] } as never;

  const out = withItemFallbacks(answered, deck);

  assert.equal(out['2'].can_replace, true, 'the slide\'s own picture keeps what the server said');
  assert.equal(out['2'].items?.i1.reason, ITEM_PICTURES_UNSUPPORTED);
  assert.equal(out['2'].items?.i1.can_add || out['2'].items?.i1.can_replace, false);
  assert.equal(out['3'], answered['3'], 'a slide without items is the very same object');
  assert.equal(withItemFallbacks({ ...answered, '2': { ...answered['2'], items: { i1: { ...answered['2'], title: 'x' } } } }, deck)['2'].items?.i1.title, 'x', 'what the server said for items is never replaced');
  assert.equal(withItemFallbacks({}, deck)['2'], undefined, 'a slide the server named no state for is left alone');
});

test('the viewer is told apart from the session profile: students and parents get no editing UI', () => {
  const as = (menu: object, user: object) => {
    const data: Record<string, string> = { menuContext: JSON.stringify(menu), userData: JSON.stringify(user) };
    Object.assign(globalThis, { localStorage: { getItem: (k: string) => data[k] ?? null }, sessionStorage: { getItem: () => null } });

    return viewerKind();
  };
  assert.equal(as({ user_profile_name: 'Student' }, {}), 'student');
  assert.equal(as({}, { user_profile_name: 'Parent' }), 'student');
  assert.equal(as({ user_profile_name: 'Teacher' }, {}), 'staff');
  assert.equal(as({}, { user_profile: 'Admin' }), 'staff');
  assert.equal(as({ user_profile_name: 'Super Admin' }, {}), 'staff');
  assert.equal(as({}, {}), 'unknown', 'no profile: the control appears only when the server says it may be used');
  Object.assign(globalThis, { localStorage: store, sessionStorage: store });
});

// ---------------------------------------------------------------------------------------------------------------------
// The adapter's calls

test('search names the presentation and the slide, with the teacher\'s words when given', async () => {
  const f = stubFetch(() => answer(200, { status_code: 1, query: 'rain', candidates: [], note: null }));
  try {
    const adapter = createStoredImageAdapter(8592, 900);
    await adapter.search({ slide: 2 }, ' rain clouds ');
    assert.match(f.calls[0].url, /stored-image\/search\?/);
    assert.match(f.calls[0].url, /content_id=900/);
    assert.match(f.calls[0].url, /slide=2/);
    assert.match(f.calls[0].url, /q=rain\+clouds/);
    await adapter.search({ slide: 3 });
    assert.doesNotMatch(f.calls[1].url, /q=/, 'no words: the server uses the slide\'s own title and concept');
  } finally {
    f.restore();
  }
});

test('choosing a photograph sends its id only; restoring sends the slide only', async () => {
  const f = stubFetch(() => answer(200, result));
  try {
    const adapter = createStoredImageAdapter(8592, 900);
    await adapter.setFromCandidate({ slide: 2 }, 'abcdef0123456789');
    await adapter.restore({ slide: 2 });
    assert.match(f.calls[0].url, /stored-image\/replace$/);
    assert.deepEqual(Object.keys(JSON.parse(String(f.calls[0].init?.body))).sort(), ['candidate_id', 'chapter_id', 'content_id', 'slide'], 'an id the server gave out: never an address or a licence');
    assert.match(f.calls[1].url, /stored-image\/restore$/);
    assert.deepEqual(Object.keys(JSON.parse(String(f.calls[1].init?.body))).sort(), ['chapter_id', 'content_id', 'slide']);
  } finally {
    f.restore();
  }
});

test('every call for an item names the item as well as the slide, so one item\'s change cannot land on another', async () => {
  const f = stubFetch((url) => answer(200, url.includes('/search') ? { status_code: 1, query: 'compass', candidates: [], note: null } : { ...result, slide: 6, item: 'i2' }));
  try {
    const adapter = createStoredImageAdapter(8592, 900);
    await adapter.search({ slide: 6, item: 'i2' }, 'compass');
    await adapter.setFromCandidate({ slide: 6, item: 'i2' }, 'abcdef0123456789');
    await adapter.restore({ slide: 6, item: 'i2' });
    await adapter.setFromCandidate({ slide: 6 }, 'abcdef0123456789');

    assert.match(f.calls[0].url, /stored-image\/search\?/);
    assert.match(f.calls[0].url, /slide=6/);
    assert.match(f.calls[0].url, /item=i2/);
    assert.deepEqual(Object.keys(JSON.parse(String(f.calls[1].init?.body))).sort(), ['candidate_id', 'chapter_id', 'content_id', 'item', 'slide']);
    assert.equal(JSON.parse(String(f.calls[1].init?.body)).item, 'i2');
    assert.deepEqual(Object.keys(JSON.parse(String(f.calls[2].init?.body))).sort(), ['chapter_id', 'content_id', 'item', 'slide']);
    assert.deepEqual(Object.keys(JSON.parse(String(f.calls[3].init?.body))).sort(), ['candidate_id', 'chapter_id', 'content_id', 'slide'], 'the slide\'s own picture names no item');
  } finally {
    f.restore();
  }
});

test('an item\'s uploaded picture is sent with its item', async () => {
  // The upload reports progress, so it goes through XMLHttpRequest rather than fetch.
  const sent: { url: string; body: FormData }[] = [];
  class FakeXhr {
    upload: Record<string, unknown> = {};
    status = 200;
    responseText = JSON.stringify({ ...result, slide: 6, item: 'i1' });
    onload: () => void = () => {};
    private url = '';
    open(_method: string, url: string) {
      this.url = url;
    }
    setRequestHeader() {}
    addEventListener() {}
    send(body: FormData) {
      sent.push({ url: this.url, body });
      this.onload();
    }
  }
  const original = (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest;
  Object.assign(globalThis, { XMLHttpRequest: FakeXhr });
  try {
    const file = new File([new Uint8Array([137, 80, 78, 71])], 'compass.png', { type: 'image/png' });
    const res = await createStoredImageAdapter(8592, 900).setFromUpload({ slide: 6, item: 'i1' }, file, { credit: 'Ms Rao', alt: 'A compass' });

    assert.match(sent[0].url, /stored-image\/replace$/);
    assert.equal(sent[0].body.get('item'), 'i1');
    assert.equal(sent[0].body.get('slide'), '6');
    assert.equal(sent[0].body.get('content_id'), '900');
    assert.equal(sent[0].body.get('credit'), 'Ms Rao');
    assert.equal((res as { item?: string }).item, 'i1');
  } finally {
    Object.assign(globalThis, { XMLHttpRequest: original });
  }
});

test('a stored picture cannot be removed from here', async () => {
  await assert.rejects(() => createStoredImageAdapter(8592, 900).remove({ slide: 2 }), (e: unknown) => e instanceof CoursePresentationApiError && /cannot be taken away/.test(e.message));
});

test('a refusal is shown in the server\'s own words', async () => {
  for (const [status, message, shown] of [
    [403, 'Changing a picture in a stored presentation is available for the pilot chapter only.', /pilot chapter only/],
    [422, 'This picture cannot be used: licence "ARR" is not accepted.', /licence "ARR"/],
    [500, 'The change could not be saved, so nothing was changed. Your original picture is still in place.', /original picture is still in place/],
  ] as const) {
    const f = stubFetch(() => answer(status, { status_code: 0, message }));
    try {
      await assert.rejects(() => createStoredImageAdapter(8592, 900).setFromCandidate({ slide: 2 }, 'abcdef0123456789'), (e: unknown) => e instanceof CoursePresentationApiError && e.status === status && shown.test(e.message));
    } finally {
      f.restore();
    }
  }
});

// ---------------------------------------------------------------------------------------------------------------------
// What the teacher sees

const none: ImageEditorAdapter = {
  search: async () => ({ query: '', candidates: [], note: null }),
  setFromCandidate: async () => result as never,
  setFromUpload: async () => result as never,
  remove: async () => result as never,
  restore: async () => result as never,
};
const st = (over: Partial<ImageEditState> = {}): ImageEditState => ({ has_image: true, can_add: false, can_replace: true, can_remove: false, can_restore: false, reason: null, kind: 'photo', ...over });
const dialog = (state: ImageEditState, saved = true, current: DeckImage | null = image(2)) =>
  renderToStaticMarkup(createElement(ImageEditDialog, { adapter: none, target: { slide: 2 }, title: 'Slide 2: Rain', current, state, saved, onClose: () => {}, onChanged: () => {} }));

test('the window offers Save and Cancel, never Remove, and says a change is saved with the presentation', () => {
  const html = dialog(st());
  assert.match(html, />Save image</);
  assert.match(html, /data-testid="replace-image"[^>]*disabled/, 'nothing is chosen yet');
  assert.match(html, />Cancel</);
  assert.doesNotMatch(html, /data-testid="remove-image"/);
  assert.match(html, /Saving puts the new picture in this presentation straight away, and you can restore the original/);
  assert.doesNotMatch(dialog(st(), false), /straight away/, 'a draft is saved when it is approved, and does not say otherwise');
});

test('a slide that cannot be changed says why in the window itself, not only in a tooltip', () => {
  const why = "This slide's hotspots are placed on its picture, so the picture cannot be added, swapped or removed without moving them.";
  const html = dialog(st({ can_replace: false, reason: why }));
  assert.match(html, /data-testid="cannot-pick"/);
  assert.match(html, /hotspots are placed on its picture/);
  assert.doesNotMatch(html, /data-testid="replace-image"/, 'nothing can be saved');
  assert.match(html, />Cancel</);
});

test('a stand-in diagram is called what it is, so a photograph can replace it', () => {
  assert.match(dialog(st({ kind: 'diagram' })), /data-testid="current-is-diagram"[^>]*>This is a drawn diagram, not a photograph/);
  assert.doesNotMatch(dialog(st({ kind: 'photo' })), /current-is-diagram/);
});

test('Restore original is offered only once a picture has been changed', () => {
  assert.doesNotMatch(dialog(st()), /data-testid="restore-image"/);
  assert.match(dialog(st({ can_restore: true })), /data-testid="restore-image"/);
});

test('what was changed is said in the teacher\'s words, and a stored change is said to be saved', () => {
  assert.match(actionSentence({ action: 'replace', slide: 3, node: null }, true), /Slide 3: picture replaced\. The change is saved with this presentation\./);
  assert.match(actionSentence({ action: 'replace', slide: 3, node: null }), /saved when you approve it/);
  assert.match(actionSentence({ action: 'restore', slide: 3, node: null }, true), /the original is back\. The change is saved/);
});

// ---------------------------------------------------------------------------------------------------------------------
// The slide shows the new picture at once; nothing else moves

test('only the changed slide gets the new picture, and its state keeps what the server said it is now', () => {
  const slide = (n: number, img: DeckImage | null) => ({ n, title: `Slide ${n}`, image: img, workflow_stage: n, workflow_stage_name: `Stage ${n}`, outcome_refs: [`C${n}`], interaction: null });
  const deck = { slides: [slide(1, null), slide(2, image(2, { type: 'diagram' })), slide(3, image(3))] } as unknown as StudyDeck;

  const next = withEditedImage(deck, { slide: 2, node: null, image: image(9, { licence: 'BY-SA 4.0', creator: 'Bo Photo' }) });

  assert.equal(next.slides[1].image?.url, 'https://api.test/images/9');
  assert.equal(next.slides[1].image?.type, 'photo');
  assert.equal(next.slides[1].workflow_stage, 2, 'the workflow label is untouched');
  assert.deepEqual(next.slides[1].outcome_refs, ['C2']);
  assert.equal(next.slides[0], deck.slides[0], 'every other slide is the very same object');
  assert.equal(next.slides[2], deck.slides[2]);

  const after = withEditedState({ '2': st({ kind: 'diagram' }) }, { slide: 2, node: null, can_restore: true, state: { has_image: true, can_add: false, can_replace: true, can_remove: false, reason: null, kind: 'photo' } });
  assert.deepEqual([after['2'].kind, after['2'].can_restore], ['photo', true]);
});
