import { API_BASE_URL } from '@/app/components/utils/api_url';
import { getRequestContext, getSyear } from '@/app/course-master/page';

/**
 * H5P content module data layer.
 *
 * Mirrors the Laravel ERP endpoints under `/h5p/*` (routes/lms.php):
 *  - GET  /h5p/html_contents            hub (static cards)
 *  - CRUD /h5p/scenario_based           image hotspot scenarios
 *  - CRUD /h5p/h5p_interactive_video    interactive videos
 *  - GET  /h5p/h5p_mcq                  MCQ levels + quiz payload
 *  - CRUD /h5p/h5p_flashacard           flashcards (Laravel slug kept verbatim)
 *  - POST /get-h5p-ai-scenario          AI scenario generation
 *
 * All GET endpoints return JSON when `type=API` is sent. Writes are
 * web-middleware routes, so multipart updates must use POST + `_method`
 * spoofing exactly like the Blade forms do.
 */

// ---------------------------------------------------------------------------
// Context (chapter / subject / standard) threaded through every H5P page
// ---------------------------------------------------------------------------

export interface H5pContext {
  chapter_id: string;
  standard_id: string;
  subject_id: string;
  chapter_name?: string;
  subject_name?: string;
  standard_name?: string;
}

export function readH5pContext(searchParams: URLSearchParams): H5pContext {
  return {
    chapter_id: searchParams.get('chapter_id') ?? '',
    standard_id: searchParams.get('standard_id') ?? '',
    subject_id: searchParams.get('subject_id') ?? '',
    chapter_name: searchParams.get('chapter_name') ?? undefined,
    subject_name: searchParams.get('subject_name') ?? undefined,
    standard_name: searchParams.get('standard_name') ?? undefined,
  };
}

export function hasH5pContext(ctx: H5pContext): boolean {
  return Boolean(ctx.chapter_id && ctx.standard_id && ctx.subject_id);
}

/** Build the query string forwarded between H5P pages (ids + display names). */
export function h5pContextQuery(ctx: H5pContext, extra?: Record<string, string>): string {
  const params = new URLSearchParams();
  params.set('chapter_id', ctx.chapter_id);
  params.set('standard_id', ctx.standard_id);
  params.set('subject_id', ctx.subject_id);
  if (ctx.chapter_name) params.set('chapter_name', ctx.chapter_name);
  if (ctx.subject_name) params.set('subject_name', ctx.subject_name);
  if (ctx.standard_name) params.set('standard_name', ctx.standard_name);
  for (const [key, value] of Object.entries(extra ?? {})) {
    params.set(key, value);
  }
  return params.toString();
}

/**
 * Laravel gates edit/delete UI with
 * `in_array(session('user_profile_name'), ['student','Student','STUDENT'])`.
 */
export function isStudentProfile(): boolean {
  const profile = getRequestContext()?.user_profile_name ?? '';
  return profile.toLowerCase() === 'student';
}

/** Identity fields the Laravel MCQ certificate reads from the session. */
export function getUserIdentity(): { name: string; schoolName: string; schoolLogo: string } {
  if (typeof window === 'undefined') return { name: '', schoolName: '', schoolLogo: '' };
  try {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}') as Record<string, unknown>;
    const auth = JSON.parse(localStorage.getItem('auth') || '{}') as Record<string, unknown>;
    const name = String(userData.name ?? auth.name ?? '');
    const schoolName = String(userData.school_name ?? '');
    const logo = String(userData.school_logo ?? userData.logo ?? '');
    return { name, schoolName, schoolLogo: logo };
  } catch {
    return { name: '', schoolName: '', schoolLogo: '' };
  }
}

// ---------------------------------------------------------------------------
// Shared request plumbing
// ---------------------------------------------------------------------------

interface SessionParams {
  sub_institute_id: number;
  user_id: number;
  user_profile_name: string;
  syear: string;
}

function requireSession(): SessionParams {
  const ctx = getRequestContext();
  if (!ctx) {
    throw new Error('Your session has expired. Please log in again.');
  }
  return {
    sub_institute_id: ctx.sub_institute_id,
    user_id: ctx.user_id,
    user_profile_name: ctx.user_profile_name,
    syear: getSyear(),
  };
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (typeof window !== 'undefined') {
    try {
      const userData = JSON.parse(localStorage.getItem('userData') || '{}') as Record<string, unknown>;
      const token = userData.user_token ?? userData.token;
      if (token) headers.Authorization = `Bearer ${String(token)}`;
    } catch {
      // Ignore malformed localStorage; endpoints are session-exempt for type=API.
    }
  }
  return headers;
}

