'use client';

import React from 'react';
import { BookOpen, CheckCircle2, Clock, Layers, Sparkles, User, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The generated lesson, as written by the micro planner (Phase 3).
 *
 * Everything here is optional on purpose: a period exists from the moment the
 * schedule is built, but stays empty until a lesson has actually been generated
 * for it, and a partial LLM response must render what it has rather than crash.
 */
export type LessonPlanContent = {
  engage?: { duration_min?: number; description?: string };
  explore?: { duration_min?: number; activity_description?: string };
  explain?: { duration_min?: number; strategy?: string };
  elaborate?: { duration_min?: number; real_world_application?: string };
  evaluate?: { duration_min?: number; quick_assessment?: string };
  differentiation?: { remedial_strategy?: string; enrichment_activity?: string };
  formative_assessment?: {
    question?: string;
    options?: string[];
    correct_answer?: string;
  }[];
  homework?: string;
};

export type LessonPlanDetail = {
  slotLabel: string;
  date: Date;
  chapterTitle: string;
  conceptTitle: string;
  teacherName: string;
  periodType?: string;
  plannedDurationMin?: number;
  bloomsLevel?: string | null;
  dokLevel?: number | null;
  pedagogyMethod?: string | null;
  difficultyLevel?: string | null;
  learningObjectives?: string[];
  planJson?: LessonPlanContent | null;
};

/** The 5E phases, in teaching order, each pulling its text from a different key. */
const PHASES: {
  key: keyof LessonPlanContent;
  label: string;
  field: string;
}[] = [
  { key: 'engage', label: 'Engage (Hook)', field: 'description' },
  { key: 'explore', label: 'Explore', field: 'activity_description' },
  { key: 'explain', label: 'Explain (Core)', field: 'strategy' },
  { key: 'elaborate', label: 'Elaborate', field: 'real_world_application' },
  { key: 'evaluate', label: 'Evaluate', field: 'quick_assessment' },
];

export function LessonPlanDetailDialog({
  lesson,
  onClose,
}: {
  lesson: LessonPlanDetail | null;
  onClose: () => void;
}) {
  if (!lesson) return null;

  const plan = lesson.planJson ?? null;
  const phases = PHASES.map((phase) => {
    const block = plan?.[phase.key] as Record<string, unknown> | undefined;

    return {
      ...phase,
      duration: typeof block?.duration_min === 'number' ? block.duration_min : null,
      body: typeof block?.[phase.field] === 'string' ? (block[phase.field] as string) : '',
    };
  }).filter((phase) => phase.body);

  const mcqs = (plan?.formative_assessment ?? []).filter((item) => item?.question);
  const hasPlan = phases.length > 0 || mcqs.length > 0 || Boolean(plan?.differentiation);

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-[rgba(15,23,42,0.20)] px-4 py-8 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-[880px] flex-col overflow-hidden rounded-[18px] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.20)]"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[#E3EAF4] px-6 py-5">
          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className="rounded-[6px] bg-[#EEF2FF] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#4F46E5]">
                {lesson.slotLabel}
              </span>
              <span className="text-[13px] font-medium text-[#64748B]">
                {lesson.date.toLocaleDateString('en-GB', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
              {lesson.plannedDurationMin ? (
                <span className="inline-flex items-center gap-1 text-[13px] text-[#64748B]">
                  <Clock size={13} />
                  {lesson.plannedDurationMin} min
                </span>
              ) : null}
            </div>

            <h2 className="truncate text-[22px] font-semibold tracking-tight text-[#0F172A]">
              {lesson.chapterTitle || 'Buffer period'}
            </h2>

            {lesson.conceptTitle ? (
              <p className="mt-1 flex items-center gap-1.5 text-[14px] font-medium text-[#64748B]">
                <Layers size={14} />
                {lesson.conceptTitle}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close lesson plan"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#64748B] transition hover:bg-[#F8FAFC] hover:text-[#0F172A]"
          >
            <X size={17} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {!hasPlan ? (
            <div className="rounded-[12px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-5 py-8 text-center">
              <Sparkles size={22} className="mx-auto mb-2 text-[#94A3B8]" />
              <p className="text-[15px] font-medium text-[#0F172A]">No lesson written yet</p>
              <p className="mx-auto mt-1 max-w-[420px] text-[14px] text-[#64748B]">
                This period is scheduled but has no teaching plan. Use{' '}
                <span className="font-medium text-[#475569]">Write lessons (AI)</span> in the
                auto-generate panel to fill it in.
              </p>
            </div>
          ) : null}

          {phases.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {phases.map((phase) => (
                <section
                  key={phase.key}
                  className="rounded-[12px] border border-[#E3EAF4] bg-[#FBFDFF] p-4"
                >
                  <h3 className="mb-2 flex items-center justify-between gap-2 text-[13px] font-bold text-[#4F46E5]">
                    {phase.label}
                    {phase.duration !== null ? (
                      <span className="rounded-full bg-[#EEF2FF] px-2 py-0.5 text-[11px] font-semibold">
                        {phase.duration} min
                      </span>
                    ) : null}
                  </h3>
                  <p className="text-[14px] leading-relaxed text-[#334155]">{phase.body}</p>
                </section>
              ))}
            </div>
          ) : null}

          {plan?.differentiation || mcqs.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {plan?.differentiation ? (
                <section className="rounded-[12px] border border-[#A7F3D0] bg-[#F0FDF4] p-4">
                  <h3 className="mb-3 flex items-center gap-2 text-[13px] font-bold text-[#047857]">
                    <User size={14} />
                    Differentiated learning
                  </h3>
                  <div className="space-y-2.5">
                    {plan.differentiation.remedial_strategy ? (
                      <div className="rounded-[10px] border border-[#A7F3D0] bg-white/70 p-3">
                        <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#047857]">
                          Remedial strategy
                        </span>
                        <p className="text-[14px] text-[#334155]">
                          {plan.differentiation.remedial_strategy}
                        </p>
                      </div>
                    ) : null}
                    {plan.differentiation.enrichment_activity ? (
                      <div className="rounded-[10px] border border-[#A7F3D0] bg-white/70 p-3">
                        <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#047857]">
                          Enrichment activity
                        </span>
                        <p className="text-[14px] text-[#334155]">
                          {plan.differentiation.enrichment_activity}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </section>
              ) : null}

              {mcqs.length ? (
                <section className="rounded-[12px] border border-[#FDE68A] bg-[#FFFBEB] p-4">
                  <h3 className="mb-3 flex items-center gap-2 text-[13px] font-bold text-[#B45309]">
                    <CheckCircle2 size={14} />
                    Formative assessment
                  </h3>
                  <div className="space-y-2.5">
                    {mcqs.map((mcq, index) => (
                      <div
                        key={index}
                        className="rounded-[10px] border border-[#FDE68A] bg-white/70 p-3"
                      >
                        <p className="mb-2 text-[14px] font-semibold text-[#0F172A]">
                          <span className="text-[#B45309]">Q{index + 1}.</span> {mcq.question}
                        </p>
                        <div className="space-y-1 pl-3">
                          {(mcq.options ?? []).map((option, optionIndex) => {
                            const isCorrect = option === mcq.correct_answer;

                            return (
                              <div
                                key={optionIndex}
                                className={cn(
                                  'flex items-center gap-2 text-[13px]',
                                  isCorrect
                                    ? 'font-medium text-[#047857]'
                                    : 'text-[#64748B]'
                                )}
                              >
                                <span
                                  className={cn(
                                    'h-1.5 w-1.5 shrink-0 rounded-full',
                                    isCorrect ? 'bg-[#059669]' : 'bg-[#CBD5E1]'
                                  )}
                                />
                                <span>{option}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          ) : null}

          {plan?.homework ? (
            <section className="rounded-[12px] border border-[#E3EAF4] bg-[#FBFDFF] p-4">
              <h3 className="mb-2 flex items-center gap-2 text-[13px] font-bold text-[#475569]">
                <BookOpen size={14} />
                Homework
              </h3>
              <p className="text-[14px] leading-relaxed text-[#334155]">{plan.homework}</p>
            </section>
          ) : null}

          {lesson.learningObjectives?.length ? (
            <section className="rounded-[12px] border border-[#E3EAF4] bg-[#FBFDFF] p-4">
              <h3 className="mb-2 text-[13px] font-bold text-[#475569]">Learning objectives</h3>
              <ul className="space-y-1.5">
                {lesson.learningObjectives.map((objective, index) => (
                  <li key={index} className="flex gap-2 text-[14px] text-[#334155]">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#94A3B8]" />
                    <span>{objective}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        {/* Footer badges */}
        <div className="flex flex-wrap items-center gap-2 border-t border-[#E3EAF4] px-6 py-4">
          {lesson.bloomsLevel ? <Badge tone="violet">Bloom&apos;s: {lesson.bloomsLevel}</Badge> : null}
          {lesson.dokLevel ? <Badge tone="sky">DOK {lesson.dokLevel}</Badge> : null}
          {lesson.pedagogyMethod ? <Badge tone="indigo">Pedagogy: {lesson.pedagogyMethod}</Badge> : null}
          {lesson.difficultyLevel ? <Badge tone="amber">{lesson.difficultyLevel}</Badge> : null}
          {lesson.periodType ? <Badge tone="slate">{lesson.periodType}</Badge> : null}
          {lesson.teacherName ? (
            <span className="ml-auto inline-flex items-center gap-1.5 text-[13px] text-[#64748B]">
              <User size={13} />
              {lesson.teacherName}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  const tones: Record<string, string> = {
    violet: 'bg-[#F5F3FF] text-[#6D28D9]',
    sky: 'bg-[#F0F9FF] text-[#0369A1]',
    indigo: 'bg-[#EEF2FF] text-[#4338CA]',
    amber: 'bg-[#FFFBEB] text-[#B45309]',
    slate: 'bg-[#F1F5F9] text-[#475569]',
  };

  return (
    <span
      className={cn(
        'rounded-[6px] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider',
        tones[tone] ?? tones.slate
      )}
    >
      {children}
    </span>
  );
}
