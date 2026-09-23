// ---------------------------------------------------------------------------
// Data access for LMS > Exam > Blueprint.
//
// Talks to /api/assessment-blueprints on the ERP. Reference blueprints come
// back from the same endpoint as the school's own, in the same shape, so one
// list renders both — the only difference is that a reference has a null `id`
// and has to be copied before it can be changed.
// ---------------------------------------------------------------------------

import {
  appendCommonParams,
  buildSessionContext,
  createAuthHeaders,
  normalizeApiStatus,
  type ApiEnvelope,
  type SessionContext,
} from '@/lib/erp-client';
import type {
  Blueprint,
  BlueprintDraft,
  BlueprintIndex,
  ChapterOption,
  HpcOptionType,
  HpcSchoolOption,
  HpcSchoolOptions,
} from './types';

function requireSession(): SessionContext {
  const session = buildSessionContext();

  if (!session.subInstituteId) {
    throw new Error('Your session is missing the school id. Please sign in again.');
  }

  return session;
}

async function readJson(response: Response): Promise<ApiEnvelope & { data?: unknown }> {
  const text = await response.text();

  try {
    return text ? (JSON.parse(text) as ApiEnvelope) : {};
  } catch {
    throw new Error(
      response.ok
        ? 'The blueprint service returned a response we could not read.'
        : `Request failed with status ${response.status}`
    );
  }
}

function unwrap<T>(payload: (ApiEnvelope & { data?: T }) | null, fallbackMessage: string): T {
  const status = normalizeApiStatus(payload);

  if (status !== '1' && status !== '200') {
    throw new Error(payload?.message || fallbackMessage);
  }

  if (payload?.data == null) {
    throw new Error(payload?.message || fallbackMessage);
  }

  return payload.data;
}

function url(session: SessionContext, path: string, extra?: Record<string, string>): string {
  const params = new URLSearchParams();
  appendCommonParams(params, session);

  if (session.userId) {
    params.set('user_id', session.userId);
  }

  Object.entries(extra ?? {}).forEach(([key, value]) => params.set(key, value));

  return `${session.baseUrl}/api/assessment-blueprints${path}?${params.toString()}`;
}

function baseBody(session: SessionContext): Record<string, unknown> {
  return {
    sub_institute_id: session.subInstituteId,
    syear: session.syear,
    user_id: session.userId,
  };
}

export async function fetchBlueprintIndex(): Promise<BlueprintIndex> {
  const session = requireSession();
  const response = await fetch(url(session, ''), {
    method: 'GET',
    cache: 'no-store',
    headers: createAuthHeaders(session),
  });

  return unwrap<BlueprintIndex>((await readJson(response)) as never, 'Unable to load blueprints.');
}

/** Chapters for a class and subject, so a weightage row can point at a real one. */
export async function fetchChapters(standardId: number, subjectId: number): Promise<ChapterOption[]> {
  const session = requireSession();
  const response = await fetch(
    url(session, '/chapters', {
      standard_id: String(standardId),
      subject_id: String(subjectId),
    }),
    { method: 'GET', cache: 'no-store', headers: createAuthHeaders(session) }
  );

  const data = unwrap<{ chapters: ChapterOption[] }>(
    (await readJson(response)) as never,
    'Unable to load chapters for that subject.'
  );

  return data.chapters ?? [];
}

export async function saveBlueprint(draft: BlueprintDraft): Promise<Blueprint> {
  const session = requireSession();
  const path = draft.id ? `/${draft.id}` : '';

  const response = await fetch(url(session, path), {
    method: 'POST',
    cache: 'no-store',
    headers: createAuthHeaders(session, 'application/json'),
    body: JSON.stringify({
      ...baseBody(session),
      // The server ignores `kind` on an update — a blueprint does not change
      // category — but sends it on create, which is how a new HPC is born.
      kind: draft.kind,
      stage: draft.stage,
      name: draft.name,
      description: draft.description,
      academic_year: draft.academic_year,
      board: draft.board,
      class_band: draft.class_band,
      assessment_type: draft.assessment_type,
      standard_id: draft.standard_id ?? 0,
      subject_id: draft.subject_id ?? 0,
      subject_label: draft.subject_label,
      // Always 0 for an HPC; the field is unused there rather than repurposed
      // into something that would read as a score.
      total_marks: draft.kind === 'hpc' ? 0 : draft.total_marks,
      duration_minutes: draft.duration_minutes ?? 0,
      status: draft.status,
      source: draft.source,
      source_url: draft.source_url,
      preset_key: draft.preset_key ?? '',
      parent_id: draft.parent_id ?? 0,
      definition: draft.definition,
    }),
  });

  const data = unwrap<{ blueprint: Blueprint }>(
    (await readJson(response)) as never,
    'Unable to save this blueprint.'
  );

  return data.blueprint;
}

