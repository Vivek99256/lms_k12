'use client';

import React, { useCallback, useState } from 'react';
import { Brain, Play, RefreshCw } from 'lucide-react';
import {
  fetchIntelligence,
  fetchSignalDetail,
  runIntelligence,
  type BrainFinding,
  type BrainSignalDetail,
} from '@/lib/brain/api';
import { useBrainResource } from '../_components/useBrainResource';
import { Card, ErrorState, LoadingState, MetricTiles, HeroHeader } from '../_components/primitives';
import { BarSeries, ChartCard, ConfidenceMeter, LoopStrip } from '../_components/charts';
import { EvidenceStrip, IntelligenceCard, SeverityChip } from '../_components/IntelligenceCard';

/**
 * The Intelligence Loop, end to end.
 *
 * THIS SCREEN'S JOB IS TO MAKE THE REASONING AUDITABLE, not to summarise it.
 * Anyone can be shown "607 departments have no head"; the question that decides
 * whether the Brain is trusted is "how do you know, and why do you think that?".
 * So selecting a signal opens the whole chain that produced it — the evidence
 * rows read out of vivek_erp, the case, the hypothesis and its root-cause
 * family, the numbered reasoning steps with their confidence, and the
 * recommendation that follows — rather than a summary of the chain.
 *
 * RULES THAT ARE NOT FIRING ARE LISTED TOO. A rule that finds nothing is a
 * statement that the institute is clean on that dimension, and hiding it would
 * make an empty section look like an engine that had not run.
 */
