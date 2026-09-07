'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarRange,
  Check,
  ChevronDown,
  Loader2,
  RefreshCw,
  Sparkles,
  Users,
  Wand2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Lesson Intelligence - the four-phase generator, folded into the lesson-plan page.
 *
 *   Phase 0  capacity     how much teaching time this term actually has
 *   Phase 1  macro plan   chapters spread across the term's weeks
 *   Phase 2  schedule     concepts placed into dated period slots
 *   Phase 3  AI content   the 5E lesson written for each period
 *
 * Phases 0-2 are pure arithmetic and free to re-run. Phase 3 costs one LLM call
 * per period, so it is always an explicit, bounded action - never automatic.
 */

type CapacityTerm = {
  term_id: number | null;
  term_title: string | null;
  term_start: string;
  term_end: string;
  teaching_weeks: number;
  holidays_in_term: number;
  exam_days_in_term: number;
  total_teaching_periods: number;
  total_teaching_minutes: number;
  required_minutes: number;
  buffer_percent: number;
  status: 'COMFORTABLE' | 'GOOD' | 'TIGHT' | 'OVERLOADED' | string;
};

type CapacityResponse = {
  school_data: {
    teacher_id: number | null;
    periods_per_week: number;
    period_duration_min: number;
    has_saturday: boolean;
    weekly_schedule: Record<string, string[]>;
    syear: number;
    /** Year the timetable was actually read from; differs when the selected year has none. */
    scheduling_syear: number;
  };
  terms: CapacityTerm[];
  grand_totals: {
    total_periods: number;
    total_teaching_minutes: number;
    total_required_minutes: number;
    buffer_percent: number;
    status: string;
  };
  content_breakdown: { total_chapters: number; total_concepts: number; total_concept_minutes: number };
};

type MacroChapter = {
  chapter_id: number | null;
  chapter_name: string;
  allocated_periods: number;
  start_date: string;
  end_date: string;
  start_week: number;
  end_week: number;
};

type LessonPlanRow = {
  id: number;
  term_id: number;
  plan_title: string;
  term_start_date: string;
  term_end_date: string;
  total_periods: number;
  periods_per_week: number;
  period_duration_min: number;
  buffer_percent: string | number;
  holidays_count: number;
  exam_days_count: number;
  macro_plan_json: { chapter_schedule?: MacroChapter[]; summary?: Record<string, number> } | null;
  /** Schedule progress, counted server-side so the client never pulls every period row. */
  periods_total: number;
  periods_with_plan: number;
};

type PlanTeacher = { id: number; name: string };

type Props = {
  baseUrl: string;
  subInstituteId: string;
  standardId: number | null;
  subjectId: number | null;
  divisionId: number | null;
  syear: string | number;
  /** Called after any action that changes the stored schedule. */
  onScheduleChanged?: () => void;
};

const STATUS_STYLES: Record<string, string> = {
  COMFORTABLE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  GOOD: 'bg-blue-50 text-blue-700 border-blue-200',
  TIGHT: 'bg-amber-50 text-amber-700 border-amber-200',
  OVERLOADED: 'bg-red-50 text-red-700 border-red-200',
};

