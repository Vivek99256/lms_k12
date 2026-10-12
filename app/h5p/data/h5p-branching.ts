import { API_BASE_URL } from '@/app/components/utils/api_url';
import {
  authHeaders,
  buildGetUrl,
  contextParams,
  getApiErrorMessage,
  readApiJson,
  requireSession,
  type H5pContext,
} from './h5p';
import { contentTypeApi, type H5pContentRow } from './h5p-content-types';
import type { BsNodeType, BsQuality, BsScoring } from '@/lib/h5p/branching-scenario';
import type { BranchingGenerationInfo, BranchingScenarioSavePayload } from '@/lib/h5p/branching-editor';

/**
 * Branching Scenario: rows, the save payload, and the two calls that are not
 * part of the shared content-type API (what a chapter offers to build from, and
 * generation).
 *
 * THE SAME API AS EVERY OTHER TYPE. List, get, create, update, delete, publish,
 * duplicate, media, export and import all come from `contentTypeApi()`; this
 * file supplies the names and the shapes. The graph rules and the player's
 * state machine are in `lib/h5p/branching-scenario.ts`, which has no imports.
 *
 * GENERATION IS NOT SAVING. `generateBranchingScenario()` returns a draft in
 * exactly the shape `create()` takes, and writes nothing. A teacher looks at it
 * in the player, and saving it is the ordinary `create()`, which makes a draft;
 * publishing is the ordinary `publish()`, which runs the server's graph check.
 */

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

export interface H5pBranchingChoiceRow {
  text: string;
  next_node_id: number | null;
  quality: BsQuality | null;
  feedback_title: string;
  feedback_text: string;
  feedback_image: string;
  feedback_image_alt: string;
}

export interface H5pBranchingNodeRow {
  id: number;
  scenario_id: number;
  node_index: number;
  node_type: BsNodeType;
  purpose: string | null;
  title: string | null;
  show_title: boolean;
  body: string | null;
  media_path: string | null;
  media_alt: string | null;
  proceed_button_text: string | null;
  next_node_id: number | null;
  options: H5pBranchingChoiceRow[] | null;
  score: number;
  concept_id: number | null;
  source_question_id: number | null;
}

export interface H5pBranchingScenario extends H5pContentRow {
  start_title: string | null;
  start_subtitle: string | null;
  start_image: string | null;
  start_image_alt: string | null;
  learning_objectives: string[] | null;
  scoring_option: BsScoring;
  pass_percentage: number;
  enable_backwards_navigation: boolean;
  randomize_alternatives: boolean;
  generation: BranchingGenerationInfo | null;
  nodes?: H5pBranchingNodeRow[];
}

// ---------------------------------------------------------------------------
// Save payload
// ---------------------------------------------------------------------------

// The payload types, the blanks and every operation on editor state live in
// lib/h5p/branching-editor.ts, which has no imports and is tested without a
// browser. They are re-exported here so a page imports one thing.
export {
  BRANCHING_SCENARIO_DEFAULTS,
  blankChoice,
  blankNode,
  newNodeRef,
  type BranchingChoiceInput,
  type BranchingGenerationInfo,
  type BranchingNodeInput,
  type BranchingScenarioSavePayload,
} from '@/lib/h5p/branching-editor';

export const branchingScenarioApi = contentTypeApi<
  H5pBranchingScenario,
  BranchingScenarioSavePayload & Record<string, unknown>
>({
  path: 'h5p_branching_scenario',
  listKey: 'branchingScenarioLists',
  itemKey: 'branchingScenario',
  noun: 'branching scenario',
  hasMedia: true,
});

// ---------------------------------------------------------------------------
// What a chapter offers to build a scenario from
// ---------------------------------------------------------------------------

export interface BranchingSourceConcept {
  id: number;
  name: string;
  topic_id: number | null;
  /** Bank questions that could be reused as a knowledge check. */
  questions: number;
  /** Enough recorded knowledge or objectives to build a consequence from. */
  has_material: boolean;
  /** 0 to 10: how well it suits a decision-based lesson. */
  suitability: number;
}

export interface BranchingSourceTopic {
  id: number;
  name: string;
  concept_ids: number[];
}

