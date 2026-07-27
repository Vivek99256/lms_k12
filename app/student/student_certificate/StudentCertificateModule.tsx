'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Download,
  Eye,
  FileCheck2,
  History,
  Loader2,
  Printer,
  Search,
} from 'lucide-react';

import SearchDropdown from '@/components/search-dropdown/SearchDropdown';
import type {
  AcademicSection,
  Division,
  DropdownValue,
  Standard,
} from '@/components/search-dropdown/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  EmptyTableRow,
  Field,
  InlineMessage,
  LoadingRows,
  NativeSelect,
  PageFrame,
  PageHeader,
  ReceiptPreviewModal,
  SectionPanel,
} from '@/app/fees/_components/fees-shared';
import {
  appendSessionParams,
  asRecord,
  getFeesSession,
  readString,
  toArray,
} from '@/app/fees/_lib/fees-api';
import { getStoredMenuContext } from '@/app/hooks/useMenuRights';
import {
  exportRowsAsCsv,
  exportRowsAsExcel,
  exportRowsAsPdf,
  openPrintPreview,
  type TableExportColumn,
  type TableExportRow,
} from '@/lib/table-export';
import { useAuth } from '@/contexts/AuthContext';

type ViewMode = 'issue' | 'history';
type MessageType = 'success' | 'error' | 'info';

type HtmlMessage = {
  type: MessageType;
  text: string;
  allowHtml?: boolean;
};

type TemplateOption = {
  id: string;
  moduleName: string;
};

type StudentSearchRow = {
  id: string;
  enrollmentNo: string;
  studentName: string;
  standardName: string;
  divisionName: string;
};

type PreviewPayload = {
  html: string;
  insertIds: string;
  template: string;
};

type HistoryRow = {
  certiId: string;
  studentId: string;
  enrollmentNo: string;
  studentName: string;
  standardName: string;
  divisionName: string;
  certificateNumber: string;
  certificateType: string;
  createdAt: string;
  certificateHtml: string;
};

type SortKey = 'studentName' | 'enrollmentNo' | 'standardName' | 'divisionName' | 'certificateNumber' | 'certificateType' | 'createdAt';
type SortDirection = 'asc' | 'desc';

function getSingleValue(value: DropdownValue | undefined): string {
  if (Array.isArray(value)) {
    return value[0] || '';
  }

  return value || '';
}

function normalizePayload(response: unknown): Record<string, unknown> {
  const root = asRecord(response);
  const nested = asRecord(root.data);

  if (Object.keys(nested).length > 0) {
    return {
      ...root,
      ...nested,
      data: nested.data ?? root.data,
    };
  }

  return root;
}

function readStatus(payload: Record<string, unknown>): number {
  const rawStatus = payload.status ?? payload.status_code;
  return Number(readString(rawStatus)) || 0;
}

function readMessage(payload: Record<string, unknown>, fallback: string) {
  return readString(payload.message) || fallback;
}

function formatStudentNameFromRecord(record: Record<string, unknown>) {
  const studentName = readString(record.student_name);
  if (studentName) {
    return studentName;
  }

  return [
    readString(record.first_name),
    readString(record.middle_name),
    readString(record.last_name),
  ]
    .filter(Boolean)
    .join(' ')
    .trim();
}

