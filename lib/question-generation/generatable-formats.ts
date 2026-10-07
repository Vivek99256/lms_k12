/**
 * What the "Generate AI questions" modal needs to know about a question format,
 * kept out of the page so it can be tested without a browser.
 *
 * THE FORMATS COME FROM THE BACKEND. `GET /api/intelligence/questions/formats`
 * returns exactly the codes that are in `question_type_catalog` AND implemented by
 * the generator; nothing here lists them. A format the backend does not return
 * cannot be selected, and a format it adds appears with no change on this side.
 *
 * THE H5P TARGET COMES FROM THE EXISTING MAP. `lib/h5p/question-bank-h5p-map.ts` is
 * the one place that says which H5P type a form becomes (and which substitution it
 * makes when the requested library is not built). This module only READS it. It
 * adds no mapping, and the backend returns none.
 *
 * No imports from `app/`: like the map, this stays unit-testable on its own.
 */

import { mappingForCode, readPairs } from '../h5p/question-bank-h5p-map';

// ---------------------------------------------------------------------------
// Bloom ladder
// ---------------------------------------------------------------------------

export type BloomLevel = 'Remember' | 'Understand' | 'Apply' | 'Analyze' | 'Evaluate' | 'Create';

/**
 * The Bloom ladder the generator works to, mirroring BLOOM_META in
 * App\Services\QuestionGenerationService. `weight` is that service's own default
 * distribution, used only to seed the custom-mix table so "custom" starts from what
 * the server would have done rather than from zeros.
 */
export const BLOOM_LEVEL_META: ReadonlyArray<{
  level: BloomLevel;
  difficulty: string;
  points: number;
  weight: number;
}> = [
  { level: 'Remember', difficulty: 'Easy', points: 1, weight: 0.15 },
  { level: 'Understand', difficulty: 'Easy', points: 2, weight: 0.3 },
  { level: 'Apply', difficulty: 'Medium', points: 3, weight: 0.3 },
  { level: 'Analyze', difficulty: 'Hard', points: 4, weight: 0.15 },
  { level: 'Evaluate', difficulty: 'Hard', points: 5, weight: 0.1 },
  { level: 'Create', difficulty: 'Hard', points: 5, weight: 0 },
];

export type BloomCounts = Record<BloomLevel, number>;

export const EMPTY_BLOOM_COUNTS: BloomCounts = BLOOM_LEVEL_META.reduce((counts, meta) => {
  counts[meta.level] = 0;
  return counts;
}, {} as BloomCounts);

/** The most questions one run may ask for; the backend enforces the same number. */
export const MAX_QUESTIONS = 50;

// ---------------------------------------------------------------------------
// The API's format
// ---------------------------------------------------------------------------

/** One entry of `GET /api/intelligence/questions/formats`. */
export interface GeneratableFormat {
  /** `question_type_catalog.code`, e.g. `true_false`. */
  code: string;
  label: string;
  lms_question_type_id: number;
  default_marks: number;
  /** False when every item of this format carries the same marks. */
  marks_editable: boolean;
  min_marks: number;
  max_marks: number;
  /** The Bloom levels the format can honestly be written at. */
  allowed_bloom_levels: BloomLevel[];
  batch_size?: number;
  max_questions?: number;
  prompt_version?: string;
  is_standard?: boolean;
}

/** The levels this format allows, in ladder order; all six when no format is chosen. */
export function allowedLevelMeta(format: GeneratableFormat | null | undefined) {
  if (!format || !format.allowed_bloom_levels?.length) return [...BLOOM_LEVEL_META];
  const allowed = new Set<BloomLevel>(format.allowed_bloom_levels);
  return BLOOM_LEVEL_META.filter((meta) => allowed.has(meta.level));
}

/**
 * Split `total` across the Bloom levels by weight, largest-remainder style, so the
 * parts always add back up to the total instead of drifting on rounding.
 *
 * With no `allowed` list this is exactly the split the modal has always seeded the
 * custom table with. With one, the same weights are used over the allowed levels
 * only; if none of them carries a weight (a format limited to Create, say) the
 * levels share the total equally rather than leaving it unallocated.
 */
