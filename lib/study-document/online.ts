/**
 * What a study document offers online that a PDF cannot: cards to flip, steps to open one at a time, a diagram whose
 * parts can be selected, questions that are marked, a checklist to tick off.
 *
 * Every function here only RESHAPES what the document already holds into the shapes the study deck's shared interaction
 * views and question players already run (an items interaction, a hotspots interaction, a resolved bank activity). Nothing
 * is invented, nothing is written, and nothing here knows about React or the network, so each rule is testable with
 * node:test.
 */

import { activityKey } from '../study-deck/deck';
import type { DeckActivity, ItemsInteraction } from '../study-deck/types';
import { partByNumber, partForConcept, partLabel, partsOf } from './document';
import type {
  ActivityPart,
  BodyPart,
  ClinicPart,
  DiagnosticPart,
  DocumentPart,
  ExitPart,
  GlossaryPart,
  RemedialUnitPart,
  RevisionNotePart,
  RevisionTopicPart,
  StudyDocument,
} from './types';

// ---------------------------------------------------------------------------
// Revision notes: key terms and the checklist
// ---------------------------------------------------------------------------

export interface Flashcard {
  id: string;
  term: string;
  meaning: string;
  /** The part it comes from: the note, or the glossary. */
  part: number;
}

/** The glossary's terms that can be drawn as a card. The id is the glossary and the term's place in it. */
function glossaryCards(glossary: GlossaryPart): Flashcard[] {
  return glossary.content.terms.flatMap((t, index) =>
    t.term.trim() && t.meaning.trim() ? [{ id: `term:${glossary.n}:${index}`, term: t.term.trim(), meaning: t.meaning.trim(), part: glossary.n }] : []
  );
}

/**
 * The key terms as cards, in alphabetical order (the order of the PDF's key-terms table): the glossary's terms when the
 * document has a glossary, otherwise the definitions of the notes (the legacy design).
 */
export function flashcardsOf(doc: StudyDocument): Flashcard[] {
  if (doc.kind !== 'revision_notes') return [];
  const parts = partsOf(doc);
  const glossary = parts.find((part): part is GlossaryPart => part.type === 'glossary');
  const cards: Flashcard[] = [];
  if (glossary) {
    cards.push(...glossaryCards(glossary));
  } else {
    for (const note of parts) {
      if (note.type !== 'note') continue;
      const definition = note.content.definition;
      if (definition && definition.term.trim() && definition.text.trim()) {
        cards.push({ id: `term:${note.n}`, term: definition.term.trim(), meaning: definition.text.trim(), part: note.n });
      }
    }
  }

  return cards.sort((a, b) => a.term.localeCompare(b.term, 'en', { sensitivity: 'base' }));
}

export interface ChecklistItem {
  /** Stable for a document: the part and the item's position in it. */
  id: string;
  text: string;
  part: number;
  partTitle: string;
}

export interface ChecklistGroup {
  topicId: number | null;
  topic: string;
  items: ChecklistItem[];
}

/** The "I can ..." points of a note or a topic that have text, with the key each is ticked under (`check:<part>:<position>`). */
export function tickItemsOf(part: RevisionNotePart | RevisionTopicPart): Array<{ key: string; text: string }> {
  return part.content.checklist.flatMap((text, index) => (text.trim() ? [{ key: `check:${part.n}:${index}`, text: text.trim() }] : []));
}

/** "I can ..." points, grouped by topic in the outline's order (the PDF's checklist, made tickable). From the topics, or from the notes of a legacy document. */
export function checklistOf(doc: StudyDocument): ChecklistGroup[] {
  if (doc.kind !== 'revision_notes') return [];
  const byTopic = new Map<number | null, ChecklistItem[]>();
  for (const part of partsOf(doc)) {
    if (part.type !== 'note' && part.type !== 'topic') continue;
    for (const { key, text } of tickItemsOf(part)) {
      const list = byTopic.get(part.topic_id) ?? [];
      list.push({ id: key, text, part: part.n, partTitle: part.title });
      byTopic.set(part.topic_id, list);
    }
  }

  const groups: ChecklistGroup[] = [];
  for (const topic of doc.outline) {
    const items = byTopic.get(topic.topic_id);
    if (items) groups.push({ topicId: topic.topic_id, topic: topic.name, items });
  }
  // A note whose topic is not in the outline still gets its points shown.
  for (const [topicId, items] of byTopic) {
    if (!doc.outline.some((t) => t.topic_id === topicId)) groups.push({ topicId, topic: 'Other', items });
  }

  return groups;
}

