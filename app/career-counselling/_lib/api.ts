import {
  appendCommonParams,
  buildSessionContext,
  createAuthHeaders,
  type ApiEnvelope,
} from '@/lib/erp-client';
import type {
  AlignmentPayload, AspirationInput, AspirationSnapshot, CareerEvidencePayload,
  CareerRecommendationPayload, CareerRecord, InterestQuestion, InterestResult,
} from './types';

const KEYS = ['data', 'result', 'results', 'records', 'list', 'career', 'question'];

function messageFrom(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object') {
    const message = (payload as CareerRecord).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

export function recordsFrom(payload: unknown): CareerRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter(
      (item): item is CareerRecord => Boolean(item && typeof item === 'object')
    );
  }
  if (!payload || typeof payload !== 'object') return [];
  const value = payload as CareerRecord;
  for (const key of KEYS) {
    const rows = recordsFrom(value[key]);
    if (rows.length) return rows;
  }
  return [];
}

export async function careerRequest<T = unknown>(
  endpoint: string,
  params: Record<string, string | number | undefined> = {},
  options: RequestInit = {}
): Promise<T> {
  const session = buildSessionContext();
  const search = new URLSearchParams();
  appendCommonParams(search, session);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && String(value).trim()) search.set(key, String(value));
  });
  const path = `/api/proxy?path=${encodeURIComponent(endpoint)}&${search.toString()}`;
  let response: Response;
  try {
    response = await fetch(path, {
      cache: 'no-store',
      ...options,
      headers: {
        ...createAuthHeaders(
          session,
          options.body instanceof FormData ? undefined : 'application/json'
        ),
        ...options.headers,
      },
    });
  } catch {
    throw new Error('The career service could not be reached. Check your connection and try again.');
  }
  const text = await response.text();
  let payload: unknown = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new Error('The career service returned an unreadable response.');
  }
  const envelope = payload as ApiEnvelope;
  if (!response.ok || ['0', '2'].includes(String(envelope.status ?? envelope.status_code ?? ''))) {
    throw new Error(messageFrom(payload, `Request failed (HTTP ${response.status}).`));
  }
  return payload as T;
}

export async function loadRecords(
  endpoint: string,
  params?: Record<string, string | number | undefined>
) {
  return recordsFrom(await careerRequest(endpoint, params));
}

export async function loadCurrentAspiration(): Promise<AspirationSnapshot | null> {
  const payload = await careerRequest<{ data: AspirationSnapshot | null }>('studentAspiration');
  return payload.data ?? null;
}

export async function saveAspiration(input: AspirationInput): Promise<AspirationSnapshot> {
  const payload = await careerRequest<{ data: AspirationSnapshot }>('studentAspiration', {}, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return payload.data;
}

/**
 * `student_id` is omitted for a student viewing their own alignment (the
 * Laravel side infers the current student from the session token) and
 * supplied when staff open it from a student's profile, mirroring
 * `loadCareerEvidence` above.
 */
export async function loadAlignment(studentId?: string): Promise<AlignmentPayload> {
  const payload = await careerRequest<{ data: AlignmentPayload }>('careerAlignment', {
    student_id: studentId,
  });
  return payload.data;
}

/**
 * `student_id` is omitted for a student viewing their own Career Intelligence
 * tab (the Laravel side infers the current student from the session token,
 * same as `studentAspiration`/`careerAlignment`) and supplied when staff open
 * it from a student's profile — authorization for viewing another student's
 * evidence is enforced server-side, same as every other proxied endpoint.
 */
export async function loadCareerEvidence(studentId?: string): Promise<CareerEvidencePayload> {
  const payload = await careerRequest<{ data: CareerEvidencePayload }>('studentCareerEvidence', {
    student_id: studentId,
  });
  return payload.data;
}

/**
 * Knowledge-based adjacent-career recommendation — `student_id` omission
 * rule mirrors `loadAlignment`/`loadCareerEvidence` exactly (self via
 * session, or an explicit id for a staff view, authorized server-side).
 */
export async function loadCareerRecommendation(studentId?: string): Promise<CareerRecommendationPayload> {
  const payload = await careerRequest<{ data: CareerRecommendationPayload }>('careerRecommendation', {
    student_id: studentId,
  });
  return payload.data;
}

export async function loadOccupations(): Promise<CareerRecord[]> {
  return loadRecords('allOccupation');
}

export async function loadQuestions(): Promise<InterestQuestion[]> {
  const rows = await loadRecords('intrestQuestions', { start: 1, end: 60 });
  return rows.slice(0, 60).map((row, index) => ({
    id: String(row.id ?? row.question_id ?? index + 1),
    text: String(row.text ?? row.question ?? row.title ?? ''),
  })).filter((item) => item.text);
}

export async function loadInterestResults(
  answers?: string,
  scores?: Record<string, number>
): Promise<InterestResult[]> {
  const payload = answers
    ? await careerRequest('intrestResults', { answers })
    : await careerRequest('intrestEnterScore', scores);
  const rows = recordsFrom(payload);
  if (rows.length) {
    return rows.map((row) => ({
      area: String(row.area ?? row.name ?? row.title ?? ''),
      score: Number(row.score ?? row.value ?? 0),
      description: String(row.description ?? row.details ?? ''),
    })).filter((item) => item.area);
  }
  if (payload && typeof payload === 'object') {
    return ['Realistic', 'Investigative', 'Artistic', 'Social', 'Enterprising', 'Conventional']
      .map((area) => ({
        area,
        score: Number((payload as CareerRecord)[area] ?? scores?.[area] ?? 0),
        description: '',
      }));
  }
  return [];
}
