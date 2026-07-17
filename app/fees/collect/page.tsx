'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowUpDown,
  Banknote,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  ReceiptText,
  Search,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  SearchDropdown,
  type Division,
  type DropdownField,
  type DropdownValue,
  type SearchDropdownValues,
  type Standard,
} from '@/components/search-dropdown';

type SessionContext = {
  token: string;
  subInstituteId: string;
  userId: string;
  academicYearId: string;
  hostName: string;
};

type FeeStatus = 'overdue' | 'partial' | 'paid' | 'due';

type StudentFeeRow = {
  id: string;
  name: string;
  grNo: string;
  admissionNo: string;
  standard: string;
  section: string;
  feeHead: string;
  dueDate: string;
  dueDateRaw?: string;
  collectionDateRaw?: string;
  totalFees?: number;
  paidFees?: number;
  pendingFees: number;
  paymentMode?: string;
  mobile?: string;
  status: FeeStatus;
};

type ChartPoint = {
  month: string;
  collected: number;
  target: number;
};

type HeadBreakdown = {
  label: string;
  collected: number;
  pending: number;
};

type PaymentMix = {
  label: string;
  value: number;
  color: string;
};

type DashboardSnapshot = {
  collectedThisTerm?: number;
  outstandingTotal?: number;
  collectionRate?: number;
  defaulters?: number;
  chartTrend?: ChartPoint[];
  headBreakdown?: HeadBreakdown[];
  paymentMix?: PaymentMix[];
};

type DashboardData = {
  collectedThisTerm: number;
  outstandingTotal: number;
  collectionRate: number;
  defaulters: number;
  chartTrend: ChartPoint[];
  headBreakdown: HeadBreakdown[];
  paymentMix: PaymentMix[];
};

type StudentFetchFilters = {
  query?: string;
  selectedSection?: string;
  selectedStandard?: string;
  selectedDivision?: string;
};

type StudentFetchOptions = {
  append?: boolean;
  page?: number;
};

const ALL_FILTER_VALUE = 'all';
const PAGE_SIZE = 10;
const STREAM_ROW_BATCH_SIZE = 10;
const STUDENT_STREAM_ARRAY_KEYS = ['stu_data', 'students'];

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const currencySymbol = currencyFormatter
  .formatToParts(0)
  .find((part) => part.type === 'currency')?.value ?? 'Rs.';

const paymentMixColors = ['#4f46e5', '#0f9b6e', '#2563eb', '#e17a00', '#0891b2', '#be185d'];

const dummyStudents: StudentFeeRow[] = [
  { id: '2733', name: 'Vihaan Shah', grNo: '2733', admissionNo: 'ADM-2022-0733', standard: '12', section: 'B', feeHead: 'Exam · Term 2', dueDate: '08 Jul 2026', pendingFees: 12000, mobile: '9876543210', status: 'overdue' },
  { id: '0555', name: 'Ananya Iyer', grNo: '0555', admissionNo: 'ADM-2022-0555', standard: '10', section: 'A', feeHead: 'Lab · Term 2', dueDate: '10 Jul 2026', pendingFees: 9500, mobile: '9876543211', status: 'overdue' },
  { id: '0129', name: 'Ishaan Gupta', grNo: '0129', admissionNo: 'ADM-2023-0129', standard: '9', section: 'A', feeHead: 'Tuition · Term 2', dueDate: '12 Jul 2026', pendingFees: 52000, mobile: '9876543212', status: 'overdue' },
  { id: '0192', name: 'Aarav Mehta', grNo: '0192', admissionNo: 'ADM-2024-0192', standard: '5', section: 'A', feeHead: 'Tuition · Term 2', dueDate: '15 Jul 2026', pendingFees: 42500, mobile: '9876543213', status: 'overdue' },
  { id: '0871', name: 'Diya Sharma', grNo: '0871', admissionNo: 'ADM-2023-0871', standard: '8', section: 'B', feeHead: 'Tuition · Term 2', dueDate: '15 Jul 2026', pendingFees: 24000, mobile: '9876543214', status: 'partial' },
  { id: '0217', name: 'Saanvi Reddy', grNo: '0217', admissionNo: 'ADM-2024-0217', standard: '7', section: 'B', feeHead: 'Tuition · Term 2', dueDate: '15 Jul 2026', pendingFees: 45000, mobile: '9876543215', status: 'paid' },
  { id: '0402', name: 'Reyansh Jain', grNo: '0402', admissionNo: 'ADM-2022-0402', standard: '11', section: 'A', feeHead: 'Hostel · Term 2', dueDate: '18 Jul 2026', pendingFees: 34000, mobile: '9876543216', status: 'partial' },
  { id: '0043', name: 'Vivaan Rao', grNo: '0043', admissionNo: 'ADM-2025-0043', standard: '3', section: 'A', feeHead: 'Transport · Term 2', dueDate: '20 Jul 2026', pendingFees: 18000, mobile: '9876543217', status: 'due' },
  { id: '0666', name: 'Arjun Menon', grNo: '0666', admissionNo: 'ADM-2023-0666', standard: '8', section: 'A', feeHead: 'Transport · Term 2', dueDate: '20 Jul 2026', pendingFees: 18000, mobile: '9876543218', status: 'overdue' },
  { id: '0121', name: 'Aadhya Bose', grNo: '0121', admissionNo: 'ADM-2025-0121', standard: '4', section: 'C', feeHead: 'Tuition · Term 2', dueDate: '22 Jul 2026', pendingFees: 39000, mobile: '9876543219', status: 'due' },
  { id: '0314', name: 'Kabir Khan', grNo: '0314', admissionNo: 'ADM-2024-0314', standard: '6', section: 'B', feeHead: 'Lab · Term 2', dueDate: '24 Jul 2026', pendingFees: 10000, mobile: '9876543220', status: 'due' },
  { id: '0912', name: 'Meera Nair', grNo: '0912', admissionNo: 'ADM-2023-0912', standard: '2', section: 'A', feeHead: 'Activity · Term 2', dueDate: '26 Jul 2026', pendingFees: 15000, mobile: '9876543221', status: 'partial' },
];