async function readApiJson(res: Response, fallback: string): Promise<Record<string, unknown>> {
  const text = await res.text();
  const trimmed = text.trim();

  if (!trimmed) return {};

  const contentType = res.headers.get('content-type') ?? '';
  const looksLikeJson =
    contentType.toLowerCase().includes('json') || trimmed.startsWith('{') || trimmed.startsWith('[');

  if (looksLikeJson) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return { data: parsed };
    } catch {
      // Fall through so HTML error pages become readable messages.
    }
  }

  // The scenario store action can return the bare string "Invalid file".
  if (trimmed.length < 200 && !trimmed.startsWith('<')) {
    throw new Error(`${fallback}: ${trimmed}`);
  }

  throw new Error(`${fallback} (HTTP ${res.status}): the server returned a non-JSON response.`);
}

function getApiErrorMessage(raw: Record<string, unknown>, fallback: string): string {
  const errors = raw.errors;
  if (errors && typeof errors === 'object') {
    for (const value of Object.values(errors as Record<string, unknown>)) {
      if (Array.isArray(value) && value.length > 0) return String(value[0]);
      if (typeof value === 'string' && value.trim()) return value;
    }
  }
  return (raw.message as string) || fallback;
}

/** Laravel responses in this module mix `{status: 1}`, `{status: true}` and `{status_code: 1}`. */
function isApiSuccess(raw: Record<string, unknown>): boolean {
  const status = raw.status ?? raw.status_code;
  return status === 1 || status === '1' || status === true;
}

function contextParams(ctx: H5pContext): Record<string, string> {
  return {
    chapter_id: ctx.chapter_id,
    standard_id: ctx.standard_id,
    subject_id: ctx.subject_id,
  };
}

function buildGetUrl(path: string, params: Record<string, string | number | undefined>): string {
  const url = new URL(`${API_BASE_URL}${path}`);
  url.searchParams.set('type', 'API');
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function buildFormData(fields: Record<string, string | number | undefined>): FormData {
  const fd = new FormData();
  fd.append('type', 'API');
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) fd.append(key, String(value));
  }
  return fd;
}

// ---------------------------------------------------------------------------
// Types (mirroring the Laravel migrations)
// ---------------------------------------------------------------------------

export interface H5pScenarioPoint {
  id: number;
  scenario_id: number;
  title: string;
  description: string | null;
  position_x: number;
  position_y: number;
}

export interface H5pScenario {
  id: number;
  standard_id: number | null;
  subject_id: number | null;
  chapter_id: number | null;
  title: string;
  description: string | null;
  file_path: string;
  sub_institute_id: number | null;
  created_by?: number | null;
  points?: H5pScenarioPoint[];
}

/** Payload shape the Laravel store/update actions expect in the `points` JSON string. */
export interface ScenarioPointInput {
  id: number | null;
  title: string;
  description: string;
  x: number;
  y: number;
}

export type VideoInteractionType = 'multiple_choice' | 'true_false' | 'text_input';

export interface H5pVideoInteraction {
  id: number;
  video_id: number;
  time: number | null;
  interaction_type: VideoInteractionType | string | null;
  question: string | null;
  /** JSON object keyed "1".."n", stored as a string. */
  options: string | null;
  correct_answer: string | null;
}

export interface H5pInteractiveVideo {
  id: number;
  title: string | null;
  video_path: string | null;
  standard_id: number | null;
  subject_id: number | null;
  chapter_id: number | null;
  syear: string | null;
  sub_institute_id: number;
  created_by?: number | null;
  interactions?: H5pVideoInteraction[];
  interactions_count?: number;
}

export interface VideoInteractionInput {
  /** Seconds (the Laravel form converts mm:ss / hh:mm:ss client-side). */
  time: number;
  interaction_type: VideoInteractionType;
  question: string;
  /** Multiple choice options in order; ignored for other types. */
  options: string[];
  /** MC: 1-based option index as string. TF: "1" (true) | "2" (false). Text: optional answer. */
  correct_answer: string;
}

export interface H5pFlashcard {
  id: number;
  standard_id: number | null;
  subject_id: number | null;
  chapter_id: number | null;
  content: string | null;
  question: string | null;
  correct_answer: string | null;
  hint: string | null;
  sub_institute_id: number | null;
}

