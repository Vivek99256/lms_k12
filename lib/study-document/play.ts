/**
 * Four more ways to practise, built from what a stored study document already says.
 *
 * Fill in the blanks, Drag the words, True or false and Drag and drop (sort into groups) are the H5P-style activities the
 * documents did not offer: the pipeline asks the question bank for each question's own form (this chapter's bank has no
 * true/false, matching or drag-and-drop rows and only one blank), and a part carries one authored interaction. The material for
 * all four is already in the document: sentences that name a key term, comparison tables, wrong ideas with their corrections,
 * concept definitions. This module only RESHAPES that material, as `online.ts` does for cards and steps. Nothing is invented:
 *
 *   blanks / words  a sentence of the document with one of its own key terms taken out
 *   truefalse       a wrong idea of the document (false) or a statement of the document (true), or a comparison row said of
 *                   the column it belongs to (true) or of the other column (false, only when the two cells really differ)
 *   sort            the cells of a comparison table, to be dropped under the column they belong to
 *
 * No React, no storage and no randomness (shuffling is the caller's, seeded), so every rule is testable with node:test.
 */

import { partsOf } from './document';
import type { DeckInteraction, ItemsInteraction } from '../study-deck/types';
import type { ActivityPart, BodyPart, DocumentPart, RemedialUnitPart, StudyDocument } from './types';

export type PlayKind = 'blanks' | 'words' | 'truefalse' | 'sort';

export interface Cloze {
  id: string;
  /** The sentence in three pieces; the answer sits between `before` and `after`. */
  before: string;
  answer: string;
  after: string;
}

export interface ClozePlay {
  kind: 'blanks' | 'words';
  items: Cloze[];
}

export interface TrueFalseItem {
  id: string;
  statement: string;
  truth: boolean;
  /** What is true, said after the learner has answered. */
  why: string;
}

export interface TrueFalsePlay {
  kind: 'truefalse';
  items: TrueFalseItem[];
}

export interface SortPlay {
  kind: 'sort';
  title: string;
  buckets: string[];
  items: Array<{ id: string; text: string; bucket: number }>;
}

export type Play = ClozePlay | TrueFalsePlay | SortPlay;

/** The key under which a play is marked done. */
export const playKey = (part: Pick<DocumentPart, 'n'>, kind: PlayKind): string => `play:${part.n}:${kind}`;

const STOP = new Set(['about', 'across', 'after', 'again', 'also', 'because', 'before', 'between', 'cells', 'cell', 'during', 'every', 'other', 'which', 'their', 'there', 'these', 'those', 'through', 'under', 'where', 'while', 'with', 'without', 'within', 'versus', 'from', 'into', 'than', 'that', 'this', 'when', 'what', 'have', 'being', 'usually', 'called']);

const squash = (s: string): string => s.replace(/\s+/g, ' ').trim();
const norm = (s: string): string => squash(s).toLowerCase().replace(/[^a-z0-9µ ]+/g, '');
const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const words = (s: string): number => squash(s).split(' ').filter(Boolean).length;

/** The sentences of a passage. A full stop inside a number ("0.1 mm") or after a single capital does not end one. */
export function sentencesOf(text: string): string[] {
  return squash(text)
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * A word the chapter itself treats as a term: a word of a concept's name (concept names are the chapter's own vocabulary), six
 * letters or more, that is not an ordinary word. Used when a part names no terms of its own.
 */
export function conceptTerms(doc: StudyDocument): string[] {
  return conceptTermsFrom(doc.concepts);
}

/** `conceptTerms` for any map of concepts with names: a study document's, or a presentation's. */
export function conceptTermsFrom(concepts: Record<string, { name: string }>): string[] {
  const out = new Set<string>();
  for (const c of Object.values(concepts)) {
    for (const w of c.name.split(/[^A-Za-zµ-]+/)) {
      const t = w.replace(/^-+|-+$/g, '');
      if (t.length >= 6 && !STOP.has(t.toLowerCase())) out.add(t);
    }
  }

  return Array.from(out);
}

/**
 * Sentences with one term each taken out. A term must be written in the sentence as a whole word or phrase, once, and not at
 * its very start (a gap needs something in front of it to be read). The longest such term wins, so a phrase beats one of its words.
 * A sentence of fewer than 6 or more than 40 words is not used, and no answer is used twice.
 */