export default function FeesCollectPage() {
  const router = useRouter();
  const fetchRequestIdRef = useRef(0);
  const currentFetchFiltersRef = useRef<StudentFetchFilters>({});
  const cachedStudentsRef = useRef<StudentFeeRow[]>([]);
  const [students, setStudents] = useState<StudentFeeRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [academicFilters, setAcademicFilters] = useState<Partial<SearchDropdownValues>>({
    section: '',
    standard: '',
    division: '',
  });
  const [selectedStandardName, setSelectedStandardName] = useState('');
  const [selectedDivisionName, setSelectedDivisionName] = useState('');
  const [feeHeadFilter] = useState(ALL_FILTER_VALUE);
  const [statusFilter] = useState(ALL_FILTER_VALUE);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreStudents, setHasMoreStudents] = useState(false);
  const [totalStudentCount, setTotalStudentCount] = useState<number | null>(null);
  const [collectingStudentId, setCollectingStudentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dashboardSnapshot, setDashboardSnapshot] = useState<DashboardSnapshot>({});
  const [session] = useState(getSessionContext);

  const loadDummyStudents = useCallback((message?: string) => {
    cachedStudentsRef.current = [];
    setStudents(dummyStudents);
    setDashboardSnapshot({});
    setSelectedStudentIds([]);
    setCurrentPage(1);
    setHasMoreStudents(false);
    setTotalStudentCount(dummyStudents.length);
    setError(message ? `${message} Showing demo dues.` : 'Showing demo dues.');
  }, []);

  const fetchStudents = useCallback(async (filters: StudentFetchFilters = {}, options: StudentFetchOptions = {}) => {
    const pageNumber = Math.max(options.page ?? 1, 1);
    const append = Boolean(options.append);
    const cachedPageRows = getCachedStudentPage(cachedStudentsRef.current, pageNumber);

    if (append && cachedPageRows.length > 0) {
      setStudents((current) => appendUniqueStudents(current, cachedPageRows));
      setCurrentPage(pageNumber);
      setHasMoreStudents(pageNumber * PAGE_SIZE < cachedStudentsRef.current.length);
      setTotalStudentCount(cachedStudentsRef.current.length);
      return;
    }

    const requestId = fetchRequestIdRef.current + 1;
    fetchRequestIdRef.current = requestId;

    if (!session.subInstituteId) {
      loadDummyStudents('Session data is missing.');
      return;
    }

    setError(null);

    if (append) {
      setLoadingMore(true);
    } else {
      currentFetchFiltersRef.current = filters;
      cachedStudentsRef.current = [];
      setLoading(true);
      setStudents([]);
      setDashboardSnapshot({});
      setSelectedStudentIds([]);
      setCurrentPage(1);
      setHasMoreStudents(false);
      setTotalStudentCount(null);
    }

    try {
      let token = '';
      let subInstituteId = '';
      let hostName = '';

      if (typeof window !== 'undefined') {
        try {
          const userData = JSON.parse(localStorage.getItem('userData') || '{}') as Record<string, unknown>;
          const menuContext = JSON.parse(localStorage.getItem('menuContext') || '{}') as Record<string, unknown>;

          token = readString(userData.user_token ?? userData.token);
          subInstituteId = readString(userData.sub_institute_id ?? menuContext.sub_institute_id);
          hostName = readString(userData.host_name);
        } catch {}
      }

      const academicYearId = readString(localStorage.getItem('selectedAcademicYear') || session.academicYearId);

      if (!hostName || !token || !subInstituteId) {
        loadDummyStudents('Session data is missing.');
        return;
      }

      const form = new URLSearchParams();
      form.append('sub_institute_id', String(subInstituteId));
      form.append('syear', String(academicYearId));
      appendStudentSearchFilters(form, filters);
      appendStudentPaginationFilters(form, pageNumber);
      if (includeInactive) form.append('include_inactive', '1');
      form.append('type', 'API');

      const res = await fetch(`${hostName.replace(/\/$/, '')}/fees/fees_collect/show_student`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: form.toString(),
      });

      if (!res.ok) {
        const errorPayload = await res.json().catch(() => ({}));
        throw new Error((errorPayload as Record<string, unknown>).message ? String(errorPayload.message) : `HTTP ${res.status}: Unable to load students`);
      }

      const responseData = await readStudentsResponseProgressively(res, {
        onRows: (rows) => {
          if (fetchRequestIdRef.current !== requestId) return;
          if (!append && pageNumber === 1) {
            setStudents((current) => {
              const remainingSlots = PAGE_SIZE - current.length;
              return remainingSlots > 0 ? appendUniqueStudents(current, rows.slice(0, remainingSlots)) : current;
            });
          }
        },
      }, {
        stopAfterRows: pageNumber * PAGE_SIZE,
      });

      if (fetchRequestIdRef.current !== requestId) return;

      const pageRows = getLazyPageRows(responseData.rows, pageNumber);
      const responseReturnedMoreThanOnePage = responseData.rows.length > PAGE_SIZE;
      const responseTotalCount = responseData.totalCount ?? (responseReturnedMoreThanOnePage ? responseData.rows.length : null);

      if (responseReturnedMoreThanOnePage) {
        cachedStudentsRef.current = responseData.rows;
      }

      if (append) {
        if (pageRows.length > 0) {
          setStudents((current) => appendUniqueStudents(current, pageRows));
          setCurrentPage(pageNumber);
        }
      } else {
        setStudents(pageRows);
        setCurrentPage(1);
      }

      const responseSnapshot = toDashboardSnapshot(responseData.payload, responseData.source);
      if (!append || hasDashboardSnapshotData(responseSnapshot)) {
        setDashboardSnapshot(responseSnapshot);
      }
      if (!append) {
        setSelectedStudentIds([]);
      }
      setTotalStudentCount(responseTotalCount);
      setHasMoreStudents(hasMoreStudentPages({
        pageNumber,
        returnedRows: responseData.rows.length,
        totalCount: responseTotalCount,
        cachedTotalCount: cachedStudentsRef.current.length,
      }));
    } catch (fetchError) {
      if (fetchRequestIdRef.current !== requestId) return;
      const message = fetchError instanceof Error ? fetchError.message : 'Unable to load student fees list.';
      loadDummyStudents(message);
    } finally {
      if (fetchRequestIdRef.current === requestId) {
        if (append) {
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
      }
    }
  }, [includeInactive, loadDummyStudents, session]);

  useEffect(() => {
    // The collect dashboard loads the current dues once the browser session is available.
    void fetchStudents();
  }, [fetchStudents]);

  const handleCollectFees = useCallback(async (studentId: string) => {
    const currentSession = getSessionContext();
    const hostName = currentSession.hostName.replace(/\/$/, '');
    const academicYearId = currentSession.academicYearId || session.academicYearId;

    if (!hostName || !currentSession.subInstituteId || !academicYearId) {
      setError('Unable to open fee collection because session data is missing.');
      return;
    }

    setCollectingStudentId(studentId);
    setError(null);

    try {
      const params = new URLSearchParams({
        sub_institute_id: currentSession.subInstituteId,
        syear: academicYearId,
        type: 'API',
      });

      const res = await fetch(`${hostName}/fees/fees_collect/${encodeURIComponent(studentId)}/edit?${params.toString()}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...(currentSession.token ? { Authorization: `Bearer ${currentSession.token}` } : {}),
        },
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = asRecord(payload).message;
        throw new Error(message ? String(message) : `HTTP ${res.status}: Unable to load fee collection data.`);
      }

      if (typeof window !== 'undefined') {
        sessionStorage.setItem(`feesCollectData:${studentId}`, JSON.stringify(payload));
      }

      router.push(`/fees/collect/${encodeURIComponent(studentId)}`);
    } catch (collectError) {
      setError(collectError instanceof Error ? collectError.message : 'Unable to load fee collection data.');
    } finally {
      setCollectingStudentId(null);
    }
  }, [router, session.academicYearId]);

  const selectedStandardId = getSingleDropdownValue(academicFilters.standard);
  const selectedDivisionId = getSingleDropdownValue(academicFilters.division);

  const filteredStudents = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return students.filter((student) => {
      const searchableText = [
        student.name,
        student.admissionNo,
        student.grNo,
        student.mobile,
        getClassLabel(student),
        student.feeHead,
      ].filter(Boolean).join(' ').toLowerCase();

      const matchesSearch = !normalizedSearch || searchableText.includes(normalizedSearch);
      const matchesStandard = !selectedStandardId || matchesStudentStandard(student, selectedStandardId, selectedStandardName);
      const matchesDivision = !selectedDivisionId || matchesStudentDivision(student, selectedDivisionId, selectedDivisionName);
      const matchesFeeHead = feeHeadFilter === ALL_FILTER_VALUE || student.feeHead === feeHeadFilter;
      const matchesStatus = statusFilter === ALL_FILTER_VALUE || student.status === statusFilter;

      return matchesSearch && matchesStandard && matchesDivision && matchesFeeHead && matchesStatus;
    });
  }, [feeHeadFilter, searchTerm, selectedDivisionId, selectedDivisionName, selectedStandardId, selectedStandardName, statusFilter, students]);

  const loadedPageCount = Math.max(Math.ceil(filteredStudents.length / PAGE_SIZE), 1);
  const pageCount = Math.max(loadedPageCount + (hasMoreStudents ? 1 : 0), 1);
  const safeCurrentPage = Math.min(currentPage, pageCount);
  const pageStartIndex = filteredStudents.length === 0 ? 0 : (safeCurrentPage - 1) * PAGE_SIZE + 1;
  const knownDuesCount = totalStudentCount ?? filteredStudents.length;
  const duesCountLabel = totalStudentCount != null ? String(totalStudentCount) : hasMoreStudents ? `${students.length}+` : String(filteredStudents.length);
  const pageEndIndex = Math.min(safeCurrentPage * PAGE_SIZE, knownDuesCount);
  const pagedStudents = filteredStudents.slice((safeCurrentPage - 1) * PAGE_SIZE, safeCurrentPage * PAGE_SIZE);

  const currentPageIds = pagedStudents.map((student) => student.id);
  const allPageRowsSelected = currentPageIds.length > 0 && currentPageIds.every((id) => selectedStudentIds.includes(id));
  const dashboardData = useMemo(() => buildDashboardData(students, dashboardSnapshot), [dashboardSnapshot, students]);

  const handleAcademicDropdownChange = (values: SearchDropdownValues, changedField: DropdownField) => {
    setAcademicFilters({
      section: values.section,
      standard: values.standard,
      division: values.division,
    });
    setCurrentPage(1);

    if (changedField === 'section') {
      setSelectedStandardName('');
      setSelectedDivisionName('');
    }

    if (changedField === 'standard') {
      setSelectedDivisionName('');
    }
  };

  const handleStandardChange = (value: DropdownValue, selectedData: Standard[]) => {
    setSelectedStandardName(getSingleDropdownValue(value) ? selectedData[0]?.name ?? '' : '');
  };

  const handleDivisionChange = (value: DropdownValue, selectedData: Division[]) => {
    setSelectedDivisionName(getSingleDropdownValue(value) ? selectedData[0]?.name ?? '' : '');
  };

  const toggleCurrentPageSelection = (checked: boolean) => {
    setSelectedStudentIds((current) => {
      if (!checked) return current.filter((id) => !currentPageIds.includes(id));
      return [...new Set([...current, ...currentPageIds])];
    });
  };

  const toggleStudentSelection = (studentId: string, checked: boolean) => {
    setSelectedStudentIds((current) => checked ? [...new Set([...current, studentId])] : current.filter((id) => id !== studentId));
  };

  const handlePageChange = (pageNumber: number) => {
    const safePageNumber = Math.max(1, Math.min(pageNumber, pageCount));

    if (safePageNumber <= loadedPageCount) {
      setCurrentPage(safePageNumber);
      return;
    }

    if (hasMoreStudents && !loadingMore) {
      void fetchStudents(currentFetchFiltersRef.current, { append: true, page: safePageNumber });
    }
  };

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-[1500px] space-y-4 p-4 md:p-5 lg:p-6">
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Collected this term"
            value={formatLakhs(dashboardData.collectedThisTerm)}
            trend="up"
            icon={<Banknote className="h-4 w-4" />}
          />
          <MetricCard
            title="Outstanding"
            value={formatLakhs(dashboardData.outstandingTotal)}
            trend="down"
            icon={<AlertCircle className="h-4 w-4" />}
          />
          <MetricCard
            title="Collection rate"
            value={`${dashboardData.collectionRate}%`}
            icon={<Target className="h-4 w-4" />}
          />
          <MetricCard
            title="Defaulters"
            value={String(dashboardData.defaulters)}
            icon={<Users className="h-4 w-4" />}
          />
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.3fr_1.3fr_1fr]">
          <ChartCard title="Collection vs target" subtitle="Monthly, current academic year (INR lakh)">
            <CollectionLineChart data={dashboardData.chartTrend} />
          </ChartCard>
          <ChartCard title="Head-wise: collected vs pending" subtitle="Current term (INR lakh)">
            <HeadWiseBars data={dashboardData.headBreakdown} />
          </ChartCard>
          <ChartCard title="Payment mode mix" subtitle="Share of collection">
            <PaymentDonut data={dashboardData.paymentMix} />
          </ChartCard>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <form
            className="grid grid-cols-1 gap-3 p-4 lg:grid-cols-[280px_minmax(0,1fr)_104px_120px] lg:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              fetchStudents({
                query: searchTerm,
                selectedSection: getSingleDropdownValue(academicFilters.section),
                selectedStandard: getSingleDropdownValue(academicFilters.standard),
                selectedDivision: getSingleDropdownValue(academicFilters.division),
              });
            }}
          >
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search student, admission"
                className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 shadow-none outline-none transition-colors placeholder:text-slate-400 focus:border-[var(--primary-blue)] focus:ring-1 focus:ring-[var(--primary-blue)]"
              />
            </div>

            <SearchDropdown
              fields={['section', 'standard', 'division']}
              values={academicFilters}
              labels={{
                section: 'Section',
                standard: 'Standard',
                division: 'Division',
              }}
              placeholders={{
                section: 'All sections',
                standard: 'All standards',
                division: 'All divisions',
              }}
              className="min-w-0 gap-3 grid-cols-1 md:grid-cols-3 xl:grid-cols-3 [&>div]:min-w-0 [&_label]:text-xs [&_select]:h-10 [&_select]:rounded-md [&_select]:text-sm"
              onChange={handleAcademicDropdownChange}
              onStandardChange={handleStandardChange}
              onDivisionChange={handleDivisionChange}
            />

            <label className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(event) => {
                  setIncludeInactive(event.target.checked);
                  setCurrentPage(1);
                }}
                className="h-4 w-4 rounded border-slate-300 accent-[var(--primary-blue)]"
              />
              In-active
            </label>

            <Button type="submit" disabled={loading} className="h-10 rounded-md bg-[var(--primary-blue)] px-4 text-sm text-white hover:bg-[color-mix(in_srgb,var(--primary-blue),#000_12%)]">
              {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Search className="mr-1.5 h-3.5 w-3.5" />}
              Refresh
            </Button>
          </form>

          <div className="flex flex-col gap-2 border-t border-slate-100 px-4 pb-4 text-xs font-medium text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {filteredStudents.length} loaded of {duesCountLabel} dues
            </span>
            {(loadingMore || (loading && students.length > 0)) && (
              <span className="inline-flex items-center gap-1.5 text-[var(--primary-blue)]" aria-live="polite">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {loadingMore ? 'Loading next 10 records...' : 'Loading first 10 records...'}
              </span>
            )}
          </div>

          {error && (
            <div className="mx-4 mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {error}
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-300 bg-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-700">
                  <th className="w-12 px-3 py-3">
                    <input
                      type="checkbox"
                      checked={allPageRowsSelected}
                      onChange={(event) => toggleCurrentPageSelection(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 accent-[var(--primary-blue)]"
                    />
                  </th>
                  <SortableHeader label="Student" />
                  <SortableHeader label="Class" />
                  <th className="px-5 py-3 font-semibold">Fee Head</th>
                  <th className="px-5 py-3 font-semibold">Due Date</th>
                  <SortableHeader label="Amount" align="right" />
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading && students.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-14 text-center text-sm text-slate-500">
                      <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin text-[var(--primary-blue)]" />
                      Loading first student fee records...
                    </td>
                  </tr>
                ) : pagedStudents.length > 0 ? (
                  pagedStudents.map((student) => (
                    <tr key={student.id} className="border-b border-slate-200 odd:bg-white even:bg-slate-50/80 hover:bg-blue-50/30">
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selectedStudentIds.includes(student.id)}
                          onChange={(event) => toggleStudentSelection(student.id, event.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 accent-[var(--primary-blue)]"
                        />
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-semibold text-slate-950">{student.name || '-'}</p>
                        <p className="mt-1 text-xs text-slate-500">{student.admissionNo || student.grNo || '-'}</p>
                      </td>
                      <td className="px-5 py-3 text-slate-950">{getClassLabel(student) || '-'}</td>
                      <td className="px-5 py-3 text-slate-950">{student.feeHead || '-'}</td>
                      <td className="px-5 py-3 text-slate-950">{student.dueDate || '-'}</td>
                      <td className="px-5 py-3 text-right font-bold text-slate-950">{currencyFormatter.format(student.pendingFees)}</td>
                      <td className="px-5 py-3">
                        <StatusBadge status={student.status} />
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            className="h-8 rounded-lg bg-indigo-50 px-3 text-xs font-semibold text-indigo-600 hover:bg-indigo-100"
                            disabled={collectingStudentId === student.id}
                            onClick={() => handleCollectFees(student.id)}
                          >
                            {collectingStudentId === student.id ? (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <ReceiptText className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            {student.status === 'paid' ? 'View' : 'Collect'}
                          </Button>
                          <button
                            type="button"
                            aria-label={`View ${student.name}`}
                            onClick={() => handleCollectFees(student.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-5 py-14 text-center text-sm text-slate-500">
                      No dues found for the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 md:flex-row md:items-center md:justify-between">
            <span>{pageStartIndex}-{pageEndIndex} of {duesCountLabel}</span>
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                disabled={safeCurrentPage === 1 || loadingMore}
                onClick={() => handlePageChange(safeCurrentPage - 1)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  disabled={loadingMore && page > loadedPageCount}
                  onClick={() => handlePageChange(page)}
                  className={`flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm font-semibold transition-colors ${
                    safeCurrentPage === page
                      ? 'bg-[var(--primary-blue)] text-white shadow-md shadow-blue-500/20'
                      : page > loadedPageCount
                        ? 'border border-dashed border-slate-300 text-slate-700 hover:bg-slate-100'
                        : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {loadingMore && page > loadedPageCount ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : page}
                </button>
              ))}
              <button
                type="button"
                disabled={safeCurrentPage === pageCount || loadingMore}
                onClick={() => handlePageChange(safeCurrentPage + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  delta,
  deltaLabel,
  trend,
  icon,
}: {
  title: string;
  value: string;
  delta?: string;
  deltaLabel?: string;
  trend?: 'up' | 'down';
  icon: React.ReactNode;
}) {
  const isPositive = trend === 'up';

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-700">{title}</p>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-100 bg-indigo-50 text-indigo-600">
          {icon}
        </div>
      </div>
      <p className="mt-4 text-2xl font-bold leading-none text-slate-950">{value}</p>
      {delta && (
        <p className={`mt-3 flex items-center gap-1 text-xs font-semibold ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
          {isPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
          <span>{delta}</span>
          <span className="font-medium text-slate-600">{deltaLabel}</span>
        </p>
      )}
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="min-h-[486px] rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-5">
        <h2 className="text-xl font-bold leading-none text-slate-950">{title}</h2>
        <p className="mt-3 text-sm text-slate-700">{subtitle}</p>
      </div>
      <div className="p-6">
        {children}
      </div>
      <div className="flex justify-end px-6 pb-6">
        <button type="button" className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700">
          View breakdown
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function CollectionLineChart({ data }: { data: ChartPoint[] }) {
  const width = 520;
  const height = 180;
  const padding = { top: 18, right: 20, bottom: 34, left: 34 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const highestValue = Math.max(0, ...data.flatMap((item) => [item.collected, item.target]));
  const maxValue = Math.max(1, Math.ceil(highestValue / 5) * 5);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => Math.round(maxValue * ratio * 10) / 10);

  const buildPoints = (key: 'collected' | 'target') => data
    .map((item, index) => {
      const x = padding.left + (plotWidth / Math.max(data.length - 1, 1)) * index;
      const y = padding.top + plotHeight - (item[key] / maxValue) * plotHeight;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="pt-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[190px] w-full">
        {ticks.map((tick) => {
          const y = padding.top + plotHeight - (tick / maxValue) * plotHeight;
          return (
            <g key={tick}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />
              <text x={padding.left - 10} y={y + 4} textAnchor="end" className="fill-slate-500 text-[9px]">{formatAxisValue(tick)}</text>
            </g>
          );
        })}
        <polyline points={buildPoints('target')} fill="none" stroke="#94a3b8" strokeWidth="2.2" />
        <polyline points={buildPoints('collected')} fill="none" stroke="#4f46e5" strokeWidth="2.6" />
        {data.map((item, index) => {
          const x = padding.left + (plotWidth / Math.max(data.length - 1, 1)) * index;
          const targetY = padding.top + plotHeight - (item.target / maxValue) * plotHeight;
          const collectedY = padding.top + plotHeight - (item.collected / maxValue) * plotHeight;

          return (
            <g key={item.month}>
              <circle cx={x} cy={targetY} r="3" fill="white" stroke="#94a3b8" strokeWidth="2" />
              <circle cx={x} cy={collectedY} r="3.2" fill="white" stroke="#4f46e5" strokeWidth="2" />
              <text x={x} y={height - 12} textAnchor="middle" className="fill-slate-500 text-[10px]">{item.month}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function HeadWiseBars({ data }: { data: HeadBreakdown[] }) {
  const width = 520;
  const height = 180;
  const padding = { top: 18, right: 16, bottom: 36, left: 34 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(10, ...data.map((item) => item.collected + item.pending));
  const groupWidth = plotWidth / Math.max(data.length, 1);

  return (
    <div className="pt-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[190px] w-full">
        {[0, 2.5, 5, 7.5, 10].map((tick) => {
          const normalizedTick = (tick / 10) * maxValue;
          const y = padding.top + plotHeight - (normalizedTick / maxValue) * plotHeight;
          return (
            <g key={tick}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />
              <text x={padding.left - 10} y={y + 4} textAnchor="end" className="fill-slate-500 text-[9px]">{Math.round(normalizedTick)}</text>
            </g>
          );
        })}
        {data.map((item, index) => {
          const x = padding.left + groupWidth * index + groupWidth / 2;
          const collectedHeight = (item.collected / maxValue) * plotHeight;
          const pendingHeight = (item.pending / maxValue) * plotHeight;

          return (
            <g key={item.label}>
              <rect x={x - 14} y={padding.top + plotHeight - collectedHeight} width="20" height={collectedHeight} rx="1.5" fill="#07966f" />
              <rect x={x + 10} y={padding.top + plotHeight - pendingHeight} width="20" height={pendingHeight} rx="1.5" fill="#e17a00" />
              <text x={x + 2} y={height - 12} textAnchor="middle" className="fill-slate-500 text-[9px]">{shortenLabel(item.label)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function PaymentDonut({ data }: { data: PaymentMix[] }) {
  const radius = 74;
  const circumference = 2 * Math.PI * radius;
  const totalShare = data.reduce((total, item) => total + item.value, 0);
  const segments = data.reduce<Array<PaymentMix & { dash: number; offset: number }>>((accumulator, item) => {
    const offset = accumulator.reduce((total, segment) => total + segment.dash, 0);
    const dash = (item.value / 100) * circumference;
    return [...accumulator, { ...item, dash, offset }];
  }, []);

  return (
    <div className="flex min-h-[306px] flex-col items-center justify-center">
      <svg viewBox="0 0 220 220" className="h-[306px] w-full max-w-[306px]">
        <circle cx="110" cy="110" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="44" />
        {segments.map((item) => (
          <circle
            key={item.label}
            cx="110"
            cy="110"
            r={radius}
            fill="none"
            stroke={item.color}
            strokeWidth="44"
            strokeDasharray={`${item.dash} ${circumference - item.dash}`}
            strokeDashoffset={-item.offset}
            transform="rotate(-90 110 110)"
          />
        ))}
        <circle cx="110" cy="110" r="46" fill="white" />
        <text x="110" y="120" textAnchor="middle" className="fill-slate-950 text-[28px] font-bold">{Math.round(totalShare)}</text>
      </svg>
    </div>
  );
}

function SortableHeader({ label, align = 'left' }: { label: string; align?: 'left' | 'right' }) {
  return (
    <th className={`px-5 py-3 font-semibold ${align === 'right' ? 'text-right' : ''}`}>
      <span className={`inline-flex items-center gap-1.5 ${align === 'right' ? 'justify-end' : ''}`}>
        {label}
        <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
      </span>
    </th>
  );
}

function StatusBadge({ status }: { status: FeeStatus }) {
  const variants: Record<FeeStatus, string> = {
    overdue: 'bg-red-50 text-red-700',
    partial: 'bg-amber-50 text-amber-700',
    paid: 'bg-emerald-50 text-emerald-700',
    due: 'bg-blue-50 text-blue-700',
  };

  const dots: Record<FeeStatus, string> = {
    overdue: 'bg-red-600',
    partial: 'bg-amber-700',
    paid: 'bg-emerald-600',
    due: 'bg-blue-600',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${variants[status]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dots[status]}`} />
      {status}
    </span>
  );
}

function getSessionContext(): SessionContext {
  if (typeof window === 'undefined') {
    return { token: '', subInstituteId: '', userId: '', academicYearId: '', hostName: '' };
  }

  try {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}') as Record<string, unknown>;
    const menuContext = JSON.parse(localStorage.getItem('menuContext') || '{}') as Record<string, unknown>;

    return {
      token: readString(userData.user_token ?? userData.token),
      subInstituteId: readString(userData.sub_institute_id ?? menuContext.sub_institute_id),
      userId: readString(userData.user_id ?? menuContext.user_id),
      academicYearId: readString(localStorage.getItem('selectedAcademicYear') || (userData.academic_year_id ?? userData.academicYearId)),
      hostName: readString(userData.host_name),
    };
  } catch {
    return { token: '', subInstituteId: '', userId: '', academicYearId: '', hostName: '' };
  }
}

function appendStudentSearchFilters(form: URLSearchParams, filters: StudentFetchFilters) {
  const query = filters.query?.trim() ?? '';

  if (query) {
    if (/^adm-/i.test(query)) {
      form.append('grno', query.replace(/^adm-\d{4}-?/i, '') || query);
    } else if (/^\d{10}$/.test(query)) {
      form.append('mobile', query);
    } else if (/^\d+$/.test(query)) {
      form.append('grno', query);
    } else {
      form.append('stu_name', query);
    }
  }

  if (filters.selectedSection) form.append('grade', filters.selectedSection);
  if (filters.selectedStandard) form.append('standard', filters.selectedStandard);
  if (filters.selectedDivision) form.append('division', filters.selectedDivision);
}

function appendStudentPaginationFilters(form: URLSearchParams, pageNumber: number) {
  const safePageNumber = Math.max(pageNumber, 1);
  const offset = (safePageNumber - 1) * PAGE_SIZE;

  form.append('page', String(safePageNumber));
  form.append('per_page', String(PAGE_SIZE));
  form.append('page_size', String(PAGE_SIZE));
  form.append('limit', String(PAGE_SIZE));
  form.append('offset', String(offset));
  form.append('start', String(offset));
  form.append('length', String(PAGE_SIZE));
  form.append('draw', String(safePageNumber));
  form.append('paginate', '1');
  form.append('pagination', '1');
  form.append('serverSide', '1');
}

function getCachedStudentPage(students: StudentFeeRow[], pageNumber: number): StudentFeeRow[] {
  if (students.length === 0) return [];
  return getLazyPageRows(students, pageNumber);
}

function getLazyPageRows(rows: StudentFeeRow[], pageNumber: number): StudentFeeRow[] {
  if (rows.length <= PAGE_SIZE) return rows;

  const startIndex = (Math.max(pageNumber, 1) - 1) * PAGE_SIZE;
  return rows.slice(startIndex, startIndex + PAGE_SIZE);
}

function hasMoreStudentPages({
  pageNumber,
  returnedRows,
  totalCount,
  cachedTotalCount,
}: {
  pageNumber: number;
  returnedRows: number;
  totalCount: number | null;
  cachedTotalCount: number;
}): boolean {
  if (totalCount != null) {
    return pageNumber * PAGE_SIZE < totalCount;
  }

  if (cachedTotalCount > 0) {
    return pageNumber * PAGE_SIZE < cachedTotalCount;
  }

  return returnedRows >= PAGE_SIZE;
}

async function readStudentsResponseProgressively(
  response: Response,
  handlers: { onRows: (rows: StudentFeeRow[]) => void },
  options: { stopAfterRows?: number } = {},
): Promise<{ payload: unknown; source: unknown; rows: StudentFeeRow[]; totalCount: number | null }> {
  if (!response.body) {
    const payload = await response.json();
    return getStudentRowsFromPayload(payload);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const streamedRows: StudentFeeRow[] = [];
  let stoppedAfterRows = false;
  const parser = createStudentRowsStreamParser((rows) => {
    const newRows = appendUniqueStudents(streamedRows, rows);
    if (newRows.length === streamedRows.length) return;

    const addedRows = newRows.slice(streamedRows.length);
    streamedRows.splice(0, streamedRows.length, ...newRows);
    handlers.onRows(addedRows);

    if (options.stopAfterRows && streamedRows.length >= options.stopAfterRows) {
      stoppedAfterRows = true;
      return false;
    }
  });
  let responseText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    if (!chunk) continue;

    responseText += chunk;
    const shouldContinue = parser.push(chunk);
    if (!shouldContinue && stoppedAfterRows) {
      await reader.cancel().catch(() => {});
      break;
    }
  }

  const tail = decoder.decode();
  if (tail && !stoppedAfterRows) {
    responseText += tail;
    parser.push(tail);
  }

  parser.flush();

  if (stoppedAfterRows) {
    return {
      payload: {},
      source: {},
      rows: streamedRows,
      totalCount: null,
    };
  }

  const payload = parseJsonPayload(responseText);
  const parsed = getStudentRowsFromPayload(payload);

  return {
    payload: parsed.payload,
    source: parsed.source,
    rows: parsed.rows.length > 0 ? parsed.rows : streamedRows,
    totalCount: parsed.totalCount,
  };
}

function createStudentRowsStreamParser(onRows: (rows: StudentFeeRow[]) => boolean | void) {
  let buffer = '';
  let scanIndex = 0;
  let arrayStarted = false;
  let arrayComplete = false;
  let stopped = false;
  let inString = false;
  let escaped = false;
  let objectDepth = 0;
  let itemStart = -1;
  let batch: unknown[] = [];

  const emitBatch = () => {
    if (batch.length === 0) return true;

    const rows = toStudentRows(batch);
    batch = [];
    if (rows.length > 0) {
      const shouldContinue = onRows(rows);
      if (shouldContinue === false) {
        stopped = true;
        return false;
      }
    }

    return true;
  };

  const push = (chunk: string) => {
    if (!chunk || arrayComplete || stopped) return false;

    buffer += chunk;

    if (!arrayStarted) {
      const arrayStart = findStudentArrayStart(buffer);
      if (arrayStart < 0) {
        buffer = trimPendingStudentArraySearchBuffer(buffer);
        return;
      }

      arrayStarted = true;
      scanIndex = arrayStart + 1;
    }

    for (; scanIndex < buffer.length; scanIndex += 1) {
      const character = buffer[scanIndex];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (character === '\\') {
          escaped = true;
        } else if (character === '"') {
          inString = false;
        }
        continue;
      }

      if (character === '"') {
        inString = true;
        continue;
      }

      if (itemStart < 0) {
        if (character === '{') {
          itemStart = scanIndex;
          objectDepth = 1;
        } else if (character === ']') {
          arrayComplete = true;
          scanIndex += 1;
          break;
        }
        continue;
      }

      if (character === '{') {
        objectDepth += 1;
      } else if (character === '}') {
        objectDepth -= 1;

        if (objectDepth === 0) {
          const itemText = buffer.slice(itemStart, scanIndex + 1);
          try {
            batch.push(JSON.parse(itemText));
          } catch {
            batch = [];
            arrayComplete = true;
            break;
          }

          itemStart = -1;

          if (batch.length >= STREAM_ROW_BATCH_SIZE) {
            if (!emitBatch()) {
              break;
            }
          }
        }
      }
    }

    compactStudentStreamBuffer();
    return !stopped;
  };

  const compactStudentStreamBuffer = () => {
    if (itemStart > 0) {
      buffer = buffer.slice(itemStart);
      scanIndex -= itemStart;
      itemStart = 0;
      return;
    }

    if (itemStart < 0 && scanIndex > 4096) {
      buffer = buffer.slice(scanIndex);
      scanIndex = 0;
    }
  };

  return {
    push,
    flush: emitBatch,
  };
}

function findStudentArrayStart(buffer: string): number {
  const firstContentIndex = buffer.search(/\S/);
  if (firstContentIndex >= 0 && buffer[firstContentIndex] === '[') {
    return firstContentIndex;
  }

  for (const key of STUDENT_STREAM_ARRAY_KEYS) {
    const token = `"${key}"`;
    const keyIndex = buffer.indexOf(token);
    if (keyIndex < 0) continue;

    let cursor = keyIndex + token.length;
    while (cursor < buffer.length && /\s/.test(buffer[cursor])) cursor += 1;
    if (buffer[cursor] !== ':') continue;

    cursor += 1;
    while (cursor < buffer.length && /\s/.test(buffer[cursor])) cursor += 1;
    if (buffer[cursor] === '[') return cursor;
  }

  return -1;
}

function trimPendingStudentArraySearchBuffer(buffer: string): string {
  const keyIndexes = STUDENT_STREAM_ARRAY_KEYS
    .map((key) => buffer.indexOf(`"${key}"`))
    .filter((index) => index >= 0);

  if (keyIndexes.length > 0) {
    return buffer.slice(Math.min(...keyIndexes));
  }

  return buffer.length > 4096 ? buffer.slice(-4096) : buffer;
}

function parseJsonPayload(value: string): unknown {
  const trimmedValue = value.trim().replace(/^\uFEFF/, '');
  return trimmedValue ? JSON.parse(trimmedValue) : {};
}

function getStudentRowsFromPayload(payload: unknown): { payload: unknown; source: unknown; rows: StudentFeeRow[]; totalCount: number | null } {
  const payloadRecord = asRecord(payload);
  const source = payloadRecord.data ?? payload;
  const sourceRecord = asRecord(source);
  const items = Array.isArray(source)
    ? source
    : sourceRecord.stu_data ?? sourceRecord.students ?? sourceRecord.rows ?? sourceRecord.list ?? [];
  const rows = toStudentRows(items);

  return {
    payload,
    source,
    rows,
    totalCount: readStudentTotalCount(payload, source, rows.length),
  };
}

function readStudentTotalCount(payload: unknown, source: unknown, rowsLength: number): number | null {
  const records = getDashboardRecords(payload, source);
  const totalCount = readFirstNumber(records, [
    'total',
    'count',
    'records_total',
    'recordsTotal',
    'records_filtered',
    'recordsFiltered',
    'iTotalRecords',
    'iTotalDisplayRecords',
    'total_records',
    'totalRecords',
    'total_students',
    'totalStudents',
    'student_count',
    'studentCount',
    'total_count',
    'totalCount',
  ]);

  if (totalCount === undefined || totalCount < rowsLength) return null;
  return Math.round(totalCount);
}

function appendUniqueStudents(current: StudentFeeRow[], next: StudentFeeRow[]): StudentFeeRow[] {
  if (next.length === 0) return current;

  const seenIds = new Set(current.map((student) => student.id));
  const newRows = next.filter((student) => {
    if (!student.id || seenIds.has(student.id)) return false;
    seenIds.add(student.id);
    return true;
  });

  return newRows.length > 0 ? [...current, ...newRows] : current;
}

function buildDashboardData(students: StudentFeeRow[], snapshot: DashboardSnapshot): DashboardData {
  const collectedThisTerm = snapshot.collectedThisTerm ?? getCollectedTotal(students);
  const outstandingTotal = snapshot.outstandingTotal ?? students.reduce((total, student) => total + student.pendingFees, 0);
  const calculatedTotal = students.reduce((total, student) => total + getStudentTotalFees(student), 0);
  const collectionBase = Math.max(calculatedTotal, collectedThisTerm + outstandingTotal);
  const collectionRate = snapshot.collectionRate ?? (collectionBase > 0 ? Math.round((collectedThisTerm / collectionBase) * 100) : 0);
  const defaulters = snapshot.defaulters ?? students.filter((student) => student.pendingFees > 0 && student.status !== 'paid').length;

  return {
    collectedThisTerm,
    outstandingTotal,
    collectionRate: normalizePercentage(collectionRate),
    defaulters,
    chartTrend: snapshot.chartTrend?.length ? snapshot.chartTrend : getCollectionTrend(students),
    headBreakdown: snapshot.headBreakdown?.length ? snapshot.headBreakdown : getHeadBreakdown(students),
    paymentMix: snapshot.paymentMix?.length ? snapshot.paymentMix : getPaymentMix(students),
  };
}

function hasDashboardSnapshotData(snapshot: DashboardSnapshot): boolean {
  return snapshot.collectedThisTerm !== undefined
    || snapshot.outstandingTotal !== undefined
    || snapshot.collectionRate !== undefined
    || snapshot.defaulters !== undefined
    || Boolean(snapshot.chartTrend?.length)
    || Boolean(snapshot.headBreakdown?.length)
    || Boolean(snapshot.paymentMix?.length);
}

function toDashboardSnapshot(payload: unknown, source: unknown): DashboardSnapshot {
  const records = getDashboardRecords(payload, source);

  return {
    collectedThisTerm: readFirstNumber(records, [
      'collected_this_term',
      'collectedThisTerm',
      'total_collected',
      'totalCollected',
      'collected',
      'paid_total',
      'paidTotal',
      'total_paid',
      'received_amount',
      'receivedAmount',
      'collection_amount',
      'collectionAmount',
    ]),
    outstandingTotal: readFirstNumber(records, [
      'outstanding',
      'outstanding_total',
      'outstandingTotal',
      'pending_fees',
      'pendingFees',
      'total_pending',
      'totalPending',
      'balance',
      'balance_amount',
      'due_amount',
    ]),
    collectionRate: normalizeOptionalPercentage(readFirstNumber(records, [
      'collection_rate',
      'collectionRate',
      'rate',
      'paid_percentage',
      'paidPercentage',
      'collection_percent',
      'collectionPercent',
    ])),
    defaulters: readFirstNumber(records, [
      'defaulters',
      'defaulter_count',
      'defaulterCount',
      'overdue_count',
      'overdueCount',
      'pending_students',
      'pendingStudents',
    ]),
    chartTrend: toChartPoints(readFirstArray(records, [
      'collection_trend',
      'collectionTrend',
      'monthly_collection',
      'monthlyCollection',
      'collection_vs_target',
      'collectionVsTarget',
      'chart_trend',
      'chartTrend',
    ])),
    headBreakdown: toHeadBreakdown(readFirstArray(records, [
      'head_breakdown',
      'headBreakdown',
      'head_wise',
      'headWise',
      'fee_head_breakdown',
      'feeHeadBreakdown',
      'fee_heads',
      'feeHeads',
    ])),
    paymentMix: toPaymentMix(readFirstArray(records, [
      'payment_mix',
      'paymentMix',
      'payment_mode_mix',
      'paymentModeMix',
      'payment_modes',
      'paymentModes',
      'mode_mix',
      'modeMix',
    ])),
  };
}

function toStudentRows(items: unknown): StudentFeeRow[] {
  if (!Array.isArray(items)) return [];

  return items.map((item, index) => {
    const record = asRecord(item);
    const firstName = readString(record.first_name);
    const middleName = readString(record.middle_name);
    const lastName = readString(record.last_name);
    const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ');
    const stddiv = readString(record.stddiv);
    const stddivParts = stddiv ? stddiv.split(/\s*\/\s*/) : [];
    const pendingAmount = readNumber(record.pending_fees ?? record.pendingFees ?? record.remaining ?? record.balance ?? record.bkoff ?? record.pending ?? record.outstanding ?? record.due_amount ?? record.amount);
    const paidAmount = readNumber(record.paid_fees ?? record.paidFees ?? record.paid_amount ?? record.paidAmount ?? record.paid ?? record.total_paid ?? record.received_amount ?? record.receivedAmount ?? record.collection_amount ?? record.collected_amount ?? record.collected);
    const explicitTotal = readNumber(record.total_fees ?? record.totalFees ?? record.total_amount ?? record.totalAmount ?? record.fees ?? record.final_fee ?? record.demand_amount ?? record.assigned_fee);
    const totalAmount = explicitTotal || paidAmount + pendingAmount || pendingAmount;
    const dueDateRaw = readString(record.due_date ?? record.dueDate ?? record.last_date ?? record.fee_due_date);
    const collectionDateRaw = readString(record.collection_date ?? record.collectionDate ?? record.receipt_date ?? record.receiptDate ?? record.payment_date ?? record.paymentDate ?? record.paid_date ?? record.paidDate);

    return {
      id: readString(record.id ?? record.student_id ?? record.studentId ?? record.unique_id ?? record.uniqueid),
      name: readString(record.student_name ?? record.name ?? record.full_name ?? fullName),
      grNo: readString(record.gr_no ?? record.grNo ?? record.gr_number ?? record.enrollment_no ?? record.enrollment),
      admissionNo: readString(record.admission_no ?? record.admissionNo ?? record.uniqueid ?? record.unique_id ?? record.enrollment_no ?? record.enrollment),
      standard: readString(record.standard ?? record.standard_name ?? record.class_name) || stddivParts[0],
      section: readString(record.section ?? record.section_name ?? record.division ?? record.division_name) || stddivParts[1],
      mobile: readString(record.mobile ?? record.phone ?? record.contact_no ?? record.mobile_number),
      feeHead: readString(record.fee_head ?? record.feeHead ?? record.particular ?? record.particular_name ?? record.fee_type ?? record.head) || fallbackFeeHead(index),
      dueDate: formatDueDate(dueDateRaw),
      dueDateRaw,
      collectionDateRaw,
      totalFees: totalAmount,
      paidFees: paidAmount,
      pendingFees: pendingAmount,
      paymentMode: readString(record.payment_mode ?? record.paymentMode ?? record.PAYMENT_MODE ?? record.mode ?? record.last_payment_mode ?? record.receipt_payment_mode),
      status: toFeeStatus(record.status ?? record.payment_status ?? record.fee_status, pendingAmount, index),
    };
  }).filter((student) => student.id);
}

function getDashboardRecords(...values: unknown[]): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = [];
  const visited = new Set<unknown>();
  const nestedKeys = [
    'data',
    'summary',
    'dashboard',
    'metrics',
    'kpi',
    'kpis',
    'totals',
    'statistics',
    'stats',
    'collection_summary',
    'collectionSummary',
    'fee_summary',
    'feeSummary',
  ];

  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value) || visited.has(value)) return;

    visited.add(value);
    const record = value as Record<string, unknown>;
    records.push(record);

    nestedKeys.forEach((key) => {
      const nested = readRecordValue(record, [key]);
      if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
        visit(nested);
      }
    });
  };

  values.forEach(visit);
  return records;
}

