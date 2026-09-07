'use client';

import { useState } from 'react';
import { brainFetch, tenantPath } from '@/lib/brain/api';
import { useBrainResource } from '../../_components/useBrainResource';
import { BreakdownBars, DataTable, ErrorState, LoadingState, MetricTiles, Panel, ScreenHeader } from '../../_components/primitives';

interface Facet {
  facet: string;
  distinct: number;
  total: number;
  top: Array<{ label: string; count: number }>;
}

interface KasbaPayload {
  tenantId: string;
  capabilityCount: number;
  facets: Facet[];
  capabilities: Array<{
    id: string;
    name: string;
    category: string;
    capability_type: string;
    counts: Record<string, number>;
  }>;
}

export default function KasbaExplorerPage() {
  const resource = useBrainResource(() => brainFetch<KasbaPayload>(tenantPath('/kasba')), []);
  const [facet, setFacet] = useState('knowledge');

  if (resource.loading && !resource.data) return <LoadingState label="Loading KASBA" />;
  if (resource.error && !resource.data) return <ErrorState message={resource.error} onRetry={resource.refresh} />;

  const data = resource.data;
  if (!data) return null;

  const selected = data.facets.find((item) => item.facet === facet) ?? data.facets[0];

  return (
    <div className="pb-8">
      <ScreenHeader
        title="KASBA Explorer"
        description="Knowledge, ability, skill, behaviour and attitude, rolled up across this organization's capabilities."
        breadcrumb="Enterprise Brain / Knowledge"
        onRefresh={resource.refresh}
        refreshing={resource.refreshing}
      />

      <MetricTiles
        metrics={[
          { key: 'capabilities', label: 'Capabilities', value: data.capabilityCount, available: true },
          ...data.facets.map((item) => ({
            key: item.facet,
            label: item.facet.charAt(0).toUpperCase() + item.facet.slice(1),
            value: item.distinct,
            available: true,
            hint: `${item.total.toLocaleString()} references`,
          })),
        ]}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {data.facets.map((item) => (
          <button
            key={item.facet}
            type="button"
            onClick={() => setFacet(item.facet)}
            className={`rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
              selected?.facet === item.facet
                ? 'border-blue-100 bg-blue-50 text-[#0D6EFD]'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900'
            }`}
          >
            {item.facet.charAt(0).toUpperCase() + item.facet.slice(1)} · {item.distinct.toLocaleString()}
          </button>
        ))}
      </div>

      <div className="mb-6">
        <Panel title={`Most common ${selected?.facet ?? ''} items`} count={selected?.top.length ?? 0}>
          <BreakdownBars data={(selected?.top ?? []).map((item) => ({ label: item.label, value: item.count }))} />
        </Panel>
      </div>

      <Panel title="KASBA coverage by capability" table="hpbrain_capabilities" count={data.capabilities.length}>
        <DataTable
          maxHeight="34rem"
          columns={[
            { key: 'name', label: 'Capability' },
            { key: 'category', label: 'Category' },
            { key: 'capability_type', label: 'Type' },
            { key: 'knowledge', label: 'Knowledge' },
            { key: 'ability', label: 'Ability' },
            { key: 'skill', label: 'Skill' },
            { key: 'behaviour', label: 'Behaviour' },
            { key: 'attitude', label: 'Attitude' },
          ]}
          rows={data.capabilities.map((capability) => ({
            id: capability.id,
            name: capability.name,
            category: capability.category,
            capability_type: capability.capability_type,
            ...capability.counts,
          }))}
          emptyMessage="No capabilities projected yet — run Ingestion first."
        />
      </Panel>
    </div>
  );
}
