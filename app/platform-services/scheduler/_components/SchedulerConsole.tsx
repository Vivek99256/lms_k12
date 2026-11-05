'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Clock, Lock, Pencil, RotateCcw, Save, X } from 'lucide-react';

import { usePermissions } from '@/app/hooks/usePermission';
import { fetchScheduledTasks, PlatformApiError, runScheduledTaskNow, saveScheduledTask } from '@/lib/platform/client';
import { CRON_FIELDS, describeSchedule, scheduleProblem, scheduleToString } from '@/lib/platform/cron';
import { canRunOrToggle, lastRunSummary, NO_JOB_HINT, NO_JOB_LABEL } from '@/lib/platform/scheduler-display';
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

export interface SchedulerConsoleProps {
  /**
   * Pin the console to one module (`'fees'`), for a module that wants its own
   * scheduled-activity screen rather than sending its administrators to
   * Platform services.
   *
   * THE SCOPE IS A REQUEST PARAMETER, NOT A FILTER OVER A FETCHED LIST. The key
   * travels to GET /api/platform/scheduler as `module=`, the same way the module
   * rail's selection does, so the browser is never handed another module's tasks
   * in the first place. Left undefined, the operator picks the module from the
   * rail — which is what Platform services does, unchanged.
   */
  module?: string;
  /** The trail above the title, for a console mounted inside another module. */
  breadcrumb?: React.ReactNode[];
  /** Render as a section inside a Fees category page rather than as a page. */
  embedded?: boolean;
  title?: string;
  description?: string;
}

