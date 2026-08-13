import { buildSessionContext, readNumber, readString } from '@/lib/erp-client';

/**
 * PAL V4 Content Intelligence Layer — data layer.
 *
 * Mirrors the Laravel routes registered in `routes/pal_api.php` under
 * `/api/pal/content/*` (App\Http\Controllers\api\PAL\PalContentIntelligenceController).
 * Same `{ success, data }` envelope and same `pal.auth` JWT as `pal-v4.ts`.
 *
 * What this layer is FOR (spec: PAL_V4_Content_Intelligence_Layer.md):
 *   - the 4-type content model + 30+ field metadata schema
 *   - the 5-level Bloom's ladder
 *   - the misconception library and its corrective content
 *   - the authoring / QA review workflow
 *
 * Two server-side rules shape the UI and are worth knowing before changing it:
 *   C4  only `quality_status: 'approved'` content is ever served to a learner,
 *       so the review queue is the gate, not a nicety.
 *   C5  machine-written tags are PROPOSALS. The API refuses to let a batch job
 *       write an approved status, and refuses to let one modify an already
 *       approved row. Approval is always a human action and is always stamped.
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

function readBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === '1';
}

async function callContentApi(
  path: string,
  init: { method?: 'GET' | 'POST'; body?: unknown; signal?: AbortSignal } = {}
): Promise<unknown> {
  const session = buildSessionContext();
  if (!session.baseUrl) {
    throw new Error('Session data is missing. Please sign in again.');
  }
  if (!session.token) {
    throw new Error('Your session has expired. Please sign in again.');
  }

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
      throw new Error(serverMessage || 'You are not allowed to author or review this content.');
    }
    if (response.status === 422) {
      // The server validates against closed vocabularies and the QA stage rules;
      // its message names the exact field, so surface it verbatim.
      throw new Error(serverMessage || 'The server rejected that value.');
    }
    if (response.status === 404) {
      throw new Error(
        'The Content Intelligence API is not available on this server. It ships with the PAL V4 content layer — the backend may not be deployed yet.'
      );
    }
    throw new Error(serverMessage || `HTTP ${response.status}: the Content Intelligence API is unavailable.`);
  }

  const record = toRecord(payload);
  if (record.success === false) {
    throw new Error(readString(record.message) || 'Content Intelligence request failed.');
  }
  return 'data' in record ? record.data : payload;
}

// --- coverage --------------------------------------------------------------

export interface ContentEstateCoverage {
  total: number;
  tagged: number;
  approved: number;
  coveragePct: number;
}

export interface MisconceptionHealth {
  total: number;
  approved: number;
  servableWithCorrective: number;
  c6Violations: number;
  c6ViolationTags: string[];
  c6Pass: boolean;
}

export interface ContentCoverage {
  subInstituteId: number | null;
  questions: ContentEstateCoverage;
  content: ContentEstateCoverage;
  misconceptions: MisconceptionHealth;
}

function mapEstate(value: unknown): ContentEstateCoverage {
  const r = toRecord(value);
  return {
    total: readNumber(r.total),
    tagged: readNumber(r.tagged),
    approved: readNumber(r.approved),
    coveragePct: readNumber(r.coverage_pct),
  };
}

function mapHealth(value: unknown): MisconceptionHealth {
  const r = toRecord(value);
  return {
    total: readNumber(r.total),
    approved: readNumber(r.approved),
    servableWithCorrective: readNumber(r.servable_with_corrective),
    c6Violations: readNumber(r.c6_violations),
    c6ViolationTags: toStringArray(r.c6_violation_tags),
    c6Pass: readBoolean(r.c6_pass),
  };
}

export async function fetchContentCoverage(signal?: AbortSignal): Promise<ContentCoverage> {
  const data = toRecord(await callContentApi('api/pal/content/coverage', { signal }));
  return {
    subInstituteId: readNullableNumber(data.sub_institute_id),
    questions: mapEstate(data.questions),
    content: mapEstate(data.content),
    misconceptions: mapHealth(data.misconceptions),
  };
}

// --- vocabulary ------------------------------------------------------------

export interface BloomLevelDef {
  key: string;
  ordinal: number;
  practiceLevel: number;
  label: string;
}

export interface ContentVocabulary {
  bloomLevels: BloomLevelDef[];
  culturalContexts: string[];
  languages: string[];
  qualityStatuses: string[];
  /** status -> the statuses it may legally move to (spec §7.1). */
  qualityTransitions: Record<string, string[]>;
  servableStatuses: string[];
  hpcLenses: string[];
  contentTypes: string[];
  formats: string[];
  /** lms_mapping_type id -> pedagogy name; read live from the LMS estate. */
  pedagogy: Record<string, string>;
}

