'use client';

import { appendSessionParams, asRecord, fetchLaravelJson, getFeesSession, readString, toArray } from '@/app/fees/_lib/fees-api';

export type SetupResource = 'quota' | 'house';
export type SetupRow = { id: string; name: string; sort_order: string };
type Envelope = { status?: number | string; message?: string; data?: unknown };

function context() {
  const session = getFeesSession(); const params = new URLSearchParams();
  appendSessionParams(params, session); return { session, params };
}
function check(payload: Envelope) { if (Number(payload.status) !== 1) throw new Error(payload.message || 'Request failed.'); }

export async function listSetup(resource: SetupResource): Promise<SetupRow[]> {
  const { session, params } = context();
  const payload = await fetchLaravelJson<Envelope>(session, `/api/proxy?path=student-setup/${resource}&${params}`);
  check(payload);
  return toArray(payload.data).map((item) => { const row = asRecord(item); return {
    id: readString(row.id), name: readString(resource === 'quota' ? row.title : row.house_name), sort_order: readString(row.sort_order),
  }; });
}
export async function saveSetup(resource: SetupResource, row: Omit<SetupRow, 'id'>, id?: string): Promise<string> {
  const { session, params } = context(); params.set('name', row.name); params.set('sort_order', row.sort_order);
  const payload = await fetchLaravelJson<Envelope>(session, `/api/proxy?path=student-setup/${resource}${id ? `/${id}` : ''}`, {
    method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString(),
  }); check(payload); return payload.message || 'Saved.';
}
export async function deleteSetup(resource: SetupResource, id: string): Promise<string> {
  const { session, params } = context();
  const payload = await fetchLaravelJson<Envelope>(session, `/api/proxy?path=student-setup/${resource}/${id}`, {
    method: 'DELETE', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString(),
  }); check(payload); return payload.message || 'Deleted.';
}
