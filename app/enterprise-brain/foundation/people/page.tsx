'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, RefreshCw, Search, AlertTriangle } from 'lucide-react';
import {
  brainFetch,
  fetchTeacherIntelligence,
  tenantPath,
  withQuery,
  type BrainRow,
  type BrainTeacherIntelligence,
} from '@/lib/brain/api';
import { useBrainResource } from '../../_components/useBrainResource';
import { Card, DataTable, ErrorState, LoadingState, MetricTiles, Panel, HeroHeader } from '../../_components/primitives';
import { EvidenceStrip } from '../../_components/IntelligenceCard';

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
  const teacherIntelligence = useBrainResource(fetchTeacherIntelligence, []);
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
      <HeroHeader
        breadcrumb="Enterprise Brain / Foundation"
        title="People"
        description="Everyone recorded in this organization, and whose record is incomplete. Read from the LMS's own users, so there is one people master."
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
                placeholder="Name, email or employee no."
                className="w-56 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500"
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

      <TeachingIntelligenceSection resource={teacherIntelligence} />
    </div>
  );
}

function TeachingIntelligenceSection({
  resource,
}: {
  resource: { data: BrainTeacherIntelligence | null; error: string; loading: boolean; refreshing: boolean; refresh: () => void };
}) {
  const { data, error, loading, refreshing, refresh } = resource;

  if (loading && !data) return null;
  if (error && !data) {
    return (
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold tracking-tight text-slate-800">Teaching intelligence</h2>
        <Card className="border-red-100 bg-red-50/50 p-4 text-sm text-red-700">
          Could not load teaching intelligence: {error}
        </Card>
      </section>
    );
  }
  if (!data) return null;

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-slate-800">Teaching intelligence</h2>
        <Link
          href="/enterprise-brain/intelligence-loop/signals"
          className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
        >
          View Intelligence Loop signals
          <ArrowRight size={13} />
        </Link>
      </div>

      {data.coverage?.note && (
        <Card className="mb-6 border-amber-200/70 bg-amber-50/40 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-semibold text-slate-900">Most teaching cannot be attributed to anyone</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{data.coverage.note}</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                Nothing below is a performance judgement. Until attendance and homework consistently record who entered them,
                the Brain has no basis to compare one teacher with another, and it will not invent one.
              </p>
              <div className="mt-3">
                <EvidenceStrip
                  evidence={[
                    { label: 'Marks attributed', value: data.coverage.attributedMarks.toLocaleString() },
                    { label: 'Marks total', value: data.coverage.totalMarks.toLocaleString() },
                    { label: 'Attribution', value: `${data.coverage.sharePercent}%` },
                  ]}
                />
              </div>
            </div>
          </div>
        </Card>
      )}

      {!data.available ? (
        <Card className="p-8">
          <p className="text-sm text-slate-500">{data.reason}</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {data.teachers.map((teacher) => (
            <Card key={teacher.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-[15px] font-semibold text-slate-900">{teacher.name}</h3>
                  {teacher.email && <p className="truncate text-[11px] text-slate-400">{teacher.email}</p>}
                </div>
                {!teacher.sufficientEvidence && (
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 ring-1 ring-inset ring-slate-200">
                    Too little data
                  </span>
                )}
              </div>

              <p className="mt-2 text-sm leading-relaxed text-slate-600">{teacher.summary}</p>

              {teacher.metrics.length > 0 && (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <EvidenceStrip
                    evidence={teacher.metrics.map((metric) => ({ label: metric.label, value: metric.value }))}
                  />
                </div>
              )}

              {teacher.evidence.length > 0 && (
                <div className="mt-3">
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {teacher.evidence.map((item) => (
                      <span key={item.label} className="text-[11px] text-slate-400">
                        {item.label}: <span className="font-semibold text-slate-600">{item.value}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <div className="mt-5 flex items-center justify-end gap-2 text-xs text-slate-500">
        <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
        <button type="button" onClick={refresh} disabled={refreshing} className="font-semibold text-indigo-600 hover:text-indigo-800">
          Refresh teaching intelligence
        </button>
      </div>
    </section>
  );
}
