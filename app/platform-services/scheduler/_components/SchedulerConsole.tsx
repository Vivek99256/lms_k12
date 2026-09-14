'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Clock, Lock, Pencil, RotateCcw, Save, X } from 'lucide-react';

import { usePermissions } from '@/app/hooks/usePermission';
import { fetchScheduledTasks, PlatformApiError, saveScheduledTask } from '@/lib/platform/client';
import { CRON_FIELDS, describeSchedule, scheduleProblem, scheduleToString } from '@/lib/platform/cron';
import type { CronSchedule, ScheduledTaskRow, SchedulerPayload } from '@/lib/platform/types';

import {
  Card,
  ComponentFilter,
  ErrorState,
  formatWhen,
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
 * Scheduler — module and component-wise scheduled activity.
 *
 * WHAT THIS SCREEN DOES AND DOES NOT DO. It configures. It does not dispatch:
 * nothing here starts a job, and "Last run" is written by whatever runs the work.
 * Keeping the two apart is what makes the configuration safe to edit while jobs
 * are running.
 *
 * ONE TASK AT A TIME, unlike the notification matrix. A schedule is edited
 * deliberately, and each edit is worth its own audit entry — batching them behind
 * one Save button would blur who changed which schedule when.
 *
 * THE FIVE CRON FIELDS ARE FIVE INPUTS, the shape administrators here already
 * read. The sentence underneath is generated as they type, because `0 9 1 * 1`
 * means the 1st of the month OR every Monday and almost nobody reads that
 * correctly off the fields alone.
 *
 * NEXT RUN IS COMPUTED SERVER-SIDE and never stored, so it cannot go stale after
 * an edit. A disabled task shows none at all rather than a time it will not keep.
 */

const RBAC_KEY = 'platform.scheduler';

export function SchedulerConsole() {
  const { registry, problems, loading: registryLoading, error: registryError, reload } = usePlatformRegistry();
  const rights = usePermissions([RBAC_KEY]);

  const [moduleKey, setModuleKey] = useState<string | null>(null);
  const [componentKey, setComponentKey] = useState<string | null>(null);

  const [payload, setPayload] = useState<SchedulerPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [note, setNote] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const mayEdit = rights.permissions?.[RBAC_KEY]?.update ?? false;
  const rightsReason = rights.authenticated
    ? 'Your role cannot change scheduled tasks for this institute.'
    : 'Sign in again — your permissions could not be checked.';

  const load = useCallback(
    (isRefresh = false) => {
      if (!isRefresh) setLoading(true);
      setError(null);

      fetchScheduledTasks({ module: moduleKey ?? undefined, component: componentKey ?? undefined })
        .then(setPayload)
        .catch((cause: unknown) => {
          setError(cause instanceof PlatformApiError ? cause.message : 'The scheduled tasks could not be loaded.');
        })
        .finally(() => setLoading(false));
    },
    [moduleKey, componentKey],
  );

  useEffect(() => load(), [load]);

  /** Replace one task in place — the endpoint returns the row it just wrote. */
  const replaceTask = useCallback((task: ScheduledTaskRow) => {
    setPayload((current) =>
      current ? { ...current, tasks: current.tasks.map((row) => (row.key === task.key ? task : row)) } : current,
    );
  }, []);

  const saveTask = useCallback(
    async (
      task: ScheduledTaskRow,
      change: { schedule?: CronSchedule; disabled?: boolean; fail_delay?: number; reset_to_default?: boolean },
      successText: string,
    ) => {
      setNote(null);
      try {
        const result = await saveScheduledTask({ task_key: task.key, ...change });
        replaceTask(result.task);
        setNote({ tone: 'ok', text: successText });
        return true;
      } catch (cause) {
        setNote({
          tone: 'error',
          text: cause instanceof PlatformApiError ? cause.message : 'The task could not be saved.',
        });
        return false;
      }
    },
    [replaceTask],
  );

  const componentsOfModule = useMemo(
    () => (moduleKey && registry ? registry.components.filter((row) => row.module === moduleKey) : []),
    [registry, moduleKey],
  );

  const componentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!registry) return counts;
    for (const row of registry.tasks) {
      if (moduleKey && row.module !== moduleKey) continue;
      counts[row.component] = (counts[row.component] ?? 0) + 1;
    }
    return counts;
  }, [registry, moduleKey]);

  const groups = useMemo(() => {
    const byComponent = new Map<string, { label: string; rows: ScheduledTaskRow[] }>();
    for (const row of payload?.tasks ?? []) {
      const group = byComponent.get(row.component) ?? { label: row.component_label, rows: [] };
      group.rows.push(row);
      byComponent.set(row.component, group);
    }
    return [...byComponent.entries()];
  }, [payload]);

  if (registryLoading) return <div className="p-6"><LoadingState label="Loading the platform registry" /></div>;
  if (registryError || !registry) return <div className="p-6"><ErrorState message={registryError ?? 'The registry is unavailable.'} onRetry={reload} /></div>;

  const summary = payload?.summary;

  return (
    <PlatformShell
      title="Scheduler"
      description="Every recurring activity the ERP runs, module by module and component by component: when it runs, whether it is switched on, and when it last did."
      countKey="tasks"
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

      {!mayEdit && !rights.loading && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <Lock size={14} className="mr-1.5 inline align-text-bottom" />
          You can see these schedules but not change them. {rightsReason}
        </div>
      )}

      {moduleKey && (
        <ComponentFilter components={componentsOfModule} selected={componentKey} onSelect={setComponentKey} counts={componentCounts} />
      )}

      {summary && (
        <StatTiles
          tiles={[
            { label: 'Scheduled tasks', value: summary.total, hint: 'in this scope' },
            { label: 'Running', value: summary.enabled, tone: 'green' },
            { label: 'Switched off', value: summary.disabled, tone: summary.disabled > 0 ? 'amber' : 'gray' },
            { label: 'Failing last run', value: summary.failing, tone: summary.failing > 0 ? 'red' : 'gray' },
          ]}
        />
      )}

      {loading && !payload ? (
        <LoadingState label="Loading scheduled tasks" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => load()} />
      ) : !payload?.tasks.length ? (
        <Card className="px-4 py-10 text-center text-sm text-slate-600">
          This scope has no scheduled tasks. Components declare them in <code className="rounded bg-slate-100 px-1">config/platform_services.php</code>.
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map(([key, group]) => (
            <Card key={key} className="overflow-hidden">
              <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50/70 px-4 py-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">{group.label}</span>
                <span className="font-mono text-[10px] text-slate-400">{key}</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {group.rows.map((task) => (
                  <TaskRow
                    key={task.key}
                    task={task}
                    editing={editing === task.key}
                    onEdit={() => setEditing(task.key)}
                    onCancel={() => setEditing(null)}
                    onSave={saveTask}
                    onDone={() => setEditing(null)}
                    mayEdit={mayEdit}
                    rightsReason={rightsReason}
                  />
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </PlatformShell>
  );
}

/**
 * One task: read-only until Edit, then the five cron fields with a live sentence.
 *
 * The read state shows the raw expression in mono AND the sentence, because the
 * expression is what an operator compares against documentation and the sentence
 * is what they check their intent against. Neither replaces the other.
 */
function TaskRow({
  task,
  editing,
  onEdit,
  onCancel,
  onSave,
  onDone,
  mayEdit,
  rightsReason,
}: {
  task: ScheduledTaskRow;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (
    task: ScheduledTaskRow,
    change: { schedule?: CronSchedule; disabled?: boolean; fail_delay?: number; reset_to_default?: boolean },
    successText: string,
  ) => Promise<boolean>;
  onDone: () => void;
  mayEdit: boolean;
  rightsReason: string;
}) {
  const [schedule, setSchedule] = useState<CronSchedule>(task.schedule);
  const [failDelay, setFailDelay] = useState(task.fail_delay);
  const [busy, setBusy] = useState(false);

  // Re-seed the form whenever the row changes underneath it — after a save, or
  // after a refresh. Without this the inputs would keep showing what the
  // operator typed against a version of the row that no longer exists.
  useEffect(() => {
    setSchedule(task.schedule);
    setFailDelay(task.fail_delay);
  }, [task]);

  const problem = editing ? scheduleProblem(schedule) : null;
  const sentence = editing ? (problem ? null : describeSchedule(schedule)) : task.describes;

  const toggleDisabled = async (next: boolean) => {
    setBusy(true);
    await onSave(task, { disabled: !next }, `${task.label} is now ${next ? 'running' : 'switched off'}.`);
    setBusy(false);
  };

  const commit = async () => {
    setBusy(true);
    const ok = await onSave(task, { schedule, fail_delay: failDelay }, `${task.label} rescheduled.`);
    setBusy(false);
    if (ok) onDone();
  };

  const reset = async () => {
    setBusy(true);
    const ok = await onSave(task, { reset_to_default: true }, `${task.label} is back on the default schedule.`);
    setBusy(false);
    if (ok) onDone();
  };

  return (
    <li className={`px-4 py-3 ${editing ? 'bg-indigo-50/40' : ''}`}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="pt-0.5">
          <Switch
            checked={!task.disabled}
            onChange={toggleDisabled}
            disabled={!mayEdit || busy}
            label={`${task.label} running`}
            title={mayEdit ? `Switch ${task.label} ${task.disabled ? 'on' : 'off'}` : rightsReason}
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-slate-900">
            {task.label}
            {task.disabled && <Pill tone="gray">off</Pill>}
            {task.customised && <Pill tone="blue">custom schedule</Pill>}
            {task.disabled_by_default && !task.overridden && <Pill tone="amber">off by default</Pill>}
            {task.last_run_status === 'failed' && (
              <span title="The last run failed.">
                <Pill tone="red">last run failed</Pill>
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-slate-600">{task.description}</p>

          {!editing && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700">{task.expression}</span>
              {sentence && <span>{sentence}</span>}
            </div>
          )}

          {editing && (
            <div className="mt-3 space-y-2">
              <div className="flex flex-wrap gap-2">
                {CRON_FIELDS.map((field) => (
                  <label key={field.name} className="block">
                    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      {field.label}
                    </span>
                    <input
                      value={schedule[field.name]}
                      onChange={(event) => setSchedule((current) => ({ ...current, [field.name]: event.target.value }))}
                      className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 font-mono text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      placeholder="*"
                      aria-label={field.label}
                    />
                    <span className="mt-0.5 block text-[10px] text-slate-400">
                      {field.min}–{field.max}
                    </span>
                  </label>
                ))}

                <label className="block">
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Retry after</span>
                  <input
                    type="number"
                    min={0}
                    max={1440}
                    value={failDelay}
                    onChange={(event) => setFailDelay(Math.max(0, Number(event.target.value) || 0))}
                    className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    aria-label="Retry delay in minutes"
                  />
                  <span className="mt-0.5 block text-[10px] text-slate-400">minutes, 0 = never</span>
                </label>
              </div>

              {problem ? (
                <p className="flex items-start gap-1.5 text-xs text-red-700">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  {problem}
                </p>
              ) : (
                <p className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700">
                    {scheduleToString(schedule)}
                  </span>
                  {sentence}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={commit}
                  disabled={Boolean(problem) || busy}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Save size={13} />
                  {busy ? 'Saving…' : 'Save schedule'}
                </button>
                <button
                  type="button"
                  onClick={onCancel}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <X size={13} />
                  Cancel
                </button>
                {/* Only offered where there is an override to throw away — a
                    reset on a task already following the default does nothing
                    and invites a click that seems not to work. */}
                {task.overridden && (
                  <button
                    type="button"
                    onClick={reset}
                    disabled={busy}
                    title={`Back to the shipped default: ${Object.values(task.default_schedule).join(' ')}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  >
                    <RotateCcw size={13} />
                    Reset to default
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1 text-right text-xs text-slate-600">
          <span className="flex items-center gap-1">
            <Clock size={12} className="text-slate-400" />
            {/* A disabled task has no next run; saying "Never" is the honest
                answer and stops the row implying it is about to happen. */}
            Next: {task.disabled ? 'not while switched off' : formatWhen(task.next_run_at)}
          </span>
          <span>Last: {formatWhen(task.last_run_at)}</span>
          {task.fail_delay > 0 && <span className="text-slate-500">Retries after {task.fail_delay} min</span>}
          {!editing && (
            <button
              type="button"
              onClick={onEdit}
              disabled={!mayEdit}
              title={mayEdit ? undefined : rightsReason}
              className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Pencil size={12} />
              Edit
            </button>
          )}
          {task.updated_by && <span className="text-[10px] text-slate-400">Changed by {task.updated_by}</span>}
        </div>
      </div>
    </li>
  );
}