export interface FlashcardInput {
  question: string;
  content: string;
  correct_answer: string;
  hint: string;
}

export interface McqLevel {
  id: number;
  name: string;
}

export interface McqQuestion {
  question_id: number;
  question_text: string;
}

export interface McqAnswer {
  id: number;
  question_id: number;
  answer: string;
  feedback: string | null;
  /** 1 marks the correct option. */
  correct_answer: number | string;
}

export interface McqIndexPayload {
  mcq_levels: McqLevel[];
  selectedLevel: string | null;
  question_arr: McqQuestion[];
  answer_arr: Record<string, McqAnswer[]>;
}

export interface AiScenarioPoint {
  title: string;
  description: string;
  /** Percentages 0-100; converted to pixels by the caller (as the Blade JS does). */
  x: number;
  y: number;
}

export interface AiScenarioResult {
  description: string;
  points: AiScenarioPoint[];
}

export interface MutationResult {
  status: boolean;
  message: string;
}

// ---------------------------------------------------------------------------
// Hub API
// ---------------------------------------------------------------------------

export interface H5pHubModule {
  id: number;
  title: string;
  description: string;
  /** Legacy icon class from the backend (fa/mdi) — mapped to lucide client-side. */
  icon: string;
  /** Laravel route name, e.g. "scenario_based.index". */
  route: string;
}

/** Laravel route names → Next.js routes for the H5P sub-modules. */
export const H5P_ROUTE_MAP: Record<string, string> = {
  'html_contents.index': '/h5p/html_contents',
  'scenario_based.index': '/h5p/scenario_based',
  'h5p_interactive_video.index': '/h5p/h5p_interactive_video',
  'h5p_mcq.index': '/h5p/h5p_mcq',
  'h5p_flashacard.index': '/h5p/h5p_flashacard',
};

export async function fetchHubModules(ctx: H5pContext): Promise<H5pHubModule[]> {
  const url = buildGetUrl('/h5p/html_contents', contextParams(ctx));
  const res = await fetch(url, { headers: authHeaders(), cache: 'no-store' });
  const raw = await readApiJson(res, 'Failed to load H5P modules');
  if (!res.ok) throw new Error(getApiErrorMessage(raw, 'Failed to load H5P modules'));
  return (raw.contentLists as H5pHubModule[]) ?? [];
}

// ---------------------------------------------------------------------------
// Scenario API
// ---------------------------------------------------------------------------

export async function fetchScenarios(ctx: H5pContext): Promise<H5pScenario[]> {
  const session = requireSession();
  const url = buildGetUrl('/h5p/scenario_based', {
    ...contextParams(ctx),
    sub_institute_id: session.sub_institute_id,
    user_profile_name: session.user_profile_name,
  });
  const res = await fetch(url, { headers: authHeaders(), cache: 'no-store' });
  const raw = await readApiJson(res, 'Failed to load scenarios');
  if (!res.ok) throw new Error(getApiErrorMessage(raw, 'Failed to load scenarios'));
  return (raw.scenarioLists as H5pScenario[]) ?? [];
}

/** Uses the resource `show` endpoint; the payload key is `scenario`. */
export async function fetchScenario(id: number | string, ctx: H5pContext): Promise<H5pScenario> {
  const url = buildGetUrl(`/h5p/scenario_based/${id}`, contextParams(ctx));
  const res = await fetch(url, { headers: authHeaders(), cache: 'no-store' });
  const raw = await readApiJson(res, 'Failed to load scenario');
  if (!res.ok || !raw.scenario) {
    throw new Error(getApiErrorMessage(raw, (raw.error as string) || 'Scenario not found'));
  }
  return raw.scenario as H5pScenario;
}

export interface ScenarioSavePayload {
  title: string;
  description: string;
  points: ScenarioPointInput[];
  image?: File | null;
}

export async function createScenario(ctx: H5pContext, payload: ScenarioSavePayload): Promise<MutationResult> {
  const session = requireSession();
  const fd = buildFormData({
    ...contextParams(ctx),
    sub_institute_id: session.sub_institute_id,
    user_id: session.user_id,
    title: payload.title,
    description: payload.description,
    points: JSON.stringify(payload.points),
  });
  if (payload.image) fd.append('image', payload.image);

  const res = await fetch(`${API_BASE_URL}/h5p/scenario_based`, {
    method: 'POST',
    headers: authHeaders(),
    body: fd,
  });
  const raw = await readApiJson(res, 'Failed to create scenario');
  if (!res.ok || !isApiSuccess(raw)) {
    throw new Error(getApiErrorMessage(raw, 'Failed to create scenario'));
  }
  return { status: true, message: (raw.message as string) || 'Scenario created successfully' };
}

