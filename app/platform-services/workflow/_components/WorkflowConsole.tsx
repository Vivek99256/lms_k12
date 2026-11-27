'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Brain,
  CheckCircle2,
  Eye,
  FileCheck,
  Loader2,
  Lock,
  MessageSquare,
  Plus,
  Save,
  ShieldAlert,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';

import { usePermissions } from '@/app/hooks/usePermission';
import {
  createWorkflow,
  deleteWorkflow,
  fetchFeesIntelligence,
  fetchWorkflows,
  PlatformApiError,
  previewWorkflowApprover,
  updateWorkflow,
} from '@/lib/platform/client';
import type {
  ConcessionKind,
  FeesIntelligenceData,
  RegistryOption,
  WorkflowApproverPreview,
  WorkflowChain,
  WorkflowInput,
  WorkflowPayload,
  WorkflowPoint,
  WorkflowStatus,
  WorkflowStep,
} from '@/lib/platform/types';

import {
  Card,
  ComponentFilter,
  ErrorState,
  LoadingState,
  Note,
  Pill,
  PlatformShell,
  RefreshButton,
  StatTiles,
  Switch,
  usePlatformRegistry,
} from '../../_components/shell';
import { ArrearsRankedPanel } from './fees-intelligence/ArrearsRankedPanel';
import { ConcessionQueuePanel } from './fees-intelligence/ConcessionQueuePanel';
import { EscalationReportPanel } from './fees-intelligence/EscalationReportPanel';
import { FamilyGroupsPanel } from './fees-intelligence/FamilyGroupsPanel';
import { RequestConcessionDialog } from './fees-intelligence/RequestConcessionDialog';
import { StepLadder } from './StepLadder';

/**
 * Workflow — module and component-wise approval configuration.
 *
 * A POINT IS NOT A CHAIN, and the screen is built around that distinction.
 * The product declares the POINTS: the places in each component where an action
 * can pause for a sign-off. A school defines the CHAINS against them, and may
 * define several on one point — "Concession above ₹10,000" with three steps and
 * "Concession up to ₹10,000" with one — told apart by their condition.
 *
 * SO POINTS WITH NO CHAIN ARE SHOWN, not hidden. Most points have none, and that
 * is exactly what an administrator came to see: a list of only the configured
 * ones would answer "what have we set up" while hiding "what is going
 * unapproved", which is the question that matters.
 *
 * NEW CHAINS START AS DRAFTS. Nothing begins intercepting real records because
 * somebody was experimenting; making a chain live is a separate, deliberate act.
 * The summary counts a point as governed only when it has an ACTIVE chain — a
 * draft governs nothing, and counting it would be the flattering number that
 * hides the gap.
 */

const RBAC_KEY = 'platform.workflow';

export interface WorkflowConsoleProps {
  /**
   * Pin the console to one module (`'fees'`), for a module that wants its own
   * approvals screen rather than sending its administrators to Platform services.
   *
   * THE SCOPE IS A REQUEST PARAMETER, NOT A FILTER OVER A FETCHED LIST. The key
   * travels to GET /api/platform/workflow as `module=`, the same way the module
   * rail's selection does, so the browser is never handed another module's
   * points or chains in the first place. Left undefined, the operator picks the
   * module from the rail — which is what Platform services does, unchanged.
   */
  module?: string;
  /** The trail above the title, for a console mounted inside another module. */
  breadcrumb?: React.ReactNode[];
  /** Render as a section inside a Fees category page rather than as a page. */
  embedded?: boolean;
  title?: string;
  description?: string;
}

