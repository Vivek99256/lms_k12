/**
 * Which project a conversational-AI request belongs to.
 *
 * ONE SHARED ENDPOINT, SEVERAL PROJECTS. The `/api/ai/*` routes in this app serve
 * more than the LMS: sibling products (G2G, Enterprise Brain) call the same
 * surface and expect their own routes, tools and prompts. Every request therefore
 * names its project, and everything downstream — discovery, suggestions, channel
 * settings, service credentials — is looked up by that id. This module is the one
 * place that list is kept.
 *
 * HOW A REQUEST NAMES ITS PROJECT. The `x-project-id` header wins. Without it the
 * process-wide default applies (`AI_PROJECT_ID`, else `lms_k12`), which is what
 * the LMS's own browser calls rely on — they never set the header. An id that is
 * not registered is an error, never a silent fallback: a G2G caller that
 * mistyped its id must not be answered with LMS data.
 *
 * WHAT "REGISTERED" MEANS. A registration is a descriptor: id, label, whether the
 * adapter is hosted here or calls in from outside, and whether its adapter code
 * exists on this branch. The `docs/universal-conversational-ai-platform.md`
 * integration guide (§18) has a new project create `lib/ai/adapters/<id>/adapter.ts`
 * and register it here; until that file lands the project is still listed, with
 * `implemented: false`, so the admin screen shows what is wired and what is only
 * declared. Nothing is hidden and nothing is invented.
 *
 * The registry lives on `globalThis` so Next's dev-mode module reloads keep one
 * list rather than re-registering into a fresh one on every edit.
 */

export type ProjectKind = 'host' | 'external';

export interface ProjectAdapter {
  /** Stable id, lowercase snake_case. This is what travels in `x-project-id`. */
  projectId: string;
  label: string;
  description: string;
  /**
   * host = this app owns the adapter and the user's own bearer token carries scope.
   * external = another service calls in and must present a service token.
   */
  kind: ProjectKind;
  /** True once `lib/ai/adapters/<id>/adapter.ts` exists and is wired to discovery. */
  implemented: boolean;
}

export const PROJECT_ID_HEADER = 'x-project-id';
export const DEFAULT_PROJECT_ID = 'lms_k12';

const PROJECT_ID_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;

function registry(): Map<string, ProjectAdapter> {
  const holder = globalThis as typeof globalThis & { __projectAdapters?: Map<string, ProjectAdapter> };
  if (!holder.__projectAdapters) holder.__projectAdapters = new Map();
  return holder.__projectAdapters;
}

export function normaliseProjectId(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

export function isValidProjectId(value: string): boolean {
  return PROJECT_ID_PATTERN.test(value);
}

/** Add or replace registrations. Re-registering the same id replaces its descriptor. */
export function registerProjectAdapters(adapters: ProjectAdapter[]): void {
  const map = registry();
  for (const adapter of adapters) {
    const projectId = normaliseProjectId(adapter.projectId);
    if (!isValidProjectId(projectId)) {
      throw new Error(`"${adapter.projectId}" is not a valid project id (lowercase letters, digits and underscores).`);
    }
    map.set(projectId, { ...adapter, projectId });
  }
}

/** Every registered project, host first, then alphabetical. */
export function listProjectAdapters(): ProjectAdapter[] {
  return [...registry().values()].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'host' ? -1 : 1;
    return a.projectId.localeCompare(b.projectId);
  });
}

export function getProjectAdapter(projectId: string): ProjectAdapter | null {
  return registry().get(normaliseProjectId(projectId)) ?? null;
}

export class UnknownProjectError extends Error {
  readonly projectId: string;

  constructor(projectId: string) {
    super(`"${projectId || '(none)'}" is not a registered project.`);
    this.name = 'UnknownProjectError';
    this.projectId = projectId;
  }
}

export function defaultProjectId(): string {
  return normaliseProjectId(process.env.AI_PROJECT_ID) || DEFAULT_PROJECT_ID;
}

/** The project id a request asks for, or the process default when it asks for none. */
export function projectIdFromRequest(request: Pick<Request, 'headers'>): string {
  return normaliseProjectId(request.headers.get(PROJECT_ID_HEADER)) || defaultProjectId();
}

/**
 * Resolve the adapter for a request (or for an explicit id).
 * Throws `UnknownProjectError` rather than falling back — see the module note.
 */
export function resolveProjectAdapter(source?: Pick<Request, 'headers'> | string): ProjectAdapter {
  const projectId =
    typeof source === 'string' ? normaliseProjectId(source) || defaultProjectId()
    : source ? projectIdFromRequest(source)
    : defaultProjectId();
  const adapter = getProjectAdapter(projectId);
  if (!adapter) throw new UnknownProjectError(projectId);
  return adapter;
}

// ---------------------------------------------------------------------------
// Registrations.
//
// lms_k12 is the host: its transport is app/api/ai/ask/stream/route.ts and its
// scope rides on the signed-in user's bearer token. The other two are sibling
// products that call this shared endpoint; they are declared so the admin screen
// can hold their channel settings and service tokens, and are marked
// unimplemented until their adapter modules exist on this branch.
// ---------------------------------------------------------------------------

registerProjectAdapters([
  {
    projectId: 'lms_k12',
    label: 'LMS K-12',
    description: 'This school ERP. Hosted here; the assistant panel and the ask/stream proxy belong to it.',
    kind: 'host',
    implemented: true,
  },
  {
    projectId: 'g2g',
    label: 'G2G',
    description: 'Good-to-great learning and growth workflows. Calls the shared endpoint with a service token.',
    kind: 'external',
    implemented: false,
  },
  {
    projectId: 'enterprise_brain',
    label: 'Enterprise Brain',
    description: 'Institution intelligence and automation. Calls the shared endpoint with a service token.',
    kind: 'external',
    implemented: false,
  },
]);