// ---------------------------------------------------------------------------
// Remedial class: steps, the worked example, mistakes, guided practice
// ---------------------------------------------------------------------------

const ITEMS = { reason: '', wrapup: '' } as const;

/** The idea in small steps, opened one at a time. Null when the unit has none. */
export function stepsInteraction(unit: RemedialUnitPart): ItemsInteraction | null {
  const steps = unit.content.steps.filter((s) => s.label.trim() && s.text.trim());
  if (steps.length === 0) return null;

  return {
    kind: 'steps',
    ...ITEMS,
    intro: 'Open each step in order.',
    items: steps.map((s, i) => ({ id: s.id || `s${i + 1}`, label: s.label, text: s.text })),
  };
}

/** The worked example's steps, each with the reason for it, opened one at a time; the answer ends it. The problem itself is the stage's title. */
export function workedExampleInteraction(unit: RemedialUnitPart): ItemsInteraction | null {
  const we = unit.content.worked_example;
  if (!we || we.steps.length === 0) return null;

  return {
    kind: 'steps',
    ...ITEMS,
    intro: 'Open each step to see what to do, and why.',
    items: we.steps.map((s, i) => ({ id: `w${i + 1}`, label: `Step ${i + 1}`, text: s.why.trim() ? `${s.text} ${s.why}` : s.text })),
    wrapup: we.answer,
  };
}

/** A mistake, then why it does not hold and what is true instead: open the card to see both. */
export function mistakesInteraction(unit: RemedialUnitPart): ItemsInteraction | null {
  const mistakes = unit.content.mistakes.filter((m) => m.wrong_idea.trim());
  if (mistakes.length === 0) return null;

  return {
    kind: 'reveal',
    ...ITEMS,
    intro: 'Select a card to see why it does not hold.',
    items: mistakes.map((m, i) => ({ id: `m${i + 1}`, label: m.wrong_idea, text: `${m.why_wrong} ${m.correct_idea}`.trim() })),
  };
}

/** A note's "do not confuse": the wrong idea on the card, what is true when it is opened. Null when the note has none. */
export function noteMistakeInteraction(note: RevisionNotePart): ItemsInteraction | null {
  const m = note.content.misconception;
  if (!m || !m.wrong_idea.trim() || !m.correction.trim()) return null;

  return {
    kind: 'reveal',
    ...ITEMS,
    intro: 'Select the card to see what is true instead.',
    items: [{ id: 'm1', label: m.wrong_idea, text: m.correction }],
  };
}

/** A topic's mix-ups: the wrong idea on the card, what is true when it is opened. Null when the topic has none. */
export function topicMixupInteraction(topic: RevisionTopicPart): ItemsInteraction | null {
  const mixups = topic.content.mixups.filter((m) => m.wrong_idea.trim() && m.correct.trim());
  if (mixups.length === 0) return null;

  return {
    kind: 'reveal',
    ...ITEMS,
    intro: 'Select a card to see what is true instead.',
    items: mixups.map((m, i) => ({ id: `m${i + 1}`, label: m.wrong_idea, text: m.correct })),
  };
}

export interface ClinicCard {
  /** Stable for a document: the part and the item's position in it. Done when the card has been opened. */
  key: string;
  wrongIdea: string;
  whySeemsTrue: string;
  correction: string;
  checkIt: string;
  /** The unit that teaches the idea, or null. */
  unit: number | null;
}

/**
 * The clinic's ideas to judge, one card each. The learner decides whether the idea is right, then opens the card for why it
 * seems true, what is true, and a way to check it. An idea without a correction is left out: there would be nothing to open.
 *
 * Not an items interaction like the other mix-ups: each card carries three passages and a button to its unit, which the shared
 * cards (one short text each, fitted to a canvas) have no place for.
 */
export function clinicCardsOf(clinic: ClinicPart): ClinicCard[] {
  return clinic.content.items.flatMap((item, index) =>
    item.wrong_idea.trim() && item.correction.trim()
      ? [
          {
            key: `clinic:${clinic.n}:${index}`,
            wrongIdea: item.wrong_idea.trim(),
            whySeemsTrue: (item.why_it_seems_true ?? '').trim(),
            correction: item.correction.trim(),
            checkIt: (item.check_it ?? '').trim(),
            unit: typeof item.unit === 'number' ? item.unit : null,
          },
        ]
      : []
  );
}

export interface GuidedQuestion {
  key: string;
  level: number;
  label: string;
  hint: string;
  /** Why each wrong choice is wrong. Shown only after the question has been answered. */
  notOptions: Record<string, string>;
  activity: DeckActivity;
  /** Its position among the unit's activities, so the same key is used everywhere. */
  index: number;
}

