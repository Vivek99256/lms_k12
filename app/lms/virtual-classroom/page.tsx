'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Clock,
  ExternalLink,
  Key,
  Plus,
  RefreshCw,
  Search,
  User,
  Video,
  VideoOff,
  Volume2,
  X,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  createVirtualSession,
  fetchVirtualSessions,
  type NewVirtualSession,
  type VirtualClassroomSession,
} from '@/app/lms/data/virtualClassroom';

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-slate-200/70', className)} aria-hidden />;
}

/* -------------------------------------------------------------------------- */
/* Modal: Schedule / Add Virtual Classroom Session                            */
/* -------------------------------------------------------------------------- */

function ScheduleVirtualModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (session: VirtualClassroomSession) => void;
}) {
  const [roomName, setRoomName] = useState('');
  const [subjectName, setSubjectName] = useState('Physics');
  const [chapterName, setChapterName] = useState('');
  const [topicName, setTopicName] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [fromTime, setFromTime] = useState('10:00 AM');
  const [toTime, setToTime] = useState('11:00 AM');
  const [meetingUrl, setMeetingUrl] = useState('https://meet.google.com/live-room-join');
  const [passcode, setPasscode] = useState('CLASS2026');
  const [recurring, setRecurring] = useState('None');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!roomName.trim()) {
      setError('Please enter a session title or room name.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload: NewVirtualSession = {
        roomName: roomName.trim(),
        subjectName,
        chapterName: chapterName.trim() || undefined,
        topicName: topicName.trim() || undefined,
        description: description.trim(),
        eventDate,
        fromTime,
        toTime,
        meetingUrl,
        passcode,
        recurring,
      };
      const created = await createVirtualSession(payload);
      onCreated(created);
    } catch {
      setError('Failed to schedule session. Please check input values.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Schedule Virtual Classroom"
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl border border-slate-100"
      >
        <header className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
              <Video className="size-4" />
            </span>
            <h2 className="text-base font-semibold text-slate-900">Schedule Virtual Classroom</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-700">Session / Room Name *</span>
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="e.g. Physics Quantum Mechanics Live Interactive Class"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-700">Subject</span>
              <select
                value={subjectName}
                onChange={(e) => setSubjectName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="Physics">Physics</option>
                <option value="Mathematics">Mathematics</option>
                <option value="Chemistry">Chemistry</option>
                <option value="Biology">Biology</option>
                <option value="English">English</option>
                <option value="Computer Science">Computer Science</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-700">Date</span>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-700">Start Time</span>
              <input
                type="text"
                value={fromTime}
                onChange={(e) => setFromTime(e.target.value)}
                placeholder="10:00 AM"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-700">End Time</span>
              <input
                type="text"
                value={toTime}
                onChange={(e) => setToTime(e.target.value)}
                placeholder="11:00 AM"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-700">Meeting Link</span>
              <input
                type="text"
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
                placeholder="https://meet.google.com/..."
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-700">Passcode</span>
              <input
                type="text"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Passcode"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-700">Session Description</span>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Topics covered, prerequisite notes, or instructions for students..."
              className="w-full resize-y rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </label>

          {error ? (
            <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700 border border-rose-200">
              {error}
            </p>
          ) : null}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200/60 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? 'Scheduling...' : 'Schedule Live Class'}
          </button>
        </footer>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Modal: Join Live Class Room                                                */
/* -------------------------------------------------------------------------- */

function JoinRoomModal({
  session,
  onClose,
}: {
  session: VirtualClassroomSession;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Live Classroom"
        className="flex h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-slate-900 text-white shadow-2xl border border-slate-800"
      >
        {/* Room Header */}
        <header className="flex items-center justify-between border-b border-slate-800 px-6 py-3.5 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <span className="relative flex size-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-3 rounded-full bg-emerald-500" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-white">{session.roomName}</h2>
              <p className="text-xs text-slate-400">
                {session.subjectName} • Host: {session.teacherName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {session.passcode ? (
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
                <Key className="size-3 text-amber-400" />
                Passcode: <strong className="text-white font-mono">{session.passcode}</strong>
              </span>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
            >
              <X className="size-5" />
            </button>
          </div>
        </header>

        {/* Video Canvas Simulation */}
        <div className="relative flex-1 bg-slate-950 flex flex-col items-center justify-center p-6 text-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-tr from-indigo-950/30 via-slate-950 to-purple-950/30" />
          
          <div className="relative z-10 space-y-4 max-w-lg mx-auto">
            <div className="mx-auto flex size-20 items-center justify-center rounded-3xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 shadow-2xl">
              <Video className="size-10" />
            </div>
            
            <div>
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs font-semibold text-emerald-400 mb-2">
                Live Classroom Active
              </span>
              <h3 className="text-xl font-bold text-white leading-snug">
                Connecting to Virtual Room...
              </h3>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                {session.description || 'Welcome to the live interactive session. Make sure your audio and video settings are enabled.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <a
                href={session.meetingUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-indigo-500"
              >
                Launch Meeting in New Tab
                <ExternalLink className="size-4" />
              </a>
            </div>
          </div>
        </div>

        {/* Control Bar */}
        <footer className="flex items-center justify-between border-t border-slate-800 px-6 py-3.5 bg-slate-900/90 text-xs">
          <div className="flex items-center gap-3 text-slate-400">
            <span className="flex items-center gap-1.5">
              <Volume2 className="size-4 text-emerald-400" /> Audio Connected
            </span>
            <span className="flex items-center gap-1.5">
              <VideoOff className="size-4 text-slate-500" /> Camera Muted
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-rose-600/20 border border-rose-500/30 px-4 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-600 hover:text-white transition"
          >
            Leave Classroom
          </button>
        </footer>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Main Virtual Classroom Page Component                                      */
/* -------------------------------------------------------------------------- */

export default function VirtualClassroomPage() {
  const [sessions, setSessions] = useState<VirtualClassroomSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'live' | 'upcoming' | 'completed'>('all');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [joiningSession, setJoiningSession] = useState<VirtualClassroomSession | null>(null);

  const load = useCallback((signal?: AbortSignal) => {
    setLoading(true);
    fetchVirtualSessions({ search, status: activeTab }, signal)
      .then((res) => {
        if (signal?.aborted) return;
        setSessions(res.sessions);
        setLoading(false);
      })
      .catch(() => {
        if (signal?.aborted) return;
        setSessions([]);
        setLoading(false);
      });
  }, [search, activeTab]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const liveCount = useMemo(() => sessions.filter((s) => s.status === 'live').length, [sessions]);

  return (
    <div className="min-h-full  space-y-6  mx-auto">
      {/* Page Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <span className="relative flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-md">
            <Video className="size-6" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                Virtual Classroom
              </h1>
              {liveCount > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                  <span className="size-1.5 rounded-full bg-emerald-600 animate-ping" />
                  {liveCount} Live Now
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
              Attend live video lectures, interactive discussions, and access class recordings.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50"
          >
            <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowScheduleModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md transition hover:bg-indigo-700"
          >
            <Plus className="size-4" />
            Schedule Class
          </button>
        </div>
      </header>

      {/* Filter and Tab Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search session by room name, subject or teacher..."
            className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-xs sm:text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {(
            [
              { id: 'all', label: 'All Sessions' },
              { id: 'live', label: 'Live Now' },
              { id: 'upcoming', label: 'Upcoming' },
              { id: 'completed', label: 'Recorded' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'rounded-xl px-3.5 py-1.5 text-xs font-semibold transition shrink-0',
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Sessions */}
      {loading ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-20 w-full" />
            </div>
          ))}
        </div>
      ) : sessions.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {sessions.map((session) => (
            <article
              key={session.id}
              className={cn(
                'flex flex-col justify-between rounded-2xl border bg-white p-5 shadow-xs transition hover:shadow-md',
                session.status === 'live'
                  ? 'border-emerald-300 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 hover:border-slate-300'
              )}
            >
              <div>
                {/* Badge Header */}
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                    {session.subjectName}
                  </span>

                  {session.status === 'live' ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-800">
                      <span className="size-2 rounded-full bg-emerald-600 animate-ping" />
                      LIVE NOW
                    </span>
                  ) : session.status === 'upcoming' ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                      <Clock className="size-3" />
                      Upcoming
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                      Completed
                    </span>
                  )}
                </div>

                {/* Session Title & Description */}
                <h3 className="mt-3 text-base font-bold text-slate-900 leading-snug">
                  {session.roomName}
                </h3>
                {session.description ? (
                  <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed line-clamp-2">
                    {session.description}
                  </p>
                ) : null}

                {/* Schedule & Faculty details */}
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-600 rounded-xl bg-slate-50 p-3 border border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="size-3.5 text-slate-400" />
                    <span>{session.eventDate}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="size-3.5 text-slate-400" />
                    <span>
                      {session.fromTime} - {session.toTime}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 col-span-2 mt-1">
                    <User className="size-3.5 text-slate-400" />
                    <span className="font-medium text-slate-700">Faculty: {session.teacherName}</span>
                  </div>
                </div>
              </div>

              {/* Action Footer */}
              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                {session.passcode ? (
                  <span className="text-[11px] text-slate-500 font-mono">
                    Passcode: <strong>{session.passcode}</strong>
                  </span>
                ) : <span />}

                {session.status === 'live' ? (
                  <button
                    type="button"
                    onClick={() => setJoiningSession(session)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md transition hover:bg-emerald-700 animate-bounce-subtle"
                  >
                    <Video className="size-3.5" />
                    Join Live Class
                  </button>
                ) : session.status === 'upcoming' ? (
                  <button
                    type="button"
                    onClick={() => setJoiningSession(session)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-700"
                  >
                    Enter Room
                  </button>
                ) : session.recordingUrl ? (
                  <a
                    href={session.recordingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Watch Recording
                    <ExternalLink className="size-3" />
                  </a>
                ) : (
                  <span className="text-xs text-slate-400 font-medium">Session Ended</span>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <Video className="size-6" />
          </span>
          <h3 className="mt-4 text-base font-bold text-slate-900">No Virtual Classrooms Found</h3>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
            {search || activeTab !== 'all'
              ? 'No live or scheduled classrooms match your current filter search.'
              : 'No virtual classroom sessions have been scheduled yet.'}
          </p>
          <button
            type="button"
            onClick={() => setShowScheduleModal(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-700"
          >
            <Plus className="size-4" />
            Schedule Session
          </button>
        </div>
      )}

      {showScheduleModal ? (
        <ScheduleVirtualModal
          onClose={() => setShowScheduleModal(false)}
          onCreated={(newSess) => {
            setShowScheduleModal(false);
            setSessions((prev) => [newSess, ...prev]);
          }}
        />
      ) : null}

      {joiningSession ? (
        <JoinRoomModal
          session={joiningSession}
          onClose={() => setJoiningSession(null)}
        />
      ) : null}
    </div>
  );
}
