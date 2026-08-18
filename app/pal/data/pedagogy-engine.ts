import { API_BASE_URL } from '@/app/components/utils/api_url';

/**
 * Types and transport for the PAL Pedagogy Engine module.
 *
 * This file deliberately contains NO rule data. Every tier rule, engagement
 * signal, band and trigger mapping is stored in the backend
 * (pal_pedagogy_engine_sections / pal_pedagogy_engine_rules) and served by
 * GET /api/pal/pedagogy-engine. The frontend only fetches and renders.
 */

export type PedagogySectionType = 'rules' | 'signals' | 'triggers';

/** One piece of extracted evidence a rule resolved to, with its JSON path. */
export interface PedagogyEvidenceItem {
  label: string;
  detail: string | null;
  tags: string[];
  from: string;
  matched_on?: string | null;
}

/** The pedagogy the engine picked, and whether the concept's own data agrees. */
export interface PedagogyDecision {
  selected: string | null;
  selected_h5p: string[];
  rule_routes_to: string[];
  concept_offers: string[];
  concept_strategies: string[];
  agrees_with_concept: boolean;
}

/** What a rule actually serves for the selected concept. */
export interface PedagogyResolution {
  matched: boolean;
  count: number;
  items: PedagogyEvidenceItem[];
  sources: string[];
  pedagogy: PedagogyDecision;
  note: string | null;
}

/** The chapter + concept the engine was evaluated against. */
export interface PedagogyContext {
  semantic_id: number;
  chapter_id: number | null;
  extraction_id: number | null;
  chapter_title: string;
  chapter_summary: string | null;
  subject_name: string | null;
  standard: number | string | null;
  chapter_number: number | string | null;
  concept_index: number;
  concept_total: number;
  concept_name: string | null;
  concept_definition: string | null;
  concept_difficulty: string | null;
  concept_importance: string | null;
  extracted_by: string | null;
  extracted_at: string | null;
  source_table: string;
}

export interface PedagogyConceptOption {
  index: number;
  name: string;
  difficulty: string | null;
  importance: string | null;
}

export interface PedagogyEngagementObservation {
  has_data: boolean;
  sessions: number;
  average_engagement_score?: number | null;
  average_session_minutes?: number | null;
  average_interactions?: number | null;
  events_recorded?: number;
  source?: string;
  note: string | null;
}

export interface PedagogyRule {
  id: string;
  group: string | null;
  condition: string;
  action: string | null;
  pedagogy: string | null;
  pedagogy_tags: string[];
  h5p_type: string | null;
  scaffolding: string | null;
  trigger: string | null;
  reason: string | null;
  implementation_status: string | null;
  avoid: string[];
  do_not: string[];
  h5p_priority: string[];
  meta: Record<string, unknown>;
  /** What this rule serves for the selected concept; null when no concept resolved. */
  resolved: PedagogyResolution | null;
}

export interface PedagogySignal {
  id: string;
  key: string;
  name: string;
  description: string | null;
  weight: number | null;
  weight_percent: number | null;
}

export interface PedagogyBand {
  id: string;
  range: string;
  min: number | null;
  max: number | null;
  label: string;
  tone: string;
  action: string | null;
}

export interface PedagogyTrigger {
  id: string;
  trigger: string;
  outcome: string | null;
  pedagogy: string | null;
  pedagogy_tags: string[];
  h5p_type: string | null;
  duration: string | null;
  source_tier: string | null;
  /** Whether the selected concept actually carries data that fires this trigger. */
  fires_for_concept: boolean;
  evidence_count: number;
  evidence_source: string | null;
  evidence: Array<{ label: string; from: string | null }>;
}

export interface PedagogySection {
  id: string;
  name: string;
  subtitle: string | null;
  summary: string | null;
  type: PedagogySectionType;
  badges: string[];
  implementation_status: string | null;
  current_state: string | null;
  gap: string | null;
  /** How many of this section's rules found matching concept data. */
  resolved_count: number;
  /** Total extracted records this section's rules resolved to. */
  evidence_count: number;
  rules: PedagogyRule[];
  /** signals sections only */
  signals?: PedagogySignal[];
  interpretation?: PedagogyBand[];
  formula?: string | null;
  observed?: PedagogyEngagementObservation;
  /** triggers sections only */
  triggers?: PedagogyTrigger[];
}

export interface PedagogyEngineStats {
  sections: number;
  rules: number;
  implemented_sections: number;
  partial_sections: number;
}

/**
 * Header metadata is nullable because it is a database row
 * (pal_pedagogy_engine_modules), not a constant. The UI omits any field the
 * backend leaves empty instead of substituting its own wording.
 */
export interface PedagogyEngineModule {
  module: string | null;
  slug: string;
  title: string | null;
  description: string | null;
  source: string | null;
  version: string | null;
  /** The semantic_intelligence chapter + concept the rules were run against. */
  context: PedagogyContext | null;
  concepts: PedagogyConceptOption[];
  has_semantic_data: boolean;
  stats: PedagogyEngineStats;
  sections: PedagogySection[];
}

export interface PedagogyEngineResponse {
  module: PedagogyEngineModule | null;
  error: string;
  isReady: boolean;
}

interface BackendEnvelope {
  success?: boolean;
  message?: string;
  data?: PedagogyEngineModule;
}

const BACKEND_PATH = '/api/pal/pedagogy-engine';

function emptyResponse(error: string): PedagogyEngineResponse {
  return { module: null, error, isReady: false };
}

export interface PedagogyEngineSelection {
  /** chapter_id, extraction_id or semantic row id. Latest extraction when omitted. */
  chapterId?: string;
  /** Concept index or concept_name within the chapter. First concept when omitted. */
  concept?: string;
}

function selectionQuery(selection: PedagogyEngineSelection) {
  const query = new URLSearchParams();
  if (selection.chapterId) query.set('chapterId', selection.chapterId);
  if (selection.concept) query.set('concept', selection.concept);
  const encoded = query.toString();
  return encoded ? `?${encoded}` : '';
}

/**
 * Calls the Laravel Pedagogy Engine API and returns its payload untouched.
 * Any reshaping belongs in PedagogyEngineService on the backend, not here.
 */
export async function fetchPedagogyEngineModule(
  selection: PedagogyEngineSelection = {}
): Promise<PedagogyEngineResponse> {
  if (!API_BASE_URL) {
    return emptyResponse('The PAL backend URL is not configured.');
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${BACKEND_PATH}${selectionQuery(selection)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
  } catch (error) {
    return emptyResponse(
      error instanceof Error
        ? `Could not reach the Pedagogy Engine API: ${error.message}`
        : 'Could not reach the Pedagogy Engine API.'
    );
  }

  let raw: BackendEnvelope | null = null;
  try {
    raw = (await res.json()) as BackendEnvelope;
  } catch {
    return emptyResponse(`The Pedagogy Engine API returned a non-JSON response (status ${res.status}).`);
  }

  if (!res.ok || raw?.success === false || !raw?.data) {
    return emptyResponse(raw?.message || `The Pedagogy Engine API request failed with status ${res.status}.`);
  }

  const sections = Array.isArray(raw.data.sections) ? raw.data.sections : [];

  if (sections.length === 0) {
    return {
      module: { ...raw.data, sections },
      error: '',
      isReady: false,
    };
  }

  return { module: { ...raw.data, sections }, error: '', isReady: true };
}
