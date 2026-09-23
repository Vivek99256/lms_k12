'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, RefreshCw } from 'lucide-react';

import { IntelligenceCard } from '@/app/enterprise-brain/_components/IntelligenceCard';
import { Card, ErrorState, LoadingState, Pill } from '@/app/enterprise-brain/_components/primitives';
import {
  fetchModuleIntelligence,
  type ModuleIntelligencePayload,
} from '@/lib/brain/api';

/**
 * One module's slice of the intelligence loop — the body behind the
 * Intelligence tab, for any module.
 *
 * WHAT THIS IS NOT. It is not a second intelligence engine, and it is not the
 * Enterprise Brain embedded in a module. It is the same signals, hypotheses and
 * recommendations the Brain produces, filtered to the rules attributed to this
 * module (next_lms_erp/app/Brain/Intelligence/RuleModules.php). Nothing is
 * computed here that is not computed for the Brain, so a module's tab and the
 * Brain can never disagree about what is happening.
 *
 * IT USES THE BRAIN'S OWN CARD. IntelligenceCard is the component the whole
 * Brain speaks through — headline, evidence, cause, recommendation, in a fixed
 * order — so a reader who has learned that shape anywhere reads this without
 * learning anything new.
 *
 * THREE ANSWERS, NOT ONE EMPTY STATE. "No rule watches this module yet" and
 * "rules watch it and found nothing wrong" are opposite news, and a module the
 * platform registry has never heard of is a third thing again. The payload
 * carries all three and this screen says which one it is.
 *
 * Fees is deliberately not served by this: Fees → Intelligence has a native
 * workspace over its own fee records, which is a superset of this view.
 */

function summaryPills(payload: ModuleIntelligencePayload) {
  const severities = ['critical', 'high', 'medium', 'low'] as const;

  return severities
    .map((severity) => ({ severity, count: payload.summary.bySeverity[severity] ?? 0 }))
    .filter((entry) => entry.count > 0);
}

export function ModuleIntelligence({
  moduleKey,
  /** The module's name as the menu calls it, for the heading before load. */
  fallbackLabel,
}: {
  moduleKey: string;
  fallbackLabel: string;
}) {
  const [payload, setPayload] = useState<ModuleIntelligencePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  /**
   * Nothing is set before the request completes: `loading` already starts true
   * and the refresh button raises `refreshing` itself, so neither the mount
   * effect nor this callback touches state synchronously.
   */
  const load = useCallback(async () => {
    try {
      setPayload(await fetchModuleIntelligence(moduleKey));
      setError('');
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'The intelligence for this module could not be loaded.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [moduleKey]);

  useEffect(() => {
    // The mount fetch. Every setState it reaches happens after the request
    // resolves, which is the synchronisation this rule exists to allow, but the
    // rule cannot see across the await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const label = payload?.label || fallbackLabel;

  if (loading && !payload) {
    return <LoadingState label={`Loading ${label} intelligence`} />;
  }

  if (error && !payload) {
    return <ErrorState message={error} onRetry={() => void load()} />;
  }

  if (!payload) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{label} intelligence</h2>
          <p className="mt-1 text-sm text-slate-600">
            What the Brain has observed in {label} at this institute, why it thinks so, and what it
            recommends doing about it.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {summaryPills(payload).map((entry) => (
            <Pill key={entry.severity} tone={entry.severity === 'low' ? 'gray' : 'amber'}>
              {entry.count} {entry.severity}
            </Pill>
          ))}
          <button
            type="button"
            onClick={() => {
              setRefreshing(true);
              void load();
            }}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-60"
          >
            {refreshing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
          {error}
        </div>
      )}

      {!payload.declared ? (
        // No rule is attributed to this module. Saying "no signals" here would
        // read as "nothing is wrong", when the truth is that nothing is looking.
        <Card className="px-4 py-10 text-center">
          <p className="text-sm font-medium text-slate-700">
            The Brain does not watch {label} yet
          </p>
          <p className="mx-auto mt-1 max-w-xl text-sm text-slate-600">
            No intelligence rule is attributed to this module, so there is nothing to report — this
            is not the same as {label} having no problems.
          </p>
          <Link
            href="/enterprise-brain/intelligence-loop"
            className="mt-3 inline-flex items-center text-sm font-semibold text-[#5846EA] hover:underline"
          >
            Open the Enterprise Brain
          </Link>
        </Card>
      ) : payload.signals.length === 0 ? (
        // Rules are watching and found nothing. That is a result, and it is
        // reported as one.
        <Card className="px-4 py-10 text-center">
          <p className="text-sm font-medium text-slate-700">Nothing to report for {label}</p>
          <p className="mx-auto mt-1 max-w-xl text-sm text-slate-600">
            {payload.rules.length} {payload.rules.length === 1 ? 'rule watches' : 'rules watch'} this
            module and none of them is firing
            {payload.lastRun ? ` as of the last run on ${payload.lastRun.at}.` : '.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {payload.signals.map((finding) => (
            <IntelligenceCard key={finding.id} model={finding} />
          ))}
        </div>
      )}

      {payload.recommendations.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-semibold text-slate-900">
              Recommendations ({payload.summary.open} open of {payload.summary.recommendations})
            </h3>
            <Link
              href="/enterprise-brain/intelligence-loop/deliberation"
              className="text-xs font-semibold text-[#5846EA] hover:underline"
            >
              Decide in the Brain
            </Link>
          </div>
          {payload.recommendations.map((recommendation) => (
            <Card key={recommendation.id} className="px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-medium text-slate-900">{recommendation.title}</p>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Pill tone={recommendation.priority === 'high' ? 'amber' : 'gray'}>
                    {recommendation.priority}
                  </Pill>
                  <Pill tone={recommendation.status === 'pending' ? 'blue' : 'green'}>
                    {recommendation.status}
                  </Pill>
                </div>
              </div>
              {recommendation.impact && (
                <p className="mt-1 text-xs text-slate-500">{recommendation.impact}</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
