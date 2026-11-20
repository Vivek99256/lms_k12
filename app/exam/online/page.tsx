'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  ClipboardList,
  Loader2,
  PlayCircle,
  Search,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { listOnlineExams, type OnlineExamListItem } from '@/app/exam/data/onlineExam';

function formatDate(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '—';
  // Backend sends "YYYY-MM-DD HH:mm:ss"; show just the date portion.
  return trimmed.slice(0, 10);
}

type ExamStatus = 'open' | 'upcoming' | 'closed' | 'completed';

const STATUS_BADGE: Record<ExamStatus, { label: string; className: string }> = {
  open: { label: 'Open', className: 'bg-emerald-50 text-emerald-700' },
  upcoming: { label: 'Upcoming', className: 'bg-sky-50 text-sky-700' },
  closed: { label: 'Closed', className: 'bg-slate-100 text-slate-500' },
  completed: { label: 'Completed', className: 'bg-indigo-50 text-indigo-700' },
};

/** Where an exam stands for this student: attempts used up beats the dates, then the window decides. */
function examStatus(exam: OnlineExamListItem): ExamStatus {
  if (exam.attempts >= exam.attemptsAllowed) return 'completed';
  if (exam.activeExam) return 'open';
  const today = new Date().toISOString().slice(0, 10);
  return exam.openDate.trim().slice(0, 10) > today ? 'upcoming' : 'closed';
}

function examTypeLabel(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return 'Exam';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

export default function OnlineExamListPage() {
  const router = useRouter();

  const [exams, setExams] = useState<OnlineExamListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [subject, setSubject] = useState('all');

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    listOnlineExams({}, controller.signal)
      .then((items) => {
        if (cancelled) return;
        setExams(items);
        setLoading(false);
      })
      .catch((reason: unknown) => {
        if (cancelled || controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "Couldn't load exams. Try again.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  // One entry per subject the student's own papers belong to; the dropdown narrows the list to that subject only.
  const subjects = useMemo(() => {
    const byId = new Map<string, string>();
    for (const exam of exams) {
      if (exam.subjectId && !byId.has(exam.subjectId)) byId.set(exam.subjectId, exam.subjectName || `Subject ${exam.subjectId}`);
    }
    return Array.from(byId, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [exams]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return exams.filter(
      (exam) =>
        (subject === 'all' || exam.subjectId === subject) && (!needle || exam.name.toLowerCase().includes(needle))
    );
  }, [exams, query, subject]);

  return (
    <div className="min-h-full px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-[1400px] space-y-5">
        {/* Header */}
        <header className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <ClipboardList className="size-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              Online Exams
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Attempt an exam or review your results and DOK/Bloom breakdown.
            </p>
          </div>
        </header>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search exams by name…"
            className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        {subjects.length > 1 ? (
          <select
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            aria-label="Filter by subject"
            className="h-10 min-w-[180px] rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="all">All subjects</option>
            {subjects.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        ) : null}
        </div>

        {/* Error */}
        {error ? (
          <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {/* States */}
        {loading ? (
          <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-16 text-sm text-slate-500 shadow-sm">
            <Loader2 className="mr-2 size-4 animate-spin" />
            Loading exams…
          </div>
        ) : !error && filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-16 text-center text-sm text-slate-500 shadow-sm">
            <ClipboardList className="mx-auto size-8 text-slate-300" />
            <p className="mt-3">
              {exams.length === 0
                ? 'No online exams are available yet.'
                : 'No exams match your search.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((exam) => {
              const status = examStatus(exam);
              const badge = STATUS_BADGE[status];
              const canAttempt = status === 'open';
              return (
              <article
                key={exam.id}
                className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="min-w-0 text-base font-semibold text-slate-900">{exam.name}</h2>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badge.className}`}>
                    {badge.label}
                  </span>
                </div>

                {exam.subjectName ? <p className="mt-1 text-xs font-medium text-slate-500">{exam.subjectName}</p> : null}

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700">
                    {examTypeLabel(exam.examType)}
                  </span>
                  <span className="text-xs text-slate-500">
                    {exam.totalQuestions} questions · {exam.totalMarks} marks · Attempts {Math.min(exam.attempts, exam.attemptsAllowed)}/{exam.attemptsAllowed}
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                  <CalendarClock className="size-3.5 shrink-0" />
                  <span>
                    {formatDate(exam.openDate)} → {formatDate(exam.closeDate)}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    onClick={() => router.push(`/exam/online/${exam.id}`)}
                    disabled={!canAttempt}
                    title={
                      status === 'completed'
                        ? 'You have used all attempts'
                        : status === 'upcoming'
                          ? `This exam opens on ${formatDate(exam.openDate)}`
                          : status === 'closed'
                            ? 'This exam is closed'
                            : undefined
                    }
                    className="bg-[#4f46e5] text-white hover:bg-[#4338ca]"
                  >
                    <PlayCircle className="size-4" />
                    Attempt
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => router.push(`/exam/online/${exam.id}/result`)}
                    disabled={exam.attempts < 1}
                    title={exam.attempts < 1 ? 'Attempt the exam to see your result' : undefined}
                  >
                    <BarChart3 className="size-4" />
                    Results
                  </Button>
                </div>
              </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
