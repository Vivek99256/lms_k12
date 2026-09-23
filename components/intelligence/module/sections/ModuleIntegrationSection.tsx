'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Database,
  ExternalLink,
  Layers,
  Loader2,
  Network,
  RefreshCw,
} from 'lucide-react';

import { brainFetch, tenantPath } from '@/lib/brain/api';
import type { ModuleIntegrationsResponse, ModuleIntegrationItem, SectionCopy } from '../contract';
import { Surface, Unavailable } from '../primitives';

export function ModuleIntegrationSection({
  module,
  copy,
}: {
  module: string;
  copy?: SectionCopy;
}) {
  const router = useRouter();
  const [data, setData] = useState<ModuleIntegrationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await brainFetch<ModuleIntegrationsResponse | { data: ModuleIntegrationsResponse }>(
        tenantPath(`/${module}/integration`)
      );
      const payload = 'data' in response ? response.data : response;
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load module integrations.');
    } finally {
      setLoading(false);
    }
  }, [module]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading && !data) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-10 text-[13px] text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin text-[color:var(--intel-accent)]" />
        Reading cross-module relationship data and tenant integrity records…
      </div>
    );
  }

  if (error && !data) {
    return (
      <Surface className="space-y-3 px-4 py-4">
        <div className="flex items-start gap-2 text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <div>
            <p className="text-[13px] font-semibold">Failed to verify module integration</p>
            <p className="mt-0.5 text-[12.5px] text-slate-600">{error}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={loadData}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry verification
        </button>
      </Surface>
    );
  }

  if (!data || data.integrations.length === 0) {
    return (
      <Unavailable
        title="No cross-module integrations declared"
        reason={`There are currently no multi-module integration relationships configured for ${data?.module_label ?? module}.`}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Summary Bar */}
      <Surface className="relative overflow-hidden p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--intel-accent)]">
              <Network className="h-3.5 w-3.5" />
              {copy?.eyebrow ?? 'Ecosystem'}
            </span>
            <h2 className="mt-1 text-[20px] font-bold tracking-tight text-slate-950">
              {copy?.title ?? 'Module Integration'}
            </h2>
            <p className="mt-1 text-[13px] leading-5 text-slate-600">
              {copy?.description ??
                'Real cross-module data relationships, shared entity metrics, and verified database connections for this module.'}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-2 text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Connected</p>
              <p className="text-[16px] font-bold text-slate-900">
                {data.summary.active_connections} <span className="text-[12px] font-normal text-slate-500">/ {data.summary.total_integrations}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={loadData}
              title="Refresh connection telemetry"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="mt-4 border-t border-slate-100 pt-3 text-[12px] text-slate-500">
          <span className="font-medium text-slate-700">{data.summary.headline}</span>
          {data.academic_year ? ` · Academic year ${data.academic_year}` : ''}
        </div>
      </Surface>

      {/* Integration Cards Grid */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {data.integrations.map((item) => (
          <IntegrationCard key={item.id} item={item} onNavigate={(path) => router.push(path)} />
        ))}
      </div>
    </div>
  );
}

function IntegrationCard({
  item,
  onNavigate,
}: {
  item: ModuleIntegrationItem;
  onNavigate: (route: string) => void;
}) {
  const isAvailable = item.status === 'available';

  return (
    <Surface className="flex flex-col justify-between overflow-hidden border border-slate-200/90 p-5">
      <div>
        {/* Top Badges */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-700">
            <Layers className="h-3 w-3 text-slate-500" />
            {item.target_label}
          </div>

          {isAvailable ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              Verified & Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
              <AlertCircle className="h-3 w-3 text-amber-600" />
              No Data Found
            </span>
          )}
        </div>

        {/* Relationship Title */}
        <h3 className="mt-3 text-[15.5px] font-bold text-slate-900">{item.relationship}</h3>

        {/* Why It Matters */}
        <p className="mt-1.5 text-[13px] leading-5 text-slate-600">{item.why_it_matters}</p>

        {/* Live Metrics Grid */}
        {isAvailable && item.metrics.length > 0 ? (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {item.metrics.map((metric, idx) => (
              <div key={idx} className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5">
                <p className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">{metric.label}</p>
                <p className="mt-0.5 text-[14px] font-bold tabular-nums text-slate-900">{metric.value}</p>
              </div>
            ))}
          </div>
        ) : null}

        {/* Unavailable Reason Notice */}
        {!isAvailable && item.reason ? (
          <div className="mt-3.5 rounded-lg border border-slate-200/80 bg-slate-50 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-slate-600">
            <span className="font-semibold text-slate-700">Reason: </span>
            {item.reason}
          </div>
        ) : null}

        {/* Shared Entities */}
        {item.shared_entities.length > 0 ? (
          <div className="mt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Shared Data Entities
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {item.shared_entities.map((entity) => (
                <span
                  key={entity}
                  className="inline-flex items-center gap-1 rounded bg-slate-100/90 px-2 py-0.5 font-mono text-[11px] font-medium text-slate-600"
                >
                  <Database className="h-2.5 w-2.5 text-slate-400" />
                  {entity}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Drill-down Footer */}
      {item.route && item.route !== '#' ? (
        <div className="mt-5 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => onNavigate(item.route)}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[color:var(--intel-accent)] transition hover:underline"
          >
            <span>Open {item.target_label}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
    </Surface>
  );
}

