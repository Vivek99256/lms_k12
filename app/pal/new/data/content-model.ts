import { buildSessionContext, readNumber, readString } from '@/lib/erp-client';

/**
 * New PAL → Content Model — data layer.
 *
 * Mirrors the Laravel routes registered under `/api/pal/new/content-model/*`
 * (App\Http\Controllers\api\PAL\NewPalContentModelController), same
 * `{ success, data }` envelope and same `pal.auth` JWT as the rest of PAL.
 *
 * Everything this module returns is PROJECTED from the `semantic_intelligence`
 * table on the server at request time — the extracted chapter data — with the
 * authoring overlay merged on top. There is no content in this file and none in
 * the pages that consume it: vocabularies, variant blueprints, metadata field
 * groups and every score arrive from the API.
 *
 * Two server rules shape the UI and are worth knowing before changing it:
 *   C5  machine-written tags are PROPOSALS. Enrichment always comes back as a
 *       draft tagged `ai`; the API refuses to let a machine write an approved
 *       status or touch already-approved content.
 *   C6  a misconception with no corrective may not be served. The library view
 *       leads with that check rather than burying it.
 */

// --- helpers ---------------------------------------------------------------

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => readString(item)).filter(Boolean);
  const single = readString(value);
  return single ? [single] : [];
}

/** `null` rather than 0 — an absent metric must not render as a real zero. */
function readNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function readNullableString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

function readBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === '1';
}

function readNullableBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined || value === '') return null;
  return readBoolean(value);
}

async function callApi(
  path: string,
  init: { method?: 'GET' | 'POST'; body?: unknown; signal?: AbortSignal } = {}
): Promise<unknown> {
  const session = buildSessionContext();
  if (!session.baseUrl) throw new Error('Session data is missing. Please sign in again.');
  if (!session.token) throw new Error('Your session has expired. Please sign in again.');

  const method = init.method ?? 'GET';

  const response = await fetch(`${session.baseUrl}/${path.replace(/^\//, '')}`, {
    method,
    headers: {
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      Authorization: `Bearer ${session.token}`,
      ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
    },
    body: method === 'POST' ? JSON.stringify(init.body ?? {}) : undefined,
    signal: init.signal,
  });

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const record = toRecord(payload);
    const serverMessage = readString(record.message);

    if (response.status === 401) {
      throw new Error(serverMessage || 'Your session has expired. Please sign in again.');
    }
    if (response.status === 403) {
      throw new Error(serverMessage || 'You are not allowed to open the Content Model workspace.');
    }
    if (response.status === 422) {
      // The server validates against closed vocabularies and the QA stage
      // rules; its message names the exact field, so surface it verbatim.
      throw new Error(serverMessage || 'The server rejected that value.');
    }
    if (response.status === 404) {
      throw new Error(
        serverMessage ||
          'The Content Model API is not available on this server. It ships with the New PAL module — the backend may not be deployed yet.'
      );
    }
    throw new Error(serverMessage || `HTTP ${response.status}: the Content Model API is unavailable.`);
  }

  const record = toRecord(payload);
  if (record.success === false) {
    throw new Error(readString(record.message) || 'Content Model request failed.');
  }
  return 'data' in record ? record.data : payload;
}

// --- vocabulary ------------------------------------------------------------

export interface BloomLevelDef {
  key: string;
  ordinal: number;
  practiceLevel: number;
  label: string;
}

export interface VariantBlueprintSlot {
  slot: number;
  format: string;
  label: string;
  servesBloom: string;
  whenServed: string;
  sources: string[];
  h5pType: string;
}

export interface ContentModelVocabulary {
  bloomLevels: BloomLevelDef[];
  practiceLevels: Record<string, Record<string, unknown>>;
  contentTypes: Record<string, { label: string }>;
  formats: Record<string, { label: string; variant: number }>;
  culturalContexts: string[];
  languages: string[];
  h5pTypes: string[];
  qualityStatuses: string[];
  qualityTransitions: Record<string, string[]>;
  servableStatuses: string[];
  correctiveFormats: string[];
  knowledgeTypes: string[];
  scaffoldTypes: string[];
  hpcLenses: string[];
  dokLevels: Record<string, string>;
  /** lms_mapping_type id -> pedagogy name; read live from the LMS estate. */
  pedagogy: Record<string, string>;
  variantBlueprint: VariantBlueprintSlot[];
  /** group -> ordered field names; drives the authoring form layout. */
  metadataFieldGroups: Record<string, string[]>;
  mandatoryFields: Record<string, string[]>;
  llmOnlyFields: string[];
  /** field -> the closed set an AI proposal must choose from. */
  frameworkVocabulary: Record<string, string[]>;
  minItemsPerLevel: number;
  aiAvailable: boolean;
  aiUnavailableReason: string | null;
}

