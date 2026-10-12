/**
 * Client for the alumni portal API (/api/alumni-portal/*). The portal is a separate sign-in from the staff ERP: its tokens are a
 * different kind of token, kept under their own storage key, and are NEVER sent anywhere except the alumni-portal endpoints.
 *
 * Every call goes through the same-origin /api/proxy relay. Calls that need no token send an empty `Authorization: Bearer`
 * header on purpose: the app-wide fetch wrapper adds the STAFF token to requests that carry no Authorization header, and a staff
 * token must never ride along on a portal request.
 */

const STORAGE_KEY = 'alumniPortalSession';
const INSTITUTE_KEY = 'alumniPortalInstitute';

export type PortalSession = { access: string; refresh: string; expiresAt: number };

export class PortalApiError extends Error {
  status: number;
  fieldErrors: Record<string, string[]>;
  constructor(message: string, status: number, fieldErrors: Record<string, string[]> = {}) {
    super(message);
    this.name = 'PortalApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

function readSession(): PortalSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PortalSession) : null;
  } catch {
    return null;
  }
}

function writeSession(session: PortalSession | null) {
  try {
    if (session) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode: the session simply will not persist */
  }
}

export const portalSession = {
  get: readSession,
  isSignedIn: () => readSession() !== null,
  clear: () => writeSession(null),
  rememberInstitute: (code: string) => { try { window.localStorage.setItem(INSTITUTE_KEY, code); } catch { /* ignore */ } },
  institute: (): string => { try { return window.localStorage.getItem(INSTITUTE_KEY) ?? ''; } catch { return ''; } },
};

type Envelope<T> = { status_code: number; message: string; data: T; errors?: Record<string, string[]> };

async function send<T>(method: 'GET' | 'POST', path: string, body: unknown, token: string | null, signal?: AbortSignal): Promise<{ status: number; json: Envelope<T> | null }> {
  const url = `/api/proxy?path=${encodeURIComponent(`api/alumni-portal/${path}`)}`;
  const response = await fetch(url, {
    method,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : 'Bearer' },
    body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
    cache: 'no-store',
    signal,
  });
  let json: Envelope<T> | null = null;
  try { json = (await response.json()) as Envelope<T>; } catch { json = null; }
  return { status: response.status, json };
}

function toError(status: number, json: Envelope<unknown> | null): PortalApiError {
  const message = json?.message || (status === 429 ? 'Too many attempts. Please wait a minute and try again.' : status === 503 ? 'The alumni portal is not available right now.' : "Something went wrong. Please try again.");
  return new PortalApiError(message, status, json?.errors ?? {});
}

let refreshing: Promise<boolean> | null = null;

/** Swap the refresh token for a new pair. One refresh at a time: the server treats a replayed refresh token as theft. */
async function refreshSession(): Promise<boolean> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const current = readSession();
    if (!current) return false;
    const { status, json } = await send<{ access_token: string; refresh_token: string; expires_in: number }>('POST', 'refresh', { refresh_token: current.refresh }, null);
    if (status !== 200 || !json?.data) { writeSession(null); return false; }
    writeSession({ access: json.data.access_token, refresh: json.data.refresh_token, expiresAt: Date.now() + json.data.expires_in * 1000 });
    return true;
  })().finally(() => { refreshing = null; });
  return refreshing;
}

async function publicCall<T>(path: string, body: unknown): Promise<{ data: T; message: string }> {
  const { status, json } = await send<T>('POST', path, body, null);
  if (status >= 400 || !json) throw toError(status, json);
  return { data: json.data, message: json.message };
}

