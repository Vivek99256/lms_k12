// ---------------------------------------------------------------------------
// The template engine: blueprint + live exam data -> a paper ready to render.
//
// Two passes, and the order matters. Questions are placed into sections first,
// because placement depends only on the paper's own data; only then are the
// totals known, and only then can `{{total_marks}}` and friends be resolved.
// Resolving strings first would print the paper's stored total instead of the
// marks the template actually laid out.
// ---------------------------------------------------------------------------

import type {
  Blueprint,
  BlueprintSection,
  MetaField,
  NumberingStyle,
  PaperContext,
  PaperQuestion,
  PlacedQuestion,
  ResolvedPaper,
  ResolvedSection,
  SchoolBranding,
  SubNumberingStyle,
} from './types';

const ROMAN: Array<[number, string]> = [
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

export function toRoman(value: number): string {
  let remaining = Math.max(1, Math.floor(value));
  let out = '';

  while (remaining > 0) {
    // 10 is as far as the table goes; papers never number past a handful of
    // sections, and repeating X covers the rest.
    const entry = ROMAN.find(([weight]) => weight <= remaining);
    if (!entry) break;
    out += entry[1];
    remaining -= entry[0];
  }

  return out || 'I';
}

/** `index` is 0-based; `start` is the number the section begins at. */
export function numberLabel(
  index: number,
  start: number,
  style: NumberingStyle | SubNumberingStyle
): string {
  const ordinal = start + index;

  switch (style) {
    case 'upper-alpha':
      return String.fromCharCode(64 + ((ordinal - 1) % 26) + 1);
    case 'lower-alpha':
      return String.fromCharCode(96 + ((ordinal - 1) % 26) + 1);
    case 'roman':
      return toRoman(ordinal);
    case 'none':
      return '';
    default:
      return String(ordinal);
  }
}

/** 135 -> "2 Hours 15 Minutes". Blank when the paper sets no time limit. */
export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '';

  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  const parts: string[] = [];

  if (hours > 0) parts.push(`${hours} ${hours === 1 ? 'Hour' : 'Hours'}`);
  if (rest > 0) parts.push(`${rest} ${rest === 1 ? 'Minute' : 'Minutes'}`);

  return parts.join(' ');
}

