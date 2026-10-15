/**
 * The three student experiences of a study document, as rules.
 *
 * A revision notebook, a guided remedial journey and an activity workspace are three ways of walking the SAME stored
 * document: nothing here adds content. This module says which stage of a workflow each block of a part belongs to, which
 * keys finish a block, how a missed diagnostic question routes to a unit, and how an exit check or an activity is judged
 * finished. React and the network stay out of it so every rule is testable with node:test.
 */

import { activityKey } from '../study-deck/deck';
import { THEMES, type StageTheme } from '../study-deck/theme';
import { clinicCardsOf, exampleKeyOf, guidedOf, ifMissedFor, interactionDoneKey, mistakesKey, stepsKey, termKey, tickItemsOf, unitPointers } from './online';
import { partsOf } from './document';
import { playsOf, playKey, type PlayKind } from './play';
import type { ActivityPart, BodyPart, DiagnosticPart, DocumentKind, DocumentPart, ExitPart, StudyDocument } from './types';

// ---------------------------------------------------------------------------
// Identity and workflow of each experience
// ---------------------------------------------------------------------------

export interface WorkflowStep {
  id: string;
  label: string;
  /** What the learner does in this step, in a few words. */
  does: string;
}

export interface Journey {
  kind: DocumentKind;
  /** Name of the experience as the learner sees it. */
  name: string;
  tagline: string;
  /** The colour family; the study deck's own interaction views take their colours from it. */
  theme: StageTheme;
  workflow: readonly WorkflowStep[];
}

export const JOURNEYS: Record<DocumentKind, Journey> = {
  revision_notes: {
    kind: 'revision_notes',
    name: 'Revision notebook',
    tagline: 'Read it, explore it, recall it, check it.',
    theme: THEMES.amber,
    workflow: [
      { id: 'read', label: 'Read', does: 'Read the notes and tables' },
      { id: 'explore', label: 'Explore', does: 'Select parts of the diagram' },
      { id: 'recall', label: 'Recall', does: 'Turn cards and test the mix-ups' },
      { id: 'check', label: 'Check', does: 'Answer questions and read why' },
    ],
  },
  remedial: {
    kind: 'remedial',
    name: 'Guided learning journey',
    tagline: 'Find the gap, learn it step by step, practise with less and less help.',
    theme: THEMES.teal,
    workflow: [
      { id: 'diagnose', label: 'Diagnose', does: 'Answer a few questions to find the gaps' },
      { id: 'learn', label: 'Learn', does: 'Go through a unit step by step' },
      { id: 'hints', label: 'Get hints', does: 'Practise with a hint to hand' },
      { id: 'practise', label: 'Practise', does: 'Practise on your own' },
      { id: 'master', label: 'Master', does: 'Take the exit check' },
    ],
  },
  activities: {
    kind: 'activities',
    name: 'Activity workspace',
    tagline: 'Pick an activity, predict, do it, record what you see, talk it through.',
    theme: THEMES.purple,
    workflow: [
      { id: 'choose', label: 'Choose', does: 'Pick an activity' },
      { id: 'predict', label: 'Predict', does: 'Say what you think will happen' },
      { id: 'perform', label: 'Perform', does: 'Do the task' },
      { id: 'record', label: 'Record', does: 'Write what you saw' },
      { id: 'discuss', label: 'Discuss', does: 'Explain it and reflect' },
    ],
  },
};

// ---------------------------------------------------------------------------
// Blocks of a part, and the stage of a workflow each belongs to
// ---------------------------------------------------------------------------

/** The pieces `PartPanel` can show for a part. A stage shows some of them. */
export type BlockId =
  | 'figure'
  | 'prereq'
  | 'tables'
  | 'criteria'
  | 'terms'
  | 'mistakes'
  | 'steps'
  | 'example'
  | 'explore'
  | 'questions'
  | 'checklist'
  | 'play'
  | 'reading'
  | 'after';

export type RevisionStage = 'read' | 'explore' | 'recall' | 'check';
export type RemedialStage = 'diagnose' | 'learn' | 'hints' | 'practise' | 'master';

export const REVISION_BLOCKS: Record<RevisionStage, readonly BlockId[]> = {
  read: ['figure', 'tables'],
  explore: ['explore'],
  recall: ['mistakes', 'terms', 'play', 'checklist'],
  check: ['questions'],
};

/** The blocks of a remedial unit in its Learn stage; its questions are split between Hints and Practise by level (see `levelsFor`). */
export const UNIT_LEARN_BLOCKS: readonly BlockId[] = ['prereq', 'figure', 'steps', 'example', 'mistakes', 'explore', 'after'];

/** Which guided levels each remedial stage asks: level 1 and 2 are given a hint, level 3 is on your own. */
export const HINT_LEVELS: readonly number[] = [1, 2];
export const SOLO_LEVELS: readonly number[] = [3];