export function suggestedBloomCounts(total: number, allowed?: readonly BloomLevel[]): BloomCounts {
  if (!Number.isFinite(total) || total <= 0) return { ...EMPTY_BLOOM_COUNTS };

  const allowedSet = allowed && allowed.length > 0 ? new Set<BloomLevel>(allowed) : null;
  const pool = BLOOM_LEVEL_META.filter((meta) => !allowedSet || allowedSet.has(meta.level));
  const weighted = pool.some((meta) => meta.weight > 0)
    ? pool.map((meta) => ({ level: meta.level, weight: meta.weight }))
    : pool.map((meta) => ({ level: meta.level, weight: 1 }));
  const sum = weighted.reduce((acc, entry) => acc + entry.weight, 0);

  const exact = weighted.map((entry) => ({ level: entry.level, value: (total * entry.weight) / sum }));
  const counts = { ...EMPTY_BLOOM_COUNTS };
  exact.forEach((entry) => {
    counts[entry.level] = Math.floor(entry.value);
  });

  let remaining = total - Object.values(counts).reduce((acc, value) => acc + value, 0);
  const byRemainder = [...exact]
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - Math.floor(b.value) - (a.value - Math.floor(a.value)));

  let index = 0;
  while (remaining > 0 && byRemainder.length > 0) {
    counts[byRemainder[index % byRemainder.length].level] += 1;
    remaining -= 1;
    index += 1;
  }

  return counts;
}

/** Marks held inside the format's range. */
export function clampMarks(format: GeneratableFormat, value: number): number {
  const lo = Number.isFinite(format.min_marks) ? format.min_marks : 1;
  const hi = Number.isFinite(format.max_marks) ? format.max_marks : lo;
  return Math.max(lo, Math.min(hi, Math.round(value)));
}

/**
 * Marks per Bloom level to seed the custom table with.
 *
 * A format whose marks are fixed has nothing to edit, so every level shows its
 * one value. A format with a range starts every level at the format's own default
 * (a Short Answer starts at 3, not at the Understand rung's 2), because the
 * ladder's 1-5 marks belong to the legacy narrative mix, not to a chosen format.
 */
export function defaultPointsFor(format: GeneratableFormat | null | undefined): Record<BloomLevel, number> {
  const points = {} as Record<BloomLevel, number>;
  BLOOM_LEVEL_META.forEach((meta) => {
    points[meta.level] = format ? clampMarks(format, format.default_marks) : meta.points;
  });
  return points;
}

// ---------------------------------------------------------------------------
// H5P target, read from the existing map
// ---------------------------------------------------------------------------

export interface FormatH5pInfo {
  /** False when the map has no entry for this code. */
  mapped: boolean;
  /** Where it plays by default, e.g. "True or false". Null when nothing built can carry it. */
  target: string | null;
  library: string | null;
  /**
   * False when the requested H5P library is not built here and the map substitutes
   * the closest type that is (Multiple choice -> Single choice set). `note` says so.
   */
  exact: boolean;
  note: string;
  /** Other built types the same question can also be asked as. */
  alsoPlaysAs: string[];
}

export function h5pInfoForFormat(code: string): FormatH5pInfo {
  const mapping = mappingForCode(code);

  if (!mapping) {
    return {
      mapped: false,
      target: null,
      library: null,
      exact: false,
      note: 'This format is not mapped to an H5P type yet, so it will be saved to the question bank only.',
      alsoPlaysAs: [],
    };
  }

  return {
    mapped: true,
    target: mapping.target?.label ?? null,
    library: mapping.target?.library ?? null,
    exact: mapping.supported,
    note: mapping.supported ? '' : mapping.note,
    alsoPlaysAs: mapping.alsoPlaysAs.map((target) => target.label),
  };
}

// ---------------------------------------------------------------------------
// Card view model
// ---------------------------------------------------------------------------

export function marksLabel(format: GeneratableFormat): string {
  const unit = (n: number) => `${n} mark${n === 1 ? '' : 's'}`;
  if (!format.marks_editable || format.min_marks === format.max_marks) return unit(format.default_marks);
  return `${unit(format.default_marks)} (${format.min_marks}–${format.max_marks})`;
}

export interface FormatCard {
  code: string;
  label: string;
  marks: string;
  h5p: FormatH5pInfo;
}

export function toFormatCards(formats: GeneratableFormat[]): FormatCard[] {
  return formats.map((format) => ({
    code: format.code,
    label: format.label,
    marks: marksLabel(format),
    h5p: h5pInfoForFormat(format.code),
  }));
}

