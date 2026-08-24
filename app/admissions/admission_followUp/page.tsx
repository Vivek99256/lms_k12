"use client";

<<<<<<< HEAD
import React, { useState } from 'react';
import { Plus, ArrowRight } from 'lucide-react';

interface FollowUpTask {
  id: string;
  day: string;
  weekday: string;
  time: string;
  type: 'Call' | 'Visit' | 'Reminder';
  title: string;
}

interface CommunicationLog {
  id: string;
  initials: string;
  actor: string;
  actionText: string;
  target: string;
  timeAgo: string;
  bgColor: string;
  textColor: string;
}

export default function FollowUpsContentOnly() {
  const [tasks] = useState<FollowUpTask[]>([
    { id: 't1', day: '04', weekday: 'FRI', time: '10:00', type: 'Call', title: 'Call — Diya Menon (Grade 6)' },
    { id: 't2', day: '04', weekday: 'FRI', time: '11:30', type: 'Call', title: 'Call — Ananya Iyer (Grade 3)' },
    { id: 't3', day: '05', weekday: 'SAT', time: '09:30', type: 'Visit', title: 'Campus visit — Aarav Sharma' },
    { id: 't4', day: '05', weekday: 'SAT', time: '14:00', type: 'Reminder', title: 'Reminder — Reyansh Joshi application' },
    { id: 't5', day: '06', weekday: 'SUN', time: '10:00', type: 'Visit', title: 'Campus visit — Kabir Rao (LKG)' },
    { id: 't6', day: '06', weekday: 'SUN', time: '16:00', type: 'Call', title: 'Call — Zara Khan' },
  ]);

  const communicationLogs: CommunicationLog[] = [
    { id: 'c1', initials: 'PN', actor: 'Priya N.', actionText: 'logged a call with', target: 'Diya Menon', timeAgo: '12m ago', bgColor: 'bg-indigo-50', textColor: 'text-indigo-600' },
    { id: 'c2', initials: 'S', actor: 'System', actionText: 'sent an application reminder to', target: 'Reyansh Joshi', timeAgo: '1h ago', bgColor: 'bg-slate-100', textColor: 'text-slate-600' },
    { id: 'c3', initials: 'RK', actor: 'Rahul K.', actionText: 'scheduled a campus visit for', target: 'Kabir Rao', timeAgo: '2h ago', bgColor: 'bg-amber-50', textColor: 'text-amber-600' },
    { id: 'c4', initials: 'PN', actor: 'Priya N.', actionText: 'converted enquiry for', target: 'Vivaan Nair', timeAgo: '5h ago', bgColor: 'bg-indigo-50', textColor: 'text-indigo-600' },
  ];

  // Action Handlers
  const handleNewReminder = () => alert('Opening "New Reminder" creation modal...');
  const handleTaskClick = (task: FollowUpTask) => alert(`Opening detailed workspace for: ${task.title}`);
  const handleLogClick = (log: CommunicationLog) => alert(`Viewing history audit trail for ${log.target}`);

  const getDotColor = (type: FollowUpTask['type']) => {
    switch (type) {
      case 'Call': return 'bg-blue-500';
      case 'Visit': return 'bg-amber-500';
      case 'Reminder': return 'bg-indigo-500';
=======
import React, { useEffect, useState } from 'react';
import { Plus, ArrowRight, X, Loader2 } from 'lucide-react';
import {
  createFollowUp,
  fetchCommunicationLog,
  fetchEnquiryOptions,
  fetchFollowUpTasks,
  type CommunicationLogEntry,
  type EnquiryOption,
  type FollowUpTask,
} from './_lib/follow-up-agenda-api';

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function NewReminderModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [enquiries, setEnquiries] = useState<EnquiryOption[]>([]);
  const [enquiriesLoading, setEnquiriesLoading] = useState(true);
  const [enquiriesError, setEnquiriesError] = useState<string | null>(null);

  const [enquiryId, setEnquiryId] = useState('');
  const [followUpDate, setFollowUpDate] = useState(todayIsoDate());
  const [remarks, setRemarks] = useState('');
  const [status, setStatus] = useState('open');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchEnquiryOptions()
      .then((options) => {
        if (cancelled) return;
        setEnquiries(options);
      })
      .catch((err: unknown) => {
        if (!cancelled) setEnquiriesError(err instanceof Error ? err.message : 'Failed to load enquiries.');
      })
      .finally(() => {
        if (!cancelled) setEnquiriesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!enquiryId || !followUpDate) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      await createFollowUp({ enquiryId, followUpDate, remarks, status });
      onCreated();
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create the reminder.');
    } finally {
      setSubmitting(false);
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
    }
  };

  return (
<<<<<<< HEAD
    <div className="p-8 bg-[#f4f6fa] min-h-screen font-sans antialiased text-slate-800">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
=======
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-reminder-title"
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/80 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.28)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 id="new-reminder-title" className="text-lg font-bold tracking-tight text-slate-900">
            New reminder
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div>
            <label htmlFor="reminder-enquiry" className="mb-1.5 block text-xs font-semibold text-slate-600">
              Enquiry
            </label>
            {enquiriesError ? (
              <p className="text-xs text-red-600">{enquiriesError}</p>
            ) : (
              <select
                id="reminder-enquiry"
                value={enquiryId}
                onChange={(event) => setEnquiryId(event.target.value)}
                required
                disabled={enquiriesLoading}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
              >
                <option value="" disabled>
                  {enquiriesLoading ? 'Loading enquiries…' : 'Select an enquiry'}
                </option>
                {enquiries.map((enquiry) => (
                  <option key={enquiry.id} value={enquiry.id}>
                    {enquiry.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label htmlFor="reminder-date" className="mb-1.5 block text-xs font-semibold text-slate-600">
              Follow-up date
            </label>
            <input
              id="reminder-date"
              type="date"
              value={followUpDate}
              onChange={(event) => setFollowUpDate(event.target.value)}
              required
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div>
            <label htmlFor="reminder-status" className="mb-1.5 block text-xs font-semibold text-slate-600">
              Status
            </label>
            <select
              id="reminder-status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            >
              <option value="open">Open</option>
              <option value="close">Closed</option>
            </select>
          </div>

          <div>
            <label htmlFor="reminder-remarks" className="mb-1.5 block text-xs font-semibold text-slate-600">
              Remarks
            </label>
            <textarea
              id="reminder-remarks"
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              rows={3}
              placeholder="Notes for this follow-up…"
              className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {submitError && <p className="text-xs text-red-600">{submitError}</p>}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !enquiryId}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Create reminder
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function FollowUpsContentOnly() {
  const [tasks, setTasks] = useState<FollowUpTask[]>([]);
  const [communicationLogs, setCommunicationLogs] = useState<CommunicationLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);

  const loadAgenda = () => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([fetchFollowUpTasks(), fetchCommunicationLog()])
      .then(([taskRows, logRows]) => {
        if (cancelled) return;
        setTasks(taskRows);
        setCommunicationLogs(logRows);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load follow-ups.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  };

  useEffect(() => loadAgenda(), []);

  // Action Handlers
  const handleNewReminder = () => setIsReminderModalOpen(true);
  const handleTaskClick = (task: FollowUpTask) => alert(`Opening detailed workspace for: ${task.title}`);
  const handleLogClick = (log: CommunicationLogEntry) => alert(`Viewing history audit trail for ${log.target}`);

  if (loading) {
    return (
      <div className="p-8  min-h-screen font-sans antialiased text-slate-800 flex items-center justify-center">
        <p className="text-sm text-slate-500">Loading follow-ups...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8  min-h-screen font-sans antialiased text-slate-800 flex items-center justify-center">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-8  min-h-screen font-sans antialiased text-slate-800">
      <div className="mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
        
        {/* Left Section: Scheduled Follow-ups Panel */}
        <section className="lg:col-span-7 bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-8 border-b border-[#ddd] pb-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Scheduled follow-ups</h2>
              <p className="text-sm text-slate-500 mt-0.5">Upcoming tasks and automated reminders</p>
            </div>
            <button 
              onClick={handleNewReminder}
              className="px-3.5 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50/70 hover:bg-indigo-100/90 rounded-lg transition-all flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" /> New reminder
            </button>
          </div>

          {/* Agenda Feed */}
<<<<<<< HEAD
=======
          {tasks.length === 0 ? (
            <p className="text-sm text-slate-500">No follow-ups scheduled in this window.</p>
          ) : (
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
          <div className="space-y-4">
            {tasks.map((task, index) => {
              const showDateBlock = index === 0 || tasks[index - 1].day !== task.day;

              return (
                <div key={task.id} className={`flex items-start gap-4 ${showDateBlock ? "" : "border-b border-[#ddd] pb-3"}`}>
                  {/* Date Badge Column */}
                  <div className="w-10 flex flex-col items-center justify-center text-center select-none pt-1">
                    {showDateBlock ? (
                      <>
                        <span className="text-xl font-extrabold text-slate-900 tracking-tight leading-none">{task.day}</span>
                        <span className="text-[10px] font-bold text-slate-400 tracking-wider mt-1 uppercase">{task.weekday}</span>
                      </>
                    ) : (
                      <div className="w-1.5 h-1.5 bg-slate-200 rounded-full mt-3" />
                    )}
                  </div>

<<<<<<< HEAD
                  {/* Time indicator */}
                  <span className="text-sm mt-3 font-medium text-slate-500 font-mono tracking-tight w-11">
                    {task.time}
                  </span>

                  {/* Task Card Layout Component */}
                  <div 
=======
                  {/* Task Card Layout Component */}
                  <div
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
                    onClick={() => handleTaskClick(task)}
                    className="flex-1 bg-[#f8fafc] hover:bg-[#f1f5f9] border border-slate-100 rounded-xl p-3.5 flex items-center justify-between transition-all cursor-pointer group shadow-sm hover:shadow"
                  >
                    <div className="flex items-center gap-4">
<<<<<<< HEAD
                      {/* Interactive Colored Bullet Dot Indicator */}
                      <span className={`w-2 h-2 rounded-full shrink-0 ${getDotColor(task.type)}`} />
=======
                      {/* Colored Bullet Dot Indicator */}
                      <span className="w-2 h-2 rounded-full shrink-0 bg-indigo-500" />
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d

                      <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">
                        {task.title}
                      </span>
                    </div>
                    
                    <ArrowRight className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-4px] group-hover:translate-x-0 ml-1" />
                  </div>
                </div>
              );
            })}
          </div>
<<<<<<< HEAD
=======
          )}
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
        </section>

        {/* Right Section: Recent Communication Stream Panel */}
        <section className="lg:col-span-5 bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="mb-6 border-b border-[#ddd] pb-3">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Recent communication</h2>
            <p className="text-sm text-slate-500 mt-0.5">Activity across enquiries this week</p>
          </div>

          {/* Log List configuration */}
<<<<<<< HEAD
=======
          {communicationLogs.length === 0 ? (
            <p className="text-sm text-slate-500">No follow-up activity logged yet.</p>
          ) : (
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
          <div className="space-y-1">
            {communicationLogs.map((log) => (
              <div 
                key={log.id}
                onClick={() => handleLogClick(log)}
                className="p-3 rounded-xl flex items-start gap-3.5 hover:bg-slate-50 transition-colors cursor-pointer group border-b border-[#ddd]"
              >
                {/* Initials Sphere */}
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold tracking-wider shrink-0 border border-transparent ${log.bgColor} ${log.textColor}`}>
                  {log.initials}
                </div>

                {/* Body Content Description */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className="text-sm text-slate-600 leading-normal">
                    <strong className="text-slate-900 font-semibold">{log.actor}</strong>{' '}
                    {log.actionText}{' '}
                    <span className="text-indigo-600 font-semibold group-hover:text-indigo-700 transition-colors">
                      {log.target}
                    </span>
                  </p>
                  <span className="block text-xs text-slate-400 font-medium mt-1">
                    {log.timeAgo}
                  </span>
                </div>
              </div>
            ))}
          </div>
<<<<<<< HEAD
        </section>

      </div>
=======
          )}
        </section>

      </div>

      {isReminderModalOpen && (
        <NewReminderModal
          onClose={() => setIsReminderModalOpen(false)}
          onCreated={loadAgenda}
        />
      )}
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
    </div>
  );
}