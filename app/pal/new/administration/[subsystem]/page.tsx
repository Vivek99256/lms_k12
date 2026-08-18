'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Layers, TriangleAlert } from 'lucide-react';

import {
  Hero,
  HeroChip,
  PageShell,
  StatusPanel,
  SUBSYSTEM_ICONS,
} from '@/app/pal/new/_components/AdministrationChrome';
import {
  GraphSchemaPanel,
  LivePanel,
  MatrixPanel,
  MetricsPanel,
  ParamsPanel,
  RecordsPanel,
  VocabularyPanel,
} from '@/app/pal/new/_components/AdministrationPanels';
import {
  fetchSubsystem,
  resetSubsystemGroup,
  saveSubsystemGroup,
  statusLabel,
  type SettingsValue,
  type SubsystemDetail,
} from '@/app/pal/new/data/administration';

/**
 * New PAL → Administration — one subsystem.
 *
 * Renders whatever panels the API declares. The page has no knowledge of BKT
 * parameters, HPC stages or agent personas: it walks the panel list, hands each
 * to its renderer, and routes saves back through the settings group the server
 * named. Adding a parameter to the blueprint is a backend-only change.
 *
 * A save replaces the whole detail from the server response rather than
 * patching local state, so a server-side coercion or range clamp is always what
 * the administrator ends up looking at.
 */

type LoadState = 'loading' | 'ready' | 'empty' | 'error';