export async function fetchVocabulary(signal?: AbortSignal): Promise<ContentModelVocabulary> {
  const data = toRecord(await callApi('api/pal/new/content-model/vocabulary', { signal }));
  const closed = toRecord(data.closed_vocabulary);

  const bloomRaw = toRecord(closed.bloom_levels);
  const bloomLevels: BloomLevelDef[] = Object.entries(bloomRaw)
    .map(([key, def]) => {
      const d = toRecord(def);
      return {
        key,
        ordinal: readNumber(d.ordinal),
        practiceLevel: readNumber(d.practice_level),
        label: readString(d.label) || key,
      };
    })
    .sort((a, b) => a.ordinal - b.ordinal);

  const transitionsRaw = toRecord(closed.quality_transitions);
  const qualityTransitions: Record<string, string[]> = {};
  Object.entries(transitionsRaw).forEach(([from, to]) => {
    qualityTransitions[from] = toStringArray(to);
  });

  const pedagogyRaw = toRecord(closed.pedagogy);
  const pedagogy: Record<string, string> = {};
  Object.entries(pedagogyRaw).forEach(([id, name]) => {
    pedagogy[id] = readString(name);
  });

  const contentTypes: Record<string, { label: string }> = {};
  Object.entries(toRecord(closed.content_types)).forEach(([key, def]) => {
    contentTypes[key] = { label: readString(toRecord(def).label) || key };
  });

  const formats: Record<string, { label: string; variant: number }> = {};
  Object.entries(toRecord(closed.formats)).forEach(([key, def]) => {
    const d = toRecord(def);
    formats[key] = { label: readString(d.label) || key, variant: readNumber(d.variant) };
  });

  const variantBlueprint: VariantBlueprintSlot[] = Object.entries(toRecord(data.variant_blueprint))
    .map(([slot, def]) => {
      const d = toRecord(def);
      return {
        slot: Number(slot),
        format: readString(d.format),
        label: readString(d.label),
        servesBloom: readString(d.serves_bloom),
        whenServed: readString(d.when_served),
        sources: toStringArray(d.sources),
        h5pType: readString(d.h5p_type),
      };
    })
    .sort((a, b) => a.slot - b.slot);

  const metadataFieldGroups: Record<string, string[]> = {};
  Object.entries(toRecord(data.metadata_field_groups)).forEach(([group, fields]) => {
    metadataFieldGroups[group] = toStringArray(fields);
  });

  const mandatoryFields: Record<string, string[]> = {};
  Object.entries(toRecord(data.mandatory_fields)).forEach(([type, fields]) => {
    mandatoryFields[type] = toStringArray(fields);
  });

  const frameworkVocabulary: Record<string, string[]> = {};
  Object.entries(toRecord(data.framework_vocabulary)).forEach(([field, values]) => {
    frameworkVocabulary[field] = toStringArray(values);
  });

  const dokLevels: Record<string, string> = {};
  Object.entries(toRecord(data.dok_levels)).forEach(([level, label]) => {
    dokLevels[level] = readString(label);
  });

  const ai = toRecord(data.ai);

  return {
    bloomLevels,
    practiceLevels: toRecord(closed.practice_levels) as Record<string, Record<string, unknown>>,
    contentTypes,
    formats,
    culturalContexts: toStringArray(closed.cultural_contexts),
    languages: toStringArray(closed.languages),
    h5pTypes: toStringArray(closed.h5p_types),
    qualityStatuses: Object.keys(toRecord(closed.quality_statuses)),
    qualityTransitions,
    servableStatuses: toStringArray(closed.servable_statuses),
    correctiveFormats: toStringArray(closed.corrective_formats),
    knowledgeTypes: toStringArray(closed.knowledge_types),
    scaffoldTypes: toStringArray(closed.scaffold_types),
    hpcLenses: toStringArray(closed.hpc_lenses),
    dokLevels,
    pedagogy,
    variantBlueprint,
    metadataFieldGroups,
    mandatoryFields,
    llmOnlyFields: toStringArray(data.llm_only_fields),
    frameworkVocabulary,
    minItemsPerLevel: readNumber(toRecord(data.ladder).min_items_per_level) || 5,
    aiAvailable: readBoolean(ai.available),
    aiUnavailableReason: readNullableString(ai.unavailable_reason),
  };
}

// --- estate coverage -------------------------------------------------------

export interface TypeCoverage {
  key: string;
  label: string;
  chaptersCovered: number;
  coveragePct: number;
  source: string;
}

export interface EstateCoverage {
  subInstituteId: number | null;
  sourceTable: string;
  chapters: number;
  concepts: number;
  fourTypeModel: TypeCoverage[];
  itemTotals: Record<string, number>;
  culturalAssignedNodes: number;
  culturalVocabulary: string[];
  languages: string[];
  nodesWithVariants: number;
  languageVariantRows: number;
  nodesTouched: number;
  pipeline: Record<string, number>;
  aiAvailable: boolean;
  aiUnavailableReason: string | null;
  cachedEnrichments: number;
}

export async function fetchEstateCoverage(signal?: AbortSignal): Promise<EstateCoverage> {
  const data = toRecord(await callApi('api/pal/new/content-model/coverage', { signal }));

  const fourTypeModel: TypeCoverage[] = Object.entries(toRecord(data.four_type_model)).map(
    ([key, def]) => {
      const d = toRecord(def);
      return {
        key,
        label: readString(d.label),
        chaptersCovered: readNumber(d.chapters_covered),
        coveragePct: readNumber(d.coverage_pct),
        source: readString(d.source),
      };
    }
  );

  const itemTotals: Record<string, number> = {};
  Object.entries(toRecord(data.item_totals)).forEach(([key, value]) => {
    itemTotals[key] = readNumber(value);
  });

  const pipeline: Record<string, number> = {};
  Object.entries(toRecord(toRecord(data.authoring).pipeline)).forEach(([key, value]) => {
    pipeline[key] = readNumber(value);
  });

  const cultural = toRecord(data.cultural_context);
  const languages = toRecord(data.languages);
  const authoring = toRecord(data.authoring);
  const ai = toRecord(data.ai);

  return {
    subInstituteId: readNullableNumber(data.sub_institute_id),
    sourceTable: readString(data.source_table),
    chapters: readNumber(toRecord(data.chapters).total),
    concepts: readNumber(toRecord(data.chapters).concepts),
    fourTypeModel,
    itemTotals,
    culturalAssignedNodes: readNumber(cultural.assigned_nodes),
    culturalVocabulary: toStringArray(cultural.vocabulary),
    languages: toStringArray(languages.supported),
    nodesWithVariants: readNumber(languages.nodes_with_variants),
    languageVariantRows: readNumber(languages.variant_rows),
    nodesTouched: readNumber(authoring.nodes_touched),
    pipeline,
    aiAvailable: readBoolean(ai.available),
    aiUnavailableReason: readNullableString(ai.unavailable_reason),
    cachedEnrichments: readNumber(ai.cached_enrichments),
  };
}

