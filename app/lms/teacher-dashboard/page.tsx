'use client';

import { useCallback, useEffect, useState } from 'react';
import { BookOpen, ClipboardList, GraduationCap, LibraryBig, NotebookPen, PenSquare, School, Users } from 'lucide-react';

import { fetchTeacherDashboard, getDashboardSession, type TeacherDashboardSummary } from '@/app/dashboard/_lib/dashboard-api';
import { DashboardError, DashboardSkeleton, EmptyState, QuickActionLink, SectionPanel, StatCard } from '@/app/dashboard/_components/DashboardPrimitives';
import { AllWidgetsHiddenNotice, CustomizeDashboard } from '@/app/dashboard/_components/CustomizeDashboard';
import { useDashboardPreferences } from '@/app/dashboard/_lib/useDashboardPreferences';
import type { DashboardWidget } from '@/app/dashboard/_lib/dashboard-preferences';
import RequireStaff from '@/app/lms/_shared/RequireStaff';

/**
 * Everything on this dashboard a user can hide for themselves. Ids are stored per user — don't rename them.
 * Same ids as TEACHER_WIDGETS in app/dashboard/TeacherDashboard.tsx for the widgets both screens share.
 */
const LMS_TEACHER_WIDGETS = [
  { id: 'kpi.my_classes', label: 'My classes', group: 'kpi' },
  { id: 'kpi.my_students', label: 'My students', group: 'kpi' },
  { id: 'kpi.subjects', label: 'Subjects', group: 'kpi' },
  { id: 'kpi.homework_to_review', label: 'Homework to review', group: 'kpi' },
  { id: 'kpi.assignments_to_grade', label: 'Assignments to grade', group: 'kpi' },
  { id: 'panel.quick_actions', label: 'LMS quick actions', group: 'panel' },
  { id: 'panel.my_classes', label: 'My classes list', group: 'panel' },
  { id: 'panel.assignments_to_grade', label: 'Assignments awaiting grading', group: 'panel' },
  { id: 'panel.my_subjects', label: 'My subjects', group: 'panel' },
  { id: 'panel.recent_circulars', label: 'Recent circulars', group: 'panel' },
] as const satisfies readonly DashboardWidget[];

const LOWER_PANELS = ['panel.my_classes', 'panel.assignments_to_grade', 'panel.my_subjects', 'panel.recent_circulars'] as const;

export default function LmsTeacherDashboardPage() {
  const [data, setData] = useState<TeacherDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const prefs = useDashboardPreferences('lms.teacher-dashboard', LMS_TEACHER_WIDGETS);
  const show = prefs.isVisible;
  // The lower panels sit two to a row; an odd one out at the end takes the full row instead of leaving a gap.
  const visibleLowerPanels = LOWER_PANELS.filter((id) => show(id));
  const fullRowPanel = visibleLowerPanels.length % 2 === 1 ? visibleLowerPanels[visibleLowerPanels.length - 1] : null;

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
            {prefs.ready ? (
              <CustomizeDashboard widgets={LMS_TEACHER_WIDGETS} {...prefs.customizeProps} className="ml-auto shrink-0" />
            ) : null}
          </header>

          {/* Wait for the user's layout too, so hidden widgets never flash in. */}
          {loading || !prefs.ready ? <DashboardSkeleton /> : null}
          {!loading && prefs.ready && error ? <DashboardError message={error} onRetry={load} /> : null}

          {!loading && prefs.ready && !error && data && !prefs.hasVisible() ? <AllWidgetsHiddenNotice /> : null}

          {!loading && prefs.ready && !error && data ? (
            <>
              {prefs.hasVisible('kpi') ? (
                <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  {show('kpi.my_classes') ? <StatCard label="My classes" value={data.summary.total_classes} icon={School} /> : null}
                  {show('kpi.my_students') ? <StatCard label="My students" value={data.summary.total_students} icon={Users} /> : null}
                  {show('kpi.subjects') ? <StatCard label="Subjects" value={data.summary.total_subjects} icon={BookOpen} /> : null}
                  {show('kpi.homework_to_review') ? (
                    <StatCard label="Homework to review" value={data.summary.homework_to_review} icon={ClipboardList} tone={data.summary.homework_to_review > 0 ? 'warning' : 'default'} />
                  ) : null}
                  {show('kpi.assignments_to_grade') ? (
                    <StatCard label="Assignments to grade" value={data.summary.assignments_to_grade} icon={PenSquare} tone={data.summary.assignments_to_grade > 0 ? 'warning' : 'default'} />
                  ) : null}
                </section>
              ) : null}

              {show('panel.quick_actions') ? (
                <SectionPanel title="LMS quick actions">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <QuickActionLink href="/lms/dashboard" label="View student progress" icon={GraduationCap} />
                    <QuickActionLink href="/lms/teacher-diary" label="Open teacher diary" icon={NotebookPen} />
                    <QuickActionLink href="/lms/lms_teacherResource" label="Browse teacher workspace" icon={LibraryBig} />
                  </div>
                </SectionPanel>
              ) : null}

              {visibleLowerPanels.length > 0 ? (
                <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  {show('panel.my_classes') ? (
                    <SectionPanel title="My classes" description="Sections assigned to you" className={fullRowPanel === 'panel.my_classes' ? 'lg:col-span-2' : ''}>
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
                  ) : null}

                  {show('panel.assignments_to_grade') ? (
                    <SectionPanel
                      title="Assignments awaiting grading"
                      description="Submitted work awaiting your review"
                      className={fullRowPanel === 'panel.assignments_to_grade' ? 'lg:col-span-2' : ''}
                    >
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
                  ) : null}

                  {show('panel.my_subjects') ? (
                    <SectionPanel title="My subjects" className={fullRowPanel === 'panel.my_subjects' ? 'lg:col-span-2' : ''}>
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
                  ) : null}

                  {show('panel.recent_circulars') ? (
                    <SectionPanel
                      title="Recent circulars"
                      description="Notices sent to your classes"
                      className={fullRowPanel === 'panel.recent_circulars' ? 'lg:col-span-2' : ''}
                    >
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
                  ) : null}
                </section>
              ) : null}
            </>
          ) : null}
        </div>
      </main>
    </RequireStaff>
  );
}