export function clozeFrom(sentences: Array<{ id: string; text: string; terms: string[] }>, limit = 5): Cloze[] {
  const out: Cloze[] = [];
  const used = new Set<string>();
  for (const s of sentences) {
    const text = squash(s.text);
    const n = words(text);
    if (n < 6 || n > 40) continue;
    const candidates = Array.from(new Set(s.terms.map(squash))).filter((t) => t.length >= 3 && !used.has(norm(t))).sort((a, b) => b.length - a.length);
    for (const term of candidates) {
      const re = new RegExp(`(?<![A-Za-z0-9])${escapeRe(term)}(?![A-Za-z0-9])`, 'gi');
      const hits = Array.from(text.matchAll(re));
      if (hits.length !== 1) continue;
      const at = hits[0].index ?? 0;
      if (at < 3) continue;
      out.push({ id: s.id, before: text.slice(0, at), answer: text.slice(at, at + term.length), after: text.slice(at + term.length) });
      used.add(norm(term));
      break;
    }
    if (out.length >= limit) break;
  }

  return out;
}

/** Whether a typed answer is the answer: same letters ignoring case, spacing and punctuation at the ends. */
export function sameAnswer(typed: string, answer: string): boolean {
  const a = norm(typed);

  return a !== '' && a === norm(answer);
}

/** The first letter of each word, then dots: the hint for a blank. */
export function firstLetters(answer: string): string {
  return squash(answer)
    .split(' ')
    .map((w) => `${w.slice(0, 1)}${'·'.repeat(Math.max(w.length - 1, 0))}`)
    .join(' ');
}

// ---------------------------------------------------------------------------
// What each kind of part can offer
// ---------------------------------------------------------------------------

const firstSentence = (text: string): string => sentencesOf(text)[0] ?? '';

/**
 * A comparison table said row by row. Of four rows in turn: a cell said of its own column (true), a cell said of the other
 * column (false), the other column's cell of its own (true), and that cell said of the first column (false). A row whose two
 * cells are the same is skipped, because a false statement could not be made from it.
 */
function compareStatements(part: Extract<BodyPart, { type: 'topic' }>): TrueFalseItem[] {
  const c = part.content.compare;
  if (!c || c.columns.length < 3) return [];
  const [, first, second] = c.columns.map(squash);
  const out: TrueFalseItem[] = [];
  c.rows.forEach((row, i) => {
    const label = squash(row[0] ?? '').toLowerCase();
    const a = squash(row[1] ?? '');
    const b = squash(row[2] ?? '');
    if (!label || !a || !b || norm(a) === norm(b)) return;
    const said = (column: string, cell: string) => `${column}: ${label} — ${cell}`;
    const real = `${first}: ${label} — ${a}. ${second}: ${label} — ${b}.`;
    const kind = i % 4;
    if (kind === 0) out.push({ id: `cmp${i}`, statement: said(first, a), truth: true, why: `Yes. ${real}` });
    else if (kind === 1) out.push({ id: `cmp${i}`, statement: said(second, a), truth: false, why: `No. ${real}` });
    else if (kind === 2) out.push({ id: `cmp${i}`, statement: said(second, b), truth: true, why: `Yes. ${real}` });
    else out.push({ id: `cmp${i}`, statement: said(first, b), truth: false, why: `No. ${real}` });
  });

  return out;
}

/**
 * Two things compared side by side (the two potato pieces, plain water and sugar solution) said once of the thing they belong to
 * (true) and once of the other (false). Only the first sentence of each is used, and only when the two sentences differ, so a
 * false statement is always the other item's real sentence. Nothing is invented.
 */
export function compareItemStatements(interaction: DeckInteraction | null | undefined): TrueFalseItem[] {
  if (!interaction || interaction.kind !== 'compare') return [];
  const [a, b] = (interaction as ItemsInteraction).items;
  if (!a || !b || (interaction as ItemsInteraction).items.length !== 2) return [];
  const sa = firstSentence(a.text);
  const sb = firstSentence(b.text);
  if (!a.label.trim() || !b.label.trim() || !sa || !sb || norm(sa) === norm(sb) || words(sa) > 40 || words(sb) > 40) return [];
  const real = `${squash(a.label)}: ${sa} ${squash(b.label)}: ${sb}`;

  return [
    { id: 'ca', statement: `${squash(a.label)}: ${sa}`, truth: true, why: `Yes. ${real}` },
    { id: 'cb', statement: `${squash(a.label)}: ${sb}`, truth: false, why: `No. ${real}` },
    { id: 'cc', statement: `${squash(b.label)}: ${sb}`, truth: true, why: `Yes. ${real}` },
  ];
}