/** Which practice activities a remedial stage gives: the word bank in Get hints, the same gaps typed (and true or false) in Practise. */
export const HINT_PLAYS: readonly PlayKind[] = ['words'];
export const SOLO_PLAYS: readonly PlayKind[] = ['blanks', 'truefalse'];

/** The keys of a part's practice activities (fill in the blanks, drag the words, true or false, sort), of the kinds asked for. */
export function playKeysOf(doc: StudyDocument, part: BodyPart, kinds?: readonly PlayKind[]): string[] {
  return playsOf(doc, part)
    .filter((p) => !kinds || kinds.includes(p.kind))
    .map((p) => playKey(part, p.kind));
}

/** The done-keys that finish one block of a part. Empty when the part has no such block, or the block is only read. */
export function blockKeys(part: BodyPart, block: BlockId, levels?: readonly number[], doc?: StudyDocument): string[] {
  switch (block) {
    case 'play':
      return doc ? playKeysOf(doc, part) : [];
    case 'explore':
      return [...(part.interaction ? [interactionDoneKey(part)] : []), ...(doc && conceptMapOf(doc, part) ? [mapKey(part)] : [])];
    case 'mistakes':
      if (part.type === 'clinic') return clinicCardsOf(part).map((c) => c.key);
      if (part.type === 'unit' && part.content.mistakes.length > 0) return [mistakesKey(part)];
      if (part.type === 'note' && part.content.misconception) return [mistakesKey(part)];
      if (part.type === 'topic' && part.content.mixups.some((m) => m.wrong_idea.trim() && m.correct.trim())) return [mistakesKey(part)];
      return [];
    case 'terms':
      if (part.type === 'note' && part.content.definition) return [termKey(part)];
      return [];
    case 'steps':
      return part.type === 'unit' && part.content.steps.length > 0 ? [stepsKey(part)] : [];
    case 'example':
      return part.type === 'unit' && part.content.worked_example && part.content.worked_example.steps.length > 0 ? [exampleKeyOf(part)] : [];
    case 'checklist':
      return part.type === 'note' || part.type === 'topic' ? tickItemsOf(part).map((i) => i.key) : [];
    case 'questions':
      return questionKeys(part, levels);
    default:
      return [];
  }
}

/**
 * The keys of a part's questions. For a unit, `levels` picks the practice of those guided levels; a unit's question that has no
 * guided level counts as independent (level 3).
 */
export function questionKeys(part: BodyPart, levels?: readonly number[]): string[] {
  if (part.type !== 'unit' || !levels) return part.activities.map((_, i) => activityKey(part, i));
  const guided = guidedOf(part);
  const level = new Map(guided.map((g) => [g.key, g.level]));

  return part.activities.map((_, i) => activityKey(part, i)).filter((key) => levels.includes(level.get(key) ?? 3));
}

export interface StageProgress {
  done: number;
  total: number;
}

/** How much of a stage (a set of blocks) is done. Total 0 means the stage has nothing to do for this part. */
export function stageProgress(part: BodyPart, blocks: readonly BlockId[], done: ReadonlySet<string>, levels?: readonly number[], doc?: StudyDocument): StageProgress {
  const keys = blocks.flatMap((b) => blockKeys(part, b, levels, doc));

  return { done: keys.filter((k) => done.has(k)).length, total: keys.length };
}

/** A part's whole online work, as `partProgress` counts it, with a share (0 to 100) for a progress bar. */
export function share(p: StageProgress): number {
  return p.total === 0 ? 0 : Math.round((p.done / p.total) * 100);
}

// ---------------------------------------------------------------------------
// What a question reported: right or not
// ---------------------------------------------------------------------------

export const okKey = (key: string): string => `ok:${key}`;
export const missKey = (key: string): string => `miss:${key}`;

/**
 * The progress actions that record one reported result: the question is done, and it is remembered as right or not right.
 * A written answer is not marked by anyone, so it is done but neither right nor not right.
 */
export function resultActions(key: string, marked: boolean, correct: boolean): Array<{ type: 'done' | 'undone'; key: string }> {
  if (!marked) return [{ type: 'done', key }];

  return [
    { type: 'done', key },
    { type: correct ? 'done' : 'undone', key: okKey(key) },
    { type: correct ? 'undone' : 'done', key: missKey(key) },
  ];
}

/** The progress actions that forget an answer so the question can be tried again: not done, and neither right nor not right. */
export function retryActions(key: string): Array<{ type: 'undone'; key: string }> {
  return [{ type: 'undone', key }, { type: 'undone', key: okKey(key) }, { type: 'undone', key: missKey(key) }];
}

