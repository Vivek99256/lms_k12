'use client';

import { useCallback, useEffect, useState } from 'react';
import { BookOpen, ClipboardList, GraduationCap, LibraryBig, NotebookPen, PenSquare, School, Users } from 'lucide-react';

import { fetchTeacherDashboard, getDashboardSession, type TeacherDashboardSummary } from '@/app/dashboard/_lib/dashboard-api';
import { DashboardError, DashboardSkeleton, EmptyState, QuickActionLink, SectionPanel, StatCard } from '@/app/dashboard/_components/DashboardPrimitives';
import RequireStaff from '@/app/lms/_shared/RequireStaff';

export default function LmsTeacherDashboardPage() {
  const [data, setData] = useState<TeacherDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);

    fetchTeacherDashboard(getDashboardSession())
      .then(setData)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load the LMS teacher dashboard.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    queueMicrotask(load);
  }, [load]);

  return (
    <RequireStaff>
      <main className="min-h-full px-4 py-5 sm:px-6">
        <div className="mx-auto w-full max-w-[1600px] space-y-5">
          <header className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <GraduationCap className="size-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">LMS Teacher Dashboard</h1>
              <p className="mt-0.5 text-sm text-slate-500">Manage your classes, learning activities, and pending reviews.</p>
            </div>
          </header>

          {loading ? <DashboardSkeleton /> : null}
          {!loading && error ? <DashboardError message={error} onRetry={load} /> : null}

          {!loading && !error && data ? (
            <>
              <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <StatCard label="My classes" value={data.summary.total_classes} icon={School} />
                <StatCard label="My students" value={data.summary.total_students} icon={Users} />
                <StatCard label="Subjects" value={data.summary.total_subjects} icon={BookOpen} />
                <StatCard label="Homework to review" value={data.summary.homework_to_review} icon={ClipboardList} tone={data.summary.homework_to_review > 0 ? 'warning' : 'default'} />
                <StatCard label="Assignments to grade" value={data.summary.assignments_to_grade} icon={PenSquare} tone={data.summary.assignments_to_grade > 0 ? 'warning' : 'default'} />
              </section>

              <SectionPanel title="LMS quick actions">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <QuickActionLink href="/lms/dashboard" label="View student progress" icon={GraduationCap} />
                  <QuickActionLink href="/lms/teacher-diary" label="Open teacher diary" icon={NotebookPen} />
                  <QuickActionLink href="/lms/lms_teacherResource" label="Browse teacher resources" icon={LibraryBig} />
                </div>
              </SectionPanel>

              <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <SectionPanel title="My classes" description="Sections assigned to you">
                  {data.my_classes.length === 0 ? (
                    <EmptyState message="You are not assigned as a class teacher this year." />
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {data.my_classes.map((item) => (
                        <span key={`${item.standard_id}-${item.division_id}`} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-700">
                          {item.standard_name} - {item.division_name}
                        </span>
                      ))}
                    </div>
                  )}
                </SectionPanel>

                <SectionPanel title="Assignments awaiting grading" description="Submitted work awaiting your review">
                  {data.assignments_to_grade.length === 0 ? (
                    <EmptyState message="No assignments are waiting for grading." />
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {data.assignments_to_grade.map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                          <span className="font-medium text-slate-900">{item.title}</span>
                          <span className="shrink-0 text-slate-500">{item.student_submitted_date ?? '-'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionPanel>

                <SectionPanel title="My subjects">
                  {data.my_subjects.length === 0 ? (
                    <EmptyState message="No subjects are configured for your school yet." />
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {data.my_subjects.map((item) => (
                        <span key={item.id} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700">{item.subject_name}</span>
                      ))}
                    </div>
                  )}
                </SectionPanel>

                <SectionPanel title="Recent circulars" description="Notices sent to your classes">
                  {data.recent_circulars.length === 0 ? (
                    <EmptyState message="No recent circulars for your classes." />
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {data.recent_circulars.map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                          <span className="font-medium text-slate-900">{item.title}</span>
                          <span className="shrink-0 text-slate-500">{item.date_}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionPanel>
              </section>
            </>
          ) : null}
        </div>
      </main>
    </RequireStaff>
  );
}