export function WorkflowConsole({ module: pinnedModule, breadcrumb, title, description, embedded }: WorkflowConsoleProps = {}) {
  const { registry, problems, loading: registryLoading, error: registryError, reload } = usePlatformRegistry();
  const rights = usePermissions([RBAC_KEY]);

  const [moduleKey, setModuleKey] = useState<string | null>(pinnedModule ?? null);
  const [componentKey, setComponentKey] = useState<string | null>(null);

  const [payload, setPayload] = useState<WorkflowPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  /** Which chain is open in the editor: an id, or `new:<flow_key>`. */
  const [editing, setEditing] = useState<string | null>(null);

  const permissions = rights.permissions?.[RBAC_KEY];
  const mayCreate = permissions?.create ?? false;
  const mayUpdate = permissions?.update ?? false;
  const mayDelete = permissions?.delete ?? false;
  /**
   * Whether the server actually answered for `platform.workflow`.
   *
   * `usePermission` collapses "denied" and "not asked" into `false`, and the two
   * must not be confused here: telling an administrator "your role cannot change
   * approval workflows" is a claim about THEIR role, and if the server had no
   * entry for the key it has made no such claim. The banner below is suppressed
   * in that case, and the controls stay disabled — refusing is still the safe
   * answer, it just stops asserting a reason that was never given.
   */
  const rightsAnswered = !rights.unknownModules.includes(RBAC_KEY);
  const rightsReason = !rights.authenticated
    ? "Sign in again. We couldn't check your permissions."
    : !rightsAnswered
      ? 'This ERP does not report permissions for approval workflows yet, so they are read-only here. An administrator can enable changes in Group-wise Rights.'
      : 'Your role cannot change approval workflows for this institute.';

  const load = useCallback(
    (isRefresh = false) => {
      if (!isRefresh) setLoading(true);
      setError(null);

      fetchWorkflows({ module: moduleKey ?? undefined, component: componentKey ?? undefined })
        .then(setPayload)
        .catch((cause: unknown) => {
          setError(cause instanceof PlatformApiError ? cause.message : "Couldn't load the workflows. Try again.");
        })
        .finally(() => setLoading(false));
    },
    [moduleKey, componentKey],
  );

  useEffect(() => load(), [load]);

  const componentsOfModule = useMemo(
    () => (moduleKey && registry ? registry.components.filter((row) => row.module === moduleKey) : []),
    [registry, moduleKey],
  );

  const componentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!registry) return counts;
    for (const row of registry.workflows) {
      if (moduleKey && row.module !== moduleKey) continue;
      counts[row.component] = (counts[row.component] ?? 0) + 1;
    }
    return counts;
  }, [registry, moduleKey]);

  const saved = useCallback(
    (text: string) => {
      setNote({ tone: 'ok', text });
      setEditing(null);
      load(true);
    },
    [load],
  );

  const failed = useCallback((cause: unknown, fallback: string) => {
    setNote({ tone: 'error', text: cause instanceof PlatformApiError ? cause.message : fallback });
  }, []);

  const changeStatus = useCallback(
    async (chain: WorkflowChain, status: WorkflowStatus) => {
      try {
        await updateWorkflow(chain.id, { status });
        saved(`"${chain.name}" is now ${status}.`);
      } catch (cause) {
        failed(cause, "Couldn't change the status. Try again.");
      }
    },
    [saved, failed],
  );

  const remove = useCallback(
    async (chain: WorkflowChain) => {
      // A delete loses the configuration for good, and `disabled` exists exactly
      // so it rarely has to be the answer — so the confirmation says that.
      const confirmed = window.confirm(
        `Delete "${chain.name}" permanently?\n\nIf you only want to stop it running, set it to disabled instead — that keeps how it is set up.`,
      );
      if (!confirmed) return;

      try {
        await deleteWorkflow(chain.id);
        saved(`"${chain.name}" deleted.`);
      } catch (cause) {
        failed(cause, "Couldn't delete the workflow. Try again.");
      }
    },
    [saved, failed],
  );

  if (registryLoading) return <div className="p-6"><LoadingState label="Loading the platform registry" /></div>;
  if (registryError || !registry) return <div className="p-6"><ErrorState message={registryError ?? 'The registry is unavailable.'} onRetry={reload} /></div>;

  const summary = payload?.summary;

  const groups = (() => {
    const byComponent = new Map<string, { label: string; rows: WorkflowPoint[] }>();
    for (const point of payload?.points ?? []) {
      const group = byComponent.get(point.component) ?? { label: point.component_label, rows: [] };
      group.rows.push(point);
      byComponent.set(point.component, group);
    }
    return [...byComponent.entries()];
  })();

  return (
    <PlatformShell
      title={title ?? 'Workflow'}
      description={
        description ??
        'Every action in the ERP that can pause for a sign-off, module by module and component by component — and the approval chain each one runs through at this institute.'
      }
      countKey="workflows"
      registry={registry}
      problems={problems}
      breadcrumb={breadcrumb}
      modulePinned={Boolean(pinnedModule)}
      embedded={embedded}
      selectedModule={moduleKey}
      onSelectModule={(next) => {
        if (pinnedModule) return;
        setModuleKey(next);
        setComponentKey(null);
        setEditing(null);
      }}
      actions={<RefreshButton onClick={() => load(true)} busy={loading} />}
    >
      {note && <Note tone={note.tone} text={note.text} onDismiss={() => setNote(null)} />}

      {!mayUpdate && rightsAnswered && !rights.loading && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <Lock size={14} className="mr-1.5 inline align-text-bottom" />
          You can see these workflows but not change them. {rightsReason}
        </div>
      )}

      {!mayUpdate && !rightsAnswered && !rights.loading && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Lock size={14} className="mr-1.5 inline align-text-bottom" />
          You can see these workflows but not change them. {rightsReason}
        </div>
      )}

      {moduleKey && (
        <ComponentFilter components={componentsOfModule} selected={componentKey} onSelect={setComponentKey} counts={componentCounts} />
      )}

      {moduleKey === 'fees' && <FeesKgIntelligenceWidget />}

      {summary && (
        <StatTiles
          tiles={[
            { label: 'Approval points', value: summary.points, hint: 'in this scope' },
            {
              label: 'Governed',
              value: summary.governed,
              tone: summary.governed < summary.points ? 'amber' : 'green',
              hint: `${summary.points - summary.governed} have no active chain`,
            },
            { label: 'Active workflows', value: summary.active, tone: 'green' },
            { label: 'Drafts', value: summary.draft, tone: summary.draft > 0 ? 'amber' : 'gray' },
          ]}
        />
      )}

      {loading && !payload ? (
        <LoadingState label="Loading workflows" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => load()} />
      ) : !payload?.points.length ? (
        <Card className="px-4 py-10 text-center text-sm text-slate-600">
          This scope has no approval points. Components declare them in <code className="rounded bg-slate-100 px-1">config/platform_services.php</code>.
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map(([key, group]) => (
            <div key={key} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">{group.label}</span>
                <span className="font-mono text-[10px] text-slate-400">{key}</span>
              </div>
              {group.rows.map((point) => (
                <PointCard
                  key={point.key}
                  point={point}
                  approverTypes={registry.approver_types}
                  escalations={registry.escalation_actions}
                  editing={editing}
                  setEditing={setEditing}
                  onSaved={saved}
                  onFailed={failed}
                  onStatus={changeStatus}
                  onDelete={remove}
                  mayCreate={mayCreate}
                  mayUpdate={mayUpdate}
                  mayDelete={mayDelete}
                  rightsReason={rightsReason}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </PlatformShell>
  );
}

// ── One approval point ──────────────────────────────────────────────────────

function PointCard({
  point,
  approverTypes,
  escalations,
  editing,
  setEditing,
  onSaved,
  onFailed,
  onStatus,
  onDelete,
  mayCreate,
  mayUpdate,
  mayDelete,
  rightsReason,
}: {
  point: WorkflowPoint;
  approverTypes: RegistryOption[];
  escalations: RegistryOption[];
  editing: string | null;
  setEditing: (key: string | null) => void;
  onSaved: (text: string) => void;
  onFailed: (cause: unknown, fallback: string) => void;
  onStatus: (chain: WorkflowChain, status: WorkflowStatus) => void;
  onDelete: (chain: WorkflowChain) => void;
  mayCreate: boolean;
  mayUpdate: boolean;
  mayDelete: boolean;
  rightsReason: string;
}) {
  const newKey = `new:${point.key}`;
  const hasActive = point.workflows.some((chain) => chain.status === 'active');

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-slate-900">
            {point.label}
            {hasActive ? <Pill tone="green">governed</Pill> : <Pill tone="amber">no active approval</Pill>}
          </p>
          <p className="mt-0.5 text-xs text-slate-600">{point.description}</p>
          <p className="mt-1 font-mono text-[10px] text-slate-400">{point.key}</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(editing === newKey ? null : newKey)}
          disabled={!mayCreate}
          title={mayCreate ? undefined : rightsReason}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus size={13} />
          Add workflow
        </button>
      </div>

      {point.workflows.length === 0 && editing !== newKey && (
        <p className="px-4 py-4 text-sm text-slate-600">
          No approval chain here — <span className="font-medium">{point.subject.toLowerCase()}</span> goes through without a sign-off.
        </p>
      )}

      <ul className="divide-y divide-slate-100">
        {point.workflows.map((chain) =>
          editing === String(chain.id) ? (
            <li key={chain.id} className="bg-indigo-50/40 px-4 py-4">
              <ChainEditor
                point={point}
                chain={chain}
                approverTypes={approverTypes}
                escalations={escalations}
                onCancel={() => setEditing(null)}
                onSaved={onSaved}
                onFailed={onFailed}
              />
            </li>
          ) : (
            <li key={chain.id} className="px-4 py-3">
              <ChainRow
                chain={chain}
                approverTypes={approverTypes}
                onEdit={() => setEditing(String(chain.id))}
                onStatus={onStatus}
                onDelete={onDelete}
                mayUpdate={mayUpdate}
                mayDelete={mayDelete}
                rightsReason={rightsReason}
              />
            </li>
          ),
        )}

        {editing === newKey && (
          <li className="bg-indigo-50/40 px-4 py-4">
            <ChainEditor
              point={point}
              chain={null}
              approverTypes={approverTypes}
              escalations={escalations}
              onCancel={() => setEditing(null)}
              onSaved={onSaved}
              onFailed={onFailed}
            />
          </li>
        )}
      </ul>
    </Card>
  );
}

function ChainRow({
  chain,
  approverTypes,
  onEdit,
  onStatus,
  onDelete,
  mayUpdate,
  mayDelete,
  rightsReason,
}: {
  chain: WorkflowChain;
  approverTypes: RegistryOption[];
  onEdit: () => void;
  onStatus: (chain: WorkflowChain, status: WorkflowStatus) => void;
  onDelete: (chain: WorkflowChain) => void;
  mayUpdate: boolean;
  mayDelete: boolean;
  rightsReason: string;
}) {
  const tone = chain.status === 'active' ? 'green' : chain.status === 'draft' ? 'amber' : 'gray';

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-slate-900">
          {chain.name}
          <Pill tone={tone}>{chain.status}</Pill>
          {chain.condition && (
            <span title="Applies only when this is true. The engine evaluates it; this screen stores it as written.">
              <Pill tone="blue">when {chain.condition}</Pill>
            </span>
          )}
        </p>
        {chain.description && <p className="mt-0.5 text-xs text-slate-600">{chain.description}</p>}

        <StepLadder steps={chain.steps} approverTypes={approverTypes} />

        <p className="mt-1.5 text-[11px] text-slate-500">
          {chain.step_count} step{chain.step_count === 1 ? '' : 's'}
          {chain.total_sla_hours > 0 && ` · up to ${chain.total_sla_hours}h end to end`}
          {chain.on_reject === 'return_to_requester' ? ' · rejection returns to the requester' : ' · rejection closes the record'}
          {chain.updated_by && ` · changed by ${chain.updated_by}`}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <select
          value={chain.status}
          onChange={(event) => onStatus(chain, event.target.value as WorkflowStatus)}
          disabled={!mayUpdate}
          title={mayUpdate ? 'Change status' : rightsReason}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </select>
        <button
          type="button"
          onClick={onEdit}
          disabled={!mayUpdate}
          title={mayUpdate ? undefined : rightsReason}
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => onDelete(chain)}
          disabled={!mayDelete}
          title={mayDelete ? 'Delete permanently' : rightsReason}
          className="rounded-lg border border-slate-300 bg-white p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={`Delete ${chain.name}`}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

// ── The editor ──────────────────────────────────────────────────────────────

/** A step with everything filled in, so the form never binds to undefined. */
function blankStep(order: number): WorkflowStep {
  return {
    id: `tmp_${order}_${Math.random().toString(36).slice(2, 8)}`,
    order,
    name: '',
    approver_type: 'role',
    approver: '',
    sla_hours: 24,
    on_breach: 'remind',
    allow_delegate: true,
    require_comment: false,
  };
}

/**
 * "Preview who this resolves to" — runs the same graph resolution a real run
 * would use, against the signed-in admin's own org position (and, for
 * class_teacher, no student yet — see the server's own honesty rule), so an
 * admin can sanity-check a step before activating the chain rather than
 * finding out the first time a real record hits it.
 */
function ApproverPreview({ approverType }: { approverType: 'reporting_manager' | 'principal' | 'class_teacher' }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<WorkflowApproverPreview | null>(null);
  const [error, setError] = useState('');

  const run = useCallback(async () => {
    setStatus('loading');
    setError('');
    try {
      const preview = await previewWorkflowApprover({ approverType });
      setResult(preview);
      setStatus('done');
    } catch (err) {
      setError(err instanceof PlatformApiError ? err.message : 'Could not preview this step.');
      setStatus('error');
    }
  }, [approverType]);

  return (
    <div className="mt-1 flex items-center gap-1.5">
      <button
        type="button"
        onClick={run}
        disabled={status === 'loading'}
        className="inline-flex items-center gap-1 text-[10px] font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
      >
        <Eye size={11} />
        {status === 'loading' ? 'Checking…' : 'Preview who this resolves to'}
      </button>
      {status === 'done' && result && (
        <span className={`text-[10px] ${result.resolved ? 'text-emerald-700' : 'text-slate-500'}`}>
          {result.resolved ? `→ ${result.name}` : '→ not resolvable yet'}
        </span>
      )}
      {status === 'error' && <span className="text-[10px] text-red-600">{error}</span>}
    </div>
  );
}

function inr(amount: number): string {
  return '₹' + Math.round(amount).toLocaleString('en-IN');
}

/**
 * Risk tiers for an amount, reusing the SAME ₹5,000 / ₹25,000 boundaries the
 * Escalation Rule card shows (FeesEscalationReportService::classify()) —
 * an account above ₹25,000 is already the amount that would need Trustee
 * sign-off if a concession were requested against it, so calling it "high
 * risk" here is the same rule, not a second, competing threshold scheme.
 */
type RiskTier = 'high' | 'medium' | 'low';

function riskTier(amount: number): RiskTier {
  if (amount > 25000) return 'high';
  if (amount > 5000) return 'medium';
  return 'low';
}

const RISK_TONE: Record<RiskTier, 'red' | 'amber' | 'green'> = { high: 'red', medium: 'amber', low: 'green' };
const RISK_LABEL: Record<RiskTier, string> = { high: 'High', medium: 'Medium', low: 'Low' };
const RISK_ICON: Record<RiskTier, typeof AlertTriangle> = { high: AlertTriangle, medium: AlertCircle, low: CheckCircle2 };

/**
 * A risk-tier pill with its own icon, not colour alone — a red-green
 * distinction that relies only on hue is invisible to colour-blind readers,
 * and the icon shape (triangle / circle-with-dot / check) carries the same
 * meaning on its own.
 */
function RiskBadge({ tier, children }: { tier: RiskTier; children: React.ReactNode }) {
  const Icon = RISK_ICON[tier];
  return (
    <span className="animate-in zoom-in-75 fade-in-0 [--tw-animation-duration:250ms] inline-flex">
      <Pill tone={RISK_TONE[tier]}>
        <Icon size={11} className="shrink-0" />
        {children}
      </Pill>
    </span>
  );
}

/** Every card's content for one of the two states a real signal can be in. */
function Unavailable({ reason }: { reason: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-500 flex items-center gap-1.5">
      <AlertTriangle size={13} className="text-slate-400 shrink-0" />
      <span>{reason}</span>
    </div>
  );
}

/**
 * Fees Intelligence Widget for the Fees module:
 * Tenant-wide signals — sibling families, a bounded defaulter sample, real
 * channel engagement, TC no-dues clearance and the concession/refund queue.
 * There is no selected student on this screen, so these are aggregates, not
 * one learner's figures — see FeesIntelligenceData for what each section
 * means and why `available: false` is a real answer, not a loading state.
 *
 * Fetched lazily on first expand, not on mount: the defaulter and TC sections
 * each run several real per-student fee lookups server-side (20-30s cold),
 * so this should only run when someone actually asks to see it. The backend
 * caches the result for 15 minutes per tenant, so repeat opens are instant.
 */
type FeesPanelKey = 'families' | 'arrears' | 'queue' | 'escalation';

function FeesKgIntelligenceWidget() {
  const [data, setData] = useState<FeesIntelligenceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);

  const [activePanel, setActivePanel] = useState<FeesPanelKey | null>(null);
  const [focusAnchor, setFocusAnchor] = useState<number | null>(null);
  const [dialogTarget, setDialogTarget] = useState<{ studentId: number; studentName: string; kind: ConcessionKind } | null>(null);
  /** Bumped after a successful request or decision so the open drill-down (and the tenant summary) refetches. */
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    if (!expanded || data !== null) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchFeesIntelligence()
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof PlatformApiError ? err.message : 'Could not load fees intelligence.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // `loading` is deliberately not a dependency: it is only set inside this
    // effect, so including it would re-run the effect on every loading-state
    // flip for no reason — exactly the cascading-render pattern this hook
    // warns about. Re-entry is already prevented by `data !== null`.
  }, [expanded, data]);

  /**
   * A quiet background refetch of the tenant summary — used after a request
   * is submitted or a decision is recorded, so the six cards' own numbers
   * (pending counts, "already applied", etc.) catch up without flashing the
   * whole widget back to its loading state the way the first load does.
   */
  const reloadSummary = useCallback(() => {
    fetchFeesIntelligence()
      .then(setData)
      .catch(() => {
        /* keep showing the last good summary rather than blanking it on a transient refresh failure */
      });
  }, []);

  const bumpRefresh = useCallback(() => {
    setRefreshToken((token) => token + 1);
    reloadSummary();
  }, [reloadSummary]);

  const openConcessionDialog = useCallback((studentId: number, studentName: string) => {
    setDialogTarget({ studentId, studentName, kind: 'concession' });
  }, []);

  const chainActiveConcession = data?.concession_queue.available ? data.concession_queue.chain_active.concession : false;

  return (
    <div className="animate-in fade-in-0 [--tw-animation-duration:400ms] mb-4 overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/60 via-purple-50/40 to-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm ring-4 ring-indigo-100/70">
            <Sparkles size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-slate-800">Fees Intelligence</h4>
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-700">Live Signals</span>
            </div>
            <p className="text-xs text-slate-500">
              Sibling families, real fee arrears, channel engagement and the concession/refund queue — computed from this institute&apos;s own records.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 shadow-xs transition-all hover:bg-indigo-50 hover:shadow-sm active:scale-95"
        >
          {expanded ? 'Hide Insights' : 'View Insights'}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 pt-3 border-t border-indigo-100/70">
          {loading && (
            <div className="flex items-center gap-2 py-6 justify-center text-xs text-slate-500">
              <Loader2 size={14} className="animate-spin" />
              <span>Checking the live fee ledger for every signal below — this can take up to 30 seconds the first time.</span>
            </div>
          )}

          {!loading && error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
          )}

          {!loading && !error && data && (
            <>
              {/*
                Two separate grid rows, each followed immediately by its own
                drill-down panel(s) — not one grid of all six cards with every
                panel pooled below it. A panel used to render after the WHOLE
                grid regardless of which card opened it, so opening row 1's
                "Family & Sibling Groups" panel appeared below row 2 too,
                forcing a scroll past cards the operator never touched. Now
                each row's expand target lands right under that same row.
              */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="animate-in fade-in-0 slide-in-from-bottom-2 [--tw-animation-duration:350ms] [animation-fill-mode:backwards] rounded-xl border border-slate-200/80 bg-white p-3 shadow-xs transition-all duration-150 hover:shadow-md hover:border-indigo-200/80">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 mb-1">
                    <Users size={14} className="text-indigo-600" />
                    <span>Family & Sibling Groups</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mb-2">
                    Students who share a guardian contact number with another enrolled student — the sibling-concession candidates.
                  </p>
                  {data.siblings.available ? (
                    <FamilySummaryBody
                      siblings={data.siblings}
                      open={activePanel === 'families'}
                      onToggle={() => setActivePanel(activePanel === 'families' ? null : 'families')}
                    />
                  ) : (
                    <Unavailable reason={data.siblings.reason} />
                  )}
                </div>

                <div className="animate-in fade-in-0 slide-in-from-bottom-2 [--tw-animation-duration:350ms] [animation-delay:75ms] [animation-fill-mode:backwards] rounded-xl border border-slate-200/80 bg-white p-3 shadow-xs transition-all duration-150 hover:shadow-md hover:border-indigo-200/80">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 mb-1">
                    <AlertTriangle size={14} className="text-amber-500" />
                    <span>Largest Fee Arrears</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mb-2">
                    The highest-balance accounts right now, read from the same calculation the Fees screen itself uses.
                  </p>
                  {data.defaulter_risk.available ? (
                    <ArrearsSummaryBody
                      defaulterRisk={data.defaulter_risk}
                      open={activePanel === 'arrears'}
                      onToggle={() => setActivePanel(activePanel === 'arrears' ? null : 'arrears')}
                    />
                  ) : (
                    <Unavailable reason={data.defaulter_risk.reason} />
                  )}
                </div>

                <div className="animate-in fade-in-0 slide-in-from-bottom-2 [--tw-animation-duration:350ms] [animation-delay:150ms] [animation-fill-mode:backwards] rounded-xl border border-slate-200/80 bg-white p-3 shadow-xs transition-all duration-150 hover:shadow-md hover:border-indigo-200/80">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 mb-1">
                    <Brain size={14} className="text-purple-600" />
                    <span>Concession / Refund Queue</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mb-2">
                    Requests currently awaiting sign-off, classified against the ₹5k / ₹25k escalation rule.
                  </p>
                  {data.concession_queue.available ? (
                    <QueueSummaryBody
                      queue={data.concession_queue}
                      open={activePanel === 'queue'}
                      onToggle={() => setActivePanel(activePanel === 'queue' ? null : 'queue')}
                    />
                  ) : (
                    <Unavailable reason={data.concession_queue.reason} />
                  )}
                </div>
              </div>

              {/* Row 1's drill-downs — right under row 1, never under row 2. */}
              {activePanel === 'families' && data.siblings.available && (
                <div className="animate-in fade-in-0 slide-in-from-top-2 [--tw-animation-duration:300ms] mt-3 rounded-xl border border-indigo-100 bg-white p-3">
                  <FamilyGroupsPanel
                    ambiguous={data.siblings.ambiguous}
                    chainActiveConcession={chainActiveConcession}
                    refreshToken={refreshToken}
                    onRequestConcession={openConcessionDialog}
                    focusAnchor={focusAnchor}
                    onClearFocus={() => setFocusAnchor(null)}
                  />
                </div>
              )}

              {activePanel === 'arrears' && (
                <div className="animate-in fade-in-0 slide-in-from-top-2 [--tw-animation-duration:300ms] mt-3 rounded-xl border border-indigo-100 bg-white p-3">
                  <ArrearsRankedPanel
                    chainActiveConcession={chainActiveConcession}
                    refreshToken={refreshToken}
                    onRequestConcession={openConcessionDialog}
                    onViewFamily={(anchorId) => {
                      setFocusAnchor(anchorId);
                      setActivePanel('families');
                    }}
                  />
                </div>
              )}

              {activePanel === 'queue' && data.concession_queue.available && (
                <div className="animate-in fade-in-0 slide-in-from-top-2 [--tw-animation-duration:300ms] mt-3 rounded-xl border border-indigo-100 bg-white p-3">
                  <ConcessionQueuePanel summary={data.concession_queue} refreshToken={refreshToken} onRefresh={reloadSummary} />
                </div>
              )}

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="animate-in fade-in-0 slide-in-from-bottom-2 [--tw-animation-duration:350ms] [animation-fill-mode:backwards] rounded-xl border border-slate-200/80 bg-white p-3 shadow-xs transition-all duration-150 hover:shadow-md hover:border-indigo-200/80">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 mb-1">
                    <MessageSquare size={14} className="text-emerald-600" />
                    <span>Channel Engagement</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mb-2">
                    Real delivery/read and reply rates from the last {data.notification_channel_routing.available ? data.notification_channel_routing.window_days : 90} days.
                  </p>
                  {data.notification_channel_routing.available ? (
                    <ChannelSummaryBody routing={data.notification_channel_routing} />
                  ) : (
                    <Unavailable reason={data.notification_channel_routing.reason} />
                  )}
                </div>

                <div className="animate-in fade-in-0 slide-in-from-bottom-2 [--tw-animation-duration:350ms] [animation-delay:75ms] [animation-fill-mode:backwards] rounded-xl border border-slate-200/80 bg-white p-3 shadow-xs transition-all duration-150 hover:shadow-md hover:border-indigo-200/80">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 mb-1">
                    <FileCheck size={14} className="text-blue-600" />
                    <span>TC &quot;No Dues&quot; Clearance</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mb-2">
                    Transfer Certificate applications awaiting Accounts sign-off, checked against each student&apos;s real fee balance.
                  </p>
                  {data.tc_no_dues.available ? (
                    <TcSummaryBody tcNoDues={data.tc_no_dues} />
                  ) : (
                    <Unavailable reason={data.tc_no_dues.reason} />
                  )}
                </div>

                <div className="animate-in fade-in-0 slide-in-from-bottom-2 [--tw-animation-duration:350ms] [animation-delay:150ms] [animation-fill-mode:backwards] rounded-xl border border-slate-200/80 bg-white p-3 shadow-xs transition-all duration-150 hover:shadow-md hover:border-indigo-200/80 flex flex-col">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 mb-1">
                    <ShieldAlert size={14} className="text-amber-600" />
                    <span>Escalation Rule</span>
                  </div>
                  {data.escalation.available ? (
                    <EscalationSummaryBody
                      escalation={data.escalation}
                      open={activePanel === 'escalation'}
                      onToggle={() => setActivePanel(activePanel === 'escalation' ? null : 'escalation')}
                    />
                  ) : (
                    <Unavailable reason={data.escalation.reason} />
                  )}
                </div>
              </div>

              {/* Row 2's only drill-down — right under row 2. */}
              {activePanel === 'escalation' && data.escalation.available && (
                <div className="animate-in fade-in-0 slide-in-from-top-2 [--tw-animation-duration:300ms] mt-3 rounded-xl border border-indigo-100 bg-white p-3">
                  <EscalationReportPanel data={data.escalation} />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {dialogTarget && (
        <RequestConcessionDialog
          open
          onClose={() => setDialogTarget(null)}
          onSuccess={() => {
            setDialogTarget(null);
            bumpRefresh();
          }}
          studentId={dialogTarget.studentId}
          studentName={dialogTarget.studentName}
          kind={dialogTarget.kind}
        />
      )}
    </div>
  );
}

/** `FeesIntelligenceData['siblings']`, narrowed to the populated shape — passed as a typed prop so narrowing survives into JSX without re-reading the discriminated union inline. */
type SiblingsAvailable = Extract<FeesIntelligenceData['siblings'], { available: true }>;
type DefaulterRiskAvailable = Extract<FeesIntelligenceData['defaulter_risk'], { available: true }>;
type ChannelRoutingAvailable = Extract<FeesIntelligenceData['notification_channel_routing'], { available: true }>;
type TcNoDuesAvailable = Extract<FeesIntelligenceData['tc_no_dues'], { available: true }>;
type ConcessionQueueAvailable = Extract<FeesIntelligenceData['concession_queue'], { available: true }>;
type EscalationAvailable = Extract<FeesIntelligenceData['escalation'], { available: true }>;

function FamilySummaryBody({ siblings, open, onToggle }: { siblings: SiblingsAvailable; open: boolean; onToggle: () => void }) {
  const dupShare = Math.round((siblings.ambiguous.duplicate_name_groups / Math.max(siblings.family_groups, 1)) * 100);
  return (
    <div className="space-y-1.5">
      <div className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] text-emerald-800 space-y-0.5">
        <div>
          <strong>{siblings.family_groups}</strong> family groups, <strong>{siblings.students_in_groups}</strong> students
        </div>
        <div>
          {siblings.families_every_applied} fully applied &middot; {siblings.families_some_applied} partly &middot; {siblings.families_none_applied} none
        </div>
      </div>
      <div className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
        <strong>{siblings.ambiguous.duplicate_name_groups}</strong> of {siblings.family_groups} groups share a guardian name with a different number
        {siblings.family_groups > 0 && ` (${dupShare}%)`} — these need checking before they count as real siblings.
      </div>
      <button type="button" onClick={onToggle} className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800">
        {open ? 'Hide families' : 'Review family groups →'}
      </button>
    </div>
  );
}

function ArrearsSummaryBody({
  defaulterRisk,
  open,
  onToggle,
}: {
  defaulterRisk: DefaulterRiskAvailable;
  open: boolean;
  onToggle: () => void;
}) {
  // Risk tiers of the sample this card already carries (the top-5 worst
  // balances) — a real breakdown, not a second cohort sweep. The full,
  // properly-ranked list (every account, not just 5) has its own per-row
  // tier in the drill-down panel below.
  const tierCounts = { high: 0, medium: 0, low: 0 } as Record<RiskTier, number>;
  for (const row of defaulterRisk.top_defaulters) {
    tierCounts[riskTier(row.outstanding)]++;
  }

  return (
    <div className="space-y-1.5">
      <div className="rounded-lg bg-indigo-50 px-2.5 py-1.5 text-[11px] text-indigo-800 space-y-0.5">
        <div>
          <strong>{inr(defaulterRisk.total_outstanding)}</strong> outstanding across {defaulterRisk.defaulter_count} of {defaulterRisk.students_checked} checked
        </div>
        <div className="text-indigo-600">
          {defaulterRisk.truncated ? `worst-balance sample of ${defaulterRisk.cohort_size} enrolled` : `covers the whole cohort (${defaulterRisk.cohort_size})`}
        </div>
      </div>
      {defaulterRisk.top_defaulters.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {(['high', 'medium', 'low'] as const)
            .filter((tier) => tierCounts[tier] > 0)
            .map((tier) => (
              <RiskBadge key={tier} tier={tier}>
                {tierCounts[tier]} {RISK_LABEL[tier]} risk
              </RiskBadge>
            ))}
        </div>
      )}
      <button type="button" onClick={onToggle} className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800">
        {open ? 'Hide ranking' : 'View ranked list →'}
      </button>
    </div>
  );
}

function QueueSummaryBody({ queue, open, onToggle }: { queue: ConcessionQueueAvailable; open: boolean; onToggle: () => void }) {
  return (
    <div className="space-y-1.5">
      <div className="rounded-lg bg-purple-50 px-2.5 py-1.5 text-[11px] text-purple-800 space-y-0.5">
        <div>
          <strong>{queue.pending_count}</strong> pending ({queue.pending_by_flow.concession} concession, {queue.pending_by_flow.refund} refund)
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {queue.escalated_to_trustee > 0 && (
            <RiskBadge tier="high">{queue.escalated_to_trustee} needs Trustee sign-off</RiskBadge>
          )}
          <span>{queue.approved_awaiting.count} approved, awaiting application</span>
        </div>
      </div>
      {(!queue.chain_active.concession || !queue.chain_active.refund) && (
        <div className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800 space-y-0.5">
          {!queue.chain_active.concession && <div>No active concession chain yet.</div>}
          {!queue.chain_active.refund && <div>No active refund chain yet.</div>}
        </div>
      )}
      <button type="button" onClick={onToggle} className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800">
        {open ? 'Hide queue' : 'Manage the queue →'}
      </button>
    </div>
  );
}

function ChannelSummaryBody({ routing }: { routing: ChannelRoutingAvailable }) {
  return (
    <div className="space-y-1.5">
      <div className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] text-emerald-800 space-y-0.5">
        {routing.channels.whatsapp && (
          <div>
            WhatsApp: <strong>{routing.channels.whatsapp.read_rate}%</strong> read of {routing.channels.whatsapp.sent} sent
          </div>
        )}
        {routing.channels.direct_message && (
          <div>
            Direct messages: <strong>{routing.channels.direct_message.reply_rate}%</strong> replied of {routing.channels.direct_message.sent} sent
          </div>
        )}
        <div>
          Across {routing.family_reach.family_groups} family groups: {routing.family_reach.reached_90d} reached, {routing.family_reach.read_90d} read,{' '}
          {routing.family_reach.replied_90d} replied
        </div>
      </div>
      {routing.reminder_followup.available ? (
        <div className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-700 space-y-0.5">
          {Object.entries(routing.reminder_followup.by_channel).map(([channel, stats]) => (
            <div key={channel}>
              {channel}: {stats.reminders} reminders, {stats.rate}% followed by a payment within {routing.reminder_followup.available ? routing.reminder_followup.window_days : ''}d
            </div>
          ))}
          <p className="text-[10px] italic text-slate-500">{routing.reminder_followup.basis}</p>
        </div>
      ) : (
        <Unavailable reason={routing.reminder_followup.reason} />
      )}
    </div>
  );
}

