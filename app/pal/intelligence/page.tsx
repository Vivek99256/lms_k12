'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  Activity,
  Brain,
  ChevronDown,
  ChevronRight,
  Gauge,
  Loader2,
  Network,
  Search,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Users,
  X,
  Zap,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  defaultLearnerId,
  fetchLearnerState,
  fetchMisconceptionCluster,
  fetchPlateau,
  fetchRegression,
  fetchRemediation,
  fetchRisk,
  fetchVelocity,
  type V4Cluster,
  type V4Dimension,
  type V4LearnerState,
  type V4Plateau,
  type V4Regression,
  type V4Remediation,
  type V4Risk,
  type V4RiskKind,
  type V4Velocity,
} from '@/app/pal/data/pal-v4';

interface LearnerBundle {
  state: V4LearnerState | null;
  velocity: V4Velocity | null;
  plateau: V4Plateau | null;
  regression: V4Regression | null;
  risks: V4Risk[];
}

const RISK_KINDS: V4RiskKind[] = ['disengagement', 'failure', 'burnout'];
const RISK_LABEL: Record<V4RiskKind, string> = {
  disengagement: 'Disengagement',
  failure: 'Failure',
  burnout: 'Burnout',
};
const RISK_ICON: Record<V4RiskKind, ReactNode> = {
  disengagement: <Activity className="h-5 w-5" />,
  failure: <ShieldAlert className="h-5 w-5" />,
  burnout: <Zap className="h-5 w-5" />,
};

function riskTone(level: string): string {
  switch (level.toLowerCase()) {
    case 'critical':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    case 'high':
      return 'border-orange-200 bg-orange-50 text-orange-700';
    case 'moderate':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    default:
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
}

export default function PalIntelligencePage() {
  const [learnerId, setLearnerId] = useState('');
  const [period, setPeriod] = useState('week');
  const [bundle, setBundle] = useState<LearnerBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (id: string, periodValue: string, signal?: AbortSignal) => {
      const learner = id.trim();
      if (!learner) {
        setError('Enter a learner id to load intelligence.');
        return;
      }
      setLoading(true);
      setError(null);
      const [state, velocity, plateau, regression, ...risks] = await Promise.allSettled([
        fetchLearnerState(learner, signal),
        fetchVelocity(learner, periodValue, signal),
        fetchPlateau(learner, signal),
        fetchRegression(learner, signal),
        ...RISK_KINDS.map((kind) => fetchRisk(learner, kind, signal)),
      ]);
      if (signal?.aborted) return;

      const settledValue = <T,>(result: PromiseSettledResult<T>): T | null =>
        result.status === 'fulfilled' ? result.value : null;

      setBundle({
        state: settledValue(state),
        velocity: settledValue(velocity),
        plateau: settledValue(plateau),
        regression: settledValue(regression),
        risks: risks.map(settledValue).filter((r): r is V4Risk => r !== null),
      });

      if (state.status === 'rejected') {
        setError(
          state.reason instanceof Error
            ? state.reason.message
            : 'The PAL V4 API is unavailable. Ensure the backend is deployed.'
        );
      }
      setLoading(false);
    },
    []
  );

  useEffect(() => {
    const id = defaultLearnerId();
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate learner id + initial load on mount
    setLearnerId(id);
    if (id) {
      void load(id, 'week', controller.signal);
    }
    return () => controller.abort();
  }, [load]);

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <Brain className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">PAL Intelligence</h1>
            <p className="text-sm text-slate-500">
              PAL V4 learner intelligence, velocity, risk prediction and misconception analysis.
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-500">Learner id</span>
              <Input
                value={learnerId}
                onChange={(event) => setLearnerId(event.target.value)}
                placeholder="Learner id"
                className="h-9 w-40"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-500">Velocity period</span>
              <select
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="day">Day</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
              </select>
            </label>
            <Button onClick={() => void load(learnerId, period)} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Load
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {loading && !bundle ? (
          <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-16 text-sm text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading intelligence...
          </div>
        ) : bundle ? (
          <div className="space-y-4">
            {bundle.state && <CompetencyPanel state={bundle.state} />}

            {bundle.risks.length > 0 && (
              <div className="grid gap-3 md:grid-cols-3">
                {bundle.risks.map((risk) => (
                  <RiskCard key={risk.kind} risk={risk} />
                ))}
              </div>
            )}

            <div className="grid gap-3 lg:grid-cols-3">
              {bundle.velocity && <VelocityCard velocity={bundle.velocity} />}
              {bundle.plateau && <PlateauCard plateau={bundle.plateau} />}
              {bundle.regression && <RegressionCard regression={bundle.regression} />}
            </div>

            {bundle.state && (
              <div className="grid gap-3 lg:grid-cols-2">
                <DimensionPanel
                  title="Social learning"
                  icon={<Users className="h-4 w-4" />}
                  dimensions={bundle.state.social}
                />
                <DimensionPanel
                  title="Metacognition"
                  icon={<Network className="h-4 w-4" />}
                  dimensions={bundle.state.metacognition}
                />
              </div>
            )}
          </div>
        ) : null}

        <ConceptLens learnerId={learnerId} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panels
// ---------------------------------------------------------------------------

function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {children}
    </section>
  );
}

