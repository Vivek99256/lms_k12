import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_CHOICES,
  MIN_CHOICES,
  addChoice,
  addNode,
  blankNode,
  emptyScenario,
  incomingLinks,
  issuesByNode,
  link,
  makeStart,
  moveChoice,
  moveNode,
  publishProblems,
  removeChoice,
  removeNode,
  scenarioFromRaw,
  scenarioToPayload,
  storyMapLayout,
  updateChoice,
  updateNode,
  type BranchingScenarioSavePayload,
} from './branching-editor';

/**
 * Every edit an author can make is an operation here, so a scenario that looks
 * fine in the editor cannot strand a learner. The invariants worth pinning:
 * the first step is never an ending, deleting a step clears the links to it,
 * and a decision always has between two and six choices.
 */

const body = '<p>Words that say something useful to a learner.</p>';

/** A complete scenario: start -> decision -> {screen -> good ending | bad ending}. */
function complete(): BranchingScenarioSavePayload {
  const s = emptyScenario();
  s.title = 'Is the map the land?';
  const [first, end] = s.nodes;
  first.ref = 'a';
  first.title = 'The walk';
  first.body = body;
  end.ref = 'e1';
  end.title = 'Well reasoned';
  end.body = body;

  const next = addNode(s, 'branching_question');
  const d = next.ref;
  let scenario = updateNode(next.scenario, d, { title: 'Decide', body: '<p>What do you check first?</p>' });
  scenario = updateNode(scenario, 'a', { next_ref: d });
  scenario = updateChoice(scenario, d, 0, { text: 'Ask what it is for', feedback_text: '<p>Good thinking, because the purpose decides.</p>', quality: 'best' });
  scenario = updateChoice(scenario, d, 1, { text: 'Expect every tree', feedback_text: '<p>A model leaves things out on purpose.</p>', quality: 'misstep' });
  scenario = link(scenario, { ref: d, choice: 0 }, 'e1').scenario;

  const weak = link(scenario, { ref: d, choice: 1 }, 'new:ending');
  scenario = weak.scenario;
  scenario = updateNode(scenario, weak.created as string, { title: 'Worth another look', body, score: 40 });

  return scenario;
}

test('a new scenario is a complete one: a first screen leading to an ending', () => {
  const s = emptyScenario();

  assert.deepEqual(s.nodes.map((n) => n.node_type), ['text', 'ending']);
  assert.equal(s.nodes[0].next_ref, s.nodes[1].ref);
  assert.equal(s.nodes[0].purpose, 'situation');
});

test('a blank decision starts with two choices and a blank ending with a full score', () => {
  assert.equal(blankNode('branching_question').options.length, MIN_CHOICES);
  assert.equal(blankNode('ending').score, 100);
  assert.equal(blankNode('text').proceed_button_text, 'Continue');
});

test('new content steps go before the endings, and a new ending goes last', () => {
  const s = emptyScenario();

  const screen = addNode(s, 'text');
  assert.deepEqual(screen.scenario.nodes.map((n) => n.node_type), ['text', 'text', 'ending']);

  const ending = addNode(screen.scenario, 'ending');
  assert.deepEqual(ending.scenario.nodes.map((n) => n.node_type), ['text', 'text', 'ending', 'ending']);
});

test('links are made to an existing step or to a new one created on the spot', () => {
  const s = emptyScenario();
  const made = link(s, { ref: s.nodes[0].ref }, 'new:branching_question');

  assert.ok(made.created);
  assert.equal(made.scenario.nodes.find((n) => n.ref === made.created)?.node_type, 'branching_question');
  assert.equal(made.scenario.nodes[0].next_ref, made.created);

  const cleared = link(made.scenario, { ref: s.nodes[0].ref }, null);
  assert.equal(cleared.scenario.nodes[0].next_ref, null);
  assert.equal(cleared.created, null);
});