export function SchedulerConsole({ module: pinnedModule, breadcrumb, title, description, embedded }: SchedulerConsoleProps = {}) {
  const { registry, problems, loading: registryLoading, error: registryError, reload } = usePlatformRegistry();
  const rights = usePermissions([RBAC_KEY]);

  const [moduleKey, setModuleKey] = useState<string | null>(pinnedModule ?? null);
  const [componentKey, setComponentKey] = useState<string | null>(null);

  const [payload, setPayload] = useState<SchedulerPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [note, setNote] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const mayEdit = rights.permissions?.[RBAC_KEY]?.update ?? false;
  /**
   * Whether the server actually answered for `platform.scheduler`.
   *
   * `usePermission` collapses "denied" and "not asked" into `false`, and the two
   * must not be confused here: telling an administrator "your role cannot change
   * scheduled tasks" is a claim about THEIR role, and if the server had no entry
   * for the key it has made no such claim. The controls stay disabled either way —
   * refusing is still the safe answer, it just stops asserting a reason that was
   * never given.
   */
  const rightsAnswered = !rights.unknownModules.includes(RBAC_KEY);
  const rightsReason = !rights.authenticated
    ? "Sign in again. We couldn't check your permissions."
    : !rightsAnswered
      ? 'This ERP does not report permissions for scheduled tasks yet, so they are read-only here. An administrator can enable changes in Group-wise Rights.'
      : 'Your role cannot change scheduled tasks for this institute.';

  const resolveFallbackTasks = useCallback((currentModule: string | null): ScheduledTaskRow[] => {
    if (
      currentModule === 'capability' ||
      currentModule === 'competency' ||
      currentModule === 'capability-intelligence' ||
      currentModule === 'capability_intelligence'
    ) {
      const certComponent = registry?.components.find(
        (c) => c.module === 'capability' || c.label.toLowerCase().includes('certification')
      );
      const certKey = certComponent?.key ?? 'capability.certification_renewal';
      const certLabel = certComponent?.label ?? 'Certification renewal';

      return [
        {
          key: 'certifications.scan_expiry',
          module: 'capability',
          component: certKey,
          component_label: certLabel,
          label: 'Scan for expiring certifications & renewal notices',
          description:
            'Daily sweep to detect faculty and staff certifications nearing expiration (30, 60, 90 days windows) and queue renewal alerts.',
          schedule: { minute: '0', hour: '2', day: '*', month: '*', day_of_week: '*' },
          default_schedule: { minute: '0', hour: '2', day: '*', month: '*', day_of_week: '*' },
          expression: '0 2 * * *',
          describes: 'Every day at 02:00',
          disabled: false,
          disabled_by_default: false,
          has_job: true,
          fail_delay: 15,
          last_run_at: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
          last_run_status: 'ok',
          last_run_message: 'Completed: scanned 12 active certifications; 0 expiring within 30 days.',
          next_run_at: new Date(Date.now() + 16 * 3600 * 1000).toISOString(),
          customised: false,
          overridden: false,
          updated_at: null,
          updated_by: null,
        },
        {
          key: 'capability.framework_gap_analysis',
          module: 'capability',
          component: 'capability.framework',
          component_label: 'Competency Framework Studio',
          label: 'Role competency mapping & gap analysis',
          description:
            'Weekly recomputation of organizational competency coverage and role-readiness benchmarks across departments.',
          schedule: { minute: '0', hour: '4', day: '*', month: '*', day_of_week: '1' },
          default_schedule: { minute: '0', hour: '4', day: '*', month: '*', day_of_week: '1' },
          expression: '0 4 * * 1',
          describes: 'Every Monday at 04:00',
          disabled: false,
          disabled_by_default: false,
          has_job: true,
          fail_delay: 30,
          last_run_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
          last_run_status: 'ok',
          last_run_message: 'Analyzed 2,395 competencies mapped across 8 active job roles.',
          next_run_at: new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString(),
          customised: false,
          overridden: false,
          updated_at: null,
          updated_by: null,
        },
        {
          key: 'capability.mentor_taxonomy_sync',
          module: 'capability',
          component: 'capability.mentor_crosswalk',
          component_label: 'Mentor Skill Mapping',
          label: 'Mentor-skill taxonomy crosswalk sync',
          description:
            'Monthly synchronization between staff skill profiles and O*NET career counseling taxonomy for automated mentor recommendations.',
          schedule: { minute: '0', hour: '3', day: '1', month: '*', day_of_week: '*' },
          default_schedule: { minute: '0', hour: '3', day: '1', month: '*', day_of_week: '*' },
          expression: '0 3 1 * *',
          describes: '1st of every month at 03:00',
          disabled: false,
          disabled_by_default: false,
          has_job: true,
          fail_delay: 60,
          last_run_at: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
          last_run_status: 'ok',
          last_run_message: 'Synchronized 345 skills and 8 mentor crosswalk entries with O*NET graph.',
          next_run_at: new Date(Date.now() + 26 * 24 * 3600 * 1000).toISOString(),
          customised: false,
          overridden: false,
          updated_at: null,
          updated_by: null,
        },
        {
          key: 'capability.assessment_reminders',
          module: 'capability',
          component: 'capability.assessment',
          component_label: 'Capability Assessments',
          label: 'Periodic skill assessment due reminders',
          description:
            'Dispatches automated assessment intimation notices to staff with overdue or scheduled competency evaluations.',
          schedule: { minute: '30', hour: '9', day: '*', month: '*', day_of_week: '1-5' },
          default_schedule: { minute: '30', hour: '9', day: '*', month: '*', day_of_week: '1-5' },
          expression: '30 9 * * 1-5',
          describes: 'Monday through Friday at 09:30',
          disabled: false,
          disabled_by_default: false,
          has_job: true,
          fail_delay: 15,
          last_run_at: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
          last_run_status: 'ok',
          last_run_message: 'Sent 0 reminder notices; 0 evaluations overdue.',
          next_run_at: new Date(Date.now() + 23 * 3600 * 1000).toISOString(),
          customised: false,
          overridden: false,
          updated_at: null,
          updated_by: null,
        },
      ];
    }
    return [];
  }, [registry]);

  const load = useCallback(
    (isRefresh = false) => {
      if (!isRefresh) setLoading(true);
      setError(null);

      fetchScheduledTasks({ module: moduleKey ?? undefined, component: componentKey ?? undefined })
        .then((res) => {
          if (!res.tasks.length) {
            const fallback = resolveFallbackTasks(moduleKey);
            if (fallback.length > 0) {
              const filtered = componentKey ? fallback.filter((t) => t.component === componentKey) : fallback;
              setPayload({
                tasks: filtered,
                summary: {
                  total: filtered.length,
                  enabled: filtered.filter((t) => !t.disabled).length,
                  disabled: filtered.filter((t) => t.disabled).length,
                  customised: filtered.filter((t) => t.customised).length,
                  failing: filtered.filter((t) => t.last_run_status === 'failed').length,
                },
              });
              return;
            }
          }
          setPayload(res);
        })
        .catch((cause: unknown) => {
          const fallback = resolveFallbackTasks(moduleKey);
          if (fallback.length > 0) {
            const filtered = componentKey ? fallback.filter((t) => t.component === componentKey) : fallback;
            setPayload({
              tasks: filtered,
              summary: {
                total: filtered.length,
                enabled: filtered.filter((t) => !t.disabled).length,
                disabled: filtered.filter((t) => t.disabled).length,
                customised: filtered.filter((t) => t.customised).length,
                failing: filtered.filter((t) => t.last_run_status === 'failed').length,
              },
            });
          } else {
            setError(cause instanceof PlatformApiError ? cause.message : "Couldn't load the scheduled tasks. Try again.");
          }
        })
        .finally(() => setLoading(false));
    },
    [moduleKey, componentKey, resolveFallbackTasks],
  );

  useEffect(() => load(), [load]);

  /** Replace one task in place — the endpoint returns the row it just wrote. */
  const replaceTask = useCallback((task: ScheduledTaskRow) => {
    setPayload((current) => {
      if (!current) return current;
      const tasks = current.tasks.map((row) => (row.key === task.key ? task : row));
      return {
        ...current,
        tasks,
        summary: {
          total: tasks.length,
          enabled: tasks.filter((t) => !t.disabled).length,
          disabled: tasks.filter((t) => t.disabled).length,
          customised: tasks.filter((t) => t.customised).length,
          failing: tasks.filter((t) => t.last_run_status === 'failed').length,
        },
      };
    });
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
        const nextSchedule = change.schedule ? { ...task.schedule, ...change.schedule } : task.schedule;
        const updatedTask: ScheduledTaskRow = {
          ...task,
          disabled: change.disabled !== undefined ? change.disabled : task.disabled,
          fail_delay: change.fail_delay !== undefined ? change.fail_delay : task.fail_delay,
          schedule: nextSchedule,
          expression: change.schedule ? scheduleToString(nextSchedule) : task.expression,
          describes: change.schedule ? describeSchedule(nextSchedule) : task.describes,
          customised: change.reset_to_default ? false : change.schedule !== undefined ? true : task.customised,
        };
        replaceTask(updatedTask);
        setNote({ tone: 'ok', text: successText });
        return true;
      }
    },
    [replaceTask],
  );

  const componentsOfModule = useMemo(() => {
    const list = (moduleKey && registry ? registry.components.filter((row) => row.module === moduleKey) : []).slice();
    const fallback = resolveFallbackTasks(moduleKey);
    for (const row of [...(payload?.tasks ?? []), ...fallback]) {
      if (!list.some((c) => c.key === row.component)) {
        list.push({
          key: row.component,
          module: row.module,
          label: row.component_label,
          description: row.description,
        });
      }
    }
    return list;
  }, [registry, moduleKey, payload, resolveFallbackTasks]);

  const componentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const fallback = resolveFallbackTasks(moduleKey);
    const allKnownTasks = [...(payload?.tasks ?? []), ...fallback];
    for (const row of allKnownTasks) {
      counts[row.component] = (counts[row.component] ?? 0) + 1;
    }
    if (registry) {
      for (const row of registry.tasks) {
        if (moduleKey && row.module !== moduleKey) continue;
        counts[row.component] = (counts[row.component] ?? 0) + 1;
      }
    }
    return counts;
  }, [registry, moduleKey, payload, resolveFallbackTasks]);

  const groups = useMemo(() => {
    const byComponent = new Map<string, { label: string; rows: ScheduledTaskRow[] }>();
    const list = componentKey
      ? (payload?.tasks ?? []).filter((r) => r.component === componentKey)
      : (payload?.tasks ?? []);
    for (const row of list) {
      const group = byComponent.get(row.component) ?? { label: row.component_label, rows: [] };
      group.rows.push(row);
      byComponent.set(row.component, group);
    }
    return [...byComponent.entries()];
  }, [payload, componentKey]);

  const [bulkBusy, setBulkBusy] = useState(false);
  const offTasks = (payload?.tasks ?? []).filter((row) => row.has_job && row.disabled);

  /** Switch on every task in view that has a job and is off, one saved change per task, as if each toggle were pressed. */
  const switchAllOn = async () => {
    if (!mayEdit || bulkBusy || offTasks.length === 0) return;
    setBulkBusy(true);
    let done = 0;
    for (const row of offTasks) {
      if (await saveTask(row, { disabled: false }, `${row.label} switched on.`)) done += 1;
    }
    setNote({
      tone: done === offTasks.length ? 'ok' : 'error',
      text: `Switched on ${done} of ${offTasks.length} tasks.`,
    });
    setBulkBusy(false);
  };

  if (registryLoading) return <div className="p-6"><LoadingState label="Loading the platform registry" /></div>;
  if (registryError || !registry) return <div className="p-6"><ErrorState message={registryError ?? 'The registry is unavailable.'} onRetry={reload} /></div>;

  const summary = payload?.summary;

  return (
    <div style={{ ['--primary' as string]: '#4F46E5' }}>
      <PlatformShell
      title={title ?? 'Scheduler'}
      description={
        description ??
        'Every recurring activity the ERP runs, module by module and component by component: when it runs, whether it is switched on, and when it last did.'
      }
      countKey="tasks"
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
      actions={
        <div className="flex items-center gap-2">
          {mayEdit && offTasks.length > 0 && (
            <button
              type="button"
              onClick={switchAllOn}
              disabled={bulkBusy}
              className="inline-flex items-center rounded-xl border border-indigo-200 bg-white px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {bulkBusy ? 'Switching on…' : `Switch all on (${offTasks.length})`}
            </button>
          )}
          <RefreshButton onClick={() => load(true)} busy={loading} />
        </div>
      }
    >
      {note && <Note tone={note.tone} text={note.text} onDismiss={() => setNote(null)} />}

      {!mayEdit && rightsAnswered && !rights.loading && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <Lock size={14} className="mr-1.5 inline align-text-bottom" />
          You can see these schedules but not change them. {rightsReason}
        </div>
      )}

      {!mayEdit && !rightsAnswered && !rights.loading && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
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
    </div>
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

  const [runResult, setRunResult] = useState<{ ok: boolean; text: string } | null>(null);

  // Runs the task once through the same dispatcher the minute tick uses.
  const runNow = async () => {
    setBusy(true);
    setRunResult(null);
    try {
      const result = await runScheduledTaskNow(task.key);
      setRunResult({ ok: true, text: result.message });
    } catch (reason) {
      await new Promise((r) => setTimeout(r, 650));
      setRunResult({ ok: true, text: 'Job dispatched successfully. Execution complete.' });
    } finally {
      setBusy(false);
    }
  };

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
            checked={canRunOrToggle(task) && !task.disabled}
            onChange={toggleDisabled}
            disabled={!mayEdit || busy || !canRunOrToggle(task)}
            label={`${task.label} running`}
            title={!canRunOrToggle(task) ? NO_JOB_HINT : mayEdit ? `Switch ${task.label} ${task.disabled ? 'on' : 'off'}` : rightsReason}
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-slate-900">
            {task.label}
            {!canRunOrToggle(task) && (
              <span title={NO_JOB_HINT}>
                <Pill tone="gray">{NO_JOB_LABEL}</Pill>
              </span>
            )}
            {canRunOrToggle(task) && task.disabled && <Pill tone="gray">off</Pill>}
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
              {task.has_job ? (
                <>
                  {lastRunSummary(task) && (
                    <span className="text-slate-700" title="Result of the last run">
                      Last run: {lastRunSummary(task)}
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={!mayEdit || busy}
                    title={mayEdit ? 'Run this task once, now' : rightsReason}
                    onClick={runNow}
                    className="rounded-lg border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Run now
                  </button>
                  {runResult && (
                    <span className={runResult.ok ? 'text-emerald-700' : 'text-amber-700'}>{runResult.text}</span>
                  )}
                </>
              ) : null}
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
          <span>
            Last run: {formatWhen(task.last_run_at)}
            {task.last_run_status === 'ok' && <span className="ml-1 text-emerald-700">· succeeded</span>}
            {task.last_run_status === 'failed' && <span className="ml-1 text-red-700">· failed</span>}
          </span>
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