// ---------------------------------------------------------------------------
// Remedial: where a missed question sends a learner
// ---------------------------------------------------------------------------

/** The diagnostic part of a remedial class, or null. */
export function diagnosticOf(doc: StudyDocument): DiagnosticPart | null {
  return partsOf(doc).find((p): p is DiagnosticPart => p.type === 'diagnostic') ?? null;
}

/** The unit parts to take, from the diagnostic questions answered wrongly. */
export function recommendedUnits(doc: StudyDocument, done: ReadonlySet<string>): number[] {
  const diagnostic = diagnosticOf(doc);
  if (!diagnostic) return [];
  const units: number[] = [];
  diagnostic.activities.forEach((_, index) => {
    if (!done.has(missKey(activityKey(diagnostic, index)))) return;
    for (const p of ifMissedFor(doc, diagnostic, index)) if (!units.includes(p.part)) units.push(p.part);
  });

  return units;
}

export interface DiagnosticSummary {
  answered: number;
  total: number;
  /** Answered wrongly. */
  missed: number;
}

export function diagnosticSummary(doc: StudyDocument, done: ReadonlySet<string>): DiagnosticSummary {
  const diagnostic = diagnosticOf(doc);
  if (!diagnostic) return { answered: 0, total: 0, missed: 0 };
  const keys = diagnostic.activities.map((_, i) => activityKey(diagnostic, i));

  return { answered: keys.filter((k) => done.has(k)).length, total: keys.length, missed: keys.filter((k) => done.has(missKey(k))).length };
}

export interface ExitVerdict {
  total: number;
  answered: number;
  right: number;
  /** Answered, but not marked by anyone (a written answer). */
  unmarked: number;
  /** null until every question is answered, and when the part states no valid rule. */
  ready: boolean | null;
  /** Units to go back to when not ready. */
  revisit: Array<{ part: number; label: string }>;
}

/**
 * Whether the exit check was passed, by the part's own rule (`ready_at` of `total` right). It says nothing until every
 * question has been answered, and written answers (which no one marks) are counted apart rather than as right.
 */
export function exitVerdict(doc: StudyDocument, exit: ExitPart, done: ReadonlySet<string>): ExitVerdict {
  const keys = exit.activities.map((_, i) => activityKey(exit, i));
  const answered = keys.filter((k) => done.has(k)).length;
  const right = keys.filter((k) => done.has(okKey(k))).length;
  const unmarked = keys.filter((k) => done.has(k) && !done.has(okKey(k)) && !done.has(missKey(k))).length;
  const { ready_at: readyAt, total } = exit.content;
  const ruleOk = Number.isInteger(readyAt) && Number.isInteger(total) && readyAt >= 1 && total >= readyAt && keys.length > 0;
  const finished = answered === keys.length && keys.length > 0;
  let ready: boolean | null = null;
  if (ruleOk && finished && unmarked === 0) ready = right >= Math.min(readyAt, keys.length);

  return {
    total: keys.length,
    answered,
    right,
    unmarked,
    ready,
    revisit: ready === false ? unitPointers(doc, exit.content.revisit.map((r) => r.n)) : [],
  };
}

// ---------------------------------------------------------------------------
// Activities: predict, perform, record, discuss
// ---------------------------------------------------------------------------

export type ActivityStep = 'predict' | 'perform' | 'record' | 'discuss';
export const ACTIVITY_STEPS: readonly ActivityStep[] = ['predict', 'perform', 'record', 'discuss'];

export const activityStepKey = (part: Pick<ActivityPart, 'n'>, step: ActivityStep): string => `act:${part.n}:${step}`;
/** A "what you do" instruction ticked off. */
export const performKey = (part: Pick<ActivityPart, 'n'>, index: number): string => `act:${part.n}:do:${index}`;
/** The note key for what a learner wrote under a slot of a step (`predict` or `observe`). Short, so it fits the notes' key limit. */
export const slotNoteKey = (part: Pick<ActivityPart, 'n'>, kind: 'predict' | 'observe', slot: string): string => `${part.n}:${kind}:${slot}`;

/**
 * What a learner is asked to predict and record. An activity that compares things side by side (the two potato pieces) asks
 * about each of them by name; any other activity asks one question. The wording comes from the activity's own labels.
 */
export function slotsOf(part: ActivityPart): Array<{ id: string; label: string }> {
  const ix = part.interaction;
  if (ix && ix.kind === 'compare') {
    const items = ix.items.filter((i) => i.label.trim());
    if (items.length >= 2) return items.map((i) => ({ id: i.id, label: i.label.trim() }));
  }

  return [{ id: 'all', label: '' }];
}

/** An interaction that is something to DO (match, order, a scenario to decide) is done in Perform; one that explains the result is Discuss. */
export function interactionStepOf(part: ActivityPart): ActivityStep {
  const kind = part.interaction?.kind;

  return kind === 'match' || kind === 'order' || kind === 'scenario' ? 'perform' : 'discuss';
}