// --- chapters --------------------------------------------------------------

export interface ExtractedChapter {
  id: number;
  extractionId: number | null;
  chapterId: number | null;
  chapterName: string;
  subjectName: string;
  standard: number | null;
  chapterNumber: number | null;
  totalConcepts: number;
  qualityFlag: string;
  llmModel: string;
  createdAt: string;
}

export interface ChapterList {
  count: number;
  subjects: string[];
  standards: number[];
  chapters: ExtractedChapter[];
}

function mapChapter(raw: unknown): ExtractedChapter {
  const r = toRecord(raw);
  return {
    id: readNumber(r.id),
    extractionId: readNullableNumber(r.extraction_id),
    chapterId: readNullableNumber(r.chapter_id),
    chapterName: readString(r.chapter_name),
    subjectName: readString(r.subject_name),
    standard: readNullableNumber(r.standard),
    chapterNumber: readNullableNumber(r.chapter_number),
    totalConcepts: readNumber(r.total_concepts),
    qualityFlag: readString(r.quality_flag),
    llmModel: readString(r.llm_model),
    createdAt: readString(r.created_at),
  };
}

export async function fetchChapters(
  filters: { subject?: string; standard?: number; search?: string } = {},
  signal?: AbortSignal
): Promise<ChapterList> {
  const params = new URLSearchParams();
  if (filters.subject) params.set('subject', filters.subject);
  if (filters.standard) params.set('standard', String(filters.standard));
  if (filters.search) params.set('search', filters.search);

  const query = params.toString();
  const data = toRecord(
    await callApi(`api/pal/new/content-model/chapters${query ? `?${query}` : ''}`, { signal })
  );
  const facets = toRecord(data.facets);

  return {
    count: readNumber(data.count),
    subjects: toStringArray(facets.subjects),
    standards: toArray(facets.standards).map((s) => readNumber(s)),
    chapters: toArray(data.chapters).map(mapChapter),
  };
}

// --- chapter model ---------------------------------------------------------

export interface RequirementScore {
  key: string;
  label: string;
  scorePct: number;
  detail: string;
}

export interface ConceptSummary {
  slug: string;
  name: string;
  importance: string;
  difficulty: string;
  confidence: number | null;
  type1: { present: number; total: number; meetsMinimum: boolean; gaps: number[] };
  type2: {
    items: number;
    servableLevels: number;
    hardGaps: number[];
    ceiling: number | null;
    perLevel: Array<{ level: number; items: number }>;
  };
  type3: { total: number; servable: number; meetsMinimum: boolean; c6Pass: boolean; c6Violations: number };
  type4: { items: number; calibrated: number; evidenceVerified: number; gap: string | null };
}

export interface ChapterModel {
  semanticId: number;
  chapterName: string;
  chapterSummary: string;
  subjectName: string;
  standard: number | null;
  chapterNumber: number | null;
  conceptCount: number;
  concepts: ConceptSummary[];
  requirements: RequirementScore[];
  totals: Record<string, number>;
  pipeline: Record<string, number>;
  chapterObjectives: string[];
}

export async function fetchChapterModel(semanticId: number, signal?: AbortSignal): Promise<ChapterModel> {
  const data = toRecord(await callApi(`api/pal/new/content-model/chapters/${semanticId}`, { signal }));
  const header = toRecord(data.header);
  const chapter = toRecord(data.chapter);

  const requirements: RequirementScore[] = Object.entries(toRecord(data.requirements)).map(
    ([key, def]) => {
      const d = toRecord(def);
      return {
        key,
        label: readString(d.label),
        scorePct: readNumber(d.score_pct),
        detail: readString(d.detail),
      };
    }
  );

  const totals: Record<string, number> = {};
  Object.entries(toRecord(data.totals)).forEach(([key, value]) => {
    totals[key] = readNumber(value);
  });

  const pipeline: Record<string, number> = {};
  Object.entries(toRecord(data.pipeline)).forEach(([key, value]) => {
    pipeline[key] = readNumber(value);
  });

  return {
    semanticId: readNumber(data.semantic_id),
    chapterName: readString(chapter.chapter_name) || readString(header.chapter_name),
    chapterSummary: readString(chapter.chapter_summary),
    subjectName: readString(header.subject_name),
    standard: readNullableNumber(header.standard),
    chapterNumber: readNullableNumber(header.chapter_number),
    conceptCount: readNumber(data.concept_count),
    chapterObjectives: toStringArray(chapter.chapter_objectives),
    requirements,
    totals,
    pipeline,
    concepts: toArray(data.concepts).map((raw) => {
      const r = toRecord(raw);
      const t1 = toRecord(r.type_1);
      const t2 = toRecord(r.type_2);
      const t3 = toRecord(r.type_3);
      const t4 = toRecord(r.type_4);
      return {
        slug: readString(r.slug),
        name: readString(r.name),
        importance: readString(r.importance),
        difficulty: readString(r.difficulty),
        confidence: readNullableNumber(r.confidence),
        type1: {
          present: readNumber(t1.present),
          total: readNumber(t1.total),
          meetsMinimum: readBoolean(t1.meets_minimum),
          gaps: toArray(t1.gaps).map((g) => readNumber(g)),
        },
        type2: {
          items: readNumber(t2.items),
          servableLevels: readNumber(t2.servable_levels),
          hardGaps: toArray(t2.hard_gaps).map((g) => readNumber(g)),
          ceiling: readNullableNumber(t2.ceiling),
          perLevel: toArray(t2.per_level).map((l) => {
            const lr = toRecord(l);
            return { level: readNumber(lr.level), items: readNumber(lr.items) };
          }),
        },
        type3: {
          total: readNumber(t3.total),
          servable: readNumber(t3.servable),
          meetsMinimum: readBoolean(t3.meets_minimum),
          c6Pass: readBoolean(t3.c6_pass),
          c6Violations: readNumber(t3.c6_violations),
        },
        type4: {
          items: readNumber(t4.items),
          calibrated: readNumber(t4.calibrated),
          evidenceVerified: readNumber(t4.evidence_verified),
          gap: readNullableString(t4.gap),
        },
      };
    }),
  };
}

