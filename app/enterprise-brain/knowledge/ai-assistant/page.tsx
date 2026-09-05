'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { brainFetch, tenantPath, withQuery, type BrainMetric, type BrainRow } from '@/lib/brain/api';
import { useBrainResource } from '../../_components/useBrainResource';
import { Card, DataTable, ErrorState, LoadingState, MetricTiles, Panel, Pill, ScreenHeader } from '../../_components/primitives';

interface AssistantPayload {
  tenantId: string;
  metrics: BrainMetric[];
  sessions: BrainRow[];
  executions: BrainRow[];
  templates: BrainRow[];
  notifications: BrainRow[];
}

interface SearchHit {
  type: string;
  id: string;
  label: string;
  record: BrainRow;
}

export default function AiAssistantPage() {
  const resource = useBrainResource(() => brainFetch<AssistantPayload>(tenantPath('/ai-assistant')), []);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  const runSearch = async () => {
    const term = query.trim();
    if (!term) {
      setHits(null);
      return;
    }
    setSearching(true);
    setSearchError('');
    try {
      const result = await brainFetch<{ data: SearchHit[] }>(withQuery(tenantPath('/search'), { q: term }));
      setHits(result.data ?? []);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed.');
    } finally {
      setSearching(false);
    }
  };

  if (resource.loading && !resource.data) return <LoadingState label="Loading AI Assistant" />;
  if (resource.error && !resource.data) return <ErrorState message={resource.error} onRetry={resource.refresh} />;

  const data = resource.data;
  if (!data) return null;

  return (
    <div className="pb-8">
      <ScreenHeader
        title="AI Assistant"
        description="Context-scoped search across this organization, plus the conversation and AI operation history the Brain has recorded."
        breadcrumb="Enterprise Brain / Knowledge"
        onRefresh={resource.refresh}
        refreshing={resource.refreshing}
      />

      <MetricTiles metrics={data.metrics} />

      <Card className="mb-6 p-5">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void runSearch();
          }}
          className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2"
        >
          <Search size={16} className="text-gray-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search capabilities, knowledge assets, ESOs, people and departments"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
          />
          <button
            type="submit"
            disabled={searching}
            className="rounded-lg bg-[#0D6EFD] px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-600 disabled:opacity-60"
          >
            {searching ? 'Searching…' : 'Search'}
          </button>
        </form>

        {searchError && <p className="mt-3 text-sm text-red-600">{searchError}</p>}

        {hits !== null && (
          <div className="mt-4">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">
              {hits.length} result{hits.length === 1 ? '' : 's'}
            </p>
            {hits.length ? (
              <ul className="max-h-72 divide-y divide-gray-100 overflow-auto scrollbar-hide">
                {hits.map((hit, index) => (
                  <li key={`${hit.type}-${hit.id}-${index}`} className="flex items-center gap-3 py-2.5 text-sm">
                    <Pill tone="blue">{hit.type}</Pill>
                    <span className="min-w-0 flex-1 truncate text-slate-700">{hit.label || hit.id}</span>
                    <span className="font-mono text-[11px] text-slate-400">{hit.id}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">Nothing in this organization matches that term.</p>
            )}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Conversations" table="hpbrain_conversation_sessions" count={data.sessions.length}>
          <DataTable
            columns={[
              { key: 'title', label: 'Session' },
              { key: 'context_type', label: 'Context' },
              { key: 'created_date', label: 'Started' },
            ]}
            rows={data.sessions}
            emptyMessage="No conversations recorded for this organization."
          />
        </Panel>

        <Panel title="AI execution history" table="hpbrain_ai_executions" count={data.executions.length}>
          <DataTable
            columns={[
              { key: 'service_name', label: 'Service' },
              { key: 'model', label: 'Model' },
              { key: 'status', label: 'Status' },
              { key: 'latency_ms', label: 'Latency' },
              { key: 'created_date', label: 'Ran' },
            ]}
            rows={data.executions}
            emptyMessage="No AI operations have run for this organization."
          />
        </Panel>

        <Panel title="Prompt templates" table="hpbrain_prompt_templates" count={data.templates.length}>
          <DataTable
            columns={[
              { key: 'name', label: 'Template' },
              { key: 'category', label: 'Category' },
              { key: 'default_model', label: 'Model' },
              { key: 'status', label: 'Status' },
            ]}
            rows={data.templates}
            emptyMessage="No prompt templates configured."
          />
        </Panel>

        <Panel title="Your notifications" table="hpbrain_notifications" count={data.notifications.length}>
          <DataTable
            columns={[
              { key: 'title', label: 'Title' },
              { key: 'type', label: 'Type' },
              { key: 'created_date', label: 'When' },
            ]}
            rows={data.notifications}
            emptyMessage="No notifications for you."
          />
        </Panel>
      </div>
    </div>
  );
}