export default function IntelligenceLoopPage() {
  const { data, error, loading, refreshing, refresh } = useBrainResource(fetchIntelligence, []);
  const [selected, setSelected] = useState<BrainSignalDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [runNote, setRunNote] = useState<string | null>(null);

  const open = useCallback(async (signal: BrainFinding) => {
    setDetailLoading(true);
    setSelected(null);
    try {
      setSelected(await fetchSignalDetail(signal.id));
    } catch (cause) {
      setRunNote(cause instanceof Error ? cause.message : 'Could not open that signal.');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const rerun = useCallback(async () => {
    setRunning(true);
    setRunNote(null);
    try {
      const result = (await runIntelligence()) as {
        rules?: { evaluated?: number; signalsCreated?: number; signalsRefreshed?: number };
        reasoning?: { cases?: number; recommendations?: number };
        elapsedMs?: number;
      };
      setRunNote(
        `Evaluated ${result.rules?.evaluated ?? 0} rules against the live LMS data — ` +
          `${result.rules?.signalsCreated ?? 0} new signals, ${result.rules?.signalsRefreshed ?? 0} refreshed, ` +
          `${result.reasoning?.recommendations ?? 0} new recommendations (${result.elapsedMs ?? 0}ms).`,
      );
      await refresh();
    } catch (cause) {
      setRunNote(cause instanceof Error ? cause.message : 'The run failed.');
    } finally {
      setRunning(false);
    }
  }, [refresh]);

  if (loading && !data) return <LoadingState label="Reading the intelligence loop" />;
  if (error && !data) return <ErrorState message={error} onRetry={refresh} />;
  if (!data) return null;

  const firing = data.rules.filter((rule) => rule.firing);
  const clean = data.rules.filter((rule) => !rule.firing);

  return (
    <div className="p-6">
      <HeroHeader
        breadcrumb="Enterprise Brain · Intelligence Loop"
        title="Intelligence Loop"
        description={`Signal → evidence → case → hypothesis → reasoning → recommendation → decision → execution → outcome, computed from ${data.source}.`}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={rerun}
              disabled={running}
              className="flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-300 transition-colors hover:border-slate-500 hover:text-white disabled:opacity-60"
            >
              <Play size={14} className={running ? 'animate-pulse' : ''} />
              {running ? 'Running the loop…' : 'Run intelligence'}
            </button>
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
        }
      />

      {runNote && (
        <div className="mb-5 rounded-xl border border-indigo-200 bg-indigo-50/70 px-4 py-3 text-sm text-indigo-900">{runNote}</div>
      )}

      <div className="mb-6">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">Loop stages</p>
        <LoopStrip stages={data.stages} />
        {data.lastRun && (
          <p className="mt-2 text-[11px] text-slate-400">Last run {new Date(data.lastRun.at).toLocaleString()}.</p>
        )}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-4">
        <ChartCard title="How serious">
          <BarSeries data={data.signalsBySeverity} bySeverity />
        </ChartCard>
        <ChartCard title="What kind of finding">
          <BarSeries data={data.signalsByClassification} max={8} />
        </ChartCard>
        <ChartCard title="Why they happen">
          <BarSeries data={data.rootCauseFamilies} max={8} />
        </ChartCard>
        <ChartCard title="What they ask for">
          <BarSeries data={data.recommendationsByCategory} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Card className="overflow-hidden">
          <div className="border-b border-gray-100 px-5 py-3.5">
            <p className="text-sm font-semibold text-slate-900">Signal stream</p>
            <p className="text-xs text-slate-400">{data.signals.length} signals — select one to see the reasoning behind it.</p>
          </div>
          <div className="max-h-[36rem] divide-y divide-gray-100 overflow-auto">
            {data.signals.map((signal) => (
              <button
                key={signal.id}
                type="button"
                onClick={() => open(signal)}
                className={`flex w-full flex-col gap-1.5 px-5 py-3 text-left transition-colors hover:bg-slate-50 ${
                  selected?.signal?.id === signal.id ? 'bg-indigo-50/60' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm font-medium leading-snug text-slate-800">{signal.title}</span>
                  <SeverityChip severity={signal.severity} label={signal.severityLabel} />
                </div>
                {/* The row shows what a person needs to triage: the movement and
                    who owns it. The rule key lives behind "Technical detail" on
                    the card, not on the face of the list. */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                  {signal.headline && (
                    <span className="font-semibold text-slate-600">
                      {signal.headline.value} {signal.headline.label}
                    </span>
                  )}
                  {signal.headline?.changeLabel && <span>{signal.headline.changeLabel}</span>}
                  <span>·</span>
                  <span>{signal.owner}</span>
                </div>
              </button>
            ))}
            {!data.signals.length && (
              <p className="px-5 py-8 text-sm text-slate-400">
                No signals. Every rule the engine holds found this organization clean — run the loop again after the LMS data changes.
              </p>
            )}
          </div>
        </Card>

        <div>
          {detailLoading && <LoadingState label="Opening the reasoning chain" />}
          {!detailLoading && !selected && (
            <Card className="flex h-full min-h-[20rem] flex-col items-center justify-center p-8 text-center">
              <Brain size={28} className="mb-3 text-slate-300" />
              <p className="text-sm font-medium text-slate-500">Select a signal</p>
              <p className="mt-1 max-w-sm text-xs text-slate-400">
                Its evidence, case, hypothesis, reasoning trail and recommendation are shown here — every number traced back to
                the LMS row it came from.
              </p>
            </Card>
          )}
          {!detailLoading && selected && <SignalDetail detail={selected} />}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <RuleTable title="Checks currently failing" rules={firing} empty="Every check passes." />
        <RuleTable
          title="Checks that found nothing"
          rules={clean}
          empty="Every check is currently failing."
          muted
        />
      </div>
    </div>
  );
}

function SignalDetail({ detail }: { detail: BrainSignalDetail }) {
  const { signal, evidence, hypothesis, reasoning, recommendations } = detail;

  return (
    <div className="space-y-4">
      {/* The finding itself, opened — this is the answer to "what and why". */}
      <IntelligenceCard model={signal} defaultOpen />

      <MetricTiles
        metrics={[
          { key: 'evidence', label: 'Evidence records', value: evidence.length },
          { key: 'steps', label: 'Reasoning steps', value: reasoning.length },
          { key: 'recs', label: 'Recommendations', value: recommendations.length },
        ]}
      />

      {reasoning.length > 0 && (
        <Card className="p-5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">How the Brain reasoned</p>
          <ol className="mt-3 space-y-3">
            {reasoning.map((step) => (
              <li key={String(step.id)} className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">
                  {String(step.step_order)}
                </span>
                <p className="text-xs leading-relaxed text-slate-600">{String(step.description)}</p>
              </li>
            ))}
          </ol>
          {hypothesis && (
            <p className="mt-4 border-t border-gray-100 pt-3 text-[11px] text-slate-400">
              Root-cause family: <span className="font-semibold text-slate-600">{String(hypothesis.root_cause_family).replace(/_/g, ' ')}</span>
            </p>
          )}
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
            The records this is based on
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Read directly from the school&apos;s own database — {evidence.length} {evidence.length === 1 ? 'record' : 'records'}.
          </p>
        </div>
        <div className="max-h-80 divide-y divide-gray-100 overflow-auto">
          {evidence.map((row) => {
            const content = (row.content ?? {}) as Record<string, unknown>;
            // The evidence row is rendered as labelled figures, never as the raw
            // JSON it is stored as: a reader should not have to parse a blob to
            // find out which department the finding is about.
            const facts = Object.entries(content)
              .filter(([key]) => !['issue', 'source', 'recordId'].includes(key))
              .slice(0, 5)
              .map(([key, value]) => ({ label: humanise(key), value: String(value) }));

            return (
              <div key={String(row.id)} className="px-5 py-3">
                <p className="text-xs font-medium text-slate-700">
                  {String(content.issue ?? 'Observation')}
                </p>
                {facts.length > 0 && (
                  <div className="mt-2">
                    <EvidenceStrip evidence={facts} />
                  </div>
                )}
              </div>
            );
          })}
          {!evidence.length && <p className="px-5 py-6 text-sm text-slate-400">No supporting records attached.</p>}
        </div>
      </Card>

      {recommendations.map((rec) => (
        <Card key={String(rec.id)} className="border-indigo-200/70 bg-indigo-50/30 p-5">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-500">Recommended action</p>
            <ConfidenceMeter value={rec.confidence as number} />
          </div>
          <p className="mt-2 text-sm font-medium text-slate-900">{String(rec.title)}</p>
          <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-slate-600">{String(rec.description ?? '')}</p>
          {rec.impact ? <p className="mt-2 text-[11px] text-slate-500">Scale: {String(rec.impact)}</p> : null}
        </Card>
      ))}
    </div>
  );
}

/** camelCase and snake_case keys, rendered as words. */
function humanise(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

function RuleTable({
  title,
  rules,
  empty,
  muted = false,
}: {
  title: string;
  rules: Array<{ rule: string; family: string; title: string | null; severity: string | null; action: string }>;
  empty: string;
  muted?: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-gray-100 px-5 py-3">
        <p className="text-sm font-semibold text-slate-900">
          {title} <span className="font-normal text-slate-400">({rules.length})</span>
        </p>
      </div>
      <div className="max-h-80 divide-y divide-gray-100 overflow-auto">
        {rules.map((rule) => (
          <div key={rule.rule} className="px-5 py-2.5">
            <div className="flex items-start justify-between gap-3">
              <p className={`text-xs leading-snug ${muted ? 'text-slate-500' : 'text-slate-800'}`}>
                {rule.title ?? rule.action}
              </p>
              {rule.severity && <SeverityChip severity={rule.severity} />}
            </div>
            <p className="mt-0.5 text-[11px] capitalize text-slate-400">{rule.family.replace(/_/g, ' ')}</p>
          </div>
        ))}
        {!rules.length && <p className="px-5 py-6 text-sm text-slate-400">{empty}</p>}
      </div>
    </Card>
  );
}
