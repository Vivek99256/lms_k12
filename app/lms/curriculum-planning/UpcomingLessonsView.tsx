"use client";

// Full-screen "all upcoming lessons" table, moved out of page.tsx unchanged.

import { ArrowRight, ChevronDown, ChevronLeft, Filter, Plus, Search } from "lucide-react";
import type { UpcomingLessonRow } from "./types";
import { filterSubjects, primaryActionClassName, upcomingLessonStatusClassName } from "./shared";

export function AllUpcomingLessonsView({
  lessons,
  gradeLabel,
  onBack,
  onFilter,
  onAddLesson,
}: {
  lessons: UpcomingLessonRow[];
  gradeLabel: string;
  onBack: () => void;
  onFilter: () => void;
  onAddLesson: () => void;
}) {
  return (
    <div className="min-h-full px-4 py-4 text-[#26231f] sm:px-6 lg:px-7">
      <div className="mb-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#d7d3cd] bg-white px-3 text-sm font-medium text-[#706b64] shadow-sm transition-colors hover:bg-[#f1f0ed] hover:text-[#2d2924]"
          >
            <ChevronLeft size={16} />
            Back to yearly view
          </button>
          <span className="text-sm text-[#9a958e]">Yearly view</span>
          <span className="text-sm text-[#9a958e]">&gt;</span>
          <span className="text-sm font-semibold text-[#2d2924]">All upcoming lessons</span>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-[0] text-[#24211d]">All upcoming lessons</h1>
            <p className="mt-1 text-sm text-[#706b64]">
              {gradeLabel} - {lessons.length} lessons remaining
            </p>
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
              onClick={onAddLesson}
              className={`inline-flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-semibold shadow-sm transition-colors ${primaryActionClassName}`}
            >
              <Plus size={16} />
              Add lesson
            </button>
          </div>
        </div>
      </div>

      <div className="mb-4 grid gap-2 lg:grid-cols-[minmax(0,1fr)_140px_120px]">
        <label className="relative block">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9a958e]"
          />
          <input
            type="search"
            placeholder="Search lessons by topic, subject, room..."
            className="h-10 w-full rounded-lg border border-[#d7d3cd] bg-white pl-9 pr-3 text-sm text-[#2b2723] outline-none transition-colors placeholder:text-[#8d8780] focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
          />
        </label>
        <label className="relative block">
          <select
            defaultValue="All subjects"
            className="h-10 w-full appearance-none rounded-lg border border-[#d7d3cd] bg-white px-3 pr-9 text-sm text-[#2b2723] outline-none transition-colors focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
          >
            <option>All subjects</option>
            {filterSubjects.map((subject) => (
              <option key={subject.name}>{subject.name}</option>
            ))}
          </select>
          <ChevronDown
            size={15}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9a958e]"
          />
        </label>
        <label className="relative block">
          <select
            defaultValue="All statuses"
            className="h-10 w-full appearance-none rounded-lg border border-[#d7d3cd] bg-white px-3 pr-9 text-sm text-[#2b2723] outline-none transition-colors focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
          >
            <option>All statuses</option>
            <option>In progress</option>
            <option>Upcoming</option>
            <option>Ready</option>
          </select>
          <ChevronDown
            size={15}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9a958e]"
          />
        </label>
      </div>

      <section className="overflow-hidden rounded-[18px] border border-[#d7d3cd] bg-white shadow-[0_12px_28px_rgba(23,22,15,0.12)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
            <thead className="bg-[#ebe9e6] text-[11px] font-bold text-[#77716b]">
              <tr>
                <th className="px-4 py-4">Date &amp; time</th>
                <th className="px-4 py-4">Subject</th>
                <th className="px-4 py-4">Topic</th>
                <th className="px-4 py-4">Teacher</th>
                <th className="px-4 py-4">Period</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {lessons.map((lesson) => (
                <tr key={`${lesson.date}-${lesson.time}-${lesson.topic}`} className="border-t border-[#e7e3dd]">
                  <td
                    className={`whitespace-nowrap px-4 py-4 text-xs font-medium ${
                      lesson.highlight ? 'font-bold text-[#1f5f9f]' : 'text-[#2d2924]'
                    }`}
                  >
                    {lesson.date} - {lesson.time}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className="inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-xs font-semibold"
                      style={{ backgroundColor: lesson.fill, color: lesson.text }}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: lesson.dotColor }} />
                      {lesson.subject}
                    </span>
                  </td>
                  <td className="min-w-[300px] px-4 py-4 text-sm text-[#2d2924]">{lesson.topic}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-xs font-medium text-[#706b64]">{lesson.room}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-xs font-medium text-[#706b64]">{lesson.period}</td>
                  <td className="whitespace-nowrap px-4 py-4">
                    <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${upcomingLessonStatusClassName[lesson.status]}`}>
                      {lesson.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4">
                    <button type="button" className="text-sm font-medium text-[#706b64] transition-colors hover:text-[#2f7dd9]">
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-5 flex flex-col gap-3 text-xs text-[#706b64] sm:flex-row sm:items-center sm:justify-between">
        <div>Showing {lessons.length} of {lessons.length} upcoming lessons</div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#d7d3cd] bg-white px-3 font-medium text-[#2d2924] transition-colors hover:bg-[#f1f0ed]"
          >
            <ChevronLeft size={14} />
            Prev
          </button>
          {[1, 2, 3].map((page) => (
            <button
              key={page}
              type="button"
              className={`h-8 w-8 rounded-lg border text-sm font-medium transition-colors ${
                page === 1
                  ? 'border-[#2f7dd9] bg-[#dcecff] text-[#0f4c8a]'
                  : 'border-[#d7d3cd] bg-white text-[#2d2924] hover:bg-[#f1f0ed]'
              }`}
            >
              {page}
            </button>
          ))}
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#d7d3cd] bg-white px-3 font-medium text-[#2d2924] transition-colors hover:bg-[#f1f0ed]"
          >
            Next
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
