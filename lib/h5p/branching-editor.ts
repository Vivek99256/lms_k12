/**
 * Branching Scenario: the editor's state and the operations on it, as pure
 * functions.
 *
 * NO IMPORTS beyond the sibling rules file, like the rest of lib/h5p: every
 * edit an author can make -- adding a step, linking one to another, deleting
 * one, making one the start -- is an operation here that can be tested without
 * a browser. The editor component only calls them.
 *
 * THE STATE IS THE SAVE PAYLOAD. A node is addressed by a client `ref`, never by
 * a database id, so the author can build a path forward from a step that does
 * not exist yet and the server resolves it all in one save. Reading a saved
 * scenario back gives each node its id as its ref.
 *
 * THE INVARIANTS THESE OPERATIONS KEEP, because breaking one is how an author
 * ends up with a scenario that looks fine in the editor and strands a learner:
 *
 *   - the FIRST node is where the scenario starts, and is never an ending;
 *   - deleting a step clears every link that led to it (a link to nothing is
 *     a dead end), and says how many it cleared;
 *   - a screen has one way on, a decision has choices, an ending has neither;
 *   - a decision never has fewer than two choices, or more than six.
 */

import {
  analyse,
  normalizeScenario,
  type BsIssue,
  type BsNodeType,
  type BsQuality,
  type BsScoring,
  type RawScenario,
} from './branching-scenario';

// ---------------------------------------------------------------------------
// The payload
// ---------------------------------------------------------------------------

export interface BranchingChoiceInput {
  text: string;
  next_ref: string | null;
  quality: BsQuality | null;
  feedback_title: string;
  feedback_text: string;
  feedback_image: string;
  feedback_image_alt: string;
}

/** Nodes are addressed by `ref`, never by id, so a new node can lead to another new node in one save. */
export interface BranchingNodeInput {
  ref: string;
  node_type: BsNodeType;
  purpose: string | null;
  title: string;
  show_title: boolean;
  body: string;
  media_path: string;
  media_alt: string;
  proceed_button_text: string;
  next_ref: string | null;
  score: number;
  concept_id: number | null;
  source_question_id: number | null;
  options: BranchingChoiceInput[];
}

export interface BranchingGenerationInfo {
  generator: string;
  model: string | null;
  generated_at: string;
  topic_ids: number[];
  concept_ids: number[];
  question_ids: number[];
  focus: string | null;
}

export interface BranchingScenarioSavePayload {
  title: string;
  description: string;
  start_title: string;
  start_subtitle: string;
  start_image: string;
  start_image_alt: string;
  learning_objectives: string[];
  scoring_option: BsScoring;
  pass_percentage: number;
  enable_backwards_navigation: boolean;
  randomize_alternatives: boolean;
  /** Present only on a generated draft; an edit from the editor omits it so provenance is kept. */
  generation?: BranchingGenerationInfo;
  nodes: BranchingNodeInput[];
}

export const MIN_CHOICES = 2;
export const MAX_CHOICES = 6;
export const MAX_NODES = 60;

// ---------------------------------------------------------------------------
// Blanks
// ---------------------------------------------------------------------------

/** A fresh client-side ref for a new node. Stable while the editor is open. */
export function newNodeRef(): string {
  return `node-${Math.random().toString(36).slice(2, 10)}`;
}

export function blankChoice(): BranchingChoiceInput {
  return {
    text: '',
    next_ref: null,
    quality: null,
    feedback_title: '',
    feedback_text: '',
    feedback_image: '',
    feedback_image_alt: '',
  };
}

export function blankNode(type: BsNodeType): BranchingNodeInput {
  return {
    ref: newNodeRef(),
    node_type: type,
    purpose: null,
    title: '',
    show_title: true,
    body: '',
    media_path: '',
    media_alt: '',
    proceed_button_text: type === 'text' ? 'Continue' : '',
    next_ref: null,
    score: type === 'ending' ? 100 : 0,
    concept_id: null,
    source_question_id: null,
    // A decision starts with two choices: with fewer it is not a decision.
    options: type === 'branching_question' ? [blankChoice(), blankChoice()] : [],
  };
}

export const BRANCHING_SCENARIO_DEFAULTS: BranchingScenarioSavePayload = {
  title: '',
  description: '',
  start_title: '',
  start_subtitle: '',
  start_image: '',
  start_image_alt: '',
  learning_objectives: [],
  scoring_option: 'static-end-score',
  pass_percentage: 60,
  enable_backwards_navigation: true,
  randomize_alternatives: false,
  nodes: [],
};

/**
 * What a new scenario opens with: a first screen that leads to an ending, so it
 * is a complete (if empty) scenario from the start and the author's job is to
 * add the decisions between them.
 */
