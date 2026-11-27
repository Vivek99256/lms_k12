import type { PendingResource } from '@/lib/teach-learn/catalogue-agent-client';

/**
 * The background resources AI Stack started, remembered by the browser so a refresh (or coming back later) still shows what is
 * running. The server remains the truth about their state; this only remembers WHICH items to ask about.
 */
export interface SavedPending {
  resource: PendingResource;
  savedAt: number;
}

export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/** A generation that has been unresolved this long is no longer shown on its own (the server stops it long before). */
export const KEEP_MS = 24 * 60 * 60 * 1000;

export const resourceKey = (r: Pick<PendingResource, 'kind' | 'chapter_id' | 'run' | 'document_kind'>): string =>
  r.kind === 'presentation' ? `p:${r.chapter_id}:${r.run}` : `d:${r.chapter_id}:${r.document_kind}`;

const storageKey = (scope: string) => `aiStackPendingResources:${scope}`;

function isResource(value: unknown): value is PendingResource {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  if (r.kind !== 'presentation' && r.kind !== 'document') return false;
  if (!Number.isInteger(r.chapter_id) || (r.chapter_id as number) <= 0) return false;
  return r.kind === 'presentation' ? typeof r.run === 'string' && r.run !== '' : typeof r.document_kind === 'string' && r.document_kind !== '';
}

/** What is remembered for this school, newest last. Anything unreadable or too old is left out (the browser's data is not trusted). */
export function loadPending(storage: StorageLike, scope: string, now: number = Date.now()): SavedPending[] {
  try {
    const raw = storage.getItem(storageKey(scope));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const out: SavedPending[] = [];
    for (const entry of parsed) {
      const e = entry as { resource?: unknown; savedAt?: unknown };
      if (!isResource(e?.resource) || typeof e.savedAt !== 'number' || now - e.savedAt > KEEP_MS) continue;
      const key = resourceKey(e.resource);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ resource: e.resource, savedAt: e.savedAt });
    }
    return out;
  } catch {
    return [];
  }
}

export function savePending(storage: StorageLike, scope: string, entries: SavedPending[]): void {
  try {
    storage.setItem(storageKey(scope), JSON.stringify(entries));
  } catch {
    // A full or blocked store only means a refresh will not remember the list; the generation itself is unaffected.
  }
}

/** Adds what a run just started; an item already remembered keeps its first time. */
export function mergePending(existing: SavedPending[], added: PendingResource[], now: number = Date.now()): SavedPending[] {
  const known = new Set(existing.map((e) => resourceKey(e.resource)));
  const fresh = added.filter((r) => isResource(r) && !known.has(resourceKey(r))).map((resource) => ({ resource, savedAt: now }));
  return fresh.length ? [...existing, ...fresh] : existing;
}

export function removePending(existing: SavedPending[], keys: string[]): SavedPending[] {
  const gone = new Set(keys);
  return existing.filter((e) => !gone.has(resourceKey(e.resource)));
}
