import assert from 'node:assert/strict';
import test from 'node:test';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { ImageEditButton, ImageEditingProvider, ItemPictureBar, ItemPictureHint, SceneImageButton } from '../../components/study-deck/ImageEditing';
import { actionSentence, canEdit, itemOpenLabel, openLabel, pictureItemsOf, stateFor, withEditedImage, withEditedState, type ImageEditState, type ImageEditStates } from './imageEditing';
import type { DeckImage, StudyDeck } from './types';

const img = (id: number) => ({ type: 'photo', url: `https://api.test/images/${id}`, alt: `alt ${id}`, caption: null, width: 400, height: 300, licence: 'BY 2.0', source_url: null, creator: null, attribution: '', attribution_required: false }) as unknown as DeckImage;

const state = (over: Partial<ImageEditState> = {}): ImageEditState => ({ has_image: true, can_add: false, can_replace: true, can_remove: true, can_restore: false, reason: null, ...over });

const nodes = [
  { id: 'a1/s1', kind: 'scene', title: 'The stream', prompt: '', choices: [{ id: 'c1', label: 'Go on', next: 'a1/d1' }], image: img(1) },
  { id: 'a1/d1', kind: 'decision', title: 'The fork', prompt: 'Which way?', choices: [{ id: 'c2', label: 'Left', next: null }] },
];
const deck = (): StudyDeck =>
  ({
    chapter: { id: 8592, name: 'Water' },
    concepts: {},
    slides: [
      { n: 1, title: 'Cover', image: null, interaction: null },
      { n: 2, title: 'Text slide', image: img(2), interaction: { kind: 'reveal', items: [] }, content: { body: 'text' } },
      { n: 3, title: 'Story', image: null, interaction: { kind: 'scenario', template: 'story_branching_scenario', start: 'a1/s1', nodes } },
      { n: 6, title: 'The tools of an explorer', image: img(60), interaction: { kind: 'reveal', reason: '', intro: '', wrapup: '', items: tools() } },
    ],
  }) as unknown as StudyDeck;

// Two tools with no picture of their own and one with one: the slide's picture is the diagram all three share.
function tools() {
  return [
    { id: 'i1', label: 'The magnifying glass', text: 'Careful observation.' },
    { id: 'i2', label: 'The compass', text: 'Purposeful direction.' },
    { id: 'i3', label: 'The map', text: 'Where you are going.', image: img(63) },
  ];
}

const states = (): ImageEditStates => ({
  '1': state({ has_image: false, can_add: true, can_replace: false, can_remove: false }),
  '2': state(),
  '3': state({ has_image: false, can_add: false, can_replace: false, can_remove: false, reason: 'The pictures of a story slide belong to its scenes.', nodes: { 'a1/s1': state({ title: 'The stream' }), 'a1/d1': state({ has_image: false, can_add: true, can_replace: false, can_remove: false }) } }),
  '6': state({
    items: {
      i1: state({ has_image: false, can_add: true, can_replace: false, can_remove: false, kind: 'none', title: 'The magnifying glass' }),
      i2: state({ has_image: false, can_add: true, can_replace: false, can_remove: false, kind: 'none', title: 'The compass' }),
      i3: state({ can_remove: false, can_restore: true, title: 'The map' }),
    },
  }),
});

// ---------------------------------------------------------------------------------------------------------------------
// States and wording

test('the state of a picture is found for a slide or for one scene of a story slide', () => {
  const s = states();
  assert.equal(stateFor(s, { slide: 2 })?.can_replace, true);
  assert.equal(stateFor(s, { slide: 3, node: 'a1/d1' })?.can_add, true);
  assert.equal(stateFor(s, { slide: 3, node: 'nope' }), null);
  assert.equal(stateFor(s, { slide: 99 }), null);
});

test('the control says what it will do', () => {
  assert.equal(openLabel(state({ has_image: false, can_add: true }), false), 'Add image');
  assert.equal(openLabel(state(), false), 'Change image');
  assert.equal(openLabel(state({ has_image: false, can_add: true }), true), 'Add scene picture');
  assert.equal(openLabel(state(), true), 'Change scene picture');
  assert.equal(canEdit(state()), true);
  assert.equal(canEdit(state({ can_replace: false, can_remove: false, can_restore: true })), true, 'only a restore is left');
  assert.equal(canEdit(state({ can_replace: false, can_remove: false, reason: 'pins' })), false);
  assert.equal(canEdit(null), false);
});