async function authedCall<T>(method: 'GET' | 'POST', path: string, body?: unknown, signal?: AbortSignal): Promise<{ data: T; message: string }> {
  let session = readSession();
  if (!session) throw new PortalApiError('Please sign in.', 401);
  if (session.expiresAt - Date.now() < 15_000 && !(await refreshSession())) throw new PortalApiError('Your session has ended. Please sign in again.', 401);
  session = readSession();
  let result = await send<T>(method, path, body, session?.access ?? null, signal);
  if (result.status === 401 && (await refreshSession())) result = await send<T>(method, path, body, readSession()?.access ?? null, signal);
  if (result.status >= 400 || !result.json) {
    if (result.status === 401) writeSession(null);
    throw toError(result.status, result.json);
  }
  return { data: result.json.data, message: result.json.message };
}

export type PortalProfile = {
  alumni_code: string; first_name: string; middle_name: string | null; last_name: string | null; full_name: string; batch: string | null; passing_year: number | null; course: string | null;
  email: string; mobile: string | null; alt_mobile: string | null; current_address: string | null; permanent_address: string | null; city: string | null; state: string | null;
  country: string | null; pincode: string | null; linkedin_url: string | null; employment_status: string | null; current_company: string | null; current_job_title: string | null; profile_completion: number;
};
export type PortalMe = { profile: PortalProfile; standing: { status: string; features_enabled: boolean; message: string | null }; editable_fields: string[]; institute_code: string | null };
export type PortalPrivacy = { fields: { key: string; label: string; level: string; is_default: boolean }[]; levels: string[]; consents: Record<string, boolean> };
export type PortalEvent = {
  id: number; name: string; description: string | null; event_type: string; event_date: string; start_time: string | null; end_time: string | null; venue: string | null; mode: string;
  online_link: string | null; fee_amount: number; registration_deadline: string | null; my_registration: { status: string; participants: number; registration_no: string } | null;
};

export const portalApi = {
  register: (body: { institute_code: string; first_name: string; last_name: string; email: string; password: string; mobile?: string; batch?: string; passing_year?: number }) => publicCall<null>('register', body),
  login: async (body: { institute_code: string; email: string; password: string }) => {
    const r = await publicCall<{ access_token: string; refresh_token: string; expires_in: number }>('login', body);
    writeSession({ access: r.data.access_token, refresh: r.data.refresh_token, expiresAt: Date.now() + r.data.expires_in * 1000 });
    portalSession.rememberInstitute(body.institute_code);
  },
  verifyEmail: (token: string) => publicCall<null>('verify-email', { token }),
  resendVerification: (institute_code: string, email: string) => publicCall<null>('resend-verification', { institute_code, email }),
  forgotPassword: (institute_code: string, email: string) => publicCall<null>('forgot-password', { institute_code, email }),
  resetPassword: (token: string, password: string) => publicCall<null>('reset-password', { token, password }),
  inviteCheck: (token: string) => publicCall<{ institute_code: string | null; email_hint: string }>('invite/check', { token }),
  inviteAccept: (token: string, password: string) => publicCall<null>('invite/accept', { token, password }),

  me: (signal?: AbortSignal) => authedCall<PortalMe>('GET', 'me', undefined, signal).then((r) => r.data),
  updateMe: (fields: Record<string, string | null>) => authedCall<PortalMe>('POST', 'me/update', fields).then((r) => r.data),
  privacy: (signal?: AbortSignal) => authedCall<PortalPrivacy>('GET', 'me/privacy', undefined, signal).then((r) => r.data),
  savePrivacy: (fields: Record<string, string>, consents: Record<string, boolean>) => authedCall<PortalPrivacy>('POST', 'me/privacy', { fields, consents }),
  changePassword: (current_password: string, password: string) => authedCall<null>('POST', 'change-password', { current_password, password }),
  events: (signal?: AbortSignal) => authedCall<PortalEvent[]>('GET', 'events', undefined, signal).then((r) => r.data),
  registerForEvent: (id: number, participants: number) => authedCall<{ status: string; registration_no: string }>('POST', `events/${id}/register`, { participants }),
  cancelEvent: (id: number) => authedCall<null>('POST', `events/${id}/cancel`, {}),
  logout: async () => {
    try { await authedCall<null>('POST', 'logout', {}); } catch { /* the session is being dropped anyway */ }
    writeSession(null);
  },
};
