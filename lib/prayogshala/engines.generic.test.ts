import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyEngine,
  correctPredictionIds,
  getEngine,
  pickExplanation,
  scramble,
  sequenceEngine,
  variableModelEngine,
  type ClassifyParams,
  type LabConfig,
  type SequenceParams,
  type VariableModelParams,
} from './engines';
import { validateLabConfig } from './validate';

/**
 * The topic-agnostic engines: a variable model that drives an animated visual, ordering, and
 * classifying. Nothing here names a chapter - these are the shapes the backend generator emits.
 */

const heating: VariableModelParams = {
  controls: [{ id: 'heat', label: 'Heat', unit: '%', kind: 'slider', min: 0, max: 100, step: 5, default: 0 }],
  derived: [{ id: 'temp', label: 'Temperature', unit: 'C', formula: '25+heat*0.8', decimals: 0 }],
  visual: { kind: 'heating', bind: { temperature: 'temp', heat: 'heat/100', boiling_point: '100' } },
  observations: [
    { when: 'temp>=100', text: 'Boiling at {temp} C.' },
    { when: 'temp<100', text: 'At {temp} C, not boiling.' },
  ],
  warnings: [{ when: 'heat==100', text: 'Maximum heat.' }],
};

function lab(simulation: LabConfig['simulation'], overrides: Partial<LabConfig['steps']> = {}): LabConfig {
  return {
    version: 1,
    simulation,
    steps: {
      mission: { scenario: 's', task: 't' },
      predict: { question: 'q', scenario: { heat: 100 }, options: [{ id: 'a', label: 'boils', when: 'temp>=100' }, { id: 'b', label: 'no', when: 'temp<100' }] },
      do: { instructions: ['go'] },
      observe: { prompt: 'look' },
      explain: { text: 'default', cases: [{ when: 'temp>=100', text: 'reached boiling point' }] },
      concept: { text: 'c' },
      apply: { question: 'a?', options: [{ id: 'x', label: 'x', correct: true, feedback: 'y' }, { id: 'z', label: 'z', correct: false, feedback: 'n' }] },
      reflect: { prompts: ['r'] },
      ...overrides,
    },
  };
}

test('the variable model computes derived values and the visual inputs from the controls alone', () => {
  const start = variableModelEngine.evaluate(heating, variableModelEngine.initialState(heating));
  assert.equal(start.facts.temp, 25);
  assert.equal(start.visual?.kind, 'heating');
  assert.equal(start.visual?.values.temperature, 25);
  assert.equal(start.visual?.values.heat, 0);
  assert.equal(start.observation, 'At 25 C, not boiling.');

  const full = variableModelEngine.evaluate(heating, { values: { heat: 100 } });
  assert.equal(full.facts.temp, 105);
  assert.equal(full.visual?.values.heat, 1);
  assert.equal(full.observation, 'Boiling at 105 C.');
  assert.deepEqual(full.warnings, ['Maximum heat.']);
});

test('the observation is chosen by the same facts that drive the picture, so they cannot disagree', () => {
  for (const heat of [0, 25, 90, 95, 100]) {
    const r = variableModelEngine.evaluate(heating, { values: { heat } });
    const boils = (r.visual?.values.temperature ?? 0) >= (r.visual?.values.boiling_point ?? 0);
    assert.equal(/^Boiling/.test(r.observation), boils, `heat ${heat}`);
  }
});

test('out-of-range or off-step control values are snapped back into the legal range', () => {
  const r = variableModelEngine.evaluate(heating, { values: { heat: 9999 } });
  assert.equal(r.facts.heat, 100);
  const s = variableModelEngine.scenarioState(heating, { heat: 47 });
  assert.equal(s.values.heat, 45);
  assert.equal(variableModelEngine.scenarioState(heating, { heat: 'hot' }).values.heat, 0, 'a non-number override is ignored');
});

test('bars evaluate each bar over the controls', () => {
  const params: VariableModelParams = {
    controls: [{ id: 'n', label: 'n', min: 0, max: 10, step: 1, default: 2 }],
    visual: { kind: 'bars', bind: { bars: [{ label: 'double', value: 'n*2', max: 20 }, { label: 'square', value: 'n*n' }] } },
    observations: [{ when: 'n>=0', text: 'ok' }],
  };
  const r = variableModelEngine.evaluate(params, { values: { n: 3 } });
  assert.deepEqual(r.visual?.bars, [{ label: 'double', value: 6, max: 20 }, { label: 'square', value: 9, max: 9 }]);
});

test('a generated variable_model lab passes validation and has a right prediction', () => {
  const config = lab({ type: 'variable_model', params: heating as unknown as Record<string, unknown> });
  assert.deepEqual(validateLabConfig(config), []);
  assert.deepEqual(correctPredictionIds(config), ['a']);
  assert.equal(pickExplanation(config.steps.explain, { temp: 105 }), 'reached boiling point');
});

