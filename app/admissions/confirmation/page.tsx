'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Search,
  Pencil,
  CheckCircle2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileDown,
  FileText,
  Table2,
  FileSpreadsheet,
  Printer,
  Loader2,
  AlertCircle,
  UserPlus,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis } from '@/components/ui/pagination';
import { exportRowsAsCsv, exportRowsAsExcel, exportRowsAsPdf, openPrintPreview } from '@/lib/table-export';
import { appendCommonParams, buildSessionContext, createAuthHeaders, normalizeApiStatus, readString } from '@/lib/erp-client';
import type { AdmissionEnquiryApiResponse, RegistrationPipelineDetail } from '../admission_registration/types';
import { confirmAdmission, fetchRegistrationDetail, saveRegistration } from '../admission_registration/workflow';

type SortDirection = 'asc' | 'desc' | null;
type SortField = string;

type ConfirmationRecord = {
  id: string;
  registrationNumber: string;
  enquiryNumber: string;
  inquiryDate: string;
  followUpDate: string;
  firstName: string;
  middleName: string;
  lastName: string;
  mobile: string;
  email: string;
  dateOfBirth: string;
  age: string;
  admissionStandard: string;
  status: string;
  detail: RegistrationPipelineDetail;
  canConfirm: boolean;
  confirmReason: string;
  isConfirmed: boolean;
  hasStudent: boolean;
  canAddStudent: boolean;
  addStudentReason: string;
};

type ColumnDef = {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
};

