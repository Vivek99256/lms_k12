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
  Users,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  label: string;
  amount: number;
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
  todayCollection: number;
  totalPaidFees: number;
  totalPendingFees: number;
  paidStudents: number;
  pendingStudents: number;
  collectionRate: number;
  dailyTrend: ChartPoint[];
  headBreakdown: HeadBreakdown[];
  paymentMix: PaymentMix[];
};

type StudentFetchFilters = {
  query?: string;
  selectedSection?: string;
  selectedStandard?: string;
  selectedDivision?: string;
  fromDate?: string;
  toDate?: string;
  status?: string;
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

const paymentMixColors = ['#4f46e5', '#0f9b6e', '#2563eb', '#e17a00', '#0891b2', '#be185d'];

export default function FeesCollectPage() {
  const router = useRouter();
  const fetchRequestIdRef = useRef(0);
  const currentFetchFiltersRef = useRef<StudentFetchFilters>({});
  const cachedStudentsRef = useRef<StudentFeeRow[]>([]);
  const [students, setStudents] = useState<StudentFeeRow[]>([]);
  const [dashboardRows, setDashboardRows] = useState<StudentFeeRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [academicFilters, setAcademicFilters] = useState<Partial<SearchDropdownValues>>({
    section: '',
    standard: '',
    division: '',
  });
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState(ALL_FILTER_VALUE);
  const [selectedStandardName, setSelectedStandardName] = useState('');
  const [selectedDivisionName, setSelectedDivisionName] = useState('');
  const [feeHeadFilter] = useState(ALL_FILTER_VALUE);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreStudents, setHasMoreStudents] = useState(false);
  const [totalStudentCount, setTotalStudentCount] = useState<number | null>(null);
  const [collectingStudentId, setCollectingStudentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dashboardSnapshot, setDashboardSnapshot] = useState<DashboardSnapshot>({});
  const [session] = useState(getSessionContext);

  const clearStudentData = useCallback((message: string) => {
    cachedStudentsRef.current = [];
    setStudents([]);
    setDashboardRows([]);
    setDashboardSnapshot({});
    setSelectedStudentIds([]);
    setCurrentPage(1);
    setHasMoreStudents(false);
    setTotalStudentCount(0);
    setError(message);
  }, []);

  const fetchDashboardRows = useCallback(async (filters: StudentFetchFilters = {}) => {
    if (!session.subInstituteId) {
      setDashboardRows([]);
      return;
    }

    setDashboardLoading(true);

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
        setDashboardRows([]);
        return;
      }

      const form = new URLSearchParams();
      form.append('sub_institute_id', String(subInstituteId));
      form.append('syear', String(academicYearId));
      appendStudentSearchFilters(form, filters);
      if (includeInactive) form.append('include_inactive', '1');
      form.append('type', 'API');

      const response = await fetch(`${hostName.replace(/\/$/, '')}/fees/fees_collect/show_student`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: form.toString(),
      });

      if (!response.ok) {
        setDashboardRows([]);
        return;
      }

      const result = await readStudentsResponseProgressively(response, { onRows: () => {} });
      const snapshot = toDashboardSnapshot(result.payload, result.source);
      setDashboardRows(result.rows);
      setDashboardSnapshot(snapshot);
      if (result.totalCount != null && totalStudentCount == null) {
        setTotalStudentCount(result.totalCount);
      }
    } catch {
      setDashboardRows([]);
    } finally {
      setDashboardLoading(false);
    }
  }, [includeInactive, session, totalStudentCount]);

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
      clearStudentData('Session data is missing.');
      return;
    }

    setError(null);

    if (append) {
      setLoadingMore(true);
    } else {
      void fetchDashboardRows(filters);
      currentFetchFiltersRef.current = filters;
      cachedStudentsRef.current = [];
      setLoading(true);
      setStudents([]);
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
        clearStudentData('Session data is missing.');
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
      if (hasDashboardSnapshotData(responseSnapshot)) setDashboardSnapshot(responseSnapshot);
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
      if (append) {
        setHasMoreStudents(false);
        setError(message);
      } else {
        clearStudentData(message);
      }
    } finally {
      if (fetchRequestIdRef.current === requestId) {
        if (append) {
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
      }
    }
  }, [clearStudentData, fetchDashboardRows, includeInactive, session]);

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

  const applyLocalFilters = useCallback((rows: StudentFeeRow[]) => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return rows.filter((student) => {
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
      const date = parseFeeDate(student.collectionDateRaw || student.dueDateRaw || student.dueDate);
      const matchesDateRange = isWithinDateRange(date, fromDate, toDate);

      return matchesSearch && matchesStandard && matchesDivision && matchesFeeHead && matchesStatus && matchesDateRange;
    });
  }, [feeHeadFilter, fromDate, searchTerm, selectedDivisionId, selectedDivisionName, selectedStandardId, selectedStandardName, statusFilter, toDate]);

  const filteredStudents = useMemo(() => applyLocalFilters(students), [applyLocalFilters, students]);
  const dashboardSourceRows = useMemo(() => {
    if (dashboardRows.length > 0) return dashboardRows;
    if (dashboardLoading) return [];
    return students;
  }, [dashboardLoading, dashboardRows, students]);
  const filteredDashboardRows = useMemo(
    () => applyLocalFilters(dashboardSourceRows),
    [applyLocalFilters, dashboardSourceRows]
  );

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
  const dashboardData = useMemo(() => buildDashboardData(filteredDashboardRows, dashboardSnapshot), [dashboardSnapshot, filteredDashboardRows]);
  const availableStatuses = useMemo(
    () => Array.from(new Set(dashboardSourceRows.map((student) => student.status))),
    [dashboardSourceRows]
  );
  const totalPayableFees = dashboardData.totalPaidFees + dashboardData.totalPendingFees;
  const hasDailyTrend = dashboardData.dailyTrend.length > 0;
  const hasDashboardData = dashboardData.todayCollection > 0
    || dashboardData.totalPaidFees > 0
    || dashboardData.totalPendingFees > 0
    || dashboardData.paidStudents > 0
    || dashboardData.pendingStudents > 0
    || dashboardData.dailyTrend.length > 0
    || dashboardData.headBreakdown.length > 0
    || dashboardData.paymentMix.length > 0;
  const summaryCards = [
    {
      title: 'Total Payable Fees',
      value: currencyFormatter.format(totalPayableFees),
      icon: <Wallet className="h-4 w-4" />,
    },
    {
      title: 'Total Collected Fees',
      value: currencyFormatter.format(dashboardData.totalPaidFees),
      icon: <Banknote className="h-4 w-4" />,
    },
    {
      title: 'Total Pending Fees',
      value: currencyFormatter.format(dashboardData.totalPendingFees),
      icon: <AlertCircle className="h-4 w-4" />,
    },
    {
      title: 'Paid Students',
      value: String(dashboardData.paidStudents),
      icon: <Users className="h-4 w-4" />,
    },
    {
      title: 'Pending Students',
      value: String(dashboardData.pendingStudents),
      icon: <AlertCircle className="h-4 w-4" />,
    },
    {
      title: 'Collection Rate',
      value: `${dashboardData.collectionRate}%`,
      icon: <Target className="h-4 w-4" />,
    },
  ];

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
    <div className="min-h-screen ">
      <div className="mx-auto max-w-[1500px] space-y-5 p-4 md:p-5 lg:p-6">
        <Card className="overflow-hidden border-slate-200/80 bg-white/95 shadow-sm ring-1 ring-slate-200/70">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle className="text-lg font-semibold text-slate-900">Fees Collection Dashboard</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4 pt-4">
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                fetchStudents({
                  query: searchTerm,
                  selectedSection: getSingleDropdownValue(academicFilters.section),
                  selectedStandard: getSingleDropdownValue(academicFilters.standard),
                  selectedDivision: getSingleDropdownValue(academicFilters.division),
                  fromDate,
                  toDate,
                  status: statusFilter === ALL_FILTER_VALUE ? '' : statusFilter,
                });
              }}
            >
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(360px,1.9fr)_minmax(180px,1fr)_minmax(180px,1fr)_minmax(180px,1fr)]">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-600">Search student</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={searchTerm}
                      onChange={(event) => {
                        setSearchTerm(event.target.value);
                        setCurrentPage(1);
                      }}
                      placeholder="Search student"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-4 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[var(--primary-blue)] focus:bg-white focus:ring-2 focus:ring-blue-500/15"
                    />
                  </div>
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
                  className="w-130 grid-cols-1 gap-4 sm:grid-cols-3 xl:grid-cols-3 [&>div]:min-w-0 [&_label]:text-xs [&_label]:font-semibold [&_label]:text-slate-600 [&_select]:h-11 [&_select]:min-w-0 [&_select]:w-full [&_select]:rounded-xl [&_select]:border-slate-200 [&_select]:bg-slate-50/70 [&_select]:pr-10 [&_select]:text-sm"
                  onChange={handleAcademicDropdownChange}
                  onStandardChange={handleStandardChange}
                  onDivisionChange={handleDivisionChange}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_minmax(160px,0.7fr)_auto_auto]">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">From date</label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(event) => {
                      setFromDate(event.target.value);
                      setCurrentPage(1);
                    }}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-sm text-slate-900 outline-none focus:border-[var(--primary-blue)] focus:bg-white focus:ring-2 focus:ring-blue-500/15"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">To date</label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(event) => {
                      setToDate(event.target.value);
                      setCurrentPage(1);
                    }}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-sm text-slate-900 outline-none focus:border-[var(--primary-blue)] focus:bg-white focus:ring-2 focus:ring-blue-500/15"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(event) => {
                      setStatusFilter(event.target.value);
                      setCurrentPage(1);
                    }}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 pr-10 text-sm text-slate-900 outline-none focus:border-[var(--primary-blue)] focus:bg-white focus:ring-2 focus:ring-blue-500/15"
                  >
                    <option value={ALL_FILTER_VALUE}>All</option>
                    {availableStatuses.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end">
                  <label className="flex h-11 w-full cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-xs font-semibold text-slate-700 md:w-auto md:min-w-[132px]">
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
                </div>

                <div className="flex items-end">
                  <Button type="submit" disabled={loading || dashboardLoading} className="h-11 w-full rounded-xl bg-[var(--primary-blue)] px-5 text-sm text-white hover:bg-[color-mix(in_srgb,var(--primary-blue),#000_12%)] md:w-auto md:min-w-[176px]">
                    {(loading || dashboardLoading) ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Search className="mr-1.5 h-3.5 w-3.5" />}
                    Apply filters
                  </Button>
                </div>
              </div>
            </form>

            {error && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {error}
              </div>
            )}

            {hasDashboardData ? (
              <div className="space-y-4">
                <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                  {summaryCards.map((card) => (
                    <MetricCard key={card.title} title={card.title} value={card.value} icon={card.icon} />
                  ))}
                </section>

                <section className={`grid gap-4 ${hasDailyTrend ? 'xl:grid-cols-[1.15fr_1fr]' : 'grid-cols-1'}`}>
                  <ChartCard title="Collected vs Pending Fees" subtitle="Calculated directly from the current API response.">
                    <PaidPendingComparisonChart
                      paid={dashboardData.totalPaidFees}
                      pending={dashboardData.totalPendingFees}
                      totalPayable={totalPayableFees}
                      paidStudents={dashboardData.paidStudents}
                      pendingStudents={dashboardData.pendingStudents}
                      trendData={dashboardData.dailyTrend}
                    />
                  </ChartCard>

                  {hasDailyTrend ? (
                    <ChartCard title="Daily Fee Collection Trend" subtitle="Shown only when date-wise collection transactions exist.">
                      <DailyCollectionTrendChart data={dashboardData.dailyTrend} />
                    </ChartCard>
                  ) : null}
                </section>
              </div>
            ) : (
              <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 text-center">
                <p className="text-sm font-medium text-slate-700">No collection transactions found for the selected filters</p>
                <p className="mt-1 max-w-xl text-sm text-slate-500">
                  We could not find usable fee collection or pending fee records for the current filter combination.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <section className="overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-200/70">
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Fee collection details</h2>
                <p className="mt-1 text-sm text-slate-500">Student-wise fee records from the existing collection workflow.</p>
              </div>
              <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                {filteredStudents.length} visible
              </div>
            </div>
            <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-xs font-medium text-slate-600 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Page {safeCurrentPage} of {pageCount} • {pageStartIndex}-{pageEndIndex} visible
                </span>
                {(loadingMore || (loading && students.length > 0)) && (
                  <span className="inline-flex items-center gap-1.5 text-[var(--primary-blue)]" aria-live="polite">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {loadingMore ? 'Loading next 10 records...' : 'Refreshing current records...'}
                  </span>
                )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/90 text-xs font-semibold uppercase tracking-wide text-slate-600">
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
                    <tr key={student.id} className="border-b border-slate-100 odd:bg-white even:bg-slate-50/50 hover:bg-sky-50/40">
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selectedStudentIds.includes(student.id)}
                          onChange={(event) => toggleStudentSelection(student.id, event.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 accent-[var(--primary-blue)]"
                        />
                      </td>
                      <td className="px-5 py-3">
                        <div className="space-y-1">
                          <p className="font-semibold text-slate-950">{student.name || '-'}</p>
                          <p className="text-xs text-slate-500">{student.admissionNo || student.grNo || '-'}</p>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-950">{getClassLabel(student) || '-'}</td>
                      <td className="px-5 py-3 text-slate-950">
                        <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                          {student.feeHead || '-'}
                        </div>
                      </td>
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

          <div className="flex flex-col gap-3 border-t border-slate-100 bg-white px-4 py-3 text-sm text-slate-700 md:flex-row md:items-center md:justify-between">
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
  icon,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-700">{title}</p>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-sky-100 bg-sky-50 text-sky-700">
          {icon}
        </div>
      </div>
      <p className="mt-4 text-2xl font-bold leading-none text-slate-950">{value}</p>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>
      <div className="p-5">
        {children}
      </div>
    </div>
  );
}

function DailyCollectionTrendChart({ data }: { data: ChartPoint[] }) {
  if (data.length === 0) {
    return <EmptyChartState message="No fee collection data available" />;
  }

  const width = 520;
  const height = 180;
  const padding = { top: 18, right: 20, bottom: 34, left: 34 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const highestValue = Math.max(0, ...data.map((item) => item.amount));
  const maxValue = Math.max(1, Math.ceil(highestValue / 5) * 5);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => Math.round(maxValue * ratio * 10) / 10);
  const buildPoints = data
    .map((item, index) => {
      const x = padding.left + (plotWidth / Math.max(data.length - 1, 1)) * index;
      const y = padding.top + plotHeight - (item.amount / maxValue) * plotHeight;
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
        <polyline points={buildPoints} fill="none" stroke="#2563eb" strokeWidth="2.8" />
        {data.map((item, index) => {
          const x = padding.left + (plotWidth / Math.max(data.length - 1, 1)) * index;
          const amountY = padding.top + plotHeight - (item.amount / maxValue) * plotHeight;

          return (
            <g key={item.label}>
              <circle cx={x} cy={amountY} r="3.2" fill="white" stroke="#2563eb" strokeWidth="2" />
              <text x={x} y={height - 12} textAnchor="middle" className="fill-slate-500 text-[10px]">{item.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function PaidPendingComparisonChart({
  paid,
  pending,
  totalPayable,
  paidStudents,
  pendingStudents,
  trendData,
}: {
  paid: number;
  pending: number;
  totalPayable: number;
  paidStudents: number;
  pendingStudents: number;
  trendData: ChartPoint[];
}) {
  return (
    <CompactPaidPendingComparisonChart
      paid={paid}
      pending={pending}
      totalPayable={totalPayable}
      paidStudents={paidStudents}
      pendingStudents={pendingStudents}
      trendData={trendData}
    />
  );
}

/*
function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}

function CompactPaidPendingComparisonChart({
  paid,
  pending,
  totalPayable,
  paidStudents,
  pendingStudents,
  trendData,
}: {
  paid: number;
  pending: number;
  totalPayable: number;
  paidStudents: number;
  pendingStudents: number;
  trendData: ChartPoint[];
}) {
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const rows = [
    {
      label: 'Collected',
      amount: paid,
      students: paidStudents,
      color: '#059669',
      percentage: totalPayable > 0 ? Math.round((paid / totalPayable) * 100) : 0,
    },
    {
      label: 'Pending',
      amount: pending,
      students: pendingStudents,
      color: '#d97706',
      percentage: totalPayable > 0 ? Math.round((pending / totalPayable) * 100) : 0,
    },
  ].filter((row) => row.amount > 0);

  if (paid <= 0 && pending <= 0) {
    return <EmptyChartState message="No fee collection data available" />;
  }

  const radius = 72;
  const circumference = 2 * Math.PI * radius;
  let runningOffset = 0;
  const segments = rows.map((row) => {
    const dash = totalPayable > 0 ? (row.amount / totalPayable) * circumference : 0;
    const segment = { ...row, dash, offset: runningOffset };
    runningOffset += dash;
    return segment;
  });
  const activeSegment = segments.find((segment) => segment.label === activeLabel) ?? null;
  const trend = getCollectionTrendIndicator(trendData);

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-center">
      <div className="relative mx-auto w-full max-w-[240px]">
        <svg viewBox="0 0 220 220" className="h-[220px] w-full">
          <circle cx="110" cy="110" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="28" />
          {segments.map((segment) => (
            <circle
              key={segment.label}
              cx="110"
              cy="110"
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={activeLabel === segment.label ? 34 : 28}
              strokeDasharray={`${segment.dash} ${circumference - segment.dash}`}
              strokeDashoffset={-segment.offset}
              strokeLinecap="round"
              transform="rotate(-90 110 110)"
              className="cursor-pointer transition-all"
              onMouseEnter={() => setActiveLabel(segment.label)}
              onMouseLeave={() => setActiveLabel(null)}
            />
          ))}
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Total Payable</p>
          <p className="mt-2 text-xl font-bold text-slate-950">{currencyFormatter.format(totalPayable)}</p>
          <p className="mt-1 text-xs text-slate-500">{Math.round((paid / Math.max(totalPayable, 1)) * 100)}% collected</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          {rows.map((row) => (
            <div key={row.label} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} />
              <span>{row.label}</span>
            </div>
          ))}
          {trend ? (
            <div className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${trend.direction === 'up' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              <span>{trend.direction === 'up' ? '▲' : '▼'}</span>
              <span>{trend.label}</span>
            </div>
          ) : null}
        </div>

        <div className="grid gap-3">
          {rows.map((row) => {
            const isActive = activeLabel === row.label;
            return (
              <button
                key={row.label}
                type="button"
                onMouseEnter={() => setActiveLabel(row.label)}
                onMouseLeave={() => setActiveLabel(null)}
                className={`rounded-2xl border px-4 py-3 text-left transition-colors ${isActive ? 'border-sky-200 bg-sky-50/70' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} />
                    <span className="text-sm font-semibold text-slate-900">{row.label}</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-900">{row.percentage}%</span>
                </div>
                <p className="mt-2 text-sm text-slate-700">
                  {row.label}: {currencyFormatter.format(row.amount)} ({row.percentage}%)
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {row.students > 0 ? `${row.students} student${row.students === 1 ? '' : 's'}` : 'Student count unavailable'}
                </p>
              </button>
            );
          })}
        </div>

        {activeSegment ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">{activeSegment.label}</p>
            <p className="mt-1">Amount: {currencyFormatter.format(activeSegment.amount)}</p>
            <p className="mt-1">Percentage: {activeSegment.percentage}%</p>
            <p className="mt-1">
              Students: {activeSegment.students > 0 ? activeSegment.students : 'Unavailable'}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
*/

function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}

function CompactPaidPendingComparisonChart({
  paid,
  pending,
  totalPayable,
  paidStudents,
  pendingStudents,
  trendData,
}: {
  paid: number;
  pending: number;
  totalPayable: number;
  paidStudents: number;
  pendingStudents: number;
  trendData: ChartPoint[];
}) {
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null);
  const [chartReady, setChartReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setChartReady(true), 60);
    return () => window.clearTimeout(timer);
  }, []);

  const rows = [
    {
      label: 'Collected',
      amount: paid,
      students: paidStudents,
      color: '#059669',
      percentage: totalPayable > 0 ? Math.round((paid / totalPayable) * 100) : 0,
      badge: 'OK',
    },
    {
      label: 'Pending',
      amount: pending,
      students: pendingStudents,
      color: '#d97706',
      percentage: totalPayable > 0 ? Math.round((pending / totalPayable) * 100) : 0,
      badge: 'PD',
    },
  ].filter((row) => row.amount > 0);

  if (paid <= 0 && pending <= 0) {
    return <EmptyChartState message="No fee collection data available" />;
  }

  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  let runningOffset = 0;
  const segments = rows.map((row) => {
    const dash = totalPayable > 0 ? (row.amount / totalPayable) * circumference : 0;
    const segment = { ...row, dash, offset: runningOffset };
    runningOffset += dash;
    return segment;
  });
  const activeSegment = segments.find((segment) => segment.label === activeLabel) ?? null;
  const collectionPercentage = Math.round((paid / Math.max(totalPayable, 1)) * 100);
  const trend = getCollectionTrendIndicator(trendData);

  const setHoveredSegment = (
    label: string,
    event: React.MouseEvent<SVGCircleElement | HTMLButtonElement>,
  ) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    setActiveLabel(label);
    setTooltip({
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    });
  };

  const clearHover = () => {
    setActiveLabel(null);
    setTooltip(null);
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(320px,1fr)_260px] xl:items-center">
      <div className="space-y-4">
        <div className="relative mx-auto w-full max-w-[310px]">
          {tooltip && activeSegment ? (
            <div
              className="pointer-events-none absolute z-10 min-w-[168px] -translate-x-1/2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
              style={{ left: tooltip.x, top: tooltip.y - 18 }}
            >
              <p className="font-semibold text-slate-900">{activeSegment.label}</p>
              <p className="mt-1 text-slate-600">Amount: {currencyFormatter.format(activeSegment.amount)}</p>
              <p className="mt-1 text-slate-600">Percentage: {activeSegment.percentage}%</p>
              <p className="mt-1 text-slate-600">
                Students: {activeSegment.students > 0 ? activeSegment.students : 'Unavailable'}
              </p>
            </div>
          ) : null}

          <svg viewBox="0 0 220 220" className="mx-auto h-[270px] w-full">
            <circle cx="110" cy="110" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="28" />
            {segments.map((segment) => (
              <circle
                key={segment.label}
                cx="110"
                cy="110"
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth={activeLabel === segment.label ? 34 : 28}
                strokeDasharray={`${segment.dash} ${circumference - segment.dash}`}
                strokeDashoffset={chartReady ? -segment.offset : circumference}
                strokeLinecap="round"
                transform="rotate(-90 110 110)"
                className="cursor-pointer transition-all duration-700 ease-out"
                style={{ transitionProperty: 'stroke-dashoffset, stroke-width' }}
                onMouseEnter={(event) => setHoveredSegment(segment.label, event)}
                onMouseMove={(event) => setHoveredSegment(segment.label, event)}
                onMouseLeave={clearHover}
              />
            ))}
          </svg>

          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Total Payable</p>
            <p className="mt-2 text-2xl font-bold text-slate-950">{currencyFormatter.format(totalPayable)}</p>
            <p className="mt-1 text-xs text-slate-500">{collectionPercentage}% collected</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {rows.map((row) => (
            <div key={row.label} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} />
              <span>{row.label}</span>
              <span>{row.percentage}%</span>
            </div>
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Collected Amount</p>
            <p className="mt-2 text-sm font-bold text-emerald-700">{currencyFormatter.format(paid)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Pending Amount</p>
            <p className="mt-2 text-sm font-bold text-amber-700">{currencyFormatter.format(pending)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Collection Percentage</p>
            <p className="mt-2 text-sm font-bold text-slate-900">{collectionPercentage}%</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {trend ? (
          <div className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${trend.direction === 'up' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
            <span>{trend.direction === 'up' ? '▲' : '▼'}</span>
            <span>{trend.label}</span>
          </div>
        ) : null}

        {rows.map((row) => {
          const isActive = activeLabel === row.label;
          return (
            <button
              key={row.label}
              type="button"
              onMouseEnter={(event) => setHoveredSegment(row.label, event)}
              onMouseMove={(event) => setHoveredSegment(row.label, event)}
              onMouseLeave={clearHover}
              className={`w-full rounded-2xl border px-4 py-4 text-left transition-colors ${isActive ? 'border-sky-200 bg-sky-50/70' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-700">{row.badge}</span>
                  <span className="text-sm font-semibold text-slate-900">{row.label}</span>
                </div>
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{row.percentage}%</span>
              </div>
              <p className="mt-3 text-xl font-bold text-slate-950">{currencyFormatter.format(row.amount)}</p>
              <p className="mt-1 text-sm text-slate-500">{row.students} student{row.students === 1 ? '' : 's'}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function getCollectionTrendIndicator(data: ChartPoint[]) {
  if (data.length < 2) return null;

  const current = data[data.length - 1];
  const previous = data[data.length - 2];
  if (!current || !previous || previous.amount <= 0 || current.amount === previous.amount) return null;

  const delta = ((current.amount - previous.amount) / previous.amount) * 100;
  return {
    direction: delta > 0 ? 'up' as const : 'down' as const,
    label: `${Math.abs(Math.round(delta))}% vs previous period`,
  };
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
  if (filters.fromDate) form.append('from_date', filters.fromDate);
  if (filters.toDate) form.append('to_date', filters.toDate);
  if (filters.status) form.append('status', filters.status);
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
  void snapshot;
  const totalPaidFees = getCollectedTotal(students);
  const totalPendingFees = students.reduce((total, student) => total + student.pendingFees, 0);
  const calculatedTotal = students.reduce((total, student) => total + getStudentTotalFees(student), 0);
  const collectionBase = Math.max(calculatedTotal, totalPaidFees + totalPendingFees);
  const collectionRate = collectionBase > 0 ? Math.round((totalPaidFees / collectionBase) * 100) : 0;
  const pendingStudents = students.filter((student) => student.pendingFees > 0 && student.status !== 'paid').length;
  const paidStudents = Math.max(students.filter((student) => student.status === 'paid' || student.pendingFees <= 0).length, 0);

  return {
    todayCollection: getTodayCollection(students),
    totalPaidFees,
    totalPendingFees,
    paidStudents,
    pendingStudents,
    collectionRate: normalizePercentage(collectionRate),
    dailyTrend: getDailyCollectionTrend(students),
    headBreakdown: getHeadBreakdown(students),
    paymentMix: getPaymentMix(students),
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

function getTodayCollection(students: StudentFeeRow[]): number {
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

  return students.reduce((total, student) => {
    const collectedOn = parseFeeDate(student.collectionDateRaw);
    if (!collectedOn) return total;

    const collectedKey = `${collectedOn.getFullYear()}-${collectedOn.getMonth()}-${collectedOn.getDate()}`;
    return collectedKey === todayKey ? total + getStudentPaidFees(student) : total;
  }, 0);
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

function getDailyCollectionTrend(students: StudentFeeRow[]): ChartPoint[] {
  type TrendBucket = { label: string; amount: number; sortValue: number };

  const grouped = new Map<string, TrendBucket>();

  students.forEach((student) => {
    const date = parseFeeDate(student.collectionDateRaw);
    if (!date) return;

    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const current = grouped.get(key) ?? {
      label: date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      amount: 0,
      sortValue: new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime(),
    };

    current.amount += getStudentPaidFees(student);
    grouped.set(key, current);
  });

  return Array.from(grouped.values())
    .sort((first, second) => first.sortValue - second.sortValue)
    .slice(-6)
    .map((item) => ({
      label: item.label,
      amount: roundChartValue(amountToLakhs(item.amount)),
    }));
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
    return {
      label: getChartPointLabel(record, index),
      amount: roundChartValue(amountToLakhs(collectedAmount)),
    };
  }).filter((item) => item.amount > 0).slice(-6);
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

function isWithinDateRange(date: Date | null, fromDate: string, toDate: string): boolean {
  if (!fromDate && !toDate) return true;
  if (!date) return false;

  const value = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const start = fromDate ? parseFeeDate(fromDate) : null;
  const end = toDate ? parseFeeDate(toDate) : null;

  if (start) {
    const startValue = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
    if (value < startValue) return false;
  }

  if (end) {
    const endValue = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
    if (value > endValue) return false;
  }

  return true;
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
