import assert from 'node:assert/strict';
import test from 'node:test';

import type { CpPreflight } from './api';
import { resolveSelectedContent } from './contentRoute';

test('resolveSelectedContent returns null when pedagogy, format or preflight is missing', () => {
  assert.equal(resolveSelectedContent(8592, null, 'interactive_slides', null), null);
  assert.equal(resolveSelectedContent(8592, 'explicit_instruction', null, null), null);
  assert.equal(resolveSelectedContent(8592, 'explicit_instruction', 'interactive_slides', null), null);
});

test('resolveSelectedContent resolves branching scenario stored resource', () => {
  const preflight = {
    existing_resources: [
      {
        type: 'Story lesson',
        format: 'branching_scenario',
        method: 'explicit_instruction',
        title: 'Exploration Story Lesson',
        ref: 61549,
        status: 'published',
      },
    ],
    fit: {
      template: {
        available: false,
        kind: 'story_template',
        requirements: [],
        blocked_by: [],
      },
    },
  } as unknown as CpPreflight;

  const resolved = resolveSelectedContent(8592, 'explicit_instruction', 'branching_scenario', preflight);
  assert.ok(resolved !== null);
  assert.equal(resolved.url, '/student/study-deck/8592?content=61549');
  assert.equal(resolved.label, 'Open Branching Scenario');
  assert.equal(resolved.kind, 'stored_story');
});

test('resolveSelectedContent resolves interactive slides template preview when available', () => {
  const preflight = {
    existing_resources: [],
    fit: {
      template: {
        available: true,
        kind: 'study_deck_preview',
        requirements: [],
        blocked_by: [],
      },
    },
  } as unknown as CpPreflight;

  const resolved = resolveSelectedContent(8592, 'explicit_instruction', 'interactive_slides', preflight);
  assert.ok(resolved !== null);
  assert.equal(resolved.url, '/student/study-deck/8592?source=preview&pedagogy=explicit_instruction&format=interactive_slides');
  assert.equal(resolved.label, 'Open PowerPoint');
  assert.equal(resolved.kind, 'template_preview');
});

const stored = (method: string | null, format: string, ref: number) =>
  ({ type: 'Classroom presentation', format, method, title: `t${ref}`, ref, status: 'published' });
const noTemplate = { available: false, kind: null, requirements: [], blocked_by: [] };

test('a stored item opens only for its own teaching method and format', () => {
  const preflight = {
    existing_resources: [
      stored('inquiry_based', 'interactive_slides', 11),
      stored('explicit_instruction', 'interactive_slides', 12),
      stored('inquiry_based', 'branching_scenario', 13),
    ],
    fit: { template: noTemplate },
  } as unknown as CpPreflight;

  assert.equal(resolveSelectedContent(41675, 'inquiry_based', 'interactive_slides', preflight)?.url, '/student/study-deck/41675?content=11');
  assert.equal(resolveSelectedContent(41675, 'explicit_instruction', 'interactive_slides', preflight)?.url, '/student/study-deck/41675?content=12');
  assert.equal(resolveSelectedContent(41675, 'inquiry_based', 'branching_scenario', preflight)?.url, '/student/study-deck/41675?content=13');
});

test('a combination with nothing stored falls back to nothing, never to another method or format', () => {
  const preflight = {
    existing_resources: [stored('inquiry_based', 'interactive_slides', 11)],
    fit: { template: noTemplate },
  } as unknown as CpPreflight;

  assert.equal(resolveSelectedContent(41675, 'problem_based', 'interactive_slides', preflight), null, 'other method');
  assert.equal(resolveSelectedContent(41675, 'inquiry_based', 'branching_scenario', preflight), null, 'other format');
});

test('an item stored without a teaching method (the original presentation) is not opened under any method', () => {
  const preflight = {
    existing_resources: [stored(null, 'interactive_slides', 9)],
    fit: { template: noTemplate },
  } as unknown as CpPreflight;

  assert.equal(resolveSelectedContent(41675, 'inquiry_based', 'interactive_slides', preflight), null);
});

test('resolveSelectedContent returns null for format without content or template', () => {
  const preflight = {
    existing_resources: [],
    fit: {
      template: {
        available: false,
        kind: null,
        requirements: ['Video generator needed'],
        blocked_by: [],
      },
    },
  } as unknown as CpPreflight;

  const resolved = resolveSelectedContent(8592, 'explicit_instruction', 'video_lesson', preflight);
  assert.equal(resolved, null, 'formats without content return null so create/generate state is shown');
});