test('what was done is said plainly', () => {
  assert.match(actionSentence({ action: 'add', slide: 5, node: null }), /Slide 5: picture added/);
  assert.match(actionSentence({ action: 'remove', slide: 5, node: null }), /removed.*restore the original/);
  assert.match(actionSentence({ action: 'replace', slide: 3, node: 'a1/s1' }), /Slide 3, scene a1\/s1: picture replaced/);
  assert.match(actionSentence({ action: 'restore', slide: 2, node: null }), /original is back/);
});

// ---------------------------------------------------------------------------------------------------------------------
// Changing exactly one picture

test('adding, replacing or removing a slide picture changes that slide only', () => {
  const before = deck();
  const fresh = img(9);

  const added = withEditedImage(before, { slide: 1, node: null, image: fresh });
  assert.equal(added.slides[0].image, fresh);
  assert.equal(added.slides[1], before.slides[1]);
  assert.equal(added.slides[2], before.slides[2]);

  const removed = withEditedImage(before, { slide: 2, node: null, image: null });
  assert.equal(removed.slides[1].image, null);
  assert.deepEqual({ ...removed.slides[1], image: 0 }, { ...before.slides[1], image: 0 }, 'text and activity of the slide are untouched');
  assert.equal(before.slides[1].image?.url, 'https://api.test/images/2', 'the old deck is not modified');
});

test('changing one scene of a story leaves the story, the choices and the other scenes as they were', () => {
  const before = deck();
  const after = withEditedImage(before, { slide: 3, node: 'a1/s1', image: img(7) });

  const was = before.slides[2].interaction as unknown as { nodes: typeof nodes; start: string };
  const now = after.slides[2].interaction as unknown as { nodes: typeof nodes; start: string };
  assert.equal(now.nodes[0].image?.url, 'https://api.test/images/7');
  assert.equal(now.nodes[1], was.nodes[1], 'another scene is the very same object');
  assert.deepEqual({ ...now.nodes[0], image: 0 }, { ...was.nodes[0], image: 0 }, 'the scene\'s text, choices and links are untouched');
  assert.equal(now.start, was.start);
  assert.equal(after.slides[0], before.slides[0]);
  assert.equal(after.slides[1], before.slides[1]);

  const gaveOne = withEditedImage(before, { slide: 3, node: 'a1/d1', image: img(8) });
  assert.equal((gaveOne.slides[2].interaction as unknown as { nodes: typeof nodes }).nodes[1].image?.url, 'https://api.test/images/8', 'a scene with no picture can be given one');
  assert.equal(withEditedImage(before, { slide: 3, node: 'missing', image: img(8) }).slides[2].interaction && (withEditedImage(before, { slide: 3, node: 'missing', image: img(8) }).slides[2].interaction as unknown as { nodes: typeof nodes }).nodes.every((n) => n.image?.url !== 'https://api.test/images/8'), true, 'an unknown scene changes nothing');
});

test('after a change only that picture\'s state is replaced', () => {
  const before = states();
  const after = withEditedState(before, { slide: 1, node: null, can_restore: true, state: { has_image: true, can_add: false, can_replace: true, can_remove: true, reason: null } });
  assert.equal(after['1'].has_image, true);
  assert.equal(after['1'].can_restore, true);
  assert.equal(after['2'], before['2']);
  assert.equal(after['3'], before['3']);

  const scene = withEditedState(before, { slide: 3, node: 'a1/d1', can_restore: true, state: { has_image: true, can_add: false, can_replace: true, can_remove: true, reason: null } });
  assert.equal(scene['3'].nodes?.['a1/d1'].has_image, true);
  assert.equal(scene['3'].nodes?.['a1/s1'], before['3'].nodes?.['a1/s1']);
  assert.equal(scene['3'].nodes?.['a1/d1'].title, undefined);
});

// ---------------------------------------------------------------------------------------------------------------------
// The controls: shown only where editing is offered, and never in the way

