'use client';

import { Search, X } from 'lucide-react';

import { SearchDropdown, type SearchDropdownValues, type Standard, type Subject } from '@/components/search-dropdown';
import { Input } from '@/components/ui/input';
import type { CountedOption } from '@/app/course-master/data/chapters';
import type { TypeMapping } from '@/lib/h5p/question-bank-h5p-map';
import type { LibraryFilters } from '../../data/question-bank-library';

/**
 * The scope and the filters, in that order.
 *
 * SCOPE AND FILTER ARE NOT THE SAME CONTROL, which is why they are two rows.
 * Section, standard, subject and chapter decide WHICH questions are fetched --
 * changing one is a new request and a new set of counts. Type, difficulty and
 * the search box narrow what is already on screen. Mixing the two in one row
 * of seven dropdowns reads as seven equal choices and hides the fact that only
 * the first four cost a round trip.
 *
 * Every filter is labelled for the reason the question bank's own filter bar
 * gives: unlabelled selects reading "All types", "All levels" force the reader
 * to decode each one.
 */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  // A div and not a <label>: a label forwards its click to the first control
  // inside it, which fires a native select twice.
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="truncate text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">{label}</span>
      {children}
    </div>
  );
}

const SELECT_CLASS =
  'h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400';

export interface LibraryFiltersProps {
  scope: Partial<SearchDropdownValues>;
  onScopeChange: (values: SearchDropdownValues) => void;
  onStandardPicked: (standards: Standard[]) => void;
  onSubjectPicked: (subjects: Subject[]) => void;

  chapters: CountedOption[];
  chapterId: string;
  onChapterChange: (chapterId: string) => void;
  chaptersLoading: boolean;

  /** The forms actually present in this chapter, in catalogue order. */
  availableTypes: Array<{ mapping: TypeMapping; count: number }>;
  difficulties: CountedOption[];

  filters: LibraryFilters;
  onFiltersChange: (next: LibraryFilters) => void;
}

export function LibraryFiltersBar(props: LibraryFiltersProps) {
  const { filters, onFiltersChange } = props;
  const narrowed =
    filters.typeCode !== 'all' || filters.difficulty !== 'all' || filters.search.trim() !== '';

  return (
    <div className="mb-5 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">Where the questions come from</p>
        {/* SearchDropdown lays out its own grid, so the chapter select sits in
            a grid of its own beneath it rather than fighting that one. */}
        <SearchDropdown
          fields={['section', 'standard', 'subject']}
          values={props.scope}
          onChange={props.onScopeChange}
          onStandardChange={(_value, data) => props.onStandardPicked(data)}
          onSubjectChange={(_value, data) => props.onSubjectPicked(data)}
        />

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Chapter">
            <select
              className={SELECT_CLASS}
              value={props.chapterId}
              disabled={props.chaptersLoading || props.chapters.length === 0}
              onChange={(event) => props.onChapterChange(event.target.value)}
            >
              <option value="">
                {props.chaptersLoading
                  ? 'Loading chapters…'
                  : props.chapters.length === 0
                    ? 'Choose a subject first'
                    : 'Select a chapter'}
              </option>
              {props.chapters.map((chapter) => (
                <option key={String(chapter.id ?? chapter.value)} value={String(chapter.id ?? chapter.value)}>
                  {chapter.name ?? chapter.label ?? `Chapter ${chapter.id}`}
                  {chapter.total ? ` (${chapter.total})` : ''}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">Narrow what is listed</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Question type">
            <select
              className={SELECT_CLASS}
              value={filters.typeCode}
              onChange={(event) => onFiltersChange({ ...filters, typeCode: event.target.value })}
            >
              <option value="all">All question types</option>
              {props.availableTypes.map(({ mapping, count }) => (
                <option key={mapping.code} value={mapping.code}>
                  {mapping.label} ({count})
                </option>
              ))}
            </select>
          </Field>

          <Field label="Difficulty">
            <select
              className={SELECT_CLASS}
              value={filters.difficulty}
              onChange={(event) => onFiltersChange({ ...filters, difficulty: event.target.value })}
            >
              <option value="all">All difficulty levels</option>
              {props.difficulties.map((level) => (
                <option key={String(level.value ?? level.name)} value={String(level.value ?? level.name ?? '')}>
                  {level.label ?? level.name ?? String(level.value)}
                  {level.total ? ` (${level.total})` : ''}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Search question">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={filters.search}
                onChange={(event) => onFiltersChange({ ...filters, search: event.target.value })}
                placeholder="Search the stem, options or answer"
                className="h-9 pl-8"
              />
            </div>
          </Field>
        </div>

        {narrowed ? (
          <button
            type="button"
            onClick={() => onFiltersChange({ typeCode: 'all', difficulty: 'all', search: '' })}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50"
          >
            <X className="h-3 w-3" />
            Clear filters
          </button>
        ) : null}
      </div>
    </div>
  );
}
