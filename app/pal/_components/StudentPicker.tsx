'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Eye, Loader2, Search, UserRound } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SearchDropdown, type SearchDropdownValues, type DropdownValue } from '@/components/search-dropdown';
import { buildSessionContext } from '@/lib/erp-client';
import { fetchClassStudents, type PalClassStudent } from '@/app/pal/data/pal-lookups';
import type { PalStudentSelection } from '@/app/pal/data/pal';

/**
 * Admin/teacher student picker for the PAL workspace: a cascading
 * Grade → Standard → Division filter (reusing the shared <SearchDropdown>), a
 * searchable student list, and an explicit "View as student" button. Fully
 * responsive: the class filters stack on small screens.
 */

function single(value: DropdownValue | undefined): string {
  if (Array.isArray(value)) return value[0] ? String(value[0]) : '';
  return value ? String(value) : '';
}

export default function StudentPicker({
  onSelect,
  audience = 'Student',
}: {
  onSelect: (student: PalStudentSelection) => void;
  audience?: 'Teacher' | 'Student';
}) {
  const ctaLabel = audience === 'Teacher' ? 'Review student' : 'View as student';
  const session = useMemo(() => buildSessionContext(), []);
  const [gradeId, setGradeId] = useState('');
  const [standardId, setStandardId] = useState('');
  const [divisionId, setDivisionId] = useState('');

  const [students, setStudents] = useState<PalClassStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<PalClassStudent | null>(null);
  const requestId = useRef(0);

  // Load students whenever a standard (± division) is chosen. Grade alone is too
  // broad, so we wait for a standard before hitting the list endpoint.
  useEffect(() => {
    let cancelled = false;
    // The student list is only needed in Teacher (review) mode; the Student
    // "guest preview" mode needs the class scope, not a specific learner.
    if (audience === 'Student' || !standardId) {
      queueMicrotask(() => {
        if (!cancelled) {
          setStudents([]);
          setChosen(null);
        }
      });
      return () => {
        cancelled = true;
      };
    }
    const id = ++requestId.current;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!cancelled) {
        setLoading(true);
        setError(null);
        setChosen(null);
      }
    });
    fetchClassStudents({ gradeId, standardId, divisionId }, controller.signal)
      .then((rows) => {
        if (id === requestId.current) setStudents(rows);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted || id !== requestId.current) return;
        setError(reason instanceof Error ? reason.message : 'Unable to load students.');
        setStudents([]);
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [audience, gradeId, standardId, divisionId]);

  const handleClassChange = (values: SearchDropdownValues) => {
    setGradeId(single(values.section));
    setStandardId(single(values.standard));
    setDivisionId(single(values.division));
  };

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return students;
    return students.filter(
      (student) =>
        student.name.toLowerCase().includes(term) ||
        student.enrollmentNo.toLowerCase().includes(term) ||
        student.rollNo.toLowerCase().includes(term)
    );
  }, [students, query]);

  const isGuest = audience === 'Student';
  const canConfirm = isGuest ? Boolean(standardId) : Boolean(chosen);

  const confirm = () => {
    if (isGuest) {
      // "Become a guest student" for the selected class — no specific learner.
      if (!standardId) return;
      onSelect({ studentId: '', name: 'Guest student', gradeId, standardId, divisionId, guest: true });
      return;
    }
    if (!chosen) return;
    onSelect({
      studentId: chosen.id,
      name: chosen.name,
      gradeId: chosen.gradeId || gradeId,
      standardId: chosen.standardId || standardId,
      divisionId: chosen.divisionId || divisionId,
      enrollmentNo: chosen.enrollmentNo,
    });
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-bold text-slate-950">
          {isGuest ? 'Preview as a student' : 'Select a student'}
        </h2>
        <p className="mt-1 text-xs text-slate-600">
          {isGuest
            ? 'Choose a grade, standard and division, then step into a student’s shoes to see the PAL that class sees.'
            : 'Choose a grade, standard and division, pick a student, then review their PAL.'}
        </p>
      </div>

      <div className="space-y-4 p-4">
        <SearchDropdown
          fields={['section', 'standard', 'division']}
          subInstituteId={session.subInstituteId}
          token={session.token}
          labels={{ section: 'Grade', standard: 'Standard', division: 'Division' }}
          placeholders={{
            section: 'Select grade',
            standard: 'Select standard',
            division: 'Select division',
          }}
          onChange={handleClassChange}
          className="grid grid-cols-1 gap-3 sm:grid-cols-3"
        />

        {isGuest ? (
          <p className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-500">
            {standardId
              ? 'Ready — click “View as student” to preview this class’s PAL.'
              : 'Select a standard to preview the student experience for that class.'}
          </p>
        ) : standardId ? (
          <div className="space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name, enrollment or roll no."
                className="pl-9"
              />
            </div>

            {error ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 py-8 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading students…
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 py-8 text-center text-sm text-slate-500">
                {students.length === 0
                  ? 'No students found for this class.'
                  : 'No students match your search.'}
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200">
                <ul className="divide-y divide-slate-100">
                  {filtered.map((student) => {
                    const isActive = chosen?.id === student.id;
                    return (
                      <li key={student.id}>
                        <button
                          type="button"
                          onClick={() => setChosen(student)}
                          onDoubleClick={confirm}
                          className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-slate-50 ${
                            isActive ? 'bg-indigo-50' : ''
                          }`}
                        >
                          <span className="flex min-w-0 items-center gap-2.5">
                            <span
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                                isActive ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              <UserRound className="h-3.5 w-3.5" />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium text-slate-900">
                                {student.name || `Student #${student.id}`}
                              </span>
                              <span className="block truncate text-xs text-slate-500">
                                {[
                                  student.standardName && `Std ${student.standardName}`,
                                  student.divisionName && `Div ${student.divisionName}`,
                                  student.enrollmentNo && `Enroll ${student.enrollmentNo}`,
                                  student.rollNo && `Roll ${student.rollNo}`,
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </span>
                            </span>
                          </span>
                          {isActive ? <Check className="h-4 w-4 shrink-0 text-indigo-600" /> : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-500">
            Select a standard to list students.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">
          {isGuest
            ? standardId
              ? 'You will see the PAL a student in this class sees.'
              : 'Select a standard to enable the preview.'
            : chosen
              ? (
                  <>
                    Selected:{' '}
                    <span className="font-semibold text-slate-800">
                      {chosen.name || `Student #${chosen.id}`}
                    </span>
                  </>
                )
              : 'Pick a student, then review their PAL.'}
        </p>
        <Button
          onClick={confirm}
          disabled={!canConfirm}
          className="bg-[#4f46e5] text-white hover:bg-[#4338ca] disabled:opacity-50 sm:w-auto"
        >
          <Eye className="h-4 w-4" />
          {ctaLabel}
        </Button>
      </div>
    </section>
  );
}