test('validation refuses what the engines cannot honestly run', () => {
  const params = heating as unknown as Record<string, unknown>;
  assert.match(validateLabConfig(lab({ type: 'run_javascript', params }))[0], /no "run_javascript" simulation/);
  assert.match(validateLabConfig(null)[0], /no simulation/);

  const unknownFact = lab({ type: 'variable_model', params }, {
    predict: { question: 'q', scenario: { heat: 100 }, options: [{ id: 'a', label: 'a', when: 'rpm>3' }] },
  });
  assert.match(validateLabConfig(unknownFact).join(' '), /unknown value\(s\): rpm/);

  const noneRight = lab({ type: 'variable_model', params }, {
    predict: { question: 'q', scenario: { heat: 100 }, options: [{ id: 'b', label: 'no', when: 'temp<100' }] },
  });
  assert.match(validateLabConfig(noneRight).join(' '), /No Predict option is right/);

  const twoRight = lab({ type: 'variable_model', params }, {
    apply: { question: 'a', options: [{ id: 'x', label: 'x', correct: true }, { id: 'y', label: 'y', correct: true }] },
  });
  assert.match(validateLabConfig(twoRight).join(' '), /exactly one right answer/);

  const badBind = lab({ type: 'variable_model', params: { ...heating, visual: { kind: 'heating', bind: { temperature: 'missing', heat: '1', boiling_point: '100' } } } as unknown as Record<string, unknown> });
  assert.match(validateLabConfig(badBind).join(' '), /cannot be calculated/);

  const incomplete = lab({ type: 'variable_model', params });
  delete (incomplete.steps as Partial<typeof incomplete.steps>).reflect;
  assert.match(validateLabConfig(incomplete)[0], /incomplete/);
});

// ---------------------------------------------------------------------------- sequence

const stages: SequenceParams = {
  items: [{ id: 'a', label: 'First' }, { id: 'b', label: 'Second' }, { id: 'c', label: 'Third' }, { id: 'd', label: 'Fourth' }],
};

test('a scramble is repeatable and never the answer', () => {
  for (let n = 2; n <= 10; n++) {
    const ids = Array.from({ length: n }, (_, i) => `i${i}`);
    const out = scramble(ids);
    assert.deepEqual(scramble(ids), out);
    assert.deepEqual([...out].sort(), [...ids].sort());
    assert.notDeepEqual(out, ids, `n=${n}`);
  }
});

test('sequence counts items in the right place and knows when the order is right', () => {
  const start = sequenceEngine.evaluate(stages, sequenceEngine.initialState(stages));
  assert.ok(start.facts.correct < 4);
  assert.equal(start.facts.in_order, 0);

  const solved = sequenceEngine.evaluate(stages, { order: ['a', 'b', 'c', 'd'] });
  assert.equal(solved.facts.correct, 4);
  assert.equal(solved.facts.in_order, 1);
  assert.match(solved.observation, /4 of 4/);
});

test('a sequence lab validates and its predict scenario can use a stated order', () => {
  const config = lab({ type: 'sequence', params: stages as unknown as Record<string, unknown> }, {
    predict: { question: 'q', scenario: { order: ['a', 'b', 'c', 'd'] }, options: [{ id: 'y', label: 'all right', when: 'in_order==1' }, { id: 'n', label: 'not all', when: 'in_order==0' }] },
    explain: { text: 'default', cases: [{ when: 'correct==total', text: 'perfect' }] },
  });
  assert.deepEqual(validateLabConfig(config), []);
  assert.deepEqual(correctPredictionIds(config), ['y']);
});

// --------------------------------------------------------------------------- classify

const groups: ClassifyParams = {
  categories: [{ id: 'solid', label: 'Solid' }, { id: 'gas', label: 'Gas' }],
  items: [{ id: 'rock', label: 'Rock', category: 'solid' }, { id: 'air', label: 'Air', category: 'gas' }, { id: 'ice', label: 'Ice', category: 'solid' }],
};

test('classify scores sorted items and is complete only when all are right', () => {
  const r = classifyEngine.evaluate(groups, { assigned: { rock: 'solid', air: 'solid' } });
  assert.deepEqual([r.facts.correct, r.facts.wrong, r.facts.unassigned, r.facts.complete], [1, 1, 1, 0]);

  const done = classifyEngine.evaluate(groups, { assigned: { rock: 'solid', air: 'gas', ice: 'solid' } });
  assert.equal(done.facts.complete, 1);
});

test('classify ignores a scenario that names a category that does not exist', () => {
  const s = classifyEngine.scenarioState(groups, { assigned: { rock: 'plasma', air: 'gas' } });
  assert.deepEqual(s.assigned, { air: 'gas' });
});

test('every backend-emitted engine type is registered', () => {
  for (const type of ['calculator', 'relevance', 'osmosis', 'variable_model', 'sequence', 'classify']) {
    assert.ok(getEngine(type), type);
  }
});