test('deleting a step clears every link that led to it and says how many', () => {
  const s = complete();
  const decision = s.nodes.find((n) => n.node_type === 'branching_question')!;
  assert.equal(incomingLinks(s, decision.ref), 1);

  const { scenario, cleared } = removeNode(s, decision.ref);

  assert.equal(cleared, 1);
  assert.equal(scenario.nodes.length, s.nodes.length - 1);
  assert.equal(scenario.nodes.find((n) => n.ref === 'a')?.next_ref, null);
  assert.ok(scenario.nodes.every((n) => n.next_ref !== decision.ref && n.options.every((o) => o.next_ref !== decision.ref)));
});

test('the last step cannot be deleted, and deleting the start never leaves an ending first', () => {
  const lone = { ...emptyScenario(), nodes: [blankNode('text')] };
  assert.equal(removeNode(lone, lone.nodes[0].ref).scenario.nodes.length, 1);

  const s = complete();
  const { scenario } = removeNode(s, 'a');
  assert.notEqual(scenario.nodes[0].node_type, 'ending');
});

test('any content step can be made the start, but an ending cannot', () => {
  const s = complete();
  const decision = s.nodes.find((n) => n.node_type === 'branching_question')!;

  assert.equal(makeStart(s, decision.ref).nodes[0].ref, decision.ref);
  assert.equal(makeStart(s, 'e1'), s);
  assert.equal(makeStart(s, 'a'), s, 'already the start');
});

test('moving a step reorders the outline but never displaces the start', () => {
  const s = complete();

  assert.equal(moveNode(s, 'a', 1), s, 'the start does not move');
  const moved = moveNode(s, s.nodes[2].ref, -1);
  assert.equal(moved.nodes[0].ref, 'a');
  assert.equal(moved.nodes[1].ref, s.nodes[2].ref);
  assert.equal(moveNode(s, s.nodes[1].ref, -1), s, 'nothing may move above the start');
});

test('a decision has between two and six choices', () => {
  let s = complete();
  const d = s.nodes.find((n) => n.node_type === 'branching_question')!.ref;

  assert.equal(removeChoice(s, d, 0), s, 'two is the least');
  for (let i = 0; i < 10; i++) s = addChoice(s, d);
  assert.equal(s.nodes.find((n) => n.ref === d)!.options.length, MAX_CHOICES);

  s = removeChoice(s, d, 5);
  assert.equal(s.nodes.find((n) => n.ref === d)!.options.length, MAX_CHOICES - 1);
});

test('choices can be reordered and keep their own links and wording', () => {
  const s = complete();
  const d = s.nodes.find((n) => n.node_type === 'branching_question')!;

  const moved = moveChoice(s, d.ref, 0, 1).nodes.find((n) => n.ref === d.ref)!;

  assert.equal(moved.options[1].text, 'Ask what it is for');
  assert.equal(moved.options[1].next_ref, 'e1');
  assert.equal(moved.options[0].text, 'Expect every tree');
  assert.equal(moveChoice(s, d.ref, 0, -1), s);
});

test('a complete scenario has nothing stopping it being published', () => {
  assert.deepEqual(publishProblems(complete()), []);
});

test('an untitled scenario and an unlinked step are reported in plain words', () => {
  const s = complete();
  s.title = '  ';
  s.nodes[0].next_ref = null;

  const problems = publishProblems(s);

  assert.ok(problems.includes('Give the scenario a title.'));
  assert.ok(problems.some((p) => /does not lead anywhere/.test(p)));
});

test('issues are grouped by the step they are about, drafts treating a missing picture description as a warning', () => {
  const s = complete();
  s.nodes[0].media_path = 'https://cdn.example.test/a.png';

  const issues = issuesByNode(s).get('a') ?? [];

  assert.ok(issues.some((i) => i.code === 'missing_alt' && i.level === 'warning'));
});

