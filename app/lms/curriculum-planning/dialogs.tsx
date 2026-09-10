"use client";

// The three syllabus dialogs, moved out of page.tsx unchanged. They are still
// static mock forms: every onSubmit closes the dialog and writes nothing.

import { X } from "lucide-react";
import {
  addTopicMonths,
  editColourLabels,
  editMonths,
  filterGrades,
  filterMonthOptions,
  filterStatuses,
  filterSubjects,
  primaryActionClassName,
  quickTags,
} from "./shared";

export function FilterCheckCard({
  children,
  checked = true,
}: {
  children: React.ReactNode;
  checked?: boolean;
}) {
  return (
    <label
      className={`flex h-9 cursor-pointer items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-colors ${
        checked
          ? 'border-[#4e9eff] bg-[#e3f0ff] text-[#2d3748]'
          : 'border-[#d7d3cd] bg-white text-[#2d2924]'
      }`}
    >
      <input
        type="checkbox"
        defaultChecked={checked}
        className="h-3.5 w-3.5 rounded border-[#c9c4bd] accent-[#2f7dd9]"
      />
      {children}
    </label>
  );
}

export function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#77716b]">{title}</h3>
      {children}
    </section>
  );
}

export function AddTopicDialog({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/35 px-4 py-6 backdrop-blur-[3px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-topic-title"
      onMouseDown={onClose}
    >
      <form
        className="max-h-[calc(100vh-48px)] w-full max-w-[586px] overflow-y-auto rounded-[18px] bg-white px-8 py-8 shadow-[0_24px_70px_rgba(23,22,15,0.28)]"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          onClose();
        }}
      >
        <div className="mb-7 flex items-start justify-between gap-4">
          <h2 id="add-topic-title" className="text-xl font-semibold tracking-[0] text-[#24211d]">
            Add new topic
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#d7d3cd] bg-[#f1f0ed] text-[#6f6a63] transition-colors hover:bg-[#e7e5e1] hover:text-[#27231f]"
            aria-label="Close add topic dialog"
          >
            <X size={22} />
          </button>
        </div>

        <div className="grid gap-x-3 gap-y-5 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#6f6a63]">Subject *</span>
            <select
              defaultValue=""
              className="h-10 w-full rounded-lg border border-[#d7d3cd] bg-white px-3 text-sm text-[#2b2723] outline-none transition-colors focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
            >
              <option value="" disabled>Select subject...</option>
              {filterSubjects.map((subject) => (
                <option key={subject.name}>{subject.name}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#6f6a63]">Grade / Class *</span>
            <select
              defaultValue="Grade 8"
              className="h-10 w-full rounded-lg border border-[#d7d3cd] bg-white px-3 text-sm text-[#2b2723] outline-none transition-colors focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
            >
              <option>Grade 6</option>
              <option>Grade 7</option>
              <option>Grade 8</option>
              <option>Grade 9</option>
              <option>Grade 10</option>
            </select>
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-2 block text-sm font-medium text-[#6f6a63]">Topic name *</span>
            <input
              placeholder="e.g. Quadratic equations"
              className="h-10 w-full rounded-lg border border-[#d7d3cd] bg-white px-3 text-sm text-[#2b2723] outline-none transition-colors placeholder:text-[#88837c] focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#6f6a63]">Start month *</span>
            <select
              defaultValue="July"
              className="h-10 w-full rounded-lg border border-[#d7d3cd] bg-white px-3 text-sm text-[#2b2723] outline-none transition-colors focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
            >
              {addTopicMonths.map((month) => (
                <option key={month}>{month}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#6f6a63]">End month *</span>
            <select
              defaultValue="July"
              className="h-10 w-full rounded-lg border border-[#d7d3cd] bg-white px-3 text-sm text-[#2b2723] outline-none transition-colors focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
            >
              {addTopicMonths.map((month) => (
                <option key={month}>{month}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#6f6a63]">Estimated lessons</span>
            <input
              placeholder="e.g. 8"
              className="h-10 w-full rounded-lg border border-[#d7d3cd] bg-white px-3 text-sm text-[#2b2723] outline-none transition-colors placeholder:text-[#88837c] focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#6f6a63]">Room / Location</span>
            <input
              placeholder="e.g. Room 12"
              className="h-10 w-full rounded-lg border border-[#d7d3cd] bg-white px-3 text-sm text-[#2b2723] outline-none transition-colors placeholder:text-[#88837c] focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-2 block text-sm font-medium text-[#6f6a63]">Learning objectives</span>
            <textarea
              placeholder="Enter key learning objectives for this topic..."
              className="min-h-[90px] w-full resize-y rounded-lg border border-[#d7d3cd] bg-white px-3 py-2.5 text-sm leading-5 text-[#2b2723] outline-none transition-colors placeholder:text-[#88837c] focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-2 block text-sm font-medium text-[#6f6a63]">Resources (optional)</span>
            <input
              placeholder="Paste a link or enter file name..."
              className="h-10 w-full rounded-lg border border-[#d7d3cd] bg-white px-3 text-sm text-[#2b2723] outline-none transition-colors placeholder:text-[#88837c] focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
            />
          </label>
        </div>

        <div className="mt-5">
          <div className="mb-2.5 text-sm font-medium text-[#6f6a63]">Colour label</div>
          <div className="flex gap-3">
            {editColourLabels.map((colour, index) => (
              <button
                key={colour}
                type="button"
                className={`h-7 w-7 rounded-full ${index === 1 ? 'ring-2 ring-[#16150f] ring-offset-2' : ''}`}
                style={{ backgroundColor: colour }}
                aria-label={`Use colour label ${index + 1}`}
              />
            ))}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2 border-t border-[#e7e3dd] pt-5">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-[#d7d3cd] bg-white px-4 text-sm font-semibold text-[#4a453f] transition-colors hover:bg-[#f1f0ed]"
          >
            Cancel
          </button>
          <button
            type="submit"
            className={`h-9 rounded-lg px-4 text-sm font-semibold transition-colors ${primaryActionClassName}`}
          >
            Add topic
          </button>
        </div>
      </form>
    </div>
  );
}

export function FilterSyllabusDialog({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/35 px-4 py-6 backdrop-blur-[3px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="filter-syllabus-title"
      onMouseDown={onClose}
    >
      <form
        className="max-h-[calc(100vh-48px)] w-full max-w-[376px] overflow-y-auto rounded-[14px] bg-white px-6 py-7 shadow-[0_24px_70px_rgba(23,22,15,0.28)]"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          onClose();
        }}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <h2 id="filter-syllabus-title" className="text-lg font-semibold tracking-[0] text-[#24211d]">
            Filter syllabus
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#d7d3cd] bg-[#f1f0ed] text-[#6f6a63] transition-colors hover:bg-[#e7e5e1] hover:text-[#27231f]"
            aria-label="Close filter syllabus dialog"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-5">
          <FilterSection title="Subjects">
            <div className="grid grid-cols-2 gap-1.5">
              {filterSubjects.map((subject) => (
                <FilterCheckCard key={subject.name}>
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: subject.color }} />
                  <span className="truncate">{subject.name}</span>
                </FilterCheckCard>
              ))}
            </div>
          </FilterSection>

          <FilterSection title="Grade / Class">
            <div className="grid grid-cols-2 gap-1.5">
              {filterGrades.map((grade) => (
                <FilterCheckCard key={grade}>{grade}</FilterCheckCard>
              ))}
            </div>
          </FilterSection>

          <FilterSection title="Topic Status">
            <div className="grid grid-cols-2 gap-1.5">
              {filterStatuses.map((status) => (
                <FilterCheckCard key={status.name} checked={status.checked}>
                  {status.name}
                </FilterCheckCard>
              ))}
            </div>
          </FilterSection>

          <FilterSection title="Month Range">
            <div className="grid grid-cols-2 gap-3">
              <label>
                <span className="mb-1.5 block text-xs font-medium text-[#77716b]">From</span>
                <select
                  defaultValue="May 2026"
                  className="h-9 w-full rounded-lg border border-[#d7d3cd] bg-white px-3 text-xs text-[#2b2723] outline-none transition-colors focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
                >
                  {filterMonthOptions.map((month) => (
                    <option key={month}>{month}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-1.5 block text-xs font-medium text-[#77716b]">To</span>
                <select
                  defaultValue="June 2026"
                  className="h-9 w-full rounded-lg border border-[#d7d3cd] bg-white px-3 text-xs text-[#2b2723] outline-none transition-colors focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
                >
                  {filterMonthOptions.map((month) => (
                    <option key={month}>{month}</option>
                  ))}
                </select>
              </label>
            </div>
          </FilterSection>

          <FilterSection title="Completion % Range">
            <div className="flex items-center gap-3 text-xs font-medium text-[#9a958e]">
              <span>0%</span>
              <div className="relative h-5 flex-1">
                <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-[#a7a29b]" />
                <div className="absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 bg-[#2f7dd9]" />
                <span className="absolute left-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-[#2f7dd9]" />
                <span className="absolute right-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-[#2f7dd9]" />
              </div>
              <span>100%</span>
            </div>
          </FilterSection>

          <FilterSection title="Quick Tags">
            <div className="flex flex-wrap gap-1.5">
              {quickTags.map((tag) => (
                <button
                  key={tag.label}
                  type="button"
                  className={`h-7 rounded-full border px-3 text-[11px] font-medium transition-colors ${
                    tag.active
                      ? 'border-[#4e9eff] bg-[#e3f0ff] text-[#0f4c8a]'
                      : 'border-[#d7d3cd] bg-white text-[#2d2924] hover:bg-[#f1f0ed]'
                  }`}
                >
                  {tag.label}
                </button>
              ))}
            </div>
          </FilterSection>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2 border-t border-[#e7e3dd] pt-4">
          <button
            type="button"
            className="h-9 rounded-lg border border-[#d7d3cd] bg-white px-4 text-sm font-semibold text-[#4a453f] transition-colors hover:bg-[#f1f0ed]"
          >
            Clear all
          </button>
          <button
            type="submit"
            className={`h-9 rounded-lg px-4 text-sm font-semibold transition-colors ${primaryActionClassName}`}
          >
            Apply filters
          </button>
        </div>
      </form>
    </div>
  );
}

export function EditTopicDialog({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/35 px-4 py-6 backdrop-blur-[3px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-topic-title"
      onMouseDown={onClose}
    >
      <form
        className="w-full max-w-[520px] rounded-[18px] bg-white px-7 py-7 shadow-[0_24px_70px_rgba(23,22,15,0.28)]"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          onClose();
        }}
      >
        <div className="mb-7 flex items-start justify-between gap-4">
          <h2 id="edit-topic-title" className="text-lg font-semibold tracking-[0] text-[#24211d]">
            Edit topic
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#d7d3cd] bg-[#f1f0ed] text-[#6f6a63] transition-colors hover:bg-[#e7e5e1] hover:text-[#27231f]"
            aria-label="Close edit topic dialog"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[#77716b]">Subject</span>
            <select defaultValue="Mathematics" className="h-10 w-full rounded-lg border border-[#d7d3cd] bg-white px-3 text-sm text-[#2b2723] outline-none transition-colors focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15">
              <option>Mathematics</option>
              <option>Science</option>
              <option>English</option>
              <option>History</option>
              <option>Geography</option>
              <option>Art</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[#77716b]">Grade / Class</span>
            <select defaultValue="Grade 8" className="h-10 w-full rounded-lg border border-[#d7d3cd] bg-white px-3 text-sm text-[#2b2723] outline-none transition-colors focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15">
              <option>Grade 6</option>
              <option>Grade 7</option>
              <option>Grade 8</option>
              <option>Grade 9</option>
              <option>Grade 10</option>
            </select>
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold text-[#77716b]">Topic name</span>
            <input
              defaultValue="Calculus - Introduction to derivatives"
              className="h-10 w-full rounded-lg border border-[#d7d3cd] bg-white px-3 text-sm text-[#2b2723] outline-none transition-colors focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[#77716b]">Start month</span>
            <select defaultValue="May" className="h-10 w-full rounded-lg border border-[#d7d3cd] bg-white px-3 text-sm text-[#2b2723] outline-none transition-colors focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15">
              {editMonths.map((month) => (
                <option key={month}>{month}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[#77716b]">End month</span>
            <select defaultValue="May" className="h-10 w-full rounded-lg border border-[#d7d3cd] bg-white px-3 text-sm text-[#2b2723] outline-none transition-colors focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15">
              {editMonths.map((month) => (
                <option key={month}>{month}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[#77716b]">Room / Location</span>
            <input
              defaultValue="Room 14"
              className="h-10 w-full rounded-lg border border-[#d7d3cd] bg-white px-3 text-sm text-[#2b2723] outline-none transition-colors focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[#77716b]">Period</span>
            <select defaultValue="Period 2" className="h-10 w-full rounded-lg border border-[#d7d3cd] bg-white px-3 text-sm text-[#2b2723] outline-none transition-colors focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15">
              <option>Period 1</option>
              <option>Period 2</option>
              <option>Period 3</option>
              <option>Period 4</option>
              <option>Period 5</option>
            </select>
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold text-[#77716b]">Status</span>
            <select defaultValue="In progress" className="h-10 w-full rounded-lg border border-[#d7d3cd] bg-white px-3 text-sm text-[#2b2723] outline-none transition-colors focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15">
              <option>In progress</option>
              <option>Upcoming</option>
              <option>Ready</option>
              <option>Completed</option>
            </select>
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold text-[#77716b]">Notes</span>
            <textarea
              defaultValue={'Begin with a recap of limits. Introduce instantaneous rate of change.\nWalk through formal definition with worked examples.'}
              className="min-h-20 w-full resize-y rounded-lg border border-[#d7d3cd] bg-white px-3 py-2.5 text-sm leading-5 text-[#2b2723] outline-none transition-colors focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
            />
          </label>
        </div>

        <div className="mt-5">
          <div className="mb-2.5 text-xs font-semibold text-[#77716b]">Colour label</div>
          <div className="flex gap-2">
            {editColourLabels.map((colour, index) => (
              <button
                key={colour}
                type="button"
                className={`h-6 w-6 rounded-full ${index === 0 ? 'ring-2 ring-[#16150f] ring-offset-2' : ''}`}
                style={{ backgroundColor: colour }}
                aria-label={`Use colour label ${index + 1}`}
              />
            ))}
          </div>
        </div>

        <div className="mt-7 flex flex-col-reverse gap-2 border-t border-[#e7e3dd] pt-4 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            className="h-9 rounded-lg bg-[#fde7e7] px-4 text-sm font-semibold text-[#a33636] transition-colors hover:bg-[#fbd9d9]"
          >
            Delete topic
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-[#d7d3cd] bg-white px-4 text-sm font-semibold text-[#4a453f] transition-colors hover:bg-[#f1f0ed]"
          >
            Cancel
          </button>
          <button
            type="submit"
            className={`h-9 rounded-lg px-4 text-sm font-semibold transition-colors ${primaryActionClassName}`}
          >
            Save changes
          </button>
        </div>
      </form>
    </div>
  );
}
