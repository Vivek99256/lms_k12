/**
 * An interactive Classroom Activity: the single JSON document stored in one content_master row (see the Laravel
 * `ClassroomActivityDocument`). Everything here is pure, so it can be tested without React.
 *
 * A document holds the textbook's own task card: its steps in the printed order and wording, the worksheet the card asks
 * learners to fill in, and a discussion prompt. It holds no results; a learner's measurements and answers are theirs.
 */

export type Origin = 'task_card' | 'textbook' | 'semantic_intelligence' | 'platform';

export interface Entry {
  text: string;
  origin: Origin;
}

export interface StepUse {
  block: string;
  /** A table: only these columns are asked at this step. */
  columns?: string[];
  /** A comparison: only the rows of this group are asked ('names' asks for the entities' names). */
  group?: string;
  /** A comparison: only these rows of the group. */
  rows?: string[];
  readOnly?: boolean;
}

export interface ActivityStep {
  n: number;
  id: string;
  text: string;
  /** Lines the card prints under the step (the features to compare, what the report has to contain). */
  items?: string[];
  timer?: { seconds: number; label?: string };
  uses?: StepUse[];
}

export interface TableBlock {
  id: string;
  kind: 'table';
  title: string;
  unit?: string;
  /** What the first column is called ("Surface"). */
  row_heading?: string;
  rows: { id: string; label: string }[];
  columns: { id: string; label: string; step?: number }[];
  /** `of` minus `minus`, worked out from what the learner entered. */
  derived?: { id: string; label: string; of: string; minus: string }[];
}

export interface CompareBlock {
  id: string;
  kind: 'compare';
  title: string;
  entities: { id: string; label: string; role?: string; hint?: string }[];
  rows: { id: string; group?: string; label: string; options?: string[] }[];
}

export interface NotesBlock {
  id: string;
  kind: 'notes';
  label: string;
  hint?: string;
}

export interface ReportBlock {
  id: string;
  kind: 'report';
  title_template: string;
  names_from: string;
  /** "[Country A]" -> the entity of `names_from` whose name replaces it. */
  tokens: Record<string, string>;
  sections: { id: string; label: string; min: number; max: number }[];
}

export type ActivityBlock = TableBlock | CompareBlock | NotesBlock | ReportBlock;

export interface ClassroomActivity {
  type: 'classroom_activity';
  version: 1;
  key: string;
  code: string;
  title: string;
  scope: { sub_institute_id: number; standard_id: number; subject_id: number; chapter_id: number };
  references?: Record<string, string>;
  intro: {
    purpose: string;
    objectives: Entry[];
    materials: Entry[];
    safety: Entry[];
    duration?: { minutes: number | null; note: string };
  };
  steps: ActivityStep[];
  blocks: ActivityBlock[];
  reflection: { id: string; step: number; prompt: string; origin?: Origin }[];
  expected?: { step: number; requires?: string; heading?: string; text: string };
  source?: { file?: string; pages?: string; textbook?: string };
}

const BLOCK_KINDS = ['table', 'compare', 'notes', 'report'];

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function fail(message: string): never {
  throw new Error(message);
}

function uniqueIds(entries: unknown[], where: string, labelled = true): Set<string> {
  const seen = new Set<string>();
  for (const entry of entries) {
    const e = entry as { id?: unknown; label?: unknown } | null;
    const id = text(e?.id);
    if (!id || seen.has(id) || (labelled && !text(e?.label))) fail(`${where} is incomplete.`);
    seen.add(id);
  }
  return seen;
}

/**
 * Check a document and return it typed. Throws a plain-language Error when the document is not an activity the player can
 * rely on, so a half-readable activity is never shown as if it were complete.
 */