export function emptyScenario(): BranchingScenarioSavePayload {
  const first = blankNode('text');
  first.purpose = 'situation';
  const end = blankNode('ending');
  first.next_ref = end.ref;

  return { ...BRANCHING_SCENARIO_DEFAULTS, learning_objectives: [], nodes: [first, end] };
}

// ---------------------------------------------------------------------------
// Rows <-> state
// ---------------------------------------------------------------------------

/** A saved scenario (or any raw shape) as editor state; each node's id becomes its ref. */
export function scenarioFromRaw(raw: RawScenario): BranchingScenarioSavePayload {
  const s = normalizeScenario(raw);

  return {
    title: s.title,
    description: s.description,
    start_title: raw.start_title ?? '',
    start_subtitle: s.startSubtitle,
    start_image: s.startImage,
    start_image_alt: s.startImageAlt,
    learning_objectives: [...s.objectives],
    scoring_option: s.scoring,
    pass_percentage: s.passPercentage,
    enable_backwards_navigation: s.backNavigation,
    randomize_alternatives: s.randomizeChoices,
    nodes: s.nodes.map((n) => ({
      ref: n.key,
      node_type: n.type,
      purpose: n.purpose,
      title: n.title,
      show_title: n.showTitle,
      body: n.body,
      media_path: n.mediaPath,
      media_alt: n.mediaAlt,
      proceed_button_text: n.proceedLabel,
      next_ref: n.next,
      score: n.score,
      concept_id: n.conceptId,
      source_question_id: n.questionId,
      options: n.choices.map((c) => ({
        text: c.text,
        next_ref: c.next,
        quality: c.quality,
        feedback_title: c.feedbackTitle,
        feedback_text: c.feedbackText,
        feedback_image: c.feedbackImage,
        feedback_image_alt: c.feedbackImageAlt,
      })),
    })),
  };
}

/**
 * State -> what the server saves.
 *
 * Strings are trimmed, and each kind carries only what it can use: an ending has
 * no onward link and no choices, a screen has no choices, a decision has no
 * "next". The server narrows the same way; doing it here as well means what is
 * previewed is what is stored.
 */
export function scenarioToPayload(s: BranchingScenarioSavePayload): BranchingScenarioSavePayload {
  const { generation, ...rest } = s;
  void generation; // an edit never resends provenance; the server keeps it

  return {
    ...rest,
    title: s.title.trim(),
    description: s.description.trim(),
    start_title: s.start_title.trim(),
    start_subtitle: s.start_subtitle.trim(),
    start_image: s.start_image.trim(),
    start_image_alt: s.start_image_alt.trim(),
    learning_objectives: s.learning_objectives.map((o) => o.trim()).filter((o) => o !== ''),
    pass_percentage: Math.max(0, Math.min(100, Math.round(Number(s.pass_percentage) || 0))),
    nodes: s.nodes.map((n) => ({
      ...n,
      title: n.title.trim(),
      body: n.body.trim(),
      media_path: n.media_path.trim(),
      media_alt: n.media_alt.trim(),
      proceed_button_text: n.proceed_button_text.trim(),
      score: n.node_type === 'ending' ? Math.max(0, Math.min(1000, Math.round(Number(n.score) || 0))) : 0,
      next_ref: n.node_type === 'text' ? n.next_ref || null : null,
      options:
        n.node_type === 'branching_question'
          ? n.options.map((o) => ({
              ...o,
              text: o.text.trim(),
              next_ref: o.next_ref || null,
              feedback_title: o.feedback_title.trim(),
              feedback_text: o.feedback_text.trim(),
              feedback_image: o.feedback_image.trim(),
              feedback_image_alt: o.feedback_image_alt.trim(),
            }))
          : [],
    })),
  };
}

// ---------------------------------------------------------------------------
// Checking
// ---------------------------------------------------------------------------

/** Everything the publish check would refuse, in the author's words. */
export function publishProblems(s: BranchingScenarioSavePayload): string[] {
  const problems: string[] = [];
  if (s.title.trim() === '') problems.push('Give the scenario a title.');
  problems.push(...analyse(normalizeScenario(s), true).errors.map((i) => i.message));

  return problems;
}