export async function fetchContentVocabulary(signal?: AbortSignal): Promise<ContentVocabulary> {
  const data = toRecord(await callContentApi('api/pal/content/vocabulary', { signal }));

  const bloomRaw = toRecord(data.bloom_levels);
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

  const transitionsRaw = toRecord(data.quality_transitions);
  const qualityTransitions: Record<string, string[]> = {};
  Object.entries(transitionsRaw).forEach(([from, to]) => {
    qualityTransitions[from] = toStringArray(to);
  });

  const pedagogyRaw = toRecord(data.pedagogy);
  const pedagogy: Record<string, string> = {};
  Object.entries(pedagogyRaw).forEach(([id, name]) => {
    pedagogy[id] = readString(name);
  });

  return {
    bloomLevels,
    culturalContexts: toStringArray(data.cultural_contexts),
    languages: toStringArray(data.languages),
    qualityStatuses: Object.keys(toRecord(data.quality_statuses)),
    qualityTransitions,
    servableStatuses: toStringArray(data.servable_statuses),
    hpcLenses: toStringArray(data.hpc_lenses),
    contentTypes: Object.keys(toRecord(data.content_types)),
    formats: Object.keys(toRecord(data.formats)),
    pedagogy,
  };
}

// --- review queue ----------------------------------------------------------

export type ContentEntityType = 'question' | 'content';

export interface ReviewItem {
  metadataId: number;
  entityId: number;
  title: string;
  conceptId: number | null;
  bloomLevel: string;
  practiceLevel: number | null;
  difficulty: number | null;
  culturalContext: string;
  language: string;
  taggedBy: string;
  /** 0-1, or null when the tagger recorded no confidence. */
  confidence: number | null;
  qualityStatus: string;
  /** Mandatory fields still blocking approval. */
  missingMandatory: string[];
  completeness: number;
  /** What the tagger matched on, when it recorded a reason. */
  bloomEvidence: string;
}

export interface ReviewQueue {
  entityType: ContentEntityType;
  status: string;
  count: number;
  items: ReviewItem[];
}

export async function fetchReviewQueue(
  entityType: ContentEntityType,
  options: { status?: string; limit?: number; conceptId?: number; taggedBy?: string } = {},
  signal?: AbortSignal
): Promise<ReviewQueue> {
  const params = new URLSearchParams();
  if (options.status) params.set('status', options.status);
  if (options.limit) params.set('limit', String(options.limit));
  if (options.conceptId) params.set('concept_id', String(options.conceptId));
  if (options.taggedBy) params.set('tagged_by', options.taggedBy);

  const query = params.toString();
  const data = toRecord(
    await callContentApi(`api/pal/content/review-queue/${entityType}${query ? `?${query}` : ''}`, { signal })
  );

  return {
    entityType,
    status: readString(data.status) || 'draft',
    count: readNumber(data.count),
    items: toArray(data.items).map((raw) => {
      const r = toRecord(raw);
      const rationale = toRecord(r.ai_rationale);
      return {
        metadataId: readNumber(r.metadata_id),
        entityId: readNumber(r.entity_id),
        title: readString(r.title),
        conceptId: readNullableNumber(r.concept_id),
        bloomLevel: readString(r.bloom_level),
        practiceLevel: readNullableNumber(r.practice_level),
        difficulty: readNullableNumber(r.difficulty),
        culturalContext: readString(r.cultural_context),
        language: readString(r.language),
        taggedBy: readString(r.tagged_by),
        confidence: readNullableNumber(r.confidence),
        qualityStatus: readString(r.quality_status),
        missingMandatory: toStringArray(r.missing_mandatory),
        completeness: readNumber(r.completeness),
        bloomEvidence: readString(rationale.bloom_evidence),
      };
    }),
  };
}

