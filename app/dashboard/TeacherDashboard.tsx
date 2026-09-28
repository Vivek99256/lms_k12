'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Users, School, BookOpen, ClipboardList, PenSquare, CalendarCheck, Megaphone, NotebookPen, Clock, Wallet, IdCard } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchTeacherDashboard, getDashboardSession, type TeacherDashboardSummary } from '@/app/dashboard/_lib/dashboard-api';
import { DashboardError, DashboardSkeleton, EmptyState, QuickActionLink, SectionPanel, StatCard } from '@/app/dashboard/_components/DashboardPrimitives';
import { DashboardBarChart } from '@/app/dashboard/_components/DashboardBarChart';
import { AllWidgetsHiddenNotice, CustomizeDashboard } from '@/app/dashboard/_components/CustomizeDashboard';
import { useDashboardPreferences } from '@/app/dashboard/_lib/useDashboardPreferences';
import type { DashboardWidget } from '@/app/dashboard/_lib/dashboard-preferences';

/** Everything on this dashboard a user can hide for themselves. Ids are stored per user — don't rename them. */
const TEACHER_WIDGETS = [
  { id: 'kpi.my_classes', label: 'My classes', group: 'kpi' },
  { id: 'kpi.my_students', label: 'My students', group: 'kpi' },
  { id: 'kpi.subjects', label: 'Subjects', group: 'kpi' },
  { id: 'kpi.homework_to_review', label: 'Homework to review', group: 'kpi' },
  { id: 'kpi.assignments_to_grade', label: 'Assignments to grade', group: 'kpi' },
  { id: 'chart.students_by_class', label: 'Students by class', group: 'chart' },
  { id: 'panel.quick_actions', label: 'Quick actions', group: 'panel' },
  { id: 'panel.my_classes', label: 'My classes list', group: 'panel' },
  { id: 'panel.assignments_to_grade', label: 'Assignments awaiting grading', group: 'panel' },
  { id: 'panel.my_subjects', label: 'My subjects', group: 'panel' },
  { id: 'panel.recent_circulars', label: 'Recent circulars', group: 'panel' },
] as const satisfies readonly DashboardWidget[];

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<TeacherDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const prefs = useDashboardPreferences('home.teacher', TEACHER_WIDGETS);
  const show = prefs.isVisible;
  // "My classes" and "Assignments awaiting grading" share a row; a lone one takes the full width.
  const bothHalfPanels = show('panel.my_classes') && show('panel.assignments_to_grade');
  const anyLowerPanel =
    show('panel.my_classes') || show('panel.assignments_to_grade') || show('panel.my_subjects') || show('panel.recent_circulars');

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const session = getDashboardSession();
    fetchTeacherDashboard(session)
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
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Welcome back, {user?.name || 'Teacher'}</h1>
          <p className="mt-1 text-slate-500">Here&apos;s what&apos;s happening in your classroom today.</p>
        </div>
        {prefs.ready && (
          <CustomizeDashboard widgets={TEACHER_WIDGETS} {...prefs.customizeProps} />
        )}
      </div>

      {/* Wait for the user's layout too, so hidden widgets never flash in. */}
      {(loading || !prefs.ready) && <DashboardSkeleton />}
      {!loading && prefs.ready && error && <DashboardError message={error} onRetry={load} />}

      {!loading && prefs.ready && !error && data && !prefs.hasVisible() && (
        <AllWidgetsHiddenNotice />
      )}

      {!loading && prefs.ready && !error && data && (
        <>
          {prefs.hasVisible('kpi') && (
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {show('kpi.my_classes') && <StatCard label="My classes" value={data.summary.total_classes} icon={School} />}
              {show('kpi.my_students') && <StatCard label="My students" value={data.summary.total_students} icon={Users} />}
              {show('kpi.subjects') && <StatCard label="Subjects" value={data.summary.total_subjects} icon={BookOpen} />}
              {show('kpi.homework_to_review') && (
                <StatCard
                  label="Homework to review"
                  value={data.summary.homework_to_review}
                  icon={ClipboardList}
                  tone={data.summary.homework_to_review > 0 ? 'warning' : 'default'}
                />
              )}
              {show('kpi.assignments_to_grade') && (
                <StatCard
                  label="Assignments to grade"
                  value={data.summary.assignments_to_grade}
                  icon={PenSquare}
                  tone={data.summary.assignments_to_grade > 0 ? 'warning' : 'default'}
                />
              )}
            </div>
          )}

          {show('panel.quick_actions') && (
            <SectionPanel title="Quick actions" className="mb-6">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <QuickActionLink href="/attendance/attendance_dashboard" label="Take attendance" icon={CalendarCheck} />
                <QuickActionLink href="/lms/homework" label="Post homework" icon={NotebookPen} />
                <QuickActionLink href="/lms/lmsAnnotate_assignment" label="Grade assignments" icon={PenSquare} />
                <QuickActionLink href="/front_desk/circular" label="Post circular" icon={Megaphone} />
                <QuickActionLink href="/lms/teacher-timetable" label="My timetable" icon={Clock} />
                <QuickActionLink href="/fees/teacher-dues" label="Fee dues (my class)" icon={Wallet} />
                <QuickActionLink href="/student/my_icard" label="My ID card" icon={IdCard} />
              </div>
            </SectionPanel>
          )}

          {show('chart.students_by_class') && (
            <SectionPanel title="Students by class" description="Enrollment across the sections you teach" className="mb-6">
              {data.students_by_class.length === 0 ? (
                <EmptyState message="You are not assigned as a class teacher this year." />
              ) : (
                <DashboardBarChart
                  labels={data.students_by_class.map((row) => row.label)}
                  values={data.students_by_class.map((row) => row.students)}
                />
              )}
            </SectionPanel>
          )}

          {anyLowerPanel && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {show('panel.my_classes') && (
                <SectionPanel title="My classes" description="Sections you are the class teacher for" className={bothHalfPanels ? '' : 'lg:col-span-2'}>
                  {data.my_classes.length === 0 ? (
                    <EmptyState message="You are not assigned as a class teacher this year." />
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {data.my_classes.map((c) => (
                        <span
                          key={`${c.standard_id}-${c.division_id}`}
                          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-700"
                        >
                          {c.standard_name} - {c.division_name}
                        </span>
                      ))}
                    </div>
                  )}
                </SectionPanel>
              )}

              {show('panel.assignments_to_grade') && (
                <SectionPanel
                  title="Assignments awaiting grading"
                  description="Submitted by students, not yet graded"
                  className={bothHalfPanels ? '' : 'lg:col-span-2'}
                >
                  {data.assignments_to_grade.length === 0 ? (
                    <EmptyState message="No assignments waiting for grading." />
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {data.assignments_to_grade.map((row) => (
                        <div key={row.id} className="flex items-center justify-between py-3 text-sm">
                          <div className="font-medium text-slate-900">{row.title}</div>
                          <div className="text-slate-500">{row.student_submitted_date ?? '-'}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionPanel>
              )}

              {show('panel.my_subjects') && (
                <SectionPanel title="My subjects" className="lg:col-span-2">
                  {data.my_subjects.length === 0 ? (
                    <EmptyState message="No subjects configured for your school yet." />
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {data.my_subjects.map((s) => (
                        <span key={s.id} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700">
                          {s.subject_name}
                        </span>
                      ))}
                    </div>
                  )}
                </SectionPanel>
              )}

              {show('panel.recent_circulars') && (
                <SectionPanel title="Recent circulars" description="Notices sent to your classes" className="lg:col-span-2">
                  {data.recent_circulars.length === 0 ? (
                    <EmptyState message="No recent circulars for your classes." />
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {data.recent_circulars.map((row) => (
                        <div key={row.id} className="flex items-center justify-between py-3 text-sm">
                          <div className="font-medium text-slate-900">{row.title}</div>
                          <div className="text-slate-500">{row.date_}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionPanel>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
