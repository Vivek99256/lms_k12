'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, X } from 'lucide-react';
import { brainFetch, tenantPath, withQuery, type BrainRow } from '@/lib/brain/api';
import { useBrainResource } from '../_components/useBrainResource';
import { Card, DataTable, ErrorState, LoadingState, MetricTiles, Panel, Pill, ScreenHeader } from '../_components/primitives';

interface CapabilityList {
  total: number;
  returned: number;
  categories: Array<{ label: string; value: number }>;
  statuses: Array<{ label: string; value: number }>;
  types: Array<{ label: string; value: number }>;
  summary: Record<string, number>;
  data: BrainRow[];
}

const COLUMNS = [
  { key: 'capability_code', label: 'Code' },
  { key: 'name', label: 'Capability' },
  { key: 'category', label: 'Category' },
  { key: 'capability_type', label: 'Type' },
  { key: 'criticality', label: 'Criticality' },
  { key: 'assignments_count', label: 'Assigned' },
  { key: 'assessments_count', label: 'Assessed' },
  { key: 'tasks_count', label: 'Tasks' },
  { key: 'status', label: 'Status' },
];

export default function CapabilitiesPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ q: '', category: '', status: '', type: '' });
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', capability_code: '', category: '', capability_type: 'organizational', description: '' });
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);

  const resource = useBrainResource(
    () => brainFetch<CapabilityList>(withQuery(tenantPath('/capabilities'), filters)),
    [filters.q, filters.category, filters.status, filters.type],
  );

  const create = async () => {
    if (!form.name.trim()) {
      setSaveError('A capability needs a name.');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      await brainFetch(tenantPath('/capabilities'), { method: 'POST', body: JSON.stringify(form) });
      setForm({ name: '', capability_code: '', category: '', capability_type: 'organizational', description: '' });
      setCreating(false);
      resource.refresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not create the capability.');
    } finally {
      setSaving(false);
    }
  };

  if (resource.loading && !resource.data) return <LoadingState label="Loading capabilities" />;
  if (resource.error && !resource.data) return <ErrorState message={resource.error} onRetry={resource.refresh} />;

  const data = resource.data;
  if (!data) return null;

  return (
    <div className="pb-8">
      <ScreenHeader
        title="Capabilities"
        description="What people need to be able to do, and who is assigned to each. Sourced from this organization’s own skill and competency records."
        breadcrumb="Enterprise Brain / Foundation"
        onRefresh={resource.refresh}
        refreshing={resource.refreshing}
        actions={
          <button
            type="button"
            onClick={() => setCreating((open) => !open)}
            className="flex items-center gap-2 rounded-xl bg-[#0D6EFD] px-3 py-2 text-xs font-bold text-white hover:bg-blue-600"
          >
            {creating ? <X size={14} /> : <Plus size={14} />}
            {creating ? 'Cancel' : 'New capability'}
          </button>
        }
      />

      <MetricTiles
        metrics={[
          { key: 'capabilities', label: 'Capabilities', value: data.summary.capabilities ?? 0, available: true },
          { key: 'assignments', label: 'Assignments', value: data.summary.assignments ?? 0, available: true },
          { key: 'assessments', label: 'Assessments', value: data.summary.assessments ?? 0, available: true },
          { key: 'tasks', label: 'Tasks', value: data.summary.tasks ?? 0, available: true },
          { key: 'matching', label: 'Matching filter', value: data.total, available: true },
        ]}
      />

      {creating && (
        <Card className="mb-6 p-5">
          <h2 className="mb-4 text-sm font-bold text-slate-900">New capability</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {([
              ['name', 'Name'],
              ['capability_code', 'Code (optional)'],
              ['category', 'Category'],
              ['capability_type', 'Type'],
            ] as const).map(([field, label]) => (
              <label key={field} className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-gray-400">{label}</span>
                <input
                  value={form[field]}
                  onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#0D6EFD]"
                />
              </label>
            ))}
            <label className="block md:col-span-2">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-gray-400">Description</span>
              <textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                rows={2}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#0D6EFD]"
              />
            </label>
          </div>
          {saveError && <p className="mt-3 text-sm text-red-600">{saveError}</p>}
          <button
            type="button"
            onClick={create}
            disabled={saving}
            className="mt-4 rounded-xl bg-[#0D6EFD] px-4 py-2 text-xs font-bold text-white hover:bg-blue-600 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Create capability'}
          </button>
        </Card>
      )}

      <Card className="mb-4 flex flex-wrap items-center gap-3 p-4">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setFilters((current) => ({ ...current, q: search.trim() }));
          }}
          className="flex flex-1 items-center gap-2 rounded-xl border border-gray-200 px-3 py-2"
        >
          <Search size={15} className="text-gray-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, code or category"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
          />
        </form>

        <select
          value={filters.category}
          onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none"
        >
          <option value="">All categories</option>
          {data.categories.map((item) => (
            <option key={item.label} value={item.label}>
              {item.label} ({item.value})
            </option>
          ))}
        </select>

        <select
          value={filters.type}
          onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none"
        >
          <option value="">All types</option>
          {data.types.map((item) => (
            <option key={item.label} value={item.label}>
              {item.label} ({item.value})
            </option>
          ))}
        </select>

        <select
          value={filters.status}
          onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none"
        >
          <option value="">All statuses</option>
          {data.statuses.map((item) => (
            <option key={item.label} value={item.label}>
              {item.label} ({item.value})
            </option>
          ))}
        </select>

        {(filters.q || filters.category || filters.status || filters.type) && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setFilters({ q: '', category: '', status: '', type: '' });
            }}
            className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 hover:text-gray-900"
          >
            Clear
          </button>
        )}
      </Card>

      <Panel
        title="Capability library"
        table="hpbrain_capabilities"
        count={data.total}
        available
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2 text-[11px] text-gray-400">
          <span>Showing {data.returned.toLocaleString()} of {data.total.toLocaleString()}</span>
          <Pill tone="blue">Click a row for detail, assignments and KASBA</Pill>
        </div>
        <DataTable
          columns={COLUMNS}
          rows={data.data}
          maxHeight="34rem"
          emptyMessage="No capabilities match this filter. If the library is empty, run Ingestion to project this organization’s skills and competencies."
          onRowClick={(row) => router.push(`/enterprise-brain/capabilities/${row.id}`)}
        />
      </Panel>
    </div>
  );
}