export function formatDate(value: string): string {
  if (!value) return '';

  const parsed = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Marks print as "4" rather than "4.0", but a half mark still prints. */
export function formatMarks(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

function fillPlaceholders(text: string, values: Record<string, string>): string {
  if (!text) return '';

  return text.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (match, token: string) => {
    const key = token.toLowerCase();
    return key in values ? values[key] : match;
  });
}

function matchesType(question: PaperQuestion, wanted: string[]): boolean {
  if (wanted.length === 0) return false;
  const type = (question.question_type || '').trim().toLowerCase();
  return wanted.some((name) => name.trim().toLowerCase() === type);
}

/**
 * Pick this section's questions out of what earlier sections left behind.
 *
 * Sections consume from a shared pool in blueprint order, so a question is
 * never printed twice; whatever no section claims is reported as `unplaced`
 * rather than silently dropped.
 */
function selectQuestions(
  section: BlueprintSection,
  pool: PaperQuestion[],
  taken: Set<number>
): PaperQuestion[] {
  const available = pool.filter((question) => !taken.has(question.id));
  const { source } = section;
  let chosen: PaperQuestion[];

  switch (source.mode) {
    case 'types':
      chosen = available.filter((question) => matchesType(question, source.questionTypes));
      break;
    case 'points':
      chosen = available.filter((question) => source.points.includes(Number(question.points)));
      break;
    case 'chapters':
      chosen = available.filter(
        (question) => question.chapter_id != null && source.chapterIds.includes(question.chapter_id)
      );
      break;
    case 'manual':
      // Honour the order the template lists, not the order of the paper.
      chosen = source.questionIds
        .map((id) => available.find((question) => question.id === id))
        .filter((question): question is PaperQuestion => Boolean(question));
      break;
    case 'all':
    case 'rest':
    default:
      chosen = available;
      break;
  }

  // "Any two out of three" means three questions are printed, so an optional
  // group caps the section when no explicit limit was set.
  const optionalCap = section.optional.enabled ? section.optional.outOf : 0;
  const cap = source.limit > 0 ? source.limit : optionalCap;

  return cap > 0 ? chosen.slice(0, cap) : chosen;
}

/**
 * What the section is worth. With an optional group only the questions a
 * student must attempt count, which is what "any 2 of 3, 4 marks each" means
 * on a printed paper.
 */
function sectionMarks(section: BlueprintSection, questions: PlacedQuestion[]): number {
  const countable =
    section.optional.enabled && section.optional.attempt > 0
      ? questions.slice(0, Math.min(section.optional.attempt, questions.length))
      : questions;

  return countable.reduce((sum, placed) => sum + placed.marks, 0);
}

function resolveMetaFields(fields: MetaField[], values: Record<string, string>): MetaField[] {
  return fields
    .map((field) => ({
      label: fillPlaceholders(field.label, values),
      value: fillPlaceholders(field.value, values),
    }))
    .filter((field) => field.label !== '' || field.value !== '');
}

export function resolvePaper(
  blueprint: Blueprint,
  context: PaperContext,
  branding: SchoolBranding
): ResolvedPaper {
  const { paper, questions } = context;

  // --- Pass 1: place the questions --------------------------------------
  const taken = new Set<number>();
  const placements: Array<{
    section: BlueprintSection;
    questions: PlacedQuestion[];
    groupLabel: string;
  }> = [];
  let runningNumber = 0;

  blueprint.sections.forEach((section) => {
    const picked = selectQuestions(section, questions, taken);
    picked.forEach((question) => taken.add(question.id));

    const { numbering } = section;
    const start = numbering.restart ? numbering.start : runningNumber + 1;

    // Grouped sections spend a single question number on the whole section and
    // letter the questions inside it; ungrouped sections number each question.
    const grouped = numbering.groupAsParts && picked.length > 0;

    const placed: PlacedQuestion[] = picked.map((question, index) => {
      const label = grouped
        ? numbering.subStyle === 'none'
          ? ''
          : `(${numberLabel(index, 1, numbering.subStyle)})`
        : `${numbering.prefix}${numberLabel(index, start, numbering.style)}`;

      return {
        question,
        label,
        marks: Number(question.points) || 0,
      };
    });

    runningNumber = grouped ? start : start + picked.length - 1;

    placements.push({
      section,
      questions: placed,
      groupLabel: grouped ? `${numbering.prefix}${numberLabel(0, start, numbering.style)}` : '',
    });
  });

  const placedCount = placements.reduce((sum, entry) => sum + entry.questions.length, 0);
  const totalMarks = placements.reduce(
    (sum, entry) => sum + sectionMarks(entry.section, entry.questions),
    0
  );

  // --- Pass 2: resolve every string against the live data ----------------
  // Offline papers carry a time allowance without setting the online timer
  // flag, so the printed duration reads `time_allowed` either way.
  const duration = formatDuration(paper.time_allowed);

  const values: Record<string, string> = {
    school_name: branding.name,
    exam_name: paper.paper_name,
    paper_desc: paper.paper_desc,
    exam_type: paper.exam_type,
    subject: paper.subject_name,
    standard: paper.standard_name,
    grade: paper.grade_name,
    academic_year: paper.syear,
    date: formatDate(new Date().toISOString()),
    open_date: formatDate(paper.open_date),
    close_date: formatDate(paper.close_date),
    duration,
    time_allowed: paper.time_allowed ? String(paper.time_allowed) : '',
    // Marks come from the questions the template actually laid out; the
    // paper's own stored total only stands in when nothing was placed.
    total_marks: formatMarks(placedCount > 0 ? totalMarks : Number(paper.total_marks) || 0),
    total_questions: String(placedCount > 0 ? placedCount : paper.total_ques || 0),
    section_title: '',
    section_marks: '',
  };

  const sections: ResolvedSection[] = placements.map(({ section, questions: placed, groupLabel }) => {
    const marks = sectionMarks(section, placed);
    const scoped: Record<string, string> = {
      ...values,
      section_title: section.title,
      section_marks: formatMarks(marks),
    };

    const optionalLabel =
      section.optional.enabled && section.optional.attempt > 0
        ? fillPlaceholders(section.optional.label, {
            ...scoped,
            attempt: String(section.optional.attempt),
            outof: String(section.optional.outOf || placed.length),
            out_of: String(section.optional.outOf || placed.length),
          })
        : '';

    return {
      section,
      groupLabel,
      title: fillPlaceholders(section.title, scoped),
      subtitle: fillPlaceholders(section.subtitle, scoped),
      note: fillPlaceholders(section.note, scoped),
      instructions: section.instructions.map((item) => fillPlaceholders(item, scoped)),
      marksLabel: fillPlaceholders(section.marksLabel, scoped),
      optionalLabel,
      questions: placed,
      marks,
    };
  });

  return {
    header: {
      schoolName: blueprint.header.showSchoolName ? branding.name : '',
      logoUrl: blueprint.header.showLogo ? branding.logoUrl : null,
      title: fillPlaceholders(blueprint.header.title, values),
      subtitle: fillPlaceholders(blueprint.header.subtitle, values),
      metaLeft: resolveMetaFields(blueprint.header.metaLeft, values),
      metaRight: resolveMetaFields(blueprint.header.metaRight, values),
      studentFields: blueprint.header.showStudentFields ? blueprint.header.studentFields : [],
      rule: blueprint.header.rule,
      align: blueprint.header.align,
    },
    instructions: {
      ...blueprint.instructions,
      title: fillPlaceholders(blueprint.instructions.title, values),
      items: blueprint.instructions.items.map((item) => fillPlaceholders(item, values)),
    },
    sections,
    footer: {
      ...blueprint.footer,
      text: fillPlaceholders(blueprint.footer.text, values),
    },
    totalMarks,
    totalQuestions: placedCount,
    unplaced: questions.filter((question) => !taken.has(question.id)),
  };
}

/** The label an instruction list item carries, per the chosen numbering. */
export function instructionMarker(index: number, style: Blueprint['instructions']['numbering']): string {
  switch (style) {
    case 'paren':
      return `(${index + 1})`;
    case 'lower-alpha':
      return `${String.fromCharCode(97 + (index % 26))}.`;
    case 'roman':
      return `${toRoman(index + 1)}.`;
    case 'bullet':
      return '•';
    case 'none':
      return '';
    default:
      return `${index + 1}.`;
  }
}
