import {
  buildSessionContext,
  createAuthHeaders,
  readNumber,
  readString,
  type SessionContext,
} from '@/lib/erp-client';

/**
 * AI question-paper creation data layer (LMS → Test → Exam).
 *
 * The legacy Laravel `/lms/ai_paper/*` endpoints are broken on the live DB (they
 * hard-code mapping_type_id 1/2, which don't match the real DOK/Bloom type ids),
 * so the DOK% + Bloom% distribution is reproduced HERE, client-side, on the
 * working REST endpoints the manual picker already uses:
 *
 *   GET  /api/question-mapping-levels     → { dok:[{id,name}], bloom:[{id,name}] }
 *   POST /api/lms-courses    (FormData)    → subjects + chapters (per standard)
 *   POST /api/lms-questions  (FormData)    → questions, filterable by dok_id[]/bloom_id[]
 *   POST /api/question-paper (JSON)        → save (accepts ai_generated + distributions)
 *
 * No backend change/deploy is required; all four endpoints are verified live.
 */

// ---------------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------------

function requireSession(): SessionContext {
  const session = buildSessionContext();
  if (!session.baseUrl) throw new Error('Session data is missing. Please sign in again.');
  return session;
}

function userProfileName(): string {
  if (typeof window === 'undefined') return '';
  try {
    const menuContext = JSON.parse(localStorage.getItem('menuContext') || '{}') as Record<string, unknown>;
    const userData = JSON.parse(localStorage.getItem('userData') || '{}') as Record<string, unknown>;
    return readString(menuContext.user_profile_name ?? userData.user_profile_name ?? userData.user_profile);
  } catch {
    return '';
  }
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

async function readJson(res: Response, fallback: string): Promise<Record<string, unknown>> {
  const text = (await res.text()).trim();
  if (!text) return {};
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : { data: parsed };
  } catch {
    throw new Error(`${fallback} (HTTP ${res.status}).`);
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MappingLevel {
  id: number;
  name: string;
}
export interface MappingLevels {
  dok: MappingLevel[];
  bloom: MappingLevel[];
}

export interface ExamChapter {
  id: string;
  name: string;
  conceptCount: number;
}

export interface AiQuestion {
  id: string;
  title: string;
  points: number;
  questionTypeId: string;
  chapterId: string;
}

/** {id, name, percentage} — matches the Laravel distribution shape. */
export interface DistributionEntry {
  id: number;
  name: string;
  percentage: number;
}

export interface BucketAvailability {
  id: number;
  name: string;
  percentage: number;
  required: number;
  available: number;
  short: boolean;
}

export interface AvailabilityResult {
  totalAvailable: number;
  dok: BucketAvailability[];
  bloom: BucketAvailability[];
  warnings: string[];
  canGenerate: boolean;
}

export interface GeneratedQuestion {
  id: string;
  title: string;
  marks: number;
  questionTypeId: string;
  chapterId: string;
}
export interface GeneratedSection {
  name: string;
  questions: GeneratedQuestion[];
  totalMarks: number;
}
export interface GeneratedSet {
  setName: string;
  sections: GeneratedSection[];
  totalQuestions: number;
  totalMarks: number;
  questionIds: string[];
}

export interface SectionConfig {
  name: string;
  questions: number;
}

export interface GenerateConfig {
  subjectId: string;
  chapterIds: string[];
  questionTypeIds: string[];
  totalQuestions: number;
  marksPerQuestion: number;
  dokDistribution: DistributionEntry[];
  bloomDistribution: DistributionEntry[];
  sections: SectionConfig[];
  generateSets: number;
}

/** Buckets fetched once per scope; reused by availability + generation. */
export interface ScopeBuckets {
  dokQuestions: Map<number, AiQuestion[]>;
  bloomIds: Map<number, Set<string>>;
  allById: Map<string, AiQuestion>;
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

export async function fetchMappingLevels(signal?: AbortSignal): Promise<MappingLevels> {
  const session = requireSession();
  const res = await fetch(`${session.baseUrl}/api/question-mapping-levels`, {
    headers: createAuthHeaders(session),
    signal,
  });
  const raw = await readJson(res, 'Failed to load DOK/Bloom levels');
  if (!res.ok) throw new Error((raw.message as string) || 'Failed to load DOK/Bloom levels');
  const data = toRecord(raw.data);
  const map = (list: unknown): MappingLevel[] =>
    toArray(list)
      .map((entry) => {
        const r = toRecord(entry);
        return { id: readNumber(r.id), name: readString(r.name) };
      })
      .filter((level) => level.id > 0 && level.name);
  return { dok: map(data.dok), bloom: map(data.bloom) };
}

const coursesCache = new Map<string, Promise<Record<string, unknown>>>();

async function loadCourses(session: SessionContext): Promise<Record<string, unknown>> {
  const form = new FormData();
  form.append('sub_institute_id', session.subInstituteId);
  form.append('user_profile_name', userProfileName());
  form.append('user_id', session.userId);
  const res = await fetch(`${session.baseUrl}/api/lms-courses`, {
    method: 'POST',
    headers: createAuthHeaders(session),
    body: form,
  });
  return readJson(res, 'Failed to load chapters');
}

export async function fetchSubjectChapters(
  standardId: string,
  subjectId: string,
  signal?: AbortSignal
): Promise<ExamChapter[]> {
  if (!standardId || !subjectId) return [];
  const session = requireSession();
  const key = `${session.subInstituteId}_${session.syear}`;
  let cached = coursesCache.get(key);
  if (!cached) {
    cached = loadCourses(session).catch((error: unknown) => {
      coursesCache.delete(key);
      throw error;
    });
    coursesCache.set(key, cached);
  }
  void signal;
  const raw = await cached;
  const grouped = toRecord(raw.lms_subject);
  const chapters: ExamChapter[] = [];
  const seen = new Set<string>();
  for (const arr of Object.values(grouped)) {
    for (const entry of toArray(arr)) {
      const subject = toRecord(entry);
      if (readString(subject.subject_id) !== subjectId || readString(subject.standard_id) !== standardId) continue;
      for (const chapterEntry of toArray(subject.chapters)) {
        const chapter = toRecord(chapterEntry);
        const id = readString(chapter.id ?? chapter.chapter_id);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        chapters.push({
          id,
          name: readString(chapter.chapter_name ?? chapter.name),
          conceptCount: readNumber(chapter.total_content),
        });
      }
    }
  }
  return chapters;
}

// ---------------------------------------------------------------------------
// Question bank (bucketed per DOK / Bloom level)
// ---------------------------------------------------------------------------

function mapQuestion(entry: unknown): AiQuestion {
  const r = toRecord(entry);
  return {
    id: readString(r.id),
    title: readString(r.question_title ?? r.question ?? r.description),
    points: readNumber(r.points) || 1,
    questionTypeId: readString(r.question_type_id),
    chapterId: readString(r.chapter_id),
  };
}

async function fetchQuestions(
  session: SessionContext,
  scope: { subjectId: string; chapterIds: string[]; questionTypeIds: string[] },
  extra: Record<string, string[]>,
  signal?: AbortSignal
): Promise<AiQuestion[]> {
  const form = new FormData();
  form.append('subject_id', scope.subjectId);
  scope.chapterIds.forEach((id) => form.append('chapter_id[]', id));
  scope.questionTypeIds.forEach((id) => form.append('question_type_id[]', id));
  for (const [key, values] of Object.entries(extra)) values.forEach((v) => form.append(key, v));

  const res = await fetch(`${session.baseUrl}/api/lms-questions`, {
    method: 'POST',
    headers: createAuthHeaders(session),
    body: form,
    signal,
  });
  const raw = await readJson(res, 'Failed to load questions');
  if (!res.ok) throw new Error((raw.message as string) || 'Failed to load questions');
  let list = toArray(raw.data).map(mapQuestion).filter((q) => q.id);
  // Some deployments ignore the question-type filter param → filter client-side.
  if (scope.questionTypeIds.length > 0) {
    const allow = new Set(scope.questionTypeIds);
    list = list.filter((q) => !q.questionTypeId || allow.has(q.questionTypeId));
  }
  return list;
}

/**
 * Fetch DOK buckets (one call per level, for selection) and Bloom id-sets (one
 * call per level, for cross-tagging), so each question's Bloom level can be
 * resolved by set membership without the questions payload carrying tags.
 */
export async function fetchScopeBuckets(
  scope: { subjectId: string; chapterIds: string[]; questionTypeIds: string[] },
  dokLevels: number[],
  bloomLevels: number[],
  signal?: AbortSignal
): Promise<ScopeBuckets> {
  const session = requireSession();

  const dokResults = await Promise.all(
    dokLevels.map((level) => fetchQuestions(session, scope, { 'dok_id[]': [String(level)] }, signal))
  );
  const bloomResults = await Promise.all(
    bloomLevels.map((level) => fetchQuestions(session, scope, { 'bloom_id[]': [String(level)] }, signal))
  );

  const dokQuestions = new Map<number, AiQuestion[]>();
  const allById = new Map<string, AiQuestion>();
  dokLevels.forEach((level, i) => {
    const list = dokResults[i];
    dokQuestions.set(level, list);
    list.forEach((q) => allById.set(q.id, q));
  });

  const bloomIds = new Map<number, Set<string>>();
  bloomLevels.forEach((level, i) => {
    bloomIds.set(level, new Set(bloomResults[i].map((q) => q.id)));
    bloomResults[i].forEach((q) => {
      if (!allById.has(q.id)) allById.set(q.id, q);
    });
  });

  return { dokQuestions, bloomIds, allById };
}

// ---------------------------------------------------------------------------
// Availability + generation (pure, client-side)
// ---------------------------------------------------------------------------

function required(total: number, percentage: number): number {
  return Math.round((total * percentage) / 100);
}

export function computeAvailability(
  buckets: ScopeBuckets,
  config: Pick<GenerateConfig, 'totalQuestions' | 'dokDistribution' | 'bloomDistribution'>
): AvailabilityResult {
  const warnings: string[] = [];

  const dok: BucketAvailability[] = config.dokDistribution.map((d) => {
    const available = buckets.dokQuestions.get(d.id)?.length ?? 0;
    const req = required(config.totalQuestions, d.percentage);
    const short = req > available;
    if (short) warnings.push(`Need ${req} ${d.name} (DOK) question${req === 1 ? '' : 's'}, but only ${available} available.`);
    return { id: d.id, name: d.name, percentage: d.percentage, required: req, available, short };
  });

  const bloom: BucketAvailability[] = config.bloomDistribution.map((b) => {
    const available = buckets.bloomIds.get(b.id)?.size ?? 0;
    const req = required(config.totalQuestions, b.percentage);
    const short = req > available;
    if (short) warnings.push(`Need ${req} ${b.name} (Bloom) question${req === 1 ? '' : 's'}, but only ${available} available.`);
    return { id: b.id, name: b.name, percentage: b.percentage, required: req, available, short };
  });

  const totalAvailable = buckets.allById.size;
  return {
    totalAvailable,
    dok,
    bloom,
    warnings,
    canGenerate: totalAvailable >= config.totalQuestions && warnings.length === 0,
  };
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Select questions to satisfy the DOK distribution (primary, exact as far as
 * availability) while nudging toward the Bloom distribution (secondary) — the
 * corrected version of the Laravel algorithm (round per bucket + upward
 * fallback), using real level ids so it actually works.
 */
function selectQuestions(buckets: ScopeBuckets, config: GenerateConfig): AiQuestion[] {
  const total = config.totalQuestions;
  const bloomOf = (id: string): number | null => {
    for (const [level, ids] of buckets.bloomIds) if (ids.has(id)) return level;
    return null;
  };
  const bloomNeed = new Map<number, number>();
  config.bloomDistribution.forEach((b) => bloomNeed.set(b.id, required(total, b.percentage)));

  const selected: AiQuestion[] = [];
  const used = new Set<string>();
  const take = (q: AiQuestion) => {
    selected.push(q);
    used.add(q.id);
    const bl = bloomOf(q.id);
    if (bl != null && bloomNeed.has(bl)) bloomNeed.set(bl, (bloomNeed.get(bl) ?? 0) - 1);
  };
  const bloomStillNeeded = (q: AiQuestion): boolean => {
    const bl = bloomOf(q.id);
    return bl != null && (bloomNeed.get(bl) ?? 0) > 0;
  };

  // Primary: satisfy each DOK bucket's target, preferring questions whose Bloom
  // level is still under its target (nudges the Bloom distribution).
  for (const d of config.dokDistribution) {
    const want = required(total, d.percentage);
    if (want <= 0) continue;
    const pool = shuffle((buckets.dokQuestions.get(d.id) ?? []).filter((q) => !used.has(q.id)));
    pool.sort((a, b) => Number(bloomStillNeeded(b)) - Number(bloomStillNeeded(a)));
    let taken = 0;
    for (const q of pool) {
      if (taken >= want || selected.length >= total) break;
      take(q);
      taken += 1;
    }
  }

  // Upward fallback: fill any shortfall from the remaining pool (matches Laravel).
  if (selected.length < total) {
    for (const q of shuffle([...buckets.allById.values()].filter((x) => !used.has(x.id)))) {
      if (selected.length >= total) break;
      take(q);
    }
  }

  return selected.slice(0, total);
}

export function generatePaper(buckets: ScopeBuckets, config: GenerateConfig): GeneratedSet[] {
  const base = selectQuestions(buckets, config);
  const marks = config.marksPerQuestion || 1;

  const sectionConfigs =
    config.sections.length > 0
      ? config.sections
      : [{ name: 'A', questions: base.length }];

  const sets: GeneratedSet[] = [];
  const setCount = Math.max(1, config.generateSets);
  for (let s = 0; s < setCount; s += 1) {
    const ordered = s === 0 ? base : shuffle(base);
    const sections: GeneratedSection[] = [];
    let cursor = 0;
    sectionConfigs.forEach((sc, index) => {
      const slice = ordered.slice(cursor, cursor + sc.questions);
      cursor += sc.questions;
      sections.push({
        name: sc.name || String.fromCharCode(65 + index),
        questions: slice.map((q) => ({
          id: q.id,
          title: q.title,
          marks,
          questionTypeId: q.questionTypeId,
          chapterId: q.chapterId,
        })),
        totalMarks: slice.length * marks,
      });
    });
    const questionIds = ordered.map((q) => q.id);
    sets.push({
      setName: `Set ${String.fromCharCode(65 + s)}`,
      sections,
      totalQuestions: ordered.length,
      totalMarks: ordered.length * marks,
      questionIds,
    });
  }
  return sets;
}

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------

export interface SavePaperInput {
  gradeId: string;
  standardId: string;
  subjectId: string;
  paperName: string;
  paperDesc: string;
  examType: string;
  timeAllowed: number;
  attemptAllowed: number;
  openDate: string;
  closeDate: string;
  set: GeneratedSet;
  dokDistribution: DistributionEntry[];
  bloomDistribution: DistributionEntry[];
}

export interface SaveResult {
  id: number;
  message: string;
}

export async function saveAiPaper(input: SavePaperInput): Promise<SaveResult> {
  const session = requireSession();
  const body = {
    sub_institute_id: Number(session.subInstituteId),
    syear: session.syear,
    user_id: Number(session.userId),
    grade: Number(input.gradeId) || input.gradeId,
    standard: Number(input.standardId) || input.standardId,
    subject: Number(input.subjectId) || input.subjectId,
    paper_name: input.paperName,
    paper_desc: input.paperDesc,
    open_date: input.openDate,
    close_date: input.closeDate,
    time_allowed: input.timeAllowed,
    total_ques: input.set.totalQuestions,
    total_marks: input.set.totalMarks,
    attempt_allowed: input.attemptAllowed,
    exam_type: input.examType.toLowerCase(),
    question_ids: input.set.questionIds.map((id) => Number(id)),
    ai_generated: 1,
    difficulty_distribution: JSON.stringify(input.dokDistribution),
    taxonomy_distribution: JSON.stringify(input.bloomDistribution),
    sections_config: JSON.stringify(
      input.set.sections.map((sec) => ({ name: sec.name, questions: sec.questions.length, marks: sec.totalMarks }))
    ),
  };

  const res = await fetch(`${session.baseUrl}/api/question-paper`, {
    method: 'POST',
    headers: createAuthHeaders(session, 'application/json'),
    body: JSON.stringify(body),
  });
  const raw = await readJson(res, 'Failed to save the question paper');
  const status = String(raw.status_code ?? raw.status ?? '');
  if (!res.ok || (status !== '1' && status.toUpperCase() !== 'SUCCESS')) {
    throw new Error((raw.message as string) || 'Failed to save the question paper');
  }
  return { id: readNumber(raw.id), message: (raw.message as string) || 'AI question paper saved successfully.' };
}

/** Question-type id → label (matches the manual picker's map). */
export const QUESTION_TYPES: { id: string; label: string }[] = [
  { id: '1', label: 'MCQ' },
  { id: '2', label: 'True / False' },
  { id: '3', label: 'Short Answer' },
  { id: '4', label: 'Long Answer' },
  { id: '5', label: 'Fill in the Blank' },
];