// --- the four-type model for one concept -----------------------------------

export type ContentNodeType = 'concept' | 'practice' | 'corrective' | 'assessment' | 'misconception';

export interface ContentNode {
  nodeKey: string;
  contentIdRef: string;
  contentType: ContentNodeType;
  title: string;
  body: string;
  prompt: string;
  format: string;
  formatLabel: string;
  h5pType: string;
  bloomLevel: string;
  practiceLevel: number | null;
  dokLevel: number | null;
  difficulty: number | null;
  marks: number | null;
  variantNumber: number | null;
  whenServed: string;
  assetState: string;
  gap: boolean;
  gapReason: string | null;
  sourcesUsed: string[];
  sourceItems: Array<Record<string, unknown>>;
  qualityStatus: string;
  taggedBy: string;
  servable: boolean;
  hasOverride: boolean;
  overriddenFields: string[];
  completeness: number;
  missingMandatory: string[];
  metadata: Record<string, unknown>;
  languageVariants: Record<string, { title: string | null; body: string; source: string }>;
  misconceptionTags: string[];
  hasAnswerKey: boolean;
  assessmentTypeRaw: string;
  answerKey: AnswerOption[];
  commonErrors: string[];
  levelDescriptors: Array<Record<string, unknown>>;
  criteria: Array<Record<string, unknown>>;
  acceptablePoints: string[];
  sourceEvidence: string[];
  evidenceVerified: boolean | null;
  servesAssessmentTypes: string[];
  skillPhrase: string;
}

export interface AnswerOption {
  optionLabel: string;
  optionText: string;
  isCorrect: boolean;
  rationale: string;
  misconceptionTested: string | null;
  misconceptionTag: string | null;
}

export function mapNode(raw: unknown): ContentNode {
  const r = toRecord(raw);
  const variants = toRecord(r.language_variants);
  const languageVariants: ContentNode['languageVariants'] = {};
  Object.entries(variants).forEach(([lang, def]) => {
    const d = toRecord(def);
    languageVariants[lang] = {
      title: readNullableString(d.title),
      body: readString(d.body),
      source: readString(d.source) || 'human',
    };
  });

  return {
    nodeKey: readString(r.node_key),
    contentIdRef: readString(r.content_id_ref),
    contentType: (readString(r.content_type) || 'concept') as ContentNodeType,
    title: readString(r.title),
    body: readString(r.body),
    prompt: readString(r.prompt),
    format: readString(r.format),
    formatLabel: readString(r.format_label),
    h5pType: readString(r.h5p_type),
    bloomLevel: readString(r.bloom_level),
    practiceLevel: readNullableNumber(r.practice_level),
    dokLevel: readNullableNumber(r.dok_level),
    difficulty: readNullableNumber(r.difficulty_1_to_5),
    marks: readNullableNumber(r.marks),
    variantNumber: readNullableNumber(r.variant_number),
    whenServed: readString(r.when_served),
    assetState: readString(r.asset_state),
    gap: readBoolean(r.gap),
    gapReason: readNullableString(r.gap_reason),
    sourcesUsed: toStringArray(r.sources_used),
    sourceItems: toArray(r.source_items).map((i) => toRecord(i)),
    qualityStatus: readString(r.quality_status) || 'draft',
    taggedBy: readString(r.tagged_by),
    servable: readBoolean(r.servable),
    hasOverride: readBoolean(r.has_override),
    overriddenFields: toStringArray(r.overridden_fields),
    completeness: readNumber(r.completeness),
    missingMandatory: toStringArray(r.missing_mandatory),
    metadata: toRecord(r.metadata),
    languageVariants,
    misconceptionTags: toStringArray(r.misconception_tags),
    hasAnswerKey: readBoolean(r.has_answer_key),
    assessmentTypeRaw: readString(r.assessment_type_raw),
    answerKey: toArray(r.answer_key).map((o) => {
      const opt = toRecord(o);
      return {
        optionLabel: readString(opt.option_label),
        optionText: readString(opt.option_text),
        isCorrect: readBoolean(opt.is_correct),
        rationale: readString(opt.rationale),
        misconceptionTested: readNullableString(opt.misconception_tested),
        misconceptionTag: readNullableString(opt.misconception_tag),
      };
    }),
    commonErrors: toStringArray(r.common_errors),
    levelDescriptors: toArray(r.level_descriptors).map((d) => toRecord(d)),
    criteria: toArray(r.criteria).map((d) => toRecord(d)),
    acceptablePoints: toStringArray(r.acceptable_points),
    sourceEvidence: toStringArray(r.source_evidence),
    evidenceVerified: readNullableBoolean(r.evidence_verified),
    servesAssessmentTypes: toStringArray(r.serves_assessment_types),
    skillPhrase: readString(r.skill_phrase),
  };
}

