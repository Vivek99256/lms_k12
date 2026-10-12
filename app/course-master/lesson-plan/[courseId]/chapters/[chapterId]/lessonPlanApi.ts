import { appendCommonParams, buildSessionContext, createAuthHeaders, readString } from '@/lib/erp-client';

/**
 * Lesson Plan (LMS + PAL → Lesson Plan → Chapter) data layer.
 *
 * Reads the EXISTING lesson plan module — nothing here is a new table or API:
 *
 *   GET {erp}/lms/lms_lessonplan?type=API&standard_id=&subject_id=&chapter_id=
 *       → lms_lesson_plan (+ standard / subject / chapter / topic relations)
 *       → lms_lessonplan_dayswise (as `lesson_days`)
 *       → lms_mapping_type lookups (`mapType`, `mapVal`) used to resolve `mapping_value`
 *       → `selfstudy_activities` (content_master rows per day, keyed by day-wise row id)
 *
 * It is the same endpoint (lms_lessonplanController@index) that renders the legacy
 * Blade page, so the data shown here is exactly the data shown there.
 *
 * The column → section assignment below mirrors the legacy table
 * (Summary of lesson plan / Teaching / Learning / Day Planning / Map & alignment).
 */

export type FieldDef = { key: string; label: string };
export type LessonPlanField = FieldDef & { value: string };

// ---- Section schema (mirrors add_lessonplan.blade.php, column by column) ----

/** Summary column. `standard`, `subject` and `chapter` are resolved from relations. */
export const SUMMARY_FIELDS: FieldDef[] = [
  { key: 'standard', label: 'Standard' },
  { key: 'subject', label: 'Subject' },
  { key: 'chapter', label: 'Chapter' },
  { key: 'numberofperiod', label: 'Number of period' },
  { key: 'teachingtime', label: 'Teaching time' },
  { key: 'assessmenttime', label: 'Assessment time' },
  { key: 'learningtime', label: 'Learning time' },
  { key: 'assessmentqualifying', label: 'Assessment qualifying' },
];

export const TEACHING_FIELDS: FieldDef[] = [
  { key: 'focauspoint', label: 'Focus point' },
  { key: 'pedagogicalprocess', label: 'Pedagogical process' },
  { key: 'resource', label: 'Resource' },
  { key: 'classroompresentation', label: 'Classroom presentation' },
  { key: 'classroomdiversity', label: 'Classroom diversity' },
];

export const LEARNING_FIELDS: FieldDef[] = [
  { key: 'learningobjective', label: 'Learning objective' },
  { key: 'learningknowledge', label: 'Learning outcome: knowledge' },
  { key: 'learningskill', label: 'Learning outcome: skill' },
  { key: 'prerequisite', label: 'Prerequisite lessons' },
  { key: 'selfstudyhomework', label: 'Self-study & homework' },
  { key: 'assessment', label: 'Assessment' },
];

export const ALIGNMENT_FIELDS: FieldDef[] = [
  { key: 'hardword', label: 'Hard word with image' },
  { key: 'tagmetatag', label: 'Tag & metatag' },
  { key: 'valueintegration', label: 'Value integrations' },
  { key: 'globalconnection', label: 'Global connection' },
  { key: 'crosscurriculum', label: 'Cross curriculum' },
  { key: 'sel', label: 'SEL (social & emotional learning)' },
  { key: 'stem', label: 'STEM' },
  { key: 'vocationaltraining', label: 'Vocational training' },
  { key: 'simulation', label: 'Simulation' },
  { key: 'games', label: 'Games' },
  { key: 'activities', label: 'Activities' },
  { key: 'reallifeapplication', label: 'Real life application' },
];

/** lms_lessonplan_dayswise columns, labelled as in the day-wise entry form. */
export const DAY_FIELDS: FieldDef[] = [
  { key: 'topicname', label: 'Topic' },
  { key: 'classtime', label: 'Class time' },
  { key: 'duringcontent', label: 'During content' },
  { key: 'assessmentqualifying', label: 'Assessment qualifying' },
  { key: 'learningobjective', label: 'Learning objective' },
  { key: 'learningoutcome', label: 'Learning outcome' },
  { key: 'pedagogicalprocess', label: 'Pedagogical process' },
  { key: 'resource', label: 'Resource' },
  { key: 'closure', label: 'Closure' },
  { key: 'selfstudyhomework', label: 'Self-study & homework' },
  { key: 'assessment', label: 'Assessment' },
];

// ---- Normalised model ----

export type MappingRow = { type: string; value: string };
export type SelfStudyActivity = { id: string; title: string; href: string };

export type LessonPlanDay = {
  id: string;
  /** The stored `days` value (1-based day number). */
  day: number;
  values: Record<string, string>;
  activities: SelfStudyActivity[];
};

export type LessonPlanData = {
  /** lms_lesson_plan.id — empty when no lesson plan exists for this chapter yet. */
  id: string;
  exists: boolean;
  standardId: string;
  subjectId: string;
  chapterId: string;
  standardName: string;
  subjectName: string;
  chapterName: string;
  summary: LessonPlanField[];
  teaching: LessonPlanField[];
  learning: LessonPlanField[];
  alignment: LessonPlanField[];
  /** Resolved `mapping_value` rows (Mapping type → Mapping value). */
  mapping: MappingRow[];
  days: LessonPlanDay[];
};

