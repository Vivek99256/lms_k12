'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, RefreshCw, Search } from 'lucide-react';
import { brainFetch, fetchDepartmentIntelligence, tenantPath, withQuery, type BrainRow, type BrainDepartmentIntelligence } from '@/lib/brain/api';
import { useBrainResource } from '../../_components/useBrainResource';
import { Card, DataTable, ErrorState, LoadingState, MetricTiles, Panel, HeroHeader } from '../../_components/primitives';
import { EvidenceStrip, SeverityChip } from '../../_components/IntelligenceCard';

interface DepartmentsPayload {
  total: number;
  brainProjected: number;
  data: BrainRow[];
}

export default function BrainDepartmentsPage() {
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');
  const deptIntelligence = useBrainResource(fetchDepartmentIntelligence, []);
  const resource = useBrainResource(
    () => brainFetch<DepartmentsPayload>(withQuery(tenantPath('/departments'), { q: applied })),
    [applied],
  );

  if (resource.loading && !resource.data) return <LoadingState label="Loading departments" />;
  if (resource.error && !resource.data) return <ErrorState message={resource.error} onRetry={resource.refresh} />;
  
  const data = resource.data;
  if (!data) return null;

  if (!deptIntelligence.data) return null;

  return (
    <div className="pb-8">
      <HeroHeader
        breadcrumb="Enterprise Brain / Foundation"
        title="Departments"
        description="How the organization is structured, and who leads each unit. These are the LMS's own departments — the Brain reads them rather than keeping a second copy."
        actions={
          <div className="flex items-center gap-2">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setApplied(search.trim());
              }}
              className="flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-3 py-1.5"
            >
              <Search size={14} className="text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search departments"
                className="w-48 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500"
            />
          </form>
          <button
            type="button"
            onClick={resource.refresh}
            disabled={resource.refreshing}
            className="flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-300 transition-colors hover:border-slate-500 hover:text-white disabled:opacity-60"
          >
            <RefreshCw size={14} className={resource.refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
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

      <DepartmentIntelligenceSection resource={deptIntelligence} />
    </div>
  );
}

function DepartmentIntelligenceSection({
  resource,
}: {
  resource: { data: BrainDepartmentIntelligence | null; error: string; loading: boolean; refreshing: boolean; refresh: () => void };
}) {
  const { data, error, loading, refreshing, refresh } = resource;

  if (loading && !data) return null;
  if (error && !data) {
    return (
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold tracking-tight text-slate-800">Department intelligence</h2>
        <Card className="border-red-100 bg-red-50/50 p-4 text-sm text-red-700">
          Could not load department intelligence: {error}
        </Card>
      </section>
    );
  }
  if (!data) return null;

  if (!data.available) {
    return (
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold tracking-tight text-slate-800">Department intelligence</h2>
        <Card className="p-6">
          <p className="text-sm text-slate-500">{data.reason}</p>
        </Card>
      </section>
    );
  }

  const needingAttention = data.departments.filter((d) => d.risks.length > 0);

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-slate-800">Department intelligence</h2>
        <Link
          href="/enterprise-brain/intelligence-loop/signals"
          className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
        >
          View Intelligence Loop signals
          <ArrowRight size={13} />
        </Link>
      </div>

      <p className="mb-4 rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs leading-relaxed text-slate-500">
        {data.note}
      </p>

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          {data.departments.length} departments hold staff. {needingAttention.length} of them have something outstanding.
        </p>
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-300 transition-colors hover:border-slate-500 hover:text-white disabled:opacity-60"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {data.departments.map((item) => {
          const rail =
            item.band === 'Good' ? 'bg-emerald-500'
              : item.band === 'Watch' ? 'bg-amber-400'
                : item.band === 'At risk' ? 'bg-orange-500' : 'bg-rose-500';

          return (
            <Card key={item.id} id={item.id} className="overflow-hidden">
              <div className="flex">
                <div className={`w-1 shrink-0 ${rail}`} aria-hidden />
                <div className="min-w-0 flex-1 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        {item.risks.map((risk) => (
                          <SeverityChip key={risk.label} severity={risk.severity} label={risk.label} />
                        ))}
                      </div>
                      <h3 className="text-[15px] font-semibold text-slate-900">{item.name}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-slate-600">{item.summary}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-2xl font-semibold tabular-nums leading-none text-slate-900">{item.score}</p>
                      <p className="mt-1 text-[11px] text-slate-400">/ 100 · {item.band}</p>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-gray-100 pt-4">
                    <EvidenceStrip
                      evidence={[
                        { label: 'Staff', value: item.headcount.toLocaleString() },
                        { label: 'Head', value: item.head ?? 'None assigned' },
                        { label: 'Written remit', value: item.hasRemit ? 'Yes' : 'No' },
                        { label: 'Never signed in', value: `${item.neverSignedIn} of ${item.headcount}` },
                      ]}
                    />
                  </div>

                  {item.action && (
                    <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2.5 text-sm font-medium leading-relaxed text-slate-800">
                      {item.action}
                    </p>
                  )}

                  <details className="mt-3">
                    <summary className="cursor-pointer text-[11px] font-semibold text-indigo-600 hover:text-indigo-800">
                      How is this score calculated?
                    </summary>
                    <p className="mt-2 rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">{item.formula}</p>
                  </details>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
