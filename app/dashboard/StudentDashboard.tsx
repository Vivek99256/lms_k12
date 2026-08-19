'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { BookOpen, ClipboardList, PenSquare, Award, Megaphone, School } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchStudentDashboard, getDashboardSession, type StudentDashboardSummary } from '@/app/dashboard/_lib/dashboard-api';
import { DashboardError, DashboardSkeleton, EmptyState, SectionPanel, StatCard } from '@/app/dashboard/_components/DashboardPrimitives';
import { DashboardBarChart } from '@/app/dashboard/_components/DashboardBarChart';

export default function StudentDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<StudentDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const session = getDashboardSession();
    fetchStudentDashboard(session)
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return (
    <div className="flex-1 overflow-auto p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Welcome back, {user?.name || 'Student'}</h1>
        {data?.enrollment ? (
          <p className="mt-1 text-slate-500">
            {data.enrollment.standard_name} - {data.enrollment.section_name}
          </p>
        ) : (
          <p className="mt-1 text-slate-500">Here&apos;s your learning summary for today.</p>
        )}
      </div>

      {loading && <DashboardSkeleton />}
      {!loading && error && <DashboardError message={error} onRetry={load} />}

      {!loading && !error && data && (
        <>
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Enrolled subjects" value={data.summary.total_subjects} icon={BookOpen} />
            <StatCard
              label="Pending homework"
              value={data.summary.pending_homework}
              icon={ClipboardList}
              tone={data.summary.pending_homework > 0 ? 'warning' : 'default'}
            />
            <StatCard
              label="Pending assignments"
              value={data.summary.pending_assignments}
              icon={PenSquare}
              tone={data.summary.pending_assignments > 0 ? 'warning' : 'default'}
            />
          </div>

          <SectionPanel title="Homework & assignments" description="Your progress this year" className="mb-6">
            {data.task_status.every((row) => row.value === 0) ? (
              <EmptyState message="No homework or assignments recorded yet." />
            ) : (
              <DashboardBarChart
                labels={data.task_status.map((row) => row.label)}
                values={data.task_status.map((row) => row.value)}
              />
            )}
          </SectionPanel>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <SectionPanel title="Pending homework" description="Not yet marked complete">
              {data.pending_homework.length === 0 ? (
                <EmptyState message="No pending homework. Nicely done." />
              ) : (
                <div className="divide-y divide-slate-100">
                  {data.pending_homework.map((row) => (
                    <div key={row.id} className="flex items-center justify-between py-3 text-sm">
                      <div className="font-medium text-slate-900">{row.title}</div>
                      <div className="text-slate-500">{row.date}</div>
                    </div>
                  ))}
                </div>
              )}
            </SectionPanel>

            <SectionPanel title="Pending assignments" description="Awaiting your submission">
              {data.pending_assignments.length === 0 ? (
                <EmptyState message="No pending assignments." />
              ) : (
                <div className="divide-y divide-slate-100">
                  {data.pending_assignments.map((row) => (
                    <div key={row.id} className="flex items-center justify-between py-3 text-sm">
                      <div className="font-medium text-slate-900">{row.title}</div>
                      <div className="text-slate-500">{row.submission_date ?? 'No due date'}</div>
                    </div>
                  ))}
                </div>
              )}
            </SectionPanel>

            <SectionPanel title="My subjects" description="Your enrolled subjects this year">
              {data.my_subjects.length === 0 ? (
                <EmptyState message="No subjects enrolled yet." />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {data.my_subjects.map((s) => (
                    <span key={s.id} className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700">
                      <School size={14} className="text-[#4F46E5]" strokeWidth={1.75} />
                      {s.subject_name}
                    </span>
                  ))}
                </div>
              )}
            </SectionPanel>

            <SectionPanel title="Recent circulars" description="Notices for your class">
              {data.recent_circulars.length === 0 ? (
                <EmptyState message="No recent circulars for your class." />
              ) : (
                <div className="divide-y divide-slate-100">
                  {data.recent_circulars.map((row) => (
                    <div key={row.id} className="flex items-center gap-3 py-3 text-sm">
                      <Megaphone size={16} className="text-[#4F46E5]" strokeWidth={1.75} />
                      <div className="flex-1 font-medium text-slate-900">{row.title}</div>
                      <div className="text-slate-500">{row.date_}</div>
                    </div>
                  ))}
                </div>
              )}
            </SectionPanel>

            <SectionPanel title="Achievements" description="Badges and milestones" className="lg:col-span-2">
              <EmptyState message="Achievements are coming soon." />
              <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
                <Award size={14} strokeWidth={1.75} />
                This section will populate once gamification is enabled for your school.
              </p>
            </SectionPanel>
          </div>
        </>
      )}
    </div>
  );
}
