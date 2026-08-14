'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Boxes,
  Brain,
  Check,
  ChevronDown,
  Compass,
  Grid3x3,
  Layers3,
  Lightbulb,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import {
  fetchChapterModel,
  fetchInsights,
  fetchPedagogySelection,
  fetchRegistry,
  formatMetric,
  formatPercent,
  humanise,
  saveNodeTags,
  suggestTags,
  transitionNodeTags,
  type CoverageTag,
  type FieldSource,
  type H5pChapterModel,
  type H5pEngagement,
  type H5pInsightsResult,
  type H5pNode,
  type H5pRegistry,
  type PedagogySelection,
  type RegistryTerm,
  type TagProposal,
} from '../data/h5p-model';
import { H5P_ROUTE_MAP, h5pContextQuery, hasH5pContext, readH5pContext } from '../data/h5p';
import { EmptyState, H5pPageHeader, InlineBanner, LoadingState, MissingContextNotice } from '../components/shared';

/**
 * H5P Model workspace — LMS+PAL → Tech/Learn → Subject → Chapter → H5P Content.
 *
 * Renders the PAL V4 H5P Model for one chapter: the type catalogue, every node
 * with its pedagogy and framework tags, the §9 pedagogy × framework coverage
 * matrix read against the chapter's real content, measured §8.3 engagement,
 * the §8.2 xAPI event contract and the §1.3 pedagogy selector.
 *
 * Nothing on this page is hard-coded. Type names, pedagogy names, framework
 * vocabularies, the coverage matrix, the selection rules and every metric come
 * from `/api/pal/h5p/*`, which reads them from `pal_vocabulary`, the live H5P
 * tables and `pal_telemetry_events`. The only literals here are layout.
 */

type TabKey = 'nodes' | 'types' | 'coverage' | 'engagement' | 'pedagogy' | 'xapi' | 'insights';

const TABS: Array<{ key: TabKey; label: string; icon: typeof Boxes }> = [
  { key: 'nodes', label: 'Content nodes', icon: Layers3 },
  { key: 'insights', label: 'Insights', icon: Lightbulb },
  { key: 'types', label: 'Type catalogue', icon: Boxes },
  { key: 'coverage', label: 'Framework coverage', icon: Grid3x3 },
  { key: 'engagement', label: 'Engagement', icon: BarChart3 },
  { key: 'pedagogy', label: 'Pedagogy selector', icon: Compass },
  { key: 'xapi', label: 'xAPI pipeline', icon: Activity },
];

/** Where a tag value came from — the colour is the only signal that matters. */
const SOURCE_STYLES: Record<FieldSource, string> = {
  stored: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  ai: 'border-violet-200 bg-violet-50 text-violet-700',
  derived: 'border-slate-200 bg-slate-50 text-slate-600',
  missing: 'border-dashed border-slate-200 bg-white text-slate-400',
};

const SOURCE_LABELS: Record<FieldSource, string> = {
  stored: 'Saved by a reviewer',
  ai: 'AI draft, awaiting review',
  derived: 'Derived from the registry and question bank',
  missing: 'Not set',
};

function labelFor(terms: RegistryTerm[], code: string | null | undefined): string {
  if (!code) return '—';
  return terms.find((term) => term.code === code)?.label ?? humanise(code);
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>{children}</div>
  );
}