const columns: ColumnDef[] = [
  { key: 'action', label: 'Action', sortable: false, width: '70px' },
  { key: 'confirm', label: 'Confirm', sortable: false, width: '100px' },
  { key: 'addStudent', label: 'Add Student', sortable: false, width: '130px' },
  { key: 'registrationNumber', label: 'Registration No', sortable: true },
  { key: 'enquiryNumber', label: 'Enquiry Number', sortable: true },
  { key: 'inquiryDate', label: 'Enquiry Date', sortable: true },
  { key: 'followUpDate', label: 'Follow Up Date', sortable: true },
  { key: 'firstName', label: 'First Name', sortable: true },
  { key: 'middleName', label: 'Middle Name', sortable: true },
  { key: 'lastName', label: 'Last Name', sortable: true },
  { key: 'mobile', label: 'Mobile', sortable: true },
  { key: 'email', label: 'Email', sortable: true },
  { key: 'dateOfBirth', label: 'Date of Birth', sortable: true },
  { key: 'age', label: 'Age', sortable: true, width: '60px' },
  { key: 'admissionStandard', label: 'Admission Standard', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
];

const exportColumns = columns.filter((column) => column.key !== 'action' && column.key !== 'addStudent');

function resolveEligibility(detail: RegistrationPipelineDetail): { canProceed: boolean; reason: string } {
  const canProceed =
    readString(detail.displaySaveStudent) === '1' &&
    Boolean(
      readString(detail.record.registration_enquiry_id) ||
        readString(detail.record.enquiry_id) ||
        readString(detail.record.id)
    );

  return {
    canProceed,
    reason: canProceed ? '' : 'Please complete admission enquiry and registration before confirmation.',
  };
}

function parseDate(value: string): string {
  if (!value) return '-';
  try {
    return format(parseISO(value), 'dd MMM yyyy');
  } catch {
    return value;
  }
}

export default function AdmissionConfirmationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registrationId = searchParams.get('registrationId');
  const enquiryId = searchParams.get('enquiryId');

  const [records, setRecords] = useState<ConfirmationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [entriesPerPage, setEntriesPerPage] = useState<string>('10');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [addingStudentId, setAddingStudentId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const loadConfirmationRecords = async () => {
      const session = buildSessionContext();
      if (!session.baseUrl || !session.subInstituteId || !session.syear) {
        setRecords([]);
        setError('Session is missing API base URL, sub institute, or academic year.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const baseUrl = session.baseUrl.replace(/\/$/, '');
        const url = new URL(`${baseUrl}/api/admission_enquiry`);
        appendCommonParams(url.searchParams, session);

        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: createAuthHeaders(session),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to load admission enquiries (${response.status})`);
        }

        const payload = (await response.json()) as AdmissionEnquiryApiResponse;
        if (normalizeApiStatus(payload) !== '1') {
          throw new Error(payload.message || 'Failed to load admission enquiries.');
        }

        const detailResults = await Promise.all(
          (payload.data || []).map(async (row) => {
            try {
              const detail = await fetchRegistrationDetail(readString(row.id), controller.signal);
              if (!detail) return null;
              if (readString(detail.record.status).toUpperCase() !== 'OPEN') return null;

              const isConfirmed = readString(detail.record.admission_status).toUpperCase() === 'YES';
              const hasStudent = Number(detail.record.total_student_count ?? 0) > 0;
              const eligibility = resolveEligibility(detail);

              return {
                id: readString(detail.record.id),
                registrationNumber: readString(detail.record.registration_no || detail.record.admission_docket_no || detail.record.id),
                enquiryNumber: readString(row.enquiry_no || detail.record.enquiry_no),
                inquiryDate: readString(detail.record.created_on),
                // Enquiry-list row is the reliable source: the registration "edit" endpoint
                // left-joins admission_form/admission_registration, so a missing form/registration
                // row nulls these out even though the enquiry itself has real values.
                followUpDate: readString(row.followup_date || detail.record.followup_date),
                firstName: readString(detail.record.first_name),
                middleName: readString(detail.record.middle_name),
                lastName: readString(detail.record.last_name),
                mobile: readString(detail.record.mobile),
                email: readString(detail.record.email),
                dateOfBirth: readString(detail.record.date_of_birth),
                age: readString(detail.record.age),
                admissionStandard: readString(row.admission_standard || detail.record.std_name || detail.record.admission_standard),
                status: hasStudent ? 'Student Added' : isConfirmed ? 'Confirmed' : 'Open',
                detail,
                canConfirm: eligibility.canProceed,
                confirmReason: eligibility.reason,
                isConfirmed,
                hasStudent,
                canAddStudent: eligibility.canProceed,
                addStudentReason: eligibility.reason,
              } satisfies ConfirmationRecord;
            } catch {
              return null;
            }
          })
        );

        setRecords(detailResults.filter((record): record is ConfirmationRecord => Boolean(record)));
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setRecords([]);
        setError(loadError instanceof Error ? loadError.message : 'Failed to load confirmation records.');
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    const timeoutId = window.setTimeout(() => {
      void loadConfirmationRecords();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  const applyRefreshedDetail = (
    id: string,
    refreshed: RegistrationPipelineDetail,
    overrides: Partial<ConfirmationRecord> = {}
  ) => {
    const isConfirmed = readString(refreshed.record.admission_status).toUpperCase() === 'YES';
    const hasStudent = Number(refreshed.record.total_student_count ?? 0) > 0;
    const eligibility = resolveEligibility(refreshed);

    setRecords((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              registrationNumber: readString(refreshed.record.registration_no || refreshed.record.admission_docket_no || refreshed.record.id),
              followUpDate: readString(refreshed.record.followup_date || item.followUpDate),
              firstName: readString(refreshed.record.first_name),
              middleName: readString(refreshed.record.middle_name),
              lastName: readString(refreshed.record.last_name),
              mobile: readString(refreshed.record.mobile),
              email: readString(refreshed.record.email),
              dateOfBirth: readString(refreshed.record.date_of_birth),
              age: readString(refreshed.record.age),
              admissionStandard: readString(refreshed.record.std_name || refreshed.record.admission_standard || item.admissionStandard),
              status: hasStudent ? 'Student Added' : isConfirmed ? 'Confirmed' : 'Open',
              detail: refreshed,
              isConfirmed,
              hasStudent,
              canAddStudent: eligibility.canProceed,
              addStudentReason: eligibility.reason,
              ...overrides,
            }
          : item
      )
    );
  };

  const handleConfirm = async (record: ConfirmationRecord) => {
    setConfirmingId(record.id);
    setActionError(null);
    setNotice(null);

    try {
      await saveRegistration(record.id, record.detail, { admission_status: 'YES' });
      const refreshed = await fetchRegistrationDetail(record.id);
      if (!refreshed) {
        throw new Error('Confirmation succeeded but the latest record could not be reloaded.');
      }

      applyRefreshedDetail(record.id, refreshed, { canConfirm: false, confirmReason: '' });
      setNotice('Admission confirmed. You can now add the student.');
    } catch (confirmError) {
      setActionError(confirmError instanceof Error ? confirmError.message : 'Failed to confirm admission.');
    } finally {
      setConfirmingId(null);
    }
  };

  const handleAddStudent = async (record: ConfirmationRecord) => {
    if (record.hasStudent || !record.canAddStudent) return;

    setAddingStudentId(record.id);
    setActionError(null);
    setNotice(null);

    try {
      await confirmAdmission({
        id: record.id,
        enquiryId: readString(record.detail.record.enquiry_id),
        registrationEnquiryId: readString(record.detail.record.registration_enquiry_id),
      });
      const refreshed = await fetchRegistrationDetail(record.id);
      if (!refreshed) {
        throw new Error('The student was added but the latest record could not be reloaded.');
      }

      applyRefreshedDetail(record.id, refreshed);
      setNotice(`Student added successfully for ${record.firstName} ${record.lastName}.`.replace(/\s+/g, ' ').trim());
    } catch (addError) {
      setActionError(addError instanceof Error ? addError.message : 'Failed to add student.');
    } finally {
      setAddingStudentId(null);
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else if (sortDirection === 'desc') setSortDirection(null);
      else setSortDirection('asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) return <ArrowUpDown className="ml-2 h-3.5 w-3.5 text-slate-400" />;
    if (sortDirection === 'asc') return <ArrowUp className="ml-2 h-3.5 w-3.5 text-[#0D6EFD]" />;
    if (sortDirection === 'desc') return <ArrowDown className="ml-2 h-3.5 w-3.5 text-[#0D6EFD]" />;
    return <ArrowUpDown className="ml-2 h-3.5 w-3.5 text-slate-400" />;
  };

  const filteredAndSortedData = useMemo(() => {
    let data = [...records];
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      data = data.filter((record) =>
        [
          record.firstName,
          record.middleName,
          record.lastName,
          record.mobile,
          record.email,
          record.enquiryNumber,
          record.admissionStandard,
        ]
          .join(' ')
          .toLowerCase()
          .includes(query)
      );
    }

    if (sortField && sortDirection) {
      data.sort((a, b) => {
        const aVal = a[sortField as keyof ConfirmationRecord];
        const bVal = b[sortField as keyof ConfirmationRecord];
        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return data;
  }, [records, searchQuery, sortField, sortDirection]);

  const totalEntries = filteredAndSortedData.length;
  const totalPages = Math.ceil(totalEntries / parseInt(entriesPerPage, 10) || 1);
  const startEntry = totalEntries === 0 ? 0 : (currentPage - 1) * parseInt(entriesPerPage, 10) + 1;
  const endEntry = Math.min(currentPage * parseInt(entriesPerPage, 10), totalEntries);
  const paginatedData = filteredAndSortedData.slice(Math.max(0, startEntry - 1), endEntry);

  const visibleExportRows = useMemo(
    () =>
      paginatedData.map((record) => ({
        enquiryNumber: record.enquiryNumber,
        registrationNumber: record.registrationNumber,
        inquiryDate: parseDate(record.inquiryDate),
        followUpDate: parseDate(record.followUpDate),
        firstName: record.firstName,
        middleName: record.middleName,
        lastName: record.lastName,
        mobile: record.mobile,
        email: record.email,
        dateOfBirth: parseDate(record.dateOfBirth),
        age: record.age,
        admissionStandard: record.admissionStandard,
        status: record.status,
      })),
    [paginatedData]
  );

  const exportSubtitle = `Showing records ${startEntry} to ${endEntry} of ${totalEntries}`;

  const selectedRecord = useMemo(() => {
    if (!records.length) {
      return null;
    }

    if (registrationId) {
      const byRegistration = records.find((record) => record.id === registrationId);
      if (byRegistration) {
        return byRegistration;
      }
    }

    if (!enquiryId) {
      return null;
    }

    return (
      records.find((record) => readString(record.detail.record.enquiry_id) === enquiryId) ||
      records.find((record) => record.enquiryNumber === enquiryId) ||
      null
    );
  }, [enquiryId, records, registrationId]);

  const getPaginationItems = () => {
    const items: (number | 'ellipsis')[] = [];
    const maxVisible = 5;
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) items.push(i);
    } else {
      items.push(1);
      if (currentPage > 3) items.push('ellipsis');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) items.push(i);
      if (currentPage < totalPages - 2) items.push('ellipsis');
      items.push(totalPages);
    }
    return items;
  };

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-[1600px] space-y-6 p-4 md:p-6 lg:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="h-8 w-1 rounded-full bg-gradient-to-b from-[#0D6EFD] to-[#7ED957]" />
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Admission Confirmation</h1>
            </div>
            <p className="text-sm text-slate-500 ml-3 mt-1">Manage and track all admission confirmations in one place</p>
          </div>
        </div>

        {notice && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {notice}
          </div>
        )}
        {actionError && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {actionError}
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-slate-200/80 bg-white shadow-sm"><CardContent className="p-4 flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center"><Table2 className="h-5 w-5 text-blue-600" /></div><div><p className="text-xs font-medium text-slate-500">Total Records</p><p className="text-lg font-bold text-slate-900">{records.length}</p></div></CardContent></Card>
          <Card className="border-slate-200/80 bg-white shadow-sm"><CardContent className="p-4 flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center"><FileDown className="h-5 w-5 text-emerald-600" /></div><div><p className="text-xs font-medium text-slate-500">Open</p><p className="text-lg font-bold text-slate-900">{records.filter((record) => record.status === 'Open').length}</p></div></CardContent></Card>
          <Card className="border-slate-200/80 bg-white shadow-sm"><CardContent className="p-4 flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center"><Printer className="h-5 w-5 text-amber-600" /></div><div><p className="text-xs font-medium text-slate-500">With follow up</p><p className="text-lg font-bold text-slate-900">{records.filter((record) => record.followUpDate).length}</p></div></CardContent></Card>
          <Card className="border-slate-200/80 bg-white shadow-sm"><CardContent className="p-4 flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-violet-50 border border-violet-100 flex items-center justify-center"><FileSpreadsheet className="h-5 w-5 text-violet-600" /></div><div><p className="text-xs font-medium text-slate-500">Current view</p><p className="text-lg font-bold text-slate-900">{filteredAndSortedData.length}</p></div></CardContent></Card>
        </div>

        {enquiryId ? (
          <Card className="border-blue-200/80 bg-blue-50/70 shadow-sm">
            <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Selected enquiry</p>
                {selectedRecord ? (
                  <>
                    <h2 className="mt-1 text-lg font-bold text-slate-900">
                      {[selectedRecord.firstName, selectedRecord.middleName, selectedRecord.lastName].filter(Boolean).join(' ') || 'Admission candidate'}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Enquiry No. {selectedRecord.enquiryNumber || enquiryId}
                      {selectedRecord.mobile ? ` • Mobile ${selectedRecord.mobile}` : ''}
                      {selectedRecord.admissionStandard ? ` • Standard ${selectedRecord.admissionStandard}` : ''}
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-slate-600">
                    {isLoading
                      ? `Loading authoritative admission data for enquiry ${enquiryId}.`
                      : `No confirmation record matched enquiry ${enquiryId} yet.`}
                  </p>
                )}
              </div>

              {selectedRecord ? (
                <Button
                  type="button"
                  className="rounded-xl bg-[#0D6EFD] text-white hover:bg-[#0D6EFD]/90"
                  onClick={() => router.push(`/admissions/confirmation/${selectedRecord.id}/follow-up`)}
                >
                  Continue to Candidate Form
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        <Card className="border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <CardHeader className="pb-4 pt-5 px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <CardTitle className="text-base font-bold text-slate-800">Confirmations List</CardTitle>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search confirmations..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-9 h-9 rounded-lg border-slate-200 bg-slate-50/50 text-sm w-full sm:w-[280px] focus:bg-white transition-colors"
                  />
                </div>

                <Select
                  value={entriesPerPage}
                  onValueChange={(val) => {
                    if (val) {
                      setEntriesPerPage(val);
                      setCurrentPage(1);
                    }
                  }}
                >
                  <SelectTrigger className="h-9 w-full sm:w-[130px] rounded-lg border-slate-200 bg-slate-50/50 text-xs font-medium">
                    <SelectValue placeholder="Show entries" />
                  </SelectTrigger>
                  <SelectContent align="end">
                    <SelectItem value="5">5 / page</SelectItem>
                    <SelectItem value="10">10 / page</SelectItem>
                    <SelectItem value="25">25 / page</SelectItem>
                    <SelectItem value="50">50 / page</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Button variant="outline" size="sm" onClick={() => exportRowsAsPdf({ filename: 'admission-confirmation-current-view.pdf', title: 'Admission Confirmation', subtitle: exportSubtitle, columns: exportColumns, rows: visibleExportRows })} className="h-9 rounded-lg border-slate-200 bg-white shadow-sm text-xs font-medium"><FileText className="mr-2 h-3.5 w-3.5 text-rose-500" />PDF</Button>
                  <Button variant="outline" size="sm" onClick={() => exportRowsAsCsv({ filename: 'admission-confirmation-current-view.csv', columns: exportColumns, rows: visibleExportRows })} className="h-9 rounded-lg border-slate-200 bg-white shadow-sm text-xs font-medium"><Table2 className="mr-2 h-3.5 w-3.5 text-emerald-500" />CSV</Button>
                  <Button variant="outline" size="sm" onClick={() => exportRowsAsExcel({ filename: 'admission-confirmation-current-view.xls', title: 'Admission Confirmation', columns: exportColumns, rows: visibleExportRows })} className="h-9 rounded-lg border-slate-200 bg-white shadow-sm text-xs font-medium"><FileSpreadsheet className="mr-2 h-3.5 w-3.5 text-blue-500" />Excel</Button>
                  <Button variant="outline" size="sm" onClick={() => openPrintPreview({ title: 'Admission Confirmation', subtitle: exportSubtitle, columns: exportColumns, rows: visibleExportRows })} className="h-9 rounded-lg border-slate-200 bg-white shadow-sm text-xs font-medium"><Printer className="mr-2 h-3.5 w-3.5 text-slate-500" />Print</Button>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 hover:bg-slate-50/80 border-slate-200">
                    {columns.map((col) => (
                      <TableHead
                        key={col.key}
                        className={cn('px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500', col.sortable && 'cursor-pointer select-none hover:text-slate-700 transition-colors')}
                        style={col.width ? { width: col.width } : undefined}
                        onClick={() => col.sortable && handleSort(col.key)}
                      >
                        <div className="flex items-center">{col.label}{col.sortable && getSortIcon(col.key)}</div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={columns.length} className="h-32 text-center text-sm text-slate-500"><div className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Loading confirmation records...</div></TableCell></TableRow>
                  ) : error ? (
                    <TableRow><TableCell colSpan={columns.length} className="h-32 text-center text-sm text-rose-600"><div className="inline-flex items-center gap-2"><AlertCircle className="h-4 w-4" />{error}</div></TableCell></TableRow>
                  ) : paginatedData.length === 0 ? (
                    <TableRow><TableCell colSpan={columns.length} className="h-32 text-center text-sm text-slate-500">No confirmation records found.</TableCell></TableRow>
                  ) : (
                    paginatedData.map((record) => (
                      <TableRow key={record.id} className="border-slate-100 hover:bg-slate-50/60 transition-colors">
                        <TableCell className="px-4 py-3">
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-500 hover:text-[#0D6EFD] hover:bg-blue-50 transition-colors" onClick={() => router.push(`/admissions/confirmation/${record.id}/follow-up`)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <Button
                            type="button"
                            variant={record.isConfirmed ? 'outline' : 'default'}
                            size="sm"
                            disabled={record.isConfirmed || confirmingId === record.id || !record.canConfirm}
                            title={!record.canConfirm && !record.isConfirmed ? record.confirmReason : undefined}
                            className={cn(
                              'h-8 rounded-lg text-xs font-medium',
                              record.isConfirmed
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50'
                                : 'bg-[#0D6EFD] text-white hover:bg-[#0D6EFD]/90'
                            )}
                            onClick={() => void handleConfirm(record)}
                          >
                            {confirmingId === record.id ? (
                              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                            )}
                            {record.isConfirmed ? 'Confirmed' : 'Confirm'}
                          </Button>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          {record.hasStudent ? (
                            <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-medium text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Student Added
                            </span>
                          ) : record.isConfirmed ? (
                            <Button
                              type="button"
                              variant="default"
                              size="sm"
                              disabled={addingStudentId === record.id || !record.canAddStudent}
                              title={!record.canAddStudent ? record.addStudentReason : undefined}
                              className="h-8 rounded-lg bg-emerald-600 text-xs font-medium text-white hover:bg-emerald-600/90"
                              onClick={() => void handleAddStudent(record)}
                            >
                              {addingStudentId === record.id ? (
                                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <UserPlus className="mr-1 h-3.5 w-3.5" />
                              )}
                              Add Student
                            </Button>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-xs font-medium text-slate-700">{record.registrationNumber || '-'}</TableCell>
                        <TableCell className="px-4 py-3 text-xs font-medium text-[#0D6EFD]">{record.enquiryNumber}</TableCell>
                        <TableCell className="px-4 py-3 text-xs text-slate-600">{parseDate(record.inquiryDate)}</TableCell>
                        <TableCell className="px-4 py-3 text-xs text-slate-600">{parseDate(record.followUpDate)}</TableCell>
                        <TableCell className="px-4 py-3 text-xs font-medium text-slate-900">{record.firstName}</TableCell>
                        <TableCell className="px-4 py-3 text-xs text-slate-600">{record.middleName}</TableCell>
                        <TableCell className="px-4 py-3 text-xs text-slate-600">{record.lastName}</TableCell>
                        <TableCell className="px-4 py-3 text-xs text-slate-600 font-mono">{record.mobile}</TableCell>
                        <TableCell className="px-4 py-3 text-xs text-slate-600">{record.email}</TableCell>
                        <TableCell className="px-4 py-3 text-xs text-slate-600">{parseDate(record.dateOfBirth)}</TableCell>
                        <TableCell className="px-4 py-3 text-xs text-slate-600 text-center">{record.age}</TableCell>
                        <TableCell className="px-4 py-3 text-xs text-slate-600">{record.admissionStandard || '-'}</TableCell>
                        <TableCell className="px-4 py-3 text-xs">
                          <span
                            className={cn(
                              'inline-flex rounded-full px-2 py-0.5 font-medium',
                              record.status === 'Student Added'
                                ? 'bg-emerald-50 text-emerald-700'
                                : record.status === 'Confirmed'
                                  ? 'bg-violet-50 text-violet-700'
                                  : 'bg-blue-50 text-blue-700'
                            )}
                          >
                            {record.status}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col gap-4 border-t border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">Showing {startEntry} to {endEntry} of {totalEntries} entries</p>
              {totalPages > 1 && (
                <Pagination>
                  <PaginationContent className="gap-1">
                    <PaginationItem><PaginationPrevious onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} className={cn('h-8 min-w-8 rounded-lg border border-slate-200 bg-white text-xs font-medium hover:bg-slate-50', currentPage === 1 && 'pointer-events-none opacity-50')} /></PaginationItem>
                    {getPaginationItems().map((item, idx) => (
                      <PaginationItem key={idx}>
                        {item === 'ellipsis' ? (
                          <PaginationEllipsis className="h-8 min-w-8" />
                        ) : (
                          <PaginationLink
                            isActive={currentPage === item}
                            onClick={() => setCurrentPage(item)}
                            className={cn('h-8 min-w-8 rounded-lg text-xs font-medium border border-slate-200 bg-white hover:bg-slate-50', currentPage === item && 'bg-[#0D6EFD] text-white border-[#0D6EFD] hover:bg-[#0D6EFD]/90')}
                          >
                            {item}
                          </PaginationLink>
                        )}
                      </PaginationItem>
                    ))}
                    <PaginationItem><PaginationNext onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} className={cn('h-8 min-w-8 rounded-lg border border-slate-200 bg-white text-xs font-medium hover:bg-slate-50', currentPage === totalPages && 'pointer-events-none opacity-50')} /></PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