/** Save edits to one row's metadata. Always a human action, always stamped. */
export async function saveMetadata(
  entityType: ContentEntityType,
  entityId: number,
  payload: Record<string, unknown>
): Promise<void> {
  await callContentApi(`api/pal/content/metadata/${entityType}/${entityId}`, {
    method: 'POST',
    body: payload,
  });
}

export interface BulkTransitionResult {
  approved: number[];
  failed: Array<{ id: number; error: string }>;
  okCount: number;
  failCount: number;
}

/**
 * Move rows through the QA pipeline. Rows are validated individually — one
 * illegal transition does not sink the batch, it comes back in `failed` so the
 * reviewer sees exactly which row was refused and why.
 */
export async function bulkTransition(
  entityType: ContentEntityType,
  ids: number[],
  toStatus: string,
  note?: string
): Promise<BulkTransitionResult> {
  const data = toRecord(
    await callContentApi(`api/pal/content/review/${entityType}/bulk`, {
      method: 'POST',
      body: { ids, to_status: toStatus, note },
    })
  );

  return {
    approved: toArray(data.approved).map((v) => readNumber(v)),
    failed: toArray(data.failed).map((raw) => {
      const r = toRecord(raw);
      return { id: readNumber(r.id), error: readString(r.error) };
    }),
    okCount: readNumber(data.ok_count),
    failCount: readNumber(data.fail_count),
  };
}

// --- misconception library -------------------------------------------------

export interface MisconceptionCorrectiveItem {
  id: number;
  title: string;
  body: string;
  format: string;
  h5pType: string;
  language: string;
  qualityStatus: string;
  priorityLevel: number;
  servedCount: number;
  resolutionRate: number | null;
  estimatedDurationMinutes: number | null;
}

export interface MisconceptionItem {
  id: number;
  tag: string;
  subject: string;
  gradeBand: string;
  conceptId: number | null;
  conceptCode: string;
  description: string;
  errorPattern: string;
  correctiveAction: string;
  typicalWrongAnswers: string[];
  prevalenceRate: number | null;
  correctiveFormat: string;
  priorityLevel: number;
  qualityStatus: string;
  teacherConfirmed: boolean;
  detectionCount: number;
  correctiveCount: number;
  /** False when the entry has no corrective at all — it can never be served. */
  c6Ok: boolean;
}

export async function fetchMisconceptions(
  options: { conceptId?: number; subject?: string; status?: string; limit?: number } = {},
  signal?: AbortSignal
): Promise<MisconceptionItem[]> {
  const params = new URLSearchParams();
  if (options.conceptId) params.set('concept_id', String(options.conceptId));
  if (options.subject) params.set('subject', options.subject);
  if (options.status) params.set('status', options.status);
  if (options.limit) params.set('limit', String(options.limit));

  const query = params.toString();
  const data = toRecord(
    await callContentApi(`api/pal/content/misconceptions${query ? `?${query}` : ''}`, { signal })
  );

  return toArray(data.items).map((raw) => {
    const r = toRecord(raw);
    return {
      id: readNumber(r.id),
      tag: readString(r.tag),
      subject: readString(r.subject),
      gradeBand: readString(r.grade_band),
      conceptId: readNullableNumber(r.concept_id),
      conceptCode: readString(r.concept_code),
      description: readString(r.description),
      errorPattern: readString(r.error_pattern),
      correctiveAction: readString(r.corrective_action),
      typicalWrongAnswers: toStringArray(r.typical_wrong_answers),
      prevalenceRate: readNullableNumber(r.prevalence_rate),
      correctiveFormat: readString(r.corrective_format),
      priorityLevel: readNumber(r.priority_level),
      qualityStatus: readString(r.quality_status),
      teacherConfirmed: readBoolean(r.teacher_confirmed),
      detectionCount: readNumber(r.detection_count),
      correctiveCount: readNumber(r.corrective_count),
      c6Ok: readBoolean(r.c6_ok),
    };
  });
}