export interface LadderLevel {
  level: number;
  name: string;
  bloomLevel: string;
  bloomLabel: string;
  tasks: string[];
  scaffold: string;
  h5pRecommended: string[];
  gate: { metric: string; threshold: number; minItems: number } | null;
  itemsTotal: number;
  minItemsRequired: number;
  servable: boolean;
  gapKind: string | null;
  items: ContentNode[];
}

function mapLadderLevel(raw: unknown): LadderLevel {
  const r = toRecord(raw);
  const gateRaw = toRecord(r.gate);
  return {
    level: readNumber(r.level),
    name: readString(r.name),
    bloomLevel: readString(r.bloom_level),
    bloomLabel: readString(r.bloom_label),
    tasks: toStringArray(r.tasks),
    scaffold: readString(r.scaffold),
    h5pRecommended: toStringArray(r.h5p_recommended),
    gate:
      Object.keys(gateRaw).length > 0
        ? {
            metric: readString(gateRaw.metric),
            threshold: readNumber(gateRaw.threshold),
            minItems: readNumber(gateRaw.min_items),
          }
        : null,
    itemsTotal: readNumber(r.items_total),
    minItemsRequired: readNumber(r.min_items_required),
    servable: readBoolean(r.servable),
    gapKind: readNullableString(r.gap),
    items: toArray(r.items).map(mapNode),
  };
}

export interface Corrective extends ContentNode {
  misconceptionTag: string;
  priorityLevel: number;
}

export interface MisconceptionEntry {
  nodeKey: string;
  tag: string;
  title: string;
  conceptName: string;
  conceptSlug: string;
  description: string;
  errorPattern: string | null;
  rootCause: string | null;
  correctiveAction: string | null;
  typicalWrongAnswers: string[];
  prevalenceRate: number | null;
  detectedInItems: number;
  severity: string;
  priorityLevel: number;
  correctiveFormat: string | null;
  c6Ok: boolean;
  c6Reason: string | null;
  origin: string;
  qualityStatus: string;
  correctives: Corrective[];
}

function mapMisconception(raw: unknown): MisconceptionEntry {
  const r = toRecord(raw);
  return {
    nodeKey: readString(r.node_key),
    tag: readString(r.tag),
    title: readString(r.title),
    conceptName: readString(r.concept_name),
    conceptSlug: readString(r.concept_slug),
    description: readString(r.description),
    errorPattern: readNullableString(r.error_pattern),
    rootCause: readNullableString(r.root_cause),
    correctiveAction: readNullableString(r.corrective_action),
    typicalWrongAnswers: toStringArray(r.typical_wrong_answers),
    prevalenceRate: readNullableNumber(r.prevalence_rate),
    detectedInItems: readNumber(r.detected_in_items),
    severity: readString(r.severity),
    priorityLevel: readNumber(r.priority_level),
    correctiveFormat: readNullableString(r.corrective_format),
    c6Ok: readBoolean(r.c6_ok),
    c6Reason: readNullableString(r.c6_reason),
    origin: readString(r.origin) || 'library',
    qualityStatus: readString(r.quality_status) || 'draft',
    correctives: toArray(r.correctives).map((c) => {
      const base = mapNode(c);
      const cr = toRecord(c);
      return {
        ...base,
        misconceptionTag: readString(cr.misconception_tag),
        priorityLevel: readNumber(cr.priority_level),
      };
    }),
  };
}

export interface ConceptModel {
  semanticId: number;
  chapterName: string;
  subjectName: string;
  standard: number | null;
  concept: {
    slug: string;
    name: string;
    conceptKey: string;
    definition: string;
    importance: string;
    difficultyLabel: string;
    difficulty: number | null;
    confidence: number | null;
    priorityScore: number | null;
    bloomCeiling: string;
    practiceCeiling: number | null;
    dominantDok: number | null;
    knowledgeType: string;
    masteryGate: number;
    stageGate: string;
    counts: Record<string, number>;
  };
  type1: {
    label: string;
    present: number;
    totalSlots: number;
    requiredMinimum: number;
    meetsMinimum: boolean;
    rerouteOrder: number[];
    variants: ContentNode[];
  };
  type2: {
    label: string;
    totalItems: number;
    servableLevels: number;
    hardGaps: number[];
    bloomCeiling: string;
    practiceCeiling: number | null;
    unmapped: Array<{ rawBloom: string; question: string; reason: string }>;
    levels: LadderLevel[];
    regressionRules: Record<string, number>;
    hpcCeilings: Record<string, number>;
  };
  type3: {
    label: string;
    total: number;
    servable: number;
    requiredMinimum: number;
    meetsMinimum: boolean;
    c6Pass: boolean;
    c6Violations: Array<{ tag: string; reason: string }>;
    entries: MisconceptionEntry[];
  };
  type4: {
    label: string;
    totalItems: number;
    calibratedItems: number;
    evidenceVerifiedItems: number;
    byBloom: Record<string, number>;
    byType: Record<string, number>;
    gap: string | null;
    items: ContentNode[];
    teachingNotes: Record<string, string[]> | null;
  };
  graph: {
    requires: Array<{ conceptName: string; conceptSlug: string; necessity: string; gates: boolean; prerequisiteType: string }>;
    related: Array<{ targetConcept: string; targetSlug: string; relationType: string }>;
  };
}