/** The unit's practice in the order it rises: level 1 (with a hint) to level 3 (on your own). A question that is not in the unit's activities is dropped. */
export function guidedOf(unit: RemedialUnitPart): GuidedQuestion[] {
  const out: GuidedQuestion[] = [];
  for (const g of unit.content.guided) {
    const index = unit.activities.findIndex((a) => a.source === 'bank' && a.question_id === g.question_id);
    if (index < 0) continue;
    out.push({
      key: activityKey(unit, index),
      level: g.level,
      label: g.label,
      hint: g.hint,
      notOptions: g.not_options ?? {},
      activity: unit.activities[index],
      index,
    });
  }

  return out.sort((a, b) => a.level - b.level);
}

/** The "If that was hard" pointers, to parts that exist. */
export function followUpOf(doc: StudyDocument, unit: RemedialUnitPart): Array<{ part: number; name: string; why: string }> {
  return unit.content.follow_up
    .map((f) => ({ part: Number(f.section) || partForConcept(doc, f.concept_id) || 0, name: f.name, why: f.why }))
    .filter((f) => f.part > 0 && f.part < doc.sections.length);
}

/**
 * Pointers to unit parts ("take this unit if ..."), as buttons can open them. A number that is not a unit of this document is
 * dropped, so a button never leads nowhere (and never to the teacher guide).
 */
export function unitPointers(doc: StudyDocument, numbers: readonly number[]): Array<{ part: number; label: string }> {
  const out: Array<{ part: number; label: string }> = [];
  for (const n of new Set(numbers)) {
    const part = partByNumber(doc, n);
    if (part && part.type === 'unit') out.push({ part: n, label: partLabel(doc, part) });
  }

  return out;
}

/** The units to take when this diagnostic question is missed. The item is found by question, then by position (the items follow the questions' order). */
export function ifMissedFor(doc: StudyDocument, diagnostic: DiagnosticPart, activityIndex: number): Array<{ part: number; label: string }> {
  const questionId = diagnostic.activities[activityIndex]?.question_id;
  const item = diagnostic.content.items.find((i) => questionId !== null && i.question_id === questionId) ?? diagnostic.content.items[activityIndex];

  return unitPointers(doc, (item?.if_missed ?? []).map((m) => m.n));
}

/** "You are ready when you get 4 of 5 right." Null when the part does not say (or says something that cannot be true). */
export function readinessRule(exit: ExitPart): string | null {
  const { ready_at: readyAt, total } = exit.content;
  if (!Number.isInteger(readyAt) || !Number.isInteger(total) || readyAt < 1 || total < readyAt) return null;

  return `You are ready when you get ${readyAt} of ${total} right.`;
}

// ---------------------------------------------------------------------------
// Questions grouped by topic
// ---------------------------------------------------------------------------

export interface QuestionGroup {
  /** The topic's name, or null for questions whose topic is not known. */
  topic: string | null;
  /** Positions in the part's `activities`. */
  indexes: number[];
}

/**
 * A part's questions grouped by the topic of the concept each is about, in the outline's order. When they all sit under one
 * topic (or none can be placed) there is a single group with no name, and nothing is shown to split them.
 */
export function questionGroups(doc: StudyDocument, part: BodyPart): QuestionGroup[] {
  const byTopic = new Map<number | null, number[]>();
  part.activities.forEach((activity, index) => {
    const topicId = activity.concept_id === null ? null : doc.concepts[String(activity.concept_id)]?.topic_id ?? null;
    const key = doc.outline.some((t) => t.topic_id === topicId) ? topicId : null;
    byTopic.set(key, [...(byTopic.get(key) ?? []), index]);
  });

  const groups: QuestionGroup[] = [];
  for (const topic of doc.outline) {
    const indexes = byTopic.get(topic.topic_id);
    if (indexes) groups.push({ topic: topic.name, indexes });
  }
  const unplaced = byTopic.get(null);
  if (unplaced) groups.push({ topic: null, indexes: unplaced });

  return groups.length > 1 ? groups : [{ topic: null, indexes: part.activities.map((_, index) => index) }];
}

// ---------------------------------------------------------------------------
// Classroom activities: discussion, reflection
// ---------------------------------------------------------------------------

/** Discussion prompts with a possible answer for the teacher; the answer is shown on request, never marked. */
export function discussionOf(activity: ActivityPart): Array<{ id: string; prompt: string; answer: string }> {
  return activity.content.discussion.map((d, i) => ({ id: `d${i + 1}`, prompt: d.prompt, answer: d.answer }));
}

