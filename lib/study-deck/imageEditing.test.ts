import assert from 'node:assert/strict';
import test from 'node:test';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { ImageEditButton, ImageEditingProvider, SceneImageButton } from '../../components/study-deck/ImageEditing';
import { actionSentence, canEdit, openLabel, stateFor, withEditedImage, withEditedState, type ImageEditState, type ImageEditStates } from './imageEditing';
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
    ],
  }) as unknown as StudyDeck;

const states = (): ImageEditStates => ({
  '1': state({ has_image: false, can_add: true, can_replace: false, can_remove: false }),
  '2': state(),
  '3': state({ has_image: false, can_add: false, can_replace: false, can_remove: false, reason: 'The pictures of a story slide belong to its scenes.', nodes: { 'a1/s1': state({ title: 'The stream' }), 'a1/d1': state({ has_image: false, can_add: true, can_replace: false, can_remove: false }) } }),
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

test('a picture that cannot be changed safely is shown disabled with its reason; a story slide has no slide-level control', () => {
  const locked: ImageEditStates = { ...states(), '4': state({ can_replace: false, can_remove: false, reason: 'This slide\'s hotspots are placed on its picture.' }) };
  const html = renderToStaticMarkup(createElement(ImageEditingProvider, { value: { states: locked, slide: 4, edit: () => {} } }, createElement(ImageEditButton, { target: { slide: 4 } })));
  assert.match(html, /disabled/);
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
