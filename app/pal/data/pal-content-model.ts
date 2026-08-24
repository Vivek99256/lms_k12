import { headers } from 'next/headers';
import {
  fetchSemanticIntelligenceChapters,
  fetchSemanticIntelligenceResult,
  type SemanticIntelligenceResult,
} from '@/app/course-master/data/chapters';

export type FrameworkSlug =
  | 'casel-sel-integration'
  | 'ngss-stem-framework'
  | 'ncdg-career-development'
  | 'pedagogy-types'
  | 'music-framework'
  | 'sports-framework'
  | 'finance-framework';

export type UluSlug =
  | 'five-layer-structure'
  | 'scenario-template'
  | 'complete-examples'
  | 'content-optimization-loop';

export interface PalSourceItem {
  title: string;
  detail?: string;
  meta?: string[];
}

export interface PalSection {
  title: string;
  description: string;
  items: PalSourceItem[];
}

export interface PalModuleView {
  slug: string;
  title: string;
  subtitle: string;
  summary: string;
  badges: string[];
  sections: PalSection[];
  emptyMessage: string;
}

export interface PalConceptContext {
  chapterId: string;
  conceptParam: string;
  conceptTitle: string;
  subjectName: string;
  chapterTitle: string;
}

export interface PalContentModelResponse {
  context: PalConceptContext | null;
  frameworkModules: Record<FrameworkSlug, PalModuleView>;
  uluModules: Record<UluSlug, PalModuleView>;
  error: string;
  isReady: boolean;
}

interface SemanticConceptEntry {
  concept?: Record<string, unknown>;
  knowledge_items?: unknown[];
  abilities?: unknown[];
  skills?: unknown[];
  competencies?: unknown[];
  blooms?: unknown[];
  dok?: unknown[];
  prerequisites?: unknown[];
  misconceptions?: unknown[];
  real_world_applications?: unknown[];
  pedagogy_recommendations?: unknown[];
  learning_objectives?: unknown[];
  learning_outcomes?: unknown[];
  assessment_blueprint?: unknown[];
  concept_relationships?: unknown[];
  evidence?: unknown[];
  assessment_rubrics?: Record<string, unknown> | null;
  agent_reasoning?: Record<string, unknown> | null;
  [key: string]: unknown;
}

type SemanticResultRecord = SemanticIntelligenceResult & Record<string, unknown>;

export const FRAMEWORK_META: Record<FrameworkSlug, { title: string; subtitle: string }> = {
  'casel-sel-integration': {
    title: 'CASEL / SEL Integration',
    subtitle: 'Social-emotional and human-development evidence extracted for the selected concept.',
  },
  'ngss-stem-framework': {
    title: 'NGSS / STEM Framework',
    subtitle: 'Science, mathematics, inquiry, modeling, and practice signals present in semantic intelligence.',
  },
  'ncdg-career-development': {
    title: 'NCDG Career Development',
    subtitle: 'Career, pathway, occupation, and future-work intelligence for the selected concept.',
  },
  'pedagogy-types': {
    title: 'Pedagogy Types',
    subtitle: 'Pedagogy strategies and instructional methods derived from the live concept intelligence.',
  },
  'music-framework': {
    title: 'Music Framework',
    subtitle: 'Music, rhythm, performance, listening, or composition signals found in semantic intelligence.',
  },
  'sports-framework': {
    title: 'Sports Framework',
    subtitle: 'Sports, movement, teamwork, fitness, and physical-performance signals for the concept.',
  },
  'finance-framework': {
    title: 'Finance Framework',
    subtitle: 'Financial literacy, banking, pricing, saving, and market-related signals found in the concept data.',
  },
};

export const ULU_META: Record<UluSlug, { title: string; subtitle: string }> = {
  'five-layer-structure': {
    title: '5-Layer ULU Structure',
    subtitle: 'Academic, skill, application, support, and optimization layers built from the current concept intelligence.',
  },
  'scenario-template': {
    title: 'ULU Scenario Template',
    subtitle: 'Scenario-building ingredients derived from real-world application, pedagogy, misconception, and competency signals.',
  },
  'complete-examples': {
    title: '6 Complete ULU Examples',
    subtitle: 'Example learning-unit bundles assembled dynamically from the selected concept’s semantic evidence.',
  },
  'content-optimization-loop': {
    title: 'Content Optimization Loop',
    subtitle: 'Assessment, rigor, rubric, evidence, and misconception signals available to improve the learning unit.',
  },
};