function readRecordValue(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      return record[key];
    }
  }

  const normalizedKeys = Object.keys(record).reduce<Record<string, string>>((lookup, key) => {
    lookup[normalizeRecordKey(key)] = key;
    return lookup;
  }, {});

  for (const key of keys) {
    const matchedKey = normalizedKeys[normalizeRecordKey(key)];
    if (matchedKey) {
      return record[matchedKey];
    }
  }

  return undefined;
}

function readFirstNumber(records: Record<string, unknown>[], keys: string[]): number | undefined {
  for (const record of records) {
    const value = readOptionalNumber(readRecordValue(record, keys));
    if (value !== undefined) return value;
  }

  return undefined;
}

function readFirstArray(records: Record<string, unknown>[], keys: string[]): unknown[] {
  for (const record of records) {
    const value = readRecordValue(record, keys);
    if (Array.isArray(value)) return value;

    const nestedRecord = asRecord(value);
    const nestedArray = nestedRecord.data ?? nestedRecord.items ?? nestedRecord.rows ?? nestedRecord.list;
    if (Array.isArray(nestedArray)) return nestedArray;
  }

  return [];
}

function normalizeRecordKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getCollectedTotal(students: StudentFeeRow[]): number {
  return students.reduce((total, student) => total + getStudentPaidFees(student), 0);
}

