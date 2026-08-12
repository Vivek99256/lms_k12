'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  Printer,
  ReceiptText,
  RefreshCcw,
  Search,
  Send,
  WalletCards,
  X,
} from 'lucide-react';

import { API_BASE_URL } from '@/app/components/utils/api_url';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  SearchDropdown,
  type DropdownField,
  type DropdownValue,
  type SearchDropdownValues,
} from '@/components/search-dropdown';

type SessionContext = {
  token: string;
  subInstituteId: string;
  userId: string;
  academicYearId: string;
  hostName: string;
  termId: string;
};

type ApiStatusPayload = {
  status?: string | number;
  status_code?: string | number;
  message?: string;
};

type FeeMonthOption = {
  id: string;
  label: string;
};

type ReceiptBookOption = {
  receiptId: string;
  name: string;
  line2: string;
  line3: string;
  heads: string;
};

type FeeCircularFilters = {
  months: FeeMonthOption[];
  receiptBooks: ReceiptBookOption[];
};

type FeeTotalRow = {
  monthId: string;
  month: string;
  breakoff: number;
  paid: number;
  remain: number;
};

type FeeCircularStudent = {
  studentId: string;
  enrollmentNo: string;
  studentName: string;
  standardDivision: string;
  gradeId: string;
  standardId: string;
  divisionId: string;
  pendingAmount: number;
  previousYearImprestBalance: number;
  totalFees: FeeTotalRow[];
};

type StudentCircularInputs = Record<string, { amount: string; remarks: string }>;

type GeneratedBreakoffRow = {
  title: string;
  amount: number;
};

type GeneratedCircularStudent = {
  studentId: string;
  enrollmentNo: string;
  studentName: string;
  standardName: string;
  divisionName: string;
  breakoff: GeneratedBreakoffRow[];
  totalAmount: number;
  overrideAmount: string;
  remarks: string;
};

type GeneratedCircularResult = {
  message: string;
  lastInsertedIds: string;
  html: string;
  displayMonthName: string;
  rows: GeneratedCircularStudent[];
  challanConfig: FeeChallanConfig;
};

type FeeChallanConfig = {
  instituteName: string;
  panNo: string;
  accountNo: string;
  cmsClientCode: string;
  bankLogo: string;
  instituteLines: string[];
};

type FiltersResponse = ApiStatusPayload & {
  months?: unknown;
  receipt_books?: unknown;
};

type StudentsResponse = ApiStatusPayload & {
  data?: unknown;
  months?: unknown;
  month?: unknown;
  receipt_books?: unknown;
  receipt_id?: unknown;
  grade_id?: unknown;
  standard_id?: unknown;
  division_id?: unknown;
};

type GenerateResponse = ApiStatusPayload & {
  data?: unknown;
  breakoff?: unknown;
  last_inserted_ids?: unknown;
  fees_circular_amount?: unknown;
  fees_circular_remarks?: unknown;
  display_month_name?: unknown;
  html?: unknown;
  str?: unknown;
  circular_html?: unknown;
  fees_circular_html?: unknown;
  challan_html?: unknown;
  print_html?: unknown;
};