const inEditor = (node: ReturnType<typeof createElement>, slide = 2) => renderToStaticMarkup(createElement(ImageEditingProvider, { value: { states: states(), slide, edit: () => {} } }, node));

test('a lesson that is only played draws no editing control at all', () => {
  assert.equal(renderToStaticMarkup(createElement(ImageEditButton, { target: { slide: 2 } })), '');
  assert.equal(renderToStaticMarkup(createElement(SceneImageButton, { node: 'a1/s1' })), '');
});

test('a slide with a picture offers Change image, and one without offers Add image', () => {
  assert.match(inEditor(createElement(ImageEditButton, { target: { slide: 2 } })), /aria-label="Change image"/);
  assert.match(inEditor(createElement(ImageEditButton, { target: { slide: 1 } })), /aria-label="Add image"/);
});

test('a picture that cannot be changed safely is shown unavailable (still focusable) with its reason; a story slide has no slide-level control', () => {
  const locked: ImageEditStates = { ...states(), '4': state({ can_replace: false, can_remove: false, reason: 'This slide\'s hotspots are placed on its picture.' }) };
  const html = renderToStaticMarkup(createElement(ImageEditingProvider, { value: { states: locked, slide: 4, edit: () => {} } }, createElement(ImageEditButton, { target: { slide: 4 } })));
  assert.match(html, /aria-disabled="true"/);
  assert.doesNotMatch(html, / disabled(=|>| )/, 'not natively disabled: it stays focusable and still opens the window that prints the reason');
  assert.match(html, /title="This slide&#x27;s hotspots are placed on its picture\."/);
  assert.equal(inEditor(createElement(ImageEditButton, { target: { slide: 3 } }), 3), '', 'a story slide\'s pictures are edited scene by scene');
});

test('a story scene has its own control that knows its slide', () => {
  const html = inEditor(createElement(SceneImageButton, { node: 'a1/d1' }), 3);
  assert.match(html, /data-testid="change-scene-image"/);
  assert.match(html, /aria-label="Add scene picture"/, 'the decision has no picture yet');
  assert.match(inEditor(createElement(SceneImageButton, { node: 'a1/s1' }), 3), /aria-label="Change scene picture"/);
  assert.equal(inEditor(createElement(SceneImageButton, { node: 'unknown' }), 3), '');
});

// ---------------------------------------------------------------------------------------------------------------------
// The pictures of a slide's items (the magnifying glass, the compass)

type Items = { items: Array<{ id: string; image?: DeckImage | null; label: string; text: string }> };
const itemsOf6 = (d: StudyDeck) => (d.slides[3].interaction as unknown as Items).items;

test('an item\'s state is found by its slide and its own id', () => {
  const s = states();
  assert.equal(stateFor(s, { slide: 6, item: 'i1' })?.can_add, true);
  assert.equal(stateFor(s, { slide: 6, item: 'i3' })?.can_restore, true);
  assert.equal(stateFor(s, { slide: 6, item: 'nope' }), null);
  assert.equal(stateFor(s, { slide: 2, item: 'i1' }), null, 'a slide with no item pictures has none to find');
  assert.equal(stateFor(s, { slide: 6 })?.can_replace, true, 'the slide\'s own picture is still its own target');
});

test('only a slide with a picture and items opened beside it carries item pictures', () => {
  const d = deck();
  assert.deepEqual(pictureItemsOf(d.slides[3])?.map((i) => i.id), ['i1', 'i2', 'i3']);
  assert.equal(pictureItemsOf(d.slides[1]), null, 'a reveal with no items');
  assert.equal(pictureItemsOf(d.slides[2]), null, 'a story keeps its pictures on its scenes');
  assert.equal(pictureItemsOf(d.slides[0]), null);
  assert.equal(pictureItemsOf({ ...d.slides[3], image: null }), null, 'no slide picture, no picture area to show an item\'s');
  assert.equal(pictureItemsOf({ image: img(1), interaction: { kind: 'hotspots', spots: [{ id: 'h1' }] } } as unknown as StudyDeck['slides'][number]), null, 'hotspots are placed on one picture');
  assert.equal(pictureItemsOf({ image: img(1), interaction: { kind: 'order', items: [{ id: 'a', text: 'x' }] } } as unknown as StudyDeck['slides'][number]), null);
});