function getStudentPaidFees(student: StudentFeeRow): number {
  const paidFees = readNumber(student.paidFees);
  if (paidFees > 0) return paidFees;

  const totalFees = readNumber(student.totalFees);
  if (student.status === 'paid') return totalFees;
  if (student.status === 'partial') return Math.max(totalFees - student.pendingFees, 0);

  return 0;
}

function getStudentTotalFees(student: StudentFeeRow): number {
  const totalFees = readNumber(student.totalFees);
  if (totalFees > 0) return totalFees;

  return getStudentPaidFees(student) + student.pendingFees;
}

function getCollectionTrend(students: StudentFeeRow[]): ChartPoint[] {
  type TrendBucket = { month: string; collected: number; target: number; sortValue: number };

  const grouped = new Map<string, TrendBucket>();

  students.forEach((student) => {
    const date = parseFeeDate(student.collectionDateRaw || student.dueDateRaw || student.dueDate);
    const key = date ? `${date.getFullYear()}-${date.getMonth()}` : 'current';
    const current = grouped.get(key) ?? {
      month: date ? date.toLocaleDateString('en-IN', { month: 'short' }) : 'Current',
      collected: 0,
      target: 0,
      sortValue: date ? new Date(date.getFullYear(), date.getMonth(), 1).getTime() : Number.MAX_SAFE_INTEGER,
    };

    current.collected += getStudentPaidFees(student) / 100000;
    current.target += getStudentTotalFees(student) / 100000;
    grouped.set(key, current);
  });

  const rows = Array.from(grouped.values())
    .sort((first, second) => first.sortValue - second.sortValue)
    .slice(-6)
    .map((item) => ({
      month: item.month,
      collected: roundChartValue(item.collected),
      target: roundChartValue(item.target),
    }));

  return rows.length ? rows : [{ month: 'Current', collected: 0, target: 0 }];
}