test('what is saved carries only what each kind can use', () => {
  const s = complete();
  const ending = s.nodes.find((n) => n.node_type === 'ending')!;
  ending.next_ref = 'a';
  ending.options = [{ ...s.nodes.find((n) => n.node_type === 'branching_question')!.options[0] }];
  s.nodes[0].options = [{ ...ending.options[0] }];
  s.nodes[0].score = 77;
  const decision = s.nodes.find((n) => n.node_type === 'branching_question')!;
  decision.next_ref = 'a';

  const saved = scenarioToPayload({ ...s, generation: { generator: 'ai', model: null, generated_at: '', topic_ids: [], concept_ids: [], question_ids: [], focus: null } });

  assert.equal(saved.nodes.find((n) => n.node_type === 'ending')!.next_ref, null);
  assert.deepEqual(saved.nodes.find((n) => n.node_type === 'ending')!.options, []);
  assert.deepEqual(saved.nodes[0].options, []);
  assert.equal(saved.nodes[0].score, 0, 'a score on a screen is dropped');
  assert.equal(saved.nodes.find((n) => n.node_type === 'branching_question')!.next_ref, null);
  assert.equal('generation' in saved, false, 'an edit does not resend provenance');
});

test('whitespace is trimmed and the pass mark kept in range', () => {
  const s = complete();
  s.title = '  Padded  ';
  s.pass_percentage = 400;
  s.learning_objectives = ['  Explain  ', '   '];

  const saved = scenarioToPayload(s);

  assert.equal(saved.title, 'Padded');
  assert.equal(saved.pass_percentage, 100);
  assert.deepEqual(saved.learning_objectives, ['Explain']);
});

test('a saved scenario reads back with each id as its ref and every link intact', () => {
  const state = scenarioFromRaw({
    title: 'T',
    start_title: '',
    learning_objectives: ['One'],
    scoring_option: 'no-score',
    nodes: [
      { id: 5, node_type: 'text', title: 'A', body, next_node_id: 6 },
      { id: 6, node_type: 'branching_question', title: 'D', body, options: [
        { text: 'x', next_node_id: 7, quality: 'best', feedback_text: 'f' },
        { text: 'y', next_node_id: 5, quality: null },
      ] },
      { id: 7, node_type: 'ending', title: 'E', body, score: 90 },
    ],
  });

  assert.deepEqual(state.nodes.map((n) => n.ref), ['5', '6', '7']);
  assert.equal(state.nodes[0].next_ref, '6');
  assert.deepEqual(state.nodes[1].options.map((o) => o.next_ref), ['7', '5']);
  assert.equal(state.nodes[2].score, 90);
  assert.equal(state.scoring_option, 'no-score');
  assert.equal(state.start_title, '', 'the stored start title, not the fallback');
  assert.deepEqual(publishProblems({ ...state, title: 'T' }), []);
});

test('the story map puts a rejoining step after everything that leads to it', () => {
  const s = complete();
  const layout = storyMapLayout(s);
  const column = (ref: string) => layout.positions.find((p) => p.ref === ref)!.column;
  const decision = s.nodes.find((n) => n.node_type === 'branching_question')!.ref;

  assert.equal(column('a'), 0);
  assert.equal(column(decision), 1);
  assert.ok(column('e1') > column(decision));
  assert.equal(layout.unreachable.length, 0);
  assert.equal(layout.edges.length, 3);
});

test('steps nothing leads to are listed apart, and a loop does not hang the layout', () => {
  const s = complete();
  const orphan = addNode(s, 'text');
  const loop = link(orphan.scenario, { ref: 'a' }, orphan.scenario.nodes[1].ref).scenario;

  const layout = storyMapLayout(link(loop, { ref: orphan.ref }, 'a').scenario);

  assert.ok(layout.positions.length === layout.positions.length);
  assert.ok(layout.columns >= 1);
  const lonely = storyMapLayout(orphan.scenario);
  assert.deepEqual(lonely.unreachable, [orphan.ref]);
});
