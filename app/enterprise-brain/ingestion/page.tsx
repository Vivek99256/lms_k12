'use client';

import { useState } from 'react';
import { ArrowRight, Play } from 'lucide-react';
import { brainFetch, tenantPath, type BrainRow } from '@/lib/brain/api';
import { useBrainResource } from '../_components/useBrainResource';
import { Card, DataTable, ErrorState, LoadingState, Panel, Pill, ScreenHeader } from '../_components/primitives';

interface InventoryEntry {
  scope: string;
  label: string;
  source: string;
  sourceCount: number;
  target: string;
  targetCount: number;
}

interface IngestionPayload {
  tenantId: string;
  scopes: string[];
  inventory: InventoryEntry[];
  history: BrainRow[];
}

interface RunResult {
  ran: string[];
  result: Record<string, { written?: number; tasks?: number; available?: boolean; name?: string }>;
  elapsedMs: number;
  inventory: InventoryEntry[];
}

export default function IngestionPage() {
  const resource = useBrainResource(() => brainFetch<IngestionPayload>(tenantPath('/ingestion')), []);
  const [selected, setSelected] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState('');
  const [lastRun, setLastRun] = useState<RunResult | null>(null);

  const inventory = lastRun?.inventory ?? resource.data?.inventory ?? [];
  const scopes = resource.data?.scopes ?? [];
  const chosen = selected.length ? selected : scopes;

  const run = async () => {
    setRunning(true);
    setRunError('');
    try {
      const result = await brainFetch<RunResult>(tenantPath('/ingestion/run'), {
        method: 'POST',
        body: JSON.stringify({ scopes: chosen, limit: 5000 }),
      });
      setLastRun(result);
      resource.refresh();
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Ingestion failed.');
    } finally {
      setRunning(false);
    }
  };

  if (resource.loading && !resource.data) return <LoadingState label="Loading ingestion" />;
  if (resource.error && !resource.data) return <ErrorState message={resource.error} onRetry={resource.refresh} />;
  if (!resource.data) return null;

  return (
    <div className="pb-8">
      <ScreenHeader
        title="Ingestion"
        description="Bring this organization’s LMS records into the Brain store. Nothing is invented: each Brain row is derived from a row this tenant already owns, and re-running updates rather than duplicates."
        breadcrumb="Enterprise Brain / Foundation"
        onRefresh={resource.refresh}
        refreshing={resource.refreshing}
        actions={
          <button
            type="button"
            onClick={run}
            disabled={running}
            className="flex items-center gap-2 rounded-xl bg-[#0D6EFD] px-3 py-2 text-xs font-bold text-white hover:bg-blue-600 disabled:opacity-60"
          >
            <Play size={14} />
            {running ? 'Running…' : selected.length ? `Run ${selected.length} selected` : 'Run all'}
          </button>
        }
      />

      {runError && (
        <div className="mb-4">
          <ErrorState message={runError} onRetry={run} />
        </div>
      )}

      {lastRun && (
        <Card className="mb-6 border-emerald-100 bg-emerald-50/50 p-5">
          <p className="text-sm font-bold text-emerald-700">
            Ingested {lastRun.ran.join(', ')} in {lastRun.elapsedMs.toLocaleString()} ms
          </p>
          <ul className="mt-2 space-y-1 text-sm text-emerald-700">
            {Object.entries(lastRun.result).map(([scope, outcome]) => (
              <li key={scope}>
                {scope}: {outcome.available === false ? 'store not provisioned' : `${(outcome.written ?? 0).toLocaleString()} rows written`}
                {outcome.tasks ? `, ${outcome.tasks.toLocaleString()} tasks` : ''}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        {inventory.map((entry) => {
          const isSelected = selected.includes(entry.scope);
          return (
            <Card
              key={entry.scope}
              className={`cursor-pointer p-5 transition-colors ${isSelected ? 'border-blue-200 bg-blue-50/40' : 'hover:border-gray-300'}`}
              // The whole card toggles: this is a picker, and a small checkbox
              // hit area is the wrong target for a screen whose one action is
              // "choose what to bring in".
            >
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(event) =>
                    setSelected((current) =>
                      event.target.checked ? [...current, entry.scope] : current.filter((scope) => scope !== entry.scope),
                    )
                  }
                  className="mt-1 h-4 w-4 accent-[#0D6EFD]"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">{entry.label}</span>
                    {entry.targetCount > 0 && <Pill tone="green">projected</Pill>}
                  </span>
                  <span className="mt-3 flex items-center gap-3 text-sm">
                    <span className="min-w-0 flex-1 rounded-xl bg-gray-50 px-3 py-2">
                      <span className="block truncate text-[11px] font-bold uppercase tracking-widest text-gray-400">
                        {entry.source}
                      </span>
                      <span className="block text-lg font-semibold tabular-nums text-slate-900">
                        {entry.sourceCount.toLocaleString()}
                      </span>
                    </span>
                    <ArrowRight size={16} className="shrink-0 text-gray-300" />
                    <span className="min-w-0 flex-1 rounded-xl bg-blue-50/60 px-3 py-2">
                      <span className="block truncate text-[11px] font-bold uppercase tracking-widest text-gray-400">
                        {entry.target}
                      </span>
                      <span className="block text-lg font-semibold tabular-nums text-[#0D6EFD]">
                        {entry.targetCount.toLocaleString()}
                      </span>
                    </span>
                  </span>
                </span>
              </label>
            </Card>
          );
        })}
      </div>

      <Panel title="Ingestion history" table="hpbrain_audit_logs" count={resource.data.history.length}>
        <DataTable
          columns={[
            { key: 'created_at', label: 'When' },
            { key: 'actor_id', label: 'Run by' },
            { key: 'changes', label: 'Result' },
          ]}
          rows={resource.data.history}
          emptyMessage="This organization has not been ingested yet."
        />
      </Panel>
    </div>
  );
}