function asText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function parseJsonLike(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) return value;
  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  const looksJson =
    (first === '[' && last === ']') ||
    (first === '{' && last === '}');

  if (!looksJson) return value;

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return value;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    const parsed = parseJsonLike(value);
    if (parsed !== value) return asRecord(parsed);
  }
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  if (typeof value === 'string') {
    const parsed = parseJsonLike(value);
    if (parsed !== value) return asArray(parsed);
  }
  return Array.isArray(value) ? value : [];
}

function toRecordArray(value: unknown): Record<string, unknown>[] {
  return asArray(value)
    .map((item) => asRecord(item))
    .filter((item) => Object.keys(item).length > 0);
}

function flattenText(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    if (typeof value === 'string') {
      const parsed = parseJsonLike(value);
      if (parsed !== value) return flattenText(parsed);
    }
    const text = asText(value);
    return text ? [text] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenText(item));
  }
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).flatMap((item) => flattenText(item));
  }
  return [];
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function take<T>(items: T[], count: number): T[] {
  return items.slice(0, count);
}

function compactMeta(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean);
}

function decodeText(value: string) {
  return value
    .replace(/â€™/g, '’')
    .replace(/â€œ/g, '“')
    .replace(/â€/g, '”')
    .replace(/Â·/g, '·')
    .replace(/â€“/g, '–')
    .replace(/â€”/g, '—')
    .replace(/â†“/g, '↓');
}

function itemFromUnknown(value: unknown, label?: string): PalSourceItem | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    if (typeof value === 'string') {
      const parsed = parseJsonLike(value);
      if (parsed !== value) return itemFromUnknown(parsed, label);
    }
    const title = decodeText(asText(value));
    if (!title) return null;
    return {
      title,
      meta: label ? [label] : undefined,
    };
  }

  const record = asRecord(value);
  const entries = Object.entries(record).filter(([, entry]) => asText(entry));
  if (entries.length === 0) return null;

  const titleCandidates = [
    'title',
    'concept_name',
    'concept',
    'knowledge',
    'ability',
    'skill',
    'competency',
    'statement',
    'objective',
    'outcome',
    'strategy',
    'application_type',
    'application',
    'example',
    'misconception',
    'level',
    'description',
    'assessment_type',
    'recommended_question',
    'question',
    'source_concept',
    'target_concept',
    'relation_type',
    'source_text',
  ];

  const detailCandidates = [
    'definition',
    'description',
    'statement',
    'why_effective',
    'activity',
    'example',
    'application',
    'root_cause',
    'correction',
    'recommended_question',
    'question',
    'source_text',
    'teaching_notes',
  ];

  const title =
    titleCandidates.map((key) => asText(record[key])).find(Boolean) ||
    entries.map(([, entry]) => asText(entry)).find(Boolean) ||
    '';

  if (!title) return null;

  const detail =
    detailCandidates
      .map((key) => asText(record[key]))
      .find((candidate) => candidate && candidate !== title) || '';

  const meta = compactMeta([
    label ?? '',
    ...entries
      .filter(([key, entry]) => {
        const text = asText(entry);
        return text && text !== title && text !== detail && !titleCandidates.includes(key) && !detailCandidates.includes(key);
      })
      .slice(0, 4)
      .map(([key, entry]) => `${key.replace(/_/g, ' ')}: ${asText(entry)}`),
  ]);

  return {
    title: decodeText(title),
    detail: detail ? decodeText(detail) : undefined,
    meta: meta.length > 0 ? meta.map(decodeText) : undefined,
  };
}

function buildItemsFromUnknown(values: unknown, label?: string, limit = 8): PalSourceItem[] {
  return take(
    asArray(values)
      .map((entry) => itemFromUnknown(entry, label))
      .filter((entry): entry is PalSourceItem => Boolean(entry)),
    limit
  );
}

function buildItems(
  records: unknown,
  titleKeys: string[],
  detailKeys: string[],
  metaKeys: string[] = [],
  limit = 8
): PalSourceItem[] {
  const normalized = toRecordArray(records)
    .map((record) => {
      const title = titleKeys.map((key) => asText(record[key])).find(Boolean) ?? '';
      if (!title) return itemFromUnknown(record);
      const detail =
        detailKeys.map((key) => asText(record[key])).find((value) => value && value !== title) ?? '';
      const meta = compactMeta(metaKeys.map((key) => asText(record[key])));

      return {
        title: decodeText(title),
        detail: detail ? decodeText(detail) : undefined,
        meta: meta.length > 0 ? meta.map(decodeText) : undefined,
      } satisfies PalSourceItem;
    })
    .filter((entry): entry is PalSourceItem => Boolean(entry));

  if (normalized.length > 0) return take(normalized, limit);
  return buildItemsFromUnknown(records, undefined, limit);
}

