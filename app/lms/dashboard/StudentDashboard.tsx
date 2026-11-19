'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileText,
  GraduationCap,
  Layers,
  Loader2,
  School,
  Trophy,
  User,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { buildSessionContext, readString } from '@/lib/erp-client';
import { friendlyError } from '@/lib/user-messages';
import { fetchLmsCourses, type LmsSubject } from '@/app/course-master/data/lmsCourses';
import { fetchLmsDashboard, type LmsDashboard } from '@/app/lms/data/lmsDashboard';
import { listMySubmissions, type MySubmissionRow } from '@/app/lms/homework/api';
import { listOnlineExams, type OnlineExamListItem } from '@/app/exam/data/onlineExam';

/**
 * Student home (Teach/Learn -> LMS Dashboard). Every number comes from the signed-in student's own
 * records: the backend pins subjects, homework and exams to the verified token, so nothing here
 * can show another student's or another standard's data. Each section loads on its own and shows
 * its own empty/error state, so one failing API never blanks the page.
 */

type Section<T> = { status: 'loading' | 'ready' | 'error'; data: T; error?: string };
const loading = <T,>(data: T): Section<T> => ({ status: 'loading', data });

function storedRecord(key: string): Record<string, unknown> {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '{}') as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Parses 'YYYY-MM-DD…' or 'DD-MM-YYYY'; null when it is not a date. */
function parseDate(value: string): Date | null {
  const text = value.trim();
  if (!text) return null;
  let match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  match = /^(\d{2})-(\d{2})-(\d{4})/.exec(text);
  if (match) return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  return null;
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function formatDate(date: Date | null, fallback: string): string {
  return date ? date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : fallback || '—';
}

function chapterCount(subject: LmsSubject): number {
  return Array.isArray(subject.chapters) ? subject.chapters.length : 0;
}

function barColor(percent: number): string {
  if (percent >= 75) return 'bg-emerald-500';
  if (percent >= 50) return 'bg-sky-500';
  if (percent >= 35) return 'bg-amber-500';
  return 'bg-rose-500';
}

function SectionShell({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon: typeof BookOpen;
  action?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="size-4 text-indigo-500" />
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {action ? (
          <Link href={action.href} className="ml-auto text-sm font-medium text-indigo-600 hover:underline">
            {action.label}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Placeholder({ section, empty }: { section: Pick<Section<unknown>, 'status' | 'error'>; empty: string }) {
  if (section.status === 'loading') {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
        <Loader2 className="size-4 animate-spin" /> Loading…
      </div>
    );
  }
  if (section.status === 'error') {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        {section.error}
      </div>
    );
  }
  return (
    <p className="rounded-xl border border-dashed border-slate-300 px-3 py-8 text-center text-sm text-slate-500">{empty}</p>
  );
}

function StatTile({ label, value, hint, icon: Icon }: { label: string; value: string; hint?: string; icon: typeof BookOpen }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        <Icon className="size-3.5 text-indigo-500" />
        {label}
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

const SUBJECT_TONES = [
  { tile: 'bg-indigo-50 hover:border-indigo-300', icon: 'bg-indigo-500', text: 'text-indigo-700' },
  { tile: 'bg-sky-50 hover:border-sky-300', icon: 'bg-sky-500', text: 'text-sky-700' },
  { tile: 'bg-emerald-50 hover:border-emerald-300', icon: 'bg-emerald-500', text: 'text-emerald-700' },
  { tile: 'bg-amber-50 hover:border-amber-300', icon: 'bg-amber-500', text: 'text-amber-700' },
  { tile: 'bg-rose-50 hover:border-rose-300', icon: 'bg-rose-500', text: 'text-rose-700' },
  { tile: 'bg-violet-50 hover:border-violet-300', icon: 'bg-violet-500', text: 'text-violet-700' },
];

function contentCount(subject: LmsSubject): number {
  return (subject.chapters ?? []).reduce((sum, chapter) => sum + (Number(chapter.total_content) || 0), 0);
}

function SubjectCard({ subject, index, score }: { subject: LmsSubject; index: number; score: number | undefined }) {
  const [imageFailed, setImageFailed] = useState(false);
  const chapters = chapterCount(subject);
  const items = contentCount(subject);
  const href = `/student?subject_id=${subject.subject_id}&standard_id=${subject.standard_id}&view=chapters`;
  const tone = SUBJECT_TONES[index % SUBJECT_TONES.length];
  const showImage = Boolean(subject.display_image) && !imageFailed;

  return (
    <Link
      href={href}
      className={cn(
        'group flex flex-col gap-3 rounded-2xl border border-transparent p-4 transition hover:shadow-md',
        tone.tile
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            'relative flex size-11 items-center justify-center overflow-hidden rounded-xl text-lg font-bold text-white shadow-sm',
            tone.icon
          )}
        >
          {showImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={subject.display_image}
              alt=""
              onError={() => setImageFailed(true)}
              className="absolute inset-0 size-full object-cover"
            />
          ) : (
            subject.subject_name.trim().charAt(0).toUpperCase()
          )}
        </span>
        {score === undefined ? null : (
          <span className={cn('rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold', tone.text)}>{score}%</span>
        )}
      </div>
      <h3 className="line-clamp-2 min-h-10 text-[15px] font-semibold leading-5 text-slate-900">{subject.subject_name}</h3>
      <div className="flex flex-wrap gap-1.5 text-xs text-slate-600">
        <span className="rounded-full bg-white/80 px-2 py-0.5">
          {chapters} {chapters === 1 ? 'chapter' : 'chapters'}
        </span>
        {items > 0 ? <span className="rounded-full bg-white/80 px-2 py-0.5">{items} items</span> : null}
      </div>
      <span className={cn('inline-flex items-center gap-1 text-sm font-medium', tone.text)}>
        Continue
        <ChevronRight className="size-4 transition group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

export default function StudentDashboard() {
  const session = useMemo(() => buildSessionContext(), []);
  const userData = useMemo(() => storedRecord('userData'), []);
  const schoolName = readString(userData.school_name);

  const [profile, setProfile] = useState<Section<LmsDashboard | null>>(loading(null));
  const [subjects, setSubjects] = useState<Section<LmsSubject[]>>(loading([]));
  const [homework, setHomework] = useState<Section<MySubmissionRow[]>>(loading([]));
  const [exams, setExams] = useState<Section<OnlineExamListItem[]>>(loading([]));

  useEffect(() => {
    const controller = new AbortController();
    const failure = (error: unknown, fallback: string) => friendlyError(error, fallback);

    fetchLmsDashboard({ userId: session.userId, userProfile: 'Student' }, controller.signal)
      .then((data) => setProfile({ status: 'ready', data }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setProfile({ status: 'error', data: null, error: failure(error, 'We couldn’t load your profile and marks.') });
        }
      });

    const menuContext = storedRecord('menuContext');
    fetchLmsCourses({
      type: 'API',
      sub_institute_id: Number(session.subInstituteId),
      syear: session.syear,
      user_id: Number(session.userId),
      user_profile_name: 'Student',
      user_profile_id: Number(readString(menuContext.user_profile_id)) || undefined,
      client_id: Number(readString(menuContext.client_id)) || undefined,
    })
      .then((response) => setSubjects({ status: 'ready', data: response.lms_subject }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setSubjects({ status: 'error', data: [], error: failure(error, 'We couldn’t load your subjects.') });
        }
      });

    listMySubmissions()
      .then((rows) => setHomework({ status: 'ready', data: rows }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setHomework({ status: 'error', data: [], error: failure(error, 'We couldn’t load your homework.') });
        }
      });

    listOnlineExams({}, controller.signal)
      .then((rows) => setExams({ status: 'ready', data: rows }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setExams({ status: 'error', data: [], error: failure(error, 'We couldn’t load your exams.') });
        }
      });

    return () => controller.abort();
  }, [session.userId, session.subInstituteId, session.syear]);

  const today = useMemo(() => startOfToday(), []);

  // Homework: a row with a status has been handed in; the rest is pending.
  const homeworkView = useMemo(() => {
    const rows = homework.data.map((row) => ({ row, due: parseDate(row.submissionDate), done: Boolean(row.status) }));
    const pending = rows.filter((entry) => !entry.done);
    pending.sort((a, b) => (a.due?.getTime() ?? Infinity) - (b.due?.getTime() ?? Infinity));
    return { all: rows, pending, submitted: rows.filter((entry) => entry.done) };
  }, [homework.data]);

  // Exams: open ones still to attempt, and the ones already attempted (results link).
  const examView = useMemo(() => {
    const openNow = (exam: OnlineExamListItem) => {
      const close = parseDate(exam.closeDate);
      return exam.activeExam && (!close || close >= today);
    };
    const upcoming = exams.data
      .filter((exam) => exam.attempts < exam.attemptsAllowed && openNow(exam))
      .sort((a, b) => (parseDate(a.closeDate)?.getTime() ?? Infinity) - (parseDate(b.closeDate)?.getTime() ?? Infinity));
    const completed = exams.data.filter((exam) => exam.attempts > 0);
    return { upcoming, completed };
  }, [exams.data, today]);

  const scoreBySubject = useMemo(() => {
    const map = new Map<string, number>();
    for (const subject of profile.data?.currentSubjects ?? []) {
      if (subject.chapters.some((chapter) => chapter.total > 0)) map.set(subject.name.trim().toLowerCase(), subject.percent);
    }
    return map;
  }, [profile.data]);

  const learnable = useMemo(
    () => subjects.data.filter((subject) => chapterCount(subject) > 0),
    [subjects.data]
  );
  const comingSoon = useMemo(
    () => subjects.data.filter((subject) => chapterCount(subject) === 0),
    [subjects.data]
  );
  const totalChapters =subjects.data.reduce((sum, subject) => sum + chapterCount(subject), 0);
  const totalContent = subjects.data.reduce(
    (sum, subject) =>
      sum + (subject.chapters ?? []).reduce((inner, chapter) => inner + (Number(chapter.total_content) || 0), 0),
    0
  );
  const homeworkDonePercent =
    homeworkView.all.length > 0 ? Math.round((homeworkView.submitted.length / homeworkView.all.length) * 100) : null;
  const latestStandard = profile.data?.timeline.at(-1);
  const division = subjects.data.find((subject) => subject.division_name)?.division_name ?? '';
  const standardLabel =
    subjects.data[0]?.standard_name || latestStandard?.standardName || '';

  const ready = (section: Section<unknown>) => section.status === 'ready';
  const count = (section: Section<unknown[]>, value: number) => (ready(section) ? String(value) : '—');

  return (
    <div className="space-y-5">
      {/* Header */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-500">
            <User className="size-7" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              {profile.data?.profile.name || 'Student'}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
              {schoolName ? (
                <span className="inline-flex items-center gap-1.5">
                  <School className="size-3.5" />
                  {schoolName}
                </span>
              ) : null}
              {standardLabel ? (
                <span className="inline-flex items-center gap-1.5">
                  <GraduationCap className="size-3.5" />
                  Std {standardLabel}
                  {division ? ` · Div ${division}` : ''}
                </span>
              ) : null}
              {session.syear ? <span>Academic year {session.syear}</span> : null}
              {profile.data?.profile.enrollmentNo ? <span>Enrollment {profile.data.profile.enrollmentNo}</span> : null}
            </div>
          </div>
        </div>
        {profile.status === 'error' ? (
          <p className="mt-3 text-sm text-rose-600">{profile.error}</p>
        ) : null}
      </section>

      {/* Overview */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
        <StatTile label="Subjects" value={count(subjects, subjects.data.length)} icon={BookOpen} />
        <StatTile label="Chapters" value={count(subjects, totalChapters)} icon={Layers} />
        <StatTile label="Learning content" value={count(subjects, totalContent)} hint="items across chapters" icon={FileText} />
        <StatTile
          label="Pending homework"
          value={count(homework, homeworkView.pending.length)}
          hint={homeworkDonePercent === null ? undefined : `${homeworkDonePercent}% handed in`}
          icon={ClipboardList}
        />
        <StatTile label="Upcoming exams" value={count(exams, examView.upcoming.length)} icon={CalendarClock} />
        <StatTile label="Exams completed" value={count(exams, examView.completed.length)} icon={CheckCircle2} />
      </div>

      {/* My Learning */}
      <SectionShell title="My Learning" icon={BookOpen} action={{ href: '/teach-learn/operations', label: 'Open all subjects' }}>
        {subjects.status !== 'ready' || subjects.data.length === 0 ? (
          <Placeholder section={subjects} empty="No subjects are assigned to your standard yet." />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {learnable.map((subject, index) => (
                <SubjectCard
                  key={`${subject.subject_id}-${subject.standard_id}`}
                  subject={subject}
                  index={index}
                  score={scoreBySubject.get(subject.subject_name.trim().toLowerCase())}
                />
              ))}
            </div>
            {comingSoon.length > 0 ? (
              <details className="px-1">
                <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700">
                  {comingSoon.length} more {comingSoon.length === 1 ? 'subject' : 'subjects'} — chapters not added yet
                </summary>
                <div className="mt-3 flex flex-wrap gap-2">
                  {comingSoon.map((subject) => (
                    <span
                      key={`${subject.subject_id}-${subject.standard_id}`}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600"
                    >
                      {subject.subject_name}
                    </span>
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        )}
      </SectionShell>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* Homework */}
        <SectionShell title="Homework & Assignments" icon={ClipboardList} action={{ href: '/lms/homework/submission', label: 'View all' }}>
          {homework.status !== 'ready' || homeworkView.all.length === 0 ? (
            <Placeholder section={homework} empty="No homework has been assigned to you." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {[...homeworkView.pending, ...homeworkView.submitted].slice(0, 8).map(({ row, due, done }) => {
                const overdue = !done && due !== null && due < today;
                return (
                  <li key={row.id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{row.title || 'Homework'}</p>
                      <p className="text-xs text-slate-500">
                        {row.subjectName || 'General'} · Due {formatDate(due, row.submissionDateFmt)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium',
                        done
                          ? 'bg-emerald-50 text-emerald-700'
                          : overdue
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-amber-50 text-amber-700'
                      )}
                    >
                      {done ? row.status : overdue ? 'Overdue' : 'Pending'}
                    </span>
                    <Link
                      href={`/lms/homework/${row.id}`}
                      className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      {done ? 'View' : 'Submit'}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionShell>

        {/* Exams */}
        <SectionShell title="Exams & Results" icon={Trophy} action={{ href: '/exam/online', label: 'View all' }}>
          {exams.status !== 'ready' || exams.data.length === 0 ? (
            <Placeholder section={exams} empty="No exams are scheduled for you." />
          ) : (
            <div className="space-y-4">
              {examView.upcoming.length > 0 ? (
                <div>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Upcoming</h3>
                  <ul className="divide-y divide-slate-100">
                    {examView.upcoming.slice(0, 5).map((exam) => (
                      <li key={exam.id} className="flex items-center gap-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">{exam.name}</p>
                          <p className="text-xs text-slate-500">
                            {exam.totalMarks} marks · {exam.totalQuestions} questions
                            {exam.closeDate ? ` · closes ${formatDate(parseDate(exam.closeDate), exam.closeDate)}` : ''}
                          </p>
                        </div>
                        <Link
                          href={`/exam/online/${exam.id}`}
                          className="shrink-0 rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700"
                        >
                          {exam.attempts > 0 ? 'Retry' : 'Start'}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {examView.completed.length > 0 ? (
                <div>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Completed</h3>
                  <ul className="divide-y divide-slate-100">
                    {examView.completed.slice(0, 5).map((exam) => (
                      <li key={exam.id} className="flex items-center gap-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">{exam.name}</p>
                          <p className="text-xs text-slate-500">
                            Attempts {exam.attempts}/{exam.attemptsAllowed}
                          </p>
                        </div>
                        <Link
                          href={`/exam/online/${exam.id}/result`}
                          className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Result
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {examView.upcoming.length === 0 && examView.completed.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-300 px-3 py-8 text-center text-sm text-slate-500">
                  No open exams right now.
                </p>
              ) : null}
            </div>
          )}
        </SectionShell>
      </div>

      {/* Learning progress */}
      <SectionShell title="Learning Progress" icon={Trophy}>
        {profile.status !== 'ready' || (profile.data?.currentSubjects.length ?? 0) === 0 ? (
          <Placeholder section={profile} empty="Your marks will appear here once your teachers record them." />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {profile.data!.currentSubjects.map((subject, index) => (
              <div key={`${subject.name}-${index}`} className="rounded-xl border border-slate-200 p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="min-w-0 truncate text-sm font-semibold text-slate-900">{subject.name}</h3>
                  <span className="shrink-0 text-sm font-semibold text-slate-700">{subject.percent}%</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className={cn('h-full rounded-full', barColor(subject.percent))} style={{ width: `${subject.percent}%` }} />
                </div>
                <p className="mt-2 text-xs text-slate-500">{subject.chapters.length} chapters assessed</p>
              </div>
            ))}
          </div>
        )}
      </SectionShell>
    </div>
  );
}
