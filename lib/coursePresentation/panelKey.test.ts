import assert from 'node:assert/strict';
import test from 'node:test';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { GenerationPanel } from '../../components/coursePresentation/GenerationPanel';
import type { CpFit, CpRun } from './api';
import { panelKey } from './panelKey';

const OLD_RUN = 'r4e06dfcb0625';
const NEW_RUN = 'r2e8122b2ee27';
const REQUEST = '8592:experiential:branching_scenario';

test('the panel key changes when the server names a different run, so the panel mounts again with it', () => {
  assert.notEqual(panelKey(REQUEST, { run: OLD_RUN }), panelKey(REQUEST, { run: NEW_RUN }));
  assert.equal(panelKey(REQUEST, { run: NEW_RUN }), `${REQUEST}:${NEW_RUN}`);
});

test('the panel key is stable for the same run, so a run started inside the panel is not thrown away', () => {
  // Generating inside the panel does not change the pre-flight answer, so the key it was mounted with stays the same.
  assert.equal(panelKey(REQUEST, { run: OLD_RUN }), panelKey(REQUEST, { run: OLD_RUN }));
  assert.equal(panelKey(REQUEST, null), panelKey(REQUEST, undefined));
  assert.equal(panelKey(REQUEST, null), `${REQUEST}:none`);
});

test('a different pair of choices is a different key even with no run', () => {
  assert.notEqual(panelKey('8592:experiential:branching_scenario', null), panelKey('8592:inquiry_based:branching_scenario', null));
});

const run = (id: string): CpRun =>
  ({ run: id, state: 'ready', method: 'experiential', format: 'branching_scenario', created_at: '2026-10-21T11:17:50+05:30', progress: [], error: null, report: null, outline: null, images: null, stored: null }) as unknown as CpRun;

const render = (initialRun: CpRun | null) =>
  renderToStaticMarkup(
    createElement(GenerationPanel, {
      chapterId: 8592,
      pedagogy: 'experiential',
      format: 'branching_scenario',
      fit: { viewer_type: 'study_deck' } as unknown as CpFit,
      initialRun,
      onOpenPresentation: () => {},
    }),
  );

test('a panel mounted with the new run shows and acts on the new run, not the old one', () => {
  const stale = render(run(OLD_RUN));
  const fresh = render(run(NEW_RUN));
  assert.ok(stale.includes(OLD_RUN) && !stale.includes(NEW_RUN), 'mounted with the old run it names the old run');
  assert.ok(fresh.includes(NEW_RUN) && !fresh.includes(OLD_RUN), 'mounted with the new run it names only the new run');
});
