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
import { getViewAsStudent, setViewAsStudent, useViewAsStudent } from '@/app/pal/data/pal-view-as';
import { fetchClassStudents, isStudentSession, type PalClassStudent } from '@/app/pal/data/pal-lookups';
import ViewAsBanner from '@/app/pal/_components/ViewAsBanner';

interface LearnerBundle {
  state: V4LearnerState | null;
  velocity: V4Velocity | null;
  plateau: V4Plateau | null;
  regression: V4Regression | null;
  risks: V4Risk[];
}

/**
 * Shown wherever the backend reports null, i.e. it has no source for that
 * figure at all. Distinct from a measured zero on purpose: several PAL
 * dimensions (social learning, metacognition, rural/urban locality) have no
 * capture path in the estate yet, and printing 0 or 'urban' for them made
 * absent data look like a real -- and usually bad -- reading.
 */
const NOT_TRACKED = 'Not tracked';

function fmtValue(value: number | string | null | undefined, suffix = ''): string {
  if (value === null || value === undefined || value === '') return NOT_TRACKED;
  return `${value}${suffix}`;
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
  const [isStudent, setIsStudent] = useState(false);
  const [learnerId, setLearnerId] = useState('');
  const [period, setPeriod] = useState('week');
  const [bundle, setBundle] = useState<LearnerBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roster, setRoster] = useState<PalClassStudent[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);

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

  const viewingStudent = useViewAsStudent();

  useEffect(() => {
    const student = isStudentSession();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate role on mount
    setIsStudent(student);
    const controller = new AbortController();

    // Students only ever see their own intelligence — "view as student" is a
    // staff-only picker and must not apply to a real student session.
    if (student) {
      const id = defaultLearnerId();
       
      setLearnerId(id);
      if (id) void load(id, 'week', controller.signal);
      return () => controller.abort();
    }

    // STAFF: only auto-load an id that is actually a learner.
    //
    // This used to fall back to defaultLearnerId() — the *teacher's own* user
    // id. Staff have no pal_competencies rows, so every panel came back
    // has_data:false and the whole dashboard rendered as "Not tracked", which
    // reads as a broken screen rather than as "pick a student first". The
    // learner is now whatever the shared "view as student" context holds, and
    // the empty state below prompts for a pick when it holds nothing.
    const picked = getViewAsStudent()?.studentId || '';
     
    setLearnerId(picked);
    if (picked) void load(picked, 'week', controller.signal);

    // The roster behind the picker. Already scoped server-side to this
    // teacher's assigned classes (class_teacher / timetable) by
    // PalWorkspaceController::students, so it never lists a learner that
    // pal.auth would then refuse.
    void (async () => {
      setRosterLoading(true);
      try {
        const rows = await fetchClassStudents({}, controller.signal);
        if (!controller.signal.aborted) setRoster(rows);
      } catch (reason) {
        if (controller.signal.aborted) return;
        setRosterError(
          reason instanceof Error ? reason.message : 'Unable to load your students.'
        );
      } finally {
        if (!controller.signal.aborted) setRosterLoading(false);
      }
    })();

    return () => controller.abort();
  }, [load]);

  /** Staff picked a learner: load them and persist across the PAL screens. */
  const selectLearner = useCallback(
    (id: string) => {
      setLearnerId(id);
      const match = roster.find((row) => row.id === id);
      setViewAsStudent(
        match
          ? {
              studentId: match.id,
              name: match.name,
              gradeId: match.gradeId,
              standardId: match.standardId,
              divisionId: match.divisionId,
              enrollmentNo: match.enrollmentNo,
            }
          : null
      );
      if (id) void load(id, period);
    },
    [load, period, roster]
  );

  return (
    <div className="min-h-full px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-[1800px] space-y-5">
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

        {!isStudent && viewingStudent && (
          <ViewAsBanner
            student={viewingStudent}
            onExit={() => {
              setViewAsStudent(null);
              const self = defaultLearnerId();
              setLearnerId(self);
              if (self) void load(self, period);
            }}
          />
        )}

        {/* Controls */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-3">
            {/* Staff pick from their own roster. The free-text id stays for
                admins who already know an id, but a teacher should never have
                to guess one — and anything they could pick here is already
                inside what pal.auth will allow. */}
            {!isStudent && (
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-500">Student</span>
                <select
                  value={roster.some((row) => row.id === learnerId) ? learnerId : ''}
                  onChange={(event) => selectLearner(event.target.value)}
                  disabled={rosterLoading || roster.length === 0}
                  className="h-9 min-w-56 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-50 disabled:text-slate-400"
                >
                  <option value="">
                    {rosterLoading
                      ? 'Loading your students...'
                      : roster.length === 0
                        ? 'No students in your classes'
                        : 'Select a student'}
                  </option>
                  {roster.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                      {row.standardName ? ` — ${row.standardName}` : ''}
                      {row.divisionName ? ` ${row.divisionName}` : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {!isStudent && (
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-500">Learner id</span>
                <Input
                  value={learnerId}
                  onChange={(event) => setLearnerId(event.target.value)}
                  placeholder="Learner id"
                  className="h-9 w-40"
                />
              </label>
            )}
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

        {rosterError && !isStudent && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {rosterError} You can still enter a learner id directly.
          </div>
        )}

        {loading && !bundle ? (
          <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-16 text-sm text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading intelligence...
          </div>
        ) : !isStudent && !bundle ? (
          /* Staff landing state. Previously this auto-loaded the teacher's own
             user id and rendered a full dashboard of "Not tracked" — the same
             thing a genuinely broken backend looks like. */
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
            <Brain className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-700">
              Select a student to view their intelligence
            </p>
            <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
              PAL Intelligence is per learner. Staff accounts have no learning record of
              their own, so pick one of your students above — the list is limited to your
              assigned classes.
            </p>
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
                  hasData={bundle.state.socialHasData}
                  emptyNote="No peer-collaboration, classroom-participation or discussion capture is wired up for this estate yet, so these cannot be measured."
                />
                <DimensionPanel
                  title="Metacognition"
                  icon={<Network className="h-4 w-4" />}
                  dimensions={bundle.state.metacognition}
                  hasData={bundle.state.metacognitionHasData}
                  emptyNote="Reflections, self-corrections, learning plans and strategy choices have no capture path yet, so these cannot be measured."
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
          <div className="mt-1 text-3xl font-bold text-slate-900">
            {competency.masteryScore === null ? NOT_TRACKED : `${competency.masteryScore}%`}
          </div>
          {/* No bar at all when unmeasured: a 0%-wide track reads as a measured
              zero rather than as "never assessed". */}
          {competency.masteryScore !== null && (
            <div className="mt-2 h-1.5 rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-indigo-500"
                style={{ width: `${Math.min(100, competency.masteryScore)}%` }}
              />
            </div>
          )}
        </div>
        <Metric label="Bloom level" value={fmtValue(competency.bloomLevel)} />
        <Metric
          label="Proficiency trend"
          value={competency.proficiencyTrend ?? NOT_TRACKED}
          icon={
            trendUp ? (
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            ) : trendDown ? (
              <TrendingDown className="h-4 w-4 text-rose-600" />
            ) : null
          }
        />
        <Metric label="Learning velocity" value={fmtValue(competency.learningVelocity)} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4 text-xs">
        <Chip label="Knowledge gaps" value={String(competency.knowledgeGaps)} />
        <Chip label="Active misconceptions" value={String(competency.activeMisconceptions.length)} />
        <Chip label="Prerequisites flagged" value={String(competency.conceptDependencies)} />
        <Chip label="Device" value={contextual.preferredDevice.join(', ') || NOT_TRACKED} />
        <Chip label="Bandwidth" value={contextual.bandwidthQuality ?? NOT_TRACKED} />
        <Chip label="Language" value={contextual.languagePreference ?? NOT_TRACKED} />
        <Chip label="Locality" value={contextual.ruralUrbanContext ?? NOT_TRACKED} />
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
            {velocity.classification ?? NOT_TRACKED}
          </span>
        }
      />
      {/* The window is anchored to this learner's own last evidence, which in
          this estate is often months old. Saying so is the difference between
          "learning stalled" and "we last saw them in April". */}
      {velocity.asOf && (
        <p className="mb-2 text-[11px] text-slate-400">
          Measured over the learner&apos;s last active {velocity.period} to{' '}
          {velocity.asOf.slice(0, 10)}
          {velocity.daysSinceEvidence !== null && velocity.daysSinceEvidence > 0
            ? ` (${velocity.daysSinceEvidence} days ago)`
            : ''}
        </p>
      )}
      <div className="space-y-1.5 text-xs">
        <Row label="Concepts mastered" value={fmtValue(velocity.conceptsMastered)} />
        <Row label="Velocity" value={fmtValue(velocity.velocity)} />
        <Row
          label="Cohort rank"
          value={
            velocity.velocityPercentile === null
              ? NOT_TRACKED
              : `${velocity.velocityPercentile}th pct of ${velocity.cohortSize ?? '?'}`
          }
        />
        <Row label="Change" value={fmtValue(velocity.velocityChangePercent, '%')} />
        <Row label="Retention stability" value={fmtValue(velocity.retentionStability, '%')} />
        <Row label="Bloom growth" value={fmtValue(velocity.bloomGrowth)} />
        <Row label="Time to proficiency" value={fmtValue(velocity.timeToProficiencyHours, 'h')} />
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
          plateau.isPlateau === null ? (
            <UnknownBadge />
          ) : (
            <StatusBadge active={plateau.isPlateau} activeLabel="Plateau" idleLabel="Progressing" />
          )
        }
      />
      <div className="space-y-1.5 text-xs">
        <Row label="Days in plateau" value={fmtValue(plateau.daysInPlateau)} />
        <Row label="Recent velocity" value={fmtValue(plateau.recentVelocity)} />
        <Row label="Older velocity" value={fmtValue(plateau.olderVelocity)} />
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
          regression.isRegressing === null ? (
            <UnknownBadge />
          ) : (
            <StatusBadge
              active={regression.isRegressing}
              activeLabel="Regressing"
              idleLabel="Stable"
            />
          )
        }
      />
      <div className="space-y-1.5 text-xs">
        <Row label="Current mastery" value={fmtValue(regression.currentMastery, '%')} />
        <Row label="Previous mastery" value={fmtValue(regression.previousMastery, '%')} />
        <Row label="Decline" value={fmtValue(regression.declinePercent, '%')} />
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
  hasData = true,
  emptyNote,
}: {
  title: string;
  icon: ReactNode;
  dimensions: V4Dimension[];
  hasData?: boolean;
  emptyNote?: string;
}) {
  return (
    <Panel>
      <PanelTitle icon={icon} title={title} badge={hasData ? undefined : <UnknownBadge />} />
      {/* Says why the panel is empty. Several PAL dimensions have no capture
          path in this estate at all, and an unexplained column of blanks reads
          as a broken screen rather than as un-instrumented data. */}
      {!hasData && emptyNote && <p className="mb-3 text-[11px] text-slate-400">{emptyNote}</p>}
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
            <span
              className={`font-medium tabular-nums ${
                dimension.value === null ? 'text-slate-400' : 'text-slate-700'
              }`}
            >
              {dimension.value === null ? NOT_TRACKED : dimension.value}
            </span>
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

/**
 * For a yes/no signal the engine could not evaluate. Rendering the "idle" arm
 * of StatusBadge instead would assert the reassuring answer ("Progressing",
 * "Stable") for a learner nothing is actually known about.
 */
function UnknownBadge() {
  return (
    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500">
      {NOT_TRACKED}
    </span>
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
              // Keyed by source+id: ids are unique only WITHIN a registry, so
              // `id` alone can collide between a library and a runtime entry.
              <ClusterCard
                key={`${cluster.source}:${cluster.id}`}
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
              {cluster.category && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium capitalize text-slate-600">
                  {cluster.category.replace(/_/g, ' ')}
                </span>
              )}
              {/* Which registry this came from. Curated library entries and
                  runtime-detected ones carry very different confidence. */}
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  cluster.source === 'library'
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'bg-amber-50 text-amber-700'
                }`}
              >
                {cluster.source === 'library' ? 'Curated' : 'Detected'}
              </span>
              {cluster.severity && (
                <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium capitalize text-rose-700">
                  {cluster.severity}
                </span>
              )}
              {/* All but one library row is still `draft`; flag it rather than
                  hiding unreviewed content behind a servable filter. */}
              {cluster.qualityStatus && cluster.qualityStatus !== 'approved' && (
                <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] font-medium capitalize text-slate-500">
                  {cluster.qualityStatus}
                </span>
              )}
              {cluster.frequency > 0 && (
                <span className="text-[11px] text-slate-400">freq {cluster.frequency}</span>
              )}
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
          // cluster.source is part of the id's identity -- library and runtime
          // misconception ids overlap, so dropping it resolves the wrong row.
          await fetchRemediation(
            learnerId || '0',
            String(cluster.id),
            cluster.source,
            controller.signal
          )
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
    // cluster.source is part of the identity of the row being fetched, so it
    // belongs in the dependency list alongside the id -- the same id under a
    // different source is a different misconception.
  }, [learnerId, cluster.id, cluster.source]);

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