/**
 * Copies a reference (by `presetKey`) or one of the school's own blueprints
 * (by `blueprintId`) into a new, editable row. This is the only way a published
 * design enters a school — references themselves are never edited.
 */
export async function cloneBlueprint(input: {
  presetKey?: string;
  blueprintId?: number;
  name?: string;
}): Promise<Blueprint> {
  const session = requireSession();
  const response = await fetch(url(session, '/clone'), {
    method: 'POST',
    cache: 'no-store',
    headers: createAuthHeaders(session, 'application/json'),
    body: JSON.stringify({
      ...baseBody(session),
      preset_key: input.presetKey ?? '',
      blueprint_id: input.blueprintId ?? 0,
      name: input.name ?? '',
    }),
  });

  const data = unwrap<{ blueprint: Blueprint }>(
    (await readJson(response)) as never,
    'Unable to copy this blueprint.'
  );

  return data.blueprint;
}

export async function deleteBlueprint(id: number): Promise<void> {
  const session = requireSession();
  const response = await fetch(url(session, `/${id}`), {
    method: 'DELETE',
    cache: 'no-store',
    headers: createAuthHeaders(session),
  });

  const payload = await readJson(response);
  const status = normalizeApiStatus(payload);

  if (status !== '1' && status !== '200') {
    throw new Error(payload?.message || 'Unable to remove this blueprint.');
  }
}

// -- School HPC option lists -------------------------------------------------

/**
 * This school's own HPC option lists, with the published defaults alongside.
 *
 * A type the school has not customised comes back as the NCERT list with
 * `is_default: true`, so the settings screen can show what is standard and what
 * the school chose without holding its own copy of the vocabulary.
 */
export async function fetchHpcOptions(): Promise<HpcSchoolOptions> {
  const session = requireSession();
  const response = await fetch(url(session, '/hpc-options'), {
    method: 'GET',
    cache: 'no-store',
    headers: createAuthHeaders(session),
  });

  return unwrap<HpcSchoolOptions>(
    (await readJson(response)) as never,
    "Unable to load your school's HPC options."
  );
}

/** Replaces this school's list for one option type. Scoped to the caller's own school. */
export async function saveHpcOptions(
  optionType: HpcOptionType,
  options: Array<{ code?: string; label: string; description?: string }>
): Promise<HpcSchoolOption[]> {
  const session = requireSession();
  const response = await fetch(url(session, '/hpc-options'), {
    method: 'POST',
    cache: 'no-store',
    headers: createAuthHeaders(session, 'application/json'),
    body: JSON.stringify({ ...baseBody(session), option_type: optionType, options }),
  });

  const data = unwrap<{ options: HpcSchoolOption[] }>(
    (await readJson(response)) as never,
    'Unable to save these options.'
  );

  return data.options ?? [];
}

/** Drops this school's list for one type so it follows the standard again. */
export async function resetHpcOptions(optionType: HpcOptionType): Promise<HpcSchoolOption[]> {
  const session = requireSession();
  const response = await fetch(url(session, '/hpc-options/reset'), {
    method: 'POST',
    cache: 'no-store',
    headers: createAuthHeaders(session, 'application/json'),
    body: JSON.stringify({ ...baseBody(session), option_type: optionType }),
  });

  const data = unwrap<{ options: HpcSchoolOption[] }>(
    (await readJson(response)) as never,
    'Unable to reset these options.'
  );

  return data.options ?? [];
}