function PanelTitle({ icon, title, badge }: { icon: ReactNode; title: string; badge?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-slate-700">
        <span className="text-indigo-600">{icon}</span>
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {badge}
    </div>
  );
}

function CompetencyPanel({ state }: { state: V4LearnerState }) {
  const { competency, contextual } = state;
  const trendUp = competency.proficiencyTrend === 'improving';
  const trendDown = competency.proficiencyTrend === 'declining';
  return (
    <Panel>
      <PanelTitle
        icon={<Gauge className="h-4 w-4" />}
        title="Competency"
        badge={
          <span className="text-[11px] text-slate-400">
            {state.updatedAt ? `Updated ${state.updatedAt.slice(0, 10)}` : ''}
          </span>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="text-xs font-medium text-slate-500">Mastery score</div>
          <div className="mt-1 text-3xl font-bold text-slate-900">{competency.masteryScore}%</div>
          <div className="mt-2 h-1.5 rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-indigo-500"
              style={{ width: `${Math.min(100, competency.masteryScore)}%` }}
            />
          </div>
        </div>
        <Metric label="Bloom level" value={String(competency.bloomLevel)} />
        <Metric
          label="Proficiency trend"
          value={competency.proficiencyTrend}
          icon={
            trendUp ? (
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            ) : trendDown ? (
              <TrendingDown className="h-4 w-4 text-rose-600" />
            ) : null
          }
        />
        <Metric label="Learning velocity" value={String(competency.learningVelocity)} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4 text-xs">
        <Chip label="Knowledge gaps" value={String(competency.knowledgeGaps)} />
        <Chip label="Active misconceptions" value={String(competency.activeMisconceptions.length)} />
        <Chip label="Device" value={contextual.preferredDevice.join(', ') || '-'} />
        <Chip label="Bandwidth" value={contextual.bandwidthQuality} />
        <Chip label="Language" value={contextual.languagePreference} />
      </div>

      {competency.activeMisconceptions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {competency.activeMisconceptions.map((misconception) => (
            <span
              key={misconception.id}
              className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-medium text-rose-700"
            >
              {misconception.pattern.replace(/_/g, ' ')} · sev {misconception.severity}
            </span>
          ))}
        </div>
      )}
    </Panel>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 flex items-center gap-1.5 text-lg font-semibold capitalize text-slate-900">
        {icon}
        {value}
      </div>
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1">
      <span className="text-slate-400">{label}: </span>
      <span className="font-medium capitalize text-slate-700">{value}</span>
    </span>
  );
}