function TcStatusPill({ status }: { status: 'zero_due' | 'has_dues' | 'not_checked' }) {
  if (status === 'zero_due') return <Pill tone="green">₹0 due today</Pill>;
  if (status === 'has_dues') return <Pill tone="red">has dues</Pill>;
  return <Pill tone="gray">not checked</Pill>;
}

function TcSummaryBody({ tcNoDues }: { tcNoDues: TcNoDuesAvailable }) {
  if (tcNoDues.pending_applications === 0) {
    return <Unavailable reason="No TC applications are awaiting clearance right now." />;
  }

  return (
    <div className="space-y-1.5">
      <div className="rounded-lg bg-blue-50 px-2.5 py-1.5 text-[11px] text-blue-800 space-y-0.5">
        <div>
          <strong>{tcNoDues.zero_due}</strong> of {tcNoDues.pending_applications} show ₹0 due today
        </div>
        <div>
          {tcNoDues.has_dues} still owe money &middot; {tcNoDues.not_checked} not checked yet
        </div>
      </div>
      <ul className="max-h-40 space-y-1 overflow-y-auto">
        {tcNoDues.applicants.slice(0, 15).map((applicant) => (
          <li key={applicant.student_id} className="rounded-lg border border-slate-100 px-2 py-1.5 text-[11px]">
            <div className="flex items-center justify-between gap-1.5">
              <span className="font-medium text-slate-800">{applicant.student_name ?? `#${applicant.student_id}`}</span>
              <TcStatusPill status={applicant.status} />
            </div>
            <div className="mt-0.5 text-slate-500">
              Self-reported paid upto {applicant.self_reported_dues_paid_upto ?? '—'} &middot; real outstanding {inr(applicant.outstanding)}
            </div>
          </li>
        ))}
      </ul>
      {tcNoDues.basis && <p className="text-[10px] italic text-slate-500">{tcNoDues.basis}</p>}
    </div>
  );
}