/** The comparison table as groups: each cell goes under the column it belongs to. */
function sortFrom(part: Extract<BodyPart, { type: 'topic' }>): SortPlay | null {
  const c = part.content.compare;
  if (!c || c.columns.length < 3) return null;
  const buckets = c.columns.slice(1).map(squash);
  const items: SortPlay['items'] = [];
  const seen = new Set<string>();
  c.rows.forEach((row, i) => {
    const cells = buckets.map((_, j) => squash(row[j + 1] ?? ''));
    if (!row[0] || cells.some((x) => !x) || new Set(cells.map(norm)).size !== cells.length) return;
    cells.forEach((cell, j) => {
      const text = `${row[0]}: ${cell}`;
      if (seen.has(norm(text))) return;
      seen.add(norm(text));
      items.push({ id: `s${i}-${j}`, text, bucket: j });
    });
  });

  return items.length >= 4 && buckets.length >= 2 ? { kind: 'sort', title: c.title, buckets, items: items.slice(0, 8) } : null;
}

function unitSentences(unit: RemedialUnitPart): Array<{ id: string; text: string }> {
  return [
    ...sentencesOf(unit.content.simple_explanation).map((text, i) => ({ id: `e${i}`, text })),
    ...unit.content.steps.map((s, i) => ({ id: `t${i}`, text: s.text })),
  ];
}

/**
 * The plays a part offers, in the order they are shown. A play needs at least three items (two for an activity, which
 * says less) or it is not offered: a game of one sentence is not a game.
 */
export function playsOf(doc: StudyDocument, part: BodyPart): Play[] {
  const plays: Play[] = [];
  const glossary = partsOf(doc).find((p) => p.type === 'glossary');
  const glossaryTerms = glossary && glossary.type === 'glossary' ? glossary.content.terms.map((t) => t.term) : [];
  const vocabulary = conceptTerms(doc);

  if (part.type === 'topic') {
    const sentences = part.content.rows.map((r, i) => ({ id: `r${i}`, text: r.essential, terms: [...r.terms, ...glossaryTerms, ...vocabulary] }));
    const all = clozeFrom(sentences, 8);
    if (all.length >= 6) {
      plays.push({ kind: 'blanks', items: all.slice(0, Math.ceil(all.length / 2)) }, { kind: 'words', items: all.slice(Math.ceil(all.length / 2), Math.ceil(all.length / 2) + 4) });
    } else if (all.length >= 3) plays.push({ kind: 'blanks', items: all });
    const tf: TrueFalseItem[] = [
      ...part.content.mixups.filter((m) => m.wrong_idea.trim() && m.correct.trim()).map((m, i) => ({ id: `m${i}`, statement: squash(m.wrong_idea), truth: false, why: `No. ${squash(m.correct)}` })),
      ...compareStatements(part),
    ];
    if (tf.length >= 3) plays.push({ kind: 'truefalse', items: tf.slice(0, 6) });
    const sort = sortFrom(part);
    if (sort) plays.push(sort);
  }

  if (part.type === 'unit') {
    const terms = [...vocabulary, ...glossaryTerms];
    const cloze = clozeFrom(unitSentences(part).map((s) => ({ ...s, terms })), 6);
    if (cloze.length >= 3) plays.push({ kind: 'words', items: cloze.slice(0, 3) }, { kind: 'blanks', items: cloze.slice(3).length >= 2 ? cloze.slice(3) : cloze.slice(0, 3) });
    const clinic = partsOf(doc).find((p) => p.type === 'clinic');
    const mine = new Set(part.concept_ids);
    const wrong = clinic && clinic.type === 'clinic' ? clinic.content.items.filter((i) => mine.has(i.concept_id) && i.wrong_idea.trim() && i.correction.trim()) : [];
    const items: TrueFalseItem[] = [
      ...wrong.map((i, k) => ({ id: `c${k}`, statement: squash(i.wrong_idea), truth: false, why: `No. ${squash(i.correction)}` })),
      ...part.concept_ids.flatMap((id) => {
        const def = firstSentence(doc.concepts[String(id)]?.definition ?? '');
        return def && words(def) <= 40 ? [{ id: `d${id}`, statement: def, truth: true, why: 'Yes, this is what the chapter says.' }] : [];
      }),
    ];
    if (items.length >= 2) plays.push({ kind: 'truefalse', items: items.slice(0, 5) });
  }

  if (part.type === 'activity') {
    const a: ActivityPart = part;
    const terms = [...vocabulary, ...glossaryTerms];
    const cloze = clozeFrom(a.content.expected_outcomes.map((text, i) => ({ id: `x${i}`, text, terms })), 4);
    if (cloze.length >= 2) plays.push({ kind: 'words', items: cloze });
    const m = a.content.misconception;
    const statements: TrueFalseItem[] = [
      ...(m && m.wrong_idea.trim() && m.correction.trim() ? [{ id: 'w', statement: squash(m.wrong_idea), truth: false, why: `No. ${squash(m.correction)}` }, { id: 'r', statement: squash(m.correction), truth: true, why: 'Yes.' }] : []),
      ...compareItemStatements(a.interaction),
    ];
    if (statements.length >= 2 && statements.some((i) => !i.truth)) plays.push({ kind: 'truefalse', items: statements.slice(0, 5) });
  }

  return plays;
}

