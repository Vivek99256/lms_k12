import { buildSessionContext, readNumber, readString } from '@/lib/erp-client';
import type { H5pContext } from './h5p';

/**
 * H5P Model — data layer.
 *
 * Mirrors the Laravel routes under `/api/pal/h5p/*`
 * (App\Http\Controllers\api\PAL\PalH5PModelController), same `{success, data}`
 * envelope and same `pal.auth` JWT as the rest of PAL.
 *
 * There is no content in this file and none in the pages that consume it. The
 * 21 H5P types, the 12 pedagogies, the CASEL / NGSS / NCDG / Music / Sports /
 * Finance vocabularies, the pedagogy × framework coverage matrix, the xAPI verb
 * map, the engagement weights and every metric all arrive from the API, which
 * reads them from `pal_vocabulary`, the live H5P tables and
 * `pal_telemetry_events`. Adding a 22nd H5P type is a registry row — nothing
 * here changes.
 *
 * Two server rules shape the UI and are worth knowing before changing it:
 *   C5  a machine may only ever PROPOSE. AI tags come back as a draft tagged
 *       `ai`; the API refuses to let a machine write an approved status or
 *       overwrite one a human approved. `suggestTags` therefore returns
 *       proposals and saves nothing.
 *   §8.3 engagement figures are MEASURED, not authored. `completion_rate`,
 *       `avg_engagement_score` and `avg_session_duration_minutes` are `null`
 *       until telemetry exists — render "not measured yet", never a zero.
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

/** `null` rather than 0 — an unmeasured metric must not render as a real zero. */
function readNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readNullableString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

function readBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === '1';
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
    cache: 'no-store',
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
      throw new Error(serverMessage || 'You are not allowed to open the H5P Model workspace.');
    }
    if (response.status === 422) {
      // The server validates against the closed registry; its message names
      // the exact field, so surface it verbatim.
      throw new Error(serverMessage || 'The server rejected that value.');
    }
    if (response.status === 404) {
      throw new Error(
        serverMessage ||
          'The H5P Model API is not available on this server. It ships with the PAL V4 H5P module — the backend may not be deployed yet.'
      );
    }
    throw new Error(serverMessage || `HTTP ${response.status}: the H5P Model API is unavailable.`);
  }

  const record = toRecord(payload);
  if (record.success === false) {
    throw new Error(readString(record.message) || 'H5P Model request failed.');
  }
  return 'data' in record ? record.data : payload;
}