export interface BranchingSources {
  chapter: { id: number; name: string; standard: string; subject: string; has_text: boolean };
  topics: BranchingSourceTopic[];
  concepts: BranchingSourceConcept[];
  limits: { max_concepts: number };
}

export interface BranchingSourcesResult {
  sources: BranchingSources;
  generation: { enabled: boolean; reason: string | null };
}

export async function fetchBranchingSources(ctx: H5pContext, signal?: AbortSignal): Promise<BranchingSourcesResult> {
  const session = requireSession();
  const url = buildGetUrl('/h5p/h5p_branching_scenario/sources', {
    ...contextParams(ctx),
    sub_institute_id: session.sub_institute_id,
    user_profile_name: session.user_profile_name,
  });
  const res = await fetch(url, { headers: authHeaders(), cache: 'no-store', signal });
  const raw = await readApiJson(res, 'Couldn’t load the chapter’s topics and concepts');
  if (!res.ok || !raw.sources) {
    throw new Error(getApiErrorMessage(raw, 'Couldn’t load the chapter’s topics and concepts'));
  }

  return {
    sources: raw.sources as BranchingSources,
    generation: (raw.generation as BranchingSourcesResult['generation']) ?? { enabled: false, reason: null },
  };
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

export type BranchingLength = 'short' | 'standard' | 'extended';

export interface BranchingGenerateRequest {
  topic_ids: number[];
  concept_ids: number[];
  focus: string;
  length: BranchingLength;
  use_questions: boolean;
}

export interface BranchingReport {
  ok: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    nodes: number;
    screens: number;
    decisions: number;
    endings: number;
    paths: number;
    paths_capped: boolean;
    longest_path: number;
    shortest_path: number;
    endings_reached: number;
    concepts: number;
    concepts_covered: number;
    bank_questions: number;
    teaching_words: number;
    minutes: number;
  };
  concepts: { id: number; name: string }[];
  suggestions: { node: string; title: string; idea: string }[];
}

export type BranchingGenerateResult =
  | { ok: true; scenario: BranchingScenarioSavePayload; report: BranchingReport; message: string }
  | { ok: false; message: string; errors: string[]; warnings: string[] };

/**
 * Ask the server to write a scenario for this chapter. Stores nothing.
 *
 * Takes minutes, not seconds (two model stages with several calls each), so it
 * accepts an AbortSignal and the caller can cancel. A refusal the server
 * explains -- no API key, a chapter without text, a draft that failed its
 * checks -- comes back as `{ok: false}` with the reasons, not as a thrown
 * error, because the reasons are what the teacher needs to read.
 */
export async function generateBranchingScenario(
  ctx: H5pContext,
  request: BranchingGenerateRequest,
  signal?: AbortSignal
): Promise<BranchingGenerateResult> {
  const session = requireSession();
  const res = await fetch(`${API_BASE_URL}/h5p/h5p_branching_scenario/generate`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'API',
      ...contextParams(ctx),
      sub_institute_id: session.sub_institute_id,
      user_id: session.user_id,
      user_profile_name: session.user_profile_name,
      ...request,
    }),
    signal,
  });
  const raw = await readApiJson(res, 'Couldn’t generate a scenario');

  if (res.ok && raw.scenario && raw.report) {
    return {
      ok: true,
      scenario: raw.scenario as BranchingScenarioSavePayload,
      report: raw.report as BranchingReport,
      message: String(raw.message ?? ''),
    };
  }

  const report = (raw.report as Partial<BranchingReport> | undefined) ?? {};
  return {
    ok: false,
    // The server's own sentence first. `getApiErrorMessage` reads an `errors` list
    // as Laravel's field errors and would hand back the first finding as the
    // headline, which would then appear again in the list beneath it.
    message: typeof raw.message === 'string' && raw.message.trim() !== '' ? raw.message : getApiErrorMessage(raw, 'Couldn’t generate a scenario'),
    errors: ((raw.errors as string[] | undefined) ?? report.errors ?? []).map(String),
    warnings: ((raw.warnings as string[] | undefined) ?? report.warnings ?? []).map(String),
  };
}