test('an item\'s control and notice name the item', () => {
  assert.equal(itemOpenLabel(state({ has_image: false, can_add: true }), 'The compass'), 'Add image for The compass');
  assert.equal(itemOpenLabel(state(), 'The map'), 'Change image for The map');
  assert.match(actionSentence({ action: 'replace', slide: 6, node: null, item: 'i2' }, true, 'The compass'), /^Slide 6, “The compass”: picture replaced\. The change is saved with this presentation\.$/);
  assert.match(actionSentence({ action: 'restore', slide: 6, node: null, item: 'i2' }, true, 'The compass'), /“The compass”: the original is back/);
  assert.match(actionSentence({ action: 'add', slide: 6, node: null, item: 'i2' }), /Slide 6, “i2”: picture added/, 'without a label the id is all there is');
});

test('changing one item\'s picture changes that item only: not its sibling, not the slide, not the text', () => {
  const before = deck();
  const glass = img(31);

  const after = withEditedImage(before, { slide: 6, node: null, item: 'i1', image: glass });

  const was = itemsOf6(before);
  const now = itemsOf6(after);
  assert.equal(now[0].image, glass);
  assert.equal(now[1], was[1], 'the compass is the very same object: it was not given the magnifying glass\'s picture');
  assert.equal(now[2], was[2]);
  assert.deepEqual({ ...now[0], image: 0 }, { ...was[0], image: 0 }, 'the item\'s label and explanation are untouched');
  assert.equal(after.slides[3].image, before.slides[3].image, 'the slide\'s own picture is untouched');
  for (const i of [0, 1, 2]) assert.equal(after.slides[i], before.slides[i], 'every other slide is the very same object');
  assert.equal(itemsOf6(before)[0].image, undefined, 'the old deck is not modified');
});

test('two items keep two pictures, and giving one a picture back to none leaves the other alone', () => {
  let d = deck();
  d = withEditedImage(d, { slide: 6, node: null, item: 'i1', image: img(31) });
  d = withEditedImage(d, { slide: 6, node: null, item: 'i2', image: img(32) });
  assert.deepEqual(itemsOf6(d).map((i) => i.image?.url), ['https://api.test/images/31', 'https://api.test/images/32', 'https://api.test/images/63']);

  const restored = withEditedImage(d, { slide: 6, node: null, item: 'i1', image: null });
  assert.equal(itemsOf6(restored)[0].image, null, 'back to how it began: no picture of its own');
  assert.equal(itemsOf6(restored)[1], itemsOf6(d)[1]);
  assert.equal(withEditedImage(d, { slide: 6, node: null, item: 'missing', image: img(9) }).slides[3].interaction && itemsOf6(withEditedImage(d, { slide: 6, node: null, item: 'missing', image: img(9) })).every((i) => i.image?.url !== 'https://api.test/images/9'), true, 'an unknown item changes nothing');
  assert.equal(withEditedImage(d, { slide: 2, node: null, item: 'i1', image: img(9) }).slides[1], d.slides[1], 'nor does an item of a slide that has none');
});

test('after a change only that item\'s state is replaced', () => {
  const before = states();
  const result = { slide: 6, node: null, item: 'i1', can_restore: true, state: { has_image: true, can_add: false, can_replace: true, can_remove: false, reason: null, kind: 'photo' as const } };

  const after = withEditedState(before, result);

  assert.deepEqual([after['6'].items?.i1.has_image, after['6'].items?.i1.can_restore, after['6'].items?.i1.title], [true, true, 'The magnifying glass']);
  assert.equal(after['6'].items?.i2, before['6'].items?.i2);
  assert.equal(after['6'].items?.i3, before['6'].items?.i3);
  assert.equal(after['6'].can_restore, before['6'].can_restore, 'the slide\'s own picture state is not the item\'s');
  assert.equal(after['2'], before['2']);
  assert.equal(withEditedState(before, { ...result, item: 'nope' }), before);
});