export async function fetchConceptModel(
  semanticId: number,
  conceptSlug: string,
  signal?: AbortSignal
): Promise<ConceptModel> {
  const data = toRecord(
    await callApi(`api/pal/new/content-model/chapters/${semanticId}/concepts/${conceptSlug}`, { signal })
  );

  const chapter = toRecord(data.chapter);
  const header = toRecord(chapter.header);
  const c = toRecord(data.concept);
  const t1 = toRecord(data.type_1_concept_learning);
  const t2 = toRecord(data.type_2_practice);
  const t3 = toRecord(data.type_3_misconceptions);
  const t4 = toRecord(data.type_4_assessment);
  const graph = toRecord(data.graph);

  const counts: Record<string, number> = {};
  Object.entries(toRecord(c.counts)).forEach(([key, value]) => {
    counts[key] = readNumber(value);
  });

  const byBloom: Record<string, number> = {};
  Object.entries(toRecord(t4.by_bloom)).forEach(([key, value]) => {
    byBloom[key] = readNumber(value);
  });

  const byType: Record<string, number> = {};
  Object.entries(toRecord(t4.by_type)).forEach(([key, value]) => {
    byType[key] = readNumber(value);
  });

  const regressionRules: Record<string, number> = {};
  Object.entries(toRecord(t2.regression_rules)).forEach(([key, value]) => {
    regressionRules[key] = readNumber(value);
  });

  const hpcCeilings: Record<string, number> = {};
  Object.entries(toRecord(t2.hpc_ceilings)).forEach(([key, value]) => {
    hpcCeilings[key] = readNumber(value);
  });

  const teachingNotesRaw = toRecord(t4.teaching_notes);
  let teachingNotes: Record<string, string[]> | null = null;
  if (Object.keys(teachingNotesRaw).length > 0) {
    teachingNotes = {};
    Object.entries(teachingNotesRaw).forEach(([key, value]) => {
      teachingNotes![key] = toStringArray(value);
    });
  }

  return {
    semanticId: readNumber(data.semantic_id),
    chapterName: readString(chapter.chapter_name),
    subjectName: readString(header.subject_name),
    standard: readNullableNumber(header.standard),
    concept: {
      slug: readString(c.slug),
      name: readString(c.name),
      conceptKey: readString(c.concept_key),
      definition: readString(c.definition),
      importance: readString(c.importance),
      difficultyLabel: readString(c.difficulty_label),
      difficulty: readNullableNumber(c.difficulty_1_to_5),
      confidence: readNullableNumber(c.confidence),
      priorityScore: readNullableNumber(c.priority_score),
      bloomCeiling: readString(c.bloom_ceiling),
      practiceCeiling: readNullableNumber(c.practice_ceiling),
      dominantDok: readNullableNumber(c.dominant_dok),
      knowledgeType: readString(c.knowledge_type),
      masteryGate: readNumber(c.mastery_gate),
      stageGate: readString(c.stage_gate),
      counts,
    },
    type1: {
      label: readString(t1.label),
      present: readNumber(t1.present),
      totalSlots: readNumber(t1.total_slots),
      requiredMinimum: readNumber(t1.required_minimum),
      meetsMinimum: readBoolean(t1.meets_minimum),
      rerouteOrder: toArray(t1.reroute_order).map((v) => readNumber(v)),
      variants: toArray(t1.variants).map(mapNode),
    },
    type2: {
      label: readString(t2.label),
      totalItems: readNumber(t2.total_items),
      servableLevels: readNumber(t2.servable_levels),
      hardGaps: toArray(t2.hard_gaps).map((v) => readNumber(v)),
      bloomCeiling: readString(t2.bloom_ceiling),
      practiceCeiling: readNullableNumber(t2.practice_ceiling),
      unmapped: toArray(t2.unmapped).map((u) => {
        const ur = toRecord(u);
        return {
          rawBloom: readString(ur.raw_bloom),
          question: readString(ur.question),
          reason: readString(ur.reason),
        };
      }),
      levels: toArray(t2.levels).map(mapLadderLevel),
      regressionRules,
      hpcCeilings,
    },
    type3: {
      label: readString(t3.label),
      total: readNumber(t3.total),
      servable: readNumber(t3.servable),
      requiredMinimum: readNumber(t3.required_minimum),
      meetsMinimum: readBoolean(t3.meets_minimum),
      c6Pass: readBoolean(t3.c6_pass),
      c6Violations: toArray(t3.c6_violations).map((v) => {
        const vr = toRecord(v);
        return { tag: readString(vr.tag), reason: readString(vr.reason) };
      }),
      entries: toArray(t3.entries).map(mapMisconception),
    },
    type4: {
      label: readString(t4.label),
      totalItems: readNumber(t4.total_items),
      calibratedItems: readNumber(t4.calibrated_items),
      evidenceVerifiedItems: readNumber(t4.evidence_verified_items),
      byBloom,
      byType,
      gap: readNullableString(t4.gap),
      items: toArray(t4.items).map(mapNode),
      teachingNotes,
    },
    graph: {
      requires: toArray(graph.requires).map((g) => {
        const gr = toRecord(g);
        return {
          conceptName: readString(gr.concept_name),
          conceptSlug: readString(gr.concept_slug),
          necessity: readString(gr.necessity),
          gates: readBoolean(gr.gates),
          prerequisiteType: readString(gr.prerequisite_type),
        };
      }),
      related: toArray(graph.related).map((g) => {
        const gr = toRecord(g);
        return {
          targetConcept: readString(gr.target_concept),
          targetSlug: readString(gr.target_slug),
          relationType: readString(gr.relation_type),
        };
      }),
    },
  };
}

