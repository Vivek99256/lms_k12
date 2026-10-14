'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  createReportSchedule,
  deleteReportSchedule,
  exportReport,
  fetchReports,
  fetchReportSchedules,
  PlatformApiError,
  runReportSchedule,
  setReportScheduleEnabled,
  type ReportDefinition,
  type ReportSchedule,
} from '@/lib/platform/client';

import { Card, ErrorState, formatWhen, LoadingState, Note, Pill, PlainShell, SampleBadge } from '../_components/shell';

/**
 * Platform services -> Reports.
 *
 * The shared reporting engine: any report in the catalogue can be exported to CSV
 * or scheduled. A scheduled run stores its CSV in File storage and emails the
 * recipients where to find it.
 */

const inputClass = 'rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400';

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportDefinition[] | null>(null);
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [range, setRange] = useState({ from: '', to: '' });
  const [form, setForm] = useState({ report_key: '', name: '', frequency: 'weekly', recipients: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [catalog, list] = await Promise.all([fetchReports(), fetchReportSchedules()]);
      setReports(catalog);
      setSchedules(list);
      setForm((current) => (current.report_key ? current : { ...current, report_key: catalog[0]?.key ?? '' }));
    } catch (reason) {
      setError(reason instanceof PlatformApiError ? reason.message : 'Reports could not be loaded.');
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const fail = (reason: unknown, fallback: string) =>
    setNote({ tone: 'error', text: reason instanceof PlatformApiError ? reason.message : fallback });

  async function onExport(report: ReportDefinition) {
    setNote(null);
    try {
      await exportReport(report.key, { from: range.from || undefined, to: range.to || undefined });
    } catch (reason) {
      fail(reason, 'The export failed.');
    }
  }

  async function onCreate(event: React.FormEvent) {
    event.preventDefault();
    const recipients = form.recipients.split(/[,\s]+/).filter(Boolean);
    setBusy(true);
    setNote(null);
    try {
      await createReportSchedule({ report_key: form.report_key, name: form.name, frequency: form.frequency, recipients });
      setNote({ tone: 'ok', text: 'Schedule created. It runs the first time the scheduler ticks.' });
      setForm((current) => ({ ...current, name: '', recipients: '' }));
      await load();
    } catch (reason) {
      fail(reason, 'The schedule could not be created.');
    } finally {
      setBusy(false);
    }
  }

  async function act(action: () => Promise<unknown>, okText: string, failText: string) {
    setBusy(true);
    setNote(null);
    try {
      await action();
      setNote({ tone: 'ok', text: okText });
      await load();
    } catch (reason) {
      fail(reason, failText);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PlainShell
      title="Reports"
      description="Shared reports for every module. Export one now, or schedule it to run on its own."
    >
      {note && <Note tone={note.tone} text={note.text} onDismiss={() => setNote(null)} />}
      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : reports === null ? (
        <LoadingState label="Loading reports" />
      ) : (
        <>
          <Card className="p-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-900">Available reports</h2>
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-xs text-slate-600">
                  From
                  <input type="date" value={range.from} onChange={(event) => setRange((r) => ({ ...r, from: event.target.value }))} className={`${inputClass} mt-1 block`} />
                </label>
                <label className="text-xs text-slate-600">
                  To
                  <input type="date" value={range.to} onChange={(event) => setRange((r) => ({ ...r, to: event.target.value }))} className={`${inputClass} mt-1 block`} />
                </label>
              </div>
            </div>
            <ul className="mt-3 divide-y divide-slate-100">
              {reports.map((report) => (
                <li key={report.key} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{report.label}</p>
                    <p className="text-xs text-slate-600">{report.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void onExport(report)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Export CSV
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-semibold text-slate-900">Scheduled reports</h2>
            {schedules.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">Nothing is scheduled yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {schedules.map((schedule) => (
                  <li key={schedule.id} className="space-y-1 py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-slate-900">{schedule.name}</span>
                        <Pill>{schedule.frequency}</Pill>
                        {!schedule.enabled && <Pill tone="gray">off</Pill>}
                        {schedule.last_run_status && <Pill tone={schedule.last_run_status === 'ok' ? 'green' : 'red'}>{schedule.last_run_status}</Pill>}
                        <SampleBadge show={schedule.is_sample} />
                      </div>
                      <div className="flex gap-3 text-sm">
                        <button type="button" disabled={busy} className="text-indigo-700 hover:underline" onClick={() => void act(() => runReportSchedule(schedule.id), 'Report ran.', 'The report could not be run.')}>
                          Run now
                        </button>
                        <button type="button" disabled={busy} className="text-slate-700 hover:underline" onClick={() => void act(() => setReportScheduleEnabled(schedule.id, !schedule.enabled), schedule.enabled ? 'Schedule switched off.' : 'Schedule switched on.', 'The schedule could not be changed.')}>
                          {schedule.enabled ? 'Switch off' : 'Switch on'}
                        </button>
                        <button type="button" disabled={busy} className="text-slate-700 hover:underline" onClick={() => void act(() => deleteReportSchedule(schedule.id), 'Schedule removed.', 'The schedule could not be removed.')}>
                          Remove
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">
                      {schedule.report_key} · to {schedule.recipients.length ? schedule.recipients.join(', ') : 'nobody'} · last run {formatWhen(schedule.last_run_at)}
                      {schedule.last_run_message ? ` · ${schedule.last_run_message}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={onCreate} className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
              <label className="text-xs text-slate-600">
                Report
                <select value={form.report_key} onChange={(event) => setForm((f) => ({ ...f, report_key: event.target.value }))} className={`${inputClass} mt-1 block w-full`}>
                  {reports.map((report) => (
                    <option key={report.key} value={report.key}>
                      {report.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-600">
                Name
                <input required value={form.name} onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))} className={`${inputClass} mt-1 block w-full`} />
              </label>
              <label className="text-xs text-slate-600">
                How often
                <select value={form.frequency} onChange={(event) => setForm((f) => ({ ...f, frequency: event.target.value }))} className={`${inputClass} mt-1 block w-full`}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </label>
              <label className="text-xs text-slate-600">
                Send to (email addresses, separated by commas)
                <input required value={form.recipients} onChange={(event) => setForm((f) => ({ ...f, recipients: event.target.value }))} className={`${inputClass} mt-1 block w-full`} />
              </label>
              <div className="sm:col-span-2">
                <button type="submit" disabled={busy} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                  Schedule report
                </button>
              </div>
            </form>
          </Card>
        </>
      )}
    </PlainShell>
  );
}
