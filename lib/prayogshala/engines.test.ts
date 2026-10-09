import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluate, isTrue } from './expr';
import {
  calculatorEngine,
  correctPredictionIds,
  osmosisEngine,
  pickExplanation,
  relevanceEngine,
  type LabConfig,
} from './engines';

/**
 * The lab engines, against the numbers the Standard 9 Science textbook itself works through:
 * Example 1.3 (air breathed in a day), Activity 2.1 (cell size from the field of view) and
 * Activity 2.2 (potato in water / salt solution).
 */

test('expressions evaluate with precedence, comparisons and logic', () => {
  assert.equal(evaluate('2+3*4', {}), 14);
  assert.equal(evaluate('(2+3)*4', {}), 20);
  assert.equal(evaluate('-a+10', { a: 4 }), 6);
  assert.equal(evaluate('a>=5 && a<10', { a: 7 }), 1);
  assert.equal(evaluate('a<5 || a>=10', { a: 7 }), 0);
  assert.equal(isTrue('a==7', { a: 7 }), true);
});

test('bad expressions return null instead of throwing, and nothing is ever eval-ed', () => {
  assert.equal(evaluate('1/0', {}), null);
  assert.equal(evaluate('missing+1', {}), null);
  assert.equal(evaluate('2 +', {}), null);
  assert.equal(evaluate('process.exit(1)', {}), null);
  assert.equal(evaluate('constructor', {}), null);
  assert.equal(isTrue(undefined, {}), false);
});

const breathing = {
  variables: [
    { id: 'bpm', label: 'bpm', unit: '', min: 6, max: 30, step: 1, default: 12 },
    { id: 'vol', label: 'vol', unit: '', min: 0.1, max: 1.5, step: 0.05, default: 0.5 },
    { id: 'bal', label: 'bal', unit: '', min: 1, max: 6, step: 1, default: 3 },
    { id: 'balvol', label: 'balvol', unit: '', min: 0.5, max: 4, step: 0.5, default: 2 },
  ],
  outputs: [
    { id: 'day', label: 'day', unit: 'L', formula: 'bpm*60*24*vol', decimals: 0, primary: true },
    { id: 'check', label: 'check', unit: 'L', formula: 'bal*balvol*1440', decimals: 0 },
    { id: 'agreement', label: 'ratio', unit: 'x', formula: 'day/check', decimals: 2 },
  ],
  warnings: [{ when: 'agreement>2', text: 'too big' }, { when: 'agreement<0.5', text: 'too small' }],
  observation_template: 'Route 1 {day} L; Route 2 {check} L; ratio {agreement}.',
};

test('calculator reproduces the textbook balloon cross-check (3 x 2 L x 1,440 = 8,640 L)', () => {
  const state = calculatorEngine.initialState(breathing);
  const result = calculatorEngine.evaluate(breathing, state);
  assert.equal(result.facts.check, 8640);
  assert.equal(result.facts.day, 8640); // 12 breaths/min x 0.5 L x 1,440 min
  assert.match(result.observation, /Route 2 8,640 L/);
  assert.deepEqual(result.warnings, []);
});

test('calculator warns when the two routes disagree, and the observation follows the state', () => {
  const state = { values: { ...calculatorEngine.initialState(breathing).values, vol: 1.5 } };
  const result = calculatorEngine.evaluate(breathing, state);
  assert.equal(result.facts.agreement, 3);
  assert.deepEqual(result.warnings, ['too big']);
  assert.match(result.observation, /ratio 3\.00/);
});

const cells = {
  variables: [
    { id: 'field_mm', label: 'f', unit: 'mm', min: 1, max: 8, step: 0.5, default: 5 },
    { id: 'cells', label: 'c', unit: '', min: 4, max: 80, step: 1, default: 25 },
    { id: 'eye', label: 'e', unit: 'x', min: 5, max: 20, step: 5, default: 10 },
    { id: 'obj', label: 'o', unit: 'x', min: 4, max: 40, step: 2, default: 10 },
  ],
  outputs: [
    { id: 'field_um', label: 'f', unit: 'um', formula: 'field_mm*1000' },
    { id: 'cell_um', label: 'c', unit: 'um', formula: 'field_um/cells', primary: true },
    { id: 'mag', label: 'm', unit: 'x', formula: 'eye*obj' },
  ],
};

test('cell size matches Activity 2.1: a 5 mm field with 25 cells gives 200 micrometres', () => {
  const result = calculatorEngine.evaluate(cells, calculatorEngine.initialState(cells));
  assert.equal(result.facts.field_um, 5000);
  assert.equal(result.facts.cell_um, 200);
  assert.equal(result.facts.mag, 100);
});

const osmosis = {
  specimens: [
    { id: 'potato', label: 'Potato piece', has_wall: true, measure: 'mass' as const },
    { id: 'plant', label: 'Plant cell', has_wall: true, measure: 'volume' as const },
    { id: 'animal', label: 'Animal cell', has_wall: false, measure: 'volume' as const },
  ],
  solutions: [
    { id: 'water', label: 'Plain water', solute_pct: 0 },
    { id: 'salt20', label: '20% salt solution', solute_pct: 20 },
    { id: 'matched', label: 'Matching', solute_pct: 5 },
  ],
  cell_solute_pct: 5,
  max_minutes: 60,
  full_change_pct: 12,
  default_specimen: 'potato',
  default_solution: 'water',
  observation_template: '{specimen} in {solution}, {minutes} min: {outcome_text}',
};

