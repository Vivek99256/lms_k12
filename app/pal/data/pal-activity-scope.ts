import {
  appendCommonParams,
  buildSessionContext,
  createAuthHeaders,
  readNumber,
  readString,
} from '@/lib/erp-client';

/**
 * Application Lab, step 1: what the activity is about.
 *
 *   GET /lms/pal/application-lab/scope/chapter/{chapterId}
 *
 * The student chooses either some of the concepts they have studied, or the
 * whole chapter (open only once every concept in it has been studied). What the
 * browser sends is a request: the server checks it again on every call, keeps
 * only studied concepts, and refuses the whole chapter until it is complete.
 */

export type ActivityScope = { type: 'concepts'; concepts: string[] } | { type: 'chapter'; concepts: string[] };

export interface ScopeOptions {
  /** Concepts the student has studied (taught in Learn Concepts, or practised). */
  studied: { name: string; description: string }[];
  /** How many concepts the chapter has. */
  total: number;
  /** Every concept studied: the whole-chapter activity is open. */
  chapterComplete: boolean;
}

/** A stable identity for a scope, for React keys and for telling two choices apart. */
export function scopeId(scope: ActivityScope): string {
  return scope.type === 'chapter' ? 'chapter' : `concepts:${[...scope.concepts].map((c) => c.toLowerCase()).sort().join('|')}`;
}

export function scopeLabel(scope: ActivityScope): string {
  if (scope.type === 'chapter') return 'Whole chapter';
  return scope.concepts.length === 1 ? scope.concepts[0] : `${scope.concepts.length} concepts`;
}

/** Adds the scope to a request the way the server reads it. */
export function addScope(params: URLSearchParams, scope: ActivityScope): void {
  params.set('scope_type', scope.type);
  if (scope.type === 'concepts') scope.concepts.forEach((name, i) => params.set(`scope_concepts[${i}]`, name));
}

const rec = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

export async function fetchScopeOptions(chapterId: string | number, signal?: AbortSignal): Promise<ScopeOptions> {
  const ctx = buildSessionContext();
  if (!ctx.baseUrl) throw new Error('Session data is missing. Please sign in again.');
  const params = new URLSearchParams();
  appendCommonParams(params, ctx);
  if (ctx.userId) params.set('user_id', ctx.userId);

  const response = await fetch(
    `${ctx.baseUrl}/lms/pal/application-lab/scope/chapter/${encodeURIComponent(String(chapterId))}?${params.toString()}`,
    { headers: { ...createAuthHeaders(ctx), 'X-Requested-With': 'XMLHttpRequest' }, signal }
  );
  if (!response.ok) throw new Error('Couldn’t load the concepts you have studied. Try again.');
  const payload = rec(await response.json());
  const studied = Array.isArray(payload.studied) ? payload.studied : [];

  return {
    studied: studied.map((c) => ({ name: readString(rec(c).name), description: readString(rec(c).description) })).filter((c) => c.name !== ''),
    total: readNumber(payload.total),
    chapterComplete: payload.chapter_complete === true,
  };
}
