/**
 * What a learner has done in a classroom activity, and what can be worked out from it.
 *
 * WHY CLIENT-SIDE. No LMS attempt/progress API exists for this kind of content (see lib/study-deck/progress.ts), so a
 * learner's work is kept in the browser and the screen says so. Nothing is invented to fill the gap.
 *
 * PURE. Plain data in, plain data out. Storage is only touched by `loadProgress` / `saveProgress`, which take it as a
 * parameter, swallow every storage error (private windows, blocked storage) and never throw.
 *
 * Every typed value lives in ONE flat map of strings under a key built here, so what is saved is easy to check and a
 * value that no longer belongs to the activity is dropped when it is read back.
 */

import type { ActivityBlock, ClassroomActivity, CompareBlock, ReportBlock, TableBlock } from './activity';
import { storageKey } from './activity';

export type Stage = 'intro' | 'steps' | 'review';

export interface ActivityProgress {
  version: 1;
  stage: Stage;
  /** Zero-based; only meaningful in the 'steps' stage. */
  stepIndex: number;
  /** Ids of the steps the learner has marked done. */
  stepsDone: string[];
  values: Record<string, string>;
  /** Set when the learner presses "Finish activity" on the review page. */
  completedAt: string | null;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Keys of the value map
// ---------------------------------------------------------------------------

export const materialKey = (index: number): string => `material/${index}`;
export const cellKey = (block: string, row: string, column: string): string => `${block}/cell/${row}/${column}`;
export const nameKey = (block: string, entity: string): string => `${block}/name/${entity}`;
export const compareKey = (block: string, row: string, entity: string): string => `${block}/compare/${row}/${entity}`;
export const noteKey = (block: string): string => `${block}/note`;
export const reportKey = (block: string, section: string, index: number): string => `${block}/report/${section}/${index}`;
export const reflectionKey = (id: string): string => `reflection/${id}`;
export const checkKey = (id: string): string => `check/${id}`;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export function emptyProgress(at = new Date().toISOString()): ActivityProgress {
  return { version: 1, stage: 'intro', stepIndex: 0, stepsDone: [], values: {}, completedAt: null, updatedAt: at };
}

export function setValue(state: ActivityProgress, key: string, value: string, at = new Date().toISOString()): ActivityProgress {
  const values = { ...state.values };
  if (value.trim() === '') delete values[key];
  else values[key] = value;
  // Changing an answer after finishing reopens the activity, so "completed" never describes work that has since changed.
  return { ...state, values, completedAt: null, updatedAt: at };
}

export function toggleStep(state: ActivityProgress, stepId: string, at = new Date().toISOString()): ActivityProgress {
  const stepsDone = state.stepsDone.includes(stepId) ? state.stepsDone.filter((id) => id !== stepId) : [...state.stepsDone, stepId];
  return { ...state, stepsDone, completedAt: null, updatedAt: at };
}

export function go(state: ActivityProgress, stage: Stage, stepIndex = state.stepIndex, at = new Date().toISOString()): ActivityProgress {
  return { ...state, stage, stepIndex, updatedAt: at };
}

export function finish(state: ActivityProgress, at = new Date().toISOString()): ActivityProgress {
  return { ...state, completedAt: at, updatedAt: at };
}

export function restart(at = new Date().toISOString()): ActivityProgress {
  return emptyProgress(at);
}

/** Which keys may exist for this activity. */
function validKeys(activity: ClassroomActivity): (key: string) => boolean {
  const exact = new Set<string>();
  const prefixes: string[] = [];
  activity.intro.materials.forEach((_, i) => exact.add(materialKey(i)));
  if (activity.intro.safety.length > 0) exact.add(checkKey('safety'));
  for (const r of activity.reflection) exact.add(reflectionKey(r.id));
  for (const block of activity.blocks) {
    if (block.kind === 'table') for (const row of block.rows) for (const col of block.columns) exact.add(cellKey(block.id, row.id, col.id));
    else if (block.kind === 'compare') {
      for (const e of block.entities) {
        exact.add(nameKey(block.id, e.id));
        for (const row of block.rows) exact.add(compareKey(block.id, row.id, e.id));
      }
    } else if (block.kind === 'notes') exact.add(noteKey(block.id));
    else for (const s of block.sections) prefixes.push(`${block.id}/report/${s.id}/`);
  }
  return (key) => exact.has(key) || prefixes.some((p) => key.startsWith(p) && /^\d+$/.test(key.slice(p.length)) && Number(key.slice(p.length)) < 10);
}

/** What was saved, made safe: anything that is not of this activity (or not text) is dropped; a damaged value is an empty start. */
export function parseProgress(raw: unknown, activity: ClassroomActivity): ActivityProgress {
  const saved = raw as Partial<ActivityProgress> | null;
  if (!saved || typeof saved !== 'object' || saved.version !== 1) return emptyProgress();

  const known = validKeys(activity);
  const stepIds = new Set(activity.steps.map((s) => s.id));
  const values: Record<string, string> = {};
  if (saved.values && typeof saved.values === 'object') {
    for (const [key, value] of Object.entries(saved.values)) {
      if (typeof value === 'string' && value.trim() !== '' && known(key)) values[key] = value.slice(0, 4000);
    }
  }
  const stage: Stage = saved.stage === 'steps' || saved.stage === 'review' ? saved.stage : 'intro';
  const stepIndex = Number.isInteger(saved.stepIndex) ? Math.min(Math.max(saved.stepIndex as number, 0), activity.steps.length - 1) : 0;

  return {
    version: 1,
    stage,
    stepIndex,
    stepsDone: Array.isArray(saved.stepsDone) ? [...new Set(saved.stepsDone.filter((id): id is string => typeof id === 'string' && stepIds.has(id)))] : [],
    values,
    completedAt: typeof saved.completedAt === 'string' ? saved.completedAt : null,
    updatedAt: typeof saved.updatedAt === 'string' ? saved.updatedAt : new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function browserStore(): KeyValueStore | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function loadProgress(activity: ClassroomActivity, contentId: number | string, userId: number | string | null, store: KeyValueStore | null = browserStore()): ActivityProgress {
  try {
    const raw = store?.getItem(storageKey(contentId, userId));
    return raw ? parseProgress(JSON.parse(raw), activity) : emptyProgress();
  } catch {
    return emptyProgress();
  }
}

/** True when the work was written to storage. False means it only lives on this screen. */
export function saveProgress(progress: ActivityProgress, contentId: number | string, userId: number | string | null, store: KeyValueStore | null = browserStore()): boolean {
  try {
    if (!store) return false;
    store.setItem(storageKey(contentId, userId), JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}

export function clearProgress(contentId: number | string, userId: number | string | null, store: KeyValueStore | null = browserStore()): void {
  try {
    store?.removeItem(storageKey(contentId, userId));
  } catch {
    /* nothing to clear */
  }
}

// ---------------------------------------------------------------------------
// Status (the card on the Classroom Resource page)
// ---------------------------------------------------------------------------

export type ActivityState = 'not_started' | 'in_progress' | 'completed';

export interface ActivityStatus {
  state: ActivityState;
  stepsDone: number;
  totalSteps: number;
}

/** From what is in storage and the number of steps the card was told about. Never throws. */
export function statusFromStored(raw: string | null, totalSteps: number): ActivityStatus {
  try {
    const saved = raw ? (JSON.parse(raw) as Partial<ActivityProgress>) : null;
    if (!saved || saved.version !== 1) return { state: 'not_started', stepsDone: 0, totalSteps };
    const stepsDone = Array.isArray(saved.stepsDone) ? Math.min(new Set(saved.stepsDone.filter((id) => typeof id === 'string')).size, totalSteps) : 0;
    if (typeof saved.completedAt === 'string') return { state: 'completed', stepsDone, totalSteps };
    const touched = stepsDone > 0 || Object.keys(saved.values ?? {}).length > 0 || saved.stage === 'steps' || saved.stage === 'review';
    return { state: touched ? 'in_progress' : 'not_started', stepsDone, totalSteps };
  } catch {
    return { state: 'not_started', stepsDone: 0, totalSteps };
  }
}

export function statusOf(activity: ClassroomActivity, progress: ActivityProgress): ActivityStatus {
  return statusFromStored(JSON.stringify(progress), activity.steps.length);
}

export function readStatus(contentId: number | string, userId: number | string | null, totalSteps: number, store: KeyValueStore | null = browserStore()): ActivityStatus {
  try {
    return statusFromStored(store?.getItem(storageKey(contentId, userId)) ?? null, totalSteps);
  } catch {
    return { state: 'not_started', stepsDone: 0, totalSteps };
  }
}

// ---------------------------------------------------------------------------
// Working things out from what the learner typed
// ---------------------------------------------------------------------------

/** A number as a learner types it ("12", "12.5", "12,5", " 12 "), or null when it is not one. */
export function numberOf(value: string | undefined): number | null {
  const cleaned = (value ?? '').trim().replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

/** `of` minus `minus` for one row, or null until both are numbers. */
export function derivedValue(block: TableBlock, derivedId: string, rowId: string, values: Readonly<Record<string, string>>): number | null {
  const d = block.derived?.find((x) => x.id === derivedId);
  if (!d) return null;
  const a = numberOf(values[cellKey(block.id, rowId, d.of)]);
  const b = numberOf(values[cellKey(block.id, rowId, d.minus)]);
  return a === null || b === null ? null : round1(a - b);
}

export function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

export function tableCounts(block: TableBlock, values: Readonly<Record<string, string>>): { filled: number; total: number } {
  const total = block.rows.length * block.columns.length;
  const filled = block.rows.reduce((n, row) => n + block.columns.filter((col) => numberOf(values[cellKey(block.id, row.id, col.id)]) !== null).length, 0);
  return { filled, total };
}

/** The rows ordered by how much they changed (largest first), for the rows that have both numbers. */
export function rankChanges(block: TableBlock, derivedId: string, values: Readonly<Record<string, string>>): { row: string; label: string; change: number }[] {
  const out: { row: string; label: string; change: number }[] = [];
  for (const row of block.rows) {
    const change = derivedValue(block, derivedId, row.id, values);
    if (change !== null) out.push({ row: row.id, label: row.label, change });
  }
  return out.sort((x, y) => Math.abs(y.change) - Math.abs(x.change));
}

/** A name the learner typed for something being compared, or its own label ("Country A") until they do. */
export function entityName(block: CompareBlock, entityId: string, values: Readonly<Record<string, string>>): string {
  const typed = (values[nameKey(block.id, entityId)] ?? '').trim();
  return typed || (block.entities.find((e) => e.id === entityId)?.label ?? entityId);
}

/** A report's title or section label with the typed names in place of its tokens ("[Country A]" -> "Canada"). */
export function fillTokens(text: string, report: ReportBlock, from: CompareBlock, values: Readonly<Record<string, string>>): string {
  return Object.entries(report.tokens).reduce((out, [token, entity]) => out.split(token).join(entityName(from, entity, values)), text);
}

export interface SectionStatus {
  id: string;
  entries: string[];
  count: number;
  min: number;
  max: number;
  /** Enough entries and no more than the card allows. */
  ok: boolean;
}

export function reportSections(block: ReportBlock, values: Readonly<Record<string, string>>): SectionStatus[] {
  return block.sections.map((s) => {
    const entries = Array.from({ length: s.max }, (_, i) => (values[reportKey(block.id, s.id, i)] ?? '').trim()).filter(Boolean);
    return { id: s.id, entries, count: entries.length, min: s.min, max: s.max, ok: entries.length >= s.min && entries.length <= s.max };
  });
}

/** Whether the learner has written anything in a worksheet block. */
export function blockStarted(block: ActivityBlock, values: Readonly<Record<string, string>>): boolean {
  const prefix = block.kind === 'notes' ? noteKey(block.id) : `${block.id}/`;
  return Object.keys(values).some((key) => key === prefix || key.startsWith(prefix));
}

// ---------------------------------------------------------------------------
// Review: what was done and recorded
// ---------------------------------------------------------------------------

export interface Summary {
  title: string;
  code: string;
  stepsDone: number;
  totalSteps: number;
  skipped: number[];
  lines: string[];
}

/** The learner's work as plain lines. A value that was not recorded says so; nothing is made up. */
export function summarise(activity: ClassroomActivity, progress: ActivityProgress): Summary {
  const v = progress.values;
  const lines: string[] = [];
  const done = new Set(progress.stepsDone);
  const skipped = activity.steps.filter((s) => !done.has(s.id)).map((s) => s.n);

  for (const block of activity.blocks) lines.push(...blockLines(activity, block, v));
  for (const r of activity.reflection) {
    lines.push('', r.prompt, (v[reflectionKey(r.id)] ?? '').trim() || 'Not answered');
  }

  return { title: activity.title, code: activity.code, stepsDone: activity.steps.filter((s) => done.has(s.id)).length, totalSteps: activity.steps.length, skipped, lines };
}

function blockLines(activity: ClassroomActivity, block: ActivityBlock, v: Readonly<Record<string, string>>): string[] {
  if (block.kind === 'table') {
    const unit = block.unit ? ` (${block.unit})` : '';
    const out = ['', `${block.title}${unit}`];
    for (const row of block.rows) {
      const cells = block.columns.map((col) => `${col.label}: ${(v[cellKey(block.id, row.id, col.id)] ?? '').trim() || 'not recorded'}`);
      const derived = (block.derived ?? []).map((d) => {
        const n = derivedValue(block, d.id, row.id, v);
        return `${d.label}: ${n === null ? 'not worked out' : signed(n)}`;
      });
      out.push(`${row.label} | ${[...cells, ...derived].join(' | ')}`);
    }
    return out;
  }
  if (block.kind === 'compare') {
    const names = block.entities.map((e) => entityName(block, e.id, v));
    const out = ['', `${block.title}: ${names.join(' and ')}`];
    for (const row of block.rows) {
      const cells = block.entities.map((e, i) => `${names[i]}: ${(v[compareKey(block.id, row.id, e.id)] ?? '').trim() || 'not recorded'}`);
      out.push(`${row.label} | ${cells.join(' | ')}`);
    }
    return out;
  }
  if (block.kind === 'notes') return ['', block.label, (v[noteKey(block.id)] ?? '').trim() || 'Nothing written'];
  const from = activity.blocks.find((b): b is CompareBlock => b.id === block.names_from && b.kind === 'compare');
  const fill = (t: string) => (from ? fillTokens(t, block, from, v) : t);
  const out = ['', fill(block.title_template)];
  for (const s of reportSections(block, v)) {
    const label = fill(block.sections.find((x) => x.id === s.id)?.label ?? s.id);
    out.push(label, ...(s.entries.length ? s.entries.map((e, i) => `${i + 1}. ${e}`) : ['Nothing written']));
  }
  return out;
}

/** The summary as text a learner can copy, paste or print. States plainly that it is kept only where they put it. */
export function summaryText(activity: ClassroomActivity, progress: ActivityProgress): string {
  const s = summarise(activity, progress);
  return [`${s.code}. ${s.title}`, `Steps done: ${s.stepsDone} of ${s.totalSteps}`, ...(s.skipped.length ? [`Steps not marked done: ${s.skipped.join(', ')}`] : []), ...s.lines].join('\n');
}