export function LessonIntelligencePanel({
  baseUrl,
  subInstituteId,
  standardId,
  subjectId,
  divisionId,
  syear,
  onScheduleChanged,
}: Props) {
  const [open, setOpen] = useState(false);
  const [capacity, setCapacity] = useState<CapacityResponse | null>(null);
  const [plans, setPlans] = useState<LessonPlanRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [expandedPlanId, setExpandedPlanId] = useState<number | null>(null);

  // Teacher-assignment step, only surfaced when a subject has several teachers.
  const [teacherPrompt, setTeacherPrompt] = useState<{
    planId: number;
    teachers: PlanTeacher[];
    chapters: MacroChapter[];
  } | null>(null);
  const [assignments, setAssignments] = useState<Record<number, number[]>>({});

  const selection = useMemo(
    () => ({
      sub_institute_id: subInstituteId,
      standard_id: standardId,
      subject_id: subjectId,
      division_id: divisionId,
      syear,
    }),
    [subInstituteId, standardId, subjectId, divisionId, syear]
  );

  const ready = Boolean(subInstituteId && standardId && subjectId && syear);
  const root = useMemo(() => `${baseUrl.replace(/\/$/, '')}/api/lesson-intelligence`, [baseUrl]);

  const post = useCallback(
    async (path: string, body: Record<string, unknown>) => {
      const response = await fetch(`${root}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.message || `Request failed (${response.status}).`);
      }

      return payload;
    },
    [root]
  );

  /** Capacity + any stored plans. A 404 on plans just means nothing generated yet. */
  const load = useCallback(async () => {
    if (!ready) return;

    setLoading(true);
    setError('');

    try {
      const [capacityPayload, planPayload] = await Promise.all([
        post('/capacity', selection),
        post('/macro-plan/show', selection).catch(() => null),
      ]);

      setCapacity(capacityPayload?.data ?? null);
      setPlans(planPayload?.plans ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load lesson intelligence.');
    } finally {
      setLoading(false);
    }
  }, [post, ready, selection]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const run = useCallback(
    async (key: string, action: () => Promise<string>) => {
      setBusy(key);
      setError('');
      setNotice('');

      try {
        setNotice(await action());
        await load();
        onScheduleChanged?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.');
      } finally {
        setBusy(null);
      }
    },
    [load, onScheduleChanged]
  );

  const generateMacro = (force: boolean) =>
    run('macro', async () => {
      const result = await post('/macro-plan', { ...selection, force });
      const generated = (result?.plans ?? []).filter((p: { status: string }) => p.status === 'generated').length;
      const skipped = (result?.plans ?? []).length - generated;

      if (generated === 0 && skipped > 0) {
        return `${skipped} term plan(s) already exist. Use Regenerate to rebuild them.`;
      }

      return `Built ${generated} term plan(s) across ${result?.total_chapters ?? 0} chapters.`;
    });

  /** Ask who teaches what only when more than one teacher owns slots. */
  const startSchedule = (planId: number) =>
    run('meso-' + planId, async () => {
      const info = await post(`/meso-plan/${planId}/teachers`, { sub_institute_id: subInstituteId });
      const teachers: PlanTeacher[] = info?.teachers ?? [];

      if (teachers.length > 1) {
        setTeacherPrompt({ planId, teachers, chapters: info?.chapters ?? [] });
        setAssignments(Object.fromEntries(teachers.map((t) => [t.id, []])));

        return 'Assign chapters to teachers, then generate the schedule.';
      }

      const result = await post(`/meso-plan/${planId}`, { sub_institute_id: subInstituteId });

      return `Scheduled ${result?.periods_created ?? 0} periods with ${result?.concept_mappings_created ?? 0} concept links.`;
    });

  const confirmSchedule = (planId: number, teacherAssignments: Record<number, number[]> | null) =>
    run('meso-' + planId, async () => {
      const result = await post(`/meso-plan/${planId}`, {
        sub_institute_id: subInstituteId,
        teacher_assignments: teacherAssignments ?? undefined,
      });
      setTeacherPrompt(null);

      return `Scheduled ${result?.periods_created ?? 0} periods with ${result?.concept_mappings_created ?? 0} concept links.`;
    });

  const generateMicro = (planId: number, limit: number) =>
    run('micro-' + planId, async () => {
      const result = await post(`/micro-plan/plan/${planId}/batch`, { sub_institute_id: subInstituteId, limit });

      if ((result?.processed ?? 0) === 0) {
        return result?.message || 'Every period already has a lesson plan.';
      }

      const failed = (result?.processed ?? 0) - (result?.succeeded ?? 0);

      return failed > 0
        ? `Wrote ${result.succeeded} lesson plan(s); ${failed} failed - see the log.`
        : `Wrote ${result.succeeded} lesson plan(s).`;
    });

  if (!ready) return null;

  return (
    <div className="mb-6 overflow-hidden rounded-[18px] border border-[#D8E1F0] bg-white shadow-[0_2px_10px_rgba(15,23,42,0.05)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-[#F8FAFC] sm:px-6"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#EEF2FF] text-[#4F46E5]">
            <Sparkles size={18} />
          </span>
          <span>
            <span className="block text-[16px] font-semibold text-[#0F172A]">Auto-generate lesson plan</span>
            <span className="block text-[13px] text-[#64748B]">
              Build the whole term from the timetable, syllabus and holidays
            </span>
          </span>
        </span>
        <ChevronDown size={18} className={cn('shrink-0 text-[#64748B] transition', open && 'rotate-180')} />
      </button>

      {open ? (
        <div className="border-t border-[#E3EAF4] px-4 py-5 sm:px-6">
          {error ? (
            <div role="alert" className="mb-4 flex items-start gap-2 rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-[14px] text-[#B91C1C]">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          {notice ? (
            <div className="mb-4 flex items-start gap-2 rounded-[10px] border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-3 text-[14px] text-[#15803D]">
              <Check size={16} className="mt-0.5 shrink-0" />
              <span>{notice}</span>
            </div>
          ) : null}

          {loading && !capacity ? (
            <p className="flex items-center gap-2 py-6 text-[14px] text-[#64748B]">
              <Loader2 size={16} className="animate-spin" />
              Reading the timetable, syllabus and school calendar...
            </p>
          ) : null}

          {capacity ? (
            <>
              <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="Periods a week" value={capacity.school_data.periods_per_week} sub={`${capacity.school_data.period_duration_min} min each`} />
                <Stat label="Chapters" value={capacity.content_breakdown.total_chapters} sub={`${capacity.content_breakdown.total_concepts} concepts`} />
                <Stat label="Teaching time" value={`${Math.round(capacity.grand_totals.total_teaching_minutes / 60)} h`} sub={`syllabus needs ${Math.round(capacity.grand_totals.total_required_minutes / 60)} h`} />
                <Stat
                  label="Spare capacity"
                  value={`${capacity.grand_totals.buffer_percent}%`}
                  sub={capacity.grand_totals.status.toLowerCase()}
                  tone={STATUS_STYLES[capacity.grand_totals.status]}
                />
              </div>

              {capacity.school_data.periods_per_week === 0 ? (
                <p className="mb-4 rounded-[10px] border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-[14px] text-[#92400E]">
                  This class and subject has no timetable in any academic year, so there are no periods to
                  schedule into. Enter the class timetable first, then generate.
                </p>
              ) : capacity.school_data.scheduling_syear !== Number(capacity.school_data.syear) ? (
                <p className="mb-4 rounded-[10px] border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3 text-[14px] text-[#1D4ED8]">
                  No timetable exists for {String(capacity.school_data.syear)}, so the plan is built from the{' '}
                  {capacity.school_data.scheduling_syear} timetable and term dates. Enter a timetable for{' '}
                  {String(capacity.school_data.syear)} to plan against that year instead.
                </p>
              ) : null}

              {capacity.content_breakdown.total_chapters === 0 ? (
                <p className="mb-4 rounded-[10px] border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-[14px] text-[#92400E]">
                  No syllabus content is linked to this subject yet, so a plan cannot be built. Extract the
                  chapters and concepts first.
                </p>
              ) : null}

              <div className="mb-5 overflow-x-auto">
                <table className="w-full min-w-[640px] text-[14px]">
                  <thead>
                    <tr className="border-b border-[#E3EAF4] text-left text-[12px] font-semibold uppercase tracking-wide text-[#64748B]">
                      <th className="py-2 pr-3">Term</th>
                      <th className="py-2 pr-3">Dates</th>
                      <th className="py-2 pr-3 text-right">Weeks</th>
                      <th className="py-2 pr-3 text-right">Periods</th>
                      <th className="py-2 pr-3 text-right">Holidays</th>
                      <th className="py-2 pr-3 text-right">Spare</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {capacity.terms.map((term) => (
                      <tr key={String(term.term_id)} className="border-b border-[#F1F5F9] text-[#334155]">
                        <td className="py-2.5 pr-3 font-medium text-[#0F172A]">{term.term_title || `Term ${term.term_id}`}</td>
                        <td className="py-2.5 pr-3 text-[#64748B]">{term.term_start} - {term.term_end}</td>
                        <td className="py-2.5 pr-3 text-right">{term.teaching_weeks}</td>
                        <td className="py-2.5 pr-3 text-right">{term.total_teaching_periods}</td>
                        <td className="py-2.5 pr-3 text-right">{term.holidays_in_term}</td>
                        <td className="py-2.5 pr-3 text-right">{term.buffer_percent}%</td>
                        <td className="py-2.5">
                          <span className={cn('rounded-full border px-2 py-0.5 text-[12px] font-medium', STATUS_STYLES[term.status] ?? 'border-slate-200 bg-slate-50 text-slate-600')}>
                            {term.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          <div className="mb-5 flex flex-wrap gap-3">
            <Button
              onClick={() => generateMacro(false)}
              disabled={
                busy !== null
                || capacity?.content_breakdown.total_chapters === 0
                || capacity?.school_data.periods_per_week === 0
              }
              className="h-10 rounded-[12px] bg-[#4F46E5] px-4 text-[14px] font-medium text-white hover:bg-[#4338CA] disabled:bg-[#A5B4FC]"
            >
              {busy === 'macro' ? <Loader2 size={15} className="mr-2 animate-spin" /> : <CalendarRange size={15} className="mr-2" />}
              {plans.length ? 'Rebuild term plans' : 'Build term plans'}
            </Button>

            {plans.length ? (
              <Button
                variant="outline"
                onClick={() => generateMacro(true)}
                disabled={busy !== null}
                className="h-10 rounded-[12px] border-[#CBD5E1] px-4 text-[14px] font-medium text-[#475569]"
              >
                <RefreshCw size={15} className="mr-2" />
                Regenerate (overwrite)
              </Button>
            ) : null}

            <Button
              variant="ghost"
              onClick={() => void load()}
              disabled={busy !== null || loading}
              className="h-10 rounded-[12px] px-3 text-[14px] font-medium text-[#475569]"
            >
              <RefreshCw size={15} className={cn('mr-2', loading && 'animate-spin')} />
              Refresh
            </Button>
          </div>

          {plans.map((plan) => {
            const scheduled = plan.periods_total ?? 0;
            const written = plan.periods_with_plan ?? 0;
            const chapters = plan.macro_plan_json?.chapter_schedule ?? [];
            const expanded = expandedPlanId === plan.id;

            return (
              <div key={plan.id} className="mb-3 rounded-[14px] border border-[#E3EAF4] bg-[#FBFDFF] p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-[15px] font-semibold text-[#0F172A]">{plan.plan_title}</p>
                    <p className="mt-0.5 text-[13px] text-[#64748B]">
                      {plan.term_start_date} - {plan.term_end_date} &middot; {plan.total_periods} periods &middot;{' '}
                      {chapters.length} chapters
                      {scheduled > 0 ? ` · ${written}/${scheduled} lessons written` : ' · not scheduled yet'}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => startSchedule(plan.id)}
                      disabled={busy !== null}
                      className="h-9 rounded-[10px] border-[#CBD5E1] px-3 text-[13px] font-medium text-[#475569]"
                    >
                      {busy === `meso-${plan.id}` ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Users size={14} className="mr-2" />}
                      {scheduled > 0 ? 'Reschedule periods' : 'Schedule periods'}
                    </Button>

                    <Button
                      onClick={() => generateMicro(plan.id, 10)}
                      disabled={busy !== null || scheduled === 0}
                      title={scheduled === 0 ? 'Schedule the periods first' : 'Writes up to 10 lesson plans - uses AI credit'}
                      className="h-9 rounded-[10px] bg-[#0F172A] px-3 text-[13px] font-medium text-white hover:bg-[#1E293B] disabled:bg-[#CBD5E1]"
                    >
                      {busy === `micro-${plan.id}` ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Wand2 size={14} className="mr-2" />}
                      Write 10 lessons (AI)
                    </Button>

                    {chapters.length ? (
                      <Button
                        variant="ghost"
                        onClick={() => setExpandedPlanId(expanded ? null : plan.id)}
                        className="h-9 rounded-[10px] px-3 text-[13px] font-medium text-[#475569]"
                      >
                        <ChevronDown size={14} className={cn('mr-1.5 transition', expanded && 'rotate-180')} />
                        Chapters
                      </Button>
                    ) : null}
                  </div>
                </div>

                {expanded ? (
                  <div className="mt-4 overflow-x-auto border-t border-[#E3EAF4] pt-3">
                    <table className="w-full min-w-[560px] text-[13px]">
                      <thead>
                        <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
                          <th className="py-1.5 pr-3">Chapter</th>
                          <th className="py-1.5 pr-3 text-right">Periods</th>
                          <th className="py-1.5 pr-3">Dates</th>
                          <th className="py-1.5">Weeks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {chapters.map((chapter, index) => (
                          <tr key={`${chapter.chapter_id ?? 'buffer'}-${index}`} className="border-t border-[#F1F5F9] text-[#334155]">
                            <td className="py-2 pr-3">{chapter.chapter_name}</td>
                            <td className="py-2 pr-3 text-right">{chapter.allocated_periods}</td>
                            <td className="py-2 pr-3 text-[#64748B]">{chapter.start_date} - {chapter.end_date}</td>
                            <td className="py-2 text-[#64748B]">{chapter.start_week}-{chapter.end_week}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            );
          })}

          {!loading && !plans.length && capacity ? (
            <p className="text-[14px] text-[#64748B]">
              No term plans yet. Build them to lay the chapters out across the term, then schedule the periods.
            </p>
          ) : null}
        </div>
      ) : null}

      {teacherPrompt ? (
        <TeacherAssignmentDialog
          teachers={teacherPrompt.teachers}
          chapters={teacherPrompt.chapters}
          assignments={assignments}
          setAssignments={setAssignments}
          busy={busy === `meso-${teacherPrompt.planId}`}
          onCancel={() => setTeacherPrompt(null)}
          onAuto={() => confirmSchedule(teacherPrompt.planId, null)}
          onConfirm={() => confirmSchedule(teacherPrompt.planId, assignments)}
        />
      ) : null}
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: string; tone?: string }) {
  return (
    <div className={cn('rounded-[12px] border border-[#E3EAF4] bg-[#FBFDFF] px-4 py-3', tone)}>
      <p className="text-[12px] font-semibold uppercase tracking-wide text-[#64748B]">{label}</p>
      <p className="mt-1 text-[22px] font-semibold leading-none text-[#0F172A]">{value}</p>
      {sub ? <p className="mt-1 text-[12px] text-[#64748B]">{sub}</p> : null}
    </div>
  );
}

/**
 * Which teacher takes which chapter. Anything left unassigned is balanced
 * automatically by the scheduler, so partial answers are fine.
 */
function TeacherAssignmentDialog({
  teachers,
  chapters,
  assignments,
  setAssignments,
  busy,
  onCancel,
  onAuto,
  onConfirm,
}: {
  teachers: PlanTeacher[];
  chapters: MacroChapter[];
  assignments: Record<number, number[]>;
  setAssignments: React.Dispatch<React.SetStateAction<Record<number, number[]>>>;
  busy: boolean;
  onCancel: () => void;
  onAuto: () => void;
  onConfirm: () => void;
}) {
  const ownerOf = (chapterId: number | null) =>
    teachers.find((t) => (assignments[t.id] ?? []).includes(chapterId as number))?.id ?? '';

  const assign = (chapterId: number | null, teacherId: number | '') => {
    if (chapterId === null) return;

    setAssignments((current) => {
      const next: Record<number, number[]> = {};
      for (const teacher of teachers) {
        next[teacher.id] = (current[teacher.id] ?? []).filter((id) => id !== chapterId);
      }
      if (teacherId !== '') {
        next[teacherId] = [...(next[teacherId] ?? []), chapterId];
      }

      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-[rgba(15,23,42,0.18)] px-4 py-8 backdrop-blur-[2px]">
      <div className="relative w-full max-w-[620px] overflow-hidden rounded-[18px] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#E3EAF4] px-6 py-5">
          <div>
            <h2 className="text-[20px] font-semibold tracking-tight text-[#0F172A]">Assign chapters to teachers</h2>
            <p className="mt-1 text-[14px] text-[#64748B]">
              {teachers.length} teachers share this subject. Anything you leave unassigned is balanced automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#64748B] transition hover:bg-[#F8FAFC] hover:text-[#0F172A] disabled:opacity-50"
          >
            <X size={17} />
          </button>
        </div>

        <div className="max-h-[52vh] overflow-y-auto px-6 py-4">
          {chapters
            .filter((chapter) => chapter.chapter_id !== null && chapter.chapter_id >= 0)
            .map((chapter) => (
              <div key={chapter.chapter_id} className="flex items-center justify-between gap-4 border-b border-[#F1F5F9] py-2.5 last:border-0">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium text-[#0F172A]">{chapter.chapter_name}</p>
                  <p className="text-[12px] text-[#64748B]">{chapter.allocated_periods} periods</p>
                </div>
                <select
                  value={ownerOf(chapter.chapter_id)}
                  onChange={(event) => assign(chapter.chapter_id, event.target.value === '' ? '' : Number(event.target.value))}
                  disabled={busy}
                  className="h-9 shrink-0 rounded-[10px] border border-[#CBD5E1] bg-white px-3 text-[13px] text-[#0F172A] disabled:opacity-50"
                >
                  <option value="">Auto</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-[#E3EAF4] px-6 py-4 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onCancel} disabled={busy} className="h-10 rounded-[12px] px-4 text-[14px] text-[#475569]">
            Cancel
          </Button>
          <Button variant="outline" onClick={onAuto} disabled={busy} className="h-10 rounded-[12px] border-[#CBD5E1] px-4 text-[14px] text-[#475569]">
            Split automatically
          </Button>
          <Button onClick={onConfirm} disabled={busy} className="h-10 rounded-[12px] bg-[#4F46E5] px-5 text-[14px] font-medium text-white hover:bg-[#4338CA]">
            {busy ? <Loader2 size={15} className="mr-2 animate-spin" /> : <Check size={15} className="mr-2" />}
            Save &amp; generate
          </Button>
        </div>
      </div>
    </div>
  );
}