/** One entry with its correctives, for the expanded view. */
export async function fetchMisconceptionDetail(
  id: number,
  signal?: AbortSignal
): Promise<{ item: MisconceptionItem; correctives: MisconceptionCorrectiveItem[] }> {
  const r = toRecord(await callContentApi(`api/pal/content/misconceptions/${id}`, { signal }));

  const correctives = toArray(r.correctives).map((raw) => {
    const c = toRecord(raw);
    return {
      id: readNumber(c.id),
      title: readString(c.title),
      body: readString(c.body),
      format: readString(c.format),
      h5pType: readString(c.h5p_type),
      language: readString(c.language),
      qualityStatus: readString(c.quality_status),
      priorityLevel: readNumber(c.priority_level),
      servedCount: readNumber(c.served_count),
      resolutionRate: readNullableNumber(c.resolution_rate),
      estimatedDurationMinutes: readNullableNumber(c.estimated_duration_minutes),
    };
  });

  return {
    item: {
      id: readNumber(r.id),
      tag: readString(r.tag),
      subject: readString(r.subject),
      gradeBand: readString(r.grade_band),
      conceptId: readNullableNumber(r.concept_ref_id),
      conceptCode: readString(r.concept_code),
      description: readString(r.description),
      errorPattern: readString(r.error_pattern),
      correctiveAction: readString(r.corrective_action),
      typicalWrongAnswers: toStringArray(r.typical_wrong_answers),
      prevalenceRate: readNullableNumber(r.prevalence_rate),
      correctiveFormat: readString(r.corrective_format),
      priorityLevel: readNumber(r.priority_level),
      qualityStatus: readString(r.quality_status),
      teacherConfirmed: readBoolean(r.teacher_confirmed),
      detectionCount: readNumber(r.detection_count),
      correctiveCount: correctives.length,
      c6Ok: correctives.some((c) => c.qualityStatus === 'approved'),
    },
    correctives,
  };
}

export async function fetchMisconceptionHealth(signal?: AbortSignal): Promise<MisconceptionHealth> {
  return mapHealth(await callContentApi('api/pal/content/misconception/health', { signal }));
}

// --- Bloom ladder ----------------------------------------------------------

export interface LadderLevel {
  level: number;
  name: string;
  bloomLevel: string;
  scaffold: string;
  itemsTotal: number;
  itemsApproved: number;
  /** False when there are too few approved items for the gate to be passable. */
  servable: boolean;
}

export async function fetchLadder(conceptId: number, signal?: AbortSignal): Promise<LadderLevel[]> {
  const data = toRecord(await callContentApi(`api/pal/content/ladder/${conceptId}`, { signal }));

  return toArray(data.levels).map((raw) => {
    const r = toRecord(raw);
    return {
      level: readNumber(r.level),
      name: readString(r.name),
      bloomLevel: readString(r.bloom_level),
      scaffold: readString(r.scaffold),
      itemsTotal: readNumber(r.items_total),
      itemsApproved: readNumber(r.items_approved),
      servable: readBoolean(r.servable),
    };
  });
}