/** Issues grouped by the step they are about (errors and warnings both). */
export function issuesByNode(s: BranchingScenarioSavePayload): Map<string, BsIssue[]> {
  const report = analyse(normalizeScenario(s), false);
  const map = new Map<string, BsIssue[]>();
  for (const issue of [...report.errors, ...report.warnings]) {
    if (issue.node == null) continue;
    map.set(issue.node, [...(map.get(issue.node) ?? []), issue]);
  }

  return map;
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

/** Apply a change to one step. A change that returns the step untouched returns the scenario untouched, so a no-op does not re-render. */
function replaceNode(s: BranchingScenarioSavePayload, ref: string, change: (n: BranchingNodeInput) => BranchingNodeInput): BranchingScenarioSavePayload {
  let changed = false;
  const nodes = s.nodes.map((n) => {
    if (n.ref !== ref) return n;
    const next = change(n);
    if (next !== n) changed = true;
    return next;
  });

  return changed ? { ...s, nodes } : s;
}

export function updateNode(s: BranchingScenarioSavePayload, ref: string, patch: Partial<BranchingNodeInput>): BranchingScenarioSavePayload {
  return replaceNode(s, ref, (n) => ({ ...n, ...patch }));
}

export function updateChoice(
  s: BranchingScenarioSavePayload,
  ref: string,
  index: number,
  patch: Partial<BranchingChoiceInput>
): BranchingScenarioSavePayload {
  return replaceNode(s, ref, (n) => ({ ...n, options: n.options.map((o, i) => (i === index ? { ...o, ...patch } : o)) }));
}

/**
 * Add a step. It goes at the end of the content steps -- before the endings, so
 * the endings stay together at the bottom of the outline -- unless it is an
 * ending itself.
 */
export function addNode(s: BranchingScenarioSavePayload, type: BsNodeType): { scenario: BranchingScenarioSavePayload; ref: string } {
  const node = blankNode(type);
  if (s.nodes.length >= MAX_NODES) return { scenario: s, ref: s.nodes[s.nodes.length - 1]?.ref ?? node.ref };

  const firstEnding = s.nodes.findIndex((n) => n.node_type === 'ending');
  const at = type === 'ending' || firstEnding === -1 ? s.nodes.length : firstEnding;
  const nodes = [...s.nodes.slice(0, at), node, ...s.nodes.slice(at)];

  return { scenario: { ...s, nodes }, ref: node.ref };
}

/** How many links point at a step. */
export function incomingLinks(s: BranchingScenarioSavePayload, ref: string): number {
  let count = 0;
  for (const n of s.nodes) {
    if (n.next_ref === ref) count++;
    for (const o of n.options) if (o.next_ref === ref) count++;
  }

  return count;
}

/**
 * Delete a step and clear every link that led to it. The last step cannot be
 * deleted: a scenario of nothing is not a scenario. Returns how many links
 * were cleared, so the editor can say so.
 */
export function removeNode(s: BranchingScenarioSavePayload, ref: string): { scenario: BranchingScenarioSavePayload; cleared: number } {
  if (s.nodes.length <= 1 || !s.nodes.some((n) => n.ref === ref)) return { scenario: s, cleared: 0 };

  const cleared = incomingLinks(s, ref);
  const nodes = s.nodes
    .filter((n) => n.ref !== ref)
    .map((n) => ({
      ...n,
      next_ref: n.next_ref === ref ? null : n.next_ref,
      options: n.options.map((o) => (o.next_ref === ref ? { ...o, next_ref: null } : o)),
    }));

  return { scenario: { ...s, nodes: ensureStartIsNotAnEnding(nodes) }, cleared };
}

/** The first step is where the scenario starts, so it cannot be an ending. */
function ensureStartIsNotAnEnding(nodes: BranchingNodeInput[]): BranchingNodeInput[] {
  if (nodes.length === 0 || nodes[0].node_type !== 'ending') return nodes;
  const firstContent = nodes.findIndex((n) => n.node_type !== 'ending');
  if (firstContent === -1) return nodes;

  return [nodes[firstContent], ...nodes.filter((_, i) => i !== firstContent)];
}

/** Make a step the one the scenario starts with. Endings cannot start a scenario. */
export function makeStart(s: BranchingScenarioSavePayload, ref: string): BranchingScenarioSavePayload {
  const node = s.nodes.find((n) => n.ref === ref);
  if (!node || node.node_type === 'ending' || s.nodes[0].ref === ref) return s;

  return { ...s, nodes: [node, ...s.nodes.filter((n) => n.ref !== ref)] };
}

/** Move a step up or down the outline. The start stays first. */
export function moveNode(s: BranchingScenarioSavePayload, ref: string, delta: -1 | 1): BranchingScenarioSavePayload {
  const from = s.nodes.findIndex((n) => n.ref === ref);
  const to = from + delta;
  if (from <= 0 || to < 1 || to >= s.nodes.length) return s;

  const nodes = [...s.nodes];
  [nodes[from], nodes[to]] = [nodes[to], nodes[from]];

  return { ...s, nodes };
}

export type LinkTarget = string | null | `new:${BsNodeType}`;

/**
 * Point a screen's "next" or a choice's destination at a step -- or at a NEW
 * one, created on the spot. Building a scenario is mostly following a link to
 * the thing that should come next, so making that a single action is the
 * difference between an editor and a form.
 */
export function link(
  s: BranchingScenarioSavePayload,
  from: { ref: string; choice?: number },
  target: LinkTarget
): { scenario: BranchingScenarioSavePayload; created: string | null } {
  let scenario = s;
  let created: string | null = null;
  let to: string | null = null;

  if (typeof target === 'string' && target.startsWith('new:')) {
    const made = addNode(scenario, target.slice(4) as BsNodeType);
    scenario = made.scenario;
    // addNode returns the last node's ref when the scenario is full; treat that as "nothing created".
    created = made.scenario === s ? null : made.ref;
    to = created;
  } else {
    to = target === '' ? null : target;
  }

  const set = from.choice === undefined
    ? (n: BranchingNodeInput) => ({ ...n, next_ref: to })
    : (n: BranchingNodeInput) => ({ ...n, options: n.options.map((o, i) => (i === from.choice ? { ...o, next_ref: to } : o)) });

  return { scenario: replaceNode(scenario, from.ref, set), created };
}

export function addChoice(s: BranchingScenarioSavePayload, ref: string): BranchingScenarioSavePayload {
  return replaceNode(s, ref, (n) => (n.options.length >= MAX_CHOICES ? n : { ...n, options: [...n.options, blankChoice()] }));
}

export function removeChoice(s: BranchingScenarioSavePayload, ref: string, index: number): BranchingScenarioSavePayload {
  return replaceNode(s, ref, (n) => (n.options.length <= MIN_CHOICES ? n : { ...n, options: n.options.filter((_, i) => i !== index) }));
}

export function moveChoice(s: BranchingScenarioSavePayload, ref: string, index: number, delta: -1 | 1): BranchingScenarioSavePayload {
  return replaceNode(s, ref, (n) => {
    const to = index + delta;
    if (to < 0 || to >= n.options.length) return n;
    const options = [...n.options];
    [options[index], options[to]] = [options[to], options[index]];

    return { ...n, options };
  });
}

// ---------------------------------------------------------------------------
// The story map
// ---------------------------------------------------------------------------

export interface MapPosition {
  ref: string;
  column: number;
  row: number;
}

export interface StoryMapLayout {
  positions: MapPosition[];
  columns: number;
  rows: number;
  edges: { from: string; to: string; choice: number | null }[];
  /** Steps nothing leads to, placed after the reachable ones. */
  unreachable: string[];
}

/**
 * Lay the steps out in columns by how far each is from the start (the longest
 * route, so a step that rejoins sits after everything that leads to it).
 *
 * A cycle cannot be laid out by depth, so a step reached again by a link that
 * goes backwards keeps the depth it first had; the edge is still drawn.
 */
export function storyMapLayout(s: BranchingScenarioSavePayload): StoryMapLayout {
  const byRef = new Map(s.nodes.map((n) => [n.ref, n]));
  const edges: StoryMapLayout['edges'] = [];
  for (const n of s.nodes) {
    if (n.node_type === 'text' && n.next_ref && byRef.has(n.next_ref)) edges.push({ from: n.ref, to: n.next_ref, choice: null });
    if (n.node_type === 'branching_question') {
      n.options.forEach((o, i) => {
        if (o.next_ref && byRef.has(o.next_ref)) edges.push({ from: n.ref, to: o.next_ref, choice: i });
      });
    }
  }

  const depth = new Map<string, number>();
  if (s.nodes.length > 0) {
    depth.set(s.nodes[0].ref, 0);
    // Relax edges until stable, capped so a cycle cannot loop forever.
    for (let pass = 0; pass < s.nodes.length + 1; pass++) {
      let changed = false;
      for (const e of edges) {
        const d = depth.get(e.from);
        if (d === undefined) continue;
        if ((depth.get(e.to) ?? -1) < d + 1 && d + 1 <= s.nodes.length) {
          depth.set(e.to, d + 1);
          changed = true;
        }
      }
      if (!changed) break;
    }
  }

  const reachable = s.nodes.filter((n) => depth.has(n.ref));
  const unreachable = s.nodes.filter((n) => !depth.has(n.ref)).map((n) => n.ref);
  const columns = reachable.length === 0 ? 0 : Math.max(...reachable.map((n) => depth.get(n.ref) as number)) + 1;
  const rowsUsed = new Map<number, number>();
  const positions: MapPosition[] = [];

  for (const n of reachable) {
    const column = depth.get(n.ref) as number;
    const row = rowsUsed.get(column) ?? 0;
    rowsUsed.set(column, row + 1);
    positions.push({ ref: n.ref, column, row });
  }
  unreachable.forEach((ref, i) => positions.push({ ref, column: columns, row: i }));

  const rows = Math.max(0, ...positions.map((p) => p.row + 1));

  return { positions, columns: columns + (unreachable.length > 0 ? 1 : 0), rows, edges, unreachable };
}
