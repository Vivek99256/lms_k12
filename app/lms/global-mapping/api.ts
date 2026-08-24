import {
  buildSessionContext,
  createAuthHeaders,
  normalizeApiStatus,
  readString,
  type SessionContext,
} from '@/lib/erp-client';

/**
 * LMS → LMS Global Mapping data layer (lmsmappingController, resource `lmsmapping`).
 *
 *   GET    /lms/lmsmapping?type=API                        → global taxonomy
 *   POST   /lms/lmsmapping        (mapping_type + mapping_value[])   → create type+values
 *   POST   /lms/lmsmapping/{id}   (_method=PUT, mapping_name)        → rename a row
 *   DELETE /lms/lmsmapping/{id}?type=API                            → delete (childless only)
 *
 * Manages the single self-referencing table `lms_mapping_type`: parent_id=0 rows
 * are mapping *types* (DOK, Bloom, Learning Outcome…), children are their *values*.
 * "Global" = `globally=1`. The global path needs NO tenant/session (the table has
 * no sub_institute_id column), and all four verbs return is_mobile JSON for type=API.
 * We only ever use the global path (no chapter_id/topic_id).
 */

function requireSession(): SessionContext {
  const session = buildSessionContext();
  if (!session.baseUrl) throw new Error('Session data is missing. Please sign in again.');
  return session;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

async function readJson(res: Response, fallback: string): Promise<unknown> {
  const text = (await res.text()).trim();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`${fallback} (HTTP ${res.status}).`);
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MappingValueRow {
  id: string;
  name: string;
}

export interface MappingTypeRow {
  id: string;
  name: string;
  globally: boolean;
  values: MappingValueRow[];
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function fetchGlobalMappings(signal?: AbortSignal): Promise<MappingTypeRow[]> {
  const session = requireSession();

  const url = new URL(`${session.baseUrl}/lms/lmsmapping`);
  url.searchParams.set('type', 'API');

  const res = await fetch(url.toString(), {
    headers: { ...createAuthHeaders(session), 'X-Requested-With': 'XMLHttpRequest' },
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Unable to load the global mappings.`);
  const raw = toRecord(await readJson(res, 'Failed to load the global mappings'));

  // `data` is an object keyed by type id, each with an optional CHILD_ARR.
  const data = toRecord(raw.data);
  return Object.values(data)
    .map((entry) => {
      const r = toRecord(entry);
      const id = readString(r.id);
      if (!id) return null;
      const values = toArray(r.CHILD_ARR)
        .map((child) => {
          const c = toRecord(child);
          const cid = readString(c.id);
          return cid ? { id: cid, name: readString(c.name) } : null;
        })
        .filter((v): v is MappingValueRow => v !== null);
      return {
        id,
        name: readString(r.name),
        globally: readString(r.globally) === '1',
        values,
      };
    })
    .filter((t): t is MappingTypeRow => t !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// Create / Rename / Delete
// ---------------------------------------------------------------------------

export async function createMapping(typeName: string, values: string[]): Promise<string> {
  const session = requireSession();

  const body = new URLSearchParams();
  body.set('type', 'API');
  body.set('mapping_type', typeName);
  const cleaned = values.map((v) => v.trim()).filter(Boolean);
  // Laravel loops mapping_value[]; send at least one (empty entries are skipped).
  (cleaned.length > 0 ? cleaned : ['']).forEach((v) => body.append('mapping_value[]', v));

  const res = await fetch(`${session.baseUrl}/lms/lmsmapping`, {
    method: 'POST',
    headers: {
      ...createAuthHeaders(session, 'application/x-www-form-urlencoded'),
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Unable to save the mapping.`);
  const raw = toRecord(await readJson(res, 'Failed to save the mapping'));
  if (normalizeApiStatus(raw) === '0') throw new Error(readString(raw.message) || 'Failed to save the mapping.');
  return readString(raw.message) || 'Mapping saved.';
}

/** Rename a type or value row (Laravel update only changes `name`). */
export async function renameMapping(id: string, name: string): Promise<string> {
  const session = requireSession();

  const body = new URLSearchParams();
  body.set('type', 'API');
  body.set('_method', 'PUT');
  body.set('mapping_name', name);

  const res = await fetch(`${session.baseUrl}/lms/lmsmapping/${encodeURIComponent(id)}`, {
    method: 'POST',
    headers: {
      ...createAuthHeaders(session, 'application/x-www-form-urlencoded'),
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Unable to rename.`);
  const raw = toRecord(await readJson(res, 'Failed to rename'));
  return readString(raw.message) || 'Renamed.';
}

export async function deleteMapping(id: string): Promise<string> {
  const session = requireSession();
  const url = new URL(`${session.baseUrl}/lms/lmsmapping/${encodeURIComponent(id)}`);
  url.searchParams.set('type', 'API');

  const res = await fetch(url.toString(), {
    method: 'DELETE',
    headers: { ...createAuthHeaders(session), 'X-Requested-With': 'XMLHttpRequest' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Unable to delete.`);
  const raw = toRecord(await readJson(res, 'Failed to delete'));
  return readString(raw.message) || 'Deleted.';
}
