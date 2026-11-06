'use client';

import React, { useState } from 'react';
import {
  Award,
  Bell,
  BellRing,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Layers,
  MessageCircle,
  MessageSquare,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Zap,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface TriggerRule {
  id: string;
  name: string;
  description: string;
  event: string;
  schedule: string;
  channels: Array<'whatsapp' | 'sms' | 'email'>;
  enabled: boolean;
  sampleMessage: string;
  lastFired: string;
}

const INITIAL_TRIGGERS: TriggerRule[] = [
  {
    id: 'trig-1',
    name: 'Course Assignment Welcome Notification',
    description: 'Instantly dispatches onboarding guidance and module link when a student is assigned a new course or learning path.',
    event: 'lms.course.assigned',
    schedule: 'Immediately upon enrollment',
    channels: ['whatsapp', 'email'],
    enabled: true,
    sampleMessage: 'Dear {student_name}, you have been enrolled in {course_name}. Module 1 is now active on your LMS dashboard. Begin your modules before {due_date}.',
    lastFired: 'Today, 11:20 AM (28 sent)',
  },
  {
    id: 'trig-2',
    name: 'Live Virtual Session 15-Minute Countdown Alert',
    description: 'Broadcasts direct classroom meeting link to enrolled students 15 minutes before instructor-led session begins.',
    event: 'lms.session.upcoming',
    schedule: '15 mins before start time',
    channels: ['whatsapp', 'sms'],
    enabled: true,
    sampleMessage: 'Dear {student_name}, your live session for {course_name} with {instructor_name} begins in 15 minutes. Join via LMS Sessions & Calendar.',
    lastFired: 'Yesterday, 02:45 PM (44 sent)',
  },
  {
    id: 'trig-3',
    name: 'Assessment Due Date 24-Hour Reminder',
    description: 'Sends an urgent reminder to all participants with pending diagnostic assessments or final module quizzes.',
    event: 'lms.assessment.due_soon',
    schedule: '24 hours before deadline',
    channels: ['sms', 'whatsapp'],
    enabled: true,
    sampleMessage: 'Reminder: {test_title} for {course_name} closes tomorrow at 11:59 PM. Please submit your answers to record your score.',
    lastFired: '03 Nov 2026, 09:00 AM (16 sent)',
  },
  {
    id: 'trig-4',
    name: 'Learner Inactivity & Pacing Nudge',
    description: 'Notifies parents and students if zero module progression is recorded 7 days after course assignment.',
    event: 'lms.progress.nudge',
    schedule: 'Daily at 06:00 PM (Inactivity check)',
    channels: ['whatsapp'],
    enabled: true,
    sampleMessage: 'Dear Parent, {student_name} has pending lessons in {course_name}. Encourage 20 minutes of daily learning on Scholar LMS.',
    lastFired: '02 Nov 2026, 06:00 PM (12 sent)',
  },
  {
    id: 'trig-5',
    name: 'Course Completion & Digital Certificate Dispatch',
    description: 'Celebrates learner success upon reaching 100% completion and passes the competency benchmark.',
    event: 'lms.certificate.generated',
    schedule: 'Instantly on course completion',
    channels: ['whatsapp', 'email'],
    enabled: true,
    sampleMessage: 'Congratulations {student_name}! You have completed {course_name} with distinction. Your verified certificate is ready to download.',
    lastFired: '01 Nov 2026, 04:15 PM (8 sent)',
  },
];

export function LmsAutomatedTriggers() {
  const [triggers, setTriggers] = useState<TriggerRule[]>(INITIAL_TRIGGERS);

  const toggleTrigger = (id: string) => {
    setTriggers((curr) =>
      curr.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t))
    );
  };

  const activeCount = triggers.filter((t) => t.enabled).length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <Zap className="size-5 text-[#5846EA]" />
          Automated LMS Triggers &amp; Rule Engine
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Configure rule-based alerts triggered by student enrollments, upcoming live sessions, and assignment deadlines.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Dispatches</div>
          <div className="mt-2 text-3xl font-extrabold text-slate-900 tabular-nums">428</div>
          <p className="mt-1 text-xs text-slate-500">Automated alerts this term</p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Delivery Rate</div>
          <div className="mt-2 text-3xl font-extrabold text-emerald-600 tabular-nums">99.4%</div>
          <p className="mt-1 text-xs text-slate-500">SMS &amp; WhatsApp gateway uptime</p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Rules</div>
          <div className="mt-2 text-3xl font-extrabold text-[#5846EA] tabular-nums">{activeCount} of {triggers.length}</div>
          <p className="mt-1 text-xs text-slate-500">Listening to LMS events</p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Delivery Channels</div>
          <div className="mt-2 text-3xl font-extrabold text-slate-900">3</div>
          <p className="mt-1 text-xs text-slate-500">WhatsApp, SMS, Email</p>
        </div>
      </div>

      {/* Trigger Rules List */}
      <div className="space-y-4">
        {triggers.map((rule) => (
          <article
            key={rule.id}
            className={`rounded-2xl border bg-white p-6 shadow-xs transition-all ${
              rule.enabled ? 'border-slate-200/90' : 'border-slate-200 bg-slate-50/50 opacity-70'
            }`}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      rule.enabled
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    <span className={`size-1.5 rounded-full ${rule.enabled ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    {rule.enabled ? 'Active Trigger' : 'Paused'}
                  </span>

                  <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">
                    Event: <code className="text-[#5846EA] font-semibold">{rule.event}</code>
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900 pt-1 tracking-tight">{rule.name}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{rule.description}</p>
              </div>

              {/* Toggle Switch */}
              <button
                type="button"
                onClick={() => toggleTrigger(rule.id)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  rule.enabled ? 'bg-[#5846EA]' : 'bg-slate-200'
                }`}
                role="switch"
                aria-checked={rule.enabled}
              >
                <span
                  className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    rule.enabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Template Preview Box */}
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs text-slate-700">
              <span className="font-bold text-slate-500 uppercase tracking-wider block mb-1">Trigger Message Format:</span>
              <p className="font-mono text-[11px] text-slate-800 leading-relaxed bg-white p-2.5 rounded-lg border border-slate-200/80">
                {rule.sampleMessage}
              </p>
            </div>

            {/* Rule Footer Info */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 font-medium">
                  <Clock className="size-3.5 text-slate-400" />
                  {rule.schedule}
                </span>

                <div className="flex items-center gap-1.5">
                  {rule.channels.map((ch) => (
                    <span
                      key={ch}
                      className="inline-flex items-center gap-1 rounded bg-indigo-50 text-[#5846EA] px-2 py-0.5 text-[11px] font-semibold capitalize"
                    >
                      {ch === 'whatsapp' ? <MessageCircle className="size-3" /> : ch === 'sms' ? <Smartphone className="size-3" /> : <Bell className="size-3" />}
                      {ch}
                    </span>
                  ))}
                </div>
              </div>

              <span className="text-slate-400 font-medium">
                Last fired: <strong className="text-slate-600 font-semibold">{rule.lastFired}</strong>
              </span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