function toChartPoints(items: unknown[]): ChartPoint[] {
  return items.map((item, index) => {
    const record = asRecord(item);
    const collectedAmount = readFirstNumber([record], [
      'collected',
      'collection',
      'collected_amount',
      'collectedAmount',
      'paid',
      'paid_amount',
      'paidAmount',
      'received_amount',
      'receivedAmount',
      'value',
    ]) ?? 0;
    const pendingAmount = readFirstNumber([record], [
      'pending',
      'pending_amount',
      'pendingAmount',
      'outstanding',
      'balance',
    ]) ?? 0;
    const targetAmount = readFirstNumber([record], [
      'target',
      'target_amount',
      'targetAmount',
      'total',
      'total_amount',
      'totalAmount',
      'demand',
      'demand_amount',
    ]) ?? collectedAmount + pendingAmount;

    return {
      month: getChartPointLabel(record, index),
      collected: roundChartValue(amountToLakhs(collectedAmount)),
      target: roundChartValue(amountToLakhs(targetAmount)),
    };
  }).filter((item) => item.collected > 0 || item.target > 0).slice(-6);
}

function getChartPointLabel(record: Record<string, unknown>, index: number): string {
  const rawLabel = readString(readRecordValue(record, [
    'month',
    'label',
    'name',
    'period',
    'date',
    'due_date',
    'collection_date',
  ])).trim();

  if (!rawLabel) return `M${index + 1}`;

  const date = parseFeeDate(rawLabel);
  if (date) return date.toLocaleDateString('en-IN', { month: 'short' });

  return rawLabel.length > 12 ? rawLabel.slice(0, 12) : rawLabel;
}