/**
 * Backend quirk: `scenario_based.update` has no JSON response path — it always
 * redirects to the index route. A 2xx/redirected response is treated as success.
 */
export async function updateScenario(
  id: number | string,
  ctx: H5pContext,
  payload: ScenarioSavePayload
): Promise<MutationResult> {
  const session = requireSession();
  const fd = buildFormData({
    _method: 'PUT',
    ...contextParams(ctx),
    sub_institute_id: session.sub_institute_id,
    user_id: session.user_id,
    title: payload.title,
    description: payload.description,
    points: JSON.stringify(payload.points),
  });
  if (payload.image) fd.append('image', payload.image);

  const res = await fetch(`${API_BASE_URL}/h5p/scenario_based/${id}`, {
    method: 'POST',
    headers: authHeaders(),
    body: fd,
  });
  if (!res.ok && !res.redirected) {
    throw new Error(`Failed to update scenario (HTTP ${res.status}).`);
  }
  return { status: true, message: 'Scenario updated successfully!' };
}

export async function deleteScenario(id: number | string, ctx: H5pContext): Promise<MutationResult> {
  const session = requireSession();
  const fd = buildFormData({
    _method: 'DELETE',
    ...contextParams(ctx),
    user_id: session.user_id,
  });
  const res = await fetch(`${API_BASE_URL}/h5p/scenario_based/${id}`, {
    method: 'POST',
    headers: authHeaders(),
    body: fd,
  });
  const raw = await readApiJson(res, 'Failed to delete scenario');
  if (!res.ok || !isApiSuccess(raw)) {
    throw new Error(getApiErrorMessage(raw, 'Failed to delete scenario'));
  }
  return { status: true, message: (raw.message as string) || 'Scenario deleted successfully!' };
}

export interface AiScenarioRequest {
  prompt: string;
  /** Base64 data URL of the uploaded image (forwarded like the Blade form does). */
  image: string;
  title: string;
  standard: string;
  chapter: string;
  subject: string;
}

// ---------------------------------------------------------------------------
// xAPI telemetry — feeds PAL's real BKT mastery / misconception pipeline
// ---------------------------------------------------------------------------

/**
 * The H5P xAPI ingest pipeline (App\Services\PAL\H5P\H5PXapiPipeline, POST
 * /api/pal/h5p/xapi) is real, working backend infrastructure that genuinely
 * updates BKT mastery and runs misconception detection on the 'answered'
 * verb (config/pal_h5p.php `xapi_verbs.answered.jobs`) -- but until now no
 * H5P player in this frontend ever called it, so it received zero traffic.
 * This is the wiring, not a new pipeline.
 *
 * Best-effort: never throws, never blocks the player. A telemetry failure
 * must not be able to break a student's practice session.
 */
export type H5pXapiVerb = 'answered' | 'completed' | 'attempted' | 'progressed';

export interface H5pXapiStatementInput {
  /** "<h5p_type>:<content_id>", e.g. "flash_cards:123" -- see config/pal_h5p.php h5p_types. */
  objectId: string;
  verb: H5pXapiVerb;
  ctx: H5pContext;
  success?: boolean;
  response?: string;
  durationSeconds?: number;
}

const XAPI_VERB_IRI: Record<H5pXapiVerb, string> = {
  answered: 'http://adlnet.gov/expapi/verbs/answered',
  completed: 'http://adlnet.gov/expapi/verbs/completed',
  attempted: 'http://adlnet.gov/expapi/verbs/attempted',
  progressed: 'http://adlnet.gov/expapi/verbs/progressed',
};

