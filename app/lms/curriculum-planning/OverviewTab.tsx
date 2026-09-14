"use client";

// The yearly syllabus overview: stat tiles, the subject x month grid, the
// monthly detail calendar, upcoming lessons and subject progress.
//
// Moved out of page.tsx verbatim when the screen gained tabs. Nothing inside
// changed - this is the part of the page that was already working.

import { Fragment } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Lesson, Stat, SubjectPlan } from "./types";
import { ProgressLine, calendarDays, getTopicStyle, weekdays } from "./shared";

export function OverviewTab({
  stats,
  subjectPlans,
  monthLabels,
  upcomingLessons,
  isLoading,
  loadError,
  onOpenUpcomingLessons,
  onOpenSubjectProgress,
}: {
  stats: Stat[];
  subjectPlans: SubjectPlan[];
  monthLabels: string[];
  upcomingLessons: Lesson[];
  isLoading: boolean;
  loadError: string | null;
  onOpenUpcomingLessons: () => void;
  onOpenSubjectProgress: () => void;
}) {
  return (
    <>
      <section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg bg-white p-4">
            <div className="text-xs font-medium text-[#77716b]">{stat.label}</div>
            <div className="mt-1 text-3xl font-bold leading-none tracking-[0] text-[#1f1d19]">{stat.value}</div>
            <div className="mt-1 text-xs text-[#9a958e]">{stat.helper}</div>
            <div className="mt-3">
              <ProgressLine value={stat.progress} color={stat.color} />
            </div>
          </div>
        ))}
      </section>

      <section className="mb-5 overflow-hidden rounded-lg border border-[#ddd9d2] bg-white shadow-[0_10px_24px_rgba(23,22,15,0.10)]">
        <div className="overflow-x-auto">
          <div
            className="grid min-w-[1260px]"
            style={{ gridTemplateColumns: `128px repeat(${Math.max(monthLabels.length, 1)}, minmax(94px, 1fr))` }}
          >
            <div className="border-b border-r border-[#e3dfd8] px-4 py-3 text-xs font-semibold text-[#8a847d]">
              Subject
            </div>
            {monthLabels.map((month, index) => (
              <div
                key={`${month}-${index}`}
                className="border-b border-r border-[#e3dfd8] px-3 py-3 text-center text-xs font-semibold text-[#a09a93] last:border-r-0"
              >
                {month}
              </div>
            ))}

            {subjectPlans.length === 0 && (
              <div className="col-span-full px-4 py-6 text-center text-sm text-[#9a958e]">
                {isLoading ? 'Loading curriculum plan...' : loadError || 'No curriculum plan data found for this class yet.'}
              </div>
            )}

            {subjectPlans.map((plan) => (
              <Fragment key={plan.name}>
                <div
                  className="flex min-h-12 items-center gap-3 border-b border-r border-[#e9e5de] px-4 text-sm font-medium last:border-b-0"
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: plan.dotColor }} />
                  {plan.name}
                </div>
                {plan.topics.map((topic, index) => (
                  <div
                    key={`${plan.name}-${monthLabels[index]}-${index}`}
                    className="flex min-h-12 items-center border-b border-r border-[#e9e5de] px-2 last:border-r-0"
                  >
                    <span
                      className="block h-6 w-full truncate rounded-md px-2 text-center text-xs font-medium leading-6"
                      style={getTopicStyle(plan, topic)}
                      title={topic}
                    >
                      {topic}
                    </span>
                  </div>
                ))}
              </Fragment>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-lg border border-[#ddd9d2] bg-white p-4 shadow-[0_8px_18px_rgba(23,22,15,0.08)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold tracking-[0]">Monthly detail</h2>
            <Link href="/lms/monthly-plan" className="inline-flex items-center gap-1 text-sm font-medium text-[#2f7dd9]">
              View full
              <ArrowRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-5 gap-1.5">
            {weekdays.map((day) => (
              <div key={day} className="pb-1 text-center text-xs font-semibold text-[#aaa49c]">
                {day}
              </div>
            ))}
            {calendarDays.map((day) => (
              <button
                key={day}
                type="button"
                className={`h-8 rounded-md text-xs font-medium transition-colors ${
                  day === 21
                    ? 'border-2 border-[#2f7dd9] bg-[#dcecff] text-[#0f4c8a]'
                    : 'border border-transparent bg-[#dcecff] text-[#0f4c8a] hover:border-[#9ac3ef]'
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-[#ddd9d2] bg-white p-4 shadow-[0_8px_18px_rgba(23,22,15,0.08)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold tracking-[0]">Upcoming lessons</h2>
            <button
              type="button"
              onClick={onOpenUpcomingLessons}
              className="inline-flex items-center gap-1 text-sm font-medium text-[#2f7dd9]"
            >
              See all
              <ArrowRight size={14} />
            </button>
          </div>

          <div className="space-y-2">
            {upcomingLessons.length === 0 && (
              <div className="rounded-lg bg-[#efeeec] px-3 py-4 text-center text-xs text-[#9a958e]">
                {isLoading ? 'Loading...' : 'No upcoming lessons.'}
              </div>
            )}
            {upcomingLessons.map((lesson) => (
              <div key={`${lesson.subject}-${lesson.title}`} className="flex min-h-14 items-start gap-3 rounded-lg bg-[#efeeec] px-3 py-3">
                <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: lesson.dotColor }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-[#2d2924]">{lesson.title}</div>
                  <div className="mt-0.5 truncate text-xs text-[#7d766f]">{lesson.meta}</div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${lesson.badgeClassName}`}>
                  {lesson.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-[#ddd9d2] bg-white p-4 shadow-[0_8px_18px_rgba(23,22,15,0.08)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold tracking-[0]">Subject progress</h2>
            <button
              type="button"
              onClick={onOpenSubjectProgress}
              className="inline-flex items-center gap-1 text-sm font-medium text-[#2f7dd9]"
            >
              Details
              <ArrowRight size={14} />
            </button>
          </div>

          <div className="space-y-3">
            {subjectPlans.map((plan) => (
              <div key={`${plan.name}-progress`}>
                <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: plan.dotColor }} />
                    <span className="truncate font-medium">{plan.displayName}</span>
                  </div>
                  <span className="shrink-0 text-xs text-[#706b64]">{plan.progress}%</span>
                </div>
                <ProgressLine value={plan.progress} color={plan.dotColor} />
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