export type ActivityStatus = 'not_started' | 'in_progress' | 'done';

/** The tick for one material to gather. */
export const materialKey = (part: Pick<ActivityPart, 'n'>, index: number): string => `act:${part.n}:mat:${index}`;
/** The learner's choice between a wrong idea and the correction, remembered as right (`ok:`) or not (`miss:`). */
export const pickKey = (part: Pick<ActivityPart, 'n'>): string => `act:${part.n}:pick`;

/** Perform is done when every instruction is ticked and, if the task is an interaction to do, it has been done. */
export function performDone(part: ActivityPart, done: ReadonlySet<string>): boolean {
  const steps = part.content.student_steps.filter((t) => t.trim());
  const ticked = steps.every((_, i) => done.has(performKey(part, i)));
  const task = part.interaction && interactionStepOf(part) === 'perform' ? done.has(interactionDoneKey(part)) : true;

  return (steps.length > 0 || part.interaction !== null) && ticked && task;
}

/** Which of the four steps are finished. Predict, Record and Discuss are finished by the learner saying so; Perform by doing. */
export function activitySteps(part: ActivityPart, done: ReadonlySet<string>): Record<ActivityStep, boolean> {
  return {
    predict: done.has(activityStepKey(part, 'predict')),
    perform: performDone(part, done),
    record: done.has(activityStepKey(part, 'record')),
    discuss: done.has(activityStepKey(part, 'discuss')),
  };
}

export function activityStatus(part: ActivityPart, done: ReadonlySet<string>): { status: ActivityStatus; steps: number; of: number } {
  const finished = ACTIVITY_STEPS.filter((s) => activitySteps(part, done)[s]).length;

  return { status: finished === ACTIVITY_STEPS.length ? 'done' : finished > 0 ? 'in_progress' : 'not_started', steps: finished, of: ACTIVITY_STEPS.length };
}

/** Everything a revision topic or a remedial unit lists, as one count, so a topic can be called complete. */
export function partComplete(part: DocumentPart, done: ReadonlySet<string>): boolean {
  if (part.type === 'overview') return false;
  const keys = (['explore', 'mistakes', 'terms', 'steps', 'example', 'checklist', 'questions'] as const).flatMap((b) => blockKeys(part, b));

  return keys.length > 0 && keys.every((k) => done.has(k));
}

// ---------------------------------------------------------------------------
// Revision notes: how the ideas of a topic depend on each other
// ---------------------------------------------------------------------------

/** The key under which a topic's concept map is marked explored. */
export const mapKey = (part: Pick<BodyPart, 'n'>): string => `map:${part.n}`;

export interface MapNode {
  conceptId: number;
  name: string;
  essential: string;
  /** 0 for an idea that needs none of the others in the topic; one more than the deepest idea it needs otherwise. */
  depth: number;
}

export interface ConceptMap {
  nodes: MapNode[];
  /** `from` is needed to understand `to`. */
  edges: Array<{ from: number; to: number }>;
  depths: number;
}

/**
 * The ideas of a topic and which of them are needed to understand which, from the concepts' own `requires`. Only ideas of this
 * topic are drawn, and a map with no link between two of them is not offered (a row of boxes shows nothing).
 */
export function conceptMapOf(doc: StudyDocument, part: BodyPart): ConceptMap | null {
  if (part.type !== 'topic') return null;
  const rows = part.content.rows.filter((r, i, all) => all.findIndex((x) => x.concept_id === r.concept_id) === i);
  const ids = new Set(rows.map((r) => r.concept_id));
  const needs = new Map<number, number[]>();
  for (const r of rows) needs.set(r.concept_id, (doc.concepts[String(r.concept_id)]?.requires ?? []).filter((id) => ids.has(id) && id !== r.concept_id));
  const edges = Array.from(needs.entries()).flatMap(([to, from]) => from.map((f) => ({ from: f, to })));
  if (edges.length === 0) return null;

  const depth = new Map<number, number>();
  const visiting = new Set<number>();
  const depthOf = (id: number): number => {
    const known = depth.get(id);
    if (known !== undefined) return known;
    // A cycle in the data must not hang the page: an idea met again while it is being worked out counts as depth 0.
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const d = Math.max(-1, ...(needs.get(id) ?? []).map(depthOf)) + 1;
    visiting.delete(id);
    depth.set(id, d);

    return d;
  };

  const nodes = rows.map((r) => ({ conceptId: r.concept_id, name: r.name, essential: r.essential, depth: depthOf(r.concept_id) }));

  return { nodes, edges, depths: Math.max(...nodes.map((n) => n.depth)) + 1 };
}
