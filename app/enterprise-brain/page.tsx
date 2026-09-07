'use client';

import Link from 'next/link';
import { ArrowRight, Building2 } from 'lucide-react';
import { brainFetch, tenantPath, type BrainRow } from '@/lib/brain/api';
import { BRAIN_SECTIONS } from '@/lib/brain/navigation';
import { useBrainResource } from './_components/useBrainResource';
import { Card, DataTable, ErrorState, LoadingState, MetricTiles, Panel, ScreenHeader } from './_components/primitives';

interface LoopStage {
  key: string;
  label: string;
  count: number;
  available: boolean;
}

interface Overview {
  tenantId: string;
  organization: { name: string; orgCode: string; projected: boolean; detail: BrainRow | null };
  foundation: Record<string, number>;
  brain: Record<string, number>;
  loop: LoopStage[];
  capabilityCategories: Array<{ label: string; value: number }>;
  recentActivity: BrainRow[];
}

const FOUNDATION_LABELS: Record<string, string> = {
  departments: 'Departments',
  people: 'People',
  students: 'Students',
  skills: 'Skill records',
  competencies: 'Competencies',
};

export default function EnterpriseBrainOverviewPage() {
  const resource = useBrainResource(() => brainFetch<Overview>(tenantPath('/overview')), []);

  if (resource.loading && !resource.data) return <LoadingState label="Loading Enterprise Brain" />;
  if (resource.error && !resource.data) return <ErrorState message={resource.error} onRetry={resource.refresh} />;

  const data = resource.data;
  if (!data) return null;

  const foundationMetrics = Object.entries(data.foundation).map(([key, value]) => ({
    key,
    label: FOUNDATION_LABELS[key] ?? key,
    value,
    available: true,
    hint: 'from the LMS',
  }));

  const totalProjected = Object.values(data.brain).reduce((sum, value) => sum + value, 0);

  return (
    <div className="pb-8">
      <ScreenHeader
        title={data.organization.name}
        description="What this organization contains, and how far its data has travelled through the intelligence loop."
        breadcrumb="Enterprise Brain / Overview"
        onRefresh={resource.refresh}
        refreshing={resource.refreshing}
        actions={
          <Link
            href="/enterprise-brain/ingestion"
            className="rounded-xl bg-[#0D6EFD] px-3 py-2 text-xs font-bold text-white hover:bg-blue-600"
          >
            Ingestion
          </Link>
        }
      />

      <Card className="mb-6 flex flex-wrap items-center gap-4 p-5">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-[#0D6EFD]">
          <Building2 size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Organization</p>
          <p className="truncate text-base font-semibold text-slate-900">{data.organization.name}</p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Org code</p>
          <p className="font-mono text-sm text-slate-700">{data.organization.orgCode}</p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Tenant</p>
          <p className="font-mono text-sm text-slate-700">{data.tenantId}</p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Brain records</p>
          <p className="text-sm font-semibold tabular-nums text-slate-900">{totalProjected.toLocaleString()}</p>
        </div>
      </Card>

      <h2 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">LMS foundation</h2>
      <MetricTiles metrics={foundationMetrics} />

      <h2 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">Intelligence loop</h2>
      <Card className="mb-6 overflow-x-auto p-5">
        <div className="flex min-w-max items-stretch gap-2">
          {data.loop.map((stage, index) => (
            <div key={stage.key} className="flex items-center gap-2">
              <div
                className={`w-36 rounded-2xl border px-4 py-3 ${
                  stage.count > 0 ? 'border-blue-100 bg-blue-50/60' : 'border-gray-200 bg-gray-50/60'
                }`}
              >
                <p className="truncate text-[11px] font-bold uppercase tracking-widest text-gray-400">{stage.label}</p>
                <p className={`text-xl font-semibold tabular-nums ${stage.count > 0 ? 'text-[#0D6EFD]' : 'text-slate-300'}`}>
                  {stage.available ? stage.count.toLocaleString() : '—'}
                </p>
              </div>
              {index < data.loop.length - 1 && <ArrowRight size={16} className="shrink-0 text-gray-300" />}
            </div>
          ))}
        </div>
      </Card>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Brain store" count={totalProjected}>
          <div className="divide-y divide-gray-100">
            {Object.entries(data.brain).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-slate-600">{key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}</span>
                <span className="font-semibold tabular-nums text-slate-900">{value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Capabilities by category" count={data.capabilityCategories.length}>
          {data.capabilityCategories.length ? (
            <div className="divide-y divide-gray-100">
              {data.capabilityCategories.map((item) => (
                <div key={item.label} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="truncate text-slate-600">{item.label}</span>
                  <span className="font-semibold tabular-nums text-slate-900">{item.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-4 py-6 text-sm text-slate-400">
              No capabilities projected yet — run Ingestion to bring this organization’s skills and competencies in.
            </p>
          )}
        </Panel>
      </div>

      <div className="mb-6">
        <Panel title="Recent Brain activity" table="hpbrain_audit_logs" count={data.recentActivity.length}>
          <DataTable
            columns={[
              { key: 'action', label: 'Action' },
              { key: 'entity_type', label: 'Entity' },
              { key: 'entity_id', label: 'Id' },
              { key: 'actor_id', label: 'Actor' },
              { key: 'created_at', label: 'When' },
            ]}
            rows={data.recentActivity}
            emptyMessage="Nothing has been done in the Brain for this organization yet."
          />
        </Panel>
      </div>

      <h2 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">Sections</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {BRAIN_SECTIONS.filter((section) => section.key !== 'overview').map((section) => {
          const Icon = section.icon;
          return (
            <Link key={section.key} href={section.href} className="group">
              <Card className="h-full p-5 transition-colors group-hover:border-blue-200 group-hover:bg-blue-50/30">
                <div className="mb-2 flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#0D6EFD]">
                    <Icon size={18} />
                  </span>
                  <h3 className="flex-1 text-sm font-bold text-slate-900">{section.label}</h3>
                  <ArrowRight size={16} className="text-gray-300 group-hover:text-[#0D6EFD]" />
                </div>
                <p className="text-sm text-slate-500">{section.description}</p>
                <p className="mt-3 text-[11px] font-semibold text-gray-400">
                  {section.screens.length} screen{section.screens.length === 1 ? '' : 's'}
                </p>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