export async function postH5pXapiStatement(input: H5pXapiStatementInput): Promise<void> {
  let session: SessionParams;
  try {
    session = requireSession();
  } catch {
    return;
  }

  const statement: Record<string, unknown> = {
    verb: { id: XAPI_VERB_IRI[input.verb] },
    object: { id: input.objectId },
    timestamp: new Date().toISOString(),
    context: {
      extensions: {
        chapter_id: input.ctx.chapter_id || undefined,
        subject_id: input.ctx.subject_id || undefined,
        standard_id: input.ctx.standard_id || undefined,
      },
    },
  };

  if (input.success !== undefined || input.response !== undefined || input.durationSeconds !== undefined) {
    statement.result = {
      ...(input.success !== undefined ? { success: input.success } : {}),
      ...(input.response !== undefined ? { response: input.response } : {}),
      ...(input.durationSeconds !== undefined
        ? { duration: `PT${Math.max(0, Math.round(input.durationSeconds))}S` }
        : {}),
    };
  }

  try {
    await fetch(`${API_BASE_URL}/api/pal/h5p/xapi`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        learner_id: session.user_id,
        statement,
      }),
    });
  } catch {
    // Best-effort telemetry -- a network failure here must never surface to
    // the student or interrupt the activity they're doing.
  }
}

export async function generateScenarioAI(request: AiScenarioRequest): Promise<AiScenarioResult> {
  const res = await fetch(`${API_BASE_URL}/get-h5p-ai-scenario`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  const raw = await readApiJson(res, 'AI generation failed');
  if (!res.ok || Number(raw.status_code) !== 1) {
    throw new Error(getApiErrorMessage(raw, 'AI generation failed'));
  }
  return {
    description: String(raw.description ?? ''),
    points: (raw.points as AiScenarioPoint[]) ?? [],
  };
}

// ---------------------------------------------------------------------------
// Interactive video API
// ---------------------------------------------------------------------------

export async function fetchVideos(ctx: H5pContext): Promise<H5pInteractiveVideo[]> {
  const session = requireSession();
  const url = buildGetUrl('/h5p/h5p_interactive_video', {
    ...contextParams(ctx),
    sub_institute_id: session.sub_institute_id,
  });
  const res = await fetch(url, { headers: authHeaders(), cache: 'no-store' });
  const raw = await readApiJson(res, 'Failed to load videos');
  if (!res.ok) throw new Error(getApiErrorMessage(raw, 'Failed to load videos'));
  return (raw.videolists as H5pInteractiveVideo[]) ?? [];
}

/** `show` returns the video under `videos`; `edit` under `video` — both include interactions. */
export async function fetchVideo(id: number | string, ctx: H5pContext): Promise<H5pInteractiveVideo> {
  const url = buildGetUrl(`/h5p/h5p_interactive_video/${id}`, contextParams(ctx));
  const res = await fetch(url, { headers: authHeaders(), cache: 'no-store' });
  const raw = await readApiJson(res, 'Failed to load video');
  const video = (raw.videos ?? raw.video) as H5pInteractiveVideo | undefined;
  if (!res.ok || !video) {
    throw new Error(getApiErrorMessage(raw, 'Interactive video not found'));
  }
  return video;
}

export interface VideoSavePayload {
  title: string;
  interactions: VideoInteractionInput[];
  /** New upload (required on create, optional on update). */
  videoFile?: File | null;
  /** Existing URL — required by the update validation (`video_path => required|string`). */
  existingVideoPath?: string;
}

function appendInteractions(fd: FormData, interactions: VideoInteractionInput[]): void {
  interactions.forEach((interaction, i) => {
    fd.append(`interactions[${i}][time]`, String(interaction.time));
    fd.append(`interactions[${i}][interaction_type]`, interaction.interaction_type);
    fd.append(`interactions[${i}][question]`, interaction.question);
    if (interaction.interaction_type === 'multiple_choice') {
      for (const option of interaction.options) {
        fd.append(`interactions[${i}][options][]`, option);
      }
    }
    if (interaction.correct_answer !== '') {
      fd.append(`interactions[${i}][correct_answer]`, interaction.correct_answer);
    }
  });
}

export async function createVideo(ctx: H5pContext, payload: VideoSavePayload): Promise<MutationResult> {
  const session = requireSession();
  const fd = buildFormData({
    ...contextParams(ctx),
    sub_institute_id: session.sub_institute_id,
    user_id: session.user_id,
    syear: session.syear,
    title: payload.title,
  });
  if (payload.videoFile) fd.append('video_path', payload.videoFile);
  appendInteractions(fd, payload.interactions);

  const res = await fetch(`${API_BASE_URL}/h5p/h5p_interactive_video`, {
    method: 'POST',
    headers: authHeaders(),
    body: fd,
  });
  const raw = await readApiJson(res, 'Failed to create video');
  if (!res.ok || !isApiSuccess(raw)) {
    throw new Error(getApiErrorMessage(raw, 'Failed to create video'));
  }
  return { status: true, message: (raw.message as string) || 'Video created successfully' };
}

export async function updateVideo(
  id: number | string,
  ctx: H5pContext,
  payload: VideoSavePayload
): Promise<MutationResult> {
  const session = requireSession();
  const fd = buildFormData({
    _method: 'PUT',
    ...contextParams(ctx),
    sub_institute_id: session.sub_institute_id,
    user_id: session.user_id,
    syear: session.syear,
    title: payload.title,
    // Validation requires video_path as a string; a replacement file may
    // additionally be sent under the same name (PHP reads them separately).
    video_path: payload.existingVideoPath ?? '',
  });
  if (payload.videoFile) fd.append('video_path', payload.videoFile);
  appendInteractions(fd, payload.interactions);

  const res = await fetch(`${API_BASE_URL}/h5p/h5p_interactive_video/${id}`, {
    method: 'POST',
    headers: authHeaders(),
    body: fd,
  });
  const raw = await readApiJson(res, 'Failed to update video');
  if (!res.ok || !isApiSuccess(raw)) {
    throw new Error(getApiErrorMessage(raw, 'Failed to update video'));
  }
  return { status: true, message: (raw.message as string) || 'Video updated successfully' };
}

export async function deleteVideo(id: number | string, ctx: H5pContext): Promise<MutationResult> {
  const session = requireSession();
  const fd = buildFormData({
    _method: 'DELETE',
    ...contextParams(ctx),
    sub_institute_id: session.sub_institute_id,
    user_id: session.user_id,
    syear: session.syear,
  });
  const res = await fetch(`${API_BASE_URL}/h5p/h5p_interactive_video/${id}`, {
    method: 'POST',
    headers: authHeaders(),
    body: fd,
  });
  const raw = await readApiJson(res, 'Failed to delete video');
  if (!res.ok || !isApiSuccess(raw)) {
    throw new Error(getApiErrorMessage(raw, 'Failed to delete video'));
  }
  return { status: true, message: (raw.message as string) || 'Video deleted successfully' };
}

/** Convert "30", "11:50" or "1:30:00" into seconds, as the Blade form does. */
export function parseTimeToSeconds(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  const parts = trimmed.split(':').map((part) => part.trim());
  if (parts.some((part) => part === '' || !/^\d+$/.test(part))) return null;
  if (parts.length === 2) return Number(parts[0]) * 60 + Number(parts[1]);
  if (parts.length === 3) return Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2]);
  return null;
}