function RiskCard({ risk }: { risk: V4Risk }) {
  const pct = Math.round(risk.riskScore * 100);
  return (
    <Panel>
      <PanelTitle
        icon={RISK_ICON[risk.kind]}
        title={`${RISK_LABEL[risk.kind]} risk`}
        badge={
          <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize ${riskTone(risk.riskLevel)}`}>
            {risk.riskLevel}
          </span>
        }
      />
      <div className="text-3xl font-bold text-slate-900">{pct}%</div>
      <div className="mt-2 h-1.5 rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${pct >= 70 ? 'bg-rose-500' : pct >= 40 ? 'bg-amber-500' : 'bg-emerald-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {risk.predictedDaysUntilDisengage != null && (
        <div className="mt-2 text-xs text-slate-500">
          ~{risk.predictedDaysUntilDisengage} days until disengagement
        </div>
      )}
      {risk.signals.length > 0 && (
        <div className="mt-3 space-y-1 border-t border-slate-100 pt-3">
          {risk.signals.map((signal) => (
            <div key={signal.label} className="flex items-center justify-between text-xs">
              <span className="text-slate-500">{signal.label}</span>
              <span className="font-medium tabular-nums text-slate-700">{signal.value}</span>
            </div>
          ))}
        </div>
      )}
      {risk.recommendedActions.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3">
          {risk.recommendedActions.map((action, index) => (
            <li key={index} className="text-xs text-indigo-700">
              • {action}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function VelocityCard({ velocity }: { velocity: V4Velocity }) {
  return (
    <Panel>
      <PanelTitle
        icon={<TrendingUp className="h-4 w-4" />}
        title="Learning velocity"
        badge={
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold capitalize text-slate-600">
            {velocity.classification}
          </span>
        }
      />
      <div className="space-y-1.5 text-xs">
        <Row label="Concepts mastered" value={String(velocity.conceptsMastered)} />
        <Row label="Velocity" value={String(velocity.velocity)} />
        <Row label="Change" value={`${velocity.velocityChangePercent}%`} />
        <Row label="Retention stability" value={`${velocity.retentionStability}%`} />
        <Row label="Bloom growth" value={String(velocity.bloomGrowth)} />
        <Row label="Time to proficiency" value={`${velocity.timeToProficiencyHours}h`} />
      </div>
    </Panel>
  );
}

function PlateauCard({ plateau }: { plateau: V4Plateau }) {
  return (
    <Panel>
      <PanelTitle
        icon={<Activity className="h-4 w-4" />}
        title="Plateau"
        badge={
          <StatusBadge active={plateau.isPlateau} activeLabel="Plateau" idleLabel="Progressing" />
        }
      />
      <div className="space-y-1.5 text-xs">
        <Row label="Days in plateau" value={String(plateau.daysInPlateau)} />
        <Row label="Recent velocity" value={String(plateau.recentVelocity)} />
        <Row label="Older velocity" value={String(plateau.olderVelocity)} />
      </div>
      <ActionList actions={plateau.recommendedActions} />
    </Panel>
  );
}

function RegressionCard({ regression }: { regression: V4Regression }) {
  return (
    <Panel>
      <PanelTitle
        icon={<TrendingDown className="h-4 w-4" />}
        title="Regression"
        badge={
          <StatusBadge active={regression.isRegressing} activeLabel="Regressing" idleLabel="Stable" />
        }
      />
      <div className="space-y-1.5 text-xs">
        <Row label="Current mastery" value={`${regression.currentMastery}%`} />
        <Row label="Previous mastery" value={`${regression.previousMastery}%`} />
        <Row label="Decline" value={`${regression.declinePercent}%`} />
        <Row label="Declining concepts" value={String(regression.decliningConcepts)} />
      </div>
      <ActionList actions={regression.recommendedActions} />
    </Panel>
  );
}

function DimensionPanel({
  title,
  icon,
  dimensions,
}: {
  title: string;
  icon: ReactNode;
  dimensions: V4Dimension[];
}) {
  return (
    <Panel>
      <PanelTitle icon={icon} title={title} />
      <div className="space-y-2.5">
        {dimensions.map((dimension) => (
          <div key={dimension.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-40 shrink-0 text-slate-500">{dimension.label}</span>
              {dimension.percent != null && (
                <div className="h-1.5 flex-1 rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-indigo-400"
                    style={{ width: `${dimension.percent}%` }}
                  />
                </div>
              )}
            </div>
            <span className="font-medium tabular-nums text-slate-700">{dimension.value}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium tabular-nums text-slate-700">{value}</span>
    </div>
  );
}

function StatusBadge({
  active,
  activeLabel,
  idleLabel,
}: {
  active: boolean;
  activeLabel: string;
  idleLabel: string;
}) {
  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
        active ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
      }`}
    >
      {active ? activeLabel : idleLabel}
    </span>
  );
}