const circularFields: DropdownField[] = ['section', 'standard', 'division'];
const hillsInstituteIds = new Set(['201', '202', '203', '204', '324', '326', '327']);
const pageSize = 12;
const emptyChallanConfig: FeeChallanConfig = {
  instituteName: '',
  panNo: '',
  accountNo: '',
  cmsClientCode: '',
  bankLogo: '',
  instituteLines: [],
};

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export default function FeesCircularsPage() {
  const [session] = useState(getSessionContext);
  const [filters, setFilters] = useState<FeeCircularFilters>({ months: [], receiptBooks: [] });
  const [academicFilters, setAcademicFilters] = useState<Partial<SearchDropdownValues>>({
    section: '',
    standard: '',
    division: '',
  });
  const [selectedMonthIds, setSelectedMonthIds] = useState<string[]>([]);
  const [selectedReceiptId, setSelectedReceiptId] = useState('');
  const [students, setStudents] = useState<FeeCircularStudent[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentInputs, setStudentInputs] = useState<StudentCircularInputs>({});
  const [quickSearch, setQuickSearch] = useState('');
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [searching, setSearching] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [generatedResult, setGeneratedResult] = useState<GeneratedCircularResult | null>(null);
  const [challanConfig, setChallanConfig] = useState<FeeChallanConfig>(emptyChallanConfig);
  const [page, setPage] = useState(1);

  const selectedSectionId = getSingleDropdownValue(academicFilters.section);
  const selectedStandardId = getSingleDropdownValue(academicFilters.standard);
  const selectedDivisionId = getSingleDropdownValue(academicFilters.division);
  const isHillsInstitute = hillsInstituteIds.has(session.subInstituteId);

  const visibleStudents = useMemo(() => {
    const query = quickSearch.trim().toLowerCase();

    if (!query) {
      return students;
    }

    return students.filter((student) =>
      [
        student.enrollmentNo,
        student.studentName,
        student.standardDivision,
        student.studentId,
      ].join(' ').toLowerCase().includes(query)
    );
  }, [quickSearch, students]);

  const totalPages = Math.max(Math.ceil(visibleStudents.length / pageSize), 1);
  const pageStudents = visibleStudents.slice((page - 1) * pageSize, page * pageSize);
  const selectedSet = useMemo(() => new Set(selectedStudentIds), [selectedStudentIds]);
  const allPageRowsSelected = pageStudents.length > 0 && pageStudents.every((student) => selectedSet.has(student.studentId));

  const metrics = useMemo(() => {
    const selectedRows = students.filter((student) => selectedSet.has(student.studentId));
    const selectedPending = selectedRows.reduce((total, student) => total + getSelectedRemain(student, selectedMonthIds), 0);

    return {
      months: selectedMonthIds.length,
      receiptBooks: filters.receiptBooks.length,
      students: students.length,
      selectedStudents: selectedRows.length,
      selectedPending,
    };
  }, [filters.receiptBooks.length, selectedMonthIds, selectedSet, students]);

  const loadFilters = useCallback(async () => {
    const currentSession = getSessionContext();

    if (!currentSession.subInstituteId || !currentSession.academicYearId) {
      setMessage({ type: 'error', text: 'Session institute or academic year is missing. Please sign in again before loading fee circular filters.' });
      return;
    }

    setLoadingFilters(true);
    setMessage(null);

    try {
      const form = createContextForm(currentSession);
      const [payload, config] = await Promise.all([
        postCircularApi<FiltersResponse>('fees-circular/filters', form, currentSession),
        fetchChallanConfig(currentSession).catch(() => emptyChallanConfig),
      ]);

      assertApiSuccess(payload, 'Unable to load fee circular filters.');
      setFilters({
        months: toMonthOptions(payload.months),
        receiptBooks: toReceiptBookOptions(payload.receipt_books),
      });
      setChallanConfig(config);
    } catch (error) {
      setFilters({ months: [], receiptBooks: [] });
      setMessage({ type: 'error', text: toErrorMessage(error, 'Unable to load fee circular filters.') });
    } finally {
      setLoadingFilters(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadFilters();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadFilters]);

  const handleMonthToggle = (monthId: string, checked: boolean) => {
    setSelectedMonthIds((current) => {
      if (checked) {
        return current.includes(monthId) ? current : [...current, monthId];
      }

      return current.filter((id) => id !== monthId);
    });
    setStudents([]);
    setSelectedStudentIds([]);
    setStudentInputs({});
    setGeneratedResult(null);
    setHasSearched(false);
    setPage(1);
  };

  const handleSearchStudents = useCallback(async () => {
    const currentSession = getSessionContext();

    if (!currentSession.subInstituteId || !currentSession.academicYearId) {
      setMessage({ type: 'error', text: 'Session institute or academic year is missing. Please sign in again before searching students.' });
      return;
    }

    if (selectedMonthIds.length === 0) {
      setMessage({ type: 'error', text: 'Select at least one month before searching students.' });
      return;
    }

    if (!selectedReceiptId) {
      setMessage({ type: 'error', text: 'Select a receipt book before searching students.' });
      return;
    }

    setSearching(true);
    setHasSearched(true);
    setMessage(null);
    setStudents([]);
    setSelectedStudentIds([]);
    setStudentInputs({});
    setGeneratedResult(null);
    setPage(1);

    try {
      const form = createContextForm(currentSession);

      if (selectedSectionId) form.append('grade', selectedSectionId);
      if (selectedStandardId) form.append('standard', selectedStandardId);
      if (selectedDivisionId) form.append('division', selectedDivisionId);
      selectedMonthIds.forEach((monthId) => form.append('month[]', monthId));
      form.append('receipt_id', selectedReceiptId);

      const payload = await postCircularApi<StudentsResponse>('fees-circular/students', form, currentSession);
      assertApiSuccess(payload, 'Unable to search fee circular students.');

      const nextStudents = toFeeCircularStudents(payload.data);
      const rawStudentCount = getPayloadItemCount(payload.data);
      setStudents(nextStudents);
      setMessage({
        type: rawStudentCount > 0 && nextStudents.length === 0 ? 'info' : 'success',
        text: rawStudentCount > 0 && nextStudents.length === 0
          ? `Laravel returned ${rawStudentCount} row${rawStudentCount === 1 ? '' : 's'}, but none included fee circular student details. Please check fee breakoff for the selected class/month.`
          : payload.message || `Loaded ${nextStudents.length} student${nextStudents.length === 1 ? '' : 's'} for fee circular generation.`,
      });
    } catch (error) {
      setStudents([]);
      setMessage({ type: 'error', text: toErrorMessage(error, 'Unable to search fee circular students.') });
    } finally {
      setSearching(false);
    }
  }, [selectedDivisionId, selectedMonthIds, selectedReceiptId, selectedSectionId, selectedStandardId]);

  const toggleStudentSelection = (studentId: string, checked: boolean) => {
    setSelectedStudentIds((current) => {
      if (checked) {
        return current.includes(studentId) ? current : [...current, studentId];
      }

      return current.filter((id) => id !== studentId);
    });
  };

  const togglePageSelection = (checked: boolean) => {
    const pageIds = pageStudents.map((student) => student.studentId);

    setSelectedStudentIds((current) => {
      if (checked) {
        return [...new Set([...current, ...pageIds])];
      }

      return current.filter((id) => !pageIds.includes(id));
    });
  };

  const updateStudentInput = (studentId: string, field: 'amount' | 'remarks', value: string) => {
    setStudentInputs((current) => ({
      ...current,
      [studentId]: {
        amount: current[studentId]?.amount ?? '',
        remarks: current[studentId]?.remarks ?? '',
        [field]: value,
      },
    }));
  };

  const handleGenerateCircular = useCallback(async () => {
    const currentSession = getSessionContext();
    const selectedStudents = students.filter((student) => selectedSet.has(student.studentId));

    if (!currentSession.subInstituteId || !currentSession.academicYearId || !currentSession.userId) {
      setMessage({ type: 'error', text: 'Session user, institute, or academic year is missing. Please sign in again before generating circulars.' });
      return;
    }

    if (selectedStudents.length === 0) {
      setMessage({ type: 'error', text: 'Select at least one student before generating fee circulars.' });
      return;
    }

    if (selectedMonthIds.length === 0 || !selectedReceiptId) {
      setMessage({ type: 'error', text: 'Month and receipt book are required before generating fee circulars.' });
      return;
    }

    setGenerating(true);
    setMessage(null);
    setGeneratedResult(null);

    try {
      const form = createContextForm(currentSession);
      form.append('month', selectedMonthIds.join(','));
      form.append('receipt_id', selectedReceiptId);
      form.append('grade_id', selectedSectionId);
      form.append('standard_id', selectedStandardId);

      selectedStudents.forEach((student) => {
        form.append('students[]', student.studentId);

        if (isHillsInstitute) {
          const input = studentInputs[student.studentId] ?? { amount: '', remarks: '' };
          form.append(`fees_circular_amount[${student.studentId}]`, input.amount.trim());
          form.append(`fees_circular_remarks[${student.studentId}]`, input.remarks.trim());
        }
      });

      const payload = await postCircularApi<GenerateResponse>('fees-circular/generate', form, currentSession);
      assertApiSuccess(payload, 'Unable to generate fee circulars.');

      const selectedReceiptBook = filters.receiptBooks.find((book) => book.receiptId === selectedReceiptId);
      const result = toGeneratedCircularResult(payload, {
        ...challanConfig,
        instituteLines: [selectedReceiptBook?.line2, selectedReceiptBook?.line3].filter(Boolean) as string[],
      });
      setGeneratedResult(result);
      setMessage({
        type: result.html ? 'success' : 'info',
        text: result.html
          ? result.message || 'Fee circulars generated successfully.'
          : 'Fee circular records were generated, but the Laravel JSON response did not include printable circular HTML.',
      });
    } catch (error) {
      setMessage({ type: 'error', text: toErrorMessage(error, 'Unable to generate fee circulars.') });
    } finally {
      setGenerating(false);
    }
  }, [
    isHillsInstitute,
    selectedMonthIds,
    selectedReceiptId,
    selectedSectionId,
    selectedSet,
    selectedStandardId,
    studentInputs,
    students,
    challanConfig,
    filters.receiptBooks,
  ]);

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-[1500px] space-y-4 p-3 sm:p-4 lg:p-5">
        <section className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <MetricCard title="Months selected" value={String(metrics.months)} icon={<ReceiptText className="h-4 w-4" />} />
          <MetricCard title="Receipt books" value={String(metrics.receiptBooks)} icon={<FileText className="h-4 w-4" />} />
          <MetricCard title="Students found" value={String(metrics.students)} icon={<Search className="h-4 w-4" />} />
          <MetricCard title="Students selected" value={String(metrics.selectedStudents)} icon={<CheckCircle2 className="h-4 w-4" />} />
          <MetricCard title="Selected remain" value={currencyFormatter.format(metrics.selectedPending)} icon={<WalletCards className="h-4 w-4" />} />
        </section>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-base font-bold leading-none text-slate-950">Fees circular</h1>
              <p className="mt-2 text-xs text-slate-700">Generate fee circular records from the Laravel fee breakoff workflow.</p>
            </div>
            <Button type="button" variant="outline" onClick={loadFilters} disabled={loadingFilters}>
              {loadingFilters ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              Refresh filters
            </Button>
          </div>

          <div className="space-y-4 p-4">
            <div className="grid gap-3 xl:grid-cols-[1.4fr_1fr]">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <SearchDropdown
                  fields={circularFields}
                  token={session.token}
                  subInstituteId={session.subInstituteId}
                  values={academicFilters}
                  onChange={(values) => {
                    setAcademicFilters(values);
                    setStudents([]);
                    setSelectedStudentIds([]);
                    setStudentInputs({});
                    setGeneratedResult(null);
                    setHasSearched(false);
                    setPage(1);
                  }}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Receipt book">
                  <select
                    value={selectedReceiptId}
                    onChange={(event) => {
                      setSelectedReceiptId(event.target.value);
                      setStudents([]);
                      setSelectedStudentIds([]);
                      setGeneratedResult(null);
                      setHasSearched(false);
                      setPage(1);
                    }}
                    className="h-8 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-[var(--primary-blue)] focus:ring-2 focus:ring-[var(--primary-blue)]/20"
                    disabled={loadingFilters}
                  >
                    <option value="">{loadingFilters ? 'Loading receipt books...' : 'Select receipt book'}</option>
                    {filters.receiptBooks.map((book) => (
                      <option key={book.receiptId} value={book.receiptId}>
                        {book.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Search results">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={quickSearch}
                      onChange={(event) => {
                        setQuickSearch(event.target.value);
                        setPage(1);
                      }}
                      className="pl-8"
                      placeholder="Filter students"
                    />
                  </div>
                </Field>
              </div>
            </div>

            <MonthPicker
              months={filters.months}
              selectedMonthIds={selectedMonthIds}
              loading={loadingFilters}
              onToggle={handleMonthToggle}
            />

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button type="button" onClick={handleSearchStudents} disabled={searching || loadingFilters}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Search students
              </Button>
              <Button type="button" onClick={handleGenerateCircular} disabled={generating || selectedStudentIds.length === 0}>
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Generate circular
              </Button>
            </div>

            {message && <InlineMessage type={message.type} text={message.text} />}

            <div className="overflow-hidden rounded-lg border border-slate-200">
              <Table className="min-w-[1120px]">
                <TableHeader>
                  <TableRow className="bg-slate-100 text-xs uppercase text-slate-700 hover:bg-slate-100">
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300"
                        checked={allPageRowsSelected}
                        disabled={pageStudents.length === 0}
                        onChange={(event) => togglePageSelection(event.target.checked)}
                        aria-label="Select visible students"
                      />
                    </TableHead>
                    <TableHead>GR no</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Standard</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                    <TableHead className="text-right">Selected remain</TableHead>
                    <TableHead className="text-right">Imprest balance</TableHead>
                    {isHillsInstitute && (
                      <>
                        <TableHead className="text-right">Fees breakoff</TableHead>
                        <TableHead>Fees circular amount</TableHead>
                        <TableHead>Fees circular remarks</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {searching ? (
                    <TableRow>
                      <TableCell colSpan={isHillsInstitute ? 10 : 7} className="h-36 text-center text-sm text-slate-600">
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading fee circular students
                        </span>
                      </TableCell>
                    </TableRow>
                  ) : pageStudents.length > 0 ? (
                    pageStudents.map((student) => {
                      const selected = selectedSet.has(student.studentId);
                      const circularInput = studentInputs[student.studentId] ?? { amount: '', remarks: '' };
                      const selectedRemain = getSelectedRemain(student, selectedMonthIds);

                      return (
                        <TableRow key={student.studentId} className="odd:bg-white even:bg-slate-50/70">
                          <TableCell>
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-slate-300"
                              checked={selected}
                              onChange={(event) => toggleStudentSelection(student.studentId, event.target.checked)}
                              aria-label={`Select ${student.studentName}`}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-xs text-slate-700">{student.enrollmentNo || '-'}</TableCell>
                          <TableCell>
                            <p className="font-semibold text-slate-950">{student.studentName || '-'}</p>
                            <p className="mt-1 text-xs text-slate-500">ID {student.studentId}</p>
                          </TableCell>
                          <TableCell>{student.standardDivision || '-'}</TableCell>
                          <TableCell className="text-right font-semibold text-slate-950">{currencyFormatter.format(student.pendingAmount)}</TableCell>
                          <TableCell className="text-right font-semibold text-slate-950">{currencyFormatter.format(selectedRemain)}</TableCell>
                          <TableCell className="text-right">{currencyFormatter.format(student.previousYearImprestBalance)}</TableCell>
                          {isHillsInstitute && (
                            <>
                              <TableCell className="text-right font-semibold text-slate-950">{currencyFormatter.format(selectedRemain)}</TableCell>
                              <TableCell className="min-w-40">
                                <Input
                                  inputMode="decimal"
                                  value={circularInput.amount}
                                  onChange={(event) => updateStudentInput(student.studentId, 'amount', event.target.value)}
                                  disabled={!selected}
                                  placeholder="Amount"
                                />
                              </TableCell>
                              <TableCell className="min-w-56">
                                <Textarea
                                  value={circularInput.remarks}
                                  onChange={(event) => updateStudentInput(student.studentId, 'remarks', event.target.value)}
                                  disabled={!selected}
                                  placeholder="Remarks"
                                  className="min-h-8"
                                />
                              </TableCell>
                            </>
                          )}
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={isHillsInstitute ? 10 : 7} className="h-36 text-center text-sm text-slate-600">
                        {hasSearched ? 'No students match the current fee circular search.' : 'Search to load fee circular students.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="text-xs text-slate-600">
                Showing {pageStudents.length} of {visibleStudents.length} student{visibleStudents.length === 1 ? '' : 's'}.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" onClick={() => setPage((current) => Math.max(current - 1, 1))} disabled={page === 1}>
                  Previous
                </Button>
                <span className="text-xs font-semibold text-slate-600">Page {page} of {totalPages}</span>
                <Button type="button" variant="outline" onClick={() => setPage((current) => Math.min(current + 1, totalPages))} disabled={page === totalPages}>
                  Next
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {generatedResult && (
        <GeneratedCircularModal
          result={generatedResult}
          onClose={() => setGeneratedResult(null)}
        />
      )}
    </div>
  );
}

function MetricCard({ title, value, icon }: { title: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-slate-700">{title}</p>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-[var(--primary-blue)]">
          {icon}
        </div>
      </div>
      <p className="mt-3 text-xl font-bold leading-none text-slate-950">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function MonthPicker({
  months,
  selectedMonthIds,
  loading,
  onToggle,
}: {
  months: FeeMonthOption[];
  selectedMonthIds: string[];
  loading: boolean;
  onToggle: (monthId: string, checked: boolean) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <Label>Months</Label>
        <span className="text-xs font-semibold text-slate-500">{selectedMonthIds.length} selected</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
        {loading ? (
          <div className="col-span-full flex h-16 items-center justify-center gap-2 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading months
          </div>
        ) : months.length > 0 ? (
          months.map((month) => (
            <label
              key={month.id}
              className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700"
            >
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                checked={selectedMonthIds.includes(month.id)}
                onChange={(event) => onToggle(month.id, event.target.checked)}
              />
              <span className="truncate">{month.label}</span>
            </label>
          ))
        ) : (
          <div className="col-span-full flex h-16 items-center justify-center text-sm text-slate-600">
            No months returned by Laravel for the selected academic year.
          </div>
        )}
      </div>
    </div>
  );
}

function InlineMessage({ type, text }: { type: 'success' | 'error' | 'info'; text: string }) {
  const Icon = type === 'success' ? CheckCircle2 : AlertCircle;
  const classes = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    error: 'border-red-200 bg-red-50 text-red-800',
    info: 'border-blue-200 bg-blue-50 text-blue-800',
  }[type];

  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${classes}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{text}</span>
    </div>
  );
}

function GeneratedCircularModal({
  result,
  onClose,
}: {
  result: GeneratedCircularResult;
  onClose: () => void;
}) {
  const printableHtml = result.html || buildGeneratedSummaryHtml(result);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=960,height=720');
    if (!printWindow) return;

    printWindow.document.open();
    printWindow.document.write(`<html><head><title>Fees circular</title></head><body onload="window.print()">${printableHtml}</body></html>`);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-bold text-slate-950">Generated fee circulars</h2>
            <p className="mt-1 text-xs text-slate-500">
              {result.lastInsertedIds ? `Log IDs ${result.lastInsertedIds}` : 'Generated records returned by Laravel'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4" />
              {result.html ? 'Print' : 'Print challan'}
            </Button>
            <Button type="button" variant="outline" size="icon" onClick={onClose} aria-label="Close generated circulars">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          {result.html ? (
            <div className="min-w-[760px]" dangerouslySetInnerHTML={{ __html: result.html }} />
          ) : (
            <div className="min-w-[1060px]" dangerouslySetInnerHTML={{ __html: buildGeneratedSummaryHtml(result) }} />
          )}
        </div>
      </div>
    </div>
  );
}

function getSessionContext(): SessionContext {
  if (typeof window === 'undefined') {
    return { token: '', subInstituteId: '', userId: '', academicYearId: '', hostName: '', termId: '' };
  }

  try {
    const userData = readStoredRecord('userData');
    const menuContext = readStoredRecord('menuContext');
    const selectedAcademicYear = localStorage.getItem('selectedAcademicYear');

    return {
      token: readString(userData.user_token ?? userData.token ?? menuContext.user_token ?? menuContext.token),
      subInstituteId: readString(userData.sub_institute_id ?? menuContext.sub_institute_id),
      userId: readString(userData.user_id ?? menuContext.user_id),
      academicYearId: readString(selectedAcademicYear || (userData.academic_year_id ?? userData.academicYearId ?? menuContext.academic_year_id)),
      hostName: readString(userData.host_name) || API_BASE_URL,
      termId: readString(userData.term_id ?? menuContext.term_id ?? userData.marking_period_id ?? menuContext.marking_period_id),
    };
  } catch {
    return { token: '', subInstituteId: '', userId: '', academicYearId: '', hostName: '', termId: '' };
  }
}

function readStoredRecord(key: string): Record<string, unknown> {
  if (typeof window === 'undefined') return {};

  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '{}') as unknown;
    return asRecord(parsed);
  } catch {
    return {};
  }
}

function createContextForm(session: SessionContext) {
  const form = new FormData();
  form.append('type', 'JSON');
  form.append('sub_institute_id', session.subInstituteId);
  form.append('syear', session.academicYearId);
  form.append('user_id', session.userId);

  if (session.token) form.append('token', session.token);
  if (session.termId) {
    form.append('term_id', session.termId);
    form.append('marking_period_id', session.termId);
  }

  return form;
}

async function postCircularApi<T extends ApiStatusPayload>(endpoint: string, form: FormData, session: SessionContext): Promise<T> {
  const apiBaseUrl = getApiBaseUrl(session);
  const response = await fetch(`${apiBaseUrl}/api/${endpoint}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
    },
    body: form,
  });

  const payload = await parseJsonResponse<T>(response);

  if (!response.ok) {
    throw new Error(payload.message || `HTTP ${response.status}: Laravel rejected the fee circular request.`);
  }

  return payload;
}

async function fetchChallanConfig(session: SessionContext): Promise<FeeChallanConfig> {
  const url = new URL(`${getApiBaseUrl(session)}/fees/fees_config_master`);
  url.searchParams.set('type', 'JSON');
  url.searchParams.set('sub_institute_id', session.subInstituteId);
  url.searchParams.set('syear', session.academicYearId);

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
    },
  });
  if (!response.ok) throw new Error('Unable to load challan configuration.');

  const payload = await parseJsonResponse<{ data?: unknown }>(response);
  const config = toRecordList(payload.data)[0] ?? {};
  return {
    instituteName: readString(config.institute_name),
    panNo: readString(config.pan_no),
    accountNo: readString(config.account_to_be_credited),
    cmsClientCode: readString(config.cms_client_code),
    bankLogo: readString(config.bank_logo),
    instituteLines: [],
  };
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) return {} as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(text.slice(0, 240) || 'Laravel returned a non-JSON response.');
  }
}

function assertApiSuccess(payload: ApiStatusPayload, fallbackMessage: string) {
  if (readStatus(payload) !== 1) {
    throw new Error(payload.message || fallbackMessage);
  }
}

function getApiBaseUrl(session: SessionContext) {
  return (session.hostName || API_BASE_URL || '').replace(/\/$/, '');
}

function getSingleDropdownValue(value: DropdownValue | undefined) {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

function readStatus(payload: ApiStatusPayload) {
  return readNumber(payload.status_code ?? payload.status);
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function readNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(readString(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function toMonthOptions(value: unknown): FeeMonthOption[] {
  if (Array.isArray(value)) {
    return value.map((item, index) => {
      const row = asRecord(item);
      const id = readString(row.id ?? row.month_id ?? row.value) || String(index);
      return {
        id,
        label: readString(row.name ?? row.label ?? row.month) || id,
      };
    }).filter((month) => month.id);
  }

  const record = asRecord(value);
  return Object.entries(record).map(([id, label]) => ({
    id,
    label: readString(label) || id,
  }));
}

function toReceiptBookOptions(value: unknown): ReceiptBookOption[] {
  if (!Array.isArray(value)) return [];

  return value.map((item, index) => {
    const row = asRecord(item);
    const receiptId = readString(row.receipt_id ?? row.id) || String(index);

    return {
      receiptId,
      name: readString(row.receipt_line_1 ?? row.name) || `Receipt book ${receiptId}`,
      line2: readString(row.receipt_line_2),
      line3: readString(row.receipt_line_3),
      heads: readString(row.heads),
    };
  }).filter((book) => book.receiptId);
}

function toFeeCircularStudents(value: unknown): FeeCircularStudent[] {
  return toRecordList(value).map((item) => {
    const row = asRecord(item);
    const student = Object.keys(asRecord(row.stu_data)).length > 0 ? asRecord(row.stu_data) : row;
    const studentId = readString(student.student_id ?? student.id);

    if (!studentId) return null;

    return {
      studentId,
      enrollmentNo: readString(student.enrollment ?? student.enrollment_no),
      studentName: normalizeSpaces(readString(student.name) || [
        readString(student.first_name),
        readString(student.middle_name),
        readString(student.last_name),
      ].filter(Boolean).join(' ')),
      standardDivision: readString(student.stddiv) || [
        readString(student.standard_name),
        readString(student.division_name),
      ].filter(Boolean).join('/'),
      gradeId: readString(student.grade_id),
      standardId: readString(student.std_id ?? student.standard_id),
      divisionId: readString(student.div_id ?? student.section_id),
      pendingAmount: readNumber(student.pending ?? row.pending),
      previousYearImprestBalance: readNumber(student.previous_year_imprest_balance),
      totalFees: toFeeTotalRows(row.total_fees),
    };
  }).filter((student): student is FeeCircularStudent => student !== null);
}

function getPayloadItemCount(value: unknown) {
  if (Array.isArray(value)) return value.length;
  return Object.keys(asRecord(value)).length;
}

function toFeeTotalRows(value: unknown): FeeTotalRow[] {
  const rows = Array.isArray(value) ? value : Object.values(asRecord(value));

  return rows.map((item) => {
    const row = asRecord(item);

    return {
      monthId: readString(row.month_id),
      month: readString(row.month),
      breakoff: readNumber(row.bk),
      paid: readNumber(row.paid),
      remain: readNumber(row.remain),
    };
  }).filter((row) => row.monthId);
}

function getSelectedRemain(student: FeeCircularStudent, selectedMonthIds: string[]) {
  if (selectedMonthIds.length === 0) return 0;
  const selected = new Set(selectedMonthIds);

  return student.totalFees.reduce((total, row) => {
    if (!selected.has(row.monthId)) return total;
    return total + row.remain;
  }, 0);
}

function toGeneratedCircularResult(payload: GenerateResponse, challanConfig: FeeChallanConfig): GeneratedCircularResult {
  const breakoffByStudent = asRecord(payload.breakoff);
  const amountByStudent = asRecord(payload.fees_circular_amount);
  const remarksByStudent = asRecord(payload.fees_circular_remarks);
  const rows = toRecordList(payload.data).map((row) => {
    const studentId = readString(row.id);
    const breakoff = toGeneratedBreakoffRows(breakoffByStudent[studentId]);
    const overrideAmount = readString(amountByStudent[studentId]);
    const totalAmount = overrideAmount.trim() ? readNumber(overrideAmount) : breakoff.reduce((total, item) => total + item.amount, 0);

    return {
      studentId,
      enrollmentNo: readString(row.enrollment_no),
      studentName: normalizeSpaces(`${readString(row.student_name)} ${readString(row.surname)}`),
      standardName: readString(row.standard_name),
      divisionName: readString(row.division_name),
      breakoff,
      totalAmount,
      overrideAmount,
      remarks: readString(remarksByStudent[studentId]),
    };
  });

  return {
    message: payload.message || 'Success',
    lastInsertedIds: readString(payload.last_inserted_ids),
    html: readCircularHtml(payload),
    displayMonthName: readString(payload.display_month_name),
    rows,
    challanConfig,
  };
}

function readCircularHtml(payload: GenerateResponse) {
  const htmlKeys = [
    'html',
    'str',
    'circular_html',
    'fees_circular_html',
    'challan_html',
    'print_html',
  ];
  const sources = [asRecord(payload), asRecord(payload.data)];

  for (const source of sources) {
    for (const key of htmlKeys) {
      const html = readString(source[key]);
      if (html.trim()) return html;
    }
  }

  return '';
}

function toRecordList(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.map(asRecord);
  }

  return Object.values(asRecord(value)).map(asRecord);
}

function toGeneratedBreakoffRows(value: unknown): GeneratedBreakoffRow[] {
  const record = asRecord(value);

  return Object.entries(record).map(([title, amount]) => ({
    title,
    amount: readNumber(amount),
  })).filter((row) => row.title);
}

function normalizeSpaces(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildGeneratedSummaryHtml(result: GeneratedCircularResult) {
  return `
    <style>
      .challan-sheet { display: grid; gap: 20px; font-family: Arial, sans-serif; color: #183b5b; }
      .challan-set { display: grid; grid-template-columns: repeat(3, minmax(300px, 1fr)); gap: 40px; page-break-inside: avoid; }
      .challan { border: 2px solid #111; min-height: 700px; font-size: 12px; background: white; }
      .challan-copy { border-bottom: 1px solid #3e4d57; padding: 5px; text-align: center; font-size: 14px; font-weight: 700; text-decoration: underline; }
      .challan-brand { border-bottom: 1px solid #3e4d57; padding: 8px 10px 10px; min-height: 60px; display: flex; align-items: center; justify-content: space-between; }
      .bank { color: #17558b; font-size: 23px; font-weight: 700; font-style: italic; } .bank i { color: #bb2b2e; }
      .brand-mark { font-size: 34px; line-height: 1; color: #1687ee; letter-spacing: -11px; transform: skew(-12deg); } .brand-mark b { color: #60c925; }
      .school { border-bottom: 1px solid #3e4d57; min-height: 95px; padding: 13px 8px; text-align: center; font-size: 14px; line-height: 1.9; }
      .school strong { font-size: 15px; } .challan-body { padding: 11px 8px; }
      .topline { display:flex; justify-content:space-between; align-items:center; border:1px solid #53616b; padding:7px; margin-bottom:7px; font-weight:700; }
      .line { border-bottom: 1px solid #53616b; height: 17px; margin: 6px 0 13px 47px; }
      .form-row { display:grid; grid-template-columns: 130px 1fr; align-items:center; margin:10px 0; } .form-row b { font-weight:600; }
      .boxed { display:inline-flex; } .boxed span { width: 17px; height: 25px; border:1px solid #53616b; margin-right:-1px; display:inline-flex; justify-content:center; align-items:center; font-size:13px; }
      .value-line { display:inline-block; min-width:120px; border-bottom:1px solid #53616b; padding:0 6px 3px; text-align:center; font-size:14px; font-weight:700; }
      .student-name { text-align:center; font-size:16px; font-weight:700; margin:4px 0 16px; } .student-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
      .fee-table { width:100%; border-collapse:collapse; margin-top:13px; font-size:12px; } .fee-table th,.fee-table td { border:1px solid #111; padding:5px 6px; } .fee-table th { font-size:13px; } .amount { text-align:right; }
      .total { text-align:right; font-size:14px; font-weight:700; padding-top:8px; } @media print { .challan-sheet { gap:12px; } .challan-set { gap:18px; } }
    </style>
    <div class="challan-sheet">${result.rows.map((row) => buildLegacyChallanSet(row, result.challanConfig)).join('')}</div>
  `;
}

function buildLegacyChallanSet(row: GeneratedCircularStudent, config: FeeChallanConfig) {
  const copies = ['STUDENT COPY', 'SCHOOL COPY', 'BANK COPY'];
  const feeRows = row.breakoff.map((item) => `<tr><td>${escapeHtml(item.title)}</td><td class="amount">${escapeHtml(String(item.amount))}</td><td></td><td></td></tr>`).join('') || '<tr><td>-</td><td></td><td></td><td></td></tr>';
  const account = boxedValue(config.accountNo);
  const instituteName = config.instituteName || 'Triz Innovation';
  const bankBrand = config.bankLogo
    ? `<img src="${escapeHtml(config.bankLogo)}" alt="Bank" style="max-height:42px;max-width:160px;object-fit:contain">`
    : '<span class="bank"><i>i</i>ICICI Bank</span>';
  const grNo = escapeHtml(row.enrollmentNo || row.studentId || '-');
  const studentName = escapeHtml(row.studentName || '-');
  const standard = escapeHtml([row.standardName, row.divisionName].filter(Boolean).join(' / ') || '-');

  return `<section class="challan-set">${copies.map((copy) => `
    <article class="challan">
      <div class="challan-copy">${copy}</div>
      <div class="challan-brand">${bankBrand}<span class="brand-mark">◢◢<b>◢</b></span></div>
      <div class="school"><strong>${escapeHtml(instituteName)}</strong>${config.instituteLines.map((line) => `<br>${escapeHtml(line)}`).join('')}</div>
      <div class="challan-body">
        <div class="topline"><span>PAN No.: &nbsp; ${escapeHtml(config.panNo || '-')}</span><span>Date: ${boxedValue('')}</span></div>
        <div>Branch <div class="line"></div></div>
        <div class="form-row"><b>Account to be Credited :</b><span>${account}</span></div>
        <div class="form-row"><b>CMS Client Code:</b><span>${boxedValue(config.cmsClientCode)}</span></div>
        <div class="form-row"><b>Institution Name :</b><span>${boxedValue(instituteName)}</span></div>
        <div class="form-row"><b>Quarter Fee (Tick)</b><span>${['Q1','Q2','Q3','Q4'].map((quarter) => `<span style="margin-right:12px">${boxedValue('')}${quarter}</span>`).join('')}</span></div>
        <div><b>Student Name :</b><div class="student-name">${studentName}</div></div>
        <div class="student-grid"><div><b>G.R. No. :</b><br><span class="value-line">${grNo}</span></div><div><b>Class/Div. :</b><br><span class="value-line">${standard}</span></div></div>
        <div style="margin-top:14px"><b>Father Name :</b><br><span class="value-line" style="float:right">-</span></div>
        <table class="fee-table"><thead><tr><th>Fee Heads</th><th>Amount</th><th>Cash Deposit</th><th>Amount</th></tr></thead><tbody>${feeRows}</tbody></table>
        <div class="total">Total: ${escapeHtml(String(row.totalAmount))}</div>
      </div>
    </article>`).join('')}</section>`;
}

function boxedValue(value: string) {
  return `<span class="boxed">${(value || '        ').slice(0, 16).split('').map((character) => `<span>${escapeHtml(character)}</span>`).join('')}</span>`;
}
