import type { LabConfig } from '../types';

/**
 * "Does Temperature Affect How Fast Ice Melts?" A mission for chapter 8592
 * ("Exploration: Entering the World of Secondary Science"), which is about asking
 * questions, careful observation and recording evidence.
 *
 * The student runs a whole investigation: ask, predict, choose and place equipment, run the
 * experiment, observe, record, interpret, conclude. Nothing here says which ice cube melts
 * faster, and the question prompts ask for reasons, not for the answer.
 */
export const ICE_MELTING_LAB: LabConfig = {
  id: 'ice_melting',
  title: 'Does Temperature Affect How Fast Ice Melts?',
  subtitle: 'A science mission',
  scenario:
    'You are a young scientist at a school lab. Two identical ice cubes are on the bench. Your team wants to find out whether the temperature of a place changes how fast ice melts, and they want your evidence.',
  mission:
    'Set up a fair test with a thermometer for each place and a stopwatch. Predict what will happen, run the experiment, record what you see and explain it.',
  objectives: [
    'Ask a scientific question and make a prediction with a reason.',
    'Choose and place equipment so that the test is fair.',
    'Observe changes carefully and record evidence.',
    'Use your evidence to write a conclusion.',
  ],
  chapterIds: [8592],
  chapterKeywords: [],
  concepts: ['Science asks what and how', 'Careful observation in exploration', 'Purposeful direction in exploration', 'Scientific terms are precise'],
  simulationId: 'ice_melting',
  objects: [
    {
      id: 'beakerA', kind: 'beaker', label: 'Beaker A', position: [-0.25, -0.4], props: { capacityMl: 100 },
      info: 'A transparent glass beaker. The ice cube sits inside it while it melts. Beaker A is for the cool place.',
    },
    {
      id: 'beakerB', kind: 'beaker', label: 'Beaker B', position: [0.25, -0.4], props: { capacityMl: 100 },
      info: 'A transparent glass beaker, just the same as Beaker A. Beaker B is for the warm place.',
    },
    {
      id: 'iceA', kind: 'ice_cube', label: 'Ice cube 1', position: [-0.5, 0.5],
      info: 'An ice cube. It is exactly the same size and temperature as the other one, so only the place can make a difference.',
    },
    {
      id: 'iceB', kind: 'ice_cube', label: 'Ice cube 2', position: [-0.2, 0.55],
      info: 'An ice cube, identical to the first. Drop it into a beaker.',
    },
    {
      id: 'thermoA', kind: 'ice_thermometer', label: 'Thermometer A', position: [0.3, 0.5], props: { expectZone: 'cool' },
      info: 'A thermometer measures how warm or cold a place is. Thermometer A goes next to Beaker A.',
    },
    {
      id: 'thermoB', kind: 'ice_thermometer', label: 'Thermometer B', position: [0.6, 0.55], props: { expectZone: 'warm' },
      info: 'A thermometer measures how warm or cold a place is. Thermometer B goes next to Beaker B.',
    },
    {
      id: 'stopwatch', kind: 'stopwatch', label: 'Stopwatch', position: [1.2, 0.35],
      info: 'A stopwatch measures time. It starts when you start the experiment. Click it to pause or restart it.',
    },
  ],
  zones: [
    { id: 'cool', label: 'Cool place', position: [-0.85, 0.05], radius: 0.5, accepts: ['beaker', 'ice_thermometer'] },
    { id: 'warm', label: 'Warm place', position: [0.85, 0.05], radius: 0.5, accepts: ['beaker', 'ice_thermometer'] },
  ],
  prediction: {
    prompt: 'Which ice cube do you think will melt faster?',
    options: [
      { id: 'cool', label: 'Beaker A (cool place)' },
      { id: 'warm', label: 'Beaker B (warm place)' },
      { id: 'same', label: 'Both at the same speed' },
    ],
    reasonRequired: true,
  },
  tasks: [
    { id: 'start', label: 'Press “Start the experiment”', hint: 'Everything is in place. Press the green Start button.' },
    { id: 'read', label: 'Read both thermometers', hint: 'Look at the two thermometers. What temperature is each place?' },
    { id: 'watch', label: 'Watch what happens to each ice cube', hint: 'Watch the two ice cubes and the water in each beaker. What is changing, and how fast?' },
    { id: 'melted', label: 'Wait until both ice cubes have melted', hint: 'Keep watching. You can speed up time with the 4x button. Note the stopwatch time for each beaker.' },
  ],
  setupText:
    'Set up a fair test. Put Beaker A in the cool place and Beaker B in the warm place. Put one ice cube in each beaker. Stand each thermometer next to its beaker. Click any object to find out what it is for.',
  startAction: { label: 'Start the experiment', action: 'start' },
  notebookColumns: ['Observation', 'Beaker A', 'Beaker B'],
  notebookRows: ['Temperature (°C)', 'Melting time (s)', 'Final observation'],
  questions: [
    { id: 'faster', skill: 'what', type: 'text', prompt: 'Which ice cube melted faster?' },
    { id: 'difference', skill: 'what', type: 'text', prompt: 'What difference did you observe between the two beakers?' },
    { id: 'how', skill: 'how', type: 'text', prompt: 'How did temperature affect melting?' },
    { id: 'prediction', skill: 'evidence', type: 'text', prompt: 'Was your prediction correct? Say how you know.' },
    { id: 'evidence', skill: 'evidence', type: 'text', prompt: 'What evidence supports your conclusion?' },
  ],
  conclusionPrompt: 'Write your own scientific conclusion: does temperature affect how fast ice melts? Use your evidence.',
  observationPlaceholder: 'Describe what the ice cube and the water looked like, and how they changed…',
  diagramPrompt: 'Draw a diagram of your experiment and label what you used',
  simulatedNote: 'These numbers come from a simulation. They are not real-world measurements. In a real experiment your results would be close to these, but never exactly the same.',
  vocabulary: ['temperature', 'prediction', 'observation', 'evidence', 'fair test', 'conclusion'],
  estimatedMinutes: 15,
};