function buildListItems(values: string[], label?: string, limit = 8): PalSourceItem[] {
  return take(
    unique(values).map((value) => ({
      title: decodeText(value),
      meta: label ? [label] : undefined,
    })),
    limit
  );
}

function findKeywordMatches(values: string[], keywords: string[], limit = 8): PalSourceItem[] {
  const lowered = keywords.map((keyword) => keyword.toLowerCase());
  return take(
    unique(values)
      .filter((value) => lowered.some((keyword) => value.toLowerCase().includes(keyword)))
      .map((value) => ({ title: decodeText(value) })),
    limit
  );
}

function buildSection(title: string, description: string, items: PalSourceItem[]): PalSection | null {
  const filtered = items.filter((item) => item.title.trim());
  if (filtered.length === 0) return null;
  return { title, description, items: filtered };
}

function getSemanticBlob(record: SemanticResultRecord) {
  return asRecord(record.full_intelegance_json ?? record.full_intelligence_json);
}

function getConceptEntries(record: SemanticResultRecord): SemanticConceptEntry[] {
  return asArray(getSemanticBlob(record).concepts)
    .map((item) => asRecord(item) as SemanticConceptEntry)
    .filter((item) => Object.keys(item).length > 0);
}

function resolveConceptEntry(entries: SemanticConceptEntry[], conceptParam: string) {
  if (entries.length === 0) return { entry: null, conceptIndex: 0 };

  if (/^\d+$/.test(conceptParam)) {
    const numericIndex = Number(conceptParam);
    const bounded = Math.min(Math.max(numericIndex, 0), entries.length - 1);
    return { entry: entries[bounded], conceptIndex: bounded };
  }

  const lowered = conceptParam.toLowerCase();
  const foundIndex = entries.findIndex(
    (entry) => asText(entry.concept?.concept_name).toLowerCase() === lowered
  );
  if (foundIndex >= 0) return { entry: entries[foundIndex], conceptIndex: foundIndex };

  return { entry: entries[0], conceptIndex: 0 };
}