function contextQuery(ctx: H5pContext, extra: Record<string, string | number | undefined> = {}): string {
  const params = new URLSearchParams();
  if (ctx.chapter_id) params.set('chapter_id', ctx.chapter_id);
  if (ctx.subject_id) params.set('subject_id', ctx.subject_id);
  if (ctx.standard_id) params.set('standard_id', ctx.standard_id);
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

// --- registry types --------------------------------------------------------

/** One row of a registry domain, exactly as `pal_vocabulary` holds it. */
export interface RegistryTerm {
  code: string;
  label: string;
  description: string | null;
  metadata: Record<string, unknown>;
  sort_order: number;
}

function readTerm(value: unknown): RegistryTerm {
  const record = toRecord(value);
  return {
    code: readString(record.code),
    label: readString(record.label) || readString(record.code),
    description: readNullableString(record.description),
    metadata: toRecord(record.metadata),
    sort_order: readNumber(record.sort_order),
  };
}

function readTermList(value: unknown): RegistryTerm[] {
  return toArray(value).map(readTerm);
}

/** pedagogy → framework → tag → 'strong' | 'supporting'. */
export type CoverageMatrix = Record<string, Record<string, Record<string, string>>>;

export interface H5pRegistry {
  /** 'database' when read from pal_vocabulary, 'config' when falling back. */
  source: string;
  h5pTypes: RegistryTerm[];
  pedagogies: RegistryTerm[];
  frameworks: Record<string, RegistryTerm[]>;
  gardnerIntelligences: RegistryTerm[];
  riasecSignals: RegistryTerm[];
  hpcLenses: RegistryTerm[];
  bloomLevels: RegistryTerm[];
  xapiVerbs: RegistryTerm[];
  engagementSignals: RegistryTerm[];
  engagementWeights: Record<string, number>;
  selectionRules: RegistryTerm[];
  coverageMatrix: CoverageMatrix;
  qualityStatuses: string[];
  culturalContexts: string[];
  ai: { available: boolean; unavailableReason: string | null };
}

function readCoverageMatrix(value: unknown): CoverageMatrix {
  const out: CoverageMatrix = {};
  for (const [pedagogy, frameworks] of Object.entries(toRecord(value))) {
    const row: Record<string, Record<string, string>> = {};
    for (const [framework, tags] of Object.entries(toRecord(frameworks))) {
      const entries: Record<string, string> = {};
      for (const [tag, strength] of Object.entries(toRecord(tags))) {
        entries[tag] = readString(strength);
      }
      row[framework] = entries;
    }
    out[pedagogy] = row;
  }
  return out;
}

export async function fetchRegistry(signal?: AbortSignal): Promise<H5pRegistry> {
  const raw = toRecord(await callApi('api/pal/h5p/registry', { signal }));
  const frameworks: Record<string, RegistryTerm[]> = {};
  for (const [key, terms] of Object.entries(toRecord(raw.frameworks))) {
    frameworks[key] = readTermList(terms);
  }

  const weights: Record<string, number> = {};
  for (const [key, weight] of Object.entries(toRecord(raw.engagement_weights))) {
    weights[key] = readNumber(weight);
  }

  const ai = toRecord(raw.ai);

  return {
    source: readString(raw.source) || 'config',
    h5pTypes: readTermList(raw.h5p_types),
    pedagogies: readTermList(raw.pedagogies),
    frameworks,
    gardnerIntelligences: readTermList(raw.gardner_intelligences),
    riasecSignals: readTermList(raw.riasec_signals),
    hpcLenses: readTermList(raw.hpc_lenses),
    bloomLevels: readTermList(raw.bloom_levels),
    xapiVerbs: readTermList(raw.xapi_verbs),
    engagementSignals: readTermList(raw.engagement_signals),
    engagementWeights: weights,
    selectionRules: readTermList(raw.selection_rules),
    coverageMatrix: readCoverageMatrix(raw.coverage_matrix),
    qualityStatuses: toStringArray(raw.quality_statuses),
    culturalContexts: toStringArray(raw.cultural_contexts),
    ai: {
      available: readBoolean(ai.available),
      unavailableReason: readNullableString(ai.unavailable_reason),
    },
  };
}

// --- engagement (§8.3) -----------------------------------------------------

export interface EngagementSignal {
  score: number;
  observed: number;
  reference: number;
  unit: string;
}

export interface H5pEngagement {
  h5pType: string;
  /** Authored in the registry. */
  engagementWeight: number;
  fluencyTrackable: string;
  xapiEventsGenerated: string[];
  socialMode: string;
  gamificationPotential: string;
  offlineCompatible: boolean;
  mobileOptimised: boolean;
  retryAllowed: boolean;
  expectedCompletionMinutes: number;
  /** Measured. False means every figure below is null. */
  measured: boolean;
  sampleSize: number;
  windowDays: number;
  usageCount: number;
  learners: number;
  sessions: number;
  completionRate: number | null;
  avgSessionDurationMinutes: number | null;
  avgEngagementScore: number | null;
  signals: Record<string, EngagementSignal> | null;
  lastEventAt: string | null;
}

function readEngagement(value: unknown): H5pEngagement | null {
  const record = toRecord(value);
  if (Object.keys(record).length === 0) return null;

  let signals: Record<string, EngagementSignal> | null = null;
  if (record.signals && typeof record.signals === 'object') {
    signals = {};
    for (const [key, signal] of Object.entries(toRecord(record.signals))) {
      const s = toRecord(signal);
      signals[key] = {
        score: readNumber(s.score),
        observed: readNumber(s.observed),
        reference: readNumber(s.reference),
        unit: readString(s.unit),
      };
    }
  }

  return {
    h5pType: readString(record.h5p_type),
    engagementWeight: readNumber(record.engagement_weight),
    fluencyTrackable: readString(record.fluency_trackable) || 'no',
    xapiEventsGenerated: toStringArray(record.xapi_events_generated),
    socialMode: readString(record.social_mode),
    gamificationPotential: readString(record.gamification_potential),
    offlineCompatible: readBoolean(record.offline_compatible),
    mobileOptimised: readBoolean(record.mobile_optimised),
    retryAllowed: readBoolean(record.retry_allowed),
    expectedCompletionMinutes: readNumber(record.expected_completion_minutes),
    measured: readBoolean(record.measured),
    sampleSize: readNumber(record.sample_size),
    windowDays: readNumber(record.window_days),
    usageCount: readNumber(record.usage_count),
    learners: readNumber(record.learners),
    sessions: readNumber(record.sessions),
    completionRate: readNullableNumber(record.completion_rate),
    avgSessionDurationMinutes: readNullableNumber(record.avg_session_duration_minutes),
    avgEngagementScore: readNullableNumber(record.avg_engagement_score),
    signals,
    lastEventAt: readNullableString(record.last_event_at),
  };
}

export interface TelemetrySummary {
  available: boolean;
  reason: string | null;
  windowDays: number;
  totalEvents: number;
  typedEvents: number;
  learners: number;
  sessions: number;
  lastEventAt: string | null;
}

function readTelemetry(value: unknown): TelemetrySummary {
  const record = toRecord(value);
  return {
    available: readBoolean(record.available),
    reason: readNullableString(record.reason),
    windowDays: readNumber(record.window_days),
    totalEvents: readNumber(record.total_events),
    typedEvents: readNumber(record.typed_events),
    learners: readNumber(record.learners),
    sessions: readNumber(record.sessions),
    lastEventAt: readNullableString(record.last_event_at),
  };
}

// --- hub -------------------------------------------------------------------

export interface H5pPedagogyLink {
  primary: string[];
  secondary: string[];
}

function readPedagogyLink(value: unknown): H5pPedagogyLink {
  const record = toRecord(value);
  return { primary: toStringArray(record.primary), secondary: toStringArray(record.secondary) };
}

export interface H5pHubModule {
  id: number;
  h5pType: string;
  title: string;
  description: string;
  icon: string;
  route: string | null;
  nodeCount: number;
  childCount: number;
  childLabel: string | null;
  available: boolean;
  unavailableReason: string | null;
  pedagogies: H5pPedagogyLink;
  bloomRange: string[];
  fluencyTrackable: string;
  xapiEvents: string[];
  engagement: H5pEngagement | null;
}

function readHubModule(value: unknown): H5pHubModule {
  const record = toRecord(value);
  return {
    id: readNumber(record.id),
    h5pType: readString(record.h5p_type),
    title: readString(record.title),
    description: readString(record.description),
    icon: readString(record.icon),
    route: readNullableString(record.route),
    nodeCount: readNumber(record.node_count),
    childCount: readNumber(record.child_count),
    childLabel: readNullableString(record.child_label),
    available: readBoolean(record.available),
    unavailableReason: readNullableString(record.unavailable_reason),
    pedagogies: readPedagogyLink(record.pedagogies),
    bloomRange: toStringArray(record.bloom_range),
    fluencyTrackable: readString(record.fluency_trackable) || 'no',
    xapiEvents: toStringArray(record.xapi_events),
    engagement: readEngagement(record.engagement),
  };
}

export interface H5pHub {
  modules: H5pHubModule[];
  telemetry: TelemetrySummary;
  registrySource: string;
  chapterName: string | null;
  subjectName: string | null;
  standardName: string | null;
}

export async function fetchHub(ctx: H5pContext, signal?: AbortSignal): Promise<H5pHub> {
  const raw = toRecord(await callApi(`api/pal/h5p/hub${contextQuery(ctx)}`, { signal }));
  const context = toRecord(raw.context);
  return {
    modules: toArray(raw.modules).map(readHubModule),
    telemetry: readTelemetry(raw.telemetry),
    registrySource: readString(raw.registry_source) || 'config',
    chapterName: readNullableString(context.chapter_name),
    subjectName: readNullableString(context.subject_name),
    standardName: readNullableString(context.standard_name),
  };
}

// --- node model ------------------------------------------------------------

/** Where each tag field's value came from. */
export type FieldSource = 'stored' | 'derived' | 'ai' | 'missing';

export interface H5pNodeModel {
  nodeKey: string;
  h5pType: string;
  values: Record<string, unknown>;
  fieldSources: Record<string, FieldSource>;
  qualityStatus: string;
  taggedBy: string | null;
  confidence: number | null;
  reviewedAt: string | null;
  version: number;
  /** Per-field prose explaining a derived value. */
  derivation: Record<string, string>;
  /** Per-field 'strong' | 'supporting', from the §9 matrix. */
  coverageStrength: Record<string, string>;
  completeness: number;
  notice: string | null;
}

function readNodeModel(value: unknown): H5pNodeModel | null {
  const record = toRecord(value);
  if (Object.keys(record).length === 0) return null;

  const sources: Record<string, FieldSource> = {};
  for (const [field, source] of Object.entries(toRecord(record.field_sources))) {
    sources[field] = readString(source) as FieldSource;
  }

  const derivation: Record<string, string> = {};
  for (const [field, why] of Object.entries(toRecord(record.derivation))) {
    derivation[field] = readString(why);
  }

  const strength: Record<string, string> = {};
  for (const [field, level] of Object.entries(toRecord(record.coverage_strength))) {
    strength[field] = readString(level);
  }

  return {
    nodeKey: readString(record.node_key),
    h5pType: readString(record.h5p_type),
    values: toRecord(record.values),
    fieldSources: sources,
    qualityStatus: readString(record.quality_status) || 'untagged',
    taggedBy: readNullableString(record.tagged_by),
    confidence: readNullableNumber(record.confidence),
    reviewedAt: readNullableString(record.reviewed_at),
    version: readNumber(record.version),
    derivation,
    coverageStrength: strength,
    completeness: readNumber(record.completeness),
    notice: readNullableString(record.notice),
  };
}

export interface H5pNode {
  nodeKey: string;
  h5pType: string;
  id: number;
  title: string;
  summary: string | null;
  mediaUrl: string | null;
  chapterId: number | null;
  subjectId: number | null;
  standardId: number | null;
  childCount: number | null;
  childLabel: string | null;
  sourceTable: string;
  createdAt: string | null;
  model: H5pNodeModel | null;
  engagement: H5pEngagement | null;
}

function readNode(value: unknown): H5pNode {
  const record = toRecord(value);
  return {
    nodeKey: readString(record.node_key),
    h5pType: readString(record.h5p_type),
    id: readNumber(record.id),
    title: readString(record.title),
    summary: readNullableString(record.summary),
    mediaUrl: readNullableString(record.media_url),
    chapterId: readNullableNumber(record.chapter_id),
    subjectId: readNullableNumber(record.subject_id),
    standardId: readNullableNumber(record.standard_id),
    childCount: readNullableNumber(record.child_count),
    childLabel: readNullableString(record.child_label),
    sourceTable: readString(record.source_table),
    createdAt: readNullableString(record.created_at),
    model: readNodeModel(record.model),
    engagement: readEngagement(record.engagement),
  };
}

// --- chapter model ---------------------------------------------------------

export interface InventoryRow {
  h5pType: string;
  label: string;
  description: string | null;
  implementationStatus: string;
  route: string | null;
  nodeCount: number;
  childCount: number;
  childLabel: string | null;
  available: boolean;
  unavailableReason: string | null;
  palUseCases: string[];
  bloomFrom: string | null;
  bloomTo: string | null;
  xapiEvents: string[];
  fluencyTrackable: string;
  pedagogies: H5pPedagogyLink;
  engagement: H5pEngagement | null;
}

function readInventoryRow(value: unknown): InventoryRow {
  const record = toRecord(value);
  return {
    h5pType: readString(record.h5p_type),
    label: readString(record.label),
    description: readNullableString(record.description),
    implementationStatus: readString(record.implementation_status) || 'planned',
    route: readNullableString(record.route),
    nodeCount: readNumber(record.node_count),
    childCount: readNumber(record.child_count),
    childLabel: readNullableString(record.child_label),
    available: readBoolean(record.available),
    unavailableReason: readNullableString(record.unavailable_reason),
    palUseCases: toStringArray(record.pal_use_cases),
    bloomFrom: readNullableString(record.bloom_from),
    bloomTo: readNullableString(record.bloom_to),
    xapiEvents: toStringArray(record.xapi_events),
    fluencyTrackable: readString(record.fluency_trackable) || 'no',
    pedagogies: readPedagogyLink(record.pedagogies),
    engagement: readEngagement(record.engagement),
  };
}

export interface CoverageCloser {
  pedagogy: string;
  pedagogyLabel: string;
  strength: string;
  h5pType: string | null;
  h5pTypeLabel: string | null;
  implemented: boolean;
}

export interface CoverageTag {
  code: string;
  label: string;
  nodeCount: number;
  covered: boolean;
  closesWith: CoverageCloser[];
}

export interface FrameworkCoverage {
  framework: string;
  label: string;
  tags: CoverageTag[];
  covered: number;
  total: number;
  ratio: number;
}

function readCoverage(value: unknown): FrameworkCoverage[] {
  const out: FrameworkCoverage[] = [];
  for (const [framework, block] of Object.entries(toRecord(value))) {
    const record = toRecord(block);
    out.push({
      framework,
      label: readString(record.label) || framework,
      covered: readNumber(record.covered),
      total: readNumber(record.total),
      ratio: readNumber(record.ratio),
      tags: toArray(record.tags).map((tag) => {
        const t = toRecord(tag);
        return {
          code: readString(t.code),
          label: readString(t.label),
          nodeCount: readNumber(t.node_count),
          covered: readBoolean(t.covered),
          closesWith: toArray(t.closes_with).map((closer) => {
            const c = toRecord(closer);
            return {
              pedagogy: readString(c.pedagogy),
              pedagogyLabel: readString(c.pedagogy_label),
              strength: readString(c.strength),
              h5pType: readNullableString(c.h5p_type),
              h5pTypeLabel: readNullableString(c.h5p_type_label),
              implemented: readBoolean(c.implemented),
            };
          }),
        };
      }),
    });
  }
  return out;
}

export interface PedagogyShare {
  pedagogy: string;
  label: string;
  nodeCount: number;
  share: number;
  primaryH5p: string[];
}

export interface TaggingHealth {
  total: number;
  stored: number;
  derivedOnly: number;
  aiDraft: number;
  approved: number;
  avgCompleteness: number | null;
}

export interface H5pChapterModel {
  chapterId: number | null;
  chapterName: string | null;
  subjectName: string | null;
  standardName: string | null;
  registrySource: string;
  inventory: InventoryRow[];
  nodes: H5pNode[];
  nodeCount: number;
  truncated: boolean;
  coverage: FrameworkCoverage[];
  pedagogyDistribution: PedagogyShare[];
  taggingHealth: TaggingHealth;
  telemetry: TelemetrySummary;
  ai: { available: boolean; unavailableReason: string | null };
}

export async function fetchChapterModel(
  ctx: H5pContext,
  options: { type?: string; limit?: number; windowDays?: number } = {},
  signal?: AbortSignal
): Promise<H5pChapterModel> {
  const query = contextQuery(ctx, {
    type: options.type,
    limit: options.limit,
    window_days: options.windowDays,
  });
  const raw = toRecord(await callApi(`api/pal/h5p/chapter-model${query}`, { signal }));
  const context = toRecord(raw.context);
  const health = toRecord(raw.tagging_health);
  const ai = toRecord(raw.ai);

  return {
    chapterId: readNullableNumber(context.chapter_id),
    chapterName: readNullableString(context.chapter_name),
    subjectName: readNullableString(context.subject_name),
    standardName: readNullableString(context.standard_name),
    registrySource: readString(raw.registry_source) || 'config',
    inventory: toArray(raw.inventory).map(readInventoryRow),
    nodes: toArray(raw.nodes).map(readNode),
    nodeCount: readNumber(raw.node_count),
    truncated: readBoolean(raw.truncated),
    coverage: readCoverage(raw.coverage),
    pedagogyDistribution: toArray(raw.pedagogy_distribution).map((row) => {
      const record = toRecord(row);
      return {
        pedagogy: readString(record.pedagogy),
        label: readString(record.label),
        nodeCount: readNumber(record.node_count),
        share: readNumber(record.share),
        primaryH5p: toStringArray(record.primary_h5p),
      };
    }),
    taggingHealth: {
      total: readNumber(health.total),
      stored: readNumber(health.stored),
      derivedOnly: readNumber(health.derived_only),
      aiDraft: readNumber(health.ai_draft),
      approved: readNumber(health.approved),
      avgCompleteness: readNullableNumber(health.avg_completeness),
    },
    telemetry: readTelemetry(raw.telemetry),
    ai: {
      available: readBoolean(ai.available),
      unavailableReason: readNullableString(ai.unavailable_reason),
    },
  };
}

// --- pedagogy selection (§1.3) ---------------------------------------------

export interface SelectionTraceStep {
  rule: string;
  label: string;
  matched: boolean;
  reason: string;
  wouldSelect: string | null;
}

export interface PedagogySelection {
  pedagogy: string | null;
  label: string | null;
  selectedByRule: string | null;
  h5pTypes: H5pPedagogyLink;
  availableInChapter: Record<string, { nodeCount: number; types: string[] }>;
  history: {
    ranked: string[];
    scores: Record<string, number>;
    sampleSize: number;
    windowDays: number;
  };
  trace: SelectionTraceStep[];
}

export async function fetchPedagogySelection(
  ctx: H5pContext,
  options: { learnerId?: number; sessionType?: string; engagementTrend?: string; pedagogyRequired?: string } = {},
  signal?: AbortSignal
): Promise<PedagogySelection> {
  const query = contextQuery(ctx, {
    learner_id: options.learnerId,
    session_type: options.sessionType,
    engagement_trend: options.engagementTrend,
    pedagogy_required: options.pedagogyRequired,
  });
  const raw = toRecord(await callApi(`api/pal/h5p/pedagogy/select${query}`, { signal }));
  const history = toRecord(raw.history);

  const scores: Record<string, number> = {};
  for (const [key, score] of Object.entries(toRecord(history.scores))) {
    scores[key] = readNumber(score);
  }

  const available: Record<string, { nodeCount: number; types: string[] }> = {};
  for (const [key, block] of Object.entries(toRecord(raw.available_in_chapter))) {
    const record = toRecord(block);
    available[key] = { nodeCount: readNumber(record.node_count), types: toStringArray(record.types) };
  }

  return {
    pedagogy: readNullableString(raw.pedagogy),
    label: readNullableString(raw.label),
    selectedByRule: readNullableString(raw.selected_by_rule),
    h5pTypes: readPedagogyLink(raw.h5p_types),
    availableInChapter: available,
    history: {
      ranked: toStringArray(history.ranked),
      scores,
      sampleSize: readNumber(history.sample_size),
      windowDays: readNumber(history.window_days),
    },
    trace: toArray(raw.trace).map((step) => {
      const record = toRecord(step);
      return {
        rule: readString(record.rule),
        label: readString(record.label),
        matched: readBoolean(record.matched),
        reason: readString(record.reason),
        wouldSelect: readNullableString(record.would_select),
      };
    }),
  };
}

// --- tagging ---------------------------------------------------------------

export async function saveNodeTags(
  nodeKey: string,
  ctx: H5pContext,
  values: Record<string, unknown>
): Promise<H5pNodeModel | null> {
  const [h5pType, nodeId] = nodeKey.split(':');
  const raw = toRecord(
    await callApi(`api/pal/h5p/nodes/${h5pType}/${nodeId}/tags`, {
      method: 'POST',
      body: { ...values, chapter_id: ctx.chapter_id, subject_id: ctx.subject_id, standard_id: ctx.standard_id },
    })
  );
  return readNodeModel(raw.model);
}

export async function transitionNodeTags(nodeKey: string, status: string): Promise<H5pNodeModel | null> {
  const [h5pType, nodeId] = nodeKey.split(':');
  const raw = toRecord(
    await callApi(`api/pal/h5p/nodes/${h5pType}/${nodeId}/transition`, {
      method: 'POST',
      body: { status },
    })
  );
  return readNodeModel(raw.model);
}

export interface TagProposal {
  nodeKey: string;
  values: Record<string, unknown>;
  rationale: string | null;
  confidence: number;
}

export interface TagProposalResult {
  proposals: TagProposal[];
  available: boolean;
  reason: string | null;
  model: string | null;
  cached: boolean;
}

/**
 * Ask the model to fill the gaps derivation could not. Nothing is written —
 * the proposals come back for review and saving them is a separate,
 * human-initiated `saveNodeTags` call (CONTENT LAW C5).
 */
export async function suggestTags(ctx: H5pContext, nodeKeys?: string[]): Promise<TagProposalResult> {
  const raw = toRecord(
    await callApi('api/pal/h5p/suggest-tags', {
      method: 'POST',
      body: {
        chapter_id: ctx.chapter_id,
        subject_id: ctx.subject_id,
        standard_id: ctx.standard_id,
        node_keys: nodeKeys,
      },
    })
  );

  const proposals: TagProposal[] = [];
  for (const [nodeKey, block] of Object.entries(toRecord(raw.proposals))) {
    const record = toRecord(block);
    proposals.push({
      nodeKey,
      values: toRecord(record.values),
      rationale: readNullableString(record.rationale),
      confidence: readNumber(record.confidence),
    });
  }

  return {
    proposals,
    available: readBoolean(raw.available),
    reason: readNullableString(raw.reason),
    model: readNullableString(raw.model),
    cached: readBoolean(raw.cached),
  };
}

// --- DeepSeek insight layer over the xAPI stream ---------------------------

/**
 * The evidence pack is computed in SQL from the event stream — every number
 * here is measured. The `insight` block is DeepSeek reading that pack; it can
 * describe and recommend but never supplies a figure, and any node key,
 * pedagogy or H5P type it invents is stripped server-side before it arrives.
 */
export interface EvidenceNode {
  nodeKey: string;
  title: string;
  h5pType: string;
  pedagogyTag: string | null;
  bloomLevel: string | null;
  attempts: number;
  correct: number;
  incorrect: number;
  accuracy: number | null;
  completions: number;
  learners: number;
  avgSeconds: number | null;
}

export interface EvidencePedagogy {
  pedagogyTag: string;
  label: string;
  attempts: number;
  learners: number;
  accuracy: number | null;
  avgSeconds: number | null;
}

export interface AttentionSignal {
  verb: string;
  label: string;
  occurrences: number;
  learners: number;
}

export interface EvidencePack {
  learnerId: number | null;
  windowDays: number;
  telemetryAvailable: boolean;
  telemetryReason: string | null;
  hasEvidence: boolean;
  totals: { events: number; learners: number; sessions: number; totalSeconds: number; lastEventAt: string | null };
  nodes: EvidenceNode[];
  byPedagogy: EvidencePedagogy[];
  attentionSignals: AttentionSignal[];
  struggles: Array<{
    nodeKey: string;
    title: string;
    h5pType: string;
    pedagogyTag: string | null;
    accuracy: number;
    attempts: number;
    learners: number;
    avgSeconds: number | null;
  }>;
  coverageGaps: Record<string, { missing: string[]; covered: number; total: number }>;
}

/** 'ok' | 'insufficient_evidence' | 'unavailable' | 'failed'. */
export type InsightStatus = string;

export interface H5pInsight {
  status: InsightStatus;
  reason: string | null;
  headline: string;
  observations: Array<{ text: string; nodeKeys: string[] }>;
  whatIsWorking: Array<{ text: string; pedagogyTag: string | null }>;
  struggles: Array<{
    nodeKey: string;
    why: string;
    suggestedPedagogy: string | null;
    suggestedH5pType: string | null;
  }>;
  nextActions: Array<{
    action: string;
    pedagogyTag: string | null;
    h5pType: string | null;
    rationale: string;
  }>;
  evidenceCaveat: string;
  confidence: number | null;
  droppedInvalidReferences: string[];
  provider: string | null;
  model: string | null;
  cached: boolean;
  generatedFrom: { events: number; nodes: number; windowDays: number } | null;
}

export interface H5pInsightsResult {
  evidence: EvidencePack;
  insight: H5pInsight | null;
  ai: { available: boolean; unavailableReason: string | null };
}

function readEvidence(value: unknown): EvidencePack {
  const record = toRecord(value);
  const totals = toRecord(record.totals);

  const gaps: Record<string, { missing: string[]; covered: number; total: number }> = {};
  for (const [framework, block] of Object.entries(toRecord(record.coverage_gaps))) {
    const b = toRecord(block);
    gaps[framework] = {
      missing: toStringArray(b.missing),
      covered: readNumber(b.covered),
      total: readNumber(b.total),
    };
  }

  return {
    learnerId: readNullableNumber(record.learner_id),
    windowDays: readNumber(record.window_days),
    telemetryAvailable: readBoolean(record.telemetry_available),
    telemetryReason: readNullableString(record.telemetry_reason),
    hasEvidence: readBoolean(record.has_evidence),
    totals: {
      events: readNumber(totals.events),
      learners: readNumber(totals.learners),
      sessions: readNumber(totals.sessions),
      totalSeconds: readNumber(totals.total_seconds),
      lastEventAt: readNullableString(totals.last_event_at),
    },
    nodes: toArray(record.nodes).map((node) => {
      const n = toRecord(node);
      return {
        nodeKey: readString(n.node_key),
        title: readString(n.title),
        h5pType: readString(n.h5p_type),
        pedagogyTag: readNullableString(n.pedagogy_tag),
        bloomLevel: readNullableString(n.bloom_level),
        attempts: readNumber(n.attempts),
        correct: readNumber(n.correct),
        incorrect: readNumber(n.incorrect),
        accuracy: readNullableNumber(n.accuracy),
        completions: readNumber(n.completions),
        learners: readNumber(n.learners),
        avgSeconds: readNullableNumber(n.avg_seconds),
      };
    }),
    byPedagogy: toArray(record.by_pedagogy).map((row) => {
      const p = toRecord(row);
      return {
        pedagogyTag: readString(p.pedagogy_tag),
        label: readString(p.label),
        attempts: readNumber(p.attempts),
        learners: readNumber(p.learners),
        accuracy: readNullableNumber(p.accuracy),
        avgSeconds: readNullableNumber(p.avg_seconds),
      };
    }),
    attentionSignals: toArray(record.attention_signals).map((row) => {
      const s = toRecord(row);
      return {
        verb: readString(s.verb),
        label: readString(s.label),
        occurrences: readNumber(s.occurrences),
        learners: readNumber(s.learners),
      };
    }),
    struggles: toArray(record.struggles).map((row) => {
      const s = toRecord(row);
      return {
        nodeKey: readString(s.node_key),
        title: readString(s.title),
        h5pType: readString(s.h5p_type),
        pedagogyTag: readNullableString(s.pedagogy_tag),
        accuracy: readNumber(s.accuracy),
        attempts: readNumber(s.attempts),
        learners: readNumber(s.learners),
        avgSeconds: readNullableNumber(s.avg_seconds),
      };
    }),
    coverageGaps: gaps,
  };
}

function readInsight(value: unknown): H5pInsight | null {
  const record = toRecord(value);
  if (Object.keys(record).length === 0) return null;
  const generated = toRecord(record.generated_from);

  return {
    status: readString(record.status) || 'unavailable',
    reason: readNullableString(record.reason),
    headline: readString(record.headline),
    observations: toArray(record.observations).map((row) => {
      const o = toRecord(row);
      return { text: readString(o.text), nodeKeys: toStringArray(o.node_keys) };
    }),
    whatIsWorking: toArray(record.what_is_working).map((row) => {
      const w = toRecord(row);
      return { text: readString(w.text), pedagogyTag: readNullableString(w.pedagogy_tag) };
    }),
    struggles: toArray(record.struggles).map((row) => {
      const s = toRecord(row);
      return {
        nodeKey: readString(s.node_key),
        why: readString(s.why),
        suggestedPedagogy: readNullableString(s.suggested_pedagogy),
        suggestedH5pType: readNullableString(s.suggested_h5p_type),
      };
    }),
    nextActions: toArray(record.next_actions).map((row) => {
      const a = toRecord(row);
      return {
        action: readString(a.action),
        pedagogyTag: readNullableString(a.pedagogy_tag),
        h5pType: readNullableString(a.h5p_type),
        rationale: readString(a.rationale),
      };
    }),
    evidenceCaveat: readString(record.evidence_caveat),
    confidence: readNullableNumber(record.confidence),
    droppedInvalidReferences: toStringArray(record.dropped_invalid_references),
    provider: readNullableString(record.provider),
    model: readNullableString(record.model),
    cached: readBoolean(record.cached),
    generatedFrom:
      Object.keys(generated).length > 0
        ? {
            events: readNumber(generated.events),
            nodes: readNumber(generated.nodes),
            windowDays: readNumber(generated.window_days),
          }
        : null,
  };
}

/**
 * `evidenceOnly` skips the model entirely — used for the first paint, so the
 * measured figures are on screen immediately and the DeepSeek call (which
 * takes ~15s) is a second, explicit request.
 */
export async function fetchInsights(
  ctx: H5pContext,
  options: { learnerId?: number; windowDays?: number; evidenceOnly?: boolean } = {},
  signal?: AbortSignal
): Promise<H5pInsightsResult> {
  const query = contextQuery(ctx, {
    learner_id: options.learnerId,
    window_days: options.windowDays,
    evidence_only: options.evidenceOnly ? 1 : undefined,
  });
  const raw = toRecord(await callApi(`api/pal/h5p/insights${query}`, { signal }));
  const ai = toRecord(raw.ai);

  return {
    evidence: readEvidence(raw.evidence),
    insight: readInsight(raw.insight),
    ai: {
      available: readBoolean(ai.available),
      unavailableReason: readNullableString(ai.unavailable_reason),
    },
  };
}

// --- formatting helpers shared by the pages --------------------------------

/** Registry codes are snake_case; render them as words when no label exists. */
export function humanise(code: string): string {
  return code
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

/** A measured metric, or an explicit dash — never a fabricated zero. */
export function formatMetric(value: number | null, suffix = ''): string {
  return value === null ? '—' : `${value}${suffix}`;
}

export function formatPercent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)}%`;
}