function SectionTitle({ icon: Icon, title, hint }: { icon: typeof Boxes; title: string; hint?: string }) {
  return (
    <div className="mb-4 flex items-start gap-2.5">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-[#4f46e5]">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

/** Engagement figures are measured; an unmeasured one says so rather than showing 0. */
function EngagementCell({ engagement }: { engagement: H5pEngagement | null }) {
  if (!engagement) return <span className="text-xs text-slate-400">—</span>;
  if (!engagement.measured) {
    return <span className="text-xs text-slate-400">Not measured yet</span>;
  }
  return (
    <span className="text-xs tabular-nums text-slate-700">
      {formatPercent(engagement.completionRate)} complete · score {formatMetric(engagement.avgEngagementScore)} ·{' '}
      {engagement.sampleSize} event{engagement.sampleSize === 1 ? '' : 's'}
    </span>
  );
}

function H5pModelContent() {
  const searchParams = useSearchParams();
  const ctx = useMemo(() => readH5pContext(new URLSearchParams(searchParams?.toString())), [searchParams]);
  const contextQuery = h5pContextQuery(ctx);

  const [registry, setRegistry] = useState<H5pRegistry | null>(null);
  const [model, setModel] = useState<H5pChapterModel | null>(null);
  const [selection, setSelection] = useState<PedagogySelection | null>(null);
  const [tab, setTab] = useState<TabKey>('nodes');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [expandedNode, setExpandedNode] = useState<string | null>(null);
  const [proposals, setProposals] = useState<TagProposal[]>([]);
  const [busy, setBusy] = useState('');
  const [insights, setInsights] = useState<H5pInsightsResult | null>(null);

  const reload = useCallback(
    async (signal?: AbortSignal) => {
      const [registryResult, modelResult] = await Promise.all([
        fetchRegistry(signal),
        fetchChapterModel(ctx, { limit: 100 }, signal),
      ]);
      setRegistry(registryResult);
      setModel(modelResult);
    },
    [ctx]
  );

  useEffect(() => {
    const controller = new AbortController();
    // Deferred so the effect body does not setState synchronously — the same
    // guard the other pages in this module use.
    queueMicrotask(() => {
      if (controller.signal.aborted) return;

      if (!hasH5pContext(ctx)) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      reload(controller.signal)
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          setError(err instanceof Error ? err.message : 'Failed to load the H5P Model.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    });

    return () => controller.abort();
  }, [ctx, reload]);

  // The selector is only fetched when its tab is opened — it is the one read
  // that depends on learner history rather than the chapter.
  useEffect(() => {
    if (tab !== 'pedagogy' || selection || !hasH5pContext(ctx)) return;
    const controller = new AbortController();
    fetchPedagogySelection(ctx, {}, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setSelection(result);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Failed to run the pedagogy selector.');
        }
      });
    return () => controller.abort();
  }, [tab, selection, ctx]);

  // The evidence half only — the DeepSeek call is a separate, explicit action
  // because it takes ~15s and the measured figures should be on screen first.
  useEffect(() => {
    if (tab !== 'insights' || insights || !hasH5pContext(ctx)) return;
    const controller = new AbortController();
    fetchInsights(ctx, { evidenceOnly: true }, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setInsights(result);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Failed to read the H5P event evidence.');
        }
      });
    return () => controller.abort();
  }, [tab, insights, ctx]);

  const handleGenerateInsight = useCallback(async () => {
    setBusy('insight');
    setError('');
    try {
      setInsights(await fetchInsights(ctx, {}));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Insight generation failed.');
    } finally {
      setBusy('');
    }
  }, [ctx]);

  const pedagogyTerms = registry?.pedagogies ?? [];
  const typeTerms = registry?.h5pTypes ?? [];

  const handleSuggest = useCallback(async () => {
    setBusy('suggest');
    setError('');
    setNotice('');
    try {
      const result = await suggestTags(ctx);
      setProposals(result.proposals);
      setNotice(
        result.proposals.length === 0
          ? result.reason || 'The model returned no usable proposals.'
          : `${result.proposals.length} proposal${result.proposals.length === 1 ? '' : 's'} ready for review${result.cached ? ' (from cache)' : ''}. Nothing has been saved yet.`
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'AI tagging failed.');
    } finally {
      setBusy('');
    }
  }, [ctx]);

  const handleAcceptProposal = useCallback(
    async (proposal: TagProposal) => {
      setBusy(proposal.nodeKey);
      setError('');
      try {
        await saveNodeTags(proposal.nodeKey, ctx, proposal.values);
        setProposals((current) => current.filter((item) => item.nodeKey !== proposal.nodeKey));
        setNotice(`Saved tags for ${proposal.nodeKey}. It is a draft until a reviewer approves it.`);
        await reload();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to save the proposal.');
      } finally {
        setBusy('');
      }
    },
    [ctx, reload]
  );

  const handleTransition = useCallback(
    async (nodeKey: string, status: string) => {
      setBusy(nodeKey);
      setError('');
      try {
        await transitionNodeTags(nodeKey, status);
        setNotice(`${nodeKey} moved to ${humanise(status)}.`);
        await reload();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to change the review status.');
      } finally {
        setBusy('');
      }
    },
    [reload]
  );

  if (!hasH5pContext(ctx)) {
    return (
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="mx-auto max-w-6xl">
          <MissingContextNotice />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <H5pPageHeader
          title="H5P Model"
          description={
            model
              ? `${model.nodeCount} node${model.nodeCount === 1 ? '' : 's'} · registry read from ${model.registrySource}`
              : 'PAL V4 pedagogy, framework and engagement model for this chapter'
          }
          ctx={ctx}
          backHref={`/h5p/html_contents?${contextQuery}`}
          actions={
            registry?.ai.available ? (
              <button
                type="button"
                onClick={handleSuggest}
                disabled={busy === 'suggest'}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#4f46e5] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#4338ca] disabled:opacity-60"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {busy === 'suggest' ? 'Asking the model…' : 'Suggest missing tags'}
              </button>
            ) : null
          }
        />

        <InlineBanner kind="error" message={error} onDismiss={() => setError('')} />
        <InlineBanner kind="success" message={notice} onDismiss={() => setNotice('')} />

        {registry && !registry.ai.available && registry.ai.unavailableReason ? (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
            AI tagging is unavailable: {registry.ai.unavailableReason}
          </div>
        ) : null}

        {loading ? (
          <LoadingState label="Loading the H5P Model…" />
        ) : !model || !registry ? (
          <EmptyState title="The H5P Model could not be loaded" hint={error || undefined} />
        ) : (
          <>
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Nodes" value={String(model.nodeCount)} hint={model.truncated ? 'showing the first 100' : undefined} />
              <Stat
                label="Tagged"
                value={`${model.taggingHealth.stored}/${model.taggingHealth.total}`}
                hint={`${model.taggingHealth.approved} approved`}
              />
              <Stat
                label="Tag completeness"
                value={formatPercent(model.taggingHealth.avgCompleteness)}
                hint="average across nodes"
              />
              <Stat
                label="xAPI events"
                value={model.telemetry.available ? String(model.telemetry.totalEvents) : '—'}
                hint={
                  model.telemetry.available
                    ? `last ${model.telemetry.windowDays} days`
                    : 'event store not migrated'
                }
              />
            </div>

            <div className="mb-5 flex flex-wrap gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
              {TABS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                    tab === key ? 'bg-[#4f46e5] text-white' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {proposals.length > 0 ? (
              <Card className="mb-5 border-violet-200 bg-violet-50/40">
                <SectionTitle
                  icon={Sparkles}
                  title={`${proposals.length} AI proposal${proposals.length === 1 ? '' : 's'}`}
                  hint="Nothing has been written. Accepting one saves it as a draft for review — a machine can never approve its own tags."
                />
                <div className="space-y-2">
                  {proposals.map((proposal) => (
                    <div
                      key={proposal.nodeKey}
                      className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-violet-200 bg-white px-3.5 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-[11px] text-slate-500">{proposal.nodeKey}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {Object.entries(proposal.values).map(([field, value]) => (
                            <span
                              key={field}
                              className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] text-violet-700"
                            >
                              {humanise(field)}: {Array.isArray(value) ? value.join(', ') : String(value)}
                            </span>
                          ))}
                        </div>
                        {proposal.rationale ? (
                          <p className="mt-1.5 text-[11px] italic text-slate-500">{proposal.rationale}</p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAcceptProposal(proposal)}
                        disabled={busy === proposal.nodeKey}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-violet-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-violet-700 transition hover:bg-violet-50 disabled:opacity-60"
                      >
                        <Check className="h-3 w-3" />
                        Save as draft
                      </button>
                    </div>
                  ))}
                </div>
              </Card>
            ) : null}

            {tab === 'nodes' ? (
              <NodesTab
                model={model}
                pedagogyTerms={pedagogyTerms}
                typeTerms={typeTerms}
                registry={registry}
                expanded={expandedNode}
                onToggle={(key) => setExpandedNode(expandedNode === key ? null : key)}
                onTransition={handleTransition}
                busy={busy}
              />
            ) : null}

            {tab === 'insights' ? (
              <InsightsTab
                insights={insights}
                pedagogyTerms={pedagogyTerms}
                typeTerms={typeTerms}
                onGenerate={handleGenerateInsight}
                busy={busy === 'insight'}
              />
            ) : null}

            {tab === 'types' ? <TypesTab model={model} pedagogyTerms={pedagogyTerms} contextQuery={contextQuery} /> : null}

            {tab === 'coverage' ? <CoverageTab model={model} /> : null}

            {tab === 'engagement' ? <EngagementTab model={model} registry={registry} /> : null}

            {tab === 'pedagogy' ? <PedagogyTab selection={selection} pedagogyTerms={pedagogyTerms} typeTerms={typeTerms} /> : null}

            {tab === 'xapi' ? <XapiTab registry={registry} model={model} /> : null}
          </>
        )}
      </div>
    </div>
  );
}

// --- tabs ------------------------------------------------------------------

function NodesTab({
  model,
  pedagogyTerms,
  typeTerms,
  registry,
  expanded,
  onToggle,
  onTransition,
  busy,
}: {
  model: H5pChapterModel;
  pedagogyTerms: RegistryTerm[];
  typeTerms: RegistryTerm[];
  registry: H5pRegistry;
  expanded: string | null;
  onToggle: (key: string) => void;
  onTransition: (nodeKey: string, status: string) => void;
  busy: string;
}) {
  if (model.nodes.length === 0) {
    return (
      <EmptyState
        title="This chapter has no H5P content yet"
        hint="Create a scenario, interactive video, MCQ set or flashcard deck from the H5P content hub, then come back to tag it."
      />
    );
  }

  return (
    <div className="space-y-3">
      {model.nodes.map((node) => (
        <NodeRow
          key={node.nodeKey}
          node={node}
          pedagogyTerms={pedagogyTerms}
          typeTerms={typeTerms}
          registry={registry}
          expanded={expanded === node.nodeKey}
          onToggle={() => onToggle(node.nodeKey)}
          onTransition={onTransition}
          busy={busy === node.nodeKey}
        />
      ))}
    </div>
  );
}

function NodeRow({
  node,
  pedagogyTerms,
  typeTerms,
  registry,
  expanded,
  onToggle,
  onTransition,
  busy,
}: {
  node: H5pNode;
  pedagogyTerms: RegistryTerm[];
  typeTerms: RegistryTerm[];
  registry: H5pRegistry;
  expanded: boolean;
  onToggle: () => void;
  onTransition: (nodeKey: string, status: string) => void;
  busy: boolean;
}) {
  const model = node.model;
  const values = model?.values ?? {};

  // Framework fields are rendered against the registry so a newly registered
  // framework appears here without a code change.
  const frameworkFields: Array<[string, string]> = [
    ['casel_domain', 'casel'],
    ['ngss_practice', 'ngss'],
    ['ncdg_goal', 'ncdg'],
    ['music_domain', 'music'],
    ['sports_domain', 'sports'],
    ['finance_level', 'finance'],
  ];

  return (
    <Card className="p-0">
      <button type="button" onClick={onToggle} className="flex w-full items-start gap-3 p-5 text-left">
        <ChevronDown
          className={`mt-1 h-4 w-4 shrink-0 text-slate-400 transition-transform ${expanded ? '' : '-rotate-90'}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
              {labelFor(typeTerms, node.h5pType)}
            </span>
            {node.childCount !== null && node.childLabel ? (
              <span className="text-[11px] text-slate-400">
                {node.childCount} {node.childLabel}
                {node.childCount === 1 ? '' : 's'}
              </span>
            ) : null}
            <span className="font-mono text-[11px] text-slate-400">{node.nodeKey}</span>
          </div>
          <p className="mt-1.5 truncate text-sm font-medium text-slate-900">{node.title}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <TagChip
              label={labelFor(pedagogyTerms, values.pedagogy_tag as string)}
              source={model?.fieldSources.pedagogy_tag ?? 'missing'}
            />
            <TagChip
              label={humanise(String(values.bloom_level ?? 'no bloom'))}
              source={model?.fieldSources.bloom_level ?? 'missing'}
            />
            <span className="text-[11px] text-slate-400">
              {formatPercent(model?.completeness ?? null)} tagged
            </span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <StatusBadge status={model?.qualityStatus ?? 'untagged'} />
          <div className="mt-1">
            <EngagementCell engagement={node.engagement} />
          </div>
        </div>
      </button>

      {expanded ? (
        <div className="border-t border-slate-100 px-5 py-4">
          {node.summary ? <p className="mb-4 text-xs leading-relaxed text-slate-600">{node.summary}</p> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Framework evidence</p>
              <div className="space-y-1.5">
                {frameworkFields.map(([field, framework]) => {
                  const source = model?.fieldSources[field] ?? 'missing';
                  const code = values[field] as string | null;
                  const strength = model?.coverageStrength[field];
                  return (
                    <div key={field} className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-slate-500">{framework.toUpperCase()}</span>
                      <span className="flex items-center gap-1.5">
                        <TagChip label={labelFor(registry.frameworks[framework] ?? [], code)} source={source} />
                        {strength === 'strong' ? (
                          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                            strong
                          </span>
                        ) : null}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Why these tags</p>
              {model && Object.keys(model.derivation).length > 0 ? (
                <ul className="space-y-1.5">
                  {Object.entries(model.derivation).map(([field, why]) => (
                    <li key={field} className="text-[11px] leading-relaxed text-slate-500">
                      <span className="font-medium text-slate-600">{humanise(field)}:</span> {why}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px] text-slate-400">
                  Nothing could be derived for this node — it needs manual or AI tagging.
                </p>
              )}
            </div>
          </div>

          {registry.qualityStatuses.length > 0 && model && model.qualityStatus !== 'untagged' ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
              <span className="text-[11px] text-slate-400">Move to:</span>
              {registry.qualityStatuses
                .filter((status) => status !== model.qualityStatus)
                .map((status) => (
                  <button
                    key={status}
                    type="button"
                    disabled={busy}
                    onClick={() => onTransition(node.nodeKey, status)}
                    className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    {humanise(status)}
                  </button>
                ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

function TagChip({ label, source }: { label: string; source: FieldSource }) {
  return (
    <span
      title={SOURCE_LABELS[source]}
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${SOURCE_STYLES[source]}`}
    >
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    approved: 'bg-emerald-50 text-emerald-700',
    in_review: 'bg-amber-50 text-amber-700',
    draft: 'bg-slate-100 text-slate-600',
    rejected: 'bg-red-50 text-red-700',
    untagged: 'bg-slate-50 text-slate-400',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${styles[status] ?? styles.draft}`}>
      {humanise(status)}
    </span>
  );
}

function TypesTab({
  model,
  pedagogyTerms,
  contextQuery,
}: {
  model: H5pChapterModel;
  pedagogyTerms: RegistryTerm[];
  contextQuery: string;
}) {
  const native = model.inventory.filter((row) => row.implementationStatus === 'native');
  const planned = model.inventory.filter((row) => row.implementationStatus !== 'native');

  return (
    <div className="space-y-5">
      <Card>
        <SectionTitle
          icon={Boxes}
          title={`${native.length} type${native.length === 1 ? '' : 's'} authorable in this ERP`}
          hint="Each has a real table behind it. Node and part counts are this chapter's."
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="text-[11px] uppercase tracking-wide text-slate-400">
              <tr className="border-b border-slate-100">
                <th className="pb-2 pr-3 font-medium">Type</th>
                <th className="pb-2 pr-3 font-medium">Bloom</th>
                <th className="pb-2 pr-3 font-medium">Fluency</th>
                <th className="pb-2 pr-3 font-medium">Nodes</th>
                <th className="pb-2 pr-3 font-medium">Primary pedagogy</th>
                <th className="pb-2 font-medium">Engagement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {native.map((row) => (
                <tr key={row.h5pType} className="align-top">
                  <td className="py-2.5 pr-3">
                    <p className="font-medium text-slate-900">{row.label}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">{row.palUseCases.slice(0, 2).join(' · ')}</p>
                    {row.route && H5P_ROUTE_MAP[row.route] ? (
                      <Link
                        href={`${H5P_ROUTE_MAP[row.route]}?${contextQuery}`}
                        className="mt-1 inline-block text-[11px] font-semibold text-[#4f46e5] hover:underline"
                      >
                        Open module
                      </Link>
                    ) : null}
                  </td>
                  <td className="py-2.5 pr-3 text-slate-600">
                    {row.bloomFrom ? `${humanise(row.bloomFrom)}${row.bloomTo && row.bloomTo !== row.bloomFrom ? ` → ${humanise(row.bloomTo)}` : ''}` : '—'}
                  </td>
                  <td className="py-2.5 pr-3 text-slate-600">{humanise(row.fluencyTrackable)}</td>
                  <td className="py-2.5 pr-3 tabular-nums text-slate-900">
                    {row.available ? (
                      <>
                        {row.nodeCount}
                        {row.childLabel ? (
                          <span className="text-slate-400">
                            {' '}
                            / {row.childCount} {row.childLabel}s
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <span title={row.unavailableReason ?? ''} className="text-amber-600">
                        unavailable
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 pr-3 text-slate-600">
                    {row.pedagogies.primary.length > 0
                      ? row.pedagogies.primary.map((code) => labelFor(pedagogyTerms, code)).join(', ')
                      : row.pedagogies.secondary.length > 0
                        ? `${row.pedagogies.secondary.map((code) => labelFor(pedagogyTerms, code)).join(', ')} (secondary)`
                        : '—'}
                  </td>
                  <td className="py-2.5">
                    <EngagementCell engagement={row.engagement} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <SectionTitle
          icon={Target}
          title={`${planned.length} type${planned.length === 1 ? '' : 's'} in the model, not yet authorable here`}
          hint="Registered so the coverage matrix and pedagogy mappings are complete. Each becomes authorable the moment a source table is registered against it."
        />
        <div className="flex flex-wrap gap-1.5">
          {planned.map((row) => (
            <span
              key={row.h5pType}
              title={row.palUseCases.join(' · ')}
              className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600"
            >
              {row.label}
            </span>
          ))}
        </div>
      </Card>
    </div>
  );
}

function CoverageTab({ model }: { model: H5pChapterModel }) {
  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle
          icon={Brain}
          title="Pedagogy mix"
          hint="How this chapter's tagged nodes distribute across the 12 pedagogies."
        />
        <div className="space-y-2">
          {model.pedagogyDistribution
            .filter((row) => row.nodeCount > 0)
            .map((row) => (
              <div key={row.pedagogy} className="flex items-center gap-3">
                <span className="w-52 shrink-0 truncate text-xs text-slate-600">{row.label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-[#4f46e5]" style={{ width: `${row.share * 100}%` }} />
                </div>
                <span className="w-16 shrink-0 text-right text-xs tabular-nums text-slate-500">
                  {row.nodeCount} · {formatPercent(row.share)}
                </span>
              </div>
            ))}
          {model.pedagogyDistribution.every((row) => row.nodeCount === 0) ? (
            <p className="text-xs text-slate-400">No node in this chapter carries a pedagogy tag yet.</p>
          ) : null}
        </div>
      </Card>

      {model.coverage.map((framework) => (
        <Card key={framework.framework}>
          <SectionTitle
            icon={Grid3x3}
            title={`${framework.label} — ${framework.covered}/${framework.total} covered`}
            hint="A tag is covered when at least one H5P node in this chapter generates evidence for it."
          />
          <div className="space-y-2">
            {framework.tags.map((tag) => (
              <CoverageRow key={tag.code} tag={tag} />
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

function CoverageRow({ tag }: { tag: CoverageTag }) {
  const closer = tag.closesWith[0];

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-3.5 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${tag.covered ? 'bg-emerald-500' : 'bg-slate-300'}`}
          aria-hidden
        />
        <span className="truncate text-xs font-medium text-slate-800">{tag.label}</span>
        {tag.covered ? (
          <span className="text-[11px] tabular-nums text-slate-400">
            {tag.nodeCount} node{tag.nodeCount === 1 ? '' : 's'}
          </span>
        ) : null}
      </div>
      {!tag.covered && closer ? (
        <span className="text-[11px] text-slate-500">
          Close with <span className="font-medium text-slate-700">{closer.pedagogyLabel}</span>
          {closer.h5pTypeLabel ? (
            <>
              {' '}
              via <span className="font-medium text-slate-700">{closer.h5pTypeLabel}</span>
              {closer.implemented ? '' : ' (type not authorable here yet)'}
            </>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}

function EngagementTab({ model, registry }: { model: H5pChapterModel; registry: H5pRegistry }) {
  const measured = model.inventory.filter((row) => row.engagement?.measured);

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle
          icon={BarChart3}
          title="Engagement score composition"
          hint="Weights come from the registry; each signal is scored against an explicit reference so a number can be explained."
        />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {registry.engagementSignals.map((signal) => (
            <div key={signal.code} className="rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-3">
              <p className="text-xs font-medium text-slate-700">{signal.label}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
                {formatPercent(registry.engagementWeights[signal.code] ?? null)}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {!model.telemetry.available ? (
        <Card>
          <p className="text-xs text-amber-700">{model.telemetry.reason}</p>
        </Card>
      ) : measured.length === 0 ? (
        <EmptyState
          title="No engagement measured yet"
          hint={`No xAPI statement has arrived for this chapter's H5P content in the last ${model.telemetry.windowDays} days. Completion rate, session duration and engagement score stay blank until one does — they are measured, never estimated.`}
        />
      ) : (
        <Card>
          <SectionTitle icon={Activity} title="Measured engagement by type" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-xs">
              <thead className="text-[11px] uppercase tracking-wide text-slate-400">
                <tr className="border-b border-slate-100">
                  <th className="pb-2 pr-3 font-medium">Type</th>
                  <th className="pb-2 pr-3 font-medium">Weight</th>
                  <th className="pb-2 pr-3 font-medium">Completion</th>
                  <th className="pb-2 pr-3 font-medium">Avg session</th>
                  <th className="pb-2 pr-3 font-medium">Score</th>
                  <th className="pb-2 font-medium">Sample</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {measured.map((row) => (
                  <tr key={row.h5pType}>
                    <td className="py-2.5 pr-3 font-medium text-slate-900">{row.label}</td>
                    <td className="py-2.5 pr-3 tabular-nums text-slate-600">
                      ×{row.engagement?.engagementWeight.toFixed(2)}
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums text-slate-600">
                      {formatPercent(row.engagement?.completionRate ?? null)}
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums text-slate-600">
                      {formatMetric(row.engagement?.avgSessionDurationMinutes ?? null, ' min')}
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums text-slate-900">
                      {formatMetric(row.engagement?.avgEngagementScore ?? null)}
                    </td>
                    <td className="py-2.5 tabular-nums text-slate-500">
                      {row.engagement?.sampleSize} events · {row.engagement?.learners} learners
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function PedagogyTab({
  selection,
  pedagogyTerms,
  typeTerms,
}: {
  selection: PedagogySelection | null;
  pedagogyTerms: RegistryTerm[];
  typeTerms: RegistryTerm[];
}) {
  if (!selection) return <LoadingState label="Running the pedagogy selector…" />;

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle
          icon={Compass}
          title={selection.label ? `Selected: ${selection.label}` : 'No pedagogy could be selected'}
          hint={
            selection.selectedByRule
              ? `Matched by the "${humanise(selection.selectedByRule)}" rule.`
              : 'No registry rule produced a pedagogy this chapter can serve.'
          }
        />
        {selection.pedagogy ? (
          <div className="flex flex-wrap gap-1.5">
            {selection.h5pTypes.primary.map((code) => (
              <span
                key={code}
                className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-700"
              >
                {labelFor(typeTerms, code)}
              </span>
            ))}
            {selection.h5pTypes.secondary.map((code) => (
              <span
                key={code}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600"
              >
                {labelFor(typeTerms, code)}
              </span>
            ))}
          </div>
        ) : null}
      </Card>

      <Card>
        <SectionTitle
          icon={Target}
          title="Rule trace"
          hint="Rules are rows in the registry, evaluated in order. The first match wins."
        />
        <div className="space-y-1.5">
          {selection.trace.map((step) => (
            <div
              key={step.rule}
              className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 ${
                step.matched ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-100'
              }`}
            >
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-800">{step.label}</p>
                <p className="text-[11px] text-slate-500">{step.reason}</p>
              </div>
              {step.wouldSelect ? (
                <span className="shrink-0 text-[11px] font-medium text-slate-600">
                  → {labelFor(pedagogyTerms, step.wouldSelect)}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle
          icon={Layers3}
          title="Pedagogies this chapter can serve now"
          hint="A pedagogy is servable when its primary or secondary H5P type has content here."
        />
        {Object.keys(selection.availableInChapter).length === 0 ? (
          <p className="text-xs text-slate-400">None — this chapter has no H5P content yet.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(selection.availableInChapter).map(([pedagogy, info]) => (
              <span
                key={pedagogy}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600"
              >
                {labelFor(pedagogyTerms, pedagogy)}
                <span className="ml-1 text-slate-400">({info.nodeCount})</span>
              </span>
            ))}
          </div>
        )}
        {selection.history.sampleSize === 0 ? (
          <p className="mt-3 text-[11px] text-slate-400">
            No pedagogy engagement history for this learner in the last {selection.history.windowDays} days, so the
            ranking rule cannot fire yet.
          </p>
        ) : (
          <div className="mt-3 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Learner ranking ({selection.history.sampleSize} observations)
            </p>
            {selection.history.ranked.map((code, index) => (
              <p key={code} className="text-[11px] text-slate-600">
                {index + 1}. {labelFor(pedagogyTerms, code)} — {selection.history.scores[code]}
              </p>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/**
 * Insights — the DeepSeek layer over the xAPI stream.
 *
 * The evidence half is always shown and is entirely measured. The narration
 * half is generated on request, is clearly attributed to the model that wrote
 * it, and is only ever offered when there are real events behind it.
 */
function InsightsTab({
  insights,
  pedagogyTerms,
  typeTerms,
  onGenerate,
  busy,
}: {
  insights: H5pInsightsResult | null;
  pedagogyTerms: RegistryTerm[];
  typeTerms: RegistryTerm[];
  onGenerate: () => void;
  busy: boolean;
}) {
  if (!insights) return <LoadingState label="Reading the H5P event stream…" />;

  const { evidence, insight, ai } = insights;

  if (!evidence.telemetryAvailable) {
    return <EmptyState title="No xAPI event store" hint={evidence.telemetryReason ?? undefined} />;
  }

  if (!evidence.hasEvidence) {
    return (
      <EmptyState
        title="No H5P activity recorded yet"
        hint={`Nothing has been learned on this chapter's H5P content in the last ${evidence.windowDays} days. Insights are generated from the event stream, so there is nothing to interpret — they are not produced from the content alone.`}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle
          icon={Activity}
          title="What the event stream records"
          hint={`Measured over the last ${evidence.windowDays} days. Every figure below is computed from xAPI statements — no model is involved.`}
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Events" value={String(evidence.totals.events)} />
          <Stat label="Learners" value={String(evidence.totals.learners)} />
          <Stat label="Sessions" value={String(evidence.totals.sessions)} />
          <Stat label="Time on task" value={`${Math.round(evidence.totals.totalSeconds / 60)} min`} />
        </div>

        {evidence.byPedagogy.length > 0 ? (
          <div className="mt-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Accuracy by pedagogy</p>
            <div className="space-y-1.5">
              {evidence.byPedagogy.map((row) => (
                <div key={row.pedagogyTag} className="flex items-center gap-3">
                  <span className="w-48 shrink-0 truncate text-xs text-slate-600">{row.label}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${(row.accuracy ?? 0) < 0.6 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${(row.accuracy ?? 0) * 100}%` }}
                    />
                  </div>
                  <span className="w-32 shrink-0 text-right text-xs tabular-nums text-slate-500">
                    {formatPercent(row.accuracy)} · {row.attempts} att
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {evidence.attentionSignals.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {evidence.attentionSignals.map((signal) => (
              <span
                key={signal.verb}
                className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800"
              >
                {signal.label} ×{signal.occurrences}
              </span>
            ))}
          </div>
        ) : null}
      </Card>

      {evidence.struggles.length > 0 ? (
        <Card>
          <SectionTitle
            icon={AlertTriangle}
            title={`${evidence.struggles.length} item${evidence.struggles.length === 1 ? '' : 's'} below the accuracy threshold`}
            hint="Ranked by accuracy. Computed in SQL — which item is failing is arithmetic, not a judgement call."
          />
          <div className="space-y-1.5">
            {evidence.struggles.map((row) => (
              <div
                key={row.nodeKey}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-3.5 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-slate-800">{row.title}</p>
                  <p className="font-mono text-[10px] text-slate-400">{row.nodeKey}</p>
                </div>
                <span className="shrink-0 text-xs tabular-nums text-amber-700">
                  {formatPercent(row.accuracy)} over {row.attempts} attempts
                  {row.avgSeconds !== null ? ` · ${row.avgSeconds}s avg` : ''}
                </span>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {insight && insight.status === 'ok' ? (
        <Card className="border-violet-200">
          <SectionTitle icon={Lightbulb} title={insight.headline || 'Interpretation'} />

          {insight.observations.length > 0 ? (
            <div className="mb-4">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Observations</p>
              <ul className="space-y-1.5">
                {insight.observations.map((observation, index) => (
                  <li key={index} className="text-xs leading-relaxed text-slate-700">
                    {observation.text}
                    {observation.nodeKeys.length > 0 ? (
                      <span className="ml-1.5 font-mono text-[10px] text-slate-400">
                        {observation.nodeKeys.join(', ')}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {insight.whatIsWorking.length > 0 ? (
            <div className="mb-4">
              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-600">
                <TrendingUp className="h-3 w-3" />
                Working
              </p>
              <ul className="space-y-1.5">
                {insight.whatIsWorking.map((item, index) => (
                  <li key={index} className="text-xs leading-relaxed text-slate-700">
                    {item.text}
                    {item.pedagogyTag ? (
                      <span className="ml-1.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                        {labelFor(pedagogyTerms, item.pedagogyTag)}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {insight.nextActions.length > 0 ? (
            <div className="mb-4">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Suggested next</p>
              <div className="space-y-2">
                {insight.nextActions.map((action, index) => (
                  <div key={index} className="rounded-xl border border-violet-100 bg-violet-50/40 px-3.5 py-2.5">
                    <p className="text-xs font-medium text-slate-800">{action.action}</p>
                    <p className="mt-0.5 text-[11px] text-slate-600">{action.rationale}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {action.pedagogyTag ? (
                        <span className="rounded-full border border-violet-200 bg-white px-2 py-0.5 text-[10px] text-violet-700">
                          {labelFor(pedagogyTerms, action.pedagogyTag)}
                        </span>
                      ) : null}
                      {action.h5pType ? (
                        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-600">
                          {labelFor(typeTerms, action.h5pType)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="border-t border-slate-100 pt-3 text-[11px] text-slate-500">
            {insight.evidenceCaveat ? <p className="mb-1 italic">{insight.evidenceCaveat}</p> : null}
            <p>
              Written by {insight.model ?? 'the model'}
              {insight.provider ? ` via ${insight.provider}` : ''} from {insight.generatedFrom?.events ?? 0} events across{' '}
              {insight.generatedFrom?.nodes ?? 0} items
              {insight.confidence !== null ? ` · confidence ${insight.confidence}` : ''}
              {insight.cached ? ' · cached' : ''}. Interpretation only — every figure above it is measured.
            </p>
            {insight.droppedInvalidReferences.length > 0 ? (
              <p className="mt-1 text-amber-700">
                {insight.droppedInvalidReferences.length} invented reference
                {insight.droppedInvalidReferences.length === 1 ? '' : 's'} removed before display.
              </p>
            ) : null}
          </div>
        </Card>
      ) : (
        <Card>
          <SectionTitle
            icon={Lightbulb}
            title="Interpret this with DeepSeek"
            hint="The model reads only the measured figures above and says what they mean. It cannot produce a number, and any item or pedagogy it invents is removed before you see it."
          />
          {insight && insight.status !== 'ok' && insight.reason ? (
            <p className="mb-3 text-xs text-amber-700">{insight.reason}</p>
          ) : null}
          {ai.available ? (
            <button
              type="button"
              onClick={onGenerate}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#4f46e5] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#4338ca] disabled:opacity-60"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {busy ? 'Reading the evidence…' : 'Generate insight'}
            </button>
          ) : (
            <p className="text-xs text-amber-700">{ai.unavailableReason}</p>
          )}
        </Card>
      )}
    </div>
  );
}

function XapiTab({ registry, model }: { registry: H5pRegistry; model: H5pChapterModel }) {
  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle
          icon={Activity}
          title="xAPI event store"
          hint={'Statements are posted to /api/pal/h5p/xapi. Address a node with object.id set to "h5p_type:id" so engagement is attributable per node.'}
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Events" value={String(model.telemetry.totalEvents)} hint={`last ${model.telemetry.windowDays} days`} />
          <Stat label="Typed" value={String(model.telemetry.typedEvents)} hint="resolved to an H5P type" />
          <Stat label="Learners" value={String(model.telemetry.learners)} />
          <Stat label="Sessions" value={String(model.telemetry.sessions)} />
        </div>
        {model.telemetry.lastEventAt ? (
          <p className="mt-3 text-[11px] text-slate-400">Last event {model.telemetry.lastEventAt}</p>
        ) : null}
      </Card>

      <Card>
        <SectionTitle
          icon={Grid3x3}
          title={`${registry.xapiVerbs.length} verbs mapped`}
          hint="Verb IRI → PAL event type → the processors it feeds. Editing a registry row re-wires the pipeline."
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-xs">
            <thead className="text-[11px] uppercase tracking-wide text-slate-400">
              <tr className="border-b border-slate-100">
                <th className="pb-2 pr-3 font-medium">Verb</th>
                <th className="pb-2 pr-3 font-medium">PAL event</th>
                <th className="pb-2 font-medium">Feeds</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {registry.xapiVerbs.map((verb) => {
                const jobs = Array.isArray(verb.metadata.jobs) ? (verb.metadata.jobs as string[]) : [];
                return (
                  <tr key={verb.code}>
                    <td className="py-2.5 pr-3">
                      <p className="font-medium text-slate-900">{verb.label}</p>
                      <p className="font-mono text-[10px] text-slate-400">{verb.description}</p>
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-[11px] text-slate-600">
                      {String(verb.metadata.pal_event_type ?? '—')}
                    </td>
                    <td className="py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {jobs.map((job) => (
                          <span key={job} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                            {humanise(job)}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export default function H5pModelPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading the H5P Model…" />}>
      <H5pModelContent />
    </Suspense>
  );
}