export function formatSeconds(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Parse the stored interaction `options` JSON ("1".."n" keyed object). */
export function parseInteractionOptions(interaction: H5pVideoInteraction): Array<{ key: string; label: string }> {
  if (interaction.interaction_type === 'true_false') {
    const fallback = [
      { key: '1', label: 'True' },
      { key: '2', label: 'False' },
    ];
    if (!interaction.options) return fallback;
    try {
      const parsed = JSON.parse(interaction.options) as Record<string, string>;
      const entries = Object.entries(parsed);
      return entries.length > 0 ? entries.map(([key, label]) => ({ key, label: String(label) })) : fallback;
    } catch {
      return fallback;
    }
  }
  if (!interaction.options) return [];
  try {
    const parsed = JSON.parse(interaction.options) as Record<string, string>;
    return Object.entries(parsed).map(([key, label]) => ({ key, label: String(label) }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// MCQ API
// ---------------------------------------------------------------------------

export async function fetchMcqIndex(ctx: H5pContext, selectedLevel?: string): Promise<McqIndexPayload> {
  const session = requireSession();
  const url = buildGetUrl('/h5p/h5p_mcq', {
    ...contextParams(ctx),
    sub_institute_id: session.sub_institute_id,
    selectedLevel,
  });
  const res = await fetch(url, { headers: authHeaders(), cache: 'no-store' });
  const raw = await readApiJson(res, 'Failed to load MCQ data');
  if (!res.ok) throw new Error(getApiErrorMessage(raw, 'Failed to load MCQ data'));
  return {
    mcq_levels: (raw.mcq_levels as McqLevel[]) ?? [],
    selectedLevel: (raw.selectedLevel as string | null) ?? null,
    question_arr: (raw.question_arr as McqQuestion[]) ?? [],
    answer_arr: (raw.answer_arr as Record<string, McqAnswer[]>) ?? {},
  };
}

// ---------------------------------------------------------------------------
// Flashcard API
// ---------------------------------------------------------------------------

export async function fetchFlashcards(ctx: H5pContext): Promise<H5pFlashcard[]> {
  const session = requireSession();
  const url = buildGetUrl('/h5p/h5p_flashacard', {
    ...contextParams(ctx),
    sub_institute_id: session.sub_institute_id,
  });
  const res = await fetch(url, { headers: authHeaders(), cache: 'no-store' });
  const raw = await readApiJson(res, 'Failed to load flashcards');
  if (!res.ok) throw new Error(getApiErrorMessage(raw, 'Failed to load flashcards'));
  return (raw.flashCards as H5pFlashcard[]) ?? [];
}

/** The edit endpoint validates a request `id` field in addition to the route param. */
export async function fetchFlashcard(id: number | string, ctx: H5pContext): Promise<H5pFlashcard> {
  const session = requireSession();
  const url = buildGetUrl(`/h5p/h5p_flashacard/${id}/edit`, {
    ...contextParams(ctx),
    id,
    sub_institute_id: session.sub_institute_id,
  });
  const res = await fetch(url, { headers: authHeaders(), cache: 'no-store' });
  const raw = await readApiJson(res, 'Failed to load flashcard');
  if (!res.ok || !raw.card) {
    throw new Error(getApiErrorMessage(raw, 'Flashcard not found'));
  }
  return raw.card as H5pFlashcard;
}

export async function createFlashcards(ctx: H5pContext, cards: FlashcardInput[]): Promise<MutationResult> {
  const session = requireSession();
  const fd = buildFormData({
    ...contextParams(ctx),
    sub_institute_id: session.sub_institute_id,
    user_id: session.user_id,
  });
  cards.forEach((card, i) => {
    fd.append(`cards[${i}][question]`, card.question);
    fd.append(`cards[${i}][content]`, card.content);
    fd.append(`cards[${i}][correct_answer]`, card.correct_answer);
    fd.append(`cards[${i}][hint]`, card.hint);
  });

  const res = await fetch(`${API_BASE_URL}/h5p/h5p_flashacard`, {
    method: 'POST',
    headers: authHeaders(),
    body: fd,
  });
  const raw = await readApiJson(res, 'Failed to create flashcards');
  if (!res.ok || !isApiSuccess(raw)) {
    throw new Error(getApiErrorMessage(raw, 'Failed to create flashcards'));
  }
  return { status: true, message: (raw.message as string) || 'Flashcards created successfully!' };
}

export async function updateFlashcard(
  id: number | string,
  ctx: H5pContext,
  card: FlashcardInput
): Promise<MutationResult> {
  const session = requireSession();
  const fd = buildFormData({
    _method: 'PUT',
    ...contextParams(ctx),
    id,
    sub_institute_id: session.sub_institute_id,
    user_id: session.user_id,
  });
  fd.append('cards[0][question]', card.question);
  fd.append('cards[0][content]', card.content);
  fd.append('cards[0][correct_answer]', card.correct_answer);
  fd.append('cards[0][hint]', card.hint);

  const res = await fetch(`${API_BASE_URL}/h5p/h5p_flashacard/${id}`, {
    method: 'POST',
    headers: authHeaders(),
    body: fd,
  });
  const raw = await readApiJson(res, 'Failed to update flashcard');
  if (!res.ok || !isApiSuccess(raw)) {
    throw new Error(getApiErrorMessage(raw, 'Failed to update flashcard'));
  }
  return { status: true, message: (raw.message as string) || 'Flashcard updated successfully!' };
}

export async function deleteFlashcard(id: number | string, ctx: H5pContext): Promise<MutationResult> {
  const session = requireSession();
  const fd = buildFormData({
    _method: 'DELETE',
    ...contextParams(ctx),
    id,
    sub_institute_id: session.sub_institute_id,
    user_id: session.user_id,
  });
  const res = await fetch(`${API_BASE_URL}/h5p/h5p_flashacard/${id}`, {
    method: 'POST',
    headers: authHeaders(),
    body: fd,
  });
  const raw = await readApiJson(res, 'Failed to delete flashcard');
  if (!res.ok || !isApiSuccess(raw)) {
    throw new Error(getApiErrorMessage(raw, 'Failed to delete flashcard'));
  }
  // The Laravel destroy response message says "updated"; show the intended copy.
  return { status: true, message: 'Flashcard deleted successfully!' };
}