// --- chapter-wide misconception library ------------------------------------

export interface MisconceptionLibrary {
  semanticId: number;
  total: number;
  servable: number;
  bySeverity: Record<string, number>;
  c6Pass: boolean;
  c6Violations: Array<{ tag: string; concept: string; reason: string }>;
  entries: MisconceptionEntry[];
}

export async function fetchMisconceptionLibrary(
  semanticId: number,
  filters: { severity?: string; concept?: string } = {},
  signal?: AbortSignal
): Promise<MisconceptionLibrary> {
  const params = new URLSearchParams();
  if (filters.severity) params.set('severity', filters.severity);
  if (filters.concept) params.set('concept', filters.concept);
  const query = params.toString();

  const data = toRecord(
    await callApi(
      `api/pal/new/content-model/chapters/${semanticId}/misconceptions${query ? `?${query}` : ''}`,
      { signal }
    )
  );

  const bySeverity: Record<string, number> = {};
  Object.entries(toRecord(data.by_severity)).forEach(([key, value]) => {
    bySeverity[key] = readNumber(value);
  });

  return {
    semanticId: readNumber(data.semantic_id),
    total: readNumber(data.total),
    servable: readNumber(data.servable),
    bySeverity,
    c6Pass: readBoolean(data.c6_pass),
    c6Violations: toArray(data.c6_violations).map((v) => {
      const vr = toRecord(v);
      return { tag: readString(vr.tag), concept: readString(vr.concept), reason: readString(vr.reason) };
    }),
    entries: toArray(data.entries).map(mapMisconception),
  };
}

// --- single node + authoring ----------------------------------------------

export interface NodeRevision {
  version: number;
  changedFields: string[];
  fromStatus: string | null;
  toStatus: string | null;
  actorType: string;
  actorId: number | null;
  note: string | null;
  createdAt: string;
}

export interface NodeDetail {
  node: ContentNode;
  conceptName: string;
  conceptSlug: string;
  conceptDefinition: string;
  chapterName: string;
  subjectName: string;
  standard: number | null;
  semanticId: number;
  /** field -> 'derived' | 'ai' | 'missing' */
  provenance: Record<string, string>;
  llmCandidates: string[];
  revisions: NodeRevision[];
  allowedTransitions: string[];
}

function mapRevisions(raw: unknown): NodeRevision[] {
  return toArray(raw).map((v) => {
    const r = toRecord(v);
    return {
      version: readNumber(r.version),
      changedFields: toStringArray(r.changed_fields),
      fromStatus: readNullableString(r.from_status),
      toStatus: readNullableString(r.to_status),
      actorType: readString(r.actor_type),
      actorId: readNullableNumber(r.actor_id),
      note: readNullableString(r.note),
      createdAt: readString(r.created_at),
    };
  });
}

export async function fetchNode(nodeKey: string, signal?: AbortSignal): Promise<NodeDetail> {
  const data = toRecord(await callApi(`api/pal/new/content-model/nodes/${nodeKey}`, { signal }));
  const concept = toRecord(data.concept);
  const chapter = toRecord(data.chapter);
  const header = toRecord(chapter.header);

  const provenance: Record<string, string> = {};
  Object.entries(toRecord(data.provenance)).forEach(([field, value]) => {
    provenance[field] = readString(value);
  });

  return {
    node: mapNode(data.node),
    conceptName: readString(concept.name),
    conceptSlug: readString(concept.slug),
    conceptDefinition: readString(concept.definition),
    chapterName: readString(chapter.chapter_name),
    subjectName: readString(header.subject_name),
    standard: readNullableNumber(header.standard),
    semanticId: readNumber(header.id),
    provenance,
    llmCandidates: toStringArray(data.llm_candidates),
    revisions: mapRevisions(data.revisions),
    allowedTransitions: toStringArray(data.allowed_transitions),
  };
}

export interface SaveNodePayload {
  title?: string | null;
  body?: string | null;
  media_url?: string | null;
  metadata?: Record<string, unknown>;
  language_variants?: Record<string, { title?: string | null; body: string; source?: string }>;
  note?: string;
}

export async function saveNode(
  nodeKey: string,
  payload: SaveNodePayload
): Promise<{ node: ContentNode | null; revisions: NodeRevision[] }> {
  const data = toRecord(
    await callApi(`api/pal/new/content-model/nodes/${nodeKey}`, { method: 'POST', body: payload })
  );
  return {
    node: data.node ? mapNode(data.node) : null,
    revisions: mapRevisions(data.revisions),
  };
}

export async function transitionNode(
  nodeKey: string,
  toStatus: string,
  note?: string
): Promise<{ qualityStatus: string; allowedTransitions: string[] }> {
  const data = toRecord(
    await callApi(`api/pal/new/content-model/nodes/${nodeKey}/transition`, {
      method: 'POST',
      body: { to_status: toStatus, note },
    })
  );
  return {
    qualityStatus: readString(toRecord(data.override).quality_status),
    allowedTransitions: toStringArray(data.allowed_transitions),
  };
}

export async function restoreRevision(
  nodeKey: string,
  version: number
): Promise<{ revisions: NodeRevision[] }> {
  const data = toRecord(
    await callApi(`api/pal/new/content-model/nodes/${nodeKey}/restore`, {
      method: 'POST',
      body: { version },
    })
  );
  return { revisions: mapRevisions(data.revisions) };
}

// --- AI enrichment ---------------------------------------------------------

export type EnrichKind = 'cultural_context' | 'framework_tags' | 'variant_draft';

