'use client';

/**
 * The signed-in session, for callers of the central AI API.
 *
 * WHY THIS EXISTS
 *
 * Every AI client in this app was reading the same two localStorage keys and
 * picking the token out of the same four possible fields — `lib/brain/api.ts`,
 * `lib/agents/client.ts`, `lib/result/api.ts`, `hooks/use-ai-workspace.ts` and, until
 * this file, the capability console. Five copies of one rule about where the session
 * lives is five places to fix when it moves.
 *
 * New AI callers use this. The four older copies are deliberately left alone — they
 * each carry their own base-URL handling and changing them is a separate, riskier
 * edit than this one is worth.
 *
 * NOTHING HERE HAS A DEFAULT
 *
 * There is no fallback institute id, and there must never be one. The backend derives
 * the tenant from the bearer token anyway; a default here would only ever be wrong,
 * and wrong in the direction of showing one school another school's data.
 */

export interface AiSession {
  /** Bearer token for `/api/ai/*`. */
  token: string;
  /** The signed-in school. Empty string when the session does not carry one. */
  instituteId: string;
  /** The signed-in user. Empty string when the session does not carry one. */
  userId: string;
  /** Per-deployment API host from the login payload, when it names one. */
  baseUrl: string;
}

const USER_DATA_KEY = 'userData';
const MENU_CONTEXT_KEY = 'menuContext';

function read(source: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = source[key];
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
}

/**
 * Returns null when there is no token, so a caller renders a signed-out state
 * rather than firing a request that can only come back 401.
 */
export function readAiSession(): AiSession | null {
  if (typeof window === 'undefined') return null;

  try {
    const userData = JSON.parse(localStorage.getItem(USER_DATA_KEY) || '{}') as Record<string, unknown>;
    const menuContext = JSON.parse(localStorage.getItem(MENU_CONTEXT_KEY) || '{}') as Record<string, unknown>;

    const token = read(userData, 'user_token', 'token') || read(menuContext, 'user_token', 'token');

    if (!token) return null;

    return {
      token,
      instituteId:
        read(userData, 'sub_institute_id') || read(menuContext, 'sub_institute_id'),
      userId: read(userData, 'id', 'user_id') || read(menuContext, 'user_id'),
      baseUrl: read(userData, 'host_name'),
    };
  } catch {
    return null;
  }
}
