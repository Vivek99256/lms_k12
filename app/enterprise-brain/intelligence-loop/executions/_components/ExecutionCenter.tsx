'use client';

import React, { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import {
  fetchExecutionCenter,
  fetchExecutionRecord,
  linkExecutionEvidence,
  type BrainExecutionCenterPayload,
} from '@/lib/brain/api';
import { AllWidgetsHiddenNotice, CustomizeDashboard } from '@/app/dashboard/_components/CustomizeDashboard';
import { useDashboardPreferences } from '@/app/dashboard/_lib/useDashboardPreferences';
import { toWidgetId, type DashboardWidget } from '@/app/dashboard/_lib/dashboard-preferences';
import { useBrainResource } from '../../../_components/useBrainResource';
import { ErrorState, LoadingState, ScreenHeader } from '../../../_components/primitives';
import {
  ExecutionCenterView,
  ExecutionDetail,
  type ExecutionFilters,
  type ExecutionSection,
} from './ExecutionCenterView';

/**
 * Intelligence Loop -> Execution Center.
 *
 * Same route and same data tables as before; the screen now leads with health, verification,
 * attention and impact, and keeps the technical record as the history section.
 *
 * Widget ids are stored per user under the same screen key the generic screen used, so a person's
 * saved layout for this screen is not discarded; the sections are new ids.
 */

const SECTIONS: Array<{ key: ExecutionSection; label: string }> = [
  { key: 'health', label: 'Execution health' },
  { key: 'verification', label: 'Evidence and outcome verification' },
  { key: 'attention', label: 'Actions needing attention' },
  { key: 'impact', label: 'Outcome impact' },
  { key: 'history', label: 'Execution history' },
];

const WIDGETS: DashboardWidget[] = SECTIONS.map((s) => ({ id: toWidgetId('panel', `execution-center-${s.key}`), label: s.label, group: 'panel' as const }));

export default function ExecutionCenter() {
  const [filters, setFilters] = useState<ExecutionFilters>({ status: 'all', sample: 'all', q: '', page: 1 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState('');

  const resource = useBrainResource(
    () => fetchExecutionCenter({ status: filters.status, sample: filters.sample, q: filters.q, page: filters.page }),
    [filters.status, filters.sample, filters.q, filters.page],
  );
  const detail = useBrainResource(() => (selectedId ? fetchExecutionRecord(selectedId) : Promise.resolve(null)), [selectedId]);
  const prefs = useDashboardPreferences(toWidgetId('brain', 'executions'), WIDGETS);

  // Keep the last payload on screen while a filter or page change loads the next one, so searching
  // does not blank the whole page. (Adjusting state during render is the supported pattern for this.)
  const [kept, setKept] = useState<BrainExecutionCenterPayload | null>(null);
  if (resource.data && resource.data !== kept) setKept(resource.data);
  const data = resource.data ?? kept;

  const show = useMemo(() => (section: ExecutionSection) => prefs.isVisible(toWidgetId('panel', `execution-center-${section}`)), [prefs]);

  if ((resource.loading && !data) || !prefs.ready) {
    return <div className="p-1"><LoadingState label="Loading the Execution Center" /></div>;
  }
  if (resource.error && !data) {
    return <div className="p-1"><ErrorState message={resource.error} onRetry={resource.refresh} /></div>;
  }
  if (!data) return null;

  const onLinkEvidence = async (executionId: string, evidenceIds: string[]) => {
    setLinking(true);
    setLinkError('');
    try {
      await linkExecutionEvidence(executionId, evidenceIds);
      detail.refresh();
      resource.refresh();
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : 'The evidence could not be linked.');
    } finally {
      setLinking(false);
    }
  };

  return (
    <div className="pb-8">
      <ScreenHeader
        breadcrumb="Enterprise Brain / Intelligence Loop"
        title="Execution Center"
        description="What was done about approved decisions, what changed, what evidence proves it, and what still needs attention."
        onRefresh={resource.refresh}
        refreshing={resource.refreshing || (resource.loading && !!kept)}
        actions={<CustomizeDashboard widgets={WIDGETS} {...prefs.customizeProps} />}
      />

      <p className="-mt-3 mb-5 flex items-center gap-1.5 text-[11px] text-slate-400">
        <RefreshCw size={11} />
        Read from the Brain at {new Date(data.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        {resource.loading && kept ? ' · updating…' : ''}
      </p>

      {resource.error ? <div className="mb-4"><ErrorState message={resource.error} onRetry={resource.refresh} /></div> : null}
      {!prefs.hasVisible() && <AllWidgetsHiddenNotice />}

      <ExecutionCenterView
        data={data}
        filters={filters}
        onFilters={(patch) => setFilters((f) => ({ ...f, ...patch }))}
        onSelect={(id) => {
          setLinkError('');
          setSelectedId(id);
        }}
        show={show}
      />

      {selectedId ? (
        <ExecutionDetail
          detail={{ record: detail.data, loading: detail.loading, error: detail.error }}
          onClose={() => setSelectedId(null)}
          onLinkEvidence={onLinkEvidence}
          linking={linking}
          linkError={linkError}
        />
      ) : null}
    </div>
  );
}