function toHeadBreakdown(items: unknown[]): HeadBreakdown[] {
  return items.map((item, index) => {
    const record = asRecord(item);
    const label = normalizeFeeHeadLabel(readString(readRecordValue(record, [
      'label',
      'fee_head',
      'feeHead',
      'head',
      'particular',
      'name',
      'title',
    ])) || `Head ${index + 1}`);
    const collectedAmount = readFirstNumber([record], [
      'collected',
      'collected_amount',
      'collectedAmount',
      'paid',
      'paid_amount',
      'paidAmount',
      'received_amount',
      'receivedAmount',
    ]) ?? 0;
    const totalAmount = readFirstNumber([record], [
      'target',
      'total',
      'total_amount',
      'totalAmount',
      'demand',
      'demand_amount',
    ]) ?? 0;
    const pendingAmount = readFirstNumber([record], [
      'pending',
      'pending_amount',
      'pendingAmount',
      'outstanding',
      'balance',
    ]) ?? Math.max(totalAmount - collectedAmount, 0);

    return {
      label,
      collected: roundChartValue(amountToLakhs(collectedAmount)),
      pending: roundChartValue(amountToLakhs(pendingAmount)),
    };
  }).filter((item) => item.collected > 0 || item.pending > 0).slice(0, 6);
}

