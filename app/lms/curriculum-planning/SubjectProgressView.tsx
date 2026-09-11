"use client";

// Full-screen per-subject progress breakdown, moved out of page.tsx unchanged.

import { ChevronLeft, Download, Filter } from "lucide-react";
import type { Stat, SubjectProgressDetail } from "./types";
import { ProgressLine, subjectProgressStatusClassName, subjectProgressStatusDot } from "./shared";

export function SubjectProgressDetailsView({
  subjects,
  stats,
  gradeLabel,
  onBack,
  onFilter,
}: {
  subjects: SubjectProgressDetail[];
  stats: Stat[];
  gradeLabel: string;
  onBack: () => void;
  onFilter: () => void;
}) {
  return (
    <div className="min-h-full px-4 py-4 text-[#26231f] sm:px-6 lg:px-7">
      <div className="mb-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#d7d3cd] bg-white px-3 text-xs font-medium text-[#706b64] shadow-sm transition-colors hover:bg-[#f1f0ed] hover:text-[#2d2924]"
          >
            <ChevronLeft size={14} />
            Back to yearly view
          </button>
          <span className="text-xs text-[#9a958e]">Yearly view</span>
          <span className="text-xs text-[#9a958e]">&gt;</span>
          <span className="text-xs font-semibold text-[#2d2924]">Subject progress details</span>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-[0] text-[#24211d]">
              Subject progress - detailed breakdown
            </h1>
            <p className="mt-1 text-sm text-[#706b64]">{gradeLabel} - All subjects</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onFilter}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#d7d3cd] bg-white px-4 text-sm font-medium text-[#332f2a] shadow-sm transition-colors hover:bg-[#f1f0ed]"
            >
              <Filter size={15} />
              Filter
            </button>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#d7d3cd] bg-white px-4 text-sm font-medium text-[#332f2a] shadow-sm transition-colors hover:bg-[#f1f0ed]"
            >
              <Download size={15} />
              Export
            </button>
          </div>
        </div>
      </div>

      <section className="mb-4 grid gap-3 md:grid-cols-3">
        {stats.slice(0, 3).map((stat) => (
          <div key={stat.label} className="rounded-lg bg-white px-4 py-4 text-center">
            <div className="text-3xl font-bold leading-none tracking-[0] text-[#17160f]">{stat.value}</div>
            <div className="mt-2 text-xs font-medium text-[#77716b]">{stat.label}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {subjects.map((subject) => (
          <article
            key={subject.subject}
            className="rounded-lg border border-[#d7d3cd] bg-white p-4 shadow-[0_10px_24px_rgba(23,22,15,0.10)]"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: subject.color }} />
                <h2 className="truncate text-sm font-semibold tracking-[0] text-[#24211d]">{subject.subject}</h2>
              </div>
              <span className="shrink-0 text-xs font-medium text-[#706b64]">{subject.progress}% complete</span>
            </div>

            <ProgressLine value={subject.progress} color={subject.color} />

            <div className="mt-3 space-y-2">
              {subject.topics.map((topic) => (
                <div
                  key={`${subject.subject}-${topic.title}`}
                  className="flex min-h-12 items-center justify-between gap-3 rounded-md bg-[#efeeec] px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: subjectProgressStatusDot[topic.status] }}
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-[#2d2924]">{topic.title}</div>
                      <div className="mt-0.5 truncate text-xs text-[#7d766f]">{topic.range}</div>
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${subjectProgressStatusClassName[topic.status]}`}>
                    {topic.status}
                  </span>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
