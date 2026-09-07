'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { brainFetch, tenantPath, withQuery, type BrainRow } from '@/lib/brain/api';
import { useBrainResource } from '../../_components/useBrainResource';
import { Card, DataTable, ErrorState, LoadingState, MetricTiles, Panel, ScreenHeader } from '../../_components/primitives';

interface DepartmentsPayload {
  total: number;
  brainProjected: number;
  data: BrainRow[];
}

export default function BrainDepartmentsPage() {
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');
  const resource = useBrainResource(
    () => brainFetch<DepartmentsPayload>(withQuery(tenantPath('/departments'), { q: applied })),
    [applied],
  );

  if (resource.loading && !resource.data) return <LoadingState label="Loading departments" />;
  if (resource.error && !resource.data) return <ErrorState message={resource.error} onRetry={resource.refresh} />;

  const data = resource.data;
  if (!data) return null;

  return (
    <div className="pb-8">
      <ScreenHeader
        title="Departments"
        description="How the organization is structured, and who leads each unit. These are the LMS's own departments — the Brain reads them rather than keeping a second copy."
        breadcrumb="Enterprise Brain / Foundation"
        onRefresh={resource.refresh}
        refreshing={resource.refreshing}
        actions={
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setApplied(search.trim());
            }}
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-1.5"
          >
            <Search size={14} className="text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search departments"
              className="w-48 bg-transparent text-sm outline-none placeholder:text-gray-400"
            />
          </form>
        }
      />

      <MetricTiles
        metrics={[
          { key: 'total', label: 'Departments (LMS)', value: data.total, available: true },
          { key: 'projected', label: 'Projected into Brain', value: data.brainProjected, available: true },
          { key: 'shown', label: 'Shown', value: data.data.length, available: true },
        ]}
      />

      {data.brainProjected === 0 && (
        <Card className="mb-4 border-amber-100 bg-amber-50/60 p-4 text-sm text-amber-700">
          None of these departments have been projected into the Brain store yet. Run Ingestion to make them available to
          capability assignment and the intelligence loop.
        </Card>
      )}

      <Panel title="Departments" table="hrms_departments" count={data.total} available>
        <DataTable
          maxHeight="34rem"
          columns={[
            { key: 'id', label: 'Id' },
            { key: 'department', label: 'Department' },
            { key: 'code', label: 'Code' },
            { key: 'head_name', label: 'Head' },
            { key: 'staff_count', label: 'Staff' },
            { key: 'parent_id', label: 'Parent' },
            { key: 'status', label: 'Status' },
          ]}
          rows={data.data}
          emptyMessage="No departments recorded for this organization."
        />
      </Panel>
    </div>
  );
}