/** The keys that finish a part's plays. */
export function playKeys(doc: StudyDocument, part: BodyPart): string[] {
  return playsOf(doc, part).map((p) => playKey(part, p.kind));
}

/** A fixed shuffle: the same order every time for the same seed, so a screen does not reshuffle when it re-renders. */
export function shuffled<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  let s = (seed >>> 0) || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }

  return out;
}

// ---------------------------------------------------------------------------
// A presentation slide's knowledge check
// ---------------------------------------------------------------------------

/** The parts of a presentation slide a knowledge check is made from. A presentation has its own types; only these keys are read. */
export interface SlideSource {
  n: number;
  content: { explanations: Array<{ text: string }>; key_idea?: string | null; relationship_note: string | null; misconception: { wrong_idea: string; correction: string } | null };
  interaction: DeckInteraction | null;
}

/**
 * The knowledge check a slide can offer: its own explanations with a key term taken out (Drag the words, and Fill in the blanks
 * when there are enough), and true or false from its common mistake, its comparison and its key idea. Nothing is offered that the
 * slide does not support, and true or false needs at least one statement that is not true.
 */
export function slidePlays(concepts: Record<string, { name: string }>, slide: SlideSource): Play[] {
  const plays: Play[] = [];
  const terms = conceptTermsFrom(concepts);
  const sources = [...slide.content.explanations.map((e) => e.text), slide.content.key_idea ?? '', slide.content.relationship_note ?? ''];
  const sentences = sources.flatMap((text, i) => {
    const t = squash(text);
    return t ? [{ id: `q${i}`, text: words(t) <= 40 ? t : firstSentence(t), terms }] : [];
  });
  const cloze = clozeFrom(sentences, 5);
  if (cloze.length >= 4) plays.push({ kind: 'words', items: cloze.slice(0, 2) }, { kind: 'blanks', items: cloze.slice(2) });
  else if (cloze.length >= 2) plays.push({ kind: 'words', items: cloze });

  const m = slide.content.misconception;
  const statements: TrueFalseItem[] = [
    ...(m && m.wrong_idea.trim() && m.correction.trim() ? [{ id: 'mw', statement: squash(m.wrong_idea), truth: false, why: `No. ${squash(m.correction)}` }] : []),
    ...compareItemStatements(slide.interaction),
    ...(slide.content.key_idea && words(slide.content.key_idea) <= 40 ? [{ id: 'ki', statement: squash(slide.content.key_idea), truth: true, why: 'Yes. This is the idea to remember.' }] : []),
  ];
  if (statements.length >= 2 && statements.some((i) => !i.truth) && statements.some((i) => i.truth)) plays.push({ kind: 'truefalse', items: statements.slice(0, 4) });

  return plays;
}

// ---------------------------------------------------------------------------
// Key terms inside a sentence
// ---------------------------------------------------------------------------

/** A sentence cut into plain pieces and key terms, so a term can be drawn as something to select. Longer terms are found first; each place is claimed once. */
export function markTerms(text: string, terms: readonly string[]): Array<{ text: string; term: string | null }> {
  const found: Array<{ at: number; end: number; term: string }> = [];
  for (const term of Array.from(new Set(terms.map(squash))).filter((t) => t.length >= 3).sort((a, b) => b.length - a.length)) {
    const re = new RegExp(`(?<![A-Za-z0-9])${escapeRe(term)}(?![A-Za-z0-9])`, 'gi');
    for (const m of text.matchAll(re)) {
      const at = m.index ?? 0;
      if (!found.some((f) => at < f.end && at + term.length > f.at)) found.push({ at, end: at + term.length, term });
    }
  }
  found.sort((a, b) => a.at - b.at);
  const out: Array<{ text: string; term: string | null }> = [];
  let cursor = 0;
  for (const f of found) {
    if (f.at > cursor) out.push({ text: text.slice(cursor, f.at), term: null });
    out.push({ text: text.slice(f.at, f.end), term: f.term });
    cursor = f.end;
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor), term: null });

  return out;
}
