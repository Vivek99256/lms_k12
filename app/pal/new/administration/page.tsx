'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Layers, SlidersHorizontal } from 'lucide-react';

import {
  Hero,
  HeroChip,
  PageShell,
  StatusPanel,
  SUBSYSTEM_ICONS,
} from '@/app/pal/new/_components/AdministrationChrome';
import {
  fetchAdministrationOverview,
  statusLabel,
  statusTone,
  toneClasses,
  type AdministrationOverview,
  type SubsystemSummary,
} from '@/app/pal/new/data/administration';

/**
 * New PAL → Administration — overview.
 *
 * The control plane for the nine architecture subsystems in the PAL V4 Master
 * Blueprint. One screen answers: which parts of the architecture is this estate
 * actually running, and which are configured but inert.
 *
 * Load is a four-state machine — loading / error / empty / ready — because a
 * control plane that renders nothing is indistinguishable from a broken one.
 * Every state below terminates in a visible panel; none of them is blank.
 */

type LoadState = 'loading' | 'ready' | 'empty' | 'error';

export default function AdministrationPage() {
  const [state, setState] = useState<LoadState>('loading');
  const [overview, setOverview] = useState<AdministrationOverview | null>(null);
  const [error, setError] = useState('');

  // No setState before the first await: the component already mounts in
  // 'loading', and `retry` re-enters that state explicitly. An in-flight
  // request is deliberately NOT aborted on unmount — an abort used to land in
  // the catch and leave the page with no state at all.
  const load = useCallback(async () => {
    try {
      const next = await fetchAdministrationOverview();
      setOverview(next);
      setError('');
      setState(next.subsystems.length === 0 ? 'empty' : 'ready');
    } catch (err) {
      setOverview(null);
      setError(err instanceof Error ? err.message : 'The Administration request failed.');
      setState('error');
    }
  }, []);

  const retry = useCallback(() => {
    setState('loading');
    setError('');
    void load();
  }, [load]);

  useEffect(() => {
    // The rule cannot see that `load` only sets state after its first await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (state === 'loading') {
    return (
      <PageShell>
        <StatusPanel
          kind="loading"
          title="Loading Administration"
          message="Probing the nine architecture subsystems on this estate."
        />
      </PageShell>
    );
  }

  if (state === 'error') {
    return (
      <PageShell>
        <StatusPanel
          kind="error"
          title="Administration is not available"
          message={error || 'The backend did not return an architecture payload.'}
          onRetry={retry}
        />
      </PageShell>
    );
  }

  if (state === 'empty' || !overview) {
    return (
      <PageShell>
        <StatusPanel
          kind="empty"
          title="No architecture subsystems registered"
          message="The backend responded but declared no subsystems. Deploy the New PAL Administration module and run its migrations on the API."
          onRetry={retry}
        />
      </PageShell>
    );
  }

  const { totals, scope } = overview;

  return (
    <PageShell>
      <Hero
        breadcrumb={['New PAL', 'Administration']}
        icon={SlidersHorizontal}
        title="Administration"
        description="The PAL V4 architecture control plane. Configure the nine subsystems the Master Blueprint specifies, and see which of them this estate is actually running."
        badge="PAL V4"
        chips={overview.subsystems.map((subsystem) => (
          <HeroChip key={subsystem.key} href={`/pal/new/administration/${subsystem.key}`}>
            {subsystem.label}
          </HeroChip>
        ))}
        metrics={[
          { label: 'Subsystems', value: String(totals.total) },
          { label: 'Operational', value: String(totals.operational) },
          { label: 'Partial', value: String(totals.degraded) },
          { label: 'Not running', value: String(totals.inactive) },
        ]}
        source={
          scope.estateWide
            ? 'pal_architecture_settings — estate-wide scope'
            : `pal_architecture_settings — sub_institute_id ${scope.subInstituteId}`
        }
        onRefresh={retry}
      />

      {!overview.canWrite ? (
        <section className="rounded-[26px] border border-dashed border-amber-200 bg-amber-50/60 px-6 py-5">
          <p className="text-sm leading-6 text-amber-900">
            You have read access to Administration. Changing an architecture parameter requires an
            administrator profile — every value below is shown, none of them is editable for you.
          </p>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {overview.subsystems.map((subsystem) => (
          <SubsystemCard key={subsystem.key} subsystem={subsystem} />
        ))}
      </div>

      <p className="px-1 text-xs text-slate-400">
        A subsystem that has never been edited tracks the shipped blueprint default, so a later
        revision to the blueprint reaches it automatically. Editing one stores only the fields you
        changed.
      </p>
    </PageShell>
  );
}

function SubsystemCard({ subsystem }: { subsystem: SubsystemSummary }) {
  const Icon = SUBSYSTEM_ICONS[subsystem.icon] ?? Layers;
  const tone = statusTone(subsystem.status);

  return (
    <Link
      href={`/pal/new/administration/${subsystem.key}`}
      className="group flex flex-col rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-violet-300"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[15px] font-bold text-slate-900">{subsystem.label}</h2>
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${toneClasses(tone)}`}>
              {statusLabel(subsystem.status)}
            </span>
            {subsystem.customisedGroups > 0 ? (
              <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                {subsystem.customisedGroups} customised
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">{subsystem.tagline}</p>
        </div>
      </div>

      <p className="mt-3 text-[13px] leading-6 text-slate-600">{subsystem.summary}</p>

      {subsystem.metrics.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {subsystem.metrics.slice(0, 3).map((metric) => (
            <div
              key={metric.label}
              className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/60 px-2.5 py-1.5"
            >
              <span className="text-[11px] text-slate-500">{metric.label}</span>
              <span
                className={`font-mono text-[12px] font-bold tabular-nums ${
                  metric.tone === 'good'
                    ? 'text-emerald-600'
                    : metric.tone === 'warn'
                      ? 'text-amber-600'
                      : metric.tone === 'critical'
                        ? 'text-rose-600'
                        : 'text-slate-700'
                }`}
              >
                {metric.value}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <span className="truncate font-mono text-[11px] text-slate-400">{subsystem.sourceDocument}</span>
        <span className="flex shrink-0 items-center gap-1 text-[12px] font-medium text-violet-600">
          Configure
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
