import {
  appendCommonParams,
  buildSessionContext,
  createAuthHeaders,
  type ApiEnvelope,
} from '@/lib/erp-client';

export type JsonRecord = Record<string, unknown>;

function recordsFrom(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is JsonRecord => Boolean(item && typeof item === 'object')
    );
  }
  if (!value || typeof value !== 'object') return [];

  const record = value as JsonRecord;
  for (const key of ['data', 'result', 'results', 'list', 'records']) {
    const rows = recordsFrom(record[key]);
    if (rows.length) return rows;
  }
  return [];
}

async function decode(response: Response): Promise<ApiEnvelope & JsonRecord> {
  const text = await response.text();
  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      'Laravel returned an HTML response. This action requires an authenticated JSON endpoint.'
    );
  }
  if (!payload || typeof payload !== 'object') {
    throw new Error('Laravel returned an invalid response.');
  }
  const result = payload as ApiEnvelope & JsonRecord;
  if (!response.ok || ['0', '2'].includes(String(result.status ?? result.status_code ?? ''))) {
    throw new Error(
      typeof result.message === 'string'
        ? result.message
        : `Laravel rejected the request (HTTP ${response.status}).`
    );
  }
  return result;
}

export async function loadModuleRows(
  endpoint: string,
  params: Record<string, string> = {},
  method: 'GET' | 'POST' = 'GET'
) {
  const session = buildSessionContext();
  const search = new URLSearchParams(params);
  appendCommonParams(search, session);
  search.set('type', 'JSON');
  if (session.userId) search.set('user_id', session.userId);

  const proxyUrl = `/api/proxy?path=${encodeURIComponent(endpoint)}`;
  const response =
    method === 'GET'
      ? await fetch(`${proxyUrl}&${search.toString()}`, {
          headers: createAuthHeaders(session),
          cache: 'no-store',
        })
      : await fetch(proxyUrl, {
          method: 'POST',
          headers: createAuthHeaders(session, 'application/x-www-form-urlencoded'),
          body: search.toString(),
        });
  const payload = await decode(response);
  return { payload, rows: recordsFrom(payload) };
}

export async function saveModuleRecord(
  endpoint: string,
  form: FormData
) {
  const session = buildSessionContext();
  form.set('type', 'JSON');
  if (session.subInstituteId) form.set('sub_institute_id', session.subInstituteId);
  if (session.syear) form.set('syear', session.syear);
  if (session.userId) form.set('user_id', session.userId);

  const response = await fetch(
    `/api/proxy?path=${encodeURIComponent(endpoint)}`,
    {
      method: 'POST',
      headers: createAuthHeaders(session),
      body: form,
    }
  );
  return decode(response);
}

