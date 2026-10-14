'use client';

// ---------------------------------------------------------------------------
// A searchable picker for "which student does this sheet belong to".
//
// Its list is the exam's class list and nothing else: the students eligible to
// sit this paper. A student outside it is not a choice that can be made here, and
// the server refuses one anyway. Every entry carries what tells similar students
// apart — roll number, name, GR number, division — because two Ravi Shahs in one
// class is the ordinary case, not the exception.
//
// Students the server named as the likely ones (a conflict, an ambiguous name) are
// listed first and marked; students who already have a sheet in this evaluation
// are shown but can't be chosen, which is what stops a duplicate before it starts.
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SearchInput } from '@/components/ui/search-input';
import { describeStudent, filterStudents } from '@/lib/exam-evaluation/identity';
import type { RosterStudent } from './types';

type Props = {
  students: RosterStudent[];
  value: number | null;
  onChange: (studentId: number | null) => void;
  /** Students the server thinks it could be: listed first and marked. */
  preferred?: number[];
  /** Students who can't be chosen, and why ("Already has a sheet: asha.pdf"). */
  unavailable?: Record<number, string>;
  /** Offer "not assigned" as a choice. */
  allowClear?: boolean;
  disabled?: boolean;
  id?: string;
  placeholder?: string;
  /** Accessible name when there is no visible label. */
  ariaLabel?: string;
  className?: string;
};

export default function StudentPicker({
  students,
  value,
  onChange,
  preferred = [],
  unavailable = {},
  allowClear = false,
  disabled = false,
  id,
  placeholder = 'Choose a student',
  ariaLabel,
  className = '',
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement | null>(null);

  const selected = useMemo(() => students.find((student) => student.student_id === value) ?? null, [students, value]);
  const matches = useMemo(() => filterStudents(students, query, preferred), [students, query, preferred]);
  const preferredSet = useMemo(() => new Set(preferred), [preferred]);

  // Rows: an optional "not assigned", then the matching students.
  const rows = useMemo(
    () => [
      ...(allowClear && query.trim() === '' ? [{ kind: 'clear' as const }] : []),
      ...matches.map((student) => ({ kind: 'student' as const, student })),
    ],
    [allowClear, matches, query]
  );

  // Keep the highlighted row in view as the arrow keys move it.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-row="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const choose = (index: number) => {
    const row = rows[index];

    if (!row) return;

    if (row.kind === 'clear') {
      onChange(null);
    } else {
      if (unavailable[row.student.student_id]) return;

      onChange(row.student.student_id);
    }

    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((current) => Math.min(rows.length - 1, current + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((current) => Math.max(0, current - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(active);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);

        if (next) {
          setQuery('');
          setActive(0);
        }
      }}
    >
      <PopoverTrigger
        render={
          <button
            type="button"
            id={id}
            disabled={disabled}
            aria-label={ariaLabel}
            aria-haspopup="listbox"
            aria-expanded={open}
            className={`flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-2.5 text-left text-sm text-slate-900 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70 ${className}`}
          />
        }
      >
        <span className={`min-w-0 flex-1 truncate ${selected ? '' : 'text-slate-500'}`}>
          {selected ? describeStudent(selected) : placeholder}
        </span>
        <ChevronDown className="size-4 shrink-0 text-slate-500" aria-hidden />
      </PopoverTrigger>

      <PopoverContent align="start" className="w-[min(26rem,calc(100vw-2rem))] gap-2 p-2" positionerClassName="z-[120]">
        <div className="relative">
          <SearchInput
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search name, roll no., GR no. or division"
            aria-label="Search students"
            icon={<Search className="size-4" aria-hidden />}
          />
        </div>

        <ul ref={listRef} role="listbox" aria-label="Students" className="max-h-64 overflow-y-auto overscroll-contain">
          {rows.map((row, index) => {
            const isActive = index === active;

            if (row.kind === 'clear') {
              return (
                <li key="clear" role="option" aria-selected={value === null} data-row={index}>
                  <button
                    type="button"
                    onClick={() => choose(index)}
                    onMouseEnter={() => setActive(index)}
                    className={`flex w-full items-center rounded-md px-2.5 py-2 text-left text-sm text-slate-600 ${isActive ? 'bg-slate-100' : ''}`}
                  >
                    Not assigned
                  </button>
                </li>
              );
            }

            const { student } = row;
            const blocked = unavailable[student.student_id];
            const isSelected = student.student_id === value;

            return (
              <li key={student.student_id} role="option" aria-selected={isSelected} aria-disabled={Boolean(blocked)} data-row={index}>
                <button
                  type="button"
                  disabled={Boolean(blocked)}
                  onClick={() => choose(index)}
                  onMouseEnter={() => setActive(index)}
                  className={`flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50 ${
                    isActive ? 'bg-slate-100' : ''
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-slate-900">
                      {student.roll_no ? `${student.roll_no}. ` : ''}
                      {student.name}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {[
                        student.enrollment_no ? `GR ${student.enrollment_no}` : '',
                        student.section_name ? `Division ${student.section_name}` : '',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                    {preferredSet.has(student.student_id) ? (
                      <span className="block text-xs font-medium text-indigo-700">Could be this sheet</span>
                    ) : null}
                    {blocked ? <span className="block text-xs text-amber-700">{blocked}</span> : null}
                  </span>
                  {isSelected ? <Check className="mt-0.5 size-4 shrink-0 text-indigo-600" aria-label="Selected" /> : null}
                </button>
              </li>
            );
          })}

          {rows.length === 0 ? (
            <li className="px-2.5 py-4 text-center text-sm text-slate-500">
              {students.length === 0
                ? 'No students are on this exam’s class list.'
                : 'No one on this exam’s class list matches that.'}
            </li>
          ) : null}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