// ---- Helpers ----

type Rec = Record<string, unknown>;

function asRecord(value: unknown): Rec {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Rec) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** PHP encodes id-keyed arrays as an object — or as a list when the keys happen to be 0..n. */
function lookup(source: unknown, key: string): unknown {
  if (Array.isArray(source)) return source[Number(key)];
  return asRecord(source)[key];
}

function text(value: unknown): string {
  return readString(value);
}

/** True when a stored value has no visible content (handles empty TinyMCE markup like `<p>&nbsp;</p>`). */
export function isEmptyValue(value: string): boolean {
  return (
    value
      .replace(/<(?!img\b)[^>]*>/gi, '')
      .replace(/&nbsp;|&#160;/gi, ' ')
      .trim() === ''
  );
}

function pickFields(defs: FieldDef[], source: Rec): LessonPlanField[] {
  return defs.map((def) => ({ ...def, value: text(source[def.key]) }));
}

function resolveMapping(raw: unknown, mapType: unknown, mapVal: unknown): MappingRow[] {
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    if (!raw.trim()) return [];
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  return Object.entries(asRecord(parsed)).map(([typeId, valueId]) => ({
    type: text(lookup(mapType, typeId)) || '-',
    value: text(lookup(lookup(mapVal, typeId), text(valueId))) || '-',
  }));
}

function joinUrl(base: string, folder: string, filename: string): string {
  const path = `${folder.replace(/\/+$/, '')}/${filename.replace(/^\/+/, '')}`;
  return /^https?:\/\//i.test(path) ? path : `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

export async function fetchLessonPlan(
  ids: { standardId: string; subjectId: string; chapterId: string },
  signal?: AbortSignal
): Promise<LessonPlanData> {
  const session = buildSessionContext();
  if (!session.baseUrl || !session.subInstituteId) {
    throw new Error('Session data is missing. Please sign in again.');
  }

  const url = new URL(`${session.baseUrl}/lms/lms_lessonplan`);
  appendCommonParams(url.searchParams, session);
  url.searchParams.set('standard_id', ids.standardId);
  url.searchParams.set('subject_id', ids.subjectId);
  url.searchParams.set('chapter_id', ids.chapterId);

  const response = await fetch(url.toString(), { headers: createAuthHeaders(session), signal });
  if (!response.ok) throw new Error("Couldn't load the lesson plan. Try again.");

  const body = (await response.text()).trim();
  let payload: Rec;
  try {
    payload = asRecord(JSON.parse(body));
  } catch {
    throw new Error("Couldn't load the lesson plan. Try again.");
  }

  const plan = asRecord(payload.lessonplan_data);
  const id = text(plan.id);
  const standard = asRecord(plan.standard);
  const subject = asRecord(plan.subject);
  const chapter = asRecord(plan.chapter);

  const standardName = text(standard.name);
  const subjectName = text(subject.subject_name);
  const chapterName = text(chapter.chapter_name);

  const source: Rec = { ...plan, standard: standardName, subject: subjectName, chapter: chapterName };

  const selfStudy = asRecord(payload.selfstudy_activities);
  const days: LessonPlanDay[] = asArray(plan.lesson_days)
    .map((entry, index): LessonPlanDay => {
      const row = asRecord(entry);
      const rowId = text(row.id);
      const values: Record<string, string> = {};
      for (const def of DAY_FIELDS) values[def.key] = text(row[def.key]);
      const activities = asArray(selfStudy[rowId]).map((item) => {
        const activity = asRecord(item);
        return {
          id: text(activity.id),
          title: text(activity.title),
          href: joinUrl(session.baseUrl, text(activity.file_folder), text(activity.filename)),
        };
      });
      return { id: rowId || String(index), day: Number(row.days) || index + 1, values, activities };
    })
    .sort((a, b) => a.day - b.day);

  return {
    id,
    exists: id !== '',
    standardId: text(plan.standard_id) || ids.standardId,
    subjectId: text(plan.subject_id) || ids.subjectId,
    chapterId: text(plan.chapter_id) || ids.chapterId,
    standardName,
    subjectName,
    chapterName,
    summary: pickFields(SUMMARY_FIELDS, source),
    teaching: pickFields(TEACHING_FIELDS, source),
    learning: pickFields(LEARNING_FIELDS, source),
    alignment: pickFields(ALIGNMENT_FIELDS, source),
    mapping: resolveMapping(plan.mapping_value, payload.mapType, payload.mapVal),
    days,
  };
}

/** The legacy Laravel form (create / edit) — reused as-is so save logic is not duplicated. */
export function legacyLessonPlanFormUrl(plan: LessonPlanData): string {
  const { baseUrl } = buildSessionContext();
  const root = `${baseUrl.replace(/\/+$/, '')}/lms/lms_lessonplan/create`;
  if (plan.exists) return `${root}?id=${encodeURIComponent(plan.id)}`;
  const params = new URLSearchParams({
    standard_id: plan.standardId,
    subject_id: plan.subjectId,
    chapter_id: plan.chapterId,
    view: 'create',
  });
  return `${root}?${params.toString()}`;
}
