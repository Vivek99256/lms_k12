'use client';

/**
 * Small, non-blocking sync-health badge for both Knowledge Graph surfaces
 * (the centralized explorer and every decentralized module tab) — shared so
 * the two read as one feature, same as GraphCanvas/GraphDetailPanel.
 *
 * Polls `GET /api/ai/workspace/graph-sync-status` (MySQL-only on the
 * backend, no Neo4j connection), so it stays responsive even while a heavy
 * drain or backfill is running. Never shows a fabricated percentage — only
 * the real pending/failed counts and a derived status word. A failed fetch
 * (or the endpoint being temporarily unavailable) hides the badge instead of
 * erroring the page it's mounted on; the graph above it works independently
 * either way.
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

import { fetchGraphSyncStatus, type GraphSyncStatus as GraphSyncStatusPayload } from '@/lib/intelligence/workspace';
import { readGraphSession } from './graph-session';

const POLL_MS = 30_000;

const STATUS_COPY: Record<NonNullable<GraphSyncStatusPayload['status']>, { label: string; color: string }> = {
  idle: { label: 'Synced', color: '#2a7251' },
  draining: { label: 'Syncing', color: '#019de8' },
  attention: { label: 'Needs attention', color: '#c0392b' },
};

export default function GraphSyncStatus() {
  const [payload, setPayload] = useState<GraphSyncStatusPayload | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const session = readGraphSession();
    let cancelled = false;

    const poll = () => {
      fetchGraphSyncStatus(session)
        .then((result) => {
          if (!cancelled) {
            setPayload(result);
            setFailed(false);
          }
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });
    };

    poll();
    const interval = setInterval(poll, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (failed || !payload || !payload.available || !payload.status) {
    return null;
  }

  const copy = STATUS_COPY[payload.status];
  const Icon = payload.status === 'attention' ? AlertTriangle : payload.status === 'draining' ? Loader2 : CheckCircle2;

  const parts: string[] = [];
  if ((payload.pending_nodes ?? 0) > 0 || (payload.pending_relationships ?? 0) > 0) {
    parts.push(`${payload.pending_nodes ?? 0} node(s), ${payload.pending_relationships ?? 0} relationship(s) pending`);
  }
  if ((payload.failed_nodes ?? 0) > 0 || (payload.failed_relationships ?? 0) > 0) {
    parts.push(`${payload.failed_nodes ?? 0} node(s), ${payload.failed_relationships ?? 0} relationship(s) failed`);
  }
  if (payload.last_successful_sync_at) {
    parts.push(`last synced ${new Date(payload.last_successful_sync_at).toLocaleString()}`);
  }

  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
      style={{ borderColor: `${copy.color}40`, color: copy.color, backgroundColor: `${copy.color}0d` }}
      title={parts.length > 0 ? parts.join(' | ') : undefined}
    >
      <Icon className={`h-3 w-3 ${payload.status === 'draining' ? 'animate-spin' : ''}`} />
      {copy.label}
    </div>
  );
}