function ActionList({ actions }: { actions: string[] }) {
  if (actions.length === 0) return null;
  return (
    <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3">
      {actions.map((action, index) => (
        <li key={index} className="text-xs text-indigo-700">
          • {action}
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Concept lens: misconception clusters + remediation
// ---------------------------------------------------------------------------

function ConceptLens({ learnerId }: { learnerId: string }) {
  const [conceptId, setConceptId] = useState('1');
  const [clusters, setClusters] = useState<V4Cluster[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remediationFor, setRemediationFor] = useState<V4Cluster | null>(null);

  const load = async () => {
    if (!conceptId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      setClusters(await fetchMisconceptionCluster(conceptId.trim()));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load misconceptions.');
      setClusters(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Panel>
      <PanelTitle icon={<Brain className="h-4 w-4" />} title="Misconception analysis by concept" />
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Concept id</span>
          <Input
            value={conceptId}
            onChange={(event) => setConceptId(event.target.value)}
            placeholder="Concept id"
            className="h-9 w-40"
          />
        </label>
        <Button variant="outline" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Analyze
        </Button>
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
          {error}
        </div>
      )}

      {clusters && (
        <div className="mt-4 space-y-2">
          {clusters.length === 0 ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              No misconceptions recorded for this concept.
            </p>
          ) : (
            clusters.map((cluster) => (
              <ClusterCard
                key={cluster.id}
                cluster={cluster}
                onRemediation={() => setRemediationFor(cluster)}
              />
            ))
          )}
        </div>
      )}

      {remediationFor && (
        <RemediationModal
          learnerId={learnerId}
          cluster={remediationFor}
          onClose={() => setRemediationFor(null)}
        />
      )}
    </Panel>
  );
}

function ClusterCard({
  cluster,
  onRemediation,
}: {
  cluster: V4Cluster;
  onRemediation: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="flex min-w-0 flex-1 items-start gap-2 text-left"
        >
          {open ? (
            <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          ) : (
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          )}
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium capitalize text-slate-900">
                {cluster.pattern.replace(/_/g, ' ')}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium capitalize text-slate-600">
                {cluster.category.replace(/_/g, ' ')}
              </span>
              <span className="text-[11px] text-slate-400">freq {cluster.frequency}</span>
            </span>
            {open && cluster.rootCause && (
              <span className="mt-2 block whitespace-pre-line text-xs leading-relaxed text-slate-600">
                {cluster.rootCause}
              </span>
            )}
          </span>
        </button>
        <Button size="sm" variant="outline" onClick={onRemediation} className="shrink-0">
          Remediation
        </Button>
      </div>
    </div>
  );
}

function RemediationModal({
  learnerId,
  cluster,
  onClose,
}: {
  learnerId: string;
  cluster: V4Cluster;
  onClose: () => void;
}) {
  const [data, setData] = useState<V4Remediation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        setData(
          await fetchRemediation(learnerId || '0', String(cluster.id), controller.signal)
        );
      } catch (reason) {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : 'Unable to load remediation.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void run();
    return () => controller.abort();
  }, [learnerId, cluster.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/45" onClick={onClose} />
      <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Remediation</h2>
            <p className="text-xs capitalize text-slate-500">{cluster.pattern.replace(/_/g, ' ')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-slate-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading remediation...
            </div>
          ) : error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : !data || !data.found ? (
            <p className="py-8 text-center text-sm text-slate-500">
              No remediation is available for this misconception yet.
            </p>
          ) : (
            <div className="space-y-4">
              {data.aiContent && (
                <div>
                  <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
                    AI remediation
                  </h3>
                  <p className="whitespace-pre-line rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    {data.aiContent}
                  </p>
                </div>
              )}

              {data.preDefined.length > 0 && (
                <div>
                  <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
                    Pre-defined remediations
                  </h3>
                  <div className="space-y-2">
                    {data.preDefined.map((item) => (
                      <div key={item.id} className="rounded-lg border border-slate-200 px-4 py-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium capitalize text-slate-800">{item.type}</span>
                          <span className="text-[11px] text-slate-500">
                            {item.pedagogy} · {item.effectiveness}%
                          </span>
                        </div>
                        {item.content && <p className="mt-1 text-xs text-slate-600">{item.content}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data.alternativePedagogies.length > 0 && (
                <div>
                  <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
                    Alternative pedagogies
                  </h3>
                  <div className="space-y-1.5">
                    {data.alternativePedagogies.map((pedagogy) => (
                      <div key={pedagogy.type} className="rounded-lg border border-slate-200 px-4 py-2 text-xs">
                        <span className="font-semibold capitalize text-slate-800">{pedagogy.type}</span>
                        {pedagogy.reason && <span className="text-slate-500"> — {pedagogy.reason}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
