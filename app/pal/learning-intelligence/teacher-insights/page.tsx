'use client';

/**
 * Teacher Learning Insights — the class-wide learning map plus the
 * roster/misconceptions dashboard that was already built here and soft-
 * disabled behind a "coming soon" panel. Re-enabling means wiring the
 * already-built pieces back together, not building a second roster:
 * `fetchClassRoster()`/`fetchClassReport()` and `ActionItemsTimeline`/
 * `MisconceptionBoard` are reused unchanged. The one genuinely new piece is
 * the class map itself, fed by a batched fan-out of the student journey's
 * own `fetchJourneyData()` (see `data/class-journey.ts`) — never a
 * server-side reimplementation of "which milestone is this student on".
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Map, Search, Users } from 'lucide-react';
import IconBadge from '../_components/IconBadge';
import SectionCard from '../_components/SectionCard';
import { HEADER_WASH } from '../_components/design-system';
import ClassScopePicker, { type ClassMapScope } from './_components/ClassScopePicker';
import ActionItemsTimeline from './_components/ActionItemsTimeline';
import MisconceptionBoard from './_components/MisconceptionBoard';
import { IsometricClassBoard } from './_components/IsometricClassBoard';
import { fetchClassReport, fetchClassRoster, type ClassReport, type RosterRow } from '../data/teacher-insights';
import { fetchClassJourneyPositions, type ClassJourneyResult } from '../data/class-journey';

export default function TeacherInsightsPage() {
  const router = useRouter();
  const [scope, setScope] = useState<ClassMapScope | null>(null);

  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [report, setReport] = useState<ClassReport | null>(null);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);

  const [journey, setJourney] = useState<ClassJourneyResult | null>(null);
  const [journeyLoading, setJourneyLoading] = useState(false);
  // The class map is heavy (one fetchJourneyData() per student, batched —
  // see fetchClassJourneyPositions()'s own docblock), so it only loads when
  // a teacher actually asks for it, not automatically the moment a class is
  // picked. A teacher who wants one particular student's map never needs to
  // pay that cost at all — see the student search box below, which works
  // off the roster alone (already a single fast bulk query) and routes
  // straight to that student's own page.
  const [mapRequested, setMapRequested] = useState(false);
  const [studentQuery, setStudentQuery] = useState('');

  // Whole-scope roster + class report — independent of chapter choice, so
  // switching chapters never re-triggers this.
  useEffect(() => {
    setMapRequested(false);
    setJourney(null);
    setStudentQuery('');
    if (!scope) return;
    const controller = new AbortController();
    const params = { standardId: scope.standardId, syear: scope.syear, sectionId: scope.sectionId, subjectId: scope.subjectId };
    setRosterLoading(true);
    setRosterError(null);
    Promise.all([fetchClassRoster(params, controller.signal), fetchClassReport(params, controller.signal)])
      .then(([rosterRows, classReport]) => {
        if (controller.signal.aborted) return;
        setRoster(rosterRows);
        setReport(classReport);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setRosterError(reason instanceof Error ? reason.message : 'Could not load this class.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setRosterLoading(false);
      });
    return () => controller.abort();
  }, [scope]);

  // Chapter-scoped journey positions — one fetchJourneyData() per roster
  // student, batched and progressive (see fetchClassJourneyPositions()'s
  // own docblock for why). Gated on mapRequested: this never fires just
  // because a class/chapter was picked, only once the teacher clicks
  // "Load class map".
  useEffect(() => {
    if (!scope || !mapRequested || roster.length === 0) return;
    const controller = new AbortController();
    setJourneyLoading(true);
    const students = roster.map((row) => ({ studentId: String(row.studentId), name: row.name }));
    fetchClassJourneyPositions(
      scope.chapterId,
      students,
      (partial) => {
        if (!controller.signal.aborted) setJourney(partial);
      },
      controller.signal
    ).finally(() => {
      if (!controller.signal.aborted) setJourneyLoading(false);
    });
    return () => controller.abort();
  }, [scope, roster, mapRequested]);

  const goToStudent = useCallback(
    (studentId: number | string) => {
      if (!scope) return;
      router.push(`/pal/teacher/journey/${studentId}?chapterId=${scope.chapterId}`);
    },
    [router, scope]
  );

  // Name/id filter over the roster already in memory — no extra fetch, so
  // this is usable the moment the roster loads, well before (or entirely
  // without) ever loading the heavier class map below.
  const matchingStudents = useMemo(() => {
    const term = studentQuery.trim().toLowerCase();
    if (!term) return [];
    return roster
      .filter((row) => (row.name ?? '').toLowerCase().includes(term) || String(row.studentId).includes(term))
      .slice(0, 8);
  }, [roster, studentQuery]);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6">
      <header className={`mx-auto mb-6 flex max-w-6xl items-center gap-3 rounded-2xl p-5 ${HEADER_WASH}`}>
        <IconBadge icon={Users} accent="brand" size="lg" />
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Teacher Learning Insights</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Class and student PAL progress — diagnostics, mastery, weak concepts and who needs help.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-6xl">
        {!scope ? (
          <div className="mx-auto max-w-2xl">
            <ClassScopePicker onSelect={setScope} size="lg" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
            <div className="space-y-4">
              <ClassScopePicker onSelect={setScope} />
            </div>

            <div className="space-y-4">
              <SectionCard title="Jump to one student" icon={Search} accent="brand">
                <p className="mb-2 text-xs text-slate-500">
                  Want just one student&apos;s map? Search by name — this skips loading the whole class.
                </p>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={studentQuery}
                    onChange={(event) => setStudentQuery(event.target.value)}
                    placeholder={rosterLoading ? 'Loading class…' : 'Student name or id'}
                    disabled={rosterLoading || roster.length === 0}
                    className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                  />
                </div>
                {studentQuery.trim() ? (
                  matchingStudents.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-500">No student matches &quot;{studentQuery}&quot;.</p>
                  ) : (
                    <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
                      {matchingStudents.map((student) => (
                        <li key={student.studentId}>
                          <button
                            type="button"
                            onClick={() => goToStudent(student.studentId)}
                            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                          >
                            <span>{student.name ?? `Student #${student.studentId}`}</span>
                            <span className="text-xs font-medium text-indigo-600">View journey →</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )
                ) : null}
              </SectionCard>

              <SectionCard
                title="Class learning map"
                icon={Map}
                accent="brand"
                action={
                  journey && journeyLoading ? (
                    <span className="text-xs text-slate-500">
                      Loaded {journey.loadedCount} of {journey.totalCount}…
                    </span>
                  ) : undefined
                }
              >
                {!mapRequested ? (
                  <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 py-10 text-center">
                    <p className="max-w-sm text-sm text-slate-500">
                      Loads every student&apos;s current step in this chapter — one request per student, so it can
                      take a moment for a large class.
                    </p>
                    <button
                      type="button"
                      onClick={() => setMapRequested(true)}
                      disabled={roster.length === 0}
                      className="mt-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      Load class map
                    </button>
                  </div>
                ) : !journey ? (
                  <div className="flex items-center justify-center py-16 text-sm text-slate-500">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Loading class map…
                  </div>
                ) : (
                  <IsometricClassBoard positionsByMilestone={journey.positionsByMilestone} onSelectStudent={goToStudent} />
                )}
              </SectionCard>

              {rosterLoading ? (
                <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-8 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading class…
                </div>
              ) : rosterError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{rosterError}</div>
              ) : (
                <>
                  <ActionItemsTimeline actionItems={report?.actionItems ?? []} roster={roster} onSelectStudent={goToStudent} />
                  <MisconceptionBoard items={report?.misconceptionAnalysis.topMisconceptions ?? []} />
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
