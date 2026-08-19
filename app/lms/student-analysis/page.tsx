'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, LineChart, Loader2, Search, TrendingUp } from 'lucide-react';

import { SearchDropdown, type DropdownValue } from '@/components/search-dropdown';
import { buildSessionContext } from '@/lib/erp-client';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { fetchStudentList, type StudentListRow } from '@/app/lms/data/studentAnalysis';
import RequireStaff from '@/app/lms/_shared/RequireStaff';

function singleValue(value: DropdownValue): string {
  return Array.isArray(value) ? value[0] ?? '' : value;
}
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

export default function StudentAnalysisPage() {
  const session = useMemo(() => buildSessionContext(), []);

  const [gradeId, setGradeId] = useState('');
  const [standardId, setStandardId] = useState('');
  const [divisionId, setDivisionId] = useState('');

  const [students, setStudents] = useState<StudentListRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [query, setQuery] = useState('');

  const canSearch = !!gradeId && !!standardId && !loading;

  const filtered = useMemo(() => {
    if (!students) return [];
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.enrollmentNo.toLowerCase().includes(q) ||
        s.mobile.toLowerCase().includes(q)
    );
  }, [students, query]);

  const handleSearch = async () => {
    if (!gradeId || !standardId) return;
    setLoading(true);
    setErrorText('');
    try {
      const rows = await fetchStudentList({ gradeId, standardId, divisionId });
      setStudents(rows);
    } catch (error) {
      setStudents(null);
      setErrorText(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <RequireStaff>
    <div className="min-h-full px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-[1400px] space-y-5">
        {/* Header */}
        <header className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <TrendingUp className="size-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              Student Analysis Report
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Pick a class, then open a student to see their exam-wise performance analysis.
            </p>
          </div>
        </header>

        {errorText ? (
          <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1">{errorText}</div>
          </div>
        ) : null}

        {/* Filters */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Filters</h2>
          <SearchDropdown
            fields={['section', 'standard', 'division']}
            subInstituteId={session.subInstituteId}
            token={session.token}
            labels={{ section: 'Grade', standard: 'Standard', division: 'Division' }}
            required={{ section: true, standard: true }}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
            onSectionChange={(value) => {
              setGradeId(singleValue(value));
              setStandardId('');
              setDivisionId('');
            }}
            onStandardChange={(value) => {
              setStandardId(singleValue(value));
              setDivisionId('');
            }}
            onDivisionChange={(value) => setDivisionId(singleValue(value))}
          />
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={handleSearch}
              disabled={!canSearch}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#4f46e5] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4338ca] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              Search
            </button>
          </div>
        </section>

        {/* Result */}
        {students ? (
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                Students <span className="text-sm font-normal text-slate-500">({filtered.length})</span>
              </h2>
              <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search name, enrollment, mobile…"
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-indigo-400"
                />
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              {filtered.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-300 px-3 py-10 text-center text-sm text-slate-500">
                  No students match these filters.
                </p>
              ) : (
                <Table className="min-w-[720px]">
                  <TableHeader>
                    <TableRow className="bg-slate-100/90 hover:bg-slate-100/90">
                      <TableHead className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">#</TableHead>
                      <TableHead className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">Student</TableHead>
                      <TableHead className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">Enrollment</TableHead>
                      <TableHead className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">Mobile</TableHead>
                      <TableHead className="text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((student, index) => (
                      <TableRow key={student.id} className="odd:bg-white even:bg-slate-50/60">
                        <TableCell className="text-slate-500">{index + 1}</TableCell>
                        <TableCell className="font-medium text-slate-900">{student.name}</TableCell>
                        <TableCell className="text-slate-600">{student.enrollmentNo || '-'}</TableCell>
                        <TableCell className="text-slate-600">{student.mobile || '-'}</TableCell>
                        <TableCell className="text-right">
                          <Link
                            href={`/lms/student-analysis/${student.id}`}
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100'
                            )}
                          >
                            <LineChart className="size-3.5" />
                            View analysis
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </div>
    </RequireStaff>
  );
}