export function parseClassroomActivity(raw: unknown): ClassroomActivity {
  const doc = raw as Partial<ClassroomActivity> | null;
  if (!doc || typeof doc !== 'object' || doc.type !== 'classroom_activity' || doc.version !== 1) {
    fail('This is not a classroom activity.');
  }
  if (!text(doc.key) || !text(doc.code) || !text(doc.title) || !text(doc.intro?.purpose)) {
    fail('This classroom activity is incomplete.');
  }
  if (list(doc.intro?.objectives).length === 0) fail('This classroom activity has no learning objective.');
  for (const group of ['objectives', 'materials', 'safety'] as const) {
    for (const entry of list(doc.intro?.[group])) {
      if (!text((entry as Entry)?.text)) fail('This classroom activity has an empty entry in its introduction.');
    }
  }

  const blocks = new Map<string, ActivityBlock>();
  for (const block of list(doc.blocks) as ActivityBlock[]) {
    const id = text(block?.id);
    if (!id || blocks.has(id) || !BLOCK_KINDS.includes(block?.kind)) fail('A worksheet in this classroom activity is incomplete.');
    blocks.set(id, block);
    if (block.kind === 'table') {
      const columns = uniqueIds(list(block.columns), 'A worksheet table');
      uniqueIds(list(block.rows), 'A worksheet table');
      if (columns.size === 0 || block.rows.length === 0) fail('A worksheet table has no rows or columns.');
      for (const d of list(block.derived) as NonNullable<TableBlock['derived']>) {
        if (!text(d?.id) || !columns.has(d.of) || !columns.has(d.minus)) fail('A worksheet table works out a column that does not exist.');
      }
    } else if (block.kind === 'compare') {
      if (uniqueIds(list(block.entities), 'A comparison').size < 2) fail('A comparison needs two things to compare.');
      uniqueIds(list(block.rows), 'A comparison');
    } else if (block.kind === 'notes') {
      if (!text(block.label)) fail('A notes box has no label.');
    } else {
      if (!text(block.title_template) || uniqueIds(list(block.sections), 'A report').size === 0) fail('A report is incomplete.');
      for (const s of block.sections) if (!(s.min >= 1 && s.max >= s.min)) fail('A report section has an impossible length.');
    }
  }
  for (const block of blocks.values()) {
    if (block.kind !== 'report') continue;
    const from = blocks.get(block.names_from);
    if (!from || from.kind !== 'compare') fail('A report takes its names from something that is not a comparison.');
    const ids = new Set(from.entities.map((e) => e.id));
    for (const entity of Object.values(block.tokens ?? {})) if (!ids.has(entity)) fail('A report names something that is not in the comparison.');
  }

  const steps = list(doc.steps) as ActivityStep[];
  if (steps.length === 0) fail('This classroom activity has no steps.');
  const seen = new Set<string>();
  steps.forEach((step, i) => {
    const id = text(step?.id);
    if (step?.n !== i + 1 || !id || seen.has(id) || !text(step?.text)) fail('The steps of this classroom activity are out of order or incomplete.');
    seen.add(id);
    if (step.timer && !(step.timer.seconds > 0)) fail('A timer in this classroom activity has no length.');
    for (const use of list(step.uses) as StepUse[]) {
      const block = blocks.get(use?.block);
      if (!block) fail('A step shows a worksheet that does not exist.');
      for (const column of use.columns ?? []) {
        if (block.kind !== 'table' || !block.columns.some((c) => c.id === column)) fail('A step asks for a column that does not exist.');
      }
      if (block.kind === 'compare') {
        const groups = new Set(block.rows.map((r) => r.group));
        if (use.group && use.group !== 'names' && !groups.has(use.group)) fail('A step asks for a group of rows that does not exist.');
        for (const row of use.rows ?? []) if (!block.rows.some((r) => r.id === row)) fail('A step asks for a row that does not exist.');
      }
    }
  });
  for (const r of list(doc.reflection) as NonNullable<ClassroomActivity['reflection']>) {
    if (!text(r?.id) || !text(r?.prompt) || !(r.step >= 1 && r.step <= steps.length)) fail('A reflection question in this classroom activity is incomplete.');
  }

  return { ...(doc as ClassroomActivity), blocks: [...blocks.values()], reflection: list(doc.reflection) as ClassroomActivity['reflection'] };
}

export function blockById(activity: ClassroomActivity, id: string): ActivityBlock | undefined {
  return activity.blocks.find((block) => block.id === id);
}

/** Where a learner's work on an activity is kept, so a shared device does not mix two learners. */
export function storageKey(contentId: number | string, userId: number | string | null): string {
  return `eduerp:classroom-activity:v1:${userId ?? 'anon'}:${contentId}`;
}