// ---------------------------------------------------------------------------
// The request
// ---------------------------------------------------------------------------

export interface QuotaRow {
  level: BloomLevel;
  count: number;
  difficulty?: string;
  points?: number;
}

/**
 * Rows for the levels the teacher gave a count to, in ladder order.
 *
 * Zero-count levels are dropped: the server reads a row's presence as "generate at
 * this level". Marks are sent only for a format whose marks are editable -- for a
 * fixed-marks format the server pins them, and sending a value would be misleading.
 */
export function buildQuotaRows(input: {
  format: GeneratableFormat;
  counts: Partial<Record<BloomLevel, number>>;
  difficulties: Partial<Record<BloomLevel, string>>;
  points: Partial<Record<BloomLevel, number>>;
}): QuotaRow[] {
  const { format, counts, difficulties, points } = input;

  return allowedLevelMeta(format)
    .filter((meta) => (counts[meta.level] ?? 0) > 0)
    .map((meta) => ({
      level: meta.level,
      count: counts[meta.level] as number,
      difficulty: difficulties[meta.level] ?? meta.difficulty,
      ...(format.marks_editable ? { points: clampMarks(format, points[meta.level] ?? format.default_marks) } : {}),
    }));
}

export interface GenerateRequestBody {
  chapter_id: number;
  subject_id: number;
  standard_id: number;
  concept_id: number;
  /** Every selected format's catalogue code. One entry behaves exactly like a single format. */
  question_format_codes: string[];
  total_questions: number;
  quota?: QuotaRow[];
}

/**
 * The generate request. Names the selected FORMATS and nothing about legacy types:
 * no `question_type`, no `question_type_id` (the server resolves the type id from the
 * catalogue and ignores any the client sends).
 *
 * Auto omits `quota`, so the server decides the mix over each format's allowed levels.
 * A custom mix is only meaningful for ONE format (a level table cannot be honoured by
 * every format -- True/False excludes Evaluate, for instance), so it is sent only then;
 * with several formats the server splits the total itself and rejects a quota.
 */
