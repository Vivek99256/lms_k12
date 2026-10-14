'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  approveULU,
  fetchULUList,
  type V4UluListItem,
} from '@/app/pal/data/pal-v4';

/**
 * ULU management — approve/review Unified Learning Units.
 *
 * Added 2026-10-10. The existing `/pal/ulu` and `/pal/ulu/[slug]` routes
 * render `PalTaxonomyParentPage`/`PalTaxonomyDetailPage`, a READ-ONLY
 * taxonomy explainer built from the chapter's content model — a different,
 * already-working feature this page does not touch or replace.
 *
 * The actual ULU CRUD/approval API client (`fetchULUList`, `createULU`,
 * `updateULU`, `approveULU`, ... in `app/pal/data/pal-v4.ts`) already existed
 * and already talks to a fully-wired backend (`POST/PUT /api/pal/ulu/...` ->
 * `PALAPIController` -> `ULUService` -> `ULUGraphService`, which syncs the
 * approved unit into the Neo4j PAL graph on every `approve()` call) — but
 * nothing in this frontend imported it. This page is the minimal wiring: a
 * list of ULUs with an Approve action, so that already-correct client code
 * and the already-correct backend graph sync actually get exercised from the
 * UI instead of sitting unused.
 */
export default function UluManagePage() {
  const [items, setItems] = useState<V4UluListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchULUList({ perPage: 50 });
      setItems(response.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load learning units.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleApprove = useCallback(
    async (id: number) => {
      setApprovingId(id);
      setError(null);
      try {
        await approveULU(id);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to approve learning unit.');
      } finally {
        setApprovingId(null);
      }
    },
    [load]
  );

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold">Learning unit management</h1>
        <p className="text-sm text-muted-foreground">
          Review and approve Unified Learning Units (ULUs). Approving a unit syncs it into
          the PAL knowledge graph immediately.
        </p>
      </div>

      {error ? (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="mb-4">
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading learning units…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No learning units found.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-2">ULU</th>
                <th className="p-2">Title</th>
                <th className="p-2">Grade</th>
                <th className="p-2">Subject</th>
                <th className="p-2">Status</th>
                <th className="p-2">Updated</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="p-2 font-mono text-xs">{item.uluId}</td>
                  <td className="p-2">{item.title}</td>
                  <td className="p-2">{item.grade}</td>
                  <td className="p-2">{item.subject}</td>
                  <td className="p-2 capitalize">{item.status}</td>
                  <td className="p-2 text-xs text-muted-foreground">{item.updatedAt}</td>
                  <td className="p-2">
                    {item.status !== 'approved' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={approvingId === item.id}
                        onClick={() => void handleApprove(item.id)}
                      >
                        {approvingId === item.id ? 'Approving…' : 'Approve'}
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Approved</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