function formatDateTimeDisplay(value: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function parseTemplateOptions(payload: Record<string, unknown>): TemplateOption[] {
  const reportTypes = toArray(payload.report_types);

  return reportTypes
    .map((entry) => {
      const record = asRecord(entry);
      const moduleName = readString(record.module_name);
      return {
        id: readString(record.id) || moduleName,
        moduleName,
      };
    })
    .filter((option) => option.moduleName);
}

function parseStudentRows(payload: Record<string, unknown>): StudentSearchRow[] {
  return toArray(payload.data)
    .map((entry) => {
      const record = asRecord(entry);
      return {
        id: readString(record.id),
        enrollmentNo: readString(record.enrollment_no),
        studentName: formatStudentNameFromRecord(record),
        standardName: readString(record.standard_name),
        divisionName: readString(record.division_name),
      };
    })
    .filter((row) => row.id);
}

function parsePreviewPayload(payload: Record<string, unknown>): PreviewPayload | null {
  const html = readString(payload.str);
  const insertIds = readString(payload.insert_ids);
  const template = readString(payload.template);

  if (!html || !insertIds || !template) {
    return null;
  }

  return { html, insertIds, template };
}

function parseHistoryRows(payload: Record<string, unknown>): HistoryRow[] {
  return toArray(payload.result_report)
    .map((entry) => {
      const record = asRecord(entry);
      return {
        certiId: readString(record.certi_id || record.id),
        studentId: readString(record.student_id),
        enrollmentNo: readString(record.enrollment_no),
        studentName: formatStudentNameFromRecord(record),
        standardName: readString(record.standard_name),
        divisionName: readString(record.division_name),
        certificateNumber: readString(record.certificate_number),
        certificateType: readString(record.certificate_type),
        createdAt: readString(record.created_at),
        certificateHtml: readString(record.certificate_html),
      };
    })
    .filter((row) => row.certiId);
}

function openCertificatePrintWindow(title: string, html: string) {
  if (typeof window === 'undefined' || !html) {
    return;
  }

  const printWindow = window.open('', '_blank', 'width=1200,height=900');
  if (!printWindow) {
    return;
  }

  printWindow.document.open();
  printWindow.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { margin: 0; padding: 16px; background: #ffffff; }
          .pagebreak { page-break-after: always; }
        </style>
      </head>
      <body onload="window.print()">${html}</body>
    </html>
  `);
  printWindow.document.close();
}

function HtmlMessageBanner({ message }: { message: HtmlMessage | null }) {
  if (!message) {
    return null;
  }

  if (!message.allowHtml) {
    return <InlineMessage type={message.type} text={message.text} />;
  }

  const classes = message.type === 'success'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : message.type === 'info'
      ? 'border-blue-200 bg-blue-50 text-blue-800'
      : 'border-red-200 bg-red-50 text-red-800';

  return (
    <div
      className={`rounded-lg border px-3 py-2 text-sm font-medium ${classes}`}
      dangerouslySetInnerHTML={{ __html: message.text }}
    />
  );
}

function readStoredRecords() {
  if (typeof window === 'undefined') return [] as Array<Record<string, unknown>>;

  const storageKeys = ['userData', 'menuContext', 'sessionData', 'sessiondata', 'user_data', 'session', 'auth'];
  const records: Array<Record<string, unknown>> = [];

  for (const storage of [sessionStorage, localStorage]) {
    for (const key of storageKeys) {
      try {
        const raw = storage.getItem(key);
        if (!raw) continue;
        const parsed = asRecord(JSON.parse(raw));
        if (Object.keys(parsed).length > 0) {
          records.push(parsed);
        }
      } catch {
        continue;
      }
    }
  }

  return records;
}

function getNestedValue(source: unknown, keys: string[]): unknown {
  if (!source || typeof source !== 'object') return undefined;

  const record = source as Record<string, unknown>;
  for (const key of keys) {
    if (record[key] != null && record[key] !== '') {
      return record[key];
    }
  }

  for (const value of Object.values(record)) {
    if (value && typeof value === 'object') {
      const nestedValue = getNestedValue(value, keys);
      if (nestedValue != null && nestedValue !== '') {
        return nestedValue;
      }
    }
  }

  return undefined;
}

function readFirstStoredValue(keys: string[]): string {
  const records = readStoredRecords();

  for (const record of records) {
    const value = readString(getNestedValue(record, keys));
    if (value) return value;
  }

  if (typeof window !== 'undefined') {
    for (const storage of [sessionStorage, localStorage]) {
      for (const key of keys) {
        const value = readString(storage.getItem(key));
        if (value) return value;
      }
    }
  }

  return '';
}

function readStoredAcademicYears(): string[] {
  if (typeof window === 'undefined') return [];

  const values = new Set<string>();
  for (const record of readStoredRecords()) {
    const academicYears = Array.isArray(record.academicYears) ? record.academicYears : [];
    academicYears.forEach((entry) => {
      const year = readString(asRecord(entry).syear ?? asRecord(entry).academic_year);
      if (year) values.add(year);
    });
  }

  return Array.from(values).sort((left, right) => Number(left) - Number(right));
}

function resolveStudentCertificateSession(authContext?: {
  menuContext: {
    sub_institute_id: number;
    user_id: number;
    user_profile_name: string;
    user_profile_id: number;
    client_id: number;
  } | null;
  academicYears: Array<Record<string, unknown>>;
}) {
  const helperSession = getFeesSession();
  const storedMenuContext = getStoredMenuContext();
  const menuContext = authContext?.menuContext ?? storedMenuContext;
  const academicYears = authContext?.academicYears?.length
    ? authContext.academicYears
        .map((entry) => readString(asRecord(entry).syear ?? asRecord(entry).academic_year))
        .filter(Boolean)
    : readStoredAcademicYears();

  const token =
    helperSession.token ||
    readFirstStoredValue(['user_token', 'token']);
  const subInstituteId =
    helperSession.subInstituteId ||
    readString(menuContext?.sub_institute_id) ||
    readFirstStoredValue(['sub_institute_id', 'subInstituteId', 'subInstituteID']);
  const academicYearId =
    helperSession.academicYearId ||
    readFirstStoredValue(['selectedAcademicYear', 'syear', 'academic_year_id', 'academicYearId']) ||
    academicYears[0] ||
    '';
  const userId =
    helperSession.userId ||
    readString(menuContext?.user_id) ||
    readFirstStoredValue(['user_id', 'userId', 'id']);
  const userProfileId =
    helperSession.userProfileId ||
    readString(menuContext?.user_profile_id) ||
    readFirstStoredValue(['user_profile_id', 'userProfileId', 'profile_id', 'profileId']);
  const userProfileName =
    helperSession.userProfileName ||
    readString(menuContext?.user_profile_name) ||
    readFirstStoredValue(['user_profile_name', 'userProfileName', 'profile_name', 'profileName']);
  const clientId =
    helperSession.clientId ||
    readString(menuContext?.client_id) ||
    readFirstStoredValue(['client_id', 'clientId']);

  return {
    ...helperSession,
    token,
    subInstituteId,
    academicYearId,
    userId,
    userProfileId,
    userProfileName,
    clientId,
  };
}

export default function StudentCertificateModule({
  initialViewMode = 'issue',
}: {
  initialViewMode?: ViewMode;
}) {
  const { menuContext, academicYears } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
  const [templateOptions, setTemplateOptions] = useState<TemplateOption[]>([]);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateError, setTemplateError] = useState<HtmlMessage | null>(null);

  const [issueSection, setIssueSection] = useState('');
  const [issueStandard, setIssueStandard] = useState('');
  const [issueDivision, setIssueDivision] = useState('');
  const [issueStudentName, setIssueStudentName] = useState('');
  const [issueUniqueId, setIssueUniqueId] = useState('');
  const [issueMobile, setIssueMobile] = useState('');
  const [issueGrNo, setIssueGrNo] = useState('');
  const [issueRows, setIssueRows] = useState<StudentSearchRow[]>([]);
  const [issueLoading, setIssueLoading] = useState(false);
  const [issueMessage, setIssueMessage] = useState<HtmlMessage | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [certificateReason, setCertificateReason] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewMessage, setPreviewMessage] = useState<HtmlMessage | null>(null);
  const [previewPayload, setPreviewPayload] = useState<PreviewPayload | null>(null);
  const [issueSaveLoading, setIssueSaveLoading] = useState(false);

  const [historySection, setHistorySection] = useState('');
  const [historyStandard, setHistoryStandard] = useState('');
  const [historyDivision, setHistoryDivision] = useState('');
  const [historyStudentName, setHistoryStudentName] = useState('');
  const [historyUniqueId, setHistoryUniqueId] = useState('');
  const [historyMobile, setHistoryMobile] = useState('');
  const [historyGrNo, setHistoryGrNo] = useState('');
  const [historyFromDate, setHistoryFromDate] = useState('');
  const [historyToDate, setHistoryToDate] = useState('');
  const [historyCertificateType, setHistoryCertificateType] = useState('');
  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyMessage, setHistoryMessage] = useState<HtmlMessage | null>(null);
  const [historyQuickSearch, setHistoryQuickSearch] = useState('');
  const [historySortKey, setHistorySortKey] = useState<SortKey>('createdAt');
  const [historySortDirection, setHistorySortDirection] = useState<SortDirection>('desc');
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(25);
  const [historyPreview, setHistoryPreview] = useState<HistoryRow | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadTemplateOptions() {
      const session = resolveStudentCertificateSession({ menuContext, academicYears });
      if (!session.subInstituteId || !session.academicYearId) {
        setTemplateError({
          type: 'error',
          text: 'Session institute or academic year is missing. Please sign in again.',
        });
        return;
      }

      setTemplateLoading(true);
      setTemplateError(null);

      try {
        const params = new URLSearchParams({
          path: 'student/api/student_certificate/templates',
          type: 'API',
        });
        appendSessionParams(params, session);

        const response = await fetch(`/api/proxy?${params.toString()}`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });

        const responseBody = await response.json();
        const payload = normalizePayload(responseBody);

        if (!response.ok || readStatus(payload) !== 1) {
          throw new Error(readMessage(payload, 'Unable to load certificate templates.'));
        }

        if (!isMounted) {
          return;
        }

        const options = parseTemplateOptions(payload);
        setTemplateOptions(options);
        if (!selectedTemplate && options.length > 0) {
          setSelectedTemplate(options[0].moduleName);
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setTemplateError({
          type: 'error',
          text: error instanceof Error ? error.message : 'Unable to load certificate templates.',
        });
      } finally {
        if (isMounted) {
          setTemplateLoading(false);
        }
      }
    }

    void loadTemplateOptions();

    return () => {
      isMounted = false;
    };
  }, [academicYears, menuContext, selectedTemplate]);

  const historyExportColumns = useMemo<TableExportColumn[]>(() => [
    { key: 'srNo', label: 'Sr No', align: 'center' },
    { key: 'enrollmentNo', label: 'GR No' },
    { key: 'studentName', label: 'Student Name', width: '220px' },
    { key: 'standardName', label: 'Standard' },
    { key: 'divisionName', label: 'Division' },
    { key: 'certificateNumber', label: 'Certificate No.' },
    { key: 'certificateType', label: 'Certificate Type', width: '220px' },
    { key: 'createdAt', label: 'Created At', width: '160px' },
  ], []);

  const filteredAndSortedHistoryRows = useMemo(() => {
    const query = historyQuickSearch.trim().toLowerCase();

    const filteredRows = historyRows.filter((row) => {
      if (!query) {
        return true;
      }

      return [
        row.enrollmentNo,
        row.studentName,
        row.standardName,
        row.divisionName,
        row.certificateNumber,
        row.certificateType,
        row.createdAt,
      ].some((value) => value.toLowerCase().includes(query));
    });

    const sortedRows = [...filteredRows].sort((left, right) => {
      const leftValue = left[historySortKey].toLowerCase();
      const rightValue = right[historySortKey].toLowerCase();

      if (leftValue < rightValue) {
        return historySortDirection === 'asc' ? -1 : 1;
      }

      if (leftValue > rightValue) {
        return historySortDirection === 'asc' ? 1 : -1;
      }

      return 0;
    });

    return sortedRows;
  }, [historyQuickSearch, historyRows, historySortDirection, historySortKey]);

  const historyTotalPages = Math.max(1, Math.ceil(filteredAndSortedHistoryRows.length / historyPageSize));
  const currentHistoryPage = Math.min(historyPage, historyTotalPages);

  const paginatedHistoryRows = useMemo(() => {
    const startIndex = (currentHistoryPage - 1) * historyPageSize;
    return filteredAndSortedHistoryRows.slice(startIndex, startIndex + historyPageSize);
  }, [currentHistoryPage, filteredAndSortedHistoryRows, historyPageSize]);

  const historyExportRows = useMemo<TableExportRow[]>(() => (
    filteredAndSortedHistoryRows.map((row, index) => ({
      srNo: String(index + 1),
      enrollmentNo: row.enrollmentNo || '-',
      studentName: row.studentName || '-',
      standardName: row.standardName || '-',
      divisionName: row.divisionName || '-',
      certificateNumber: row.certificateNumber || '-',
      certificateType: row.certificateType || '-',
      createdAt: formatDateTimeDisplay(row.createdAt),
    }))
  ), [filteredAndSortedHistoryRows]);

  const handleIssueSectionChange = (value: DropdownValue, selectedData: AcademicSection[]) => {
    setIssueSection(getSingleValue(value));
    setIssueStandard('');
    setIssueDivision('');
    void selectedData;
  };

  const handleIssueStandardChange = (value: DropdownValue, selectedData: Standard[]) => {
    setIssueStandard(getSingleValue(value));
    setIssueDivision('');
    void selectedData;
  };

  const handleIssueDivisionChange = (value: DropdownValue, selectedData: Division[]) => {
    setIssueDivision(getSingleValue(value));
    void selectedData;
  };

  const handleHistorySectionChange = (value: DropdownValue, selectedData: AcademicSection[]) => {
    setHistorySection(getSingleValue(value));
    setHistoryStandard('');
    setHistoryDivision('');
    void selectedData;
  };

  const handleHistoryStandardChange = (value: DropdownValue, selectedData: Standard[]) => {
    setHistoryStandard(getSingleValue(value));
    setHistoryDivision('');
    void selectedData;
  };

  const handleHistoryDivisionChange = (value: DropdownValue, selectedData: Division[]) => {
    setHistoryDivision(getSingleValue(value));
    void selectedData;
  };

  const handleIssueSearch = async () => {
    const session = resolveStudentCertificateSession({ menuContext, academicYears });
    if (!session.subInstituteId || !session.academicYearId) {
      setIssueMessage({
        type: 'error',
        text: 'Session institute or academic year is missing. Please sign in again.',
      });
      setIssueRows([]);
      return;
    }

    setIssueLoading(true);
    setIssueMessage(null);
    setPreviewPayload(null);
    setPreviewMessage(null);
    setSelectedStudentIds([]);

    try {
      const params = new URLSearchParams({
        path: 'student/api/student_certificate/search',
      });

      const body = new URLSearchParams();
      appendSessionParams(body, session);
      body.set('grade', issueSection);
      body.set('standard', issueStandard);
      body.set('division', issueDivision);
      body.set('stu_name', issueStudentName);
      body.set('uniqueid', issueUniqueId);
      body.set('mobile', issueMobile);
      body.set('grno', issueGrNo);

      const response = await fetch(`/api/proxy?${params.toString()}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        },
        body: body.toString(),
      });

      const responseBody = await response.json();
      const payload = normalizePayload(responseBody);

      if (!response.ok || readStatus(payload) !== 1) {
        throw new Error(readMessage(payload, 'Unable to fetch students.'));
      }

      const rows = parseStudentRows(payload);
      setIssueRows(rows);
      setIssueMessage({
        type: rows.length > 0 ? 'success' : 'info',
        text: readMessage(payload, rows.length > 0 ? 'Students loaded successfully.' : 'No students found.'),
      });
    } catch (error) {
      setIssueRows([]);
      setIssueMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to fetch students.',
      });
    } finally {
      setIssueLoading(false);
    }
  };

  const handleSelectAllStudents = (checked: boolean) => {
    setSelectedStudentIds(checked ? issueRows.map((row) => row.id) : []);
  };

  const handleToggleStudent = (studentId: string, checked: boolean) => {
    setSelectedStudentIds((current) => (
      checked
        ? [...current, studentId]
        : current.filter((value) => value !== studentId)
    ));
  };

  const handleGeneratePreview = async () => {
    const session = resolveStudentCertificateSession({ menuContext, academicYears });

    if (!session.subInstituteId || !session.academicYearId) {
      setPreviewMessage({
        type: 'error',
        text: 'Session institute or academic year is missing. Please sign in again.',
      });
      return;
    }

    if (!selectedTemplate) {
      setPreviewMessage({
        type: 'info',
        text: 'Select a certificate template before generating the preview.',
      });
      return;
    }

    if (selectedStudentIds.length === 0) {
      setPreviewMessage({
        type: 'info',
        text: 'Select at least one student before generating the preview.',
      });
      return;
    }

    setPreviewLoading(true);
    setPreviewMessage(null);
    setPreviewPayload(null);

    try {
      const params = new URLSearchParams({
        path: 'student/api/student_certificate/preview',
      });

      const body = new URLSearchParams();
      appendSessionParams(body, session);
      body.set('grade_id', issueSection);
      body.set('standard_id', issueStandard);
      body.set('template', selectedTemplate);
      body.set('certificate_reason', certificateReason);
      selectedStudentIds.forEach((studentId) => body.append('students[]', studentId));

      const response = await fetch(`/api/proxy?${params.toString()}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        },
        body: body.toString(),
      });

      const responseBody = await response.json();
      const payload = normalizePayload(responseBody);

      if (!response.ok || readStatus(payload) !== 1) {
        throw new Error(readMessage(payload, 'Unable to generate certificate preview.'));
      }

      const preview = parsePreviewPayload(payload);
      if (!preview) {
        throw new Error('Certificate preview HTML was not returned by Laravel.');
      }

      setPreviewPayload(preview);
      setPreviewMessage({
        type: 'success',
        text: readMessage(payload, 'Certificate preview generated successfully.'),
      });
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Unable to generate certificate preview.';
      setPreviewMessage({
        type: 'error',
        text,
        allowHtml: text.includes('<a '),
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleIssueCertificate = async () => {
    const session = resolveStudentCertificateSession({ menuContext, academicYears });
    if (!session.subInstituteId || !session.academicYearId) {
      setPreviewMessage({
        type: 'error',
        text: 'Session institute or academic year is missing. Please sign in again.',
      });
      return;
    }

    if (!previewPayload) {
      setPreviewMessage({
        type: 'info',
        text: 'Generate the certificate preview before issuing certificates.',
      });
      return;
    }

    setIssueSaveLoading(true);

    try {
      const params = new URLSearchParams({
        path: 'student/api/student_certificate/save',
      });

      const body = new URLSearchParams();
      appendSessionParams(body, session);
      body.set('insert_student_ids', previewPayload.insertIds);
      body.set('template', previewPayload.template);
      body.set('certificate_reason', certificateReason);

      const response = await fetch(`/api/proxy?${params.toString()}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        },
        body: body.toString(),
      });

      const responseBody = await response.json();
      const payload = normalizePayload(responseBody);

      if (!response.ok || readStatus(payload) !== 1) {
        throw new Error(readMessage(payload, 'Unable to issue certificates.'));
      }

      setPreviewMessage({
        type: 'success',
        text: readMessage(payload, 'Certificates issued successfully.'),
      });
      setHistoryCertificateType(previewPayload.template);
      setViewMode('history');
      await handleHistorySearch(previewPayload.template);
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Unable to issue certificates.';
      setPreviewMessage({
        type: 'error',
        text,
      });
    } finally {
      setIssueSaveLoading(false);
    }
  };

  const handleHistorySearch = async (certificateTypeOverride?: string) => {
    const session = resolveStudentCertificateSession({ menuContext, academicYears });
    if (!session.subInstituteId || !session.academicYearId) {
      setHistoryMessage({
        type: 'error',
        text: 'Session institute or academic year is missing. Please sign in again.',
      });
      setHistoryRows([]);
      return;
    }

    setHistoryLoading(true);
    setHistoryMessage(null);
    setHistoryPage(1);

    try {
      const params = new URLSearchParams({
        path: 'student/api/student_certificate/history',
        type: 'API',
      });
      appendSessionParams(params, session);
      params.set('grade', historySection);
      params.set('standard', historyStandard);
      params.set('division', historyDivision);
      params.set('stu_name', historyStudentName);
      params.set('uniqueid', historyUniqueId);
      params.set('mobile', historyMobile);
      params.set('grno', historyGrNo);
      params.set('from_date', historyFromDate);
      params.set('to_date', historyToDate);
      params.set('certificate_type', certificateTypeOverride ?? historyCertificateType);

      const response = await fetch(`/api/proxy?${params.toString()}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      const responseBody = await response.json();
      const payload = normalizePayload(responseBody);

      if (!response.ok || readStatus(payload) !== 1) {
        throw new Error(readMessage(payload, 'Unable to fetch certificate history.'));
      }

      const rows = parseHistoryRows(payload);
      setHistoryRows(rows);
      setHistoryMessage({
        type: rows.length > 0 ? 'success' : 'info',
        text: readMessage(payload, rows.length > 0 ? 'Certificate history loaded successfully.' : 'No certificate history found.'),
      });
    } catch (error) {
      setHistoryRows([]);
      setHistoryMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to fetch certificate history.',
      });
    } finally {
      setHistoryLoading(false);
    }
  };

  const toggleHistorySort = (key: SortKey) => {
    if (historySortKey === key) {
      setHistorySortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setHistorySortKey(key);
    setHistorySortDirection(key === 'createdAt' ? 'desc' : 'asc');
  };

  const issueAllSelected = issueRows.length > 0 && selectedStudentIds.length === issueRows.length;
  const isReportOnly = initialViewMode === 'history';

  return (
    <PageFrame>
      <PageHeader
        title={isReportOnly ? 'Student Certificate Report' : 'Student Certificate'}
        description={isReportOnly
          ? 'Mirror the Laravel Student Certificate History report with the same filters, exports, quick search, and certificate reprint flow.'
          : 'Port the Laravel student certificate issue and history workflows into the existing Next.js ERP architecture using the current proxy and shared UI patterns.'}
        action={(
          <div className="flex flex-wrap items-center gap-2">
            {!isReportOnly && (
              <Button
                type="button"
                variant={viewMode === 'issue' ? 'default' : 'outline'}
                onClick={() => setViewMode('issue')}
              >
                <FileCheck2 className="h-4 w-4" />
                Issue Certificate
              </Button>
            )}
            <Button
              type="button"
              variant={viewMode === 'history' ? 'default' : 'outline'}
              onClick={() => setViewMode('history')}
            >
              <History className="h-4 w-4" />
              Certificate History
            </Button>
          </div>
        )}
      />

      <HtmlMessageBanner message={templateError} />

      {viewMode === 'issue' && !isReportOnly ? (
        <>
          <SectionPanel
            title="Search Students"
            description="Match the Laravel Student Certificate search panel by grade, standard, division, student name, unique ID, mobile, and GR number."
          >
            <div className="space-y-4">
              <SearchDropdown
                fields={['section', 'standard', 'division']}
                values={{ section: issueSection, standard: issueStandard, division: issueDivision }}
                labels={{ section: 'Grade', standard: 'Standard', division: 'Division' }}
                placeholders={{ section: 'Select grade', standard: 'Select standard', division: 'Select division' }}
                onSectionChange={handleIssueSectionChange}
                onStandardChange={handleIssueStandardChange}
                onDivisionChange={handleIssueDivisionChange}
              />

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Student name">
                  <Input value={issueStudentName} onChange={(event) => setIssueStudentName(event.target.value)} placeholder="Enter student name" />
                </Field>
                <Field label="Unique ID">
                  <Input value={issueUniqueId} onChange={(event) => setIssueUniqueId(event.target.value)} placeholder="Enter unique ID" />
                </Field>
                <Field label="Mobile">
                  <Input value={issueMobile} onChange={(event) => setIssueMobile(event.target.value)} placeholder="Enter mobile number" />
                </Field>
                <Field label="GR No">
                  <Input value={issueGrNo} onChange={(event) => setIssueGrNo(event.target.value)} placeholder="Enter GR number" />
                </Field>
              </div>

              <div className="flex justify-end">
                <Button type="button" onClick={handleIssueSearch} disabled={issueLoading}>
                  {issueLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Search
                </Button>
              </div>
            </div>
          </SectionPanel>

          <HtmlMessageBanner message={issueMessage} />

          <SectionPanel
            title="Students"
            description="Select one or more students, choose a template from Laravel, and generate the certificate preview before final issuance."
          >
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Field label="Certificate template">
                  <NativeSelect
                    value={selectedTemplate}
                    onChange={setSelectedTemplate}
                    disabled={templateLoading || templateOptions.length === 0}
                    required
                  >
                    <option value="">
                      {templateLoading ? 'Loading templates...' : 'Select certificate template'}
                    </option>
                    {templateOptions.map((option) => (
                      <option key={option.id} value={option.moduleName}>
                        {option.moduleName}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Certificate reason">
                  <Input
                    value={certificateReason}
                    onChange={(event) => setCertificateReason(event.target.value)}
                    placeholder="Enter certificate reason"
                  />
                </Field>
                <div className="flex items-end justify-end">
                  <Button type="button" onClick={handleGeneratePreview} disabled={previewLoading || issueRows.length === 0}>
                    {previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                    Generate Preview
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <Table className="min-w-[760px]">
                  <TableHeader>
                    <TableRow className="bg-slate-100 hover:bg-slate-100">
                      <TableHead className="w-16 text-center">
                        <input
                          type="checkbox"
                          aria-label="Select all students"
                          checked={issueAllSelected}
                          onChange={(event) => handleSelectAllStudents(event.target.checked)}
                        />
                      </TableHead>
                      <TableHead>GR No</TableHead>
                      <TableHead>Student Name</TableHead>
                      <TableHead>Standard</TableHead>
                      <TableHead>Division</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {issueLoading ? (
                      <LoadingRows colSpan={5} label="Loading students" />
                    ) : issueRows.length > 0 ? (
                      issueRows.map((row) => (
                        <TableRow key={row.id} className="odd:bg-white even:bg-slate-50/60">
                          <TableCell className="text-center">
                            <input
                              type="checkbox"
                              aria-label={`Select ${row.studentName}`}
                              checked={selectedStudentIds.includes(row.id)}
                              onChange={(event) => handleToggleStudent(row.id, event.target.checked)}
                            />
                          </TableCell>
                          <TableCell>{row.enrollmentNo || '-'}</TableCell>
                          <TableCell className="font-medium text-slate-950">{row.studentName || '-'}</TableCell>
                          <TableCell>{row.standardName || '-'}</TableCell>
                          <TableCell>{row.divisionName || '-'}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <EmptyTableRow colSpan={5} label="Search to load students for certificate issuance." />
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </SectionPanel>

          <HtmlMessageBanner message={previewMessage} />

          <SectionPanel
            title="Preview"
            description="Laravel returns generated certificate HTML, so the Next.js frontend preserves that preview and print flow without recreating certificate markup."
            footer={(
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => openCertificatePrintWindow('Student Certificate Preview', previewPayload?.html || '')}
                  disabled={!previewPayload}
                >
                  <Printer className="h-4 w-4" />
                  Print Preview
                </Button>
                <Button
                  type="button"
                  onClick={handleIssueCertificate}
                  disabled={!previewPayload || issueSaveLoading}
                >
                  {issueSaveLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />}
                  Issue Certificate
                </Button>
              </div>
            )}
          >
            {previewPayload ? (
              <div className="overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div
                  className="mx-auto min-w-[760px] max-w-[980px] bg-white p-4 shadow-sm"
                  dangerouslySetInnerHTML={{ __html: previewPayload.html }}
                />
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-12 text-center text-sm text-slate-600">
                Generate a preview to review the certificate HTML returned by Laravel.
              </div>
            )}
          </SectionPanel>
        </>
      ) : (
        <>
          <SectionPanel
            title="History Filters"
            description="Match the Laravel Student Certificate History filters, including date range and certificate type, then export or re-open the saved certificate HTML."
          >
            <div className="space-y-4">
              <SearchDropdown
                fields={['section', 'standard', 'division']}
                values={{ section: historySection, standard: historyStandard, division: historyDivision }}
                labels={{ section: 'Grade', standard: 'Standard', division: 'Division' }}
                placeholders={{ section: 'Select grade', standard: 'Select standard', division: 'Select division' }}
                onSectionChange={handleHistorySectionChange}
                onStandardChange={handleHistoryStandardChange}
                onDivisionChange={handleHistoryDivisionChange}
              />

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Student name">
                  <Input value={historyStudentName} onChange={(event) => setHistoryStudentName(event.target.value)} placeholder="Enter student name" />
                </Field>
                <Field label="Unique ID">
                  <Input value={historyUniqueId} onChange={(event) => setHistoryUniqueId(event.target.value)} placeholder="Enter unique ID" />
                </Field>
                <Field label="Mobile">
                  <Input value={historyMobile} onChange={(event) => setHistoryMobile(event.target.value)} placeholder="Enter mobile number" />
                </Field>
                <Field label="GR No">
                  <Input value={historyGrNo} onChange={(event) => setHistoryGrNo(event.target.value)} placeholder="Enter GR number" />
                </Field>
                <Field label="From date">
                  <Input type="date" value={historyFromDate} onChange={(event) => setHistoryFromDate(event.target.value)} />
                </Field>
                <Field label="To date">
                  <Input type="date" value={historyToDate} onChange={(event) => setHistoryToDate(event.target.value)} />
                </Field>
                <Field label="Certificate type">
                  <NativeSelect
                    value={historyCertificateType}
                    onChange={setHistoryCertificateType}
                    disabled={templateLoading || templateOptions.length === 0}
                  >
                    <option value="">
                      {templateLoading ? 'Loading templates...' : 'Select certificate type'}
                    </option>
                    {templateOptions.map((option) => (
                      <option key={option.id} value={option.moduleName}>
                        {option.moduleName}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <div className="flex items-end justify-end">
                  <Button type="button" onClick={() => void handleHistorySearch()} disabled={historyLoading}>
                    {historyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    Search
                  </Button>
                </div>
              </div>
            </div>
          </SectionPanel>

          <HtmlMessageBanner message={historyMessage} />

          <SectionPanel
            title="Certificate History"
            description="Client-side quick search, sorting, pagination, export, and reprint sit on top of the Laravel-filtered certificate history response."
            footer={(
              filteredAndSortedHistoryRows.length > 0 ? (
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-3 text-sm text-slate-600">
                    <span>
                      Showing {(currentHistoryPage - 1) * historyPageSize + 1}-
                      {Math.min(currentHistoryPage * historyPageSize, filteredAndSortedHistoryRows.length)} of {filteredAndSortedHistoryRows.length}
                    </span>
                    <div className="flex items-center gap-2">
                      <span>Rows</span>
                      <NativeSelect value={String(historyPageSize)} onChange={(value) => setHistoryPageSize(Number(value))}>
                        <option value="10">10</option>
                        <option value="25">25</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                      </NativeSelect>
                    </div>
                  </div>

                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setHistoryPage((current) => Math.max(1, current - 1))}
                          className={currentHistoryPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationLink isActive>{currentHistoryPage}</PaginationLink>
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setHistoryPage((current) => Math.min(historyTotalPages, current + 1))}
                          className={currentHistoryPage >= historyTotalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              ) : null
            )}
          >
            <div className="space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="w-full max-w-md">
                  <Input
                    value={historyQuickSearch}
                    onChange={(event) => {
                      setHistoryQuickSearch(event.target.value);
                      setHistoryPage(1);
                    }}
                    placeholder="Quick search loaded history rows"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => exportRowsAsCsv({ filename: 'student-certificate-history.csv', columns: historyExportColumns, rows: historyExportRows })}
                    disabled={historyExportRows.length === 0}
                  >
                    <Download className="h-4 w-4" />
                    CSV
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => exportRowsAsExcel({ filename: 'student-certificate-history.xls', title: 'Student Certificate History', columns: historyExportColumns, rows: historyExportRows })}
                    disabled={historyExportRows.length === 0}
                  >
                    <Download className="h-4 w-4" />
                    Excel
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => exportRowsAsPdf({
                      filename: 'student-certificate-history.pdf',
                      title: 'Student Certificate History',
                      subtitle: 'Legacy parity certificate history export',
                      columns: historyExportColumns,
                      rows: historyExportRows,
                    })}
                    disabled={historyExportRows.length === 0}
                  >
                    <Download className="h-4 w-4" />
                    PDF
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => openPrintPreview({
                      title: 'Student Certificate History',
                      subtitle: 'Legacy parity certificate history report',
                      columns: historyExportColumns,
                      rows: historyExportRows,
                    })}
                    disabled={historyExportRows.length === 0}
                  >
                    <Printer className="h-4 w-4" />
                    Print
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <Table className="min-w-[1180px]">
                  <TableHeader>
                    <TableRow className="bg-slate-100 hover:bg-slate-100">
                      <TableHead className="text-center">Sr No</TableHead>
                      <TableHead className="cursor-pointer" onClick={() => toggleHistorySort('enrollmentNo')}>GR No</TableHead>
                      <TableHead className="cursor-pointer" onClick={() => toggleHistorySort('studentName')}>Student Name</TableHead>
                      <TableHead className="cursor-pointer" onClick={() => toggleHistorySort('standardName')}>Standard</TableHead>
                      <TableHead className="cursor-pointer" onClick={() => toggleHistorySort('divisionName')}>Division</TableHead>
                      <TableHead className="cursor-pointer" onClick={() => toggleHistorySort('certificateNumber')}>Certificate No.</TableHead>
                      <TableHead className="cursor-pointer" onClick={() => toggleHistorySort('certificateType')}>Certificate Type</TableHead>
                      <TableHead className="cursor-pointer" onClick={() => toggleHistorySort('createdAt')}>Created At</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyLoading ? (
                      <LoadingRows colSpan={9} label="Loading certificate history" />
                    ) : paginatedHistoryRows.length > 0 ? (
                      paginatedHistoryRows.map((row, index) => (
                        <TableRow key={row.certiId} className="odd:bg-white even:bg-slate-50/60">
                          <TableCell className="text-center">{(currentHistoryPage - 1) * historyPageSize + index + 1}</TableCell>
                          <TableCell>{row.enrollmentNo || '-'}</TableCell>
                          <TableCell className="font-medium text-slate-950">{row.studentName || '-'}</TableCell>
                          <TableCell>{row.standardName || '-'}</TableCell>
                          <TableCell>{row.divisionName || '-'}</TableCell>
                          <TableCell>{row.certificateNumber || '-'}</TableCell>
                          <TableCell>{row.certificateType || '-'}</TableCell>
                          <TableCell>{formatDateTimeDisplay(row.createdAt)}</TableCell>
                          <TableCell className="text-center">
                            <Button type="button" variant="outline" size="sm" onClick={() => setHistoryPreview(row)}>
                              <Eye className="h-4 w-4" />
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <EmptyTableRow colSpan={9} label="Search to load certificate history." />
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </SectionPanel>
        </>
      )}

      {historyPreview && (
        <ReceiptPreviewModal
          title={`Certificate ${historyPreview.certificateNumber || historyPreview.certiId}`}
          html={historyPreview.certificateHtml}
          onClose={() => setHistoryPreview(null)}
        />
      )}
    </PageFrame>
  );
}
