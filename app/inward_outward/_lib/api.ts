'use client';

import {
  appendCommonParams,
  buildSessionContext,
  createAuthHeaders,
  normalizeApiStatus,
  readString,
  type ApiEnvelope,
} from '@/lib/erp-client';
import type { PhysicalFileLocation, Place, RegisterEntry, RegisterKind } from './types';

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function records(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) return value.map(asRecord);
  const record = asRecord(value);
  return Object.values(record).map(asRecord).filter((item) => Object.keys(item).length > 0);
}

function messageFrom(payload: unknown, fallback: string) {
  return readString(asRecord(payload).message) || fallback;
}

async function request(path: string, init?: RequestInit, params?: URLSearchParams): Promise<unknown> {
  const session = buildSessionContext();
  const query = params ?? new URLSearchParams();
  appendCommonParams(query, session);
  const proxyQuery = new URLSearchParams(query);
  proxyQuery.set('path', path);

  const headers = new Headers(init?.headers);
  const authHeaders = createAuthHeaders(session);
  Object.entries(authHeaders).forEach(([key, value]) => headers.set(key, String(value)));

  const response = await fetch(`/api/proxy?${proxyQuery.toString()}`, {
    ...init,
    headers,
    cache: 'no-store',
    credentials: 'include',
  });
  const text = await response.text();
  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(text.replace(/\s+/g, ' ').slice(0, 300) || `HTTP ${response.status}`);
  }
  if (!response.ok) throw new Error(messageFrom(payload, `Request failed with HTTP ${response.status}.`));
  const envelope = asRecord(payload) as ApiEnvelope;
  if (normalizeApiStatus(envelope) === '2') throw new Error(messageFrom(payload, 'The request was rejected.'));
  return payload;
}

function dataFrom(payload: unknown): JsonRecord[] {
  const record = asRecord(payload);
  return records(record.data ?? payload);
}

export function mapPlace(record: JsonRecord): Place {
  return {
    id: readString(record.id),
    title: readString(record.title),
    description: readString(record.description),
  };
}

export function mapPhysicalFile(record: JsonRecord): PhysicalFileLocation {
  return {
    ...mapPlace(record),
    fileCode: readString(record.file_code),
    fileLocation: readString(record.file_location),
  };
}

export function mapEntry(record: JsonRecord, kind: RegisterKind): RegisterEntry {
  const placeValue = record.place_id;
  const locationValue = record.file_location_id;
  const numberKey = `${kind}_number`;
  const dateKey = `${kind}_date`;
  return {
    id: readString(record.id),
    placeId: typeof placeValue === 'number' ? String(placeValue) : '',
    placeName: readString(placeValue),
    fileLocationId: typeof locationValue === 'number' ? String(locationValue) : '',
    fileName: readString(record.file_name),
    fileLocation: readString(locationValue),
    number: readString(record[numberKey]),
    title: readString(record.title),
    description: readString(record.description),
    attachment: readString(record.attachment),
    academicYear: readString(record.acedemic_year),
    syear: readString(record.syear),
    date: readString(record[dateKey]),
  };
}

export async function listPlaces() {
  return dataFrom(await request('inward_outward/add_place_master')).map(mapPlace);
}

export async function listPhysicalFiles() {
  return dataFrom(await request('inward_outward/add_physical_file_location')).map(mapPhysicalFile);
}

export async function listEntries(kind: RegisterKind) {
  return dataFrom(await request(`inward_outward/add_${kind}`)).map((row) => mapEntry(row, kind));
}

export async function loadEntryMetadata(kind: RegisterKind) {
  const payload = asRecord(await request(`inward_outward/add_${kind}/create`));
  const data = asRecord(payload.data ?? payload);
  return {
    places: records(data.menu ?? payload.menu).map(mapPlace),
    files: records(data.menu1 ?? payload.menu1).map(mapPhysicalFile),
    nextNumber: readString(data[`${kind}_no`] ?? payload[`${kind}_no`]),
  };
}

export async function mutateForm(path: string, method: 'POST' | 'PUT', form: FormData) {
  const session = buildSessionContext();
  form.set('type', 'API');
  if (session.subInstituteId) form.set('sub_institute_id', session.subInstituteId);
  if (session.syear) form.set('syear', session.syear);
  if (method === 'PUT') form.set('_method', 'PUT');
  return request(path, { method: 'POST', body: form });
}

export async function deleteResource(path: string) {
  const form = new FormData();
  form.set('_method', 'DELETE');
  return mutateForm(path, 'PUT', form);
}

export function attachmentUrl(kind: RegisterKind, filename: string) {
  if (!filename) return '';
  return `${buildSessionContext().baseUrl}/storage/${kind}/${encodeURIComponent(filename)}`;
}