export function buildGenerateRequest(input: {
  ids: { chapter_id: number; subject_id: number; standard_id: number; concept_id: number };
  formats: GeneratableFormat[];
  total: number;
  auto: boolean;
  counts: Partial<Record<BloomLevel, number>>;
  difficulties: Partial<Record<BloomLevel, string>>;
  points: Partial<Record<BloomLevel, number>>;
}): GenerateRequestBody {
  const { ids, formats, total, auto, counts, difficulties, points } = input;

  return {
    chapter_id: ids.chapter_id,
    subject_id: ids.subject_id,
    standard_id: ids.standard_id,
    concept_id: ids.concept_id,
    question_format_codes: formats.map((format) => format.code),
    total_questions: total,
    ...(!auto && formats.length === 1
      ? { quota: buildQuotaRows({ format: formats[0], counts, difficulties, points }) }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// Choosing several formats
// ---------------------------------------------------------------------------

/**
 * The selected formats, in the order the backend listed them, dropping any code the
 * backend no longer offers. The server orders by its own registry (so the split never
 * depends on click order); keeping the API's order here makes the UI agree.
 */
export function orderSelectedFormats(selectedCodes: readonly string[], available: GeneratableFormat[]): GeneratableFormat[] {
  const wanted = new Set(selectedCodes);
  return available.filter((format) => wanted.has(format.code));
}

/** The codes that are still offered, so a reload of the list cannot leave a stale chip. */
export function pruneSelection(selectedCodes: readonly string[], available: GeneratableFormat[]): string[] {
  const offered = new Set(available.map((format) => format.code));
  return selectedCodes.filter((code) => offered.has(code));
}

/**
 * Every selected format needs at least one question, so the total must reach the
 * number of formats. (The server enforces the same rule.)
 */
export function totalCoversFormats(total: number, formatCount: number): boolean {
  return Number.isInteger(total) && total >= Math.max(1, formatCount);
}

/**
 * How the total will divide, for the footer: "5 each" or "4-5 each". The server does
 * the actual split (QuestionFormatRegistry::distribute: even shares, remainder to the
 * first formats); this only states its result in words, and reports the real split
 * back after the run.
 */
export function evenSplitLabel(total: number, formatCount: number): string {
  if (formatCount <= 1 || !Number.isInteger(total) || total < formatCount) return '';
  const base = Math.floor(total / formatCount);
  return total % formatCount === 0 ? `${base} each` : `${base}–${base + 1} each`;
}

/** True for a whole number from 1 to the cap. */
export function isValidQuestionTotal(raw: string): boolean {
  if (raw.trim() === '') return false;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 1 && value <= MAX_QUESTIONS;
}

// ---------------------------------------------------------------------------
// The formats response
// ---------------------------------------------------------------------------

const BLOOM_SET = new Set<string>(BLOOM_LEVEL_META.map((meta) => meta.level));

function toWholeNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

/**
 * The formats endpoint's `data`, made safe to render.
 *
 * Anything that is not a usable entry -- no code, no label, a code with characters
 * the backend would not accept -- is dropped rather than shown as a card the teacher
 * could select and then watch fail. A format that declares no valid Bloom levels
 * gets all six (the backend never sends that; this is only so a malformed entry
 * cannot produce an empty custom-mix table). Duplicate codes keep the first.
 */
export function normaliseGeneratableFormats(data: unknown): GeneratableFormat[] {
  if (!Array.isArray(data)) return [];

  const seen = new Set<string>();
  const formats: GeneratableFormat[] = [];

  for (const entry of data) {
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;

    const code = typeof record.code === 'string' ? record.code.trim() : '';
    const label = typeof record.label === 'string' ? record.label.trim() : '';
    if (!/^[a-z0-9_]+$/.test(code) || label === '' || seen.has(code)) continue;
    seen.add(code);

    const levels = Array.isArray(record.allowed_bloom_levels)
      ? (record.allowed_bloom_levels.filter((level) => typeof level === 'string' && BLOOM_SET.has(level)) as BloomLevel[])
      : [];

    const defaultMarks = Math.max(1, toWholeNumber(record.default_marks, 1));
    const minMarks = Math.max(1, toWholeNumber(record.min_marks, defaultMarks));
    const maxMarks = Math.max(minMarks, toWholeNumber(record.max_marks, defaultMarks));

    formats.push({
      code,
      label,
      lms_question_type_id: toWholeNumber(record.lms_question_type_id, 2),
      default_marks: Math.min(maxMarks, Math.max(minMarks, defaultMarks)),
      marks_editable: record.marks_editable === true && minMarks !== maxMarks,
      min_marks: minMarks,
      max_marks: maxMarks,
      allowed_bloom_levels: levels.length > 0 ? levels : BLOOM_LEVEL_META.map((meta) => meta.level),
      batch_size: typeof record.batch_size === 'number' ? record.batch_size : undefined,
      max_questions: typeof record.max_questions === 'number' ? record.max_questions : undefined,
      prompt_version: typeof record.prompt_version === 'string' ? record.prompt_version : undefined,
      is_standard: typeof record.is_standard === 'boolean' ? record.is_standard : undefined,
    });
  }

  return formats;
}

// ---------------------------------------------------------------------------
// Generated-question preview
// ---------------------------------------------------------------------------

export interface PreviewExtras {
  /** match_following: the pairs, in answer-key order. */
  pairs: Array<{ left: string; right: string }>;
  /** fill_blank: one answer per gap. */
  answers: string[];
  /** numerical: the working, and the unit the answer is in. */
  steps: string[];
  unit: string | null;
}

/**
 * The format-specific parts of a generated question's answer envelope, cleaned for
 * display. The MCQ options, model answer, marking points and explanation are shown
 * as they always were; this covers what the newer formats add. Nothing here is
 * invented: an absent or malformed field is simply an empty list.
 */
export function previewExtras(answer: {
  pairs?: unknown;
  answers?: unknown;
  solution_steps?: unknown;
  unit?: unknown;
} | null | undefined): PreviewExtras {
  const strings = (value: unknown): string[] =>
    Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string' && item.trim() !== '').map((item) => item.trim())
      : [];

  return {
    pairs: readPairs(answer?.pairs) ?? [],
    answers: strings(answer?.answers),
    steps: strings(answer?.solution_steps),
    unit: typeof answer?.unit === 'string' && answer.unit.trim() !== '' ? answer.unit.trim() : null,
  };
}