test('osmosis follows Activity 2.2: potato swells in water and shrinks in 20% salt solution', () => {
  const water = osmosisEngine.evaluate(osmosis, { specimen: 'potato', solution: 'water', minutes: 60 });
  const salt = osmosisEngine.evaluate(osmosis, { specimen: 'potato', solution: 'salt20', minutes: 60 });
  const matched = osmosisEngine.evaluate(osmosis, { specimen: 'potato', solution: 'matched', minutes: 60 });
  assert.equal(water.facts.swell, 1);
  assert.ok(water.facts.change_pct > 0);
  assert.equal(salt.facts.shrink, 1);
  assert.ok(salt.facts.change_pct < 0);
  assert.equal(matched.facts.nochange, 1);
  assert.equal(matched.facts.change_pct, 0);
});

test('osmosis observation never contradicts the state: nothing happens at time zero, and the wall keeps a plant cell outline', () => {
  const start = osmosisEngine.evaluate(osmosis, { specimen: 'potato', solution: 'salt20', minutes: 0 });
  assert.match(start.observation, /nothing has happened yet/);
  assert.equal(start.facts.change_pct, 0);

  const plant = osmosisEngine.evaluate(osmosis, { specimen: 'plant', solution: 'salt20', minutes: 60 });
  const animal = osmosisEngine.evaluate(osmosis, { specimen: 'animal', solution: 'salt20', minutes: 60 });
  assert.match(plant.observation, /wall holds the original outline/);
  assert.match(animal.observation, /shrivels/);
});

test('the effect grows with time and with the concentration difference', () => {
  const half = osmosisEngine.evaluate(osmosis, { specimen: 'potato', solution: 'salt20', minutes: 30 }).facts.change_pct;
  const full = osmosisEngine.evaluate(osmosis, { specimen: 'potato', solution: 'salt20', minutes: 60 }).facts.change_pct;
  const weak = osmosisEngine.evaluate(osmosis, { specimen: 'potato', solution: 'water', minutes: 60 }).facts.change_pct;
  assert.ok(Math.abs(full) > Math.abs(half));
  assert.ok(Math.abs(full) > Math.abs(weak));
});

const models = {
  subject: 'ball',
  details: [
    { id: 'speed', label: 'Speed' },
    { id: 'brand', label: 'Brand of bat' },
    { id: 'colour', label: 'Colour' },
  ],
  questions: [
    { id: 'distance', text: 'How far?', relevant: ['speed'] },
    { id: 'spot', text: 'Which is easiest to spot?', relevant: ['colour'] },
  ],
  default_question: 'distance',
  observation_template: '{kept} kept, {missed} missing, {extra} extra',
};

test('relevance: the right set of details depends on the question', () => {
  const ok = relevanceEngine.evaluate(models, { question: 'distance', kept: ['speed'] });
  assert.equal(ok.facts.complete, 1);
  const wrongQuestion = relevanceEngine.evaluate(models, { question: 'spot', kept: ['speed'] });
  assert.equal(wrongQuestion.facts.missed, 1);
  assert.equal(wrongQuestion.facts.extra, 1);
  assert.equal(wrongQuestion.facts.complete, 0);
  assert.equal(relevanceEngine.evaluate(models, { question: 'distance', kept: [] }).facts.complete, 0, 'an empty model is not complete');
});

test('predict answers come from the engine, not from a stored key', () => {
  const config: LabConfig = {
    version: 1,
    simulation: { type: 'osmosis', params: osmosis },
    steps: {
      mission: { scenario: '', task: '' },
      predict: {
        question: 'q',
        scenario: { specimen: 'potato', solution: 'salt20', minutes: 60 },
        options: [
          { id: 'a', label: 'swells', when: 'swell==1' },
          { id: 'b', label: 'shrinks', when: 'shrink==1' },
          { id: 'c', label: 'same', when: 'nochange==1' },
        ],
      },
      do: { instructions: [] },
      observe: { prompt: '' },
      explain: { text: 'default', cases: [{ when: 'shrink==1', text: 'water leaves' }] },
      concept: { text: '' },
      apply: { question: '', options: [] },
      reflect: { prompts: [] },
    },
  };
  assert.deepEqual(correctPredictionIds(config), ['b']);
  assert.equal(pickExplanation(config.steps.explain, { shrink: 1 }), 'water leaves');
  assert.equal(pickExplanation(config.steps.explain, { shrink: 0 }), 'default');
});

test('an unknown engine yields no correct predictions rather than crashing', () => {
  const config = { version: 1, simulation: { type: 'nope', params: {} }, steps: { predict: { options: [] } } } as unknown as LabConfig;
  assert.deepEqual(correctPredictionIds(config), []);
});