export interface EnrichmentResult {
  kind: EnrichKind;
  proposal: Record<string, unknown>;
  method: string;
  cached: boolean;
  model: string | null;
  applied: boolean;
  taggedBy: string;
  qualityStatus: string;
}

export async function enrichNode(
  nodeKey: string,
  kind: EnrichKind,
  options: { fields?: string[]; apply?: boolean } = {}
): Promise<EnrichmentResult> {
  const data = toRecord(
    await callApi(`api/pal/new/content-model/nodes/${nodeKey}/enrich`, {
      method: 'POST',
      body: { kind, fields: options.fields, apply: options.apply ?? false },
    })
  );

  return {
    kind,
    proposal: toRecord(data.proposal),
    method: readString(data.method),
    cached: readBoolean(data.cached),
    model: readNullableString(data.model),
    applied: readBoolean(data.applied),
    taggedBy: readString(data.tagged_by),
    qualityStatus: readString(data.quality_status),
  };
}

export interface TranslationResult {
  language: string;
  title: string | null;
  body: string;
  glossary: Array<{ en: string; translated: string }>;
  cached: boolean;
  model: string | null;
  applied: boolean;
}

export async function translateNode(
  nodeKey: string,
  language: string,
  apply = false
): Promise<TranslationResult> {
  const data = toRecord(
    await callApi(`api/pal/new/content-model/nodes/${nodeKey}/translate`, {
      method: 'POST',
      body: { language, apply },
    })
  );
  const translation = toRecord(data.translation);

  return {
    language: readString(data.language),
    title: readNullableString(translation.title),
    body: readString(translation.body),
    glossary: toArray(translation.glossary).map((g) => {
      const gr = toRecord(g);
      return { en: readString(gr.en), translated: readString(gr.translated) };
    }),
    cached: readBoolean(data.cached),
    model: readNullableString(data.model),
    applied: readBoolean(data.applied),
  };
}

// --- review queue ----------------------------------------------------------

export interface ReviewQueueItem {
  nodeKey: string;
  contentType: string;
  conceptSlug: string;
  semanticId: number | null;
  title: string;
  qualityStatus: string;
  taggedBy: string;
  confidence: number | null;
  version: number;
  updatedAt: string;
  reviewNote: string | null;
}

export interface ReviewQueue {
  items: ReviewQueueItem[];
  pipeline: Record<string, number>;
  qualityTransitions: Record<string, string[]>;
}

export async function fetchReviewQueue(
  filters: { status?: string; contentType?: string; semanticId?: number; taggedBy?: string } = {},
  signal?: AbortSignal
): Promise<ReviewQueue> {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.contentType) params.set('content_type', filters.contentType);
  if (filters.semanticId) params.set('semantic_id', String(filters.semanticId));
  if (filters.taggedBy) params.set('tagged_by', filters.taggedBy);
  const query = params.toString();

  const data = toRecord(
    await callApi(`api/pal/new/content-model/review-queue${query ? `?${query}` : ''}`, { signal })
  );

  const pipeline: Record<string, number> = {};
  Object.entries(toRecord(data.pipeline)).forEach(([key, value]) => {
    pipeline[key] = readNumber(value);
  });

  const qualityTransitions: Record<string, string[]> = {};
  Object.entries(toRecord(data.quality_transitions)).forEach(([from, to]) => {
    qualityTransitions[from] = toStringArray(to);
  });

  return {
    pipeline,
    qualityTransitions,
    items: toArray(data.items).map((raw) => {
      const r = toRecord(raw);
      return {
        nodeKey: readString(r.node_key),
        contentType: readString(r.content_type),
        conceptSlug: readString(r.concept_slug),
        semanticId: readNullableNumber(r.semantic_id),
        title: readString(r.title),
        qualityStatus: readString(r.quality_status),
        taggedBy: readString(r.tagged_by),
        confidence: readNullableNumber(r.confidence),
        version: readNumber(r.version),
        updatedAt: readString(r.updated_at),
        reviewNote: readNullableString(r.review_note),
      };
    }),
  };
}

export async function bulkTransition(
  nodeKeys: string[],
  toStatus: string,
  note?: string
): Promise<{ okCount: number; failCount: number; failed: Array<{ nodeKey: string; error: string }> }> {
  const data = toRecord(
    await callApi('api/pal/new/content-model/nodes/bulk-transition', {
      method: 'POST',
      body: { node_keys: nodeKeys, to_status: toStatus, note },
    })
  );

  return {
    okCount: readNumber(data.ok_count),
    failCount: readNumber(data.fail_count),
    failed: toArray(data.failed).map((f) => {
      const fr = toRecord(f);
      return { nodeKey: readString(fr.node_key), error: readString(fr.error) };
    }),
  };
}

// --- shared display helpers ------------------------------------------------

/** Tailwind classes for a quality status chip. Presentation only. */
export function statusTone(status: string): string {
  switch (status) {
    case 'approved':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'piloted':
      return 'bg-sky-50 text-sky-700 border-sky-200';
    case 'pedagogy_reviewed':
    case 'reviewed':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'deprecated':
      return 'bg-slate-100 text-slate-500 border-slate-200';
    default:
      return 'bg-amber-50 text-amber-700 border-amber-200';
  }
}

export function severityTone(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'high':
      return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'medium':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

export function scoreTone(pct: number): string {
  if (pct >= 80) return 'text-emerald-600';
  if (pct >= 50) return 'text-amber-600';
  if (pct > 0) return 'text-orange-600';
  return 'text-rose-600';
}

/** `snake_case_field` -> `Snake case field`, for labels the API did not name. */
export function humanise(value: string): string {
  if (!value) return '';
  const spaced = value.replace(/_/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