export function reflectionOf(activity: ActivityPart): Array<{ id: string; prompt: string }> {
  return activity.content.reflection.map((prompt, i) => ({ id: `r${i + 1}`, prompt }));
}

// ---------------------------------------------------------------------------
// What each part offers online
// ---------------------------------------------------------------------------

export type OnlineFeature =
  | 'diagram'
  | 'interaction'
  | 'questions'
  | 'steps'
  | 'worked_example'
  | 'mistakes'
  | 'term'
  | 'checklist'
  | 'discussion'
  | 'reflection'
  /** Text that is read here and answered nowhere (the table of likely gaps, the teacher guide). */
  | 'reading';

/**
 * The things a part has that work online, in the order they are shown. A part with none says so in the list (the PDF
 * still holds everything it says).
 *
 * A topic's table, comparison and recall points are shown whatever it holds, so they are not listed here; a diagnostic, a check,
 * an independent practice and an exit check are their questions.
 */
export function featuresOf(part: DocumentPart): OnlineFeature[] {
  const features: OnlineFeature[] = [];
  if (part.type === 'overview') return features;

  if (part.type === 'note') {
    if (part.content.definition) features.push('term');
    if (part.content.misconception) features.push('mistakes');
  }
  if (part.type === 'unit') {
    if (part.content.steps.length > 0) features.push('steps');
    if (part.content.worked_example && part.content.worked_example.steps.length > 0) features.push('worked_example');
    if (part.content.mistakes.length > 0) features.push('mistakes');
  }
  if (part.type === 'glossary' && glossaryCards(part).length > 0) features.push('term');
  if (part.image && part.interaction?.kind === 'hotspots') features.push('diagram');
  else if (part.interaction) features.push('interaction');
  // After the picture: look at the diagram first, then at what people get wrong about it.
  if (part.type === 'topic' && topicMixupInteraction(part)) features.push('mistakes');
  if (part.type === 'clinic' && clinicCardsOf(part).length > 0) features.push('mistakes');
  if (part.activities.length > 0) features.push('questions');
  if (part.type === 'activity' && part.content.discussion.length > 0) features.push('discussion');
  if (part.type === 'activity' && part.content.reflection.length > 0) features.push('reflection');
  if ((part.type === 'note' || part.type === 'topic') && tickItemsOf(part).length > 0) features.push('checklist');
  if (part.type === 'gaps' && (part.content.rows.length > 0 || part.content.others.length > 0)) features.push('reading');
  if (part.type === 'teacher') features.push('reading');

  return features;
}

export interface ProgressCount {
  done: number;
  total: number;
}

/**
 * How much of a part's online work is done, from the keys the learner has finished. A feature that is only read (a term, a
 * mistake) is done when it has been opened.
 */
export function partProgress(part: DocumentPart, done: ReadonlySet<string>): ProgressCount {
  let total = 0;
  let count = 0;
  const tally = (key: string) => {
    total += 1;
    if (done.has(key)) count += 1;
  };

  part.activities.forEach((_, index) => tally(activityKey(part, index)));
  if (part.interaction) tally(interactionDoneKey(part));
  if (part.type === 'unit') {
    if (part.content.steps.length > 0) tally(stepsKey(part));
    if (part.content.worked_example) tally(exampleKeyOf(part));
    if (part.content.mistakes.length > 0) tally(mistakesKey(part));
  }
  if (part.type === 'note') {
    if (part.content.definition) tally(termKey(part));
    if (part.content.misconception) tally(mistakesKey(part));
  }
  if (part.type === 'topic' && topicMixupInteraction(part)) tally(mistakesKey(part));
  if (part.type === 'note' || part.type === 'topic') tickItemsOf(part).forEach((item) => tally(item.key));
  if (part.type === 'glossary') glossaryCards(part).forEach((card) => tally(card.id));
  if (part.type === 'clinic') clinicCardsOf(part).forEach((card) => tally(card.key));

  return { done: count, total };
}

export const interactionDoneKey = (part: Pick<DocumentPart, 'n'>): string => `ix:${part.n}`;
export const stepsKey = (part: Pick<DocumentPart, 'n'>): string => `steps:${part.n}`;
export const exampleKeyOf = (part: Pick<DocumentPart, 'n'>): string => `example:${part.n}`;
export const mistakesKey = (part: Pick<DocumentPart, 'n'>): string => `mistakes:${part.n}`;
export const termKey = (part: Pick<DocumentPart, 'n'>): string => `term:${part.n}`;
