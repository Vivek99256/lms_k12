'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Lock, Plus, Save, Trash2, X } from 'lucide-react';

import { usePermissions } from '@/app/hooks/usePermission';
import { createWorkflow, deleteWorkflow, fetchWorkflows, PlatformApiError, updateWorkflow } from '@/lib/platform/client';
import type {
  RegistryOption,
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

export function WorkflowConsole() {
  const { registry, problems, loading: registryLoading, error: registryError, reload } = usePlatformRegistry();
  const rights = usePermissions([RBAC_KEY]);

  const [moduleKey, setModuleKey] = useState<string | null>(null);
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
  const rightsReason = rights.authenticated
    ? 'Your role cannot change approval workflows for this institute.'
    : 'Sign in again — your permissions could not be checked.';

  const load = useCallback(
    (isRefresh = false) => {
      if (!isRefresh) setLoading(true);
      setError(null);

      fetchWorkflows({ module: moduleKey ?? undefined, component: componentKey ?? undefined })
        .then(setPayload)
        .catch((cause: unknown) => {
          setError(cause instanceof PlatformApiError ? cause.message : 'The workflows could not be loaded.');
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
        failed(cause, 'The status could not be changed.');
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
        failed(cause, 'The workflow could not be deleted.');
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
      title="Workflow"
      description="Every action in the ERP that can pause for a sign-off, module by module and component by component — and the approval chain each one runs through at this institute."
      countKey="workflows"
      registry={registry}
      problems={problems}
      selectedModule={moduleKey}
      onSelectModule={(next) => {
        setModuleKey(next);
        setComponentKey(null);
        setEditing(null);
      }}
      actions={<RefreshButton onClick={() => load(true)} busy={loading} />}
    >
      {note && <Note tone={note.tone} text={note.text} onDismiss={() => setNote(null)} />}

      {!mayUpdate && !rights.loading && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <Lock size={14} className="mr-1.5 inline align-text-bottom" />
          You can see these workflows but not change them. {rightsReason}
        </div>
      )}

      {moduleKey && (
        <ComponentFilter components={componentsOfModule} selected={componentKey} onSelect={setComponentKey} counts={componentCounts} />
      )}

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

/** The chain as a readable ladder — the shape somebody checks at a glance. */
function StepLadder({ steps, approverTypes }: { steps: WorkflowStep[]; approverTypes: RegistryOption[] }) {
  if (!steps.length) {
    return <p className="mt-1.5 text-xs text-amber-700">No steps — this chain would approve everything it touched.</p>;
  }

  const labelFor = (step: WorkflowStep) => {
    const type = approverTypes.find((option) => option.key === step.approver_type);
    return step.approver || type?.label || step.approver_type;
  };

  return (
    <ol className="mt-2 flex flex-wrap items-center gap-1.5">
      {steps.map((step, index) => (
        <li key={step.id} className="flex items-center gap-1.5">
          {index > 0 && <span className="text-slate-300">→</span>}
          <span className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700">
            <span className="font-medium">{step.name}</span>
            <span className="text-slate-500"> · {labelFor(step)}</span>
            {step.sla_hours > 0 && <span className="text-slate-400"> · {step.sla_hours}h</span>}
          </span>
        </li>
      ))}
    </ol>
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
      onFailed(cause, 'The workflow could not be saved.');
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
