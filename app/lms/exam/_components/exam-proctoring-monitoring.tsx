'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';

import {
  fetchProctoringEvents,
  fetchProctoringSessions,
  type ProctoringEvent,
  type ProctoringSessionSummary,
} from '@/app/exam/data/proctoring';

function formatTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function statusLabel(status: ProctoringSessionSummary['status']): string {
  if (status === 'submitted') return 'Submitted';
  if (status === 'interrupted') return 'Interrupted';
  return 'Active';
}

function eventLabel(event: ProctoringEvent): string {
  const labels: Record<ProctoringEvent['eventType'], string> = {
    tab_hidden: 'Browser tab hidden',
    tab_visible: 'Browser tab visible',
    window_blur: 'Exam window lost focus',
    window_focus: 'Exam window regained focus',
    fullscreen_exit: 'Exited fullscreen',
    fullscreen_enter: 'Entered fullscreen',
    copy: 'Copied content',
    cut: 'Cut content',
    paste: 'Pasted content',
    context_menu: 'Attempted to open context menu',
    page_refresh: 'Exam page refreshed',
    network_disconnect: 'Network disconnected',
    network_reconnect: 'Network reconnected',
    inactivity_warning: 'Student inactive',
    auto_submit: 'Exam automatically submitted',
    screenshot_attempt: 'Screenshot shortcut detected',
    select_all: 'Attempted to select all',
  };
  return labels[event.eventType];
}

export default function ExamProctoringMonitoring() {
  const [sessions, setSessions] = useState<ProctoringSessionSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [events, setEvents] = useState<ProctoringEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventsLoadedSessionId, setEventsLoadedSessionId] = useState('');
  const [error, setError] = useState('');
  const [eventsError, setEventsError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

  const selectedSession = sessions.find((session) => session.sessionId === selectedSessionId);
  const eventsLoading = Boolean(selectedSessionId) && eventsLoadedSessionId !== selectedSessionId;

  useEffect(() => {
    const controller = new AbortController();
    fetchProctoringSessions(undefined, controller.signal)
      .then((loaded) => {
        setSessions(loaded);
        setSelectedSessionId((current) =>
          loaded.some((session) => session.sessionId === current)
            ? current
            : loaded[0]?.sessionId ?? ''
        );
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "Couldn't load examination monitoring records.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [reloadToken]);

  useEffect(() => {
    if (!selectedSessionId) return;
    const controller = new AbortController();
    fetchProctoringEvents(selectedSessionId, controller.signal)
      .then((loaded) => {
        setEvents(loaded);
        setEventsLoadedSessionId(selectedSessionId);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setEventsError(reason instanceof Error ? reason.message : "Couldn't load the event timeline.");
        setEventsLoadedSessionId(selectedSessionId);
      })
    return () => controller.abort();
  }, [selectedSessionId, reloadToken]);

  const refresh = useCallback(() => {
    setLoading(true);
    setError('');
    setEventsError('');
    setEventsLoadedSessionId('');
    setReloadToken((current) => current + 1);
  }, []);

  const selectSession = useCallback((sessionId: string) => {
    setEvents([]);
    setEventsError('');
    setEventsLoadedSessionId('');
    setSelectedSessionId(sessionId);
  }, []);

  return (
    <section className="space-y-4" aria-labelledby="exam-proctoring-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="exam-proctoring-heading" className="text-lg font-semibold text-slate-900">
            Examination proctoring
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Student browser activity and violations recorded during online exam attempts.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          aria-label="Refresh proctoring records"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Refresh
        </button>
      </div>

      {error ? (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800">
            Recent exam sessions
          </div>
          {loading && sessions.length === 0 ? (
            <div className="flex items-center justify-center gap-2 p-8 text-sm text-slate-500">
              <Loader2 className="size-4 animate-spin" />
              Loading monitoring records
            </div>
          ) : sessions.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No proctoring sessions have been recorded yet.</p>
          ) : (
            <div className="max-h-[34rem] divide-y divide-slate-100 overflow-y-auto">
              {sessions.map((session) => (
                <button
                  type="button"
                  key={session.sessionId}
                  onClick={() => selectSession(session.sessionId)}
                  aria-pressed={selectedSessionId === session.sessionId}
                  className={`block w-full px-4 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-indigo-600 ${
                    selectedSessionId === session.sessionId ? 'bg-indigo-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-slate-900">{session.examName}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {statusLabel(session.status)}
                    </span>
                  </span>
                  <span className="mt-1 block text-xs text-slate-600">
                    Student {session.studentId} · Exam {session.examId}
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">
                    Started {formatTimestamp(session.startedAt)} · {session.eventCount} events ·{' '}
                    <strong className={session.violationCount ? 'text-rose-700' : 'text-slate-600'}>
                      {session.violationCount} violations
                    </strong>
                    {' · '}{session.criticalViolationCount} critical · {session.tabSwitchCount} tab switches
                  </span>
                  {session.autoSubmitReason ? (
                    <span className="mt-1 block text-xs font-medium text-rose-700">
                      Auto-submitted: {session.autoSubmitReason.replace(/_/g, ' ')}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-800">Activity timeline</h3>
            {selectedSession ? (
              <p className="mt-1 break-all font-mono text-xs text-slate-500">
                Session {selectedSession.sessionId}
              </p>
            ) : null}
          </div>
          {eventsLoading ? (
            <div className="flex items-center justify-center gap-2 p-8 text-sm text-slate-500">
              <Loader2 className="size-4 animate-spin" />
              Loading events
            </div>
          ) : eventsError ? (
            <div role="alert" className="p-4 text-sm text-rose-700">{eventsError}</div>
          ) : !selectedSession ? (
            <p className="p-6 text-sm text-slate-500">Select an exam session to review its events.</p>
          ) : events.length === 0 ? (
            <div className="flex items-center gap-2 p-6 text-sm text-slate-500">
              <ShieldCheck className="size-4" />
              No activity events recorded for this session.
            </div>
          ) : (
            <ol className="max-h-[34rem] divide-y divide-slate-100 overflow-y-auto">
              {events.map((event) => (
                <li key={event.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <span className={`text-sm font-medium ${event.isViolation ? 'text-rose-700' : 'text-slate-800'}`}>
                      {eventLabel(event)}
                    </span>
                    {event.isViolation ? (
                      <span className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
                        Violation
                      </span>
                    ) : null}
                    {event.severity === 'critical' ? (
                      <span className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
                        Critical
                      </span>
                    ) : null}
                  </div>
                  <time className="mt-1 block text-xs text-slate-500">{formatTimestamp(event.occurredAt)}</time>
                  <p className="mt-1 break-all font-mono text-xs text-slate-500">
                    Exam {event.examId} · Question paper {event.questionPaperName || event.questionPaperId}
                    {' · '}Paper ID {event.questionPaperId} · Student {event.studentId}
                    {' · '}Session {event.sessionId}
                    {event.violationCount !== null ? ` · Violation ${event.violationCount}` : ''}
                  </p>
                  {Object.entries(event.details).length > 0 ? (
                    <p className="mt-1 break-words text-xs text-slate-600">
                      {Object.entries(event.details)
                        .map(([key, value]) => `${key}: ${value}`)
                        .join(' · ')}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}
