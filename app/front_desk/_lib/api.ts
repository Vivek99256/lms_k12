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
  method: 'GET' | 'POST' = 'GET',
  type: 'API' | 'JSON' = 'JSON'
) {
  const session = buildSessionContext();
  const search = new URLSearchParams(params);
  appendCommonParams(search, session);
  search.set('type', type);
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

export async function loadModuleOptions(
  endpoint: string,
  dataKey: string
): Promise<Array<{ label: string; value: string }>> {
  const { payload } = await loadModuleRows(endpoint, {}, 'GET', 'API');
  const source = payload[dataKey];
  if (!Array.isArray(source)) return [];

  return source.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as JsonRecord;
    const value = record.id ?? record.value;
    const label = record.teacher_name ?? record.name ?? record.label;
    if (value == null || label == null) return [];
    return [{ value: String(value), label: String(label).trim() }];
  });
}

export async function saveModuleRecord(
  endpoint: string,
  form: FormData
) {
  const session = buildSessionContext();
  if (!session.syear) {
    throw new Error('Choose an academic year from the header before saving this record.');
  }
  if (!session.subInstituteId) {
    throw new Error('Your login session is missing the institute. Please sign in again.');
  }
  form.set('sub_institute_id', session.subInstituteId);
  form.set('syear', session.syear);
  if (session.userId) form.set('user_id', session.userId);

  const proxyQuery = new URLSearchParams({
    path: endpoint,
    type: 'API',
    syear: session.syear,
    sub_institute_id: session.subInstituteId,
  });
  if (session.userId) proxyQuery.set('user_id', session.userId);

  const response = await fetch(
    `/api/proxy-file?${proxyQuery.toString()}`,
    {
      method: 'POST',
      headers: createAuthHeaders(session),
      body: form,
    }
  );
  return decode(response);
}

