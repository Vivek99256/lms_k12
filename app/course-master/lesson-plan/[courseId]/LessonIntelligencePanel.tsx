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
      setError(err instanceof Error ? err.message : 'Couldn’t load lesson intelligence.');
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
    <section className="overflow-hidden rounded-[14px] border border-[#E3EAF4] bg-white shadow-[0_8px_18px_rgba(15,23,42,0.06)]">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span className="flex items-center gap-2 text-[15px] font-semibold text-[#0F172A]">
          <Sparkles size={16} className="text-[#4F46E5]" />
          AI Lesson Intelligence
        </span>
        <ChevronDown size={18} className={cn('text-[#64748B] transition-transform', open && 'rotate-180')} />
      </button>

      {open ? (
        <div className="space-y-5 border-t border-[#E3EAF4] px-5 py-5">
          {error ? (
            <div className="flex items-center gap-2 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
              <AlertTriangle size={14} />
              {error}
            </div>
          ) : null}
          {notice ? (
            <div className="flex items-center gap-2 rounded-[10px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700">
              <Check size={14} />
              {notice}
            </div>
          ) : null}

          {loading ? (
            <div className="flex items-center gap-2 text-[13px] text-[#64748B]">
              <Loader2 size={14} className="animate-spin" />
              Loading lesson intelligence...
            </div>
          ) : capacity ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Total periods" value={capacity.grand_totals.total_periods} />
                <Stat label="Teaching minutes" value={capacity.grand_totals.total_teaching_minutes} />
                <Stat label="Required minutes" value={capacity.grand_totals.total_required_minutes} />
                <Stat label="Capacity" value={capacity.grand_totals.status} tone={STATUS_STYLES[capacity.grand_totals.status]} />
              </div>

              {capacity.terms.length > 0 ? (
                <div className="space-y-2">
                  {capacity.terms.map((term, index) => (
                    <div
                      key={term.term_id ?? `${term.term_title ?? 'term'}-${index}`}
                      className={cn(
                        'flex flex-wrap items-center justify-between gap-2 rounded-[10px] border px-3 py-2 text-[13px]',
                        STATUS_STYLES[term.status] ?? 'border-[#E3EAF4] bg-white text-[#0F172A]'
                      )}
                    >
                      <span className="font-medium">{term.term_title ?? 'Term'}</span>
                      <span className="text-[#475569]">
                        {term.term_start} - {term.term_end} - {term.teaching_weeks} weeks - {term.total_teaching_periods} periods
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => generateMacro(plans.length > 0)}
                  disabled={busy === 'macro'}
                  className="rounded-[10px] bg-[#4F46E5] text-white hover:bg-[#4338CA]"
                >
                  {busy === 'macro' ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Wand2 size={14} className="mr-1.5" />}
                  {plans.length > 0 ? 'Regenerate macro plan' : 'Generate macro plan'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void load()}
                  disabled={loading}
                  className="rounded-[10px] border-[#CBD5E1] text-[#475569]"
                >
                  <RefreshCw size={14} className="mr-1.5" />
                  Refresh
                </Button>
              </div>

              {plans.length > 0 ? (
                <div className="space-y-2">
                  {plans.map((plan) => {
                    const isExpanded = expandedPlanId === plan.id;
                    const progress =
                      plan.periods_total > 0 ? Math.round((plan.periods_with_plan / plan.periods_total) * 100) : 0;

                    return (
                      <div key={plan.id} className="overflow-hidden rounded-[10px] border border-[#E3EAF4]">
                        <button
                          type="button"
                          onClick={() => setExpandedPlanId((current) => (current === plan.id ? null : plan.id))}
                          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-[14px] font-medium text-[#0F172A]">{plan.plan_title}</span>
                            <span className="text-[12px] text-[#64748B]">
                              {plan.term_start_date} - {plan.term_end_date} - {plan.periods_with_plan}/{plan.periods_total} periods planned ({progress}%)
                            </span>
                          </span>
                          <ChevronDown size={16} className={cn('shrink-0 text-[#64748B] transition-transform', isExpanded && 'rotate-180')} />
                        </button>

                        {isExpanded ? (
                          <div className="space-y-3 border-t border-[#E3EAF4] bg-[#FBFDFF] px-4 py-3">
                            {plan.macro_plan_json?.chapter_schedule?.length ? (
                              <ul className="space-y-1.5">
                                {plan.macro_plan_json.chapter_schedule.map((chapter, index) => (
                                  <li
                                    key={`${chapter.chapter_id ?? 'none'}-${index}`}
                                    className="flex items-center justify-between gap-3 text-[13px]"
                                  >
                                    <span className="truncate text-[#0F172A]">{chapter.chapter_name}</span>
                                    <span className="shrink-0 text-[#64748B]">
                                      {chapter.allocated_periods} periods - Week {chapter.start_week}-{chapter.end_week}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-[13px] text-[#64748B]">No chapter schedule generated yet.</p>
                            )}

                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                onClick={() => startSchedule(plan.id)}
                                disabled={busy === `meso-${plan.id}`}
                                className="rounded-[8px] bg-[#0EA5E9] text-white hover:bg-[#0284C7]"
                              >
                                {busy === `meso-${plan.id}` ? (
                                  <Loader2 size={13} className="mr-1.5 animate-spin" />
                                ) : (
                                  <CalendarRange size={13} className="mr-1.5" />
                                )}
                                Build schedule
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => generateMicro(plan.id, 10)}
                                disabled={busy === `micro-${plan.id}` || plan.periods_total === 0}
                                className="rounded-[8px] border-[#CBD5E1] text-[#475569]"
                              >
                                {busy === `micro-${plan.id}` ? (
                                  <Loader2 size={13} className="mr-1.5 animate-spin" />
                                ) : (
                                  <Sparkles size={13} className="mr-1.5" />
                                )}
                                Generate AI content
                              </Button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[13px] text-[#64748B]">No term plan yet. Generate a macro plan to get started.</p>
              )}
            </>
          ) : (
            <p className="text-[13px] text-[#64748B]">Couldn’t load capacity data.</p>
          )}
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
    </section>
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