function getPaymentMix(students: StudentFeeRow[]): PaymentMix[] {
  const grouped = new Map<string, number>();

  students.forEach((student) => {
    const paidFees = getStudentPaidFees(student);
    if (paidFees <= 0) return;

    const label = student.paymentMode || 'Unspecified';
    grouped.set(label, (grouped.get(label) ?? 0) + paidFees);
  });

  return normalizePaymentMix(Array.from(grouped.entries()).map(([label, amount]) => ({ label, amount })));
}

function toPaymentMix(items: unknown[]): PaymentMix[] {
  const rows = items.map((item, index) => {
    const record = asRecord(item);
    const label = readString(readRecordValue(record, [
      'label',
      'payment_mode',
      'paymentMode',
      'mode',
      'name',
      'title',
    ])) || `Mode ${index + 1}`;
    const amount = readFirstNumber([record], [
      'value',
      'percentage',
      'percent',
      'share',
      'amount',
      'total',
      'collected',
      'paid',
    ]) ?? 0;

    return { label, amount };
  });

  return normalizePaymentMix(rows);
}

function normalizePaymentMix(rows: Array<{ label: string; amount: number }>): PaymentMix[] {
  const positiveRows = rows.filter((item) => item.amount > 0);
  const total = positiveRows.reduce((sum, item) => sum + item.amount, 0);
  if (total <= 0) return [];

  let remaining = 100;

  return positiveRows.map((item, index) => {
    const isLast = index === positiveRows.length - 1;
    const value = isLast ? remaining : Math.max(0, Math.round((item.amount / total) * 100));
    remaining -= value;

    return {
      label: item.label,
      value,
      color: paymentMixColors[index % paymentMixColors.length],
    };
  });
}