function inferChapterTitle(record: SemanticResultRecord): string {
  const blob = getSemanticBlob(record);
  const summary = asText(blob.chapter_summary);
  if (summary) return decodeText(summary);
  const mdTitle = asText(record.md_content)
    .split('\n')
    .find((line) => line.trim().startsWith('#'));
  return mdTitle
    ? decodeText(mdTitle.replace(/^#+\s*/, '').trim())
    : `Chapter ${asText(record.chapter_id) || 'Semantic Intelligence'}`;
}

function conceptList(
  entry: SemanticConceptEntry | null,
  record: SemanticResultRecord,
  conceptKey: keyof SemanticConceptEntry,
  chapterKey: keyof SemanticResultRecord
): unknown[] {
  const conceptValues = asArray(entry?.[conceptKey]);
  if (conceptValues.length > 0) return conceptValues;
  return asArray(record[chapterKey]);
}

function conceptStrings(
  entry: SemanticConceptEntry | null,
  record: SemanticResultRecord,
  conceptKey: keyof SemanticConceptEntry,
  chapterKey: keyof SemanticResultRecord
): string[] {
  const conceptValues = flattenText(entry?.[conceptKey]);
  if (conceptValues.length > 0) return unique(conceptValues.map(decodeText));
  return unique(flattenText(record[chapterKey]).map(decodeText));
}

function buildContext(
  record: SemanticResultRecord,
  entry: SemanticConceptEntry | null,
  chapterId: string,
  conceptParam: string
): PalConceptContext {
  const conceptTitle = decodeText(asText(entry?.concept?.concept_name) || 'Concept Intelligence');
  return {
    chapterId,
    conceptParam,
    conceptTitle,
    subjectName: decodeText(asText(record.subject_name) || 'Subject not available'),
    chapterTitle: inferChapterTitle(record),
  };
}

function buildFrameworkModules(
  record: SemanticResultRecord,
  entry: SemanticConceptEntry | null
): Record<FrameworkSlug, PalModuleView> {
  const allText = unique([
    ...flattenText(entry),
    ...flattenText(record.learning_objective),
    ...flattenText(record.learning_objectives),
    ...flattenText(record.learning_outcomes),
    ...flattenText(record.knowledge),
    ...flattenText(record.skill),
    ...flattenText(record.competency),
    ...flattenText(record.real_world_applications),
    ...flattenText(record.pedagogy),
    ...flattenText(record.assessment_blueprint),
  ]).map(decodeText);

  const pedagogyRecords = conceptList(entry, record, 'pedagogy_recommendations', 'pedagogy');
  const skillsRecords = conceptList(entry, record, 'skills', 'skill');
  const competencyRecords = conceptList(entry, record, 'competencies', 'competency');
  const realWorldRecords = conceptList(entry, record, 'real_world_applications', 'real_world_applications');
  const abilityRecords = conceptList(entry, record, 'abilities', 'ability');
  const objectives = conceptList(entry, record, 'learning_objectives', 'learning_objectives');
  const outcomes = conceptList(entry, record, 'learning_outcomes', 'learning_outcomes');
  const evidence = conceptList(entry, record, 'evidence', 'full_intelegance_json');

  return {
    'casel-sel-integration': {
      slug: 'casel-sel-integration',
      title: FRAMEWORK_META['casel-sel-integration'].title,
      subtitle: FRAMEWORK_META['casel-sel-integration'].subtitle,
      summary: 'Framework intelligence filtered to SEL, behaviour, awareness, empathy, and decision-making patterns from the active semantic record.',
      badges: ['semantic intelligence', 'CASEL / SEL', 'dynamic'],
      emptyMessage: 'No explicit CASEL / SEL signals were found in the current semantic intelligence record.',
      sections: [
        buildSection(
          'SEL signal matches',
          'Direct semantic-intelligence text that refers to SEL, self-awareness, self-management, relationships, empathy, or responsible decisions.',
          findKeywordMatches(allText, [
            'casel',
            'sel',
            'self-awareness',
            'self management',
            'social awareness',
            'relationship',
            'responsible decision',
            'emotion',
            'empathy',
            'reflection',
          ])
        ),
        buildSection(
          'Competency evidence',
          'Competency items that align with behaviour, self-regulation, or learner-growth signals.',
          buildItems(competencyRecords, ['competency', 'statement'], ['statement'], ['concept_name'], 8)
        ),
        buildSection(
          'Learning intent',
          'Objectives and outcomes that can be connected to social-emotional development.',
          [
            ...buildItems(objectives, ['objective'], ['objective'], ['objective_type', 'priority', 'concept_name'], 4),
            ...buildItems(outcomes, ['outcome'], ['outcome'], ['outcome_type', 'concept_name'], 4),
          ]
        ),
      ].filter((section): section is PalSection => Boolean(section)),
    },
    'ngss-stem-framework': {
      slug: 'ngss-stem-framework',
      title: FRAMEWORK_META['ngss-stem-framework'].title,
      subtitle: FRAMEWORK_META['ngss-stem-framework'].subtitle,
      summary: 'Framework intelligence filtered to inquiry, mathematics, science, modeling, evidence, experimentation, and applied practice.',
      badges: ['semantic intelligence', 'NGSS / STEM', 'dynamic'],
      emptyMessage: 'No explicit NGSS / STEM-style signals were found in the current semantic intelligence record.',
      sections: [
        buildSection(
          'STEM signal matches',
          'Direct references to science, mathematics, technology, engineering, modeling, data, or investigation.',
          findKeywordMatches(allText, [
            'ngss',
            'stem',
            'science',
            'mathematics',
            'math',
            'technology',
            'engineering',
            'investigation',
            'model',
            'data',
            'experiment',
            'evidence',
          ])
        ),
        buildSection(
          'Abilities and practices',
          'Ability items that can map to STEM practices such as modeling, reasoning, evidence use, and problem solving.',
          buildItems(abilityRecords, ['ability'], ['description'], ['verb', 'concept_name'], 8)
        ),
        buildSection(
          'Applied contexts',
          'Real-world semantic applications that can anchor STEM learning.',
          buildItems(realWorldRecords, ['application_type', 'application', 'example'], ['application', 'example'], ['relevance'], 8)
        ),
      ].filter((section): section is PalSection => Boolean(section)),
    },
    'ncdg-career-development': {
      slug: 'ncdg-career-development',
      title: FRAMEWORK_META['ncdg-career-development'].title,
      subtitle: FRAMEWORK_META['ncdg-career-development'].subtitle,
      summary: 'Framework intelligence filtered to occupation, work, pathway, professional, and future-role signals in the semantic record.',
      badges: ['semantic intelligence', 'career', 'dynamic'],
      emptyMessage: 'No explicit NCDG or career-development signals were found in the current semantic intelligence record.',
      sections: [
        buildSection(
          'Career signal matches',
          'Direct text references to roles, occupations, pathways, professions, advisors, analysts, or workplace contexts.',
          findKeywordMatches(allText, [
            'ncdg',
            'career',
            'profession',
            'job',
            'occupation',
            'pathway',
            'workplace',
            'advisor',
            'engineer',
            'scientist',
            'analyst',
            'business',
          ])
        ),
        buildSection(
          'Skill and competency links',
          'Skills and competencies that can contribute to a pathway or career interpretation.',
          [
            ...buildItems(skillsRecords, ['skill'], ['skill'], ['concept_name'], 5),
            ...buildItems(competencyRecords, ['competency', 'statement'], ['statement'], ['concept_name'], 5),
          ]
        ),
        buildSection(
          'Applied evidence',
          'Real-world examples and source evidence that can ground career exposure.',
          [
            ...buildItems(realWorldRecords, ['application_type', 'application', 'example'], ['application', 'example'], ['relevance'], 4),
            ...buildItems(evidence, ['source_text', 'source_type'], ['source_text'], ['source_type'], 4),
          ]
        ),
      ].filter((section): section is PalSection => Boolean(section)),
    },
    'pedagogy-types': {
      slug: 'pedagogy-types',
      title: FRAMEWORK_META['pedagogy-types'].title,
      subtitle: FRAMEWORK_META['pedagogy-types'].subtitle,
      summary: 'Teaching strategies, activity hints, and instruction patterns pulled directly from the semantic intelligence payload.',
      badges: ['semantic intelligence', 'pedagogy', 'dynamic'],
      emptyMessage: 'No pedagogy recommendations were found in the current semantic intelligence record.',
      sections: [
        buildSection(
          'Pedagogy recommendations',
          'Instructional strategies already stored for this concept.',
          buildItems(pedagogyRecords, ['strategy'], ['why_effective', 'activity'], ['concept_name'], 10)
        ),
        buildSection(
          'Objective alignment',
          'Objectives and outcomes that the current pedagogy can support.',
          [
            ...buildItems(objectives, ['objective'], ['objective'], ['objective_type', 'priority', 'concept_name'], 4),
            ...buildItems(outcomes, ['outcome'], ['outcome'], ['outcome_type', 'concept_name'], 4),
          ]
        ),
      ].filter((section): section is PalSection => Boolean(section)),
    },
    'music-framework': {
      slug: 'music-framework',
      title: FRAMEWORK_META['music-framework'].title,
      subtitle: FRAMEWORK_META['music-framework'].subtitle,
      summary: 'Music-specific framework intelligence generated only from the selected concept’s actual semantic payload.',
      badges: ['semantic intelligence', 'music', 'dynamic'],
      emptyMessage: 'No music-related intelligence was found in the current semantic intelligence record.',
      sections: [
        buildSection(
          'Music signal matches',
          'Direct references to music, rhythm, melody, sound, composition, listening, or performance.',
          findKeywordMatches(allText, [
            'music',
            'rhythm',
            'sound',
            'melody',
            'performance',
            'composition',
            'instrument',
            'listening',
          ])
        ),
      ].filter((section): section is PalSection => Boolean(section)),
    },
    'sports-framework': {
      slug: 'sports-framework',
      title: FRAMEWORK_META['sports-framework'].title,
      subtitle: FRAMEWORK_META['sports-framework'].subtitle,
      summary: 'Sports and movement intelligence rendered only when the semantic data actually contains those signals.',
      badges: ['semantic intelligence', 'sports', 'dynamic'],
      emptyMessage: 'No sports-related intelligence was found in the current semantic intelligence record.',
      sections: [
        buildSection(
          'Sports signal matches',
          'Direct references to sports, movement, players, teams, fitness, performance, or physical activity.',
          findKeywordMatches(allText, [
            'sport',
            'sports',
            'fitness',
            'movement',
            'team',
            'player',
            'performance',
            'physical',
            'game',
          ])
        ),
      ].filter((section): section is PalSection => Boolean(section)),
    },
    'finance-framework': {
      slug: 'finance-framework',
      title: FRAMEWORK_META['finance-framework'].title,
      subtitle: FRAMEWORK_META['finance-framework'].subtitle,
      summary: 'Financial-literacy intelligence assembled only from actual banking, money, pricing, saving, and market signals in the semantic record.',
      badges: ['semantic intelligence', 'finance', 'dynamic'],
      emptyMessage: 'No finance-related intelligence was found in the current semantic intelligence record.',
      sections: [
        buildSection(
          'Finance signal matches',
          'Direct references to finance, banking, budget, savings, interest, market, economy, money, or price.',
          findKeywordMatches(allText, [
            'finance',
            'financial',
            'bank',
            'banking',
            'money',
            'budget',
            'savings',
            'interest',
            'market',
            'economy',
            'price',
          ])
        ),
        buildSection(
          'Applied context',
          'Real-world applications and evidence that can support financial-literacy use cases.',
          [
            ...buildItems(realWorldRecords, ['application_type', 'application', 'example'], ['application', 'example'], ['relevance'], 5),
            ...buildItems(evidence, ['source_text', 'source_type'], ['source_text'], ['source_type'], 3),
          ]
        ),
      ].filter((section): section is PalSection => Boolean(section)),
    },
  };
}

function buildUluExamples(
  knowledge: string[],
  skills: string[],
  objectives: unknown[],
  realWorld: unknown[],
  misconceptions: unknown[]
): PalSourceItem[] {
  const examples: PalSourceItem[] = [];

  for (let index = 0; index < 6; index += 1) {
    const knowledgeItem = knowledge[index];
    const skillItem = skills[index];
    const objective = itemFromUnknown(objectives[index], 'Objective');
    const application = itemFromUnknown(realWorld[index], 'Application');
    const misconception = itemFromUnknown(misconceptions[index], 'Misconception');

    const title =
      objective?.title ||
      knowledgeItem ||
      skillItem ||
      application?.title ||
      `ULU evidence bundle ${index + 1}`;

    const detail =
      application?.detail ||
      misconception?.detail ||
      misconception?.title ||
      'Built from the selected concept’s live semantic intelligence.';

    const meta = compactMeta([
      knowledgeItem ? `Knowledge: ${knowledgeItem}` : '',
      skillItem ? `Skill: ${skillItem}` : '',
      objective?.title ? `Objective: ${objective.title}` : '',
      application?.title ? `Context: ${application.title}` : '',
    ]);

    if (!title.trim()) continue;

    examples.push({
      title: decodeText(title),
      detail: decodeText(detail),
      meta: meta.length > 0 ? meta.map(decodeText) : undefined,
    });
  }

  return examples;
}

function buildUluModules(
  record: SemanticResultRecord,
  entry: SemanticConceptEntry | null
): Record<UluSlug, PalModuleView> {
  const concept = asRecord(entry?.concept);
  const conceptTitle = decodeText(asText(concept.concept_name) || 'Concept');
  const conceptDefinition = decodeText(asText(concept.definition));
  const difficulty = decodeText(asText(concept.difficulty));
  const objectives = conceptList(entry, record, 'learning_objectives', 'learning_objectives');
  const outcomes = conceptList(entry, record, 'learning_outcomes', 'learning_outcomes');
  const abilities = conceptList(entry, record, 'abilities', 'abilities');
  const skills = conceptList(entry, record, 'skills', 'skill');
  const competencies = conceptList(entry, record, 'competencies', 'competency');
  const blooms = conceptList(entry, record, 'blooms', 'blooms_level');
  const dok = conceptList(entry, record, 'dok', 'dok');
  const pedagogy = conceptList(entry, record, 'pedagogy_recommendations', 'pedagogy');
  const realWorld = conceptList(entry, record, 'real_world_applications', 'real_world_applications');
  const misconceptions = conceptList(entry, record, 'misconceptions', 'misconceptions');
  const prerequisites = conceptList(entry, record, 'prerequisites', 'prerequisites');
  const relationships = conceptList(entry, record, 'concept_relationships', 'full_intelegance_json');
  const blueprint = conceptList(entry, record, 'assessment_blueprint', 'assessment_blueprint');
  const evidence = conceptList(entry, record, 'evidence', 'full_intelegance_json');
  const rubrics = asRecord(entry?.assessment_rubrics ?? record.assessment_rubrics);
  const rubricItems = asArray(rubrics.items);
  const reasoning = asRecord(entry?.agent_reasoning);
  const knowledgeStrings = conceptStrings(entry, record, 'knowledge_items', 'knowledge');
  const skillStrings = conceptStrings(entry, record, 'skills', 'skill');

  return {
    'five-layer-structure': {
      slug: 'five-layer-structure',
      title: ULU_META['five-layer-structure'].title,
      subtitle: ULU_META['five-layer-structure'].subtitle,
      summary: 'A Unified Learning Unit assembled from live semantic intelligence so the academic concept, skills, context, support, and improvement signals stay connected.',
      badges: ['academic core', 'dynamic', difficulty || 'difficulty unavailable'].filter(Boolean),
      emptyMessage: 'No ULU layer data could be assembled from the current semantic intelligence record.',
      sections: [
        buildSection(
          'Academic core',
          'Concept identity, definition, and learning-objective evidence from the semantic intelligence source.',
          [
            {
              title: conceptTitle,
              detail: conceptDefinition || decodeText(asText(record.learning_objective)) || 'No concept definition is available.',
              meta: compactMeta([
                difficulty ? `Difficulty: ${difficulty}` : '',
                asText(record.subject_name) ? `Subject: ${decodeText(asText(record.subject_name))}` : '',
              ]),
            },
            ...buildItems(objectives, ['objective'], ['objective'], ['objective_type', 'priority'], 4),
          ]
        ),
        buildSection(
          'Skills and competencies',
          'Abilities, skills, competencies, Bloom levels, and DOK data that define the learning demands of the unit.',
          [
            ...buildItems(abilities, ['ability'], ['description'], ['verb', 'concept_name'], 4),
            ...buildItems(skills, ['skill'], ['skill'], ['concept_name'], 4),
            ...buildItems(competencies, ['competency', 'statement'], ['statement'], ['concept_name'], 4),
            ...buildItems(blooms, ['level'], ['level'], ['coverage_score'], 3),
            ...buildItems(dok, ['description', 'level'], ['description'], ['level'], 3),
          ]
        ),
        buildSection(
          'Applied context',
          'Real-world application and pedagogy evidence that can turn the concept into a meaningful ULU experience.',
          [
            ...buildItems(realWorld, ['application_type', 'application', 'example'], ['application', 'example'], ['relevance'], 5),
            ...buildItems(pedagogy, ['strategy'], ['why_effective', 'activity'], ['concept_name'], 5),
          ]
        ),
        buildSection(
          'Support and risk',
          'Prerequisites and misconceptions that should shape scaffolding, hints, and support during the unit.',
          [
            ...buildItems(prerequisites, ['concept_name', 'prerequisite_type'], ['prerequisite_type'], ['necessity'], 4),
            ...buildItems(misconceptions, ['misconception'], ['root_cause', 'correction'], ['concept_name'], 4),
          ]
        ),
      ].filter((section): section is PalSection => Boolean(section)),
    },
    'scenario-template': {
      slug: 'scenario-template',
      title: ULU_META['scenario-template'].title,
      subtitle: ULU_META['scenario-template'].subtitle,
      summary: 'A scenario template generated from the selected concept’s real-world applications, objectives, misconceptions, and competency signals.',
      badges: ['scenario', 'dynamic'],
      emptyMessage: 'No scenario-building signals were found in the current semantic intelligence record.',
      sections: [
        buildSection(
          'Context sources',
          'Real-world applications that can anchor a ULU scenario in an authentic context.',
          buildItems(realWorld, ['application_type', 'application', 'example'], ['example', 'application'], ['relevance'], 8)
        ),
        buildSection(
          'Academic hooks',
          'Knowledge, objectives, and outcomes that can power the core challenge of the ULU scenario.',
          [
            ...buildListItems(knowledgeStrings, 'Knowledge', 4),
            ...buildItems(objectives, ['objective'], ['objective'], ['priority'], 3),
            ...buildItems(outcomes, ['outcome'], ['outcome'], ['outcome_type'], 3),
          ]
        ),
        buildSection(
          'Decision and reflection opportunities',
          'Misconceptions, competencies, and reasoning that can drive decision points and reflection prompts.',
          [
            ...buildItems(misconceptions, ['misconception'], ['root_cause', 'correction'], [], 4),
            ...buildItems(competencies, ['competency', 'statement'], ['statement'], [], 4),
            ...buildItemsFromUnknown(Object.entries(reasoning).map(([key, value]) => ({ title: key, description: value })), 'Reasoning', 3),
          ]
        ),
      ].filter((section): section is PalSection => Boolean(section)),
    },
    'complete-examples': {
      slug: 'complete-examples',
      title: ULU_META['complete-examples'].title,
      subtitle: ULU_META['complete-examples'].subtitle,
      summary: 'Example ULU bundles composed entirely from the current concept’s knowledge, skill, objective, context, and misconception evidence.',
      badges: ['examples', 'dynamic'],
      emptyMessage: 'There is not enough concept evidence yet to assemble ULU example bundles.',
      sections: [
        buildSection(
          'Available example bundles',
          'Each example bundle combines real semantic-intelligence fields instead of static demo content.',
          buildUluExamples(knowledgeStrings, skillStrings, objectives, realWorld, misconceptions)
        ),
      ].filter((section): section is PalSection => Boolean(section)),
    },
    'content-optimization-loop': {
      slug: 'content-optimization-loop',
      title: ULU_META['content-optimization-loop'].title,
      subtitle: ULU_META['content-optimization-loop'].subtitle,
      summary: 'Optimization inputs sourced from the current semantic intelligence record so ULU improvement can stay evidence-driven.',
      badges: ['optimization', 'dynamic'],
      emptyMessage: 'No assessment or optimization signals were found in the current semantic intelligence record.',
      sections: [
        buildSection(
          'Assessment blueprint',
          'Assessment blueprint rows available to improve or evaluate the learning unit.',
          buildItems(
            blueprint,
            ['recommended_question', 'assessment_type'],
            ['recommended_question'],
            ['bloom_level', 'dok_level', 'difficulty', 'marks'],
            8
          )
        ),
        buildSection(
          'Rubric signals',
          'Rubric rows already attached to the semantic record.',
          buildItems(
            rubricItems,
            ['question', 'assessment_type'],
            ['question'],
            ['difficulty', 'bloom_level', 'dok_level', 'marks'],
            8
          )
        ),
        buildSection(
          'Rigor and risk signals',
          'Bloom, DOK, misconception, concept relationship, and evidence signals that can guide content revisions.',
          [
            ...buildItems(blooms, ['level'], ['level'], ['coverage_score'], 3),
            ...buildItems(dok, ['description', 'level'], ['description'], ['level'], 3),
            ...buildItems(misconceptions, ['misconception'], ['root_cause', 'correction'], [], 4),
            ...buildItems(relationships, ['source_concept', 'target_concept', 'relation_type'], ['relation_type'], ['source_concept', 'target_concept'], 4),
            ...buildItems(evidence, ['source_text', 'source_type'], ['source_text'], ['source_type'], 4),
          ]
        ),
      ].filter((section): section is PalSection => Boolean(section)),
    },
  };
}

async function fetchSemanticRecord(chapterId: string): Promise<SemanticResultRecord | null> {
  if (!chapterId.trim()) return null;
  return (await fetchSemanticIntelligenceResult(chapterId)) as SemanticResultRecord | null;
}

async function fetchLatestSemanticRecord(): Promise<{ record: SemanticResultRecord | null; sourceId: string }> {
  const chapters = await fetchSemanticIntelligenceChapters();
  const processed = chapters.find((item) => Boolean(item?.is_processed)) ?? chapters[0];
  const sourceId = asText(processed?.id);
  if (!sourceId) return { record: null, sourceId: '' };
  const record = await fetchSemanticRecord(sourceId);
  return { record, sourceId };
}

export async function buildPalContentModelPayload(input: { chapterId?: string; concept?: string }): Promise<PalContentModelResponse> {
  try {
    let chapterId = asText(input.chapterId);
    const conceptParam = asText(input.concept) || '0';

    let record: SemanticResultRecord | null = null;
    if (chapterId) {
      record = await fetchSemanticRecord(chapterId);
    } else {
      const fallback = await fetchLatestSemanticRecord();
      record = fallback.record;
      chapterId = asText(record?.chapter_id) || fallback.sourceId;
    }

    if (!record) {
      return {
        context: null,
        frameworkModules: {} as Record<FrameworkSlug, PalModuleView>,
        uluModules: {} as Record<UluSlug, PalModuleView>,
        error: 'No semantic intelligence data is available yet for PAL to display.',
        isReady: false,
      };
    }

    const entries = getConceptEntries(record);
    const { entry, conceptIndex } = resolveConceptEntry(entries, conceptParam);
    const context = buildContext(record, entry, chapterId, String(conceptIndex));

    return {
      context,
      frameworkModules: buildFrameworkModules(record, entry),
      uluModules: buildUluModules(record, entry),
      error: '',
      isReady: true,
    };
  } catch (error) {
    return {
      context: null,
      frameworkModules: {} as Record<FrameworkSlug, PalModuleView>,
      uluModules: {} as Record<UluSlug, PalModuleView>,
      error:
        error instanceof Error
          ? error.message
          : 'PAL could not load the semantic intelligence source.',
      isReady: false,
    };
  }
}

function buildApiQuery(input: { chapterId?: string; concept?: string }) {
  const query = new URLSearchParams();
  if (input.chapterId) query.set('chapterId', input.chapterId);
  if (input.concept) query.set('concept', input.concept);
  const queryString = query.toString();
  return queryString ? `?${queryString}` : '';
}

async function resolveLocalApiUrl(path: string) {
  const headerStore = await headers();
  const proto = headerStore.get('x-forwarded-proto') ?? 'http';
  const host =
    headerStore.get('x-forwarded-host') ??
    headerStore.get('host') ??
    'localhost:3000';

  return `${proto}://${host}${path}`;
}

export async function getPalContentModel(input: { chapterId?: string; concept?: string }): Promise<PalContentModelResponse> {
  const apiUrl = await resolveLocalApiUrl(`/api/pal/content-model${buildApiQuery(input)}`);
  const res = await fetch(apiUrl, {
    method: 'GET',
    cache: 'no-store',
  });

  if (!res.ok) {
    return {
      context: null,
      frameworkModules: {} as Record<FrameworkSlug, PalModuleView>,
      uluModules: {} as Record<UluSlug, PalModuleView>,
      error: `PAL backend content-model request failed with status ${res.status}.`,
      isReady: false,
    };
  }

  const payload = (await res.json()) as PalContentModelResponse;
  return payload;
}