function EscalationSummaryBody({ escalation, open, onToggle }: { escalation: EscalationAvailable; open: boolean; onToggle: () => void }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] text-slate-500">
        &le; {inr(escalation.rule.accounts_max)} clears at Accounts; &gt; {inr(escalation.rule.principal_max)} needs Trustee.
        {!escalation.rule.enforced && ' Not yet auto-enforced by the approval engine.'}
      </p>
      {escalation.findings.length > 0 && (
        <div className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
          {escalation.findings.length} finding{escalation.findings.length === 1 ? '' : 's'} to review
        </div>
      )}
      <button type="button" onClick={onToggle} className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800">
        {open ? 'Hide report' : 'View full report →'}
      </button>
    </div>
  );
}

function ChainEditor({
  point,
  chain,
  approverTypes,
  escalations,
  onCancel,
  onSaved,
  onFailed,
}: {
  point: WorkflowPoint;
  /** Null when adding. */
  chain: WorkflowChain | null;
  approverTypes: RegistryOption[];
  escalations: RegistryOption[];
  onCancel: () => void;
  onSaved: (text: string) => void;
  onFailed: (cause: unknown, fallback: string) => void;
}) {
  // A new chain starts from the registry's suggestion rather than an empty
  // ladder: an approval with no steps approves everything, and is the one shape
  // that is never what anybody meant.
  const [name, setName] = useState(chain?.name ?? point.label);
  const [description, setDescription] = useState(chain?.description ?? '');
  const [condition, setCondition] = useState(chain?.condition ?? '');
  const [status, setStatus] = useState<WorkflowStatus>(chain?.status ?? 'draft');
  const [onReject, setOnReject] = useState<WorkflowChain['on_reject']>(chain?.on_reject ?? 'return_to_requester');
  const [notifyRequester, setNotifyRequester] = useState(chain?.notify_requester ?? true);
  const [steps, setSteps] = useState<WorkflowStep[]>(
    chain?.steps.length ? chain.steps : point.suggested_steps.length ? point.suggested_steps : [blankStep(1)],
  );
  const [busy, setBusy] = useState(false);

  const patchStep = (index: number, patch: Partial<WorkflowStep>) =>
    setSteps((current) => current.map((step, position) => (position === index ? { ...step, ...patch } : step)));

  const move = (index: number, delta: number) =>
    setSteps((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      // `order` is derived from position on the server too; keeping it in step
      // here stops the visible numbering disagreeing with what gets saved.
      return next.map((step, position) => ({ ...step, order: position + 1 }));
    });

  const submit = async () => {
    setBusy(true);
    const input: WorkflowInput = {
      name,
      description,
      condition,
      status,
      on_reject: onReject,
      notify_requester: notifyRequester,
      steps: steps.map((step, index) => ({ ...step, order: index + 1 })),
    };

    try {
      if (chain) {
        await updateWorkflow(chain.id, input);
        onSaved(`"${name}" saved.`);
      } else {
        await createWorkflow({ ...input, flow_key: point.key });
        onSaved(`"${name}" created as a ${status}.`);
      }
    } catch (cause) {
      onFailed(cause, "Couldn't save the workflow. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const totalSla = steps.reduce((sum, step) => sum + (Number(step.sla_hours) || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            placeholder={point.label}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Applies when
          </span>
          <input
            value={condition}
            onChange={(event) => setCondition(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            placeholder="always — or e.g. amount > 10000"
          />
          <span className="mt-0.5 block text-[10px] text-slate-500">
            Leave empty and the chain always applies. Several chains on one point are told apart by this.
          </span>
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Description</span>
        <input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          placeholder="What this chain is for, in your own words"
        />
      </label>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Steps — {point.subject} goes to each in turn
          </span>
          <span className="text-[11px] text-slate-500">{totalSla > 0 && `up to ${totalSla}h end to end`}</span>
        </div>

        <ol className="space-y-2">
          {steps.map((step, index) => {
            const type = approverTypes.find((option) => option.key === step.approver_type);
            const needsValue = type?.needs_value ?? false;

            return (
              <li key={step.id} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">
                    {index + 1}
                  </span>
                  <input
                    value={step.name}
                    onChange={(event) => patchStep(index, { name: event.target.value })}
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    placeholder="What this step is called, e.g. Accounts verification"
                  />
                  <button type="button" onClick={() => move(index, -1)} disabled={index === 0} className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30" aria-label="Move up">
                    <ArrowUp size={13} />
                  </button>
                  <button type="button" onClick={() => move(index, 1)} disabled={index === steps.length - 1} className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30" aria-label="Move down">
                    <ArrowDown size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSteps((current) => current.filter((_, position) => position !== index))}
                    className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="Remove step"
                  >
                    <X size={13} />
                  </button>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-medium text-slate-500">Approved by</span>
                    <select
                      value={step.approver_type}
                      onChange={(event) =>
                        patchStep(index, {
                          approver_type: event.target.value as WorkflowStep['approver_type'],
                          // The derived types resolve from the record at run
                          // time, so a value left behind would be read by nobody
                          // and believed by somebody.
                          approver: approverTypes.find((option) => option.key === event.target.value)?.needs_value ? step.approver : '',
                        })
                      }
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                    >
                      {approverTypes.map((option) => (
                        <option key={option.key} value={option.key} title={option.description}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[10px] font-medium text-slate-500">
                      {needsValue ? (step.approver_type === 'user' ? 'User id' : 'Role name') : 'Resolved automatically'}
                    </span>
                    <input
                      value={step.approver}
                      onChange={(event) => patchStep(index, { approver: event.target.value })}
                      disabled={!needsValue}
                      placeholder={needsValue ? 'e.g. Accounts' : type?.description ?? ''}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-50 disabled:text-slate-400"
                    />
                    {!needsValue
                      && (step.approver_type === 'reporting_manager'
                        || step.approver_type === 'principal'
                        || step.approver_type === 'class_teacher') && (
                      <ApproverPreview approverType={step.approver_type} />
                    )}
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[10px] font-medium text-slate-500">Act within (hours)</span>
                    <input
                      type="number"
                      min={0}
                      max={2160}
                      value={step.sla_hours}
                      onChange={(event) => patchStep(index, { sla_hours: Math.max(0, Number(event.target.value) || 0) })}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[10px] font-medium text-slate-500">If nobody acts</span>
                    <select
                      value={step.on_breach}
                      onChange={(event) => patchStep(index, { on_breach: event.target.value as WorkflowStep['on_breach'] })}
                      disabled={step.sla_hours === 0}
                      title={step.sla_hours === 0 ? 'Set an SLA first — there is nothing for this to happen after.' : undefined}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-50 disabled:text-slate-400"
                    >
                      {escalations.map((option) => (
                        <option key={option.key} value={option.key} title={option.description}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="mt-2 flex flex-wrap gap-4">
                  <label className="flex items-center gap-1.5 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={step.allow_delegate}
                      onChange={(event) => patchStep(index, { allow_delegate: event.target.checked })}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    Approver may delegate
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={step.require_comment}
                      onChange={(event) => patchStep(index, { require_comment: event.target.checked })}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    Comment required to approve
                  </label>
                </div>

                {/* Said next to the control that causes it, not in a summary
                    somewhere else: this is the one option that removes a person
                    from the decision. */}
                {step.on_breach === 'auto_approve' && step.sla_hours > 0 && (
                  <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
                    After {step.sla_hours}h with no response, this step approves itself — no person will have looked at it.
                  </p>
                )}
              </li>
            );
          })}
        </ol>

        <button
          type="button"
          onClick={() => setSteps((current) => [...current, blankStep(current.length + 1)])}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <Plus size={13} />
          Add step
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-4 border-t border-slate-200 pt-3">
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as WorkflowStatus)}
            className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
          >
            <option value="draft">Draft — does not run</option>
            <option value="active">Active — runs</option>
            <option value="disabled">Disabled — kept but not running</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">If rejected</span>
          <select
            value={onReject}
            onChange={(event) => setOnReject(event.target.value as WorkflowChain['on_reject'])}
            className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
          >
            <option value="return_to_requester">Return to the requester</option>
            <option value="close">Close the record</option>
          </select>
        </label>

        <label className="flex items-center gap-2 pb-1.5 text-xs text-slate-600">
          <Switch
            size="sm"
            checked={notifyRequester}
            onChange={setNotifyRequester}
            label="Tell the requester at each step"
          />
          Tell the requester at each step
        </label>
      </div>

      {status === 'active' && steps.length === 0 && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          An active workflow needs at least one step. Add a step, or leave it as a draft.
        </p>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy || !name.trim() || (status === 'active' && steps.length === 0)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Save size={14} />
          {busy ? 'Saving…' : chain ? 'Save workflow' : 'Create workflow'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <X size={14} />
          Cancel
        </button>
      </div>
    </div>
  );
}