function normalizeFeeHeadLabel(value: string): string {
  const normalized = value.replace(/\u00c2/g, '').trim();
  return normalized.split(/[·•|-]/)[0]?.trim() || normalized || 'Fees';
}

function parseFeeDate(value: unknown): Date | null {
  const rawValue = readString(value).trim();
  if (!rawValue || rawValue === '-') return null;

  const numericDate = rawValue.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (numericDate) {
    const [, day, month, year] = numericDate;
    const fullYear = Number(year.length === 2 ? `20${year}` : year);
    const date = new Date(fullYear, Number(month) - 1, Number(day));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(rawValue);
  return Number.isNaN(date.getTime()) ? null : date;
}

function amountToLakhs(value: number): number {
  return Math.abs(value) >= 1000 ? value / 100000 : value;
}

function roundChartValue(value: number): number {
  return Math.round(value * 10) / 10;
}

function normalizeOptionalPercentage(value: number | undefined): number | undefined {
  return value === undefined ? undefined : normalizePercentage(value);
}

function normalizePercentage(value: number): number {
  const percentage = value > 0 && value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, Math.round(percentage)));
}

function toFeeStatus(value: unknown, amount: number, index: number): FeeStatus {
  const normalizedValue = readString(value).trim().toLowerCase();

  if (normalizedValue.includes('unpaid')) return amount <= 0 ? 'paid' : 'due';
  if (normalizedValue.includes('partial')) return 'partial';
  if (normalizedValue.includes('over')) return 'overdue';
  if (normalizedValue.includes('pending')) return 'due';
  if (normalizedValue.includes('paid')) return 'paid';
  if (normalizedValue.includes('due')) return 'due';
  if (amount <= 0) return 'paid';

  return index % 5 === 0 ? 'partial' : index % 4 === 0 ? 'due' : 'overdue';
}

function formatDueDate(value: unknown): string {
  const rawValue = readString(value);
  if (!rawValue) return '-';

  const date = new Date(rawValue);
  if (Number.isNaN(date.getTime())) return rawValue;

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getClassLabel(student: StudentFeeRow): string {
  const standard = student.standard ? student.standard.replace(/^Grade\s+/i, '') : '';
  const section = student.section ? student.section.replace(/^Section\s+/i, '') : '';

  if (!standard && !section) return '';
  return `Grade ${standard}${section ? `-${section}` : ''}`;
}

function getSingleDropdownValue(value: DropdownValue | undefined): string {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

function matchesStudentStandard(student: StudentFeeRow, selectedStandardId: string, selectedStandardName: string): boolean {
  const studentStandard = normalizeDropdownCompareValue(student.standard);
  const selectedId = normalizeDropdownCompareValue(selectedStandardId);
  const selectedName = normalizeDropdownCompareValue(selectedStandardName);

  return studentStandard === selectedId || (!!selectedName && studentStandard === selectedName);
}

function matchesStudentDivision(student: StudentFeeRow, selectedDivisionId: string, selectedDivisionName: string): boolean {
  const studentDivision = normalizeDropdownCompareValue(student.section);
  const selectedId = normalizeDropdownCompareValue(selectedDivisionId);
  const selectedName = normalizeDropdownCompareValue(selectedDivisionName);

  return studentDivision === selectedId || (!!selectedName && studentDivision === selectedName);
}

function normalizeDropdownCompareValue(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^grade\s+/i, '')
    .replace(/^standard\s+/i, '')
    .replace(/^section\s+/i, '')
    .replace(/\s+/g, '');
}

function getHeadBreakdown(students: StudentFeeRow[]): HeadBreakdown[] {
  const grouped = new Map<string, HeadBreakdown>();

  students.forEach((student) => {
    const label = normalizeFeeHeadLabel(student.feeHead);
    const current = grouped.get(label) ?? { label, collected: 0, pending: 0 };

    current.collected += getStudentPaidFees(student) / 100000;
    current.pending += student.pendingFees / 100000;

    grouped.set(label, current);
  });

  return Array.from(grouped.values())
    .sort((first, second) => (second.collected + second.pending) - (first.collected + first.pending))
    .slice(0, 6)
    .map((item) => ({
      label: item.label,
      collected: roundChartValue(item.collected),
      pending: roundChartValue(item.pending),
    }));
}

function fallbackFeeHead(index: number): string {
  const feeHeads = ['Tuition · Term 2', 'Transport · Term 2', 'Lab · Term 2', 'Exam · Term 2', 'Hostel · Term 2', 'Activity · Term 2'];
  return feeHeads[index % feeHeads.length];
}

function shortenLabel(value: string): string {
  return value.length > 9 ? `${value.slice(0, 7)}.` : value;
}

function formatLakhs(value: number): string {
  return `${currencySymbol}${(value / 100000).toFixed(value >= 1000000 ? 1 : 1)}L`;
}

function formatAxisValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function readString(value: unknown): string {
  return value == null ? '' : String(value);
}

function readNumber(value: unknown): number {
  return readOptionalNumber(value) ?? 0;
}

function readOptionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === 'bigint') {
    return Number(value);
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) return undefined;

  const lowerValue = trimmedValue.toLowerCase();
  const multiplier = lowerValue.includes('crore') || /\bcr\b/.test(lowerValue)
    ? 10000000
    : lowerValue.includes('lakh') || lowerValue.includes('lac') || /\bl\b/.test(lowerValue)
      ? 100000
      : /\bk\b/.test(lowerValue) || lowerValue.includes('thousand')
        ? 1000
        : 1;
  const numericMatch = trimmedValue.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  if (!numericMatch) return undefined;

  const numericValue = Number(numericMatch[0]) * multiplier;
  return Number.isFinite(numericValue) ? numericValue : undefined;
}
