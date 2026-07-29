'use client';

import {
  appendCommonParams,
  buildSessionContext,
  createAuthHeaders,
  readNumber,
  readString,
} from '@/lib/erp-client';
import type {
  SqaaDocumentReport,
  SqaaDocumentRow,
  SqaaEntryData,
  SqaaEntryDocument,
  SqaaHierarchySelection,
  SqaaLevel,
} from './types';

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function records(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) return value.map(asRecord);
  return Object.values(asRecord(value))
    .map(asRecord)
    .filter((item) => Object.keys(item).length > 0);
}

function messageFrom(value: unknown, fallback: string) {
  return readString(asRecord(value).message) || fallback;
}

async function request(path: string, params = new URLSearchParams(), init?: RequestInit): Promise<unknown> {
  const session = buildSessionContext();
  appendCommonParams(params, session);
  const query = new URLSearchParams(params);
  query.set('path', path);

  const response = await fetch(`/api/proxy?${query.toString()}`, {
    ...init,
    headers: createAuthHeaders(session),
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
  if (!response.ok) {
    throw new Error(messageFrom(payload, `Request failed with HTTP ${response.status}.`));
  }
  return payload;
}

async function get(path: string, params = new URLSearchParams()) {
  return request(path, params);
}

function mapLevel(value: JsonRecord): SqaaLevel {
  return {
    id: readString(value.id),
    title: readString(value.title),
    description: readString(value.description),
    parentId: readString(value.parent_id),
    level: readNumber(value.level),
    sortOrder: readNumber(value.sort_order),
  };
}

function mapDocument(value: JsonRecord): SqaaDocumentRow {
  return {
    id: readString(value.id),
    menuId: readString(value.menu_id),
    menuTitle: readString(value.menuTitle ?? value.menu_title),
    documentTitle: readString(value.title ?? value.document_title),
    availability: readString(value.availability).toLowerCase(),
    file: readString(value.file),
  };
}

export async function loadSqaaLevels(parentId: string, level: 2 | 3 | 4) {
  const params = new URLSearchParams({ level: String(level) });
  if (parentId) params.set('parent_id', parentId);
  const payload = asRecord(await get('api/sqaa/levels', params));
  return records(payload.data).map(mapLevel);
}

export async function loadSqaaLevel1() {
  const payload = asRecord(await get('api/sqaa/levels', new URLSearchParams({ level: '1' })));
  return records(payload.data).map(mapLevel);
}

export async function loadSqaaDocumentReport(
  availability: string,
  selection: SqaaHierarchySelection,
): Promise<SqaaDocumentReport> {
  const params = new URLSearchParams({ availability });
  const menuId = selection.level4 || selection.level3 || selection.level2 || selection.level1;
  if (menuId) params.set('menu_id', menuId);

  const [payloadValue, level1] = await Promise.all([
    get('api/sqaa/document-report', params),
    loadSqaaLevel1(),
  ]);
  const payload = asRecord(payloadValue);
  return {
    rows: records(payload.data).map(mapDocument),
    level1,
  };
}

function mapEntryDocument(value: JsonRecord): SqaaEntryDocument {
  const availability = readString(value.availability).toLowerCase();
  return {
    documentId: readString(value.document_id),
    entryId: readString(value.entry_id),
    menuId: readString(value.menu_id),
    title: readString(value.title),
    reasons: readString(value.reasons),
    availability: availability === 'yes' || availability === 'no' || availability === 'inprocess'
      ? availability
      : '',
    file: readString(value.file),
  };
}

export async function loadSqaaEntry(menuId: string): Promise<SqaaEntryData> {
  const payload = asRecord(await get(`api/sqaa/entry/${encodeURIComponent(menuId)}`));
  const data = asRecord(payload.data);
  const markValue = data.mark;
  return {
    mark: markValue == null || markValue === '' ? null : readNumber(markValue),
    documents: records(data.documents).map(mapEntryDocument),
  };
}

export async function saveSqaaEntry(
  menuId: string,
  mark: string,
  documents: SqaaEntryDocument[],
  files: Record<string, File | undefined>,
) {
  const form = new FormData();
  form.set('menu_id', menuId);
  form.set('mark', mark);
  documents.forEach((document, index) => {
    form.set(`documents[${index}][document_id]`, document.documentId);
    form.set(`documents[${index}][title]`, document.title);
    form.set(`documents[${index}][availability]`, document.availability);
    form.set(`documents[${index}][reasons]`, document.reasons);
    if (document.file) form.set(`documents[${index}][existing_file]`, document.file);
    const file = files[document.documentId];
    if (file) form.set(`documents[${index}][file]`, file);
  });
  return request('api/sqaa/entry', new URLSearchParams(), { method: 'POST', body: form });
}

export function sqaaFileUrl(filename: string) {
  return filename
    ? `https://s3-triz.fra1.digitaloceanspaces.com/public/sqaa/${encodeURIComponent(filename)}`
    : '';
}