test('the open item has a control that knows its slide, and a notice that says which picture is shown', () => {
  const bar = (item: string, hasOwn: boolean, name: string) => inEditor(createElement(ItemPictureBar, { item, name, hasOwn }), 6);

  const glass = bar('i1', false, 'The magnifying glass');
  assert.match(glass, /data-testid="item-picture-bar"/);
  assert.match(glass, /data-testid="change-item-image"/);
  assert.match(glass, /aria-label="Add image for The magnifying glass"/, 'distinct from the slide\'s own "Change image"');
  assert.match(glass, />Add image</);
  assert.match(glass, /The magnifying glass has no picture of its own yet, so the slide’s picture is shown\./);

  const map = bar('i3', true, 'The map');
  assert.match(map, /aria-label="Change image for The map"/);
  assert.match(map, /Picture for The map\./);
  assert.doesNotMatch(map, /no picture of its own/);

  assert.equal(bar('unknown', false, 'x'), '', 'an item the server named no state for draws nothing');
  assert.equal(renderToStaticMarkup(createElement(ItemPictureBar, { item: 'i1', name: 'x', hasOwn: false })), '', 'a lesson that is only played is unchanged');
});

test('while no card is open an author is told every card can have its own picture, so the option is never invisible', () => {
  const hint = inEditor(createElement(ItemPictureHint), 6);
  assert.match(hint, /data-testid="item-picture-hint"/);
  assert.match(hint, /Select a card to add or change its own picture\./);
  assert.doesNotMatch(hint, /<button/, 'the control belongs to the open card; the hint has none of its own');
  assert.match(inEditor(createElement(ItemPictureHint, { overlay: true }), 6), /class="absolute left-\[0\.4em\] top-\[0\.4em\]/, 'on a narrow screen it is a small pill on the picture');
  assert.equal(inEditor(createElement(ItemPictureHint), 2), '', 'a slide the server named no item pictures for says nothing');
  assert.equal(renderToStaticMarkup(createElement(ItemPictureHint)), '', 'a lesson that is only played is unchanged');
});

test('on a narrow screen the control is laid over the picture and takes no strip of its own; a reason is still said in words', () => {
  const over = inEditor(createElement(ItemPictureBar, { item: 'i2', name: 'The compass', hasOwn: false, overlay: true }), 6);
  assert.match(over, /data-testid="item-picture-bar" class="absolute z-10 left-\[0\.4em\] top-\[0\.4em\]"/);
  assert.match(over, /aria-label="Add image for The compass"/);
  assert.match(over, /<p data-testid="item-picture-note" class="sr-only">The compass has no picture of its own yet/, 'the note stays for screen readers, out of sight');

  const why = 'This server cannot change the pictures of individual items yet.';
  const locked: ImageEditStates = { '6': state({ items: { i2: state({ has_image: false, can_add: false, can_replace: false, can_remove: false, reason: why }) } }) };
  const html = renderToStaticMarkup(createElement(ImageEditingProvider, { value: { states: locked, slide: 6, edit: () => {} } }, createElement(ItemPictureBar, { item: 'i2', name: 'The compass', hasOwn: false, overlay: true })));
  assert.match(html, /<p data-testid="item-picture-note" class="min-w-0 flex-1">This server cannot change/, 'an unavailable control says why on the screen');
  assert.doesNotMatch(html, /sr-only/);
});

test('an item that cannot be changed shows its control disabled, with the reason in words, and stays focusable', () => {
  const why = 'This server cannot change the pictures of individual items yet.';
  const locked: ImageEditStates = { '6': state({ items: { i1: state({ has_image: false, can_add: false, can_replace: false, can_remove: false, reason: why }) } }) };
  const html = renderToStaticMarkup(createElement(ImageEditingProvider, { value: { states: locked, slide: 6, edit: () => {} } }, createElement(ItemPictureBar, { item: 'i1', name: 'The compass', hasOwn: false })));

  assert.match(html, /aria-disabled="true"/);
  assert.doesNotMatch(html, / disabled(=|>| )/, 'not natively disabled');
  assert.match(html, /data-testid="item-picture-note"[^>]*>This server cannot change the pictures of individual items yet\./, 'the reason is on the screen, not only in a tooltip');
});