export default function SubsystemPage({
  params,
}: {
  params: Promise<{ subsystem: string }>;
}) {
  const { subsystem: subsystemKey } = use(params);

  const [state, setState] = useState<LoadState>('loading');
  const [detail, setDetail] = useState<SubsystemDetail | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  /** The settings group currently being written, so only its panel shows a spinner. */
  const [busyGroup, setBusyGroup] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await fetchSubsystem(subsystemKey);
      setDetail(next);
      setError('');
      setState(next.subsystem.panels.length === 0 ? 'empty' : 'ready');
    } catch (err) {
      setDetail(null);
      setError(err instanceof Error ? err.message : 'This subsystem could not be loaded.');
      setState('error');
    }
  }, [subsystemKey]);

  const retry = useCallback(() => {
    setState('loading');
    setError('');
    setNotice('');
    void load();
  }, [load]);

  useEffect(() => {
    // The rule cannot see that `load` only sets state after its first await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const handleSave = useCallback(
    async (group: string, value: SettingsValue) => {
      setBusyGroup(group);
      setError('');
      setNotice('');
      try {
        setDetail(await saveSubsystemGroup(subsystemKey, group, value));
        setNotice('Saved. The change applies to every learner scored from now on.');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'That change could not be saved.');
      } finally {
        setBusyGroup(null);
      }
    },
    [subsystemKey]
  );

  const handleReset = useCallback(
    async (group: string) => {
      setBusyGroup(group);
      setError('');
      setNotice('');
      try {
        setDetail(await resetSubsystemGroup(subsystemKey, group));
        setNotice('Reset. This group tracks the shipped blueprint default again.');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'That group could not be reset.');
      } finally {
        setBusyGroup(null);
      }
    },
    [subsystemKey]
  );

  if (state === 'loading') {
    return (
      <PageShell>
        <StatusPanel
          kind="loading"
          title="Loading subsystem"
          message="Fetching the configuration and probing its live status."
        />
      </PageShell>
    );
  }

  if (state === 'error') {
    return (
      <PageShell>
        <StatusPanel
          kind="error"
          title="Subsystem is not available"
          message={error || 'The backend did not return this subsystem.'}
          onRetry={retry}
        />
      </PageShell>
    );
  }

  if (state === 'empty' || !detail) {
    return (
      <PageShell>
        <StatusPanel
          kind="empty"
          title="Nothing to configure here yet"
          message="The backend returned this subsystem with no panels. Check that config/pal_architecture.php is deployed on the API."
          onRetry={retry}
        />
      </PageShell>
    );
  }

  const Icon = SUBSYSTEM_ICONS[detail.subsystem.icon] ?? Layers;
  const busy = busyGroup !== null;

  return (
    <PageShell>
      <Hero
        breadcrumb={['New PAL', 'Administration']}
        icon={Icon}
        title={detail.subsystem.label}
        description={detail.subsystem.tagline}
        badge={detail.subsystem.sourceDocument}
        chips={
          <>
            <HeroChip href="/pal/new/administration">
              <span className="flex items-center gap-1.5">
                <ArrowLeft className="h-3 w-3" />
                All subsystems
              </span>
            </HeroChip>
            <HeroChip active>{statusLabel(detail.health.status)}</HeroChip>
            {detail.canWrite ? null : <HeroChip>Read only</HeroChip>}
          </>
        }
        metrics={detail.health.metrics.slice(0, 4).map((metric) => ({
          label: metric.label,
          value: metric.value,
        }))}
        source={detail.health.summary}
        onRefresh={retry}
        refreshing={busy}
      />

      {error ? (
        <div className="rounded-[26px] border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-[26px] border border-emerald-200 bg-emerald-50 px-6 py-4 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}

      {detail.subsystem.requiresConfirmation && detail.canWrite ? (
        <section className="flex items-start gap-2.5 rounded-[26px] border border-dashed border-amber-200 bg-amber-50/60 px-6 py-5 text-sm text-amber-900">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="leading-6">
            <span className="font-semibold">This subsystem scores learners.</span> A change here takes
            effect on the next assessment for everyone in scope. Existing records are not rescored.
          </p>
        </section>
      ) : null}

      {detail.subsystem.panels.map((panel) => {
        const key = `${detail.subsystem.key}:${panel.key}`;
        const customised = detail.subsystem.customisedGroups.includes(panel.key);
        const panelBusy = busyGroup === panel.key;

        switch (panel.kind) {
          case 'live':
            return <LivePanel key={key} panel={panel} live={detail.live} />;

          case 'metrics':
            return <MetricsPanel key={key} panel={panel} health={detail.health} />;

          case 'params':
            return (
              <ParamsPanel
                key={key}
                panel={panel}
                value={detail.subsystem.settings[panel.key] ?? {}}
                canWrite={detail.canWrite}
                customised={customised}
                needsConfirm={detail.subsystem.requiresConfirmation}
                busy={panelBusy}
                onSave={(next) => void handleSave(panel.key, next)}
                onReset={() => void handleReset(panel.key)}
              />
            );

          case 'records':
            return (
              <RecordsPanel
                key={key}
                panel={panel}
                value={detail.subsystem.settings[panel.key] ?? []}
                health={detail.health}
                canWrite={detail.canWrite}
                customised={customised}
                needsConfirm={detail.subsystem.requiresConfirmation}
                busy={panelBusy}
                onSave={(next) => void handleSave(panel.key, next)}
                onReset={() => void handleReset(panel.key)}
              />
            );

          case 'matrix':
            return (
              <MatrixPanel
                key={key}
                panel={panel}
                value={detail.subsystem.settings[panel.key] ?? {}}
                canWrite={detail.canWrite}
                customised={customised}
                needsConfirm={detail.subsystem.requiresConfirmation}
                busy={panelBusy}
                onSave={(next) => void handleSave(panel.key, next)}
                onReset={() => void handleReset(panel.key)}
              />
            );

          case 'catalog':
            // Catalog content is probed per subsystem rather than configured,
            // so the panel key selects the renderer.
            if (panel.key === 'schema') {
              return (
                <GraphSchemaPanel
                  key={key}
                  panel={panel}
                  nodes={detail.catalog.graphNodes}
                  relationships={detail.catalog.graphRelationships}
                  probed={detail.catalog.graphProbed}
                />
              );
            }
            if (panel.key === 'vocabulary') {
              return (
                <VocabularyPanel key={key} panel={panel} groups={detail.catalog.careerVocabulary} />
              );
            }
            return null;

          default:
            return null;
        }
      })}

      <div className="px-1 pb-2">
        <Link
          href="/pal/new/administration"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:text-violet-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to all subsystems
        </Link>
      </div>
    </PageShell>
  );
}
