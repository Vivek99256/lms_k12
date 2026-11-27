import type { LabConfig } from '../types';

/**
 * "The Mechanics of Dissolving: A What and How Investigation".
 * Std 7 Science, chapter 8604 "Exploring Mixtures and their Separation".
 *
 * The questions are written to make students separate WHAT happened (an
 * observation) from HOW / WHY it happened (the particle explanation). Nothing
 * here states the answer to the prediction or to the investigation.
 */
export const DISSOLVING_LAB: LabConfig = {
  id: 'dissolving',
  title: 'The Mechanics of Dissolving',
  subtitle: 'A What and How Investigation',
  scenario:
    'You are a junior researcher at a beverage company. The team is designing a ready-to-mix drink powder and needs to know how the temperature of the water affects how quickly sugar disappears into it.',
  mission:
    'Run a fair test with sugar and water at two different temperatures. Collect your own evidence, then explain what happened and how it happened.',
  objectives: [
    'Tell the difference between a "what" question and a "how" question.',
    'Use the words solute, solvent, solution and dissolving correctly.',
    'Investigate how the temperature of water changes the rate of dissolving.',
    'Record observations and give a scientific explanation from your evidence.',
  ],
  chapterIds: [8604],
  chapterKeywords: ['mixture', 'solution', 'dissolv'],
  simulationId: 'dissolving',
  objects: [
    { id: 'beaker1', kind: 'beaker', label: 'Beaker 1', position: [-0.25, -0.2], props: { capacityMl: 250 } },
    { id: 'beaker2', kind: 'beaker', label: 'Beaker 2', position: [0.25, -0.2], props: { capacityMl: 250 } },
    { id: 'jugCold', kind: 'jug', label: 'Water jug (tap water)', position: [-1.2, -0.4], props: { capacityMl: 600, waterMl: 600, tempC: 12 } },
    { id: 'jugWarm', kind: 'jug', label: 'Water jug (heated)', position: [-0.78, -0.5], props: { capacityMl: 600, waterMl: 600, tempC: 55 } },
    { id: 'cylinder', kind: 'cylinder', label: 'Measuring cylinder', position: [0.85, -0.4], props: { capacityMl: 100 } },
    { id: 'sugar', kind: 'sugar_jar', label: 'Sugar container', position: [1.25, -0.3], props: { sugarG: 120 } },
    { id: 'spoon', kind: 'spoon', label: 'Spoon', position: [1.4, 0.45] },
    { id: 'thermometer', kind: 'thermometer', label: 'Thermometer', position: [1.2, 0.5] },
    { id: 'stopwatch', kind: 'stopwatch', label: 'Stopwatch', position: [-0.05, 0.62] },
  ],
  zones: [
    { id: 'matA', label: 'Station A', position: [-0.55, 0.25], radius: 0.28, accepts: ['beaker'] },
    { id: 'matB', label: 'Station B', position: [0.55, 0.25], radius: 0.28, accepts: ['beaker'] },
  ],
  prediction: {
    prompt: 'Which water do you think will dissolve sugar faster?',
    options: [
      { id: 'cold', label: 'Cold water' },
      { id: 'warm', label: 'Warm water' },
      { id: 'same', label: 'Both at the same rate' },
    ],
  },
  tasks: [
    { id: 'measure', label: 'Measure water in the measuring cylinder', hint: 'Pick up a water jug, hold it over the measuring cylinder and tilt it (mouse wheel or the Tilt slider).' },
    { id: 'waterBoth', label: 'Put the same amount of water in both beakers', hint: 'Pour about 100 mL into each beaker. Pour from the cylinder to be exact.' },
    { id: 'tempBoth', label: 'Check the temperature of the water in each beaker', hint: 'Pick up the thermometer and lower it into a beaker. Wait for the reading to settle.' },
    { id: 'sugarBoth', label: 'Add the same amount of sugar to both beakers', hint: 'Hold the sugar container above a beaker and tilt it. Watch the amount shown on the sugar container.' },
    { id: 'stopwatch', label: 'Start the stopwatch', hint: 'Click the stopwatch (or press S) at the moment you add the sugar.' },
    { id: 'stirBoth', label: 'Stir each beaker the same way', hint: 'Put the spoon in a beaker and move it round in circles.' },
    { id: 'observe', label: 'Watch until the sugar has gone from both beakers', hint: 'Keep an eye on the crystals. You can speed up time with the 4x button.' },
  ],
  notebookColumns: ['Measurement', 'Beaker 1', 'Beaker 2'],
  notebookRows: ['Temperature of the water (°C)', 'Volume of water (mL)', 'Sugar added (g)', 'Time for the sugar to disappear (s)'],
  questions: [
    { id: 'what', skill: 'what', type: 'text', prompt: 'WHAT happened to the sugar when it was added to the water and stirred?' },
    { id: 'how', skill: 'how', type: 'text', prompt: 'HOW did the water particles help to dissolve the sugar? Use the words solute, solvent and particles.' },
    { id: 'why', skill: 'why', type: 'text', prompt: 'WHY did the sugar dissolve at a different speed in the two beakers?' },
    {
      id: 'changed',
      skill: 'variable',
      type: 'choice',
      prompt: 'Which variable did you change on purpose?',
      options: [
        { id: 'temperature', label: 'Temperature of the water' },
        { id: 'sugar', label: 'Amount of sugar' },
        { id: 'water', label: 'Amount of water' },
        { id: 'stirring', label: 'How much I stirred' },
      ],
    },
    {
      id: 'kept',
      skill: 'variable',
      type: 'multi',
      prompt: 'Which things did you keep the same, to make it a fair test? (choose all that apply)',
      options: [
        { id: 'sugar', label: 'Amount of sugar' },
        { id: 'water', label: 'Amount of water' },
        { id: 'stirring', label: 'How I stirred' },
        { id: 'temperature', label: 'Temperature of the water' },
      ],
    },
    { id: 'evidence', skill: 'evidence', type: 'text', prompt: 'What evidence from your experiment supports your conclusion?' },
  ],
  conclusionPrompt: 'So, how does the temperature of water affect how fast sugar dissolves? Write your conclusion.',
  observationPlaceholder: 'Describe the sugar crystals, the water and how they changed…',
  diagramPrompt: 'Draw a diagram of what you think the water and sugar particles are doing',
  vocabulary: ['solute', 'solvent', 'solution', 'dissolving', 'particles', 'temperature', 'stirring', 'fair test'],
  estimatedMinutes: 25,
};
