/**
 * Node colour for the Knowledge Graph browser canvas, keyed by the real
 * Neo4j label (`KgNodeInput.entityKey`) — a real graph record is a domain
 * entity, not a "module"/"submodule"/"functionality" the way the left-hand
 * tree is, so the user's suggested module/submodule/functionality palette
 * is realised here at the domain-category level instead: people-ish labels
 * cyan, academic/concept labels purple, assessment labels pink, content
 * labels teal, org-structure labels blue, finance green, operations amber,
 * skills indigo — one colour per real category, never per UI role.
 *
 * Keyword-matched against the label text, same approach as
 * `ModuleGraphMapper`'s keyword dictionary on the backend (one dictionary
 * covering many real labels instead of hand-listing each GraphSchema label).
 * An unmatched label falls back to slate rather than guessing.
 */
export interface CategoryColor {
  key: string;
  label: string;
  bg: string;
  ring: string;
  dot: string;
}

const CATEGORY_COLOR: Record<string, CategoryColor> = {
  blue: { key: 'blue', label: 'Organization', bg: 'bg-blue-500', ring: 'ring-blue-300', dot: '#3b82f6' },
  cyan: { key: 'cyan', label: 'People & students', bg: 'bg-cyan-500', ring: 'ring-cyan-300', dot: '#06b6d4' },
  purple: { key: 'purple', label: 'Academic', bg: 'bg-purple-500', ring: 'ring-purple-300', dot: '#a855f7' },
  pink: { key: 'pink', label: 'Assessment & questions', bg: 'bg-pink-500', ring: 'ring-pink-300', dot: '#ec4899' },
  teal: { key: 'teal', label: 'Content', bg: 'bg-teal-500', ring: 'ring-teal-300', dot: '#14b8a6' },
  green: { key: 'green', label: 'Finance', bg: 'bg-green-500', ring: 'ring-green-300', dot: '#22c55e' },
  amber: { key: 'amber', label: 'Operations', bg: 'bg-amber-500', ring: 'ring-amber-300', dot: '#f59e0b' },
  indigo: { key: 'indigo', label: 'Skills & careers', bg: 'bg-indigo-500', ring: 'ring-indigo-300', dot: '#6366f1' },
  slate: { key: 'slate', label: 'Other', bg: 'bg-slate-500', ring: 'ring-slate-300', dot: '#64748b' },
  standard: { key: 'standard', label: 'Standards', bg: 'bg-emerald-500', ring: 'ring-emerald-300', dot: '#10b981' },
  subject: { key: 'subject', label: 'Subjects', bg: 'bg-sky-500', ring: 'ring-sky-300', dot: '#0ea5e9' },
  chapter: { key: 'chapter', label: 'Chapters', bg: 'bg-orange-500', ring: 'ring-orange-300', dot: '#f97316' },
  topic: { key: 'topic', label: 'Topics', bg: 'bg-rose-500', ring: 'ring-rose-300', dot: '#f43f5e' },
  concept: { key: 'concept', label: 'Concepts', bg: 'bg-violet-500', ring: 'ring-violet-300', dot: '#8b5cf6' },
  curriculum: { key: 'curriculum', label: 'Curriculum', bg: 'bg-indigo-500', ring: 'ring-indigo-300', dot: '#6366f1' },
  unit: { key: 'unit', label: 'Units', bg: 'bg-cyan-500', ring: 'ring-cyan-300', dot: '#06b6d4' },
};

const ACADEMIC_ENTITY_COLOR: Record<string, CategoryColor> = {
  standard: CATEGORY_COLOR.standard,
  subject: CATEGORY_COLOR.subject,
  chapter: CATEGORY_COLOR.chapter,
  topic: CATEGORY_COLOR.topic,
  concept: CATEGORY_COLOR.concept,
  curriculum: CATEGORY_COLOR.curriculum,
  unit: CATEGORY_COLOR.unit,
};

const KEYWORD_CATEGORY: Array<[string, keyof typeof CATEGORY_COLOR]> = [
  // people / users
  ['student', 'cyan'],
  ['studetail', 'cyan'],
  ['staff', 'cyan'],
  ['teacher', 'cyan'],
  // academic / concepts / curriculum
  ['concept', 'purple'],
  ['curriculum', 'purple'],
  ['chapter', 'purple'],
  ['topic', 'purple'],
  ['unit', 'purple'],
  ['subject', 'purple'],
  ['standard', 'purple'],
  ['competency', 'purple'],
  // assessment / questions
  ['question', 'pink'],
  ['assessment', 'pink'],
  ['exam', 'pink'],
  ['result', 'pink'],
  ['grade', 'pink'],
  ['counselling', 'pink'],
  // content
  ['content', 'teal'],
  ['teachingresource', 'teal'],
  ['lesson', 'teal'],
  ['book', 'teal'],
  // finance
  ['fee', 'green'],
  ['bank', 'green'],
  ['donation', 'green'],
  ['receiptbook', 'green'],
  // org structure
  ['institute', 'blue'],
  ['department', 'blue'],
  ['role', 'blue'],
  ['division', 'blue'],
  ['gradescheme', 'blue'],
  // skills / careers
  ['skill', 'indigo'],
  ['jobrole', 'indigo'],
  ['jobtask', 'indigo'],
  ['sqaa', 'indigo'],
  ['career', 'indigo'],
  ['industry', 'indigo'],
  // operations (fallback bucket — checked last)
  ['hostel', 'amber'],
  ['transport', 'amber'],
  ['vehicle', 'amber'],
  ['route', 'amber'],
  ['stop', 'amber'],
  ['driver', 'amber'],
  ['inventory', 'amber'],
  ['vendor', 'amber'],
  ['visitor', 'amber'],
  ['circular', 'amber'],
  ['complaint', 'amber'],
  ['payroll', 'amber'],
  ['leave', 'amber'],
  ['holiday', 'amber'],
  ['salary', 'amber'],
  ['shift', 'amber'],
];

export function categoryColor(entityKey?: string | null): CategoryColor {
  if (!entityKey || typeof entityKey !== 'string') {
    return CATEGORY_COLOR.slate;
  }

  const haystack = entityKey.toLowerCase();

  if (ACADEMIC_ENTITY_COLOR[haystack]) {
    return ACADEMIC_ENTITY_COLOR[haystack];
  }

  for (const [keyword, category] of KEYWORD_CATEGORY) {
    if (haystack.includes(keyword)) {
      return CATEGORY_COLOR[category];
    }
  }

  return CATEGORY_COLOR.slate;
}

/** The distinct categories actually present, for the legend — never the full dictionary. */
export function categoriesPresent(entityKeys: Iterable<string | undefined | null>): Array<{ key: string; color: CategoryColor }> {
  const seen = new Map<string, CategoryColor>();

  for (const entityKey of entityKeys) {
    if (!entityKey || typeof entityKey !== 'string') continue;
    const color = categoryColor(entityKey);
    if (!seen.has(color.key)) seen.set(color.key, color);
  }

  return Array.from(seen.entries()).map(([key, color]) => ({ key, color }));
}
