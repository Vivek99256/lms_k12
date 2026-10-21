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
