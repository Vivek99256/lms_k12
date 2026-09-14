'use client';

/**
 * The question bank's filter bar.
 *
 * Two things it deliberately does differently from a row of bare dropdowns:
 *
 * 1. Every filter is labelled. Eleven unlabelled selects reading "All Bloom",
 *    "All DOK", "All Sections" force the reader to decode each one; a small
 *    caption above costs one line and removes the guessing.
 * 2. Options come from the server for the current scope, not from the
 *    questions on screen. Deriving them from the page is what made the full
 *    filter set appear on one chapter and vanish on every other.
 *
 * Chips below the grid say what is currently narrowing the list, because with
 * this many controls an accidentally-set filter is otherwise invisible.
 */

import React from 'react';
import { Search, X, SlidersHorizontal } from 'lucide-react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface FilterOption {
  value: string;
  label: string;
  /** Rendered dimmed after the label, e.g. a count or a publisher name. */
  hint?: string;
}

export interface FilterSpec {
  key: string;
  label: string;
  allLabel: string;
  options: FilterOption[];
  value: string;
  onChange: (next: string) => void;
}

function FilterField({ spec }: { spec: FilterSpec }) {
  const active = spec.value !== 'all';
  const selected = spec.options.find((option) => option.value === spec.value);

  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="truncate text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
        {spec.label}
      </span>
      <Select value={spec.value} onValueChange={(next) => spec.onChange((next as string) ?? 'all')}>
        <SelectTrigger
          className={cn(
            'h-10 rounded-[8px] border-slate-300 bg-white px-3 text-[14px] text-slate-900 shadow-sm',
            active && 'border-[#4f46e5] bg-[#eef2ff] font-semibold text-[#3730a3]'
          )}
        >
          <SelectValue>
            <span className="truncate">{selected?.label ?? spec.allLabel}</span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-[280px] overflow-y-auto">
          <SelectItem value="all">{spec.allLabel}</SelectItem>
          {spec.options
            .filter((option) => option.value !== 'all')
            .map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
                {option.hint ? (
                  <span className="ml-1 text-slate-400">{option.hint}</span>
                ) : null}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </label>
  );
}

export function QuestionBankFilterBar({
  countLabel,
  countTone,
  filters,
  reviewState,
  onReviewStateChange,
  search,
  onSearchChange,
  onClearAll,
  action,
}: {
  countLabel: string;
  countTone?: 'default' | 'error';
  filters: FilterSpec[];
  reviewState: string;
  onReviewStateChange: (next: string) => void;
  search: string;
  onSearchChange: (next: string) => void;
  onClearAll: () => void;
  /** The Add question button, kept out of this component so the student bank
   *  can reuse the bar with no write affordance. */
  action?: React.ReactNode;
}) {
  const activeFilters = filters.filter((spec) => spec.value !== 'all');
  const activeCount = activeFilters.length + (search ? 1 : 0) + (reviewState !== 'all' ? 1 : 0);

  return (
    <section className="mb-6 rounded-[10px] border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <SlidersHorizontal size={16} className="text-slate-400" />
          <p
            className={cn(
              'text-[15px] font-semibold',
              countTone === 'error' ? 'text-rose-600' : 'text-slate-800'
            )}
          >
            {countLabel}
          </p>
          {activeCount > 0 && (
            <span className="rounded-full bg-[#eef2ff] px-2 py-0.5 text-[11px] font-bold text-[#3730a3]">
              {activeCount} filter{activeCount === 1 ? '' : 's'}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <Input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search questions..."
              className="h-10 w-[230px] rounded-[8px] border-slate-300 bg-white pl-9 text-[14px]"
            />
            {search ? (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>
          {action}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 border-t border-slate-100 pt-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {filters.map((spec) => (
          <FilterField key={spec.key} spec={spec} />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
          Review state
        </span>
        {[
          { value: 'all', label: 'All' },
          { value: 'published', label: 'Published' },
          { value: 'held', label: 'Held for review' },
        ].map((choice) => (
          <button
            key={choice.value}
            type="button"
            onClick={() => onReviewStateChange(choice.value)}
            className={cn(
              'rounded-full px-3 py-1 text-[12px] font-bold transition-colors',
              reviewState === choice.value
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            )}
          >
            {choice.label}
          </button>
        ))}

        {activeCount > 0 && (
          <>
            <span className="mx-1 h-4 w-px bg-slate-200" aria-hidden />
            {activeFilters.map((spec) => {
              const selected = spec.options.find((option) => option.value === spec.value);
              return (
                <button
                  key={spec.key}
                  type="button"
                  onClick={() => spec.onChange('all')}
                  className="inline-flex items-center gap-1 rounded-full border border-[#c7d2fe] bg-[#eef2ff] px-2.5 py-1 text-[12px] font-semibold text-[#3730a3] hover:bg-[#e0e7ff]"
                >
                  <span className="font-normal text-[#6366f1]">{spec.label}:</span>
                  <span className="max-w-[160px] truncate">{selected?.label ?? spec.value}</span>
                  <X size={12} />
                </button>
              );
            })}
            <button
              type="button"
              onClick={onClearAll}
              className="ml-auto text-[12px] font-bold text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
            >
              Clear all
            </button>
          </>
        )}
      </div>
    </section>
  );
}

export default QuestionBankFilterBar;
