import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';

import { variableModelEngine, type VariableModelParams } from './engines';
import { validateLabConfig } from './validate';
import { VariableModelWorkspace } from '../../app/course-master/[courseId]/chapters/PrayogshalaWorkspaces';

/**
 * Maths-first visuals: the number line and the groups/array. For each, the picture's inputs, the
 * computed answer and the observation sentence all come from the same state, and these tests sweep
 * every control value to prove they never disagree.
 */

const addition: VariableModelParams = {
  controls: [
    { id: 'a', label: 'Start', min: -10, max: 10, step: 1, default: 3 },
    { id: 'b', label: 'Add', min: -10, max: 10, step: 1, default: -5 },
  ],
  derived: [{ id: 'sum', label: 'Result', formula: 'a+b', decimals: 0 }],
  visual: { kind: 'numberline', bind: { start: 'a', move: 'b', lo: '-20', hi: '20', caption: 'ignored by the number line' } },
  observations: [
    { when: 'b>=0', text: 'Start at {a}, move right {b}: you land on {sum}.' },
    { when: 'b<0', text: 'Start at {a}, move left: you land on {sum}.' },
  ],
};

const groupsOf: VariableModelParams = {
  controls: [
    { id: 'g', label: 'Groups', min: 0, max: 8, step: 1, default: 3 },
    { id: 's', label: 'In each group', min: 0, max: 9, step: 1, default: 4 },
    { id: 'neg', label: 'Negative groups', kind: 'toggle', min: 0, max: 1, step: 1, default: 1 },
  ],
  derived: [
    { id: 'total', label: 'Product', formula: 'g*s*(1-2*neg)', decimals: 0 },
  ],
  visual: { kind: 'array', bind: { groups: 'g', size: 's', sign: '1-2*neg', extra: '0' } },
  observations: [
    { when: 'neg==1', text: '{g} groups of -{s} make {total}.' },
    { when: 'neg==0', text: '{g} groups of {s} make {total}.' },
  ],
};

test('number line: the marker lands exactly where the computed sum says, for every start and step', () => {
  for (let a = -10; a <= 10; a++) {
    for (let b = -10; b <= 10; b++) {
      const r = variableModelEngine.evaluate(addition, { values: { a, b } });
      assert.equal(r.visual?.kind, 'numberline');
      assert.equal(r.visual!.values.start + r.visual!.values.move, r.facts.sum, `${a} + ${b}`);
      assert.match(r.observation, new RegExp(`you land on ${String(a + b).replace('-', '\-')}\.$`), `${a} + ${b}`);
    }
  }
});

test('groups: the dots drawn are groups x size, the sign colours them, and the total matches the sentence', () => {
  for (let g = 0; g <= 8; g++) {
    for (let s = 0; s <= 9; s++) {
      for (const neg of [0, 1]) {
        const r = variableModelEngine.evaluate(groupsOf, { values: { g, s, neg } });
        assert.equal(r.visual!.values.groups, g);
        assert.equal(r.visual!.values.size, s);
        assert.equal(r.visual!.values.sign, neg ? -1 : 1);
        assert.equal(r.facts.total, g * s * (neg ? -1 : 1) || 0, 'zero is never negative');
        assert.ok(r.observation.includes(`make ${r.facts.total}.`), r.observation);
      }
    }
  }
});

test('an array lab and a number line lab pass the same checks as any other lab', () => {
  const steps = {
    mission: { scenario: 's', task: 't' },
    predict: { question: 'q', scenario: { a: 3, b: -5 }, options: [{ id: 'x', label: 'neg', when: 'sum<0' }, { id: 'y', label: 'pos', when: 'sum>=0' }] },
    do: { instructions: ['go'] },
    observe: { prompt: 'look' },
    explain: { text: 'e', cases: [{ when: 'sum<0', text: 'below zero' }] },
    concept: { text: 'c' },
    apply: { question: 'a', options: [{ id: 'p', label: 'p', correct: true }, { id: 'q', label: 'q', correct: false }] },
    reflect: { prompts: ['r'] },
  };
  assert.deepEqual(validateLabConfig({ version: 1, simulation: { type: 'variable_model', params: addition }, steps }), []);
});

const ssr = (params: VariableModelParams, values: Record<string, number>) => {
  const state = { values };
  const result = variableModelEngine.evaluate(params, state);

  return renderToString(React.createElement(VariableModelWorkspace as never, { params, state, setState() {}, result } as never));
};

test('the number line renders an accurate description and respects reduced motion', () => {
  const html = ssr(addition, { a: 3, b: -5 });
  assert.match(html, /Number line from -20 to 20/);
  assert.match(html, /starts at 3 and moves left 5 to -2/);
  assert.match(html, /prefers-reduced-motion: reduce/);
  // A move past the end of the line is clamped and said so, instead of drawing off the page.
  assert.match(ssr(addition, { a: 10, b: 10 }), /starts at 10 and moves right 10 to 20/);
});

test('the groups visual states its own total and colours negative groups differently', () => {
  const neg = ssr(groupsOf, { g: 3, s: 4, neg: 1 });
  const pos = ssr(groupsOf, { g: 3, s: 4, neg: 0 });
  assert.match(neg, /3 groups of 4, negative: total -12/);
  assert.match(pos, /3 groups of 4, positive: total 12/);
  assert.equal((neg.match(/<circle/g) ?? []).length, 12);
  assert.ok(neg.includes('#ef4444') && !pos.includes('#ef4444'));
  assert.match(ssr(groupsOf, { g: 0, s: 5, neg: 0 }), /0 groups of 5/);
});

test('the controls are real, keyboard-operable inputs', () => {
  const html = ssr(groupsOf, { g: 3, s: 4, neg: 1 });
  assert.equal((html.match(/type="range"/g) ?? []).length, 2);
  assert.match(html, /role="switch"/);
});

test('zero is never shown with a minus sign', () => {
  const r = variableModelEngine.evaluate(groupsOf, { values: { g: 0, s: 4, neg: 1 } });
  assert.equal(r.observation, '0 groups of -4 make 0.');
  assert.equal(r.outputs[0].text, '0');
  const tiny: VariableModelParams = {
    controls: [{ id: 'x', label: 'x', min: -1, max: 1, step: 0.001, default: -0.001 }],
    derived: [{ id: 'y', label: 'y', formula: 'x*1', decimals: 0 }],
    visual: { kind: 'bars', bind: { bars: [{ label: 'y', value: 'y', max: 1 }] } },
    observations: [{ when: 'x<=1', text: 'y is {y}.' }],
  };
  assert.equal(variableModelEngine.evaluate(tiny, { values: { x: -0.001 } }).observation, 'y is 0.');
});
