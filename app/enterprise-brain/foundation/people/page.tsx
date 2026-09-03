'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { brainFetch, tenantPath, withQuery, type BrainRow } from '@/lib/brain/api';
import { useBrainResource } from '../../_components/useBrainResource';
import { Card, DataTable, ErrorState, LoadingState, MetricTiles, Panel, ScreenHeader } from '../../_components/primitives';

interface PeoplePayload {
  total: number;
  incomplete: number;
  brainProjected: number;
  available: boolean;
  data: BrainRow[];
}

export default function BrainPeoplePage() {
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');
  const resource = useBrainResource(
    () => brainFetch<PeoplePayload>(withQuery(tenantPath('/people'), { q: applied })),
    [applied],
  );

  if (resource.loading && !resource.data) return <LoadingState label="Loading people" />;
  if (resource.error && !resource.data) return <ErrorState message={resource.error} onRetry={resource.refresh} />;

  const data = resource.data;
  if (!data) return null;

  return (
    <div className="pb-8">
      <ScreenHeader
        title="People"
        description="Everyone recorded in this organization, and whose record is incomplete. Read from the LMS's own users, so there is one people master."
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
              placeholder="Name, email or employee no."
              className="w-56 bg-transparent text-sm outline-none placeholder:text-gray-400"
            />
          </form>
        }
      />

      <MetricTiles
        metrics={[
          { key: 'total', label: 'People (LMS)', value: data.total, available: true },
          { key: 'projected', label: 'Projected into Brain', value: data.brainProjected, available: true },
          { key: 'incomplete', label: 'Incomplete records', value: data.incomplete, available: true, hint: 'shown page' },
          { key: 'shown', label: 'Shown', value: data.data.length, available: true },
        ]}
      />

      {data.incomplete > 0 && (
        <Card className="mb-4 border-amber-100 bg-amber-50/60 p-4 text-sm text-amber-700">
          {data.incomplete.toLocaleString()} of the people shown are missing an email, a mobile number or a department. The
          Brain treats those records as lower confidence when it reasons about this organization.
        </Card>
      )}

      <Panel title="People" table="tbluser" count={data.total} available={data.available}>
        <DataTable
          maxHeight="34rem"
          columns={[
            { key: 'employee_no', label: 'Employee no.' },
            { key: 'first_name', label: 'First name' },
            { key: 'last_name', label: 'Last name' },
            { key: 'email', label: 'Email' },
            { key: 'mobile', label: 'Mobile' },
            { key: 'department_name', label: 'Department' },
            { key: 'occupation', label: 'Designation' },
            { key: 'record_complete', label: 'Complete' },
          ]}
          rows={data.data}
          emptyMessage="No people recorded for this organization."
        />
      </Panel>
    </div>
  );
}
