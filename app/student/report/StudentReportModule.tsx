'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  FileBarChart,
  FileSearch,
  HeartPulse,
  Loader2,
  Search,
  Settings2,
  ShieldAlert,
  Users,
} from 'lucide-react';

import { searchInfirmaryStudents, type StudentOption } from '../student_infirmary/api';
import { Modal } from '@/components/result/primitives';
import SearchDropdown from '@/components/search-dropdown/SearchDropdown';
import type {
  AcademicSection,
  Division,
  DropdownValue,
  Standard,
} from '@/components/search-dropdown/types';
import { RecordTable, type RecordColumn } from '@/components/erp/RecordTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  EmptyTableRow,
  Field,
  InlineMessage,
  NativeMultiSelect,
  NativeSelect,
  PageFrame,
  PageHeader,
  SectionPanel,
} from '@/app/fees/_components/fees-shared';
import {
  exportRowsAsCsv,
  exportRowsAsExcel,
  exportRowsAsPdf,
  openPrintPreview,
  type TableExportColumn,
  type TableExportRow,
} from '@/lib/table-export';
import {
  fetchAgewiseReport,
  fetchMissingDocumentReport,
  fetchStudentDisciplineReport,
  fetchStudentHealthReport,
  fetchStudentListingReport,
  fetchStudentRequestReport,
  fetchStudentStrengthReport,
  formatCellValue,
  loadDynamicBootstrap,
  loadStrengthFilterOptions,
  STUDENT_HEALTH_TYPE_OPTIONS,
  STUDENT_REPORT_ORDER_OPTIONS,
  STRENGTH_GENERAL_OPTIONS,
  STRENGTH_GENDER_OPTIONS,
  type DisciplineSummaryRow,
  type DynamicFieldGroup,
  type FlatRow,
  type StrengthFilterOptions,
  type StudentReportKind,
} from './_lib/student-report';

type ReportMessage = {
  type: 'success' | 'error' | 'info';
  text: string;
};

type LabelledKey = {
  key: string;
  label: string;
};

const CHART_COLORS = ['#2563eb', '#0f766e', '#f97316', '#7c3aed', '#dc2626', '#0891b2'];

function toTitle(kind: StudentReportKind) {
  switch (kind) {
    case 'student_report':
      return 'Student Report';
    case 'inactive_student_report':
      return 'In-active Student Report';
    case 'missing_document_report':
      return 'Missing Document Report';
    case 'student_request_report':
      return 'Student Request Report';
    case 'student_health_report':
      return 'Student Health Report';
    case 'student_discipline_report':
      return 'Student Discipline Report';
    case 'student_strength_report':
      return 'Student Strength Report';
    case 'agewise_report':
      return 'Agewise Report';
  }
}

function toDescription(kind: StudentReportKind) {
  switch (kind) {
    case 'student_report':
      return 'Active-student listing with legacy dynamic fields, ordering, export, and visual summaries.';
    case 'inactive_student_report':
      return 'Inactive-student listing with the same dynamic field model as the legacy ERP.';
    case 'missing_document_report':
      return 'Student and staff document completeness report using the legacy endpoint and document mapping.';
    case 'student_request_report':
      return 'Date-filtered student request report with request, reason, and description parity.';
    case 'student_health_report':
      return 'Health report that reuses the current ERP proxy and health-type filters.';
    case 'student_discipline_report':
      return 'Discipline report with both entry-level rows and student summary data from the old ERP.';
    case 'student_strength_report':
      return 'Strength report with general, gender, religion, cast, and quota slices bound to the Laravel aggregation.';
    case 'agewise_report':
      return 'Agewise class matrix recreated from the legacy report with the same totals.';
  }
}

function getSingleValue(value: DropdownValue | undefined): string {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">{title}</h3>
      <div className="h-72">{children}</div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
    </div>
  );
}

function DynamicFieldPickerButton({
  groups,
  selected,
  onChange,
}: {
  groups: DynamicFieldGroup[];
  selected: string[];
  onChange: (value: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="outline" className="h-10" onClick={() => setOpen(true)}>
        <Settings2 className="h-4 w-4" />
        Choose Field {selected.length > 0 ? `(${selected.length})` : ''}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Choose Field" size="xl">
        <DynamicFieldPicker groups={groups} selected={selected} onChange={onChange} />
      </Modal>
    </>
  );
}

function DynamicFieldPicker({
  groups,
  selected,
  onChange,
}: {
  groups: DynamicFieldGroup[];
  selected: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <div className="space-y-4">
      {groups.length === 0 ? (
        <p className="text-sm text-slate-500">No dynamic fields were returned for this report.</p>
      ) : null}
      {groups.map((group) => {
        const groupIds = group.options.map((option) => option.id);
        const allChecked = groupIds.length > 0 && groupIds.every((id) => selected.includes(id));

        const toggleAll = () => {
          if (allChecked) {
            onChange(selected.filter((value) => !groupIds.includes(value)));
            return;
          }
          onChange([...new Set([...selected, ...groupIds])]);
        };

        return (
          <div key={group.title} className="rounded-lg border border-slate-200 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-900">{group.title}</h4>
              <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <input type="checkbox" checked={allChecked} onChange={toggleAll} />
                Check All
              </label>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
              {group.options.map((option) => {
                const checked = selected.includes(option.id);
                return (
                  <label key={option.id} className="flex items-start gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={checked}
                      onChange={(event) => {
                        if (event.target.checked) {
                          onChange([...selected, option.id]);
                          return;
                        }
                        onChange(selected.filter((value) => value !== option.id));
                      }}
                    />
                    <span>{option.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function buildFlatColumns(headers: LabelledKey[], kind?: StudentReportKind): Array<RecordColumn<FlatRow>> {
  return headers.map((header) => {
    // Same Student Name + GR No pairing used by the "Add Student Infirmary" picker
    // (app/student/student_infirmary/page.tsx): bold name, muted GR No alongside it.
    if (kind === 'student_discipline_report' && header.key === 'student_name') {
      return {
        key: header.key,
        label: header.label,
        value: (row) => {
          const name = formatCellValue('student_name', row.student_name);
          const grNo = row.enrollment_no == null || row.enrollment_no === '' ? '' : String(row.enrollment_no);
          return grNo ? `${name} (${grNo})` : name;
        },
        render: (row) => {
          const name = formatCellValue('student_name', row.student_name);
          const grNo = row.enrollment_no == null || row.enrollment_no === '' ? '' : String(row.enrollment_no);
          return (
            <span>
              <span className="font-medium">{name}</span>
              {grNo && <span className="ml-2 text-slate-400">{grNo}</span>}
            </span>
          );
        },
        sortable: true,
      };
    }

    return {
      key: header.key,
      label: header.label,
      value: (row) => formatCellValue(header.key, row[header.key]),
      render: (row) => {
        const value = formatCellValue(header.key, row[header.key]);
        if (value === 'Submitted') return <span className="font-medium text-emerald-700">Submitted</span>;
        if (value === 'Missing') return <span className="font-medium text-red-600">Missing</span>;
        if (header.key === 'flag_text') {
          return (
            <span className={value === 'Positive' ? 'font-medium text-emerald-700' : value === 'Negative' ? 'font-medium text-red-600' : ''}>
              {value}
            </span>
          );
        }
        return value;
      },
      sortable: true,
    };
  });
}

function selectionSummary(sectionLabel: string, standardLabel: string, divisionLabel: string) {
  return [sectionLabel, standardLabel, divisionLabel].filter(Boolean).join(' | ');
}

export default function StudentReportModule({ kind }: { kind: StudentReportKind }) {
  const [section, setSection] = useState('');
  const [standard, setStandard] = useState('');
  const [division, setDivision] = useState('');
  const [sectionLabel, setSectionLabel] = useState('');
  const [standardLabel, setStandardLabel] = useState('');
  const [divisionLabel, setDivisionLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [message, setMessage] = useState<ReportMessage | null>(null);

  const [dynamicGroups, setDynamicGroups] = useState<DynamicFieldGroup[]>([]);
  const [selectedDynamicFields, setSelectedDynamicFields] = useState<string[]>([]);
  const [orderBy, setOrderBy] = useState('student_name');
  const [userType, setUserType] = useState('student');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [healthType, setHealthType] = useState('student_infirmary');
  const [studentName, setStudentName] = useState('');
  const [uniqueId, setUniqueId] = useState('');
  const [mobile, setMobile] = useState('');
  const [grno, setGrno] = useState('');
  const [studentQuery, setStudentQuery] = useState('');
  const [studentOptions, setStudentOptions] = useState<StudentOption[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const [oneDate, setOneDate] = useState('add');
  const [standardWise, setStandardWise] = useState<string[]>(['standard']);
  const [general, setGeneral] = useState<string[]>([]);
  const [strengthFilters, setStrengthFilters] = useState<string[]>(['M', 'F']);
  const [religion, setReligion] = useState<string[]>([]);
  const [cast, setCast] = useState<string[]>([]);
  const [quota, setQuota] = useState<string[]>([]);
  const [strengthOptions, setStrengthOptions] = useState<StrengthFilterOptions>({
    religions: [],
    casts: [],
    quotas: [],
  });

  const [headers, setHeaders] = useState<LabelledKey[]>([]);
  const [rows, setRows] = useState<FlatRow[]>([]);
  const [disciplineSummary, setDisciplineSummary] = useState<DisciplineSummaryRow[]>([]);
  const [agewiseClasses, setAgewiseClasses] = useState<string[]>([]);
  const [agewiseBuckets, setAgewiseBuckets] = useState<Array<{ age: string; M: number; F: number }>>([]);
  const [agewiseMatrix, setAgewiseMatrix] = useState<Array<Record<string, string | number>>>([]);
  const [grandTotal, setGrandTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (!['student_report', 'inactive_student_report', 'student_strength_report'].includes(kind)) {
        setDynamicGroups([]);
        return;
      }

      setBootstrapping(true);
      try {
        if (kind === 'student_strength_report') {
          const response = await loadStrengthFilterOptions();
          if (!cancelled) setStrengthOptions(response);
        } else {
          const response = await loadDynamicBootstrap(
            kind === 'student_report' ? 'student_report' : 'inactive_student_report'
          );
          if (!cancelled) setDynamicGroups(response);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage({
            type: 'error',
            text: error instanceof Error ? error.message : 'Unable to load report configuration.',
          });
        }
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [kind]);

  // Same debounced Student Name + GR No lookup used by the Add Student Infirmary
  // picker (app/student/student_infirmary/page.tsx), reused as-is for this report's
  // combined student search filter.
  useEffect(() => {
    if (kind !== 'student_discipline_report') return;
    if (studentQuery.trim().length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      searchInfirmaryStudents(studentQuery.trim(), controller.signal)
        .then(setStudentOptions)
        .catch(() => setStudentOptions([]));
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [kind, studentQuery]);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [studentOptions]);

  useEffect(() => {
    if (highlightedIndex < 0 || studentOptions.length === 0) return;
    const option = document.querySelector(`#student-options [data-index="${highlightedIndex}"]`);
    (option as HTMLElement | null)?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex, studentOptions]);

  const flatColumns = useMemo(() => buildFlatColumns(headers, kind), [headers, kind]);
  const selectedClassSummary = useMemo(
    () => selectionSummary(sectionLabel, standardLabel, divisionLabel),
    [divisionLabel, sectionLabel, standardLabel]
  );

  const flatChartData = useMemo<Array<Record<string, string | number>>>(() => {
    if (kind === 'student_request_report') {
      const counts = new Map<string, number>();
      rows.forEach((row) => {
        const key = String(row.REQUEST || 'Unknown');
        counts.set(key, (counts.get(key) || 0) + 1);
      });
      return Array.from(counts.entries()).map(([name, total]) => ({ name, total }));
    }

    if (kind === 'student_health_report') {
      const counts = new Map<string, number>();
      rows.forEach((row) => {
        const key = String(row.student_name || 'Unknown');
        counts.set(key, (counts.get(key) || 0) + 1);
      });
      return Array.from(counts.entries()).slice(0, 10).map(([name, total]) => ({ name, total }));
    }

    if (kind === 'student_discipline_report') {
      return disciplineSummary.map((row) => ({
        name: row.studentName,
        positive: row.positiveCount,
        negative: row.negativeCount,
        total: row.totalPoints,
      }));
    }

    if (kind === 'missing_document_report') {
      return headers
        .filter((header) => header.key.startsWith('document_'))
        .map((header) => ({
          name: header.label,
          missing: rows.reduce((sum, row) => sum + (String(row[header.key]) === 'Missing' ? 1 : 0), 0),
        }));
    }

    if (kind === 'student_report' || kind === 'inactive_student_report') {
      const counts = new Map<string, number>();
      rows.forEach((row) => {
        const key = String(row.standard || row.standard_name || row.grade || 'Unknown');
        counts.set(key, (counts.get(key) || 0) + 1);
      });
      return Array.from(counts.entries()).map(([name, total]) => ({ name, total }));
    }

    return [];
  }, [disciplineSummary, headers, kind, rows]);

  const missingDocumentPie = useMemo(() => {
    if (kind !== 'missing_document_report') return [];
    let complete = 0;
    let incomplete = 0;
    rows.forEach((row) => {
      const hasMissing = headers.some(
        (header) => header.key.startsWith('document_') && String(row[header.key]) === 'Missing'
      );
      if (hasMissing) incomplete += 1;
      else complete += 1;
    });
    return [
      { name: 'Complete', value: complete },
      { name: 'Missing Docs', value: incomplete },
    ];
  }, [headers, kind, rows]);

  const strengthExport = useMemo(() => {
    const columns: TableExportColumn[] = [
      { key: 'standard_name', label: 'Standard' },
      { key: 'division_name', label: 'Division' },
      { key: 'total_students', label: 'Total' },
    ];
    if (general.includes('new_add')) columns.push({ key: 'new_add', label: 'New Admission' });
    if (general.includes('take_lc')) columns.push({ key: 'take_lc', label: 'Take LC' });
    if (strengthFilters.includes('M')) columns.push({ key: 'M', label: 'Boy' });
    if (strengthFilters.includes('F')) columns.push({ key: 'F', label: 'Girl' });

    const exportRows: TableExportRow[] = rows.map((row) => ({
      standard_name: String(row.standard_name || '-'),
      division_name: String(row.division_name || '-'),
      total_students: String(row.total_students || 0),
      ...(general.includes('new_add') ? { new_add: String(row.new_add || 0) } : {}),
      ...(general.includes('take_lc') ? { take_lc: String(row.take_lc || 0) } : {}),
      ...(strengthFilters.includes('M') ? { M: String(row.M || 0) } : {}),
      ...(strengthFilters.includes('F') ? { F: String(row.F || 0) } : {}),
    }));

    return { columns, rows: exportRows };
  }, [general, rows, strengthFilters]);

  const agewiseExport = useMemo(() => {
    const columns: TableExportColumn[] = [{ key: 'age', label: 'Age' }];
    agewiseClasses.forEach((className) => {
      columns.push({ key: `${className}_M`, label: `${className} M` });
      columns.push({ key: `${className}_F`, label: `${className} F` });
    });

    const exportRows: TableExportRow[] = agewiseMatrix.map((row) => {
      const next: TableExportRow = { age: String(row.age || '-') };
      agewiseClasses.forEach((className) => {
        next[`${className}_M`] = String(row[`${className}_M`] || 0);
        next[`${className}_F`] = String(row[`${className}_F`] || 0);
      });
      return next;
    });

    return { columns, rows: exportRows };
  }, [agewiseClasses, agewiseMatrix]);

  const handleSectionChange = (value: DropdownValue, selectedData: AcademicSection[]) => {
    const selectedValue = getSingleValue(value);
    setSection(selectedValue);
    setSectionLabel(selectedData[0]?.title || '');
    setStandard('');
    setStandardLabel('');
    setDivision('');
    setDivisionLabel('');
  };

  const handleStandardChange = (value: DropdownValue, selectedData: Standard[]) => {
    const selectedValue = getSingleValue(value);
    setStandard(selectedValue);
    setStandardLabel(selectedData[0]?.name || '');
    setDivision('');
    setDivisionLabel('');
  };

  const handleDivisionChange = (value: DropdownValue, selectedData: Division[]) => {
    const selectedValue = getSingleValue(value);
    setDivision(selectedValue);
    setDivisionLabel(selectedData[0]?.name || '');
  };

  async function runSearch() {
    setLoading(true);
    setHasSearched(true);
    setMessage(null);

    try {
      if (kind === 'student_report' || kind === 'inactive_student_report') {
        const response = await fetchStudentListingReport({
          inactive: kind === 'inactive_student_report',
          grade: section,
          standard,
          division,
          orderBy,
          dynamicFields: selectedDynamicFields,
        });
        setHeaders(response.headers);
        setRows(response.rows);
        setMessage({ type: response.rows.length > 0 ? 'success' : 'info', text: response.message });
      } else if (kind === 'missing_document_report') {
        const response = await fetchMissingDocumentReport({
          grade: section,
          standard,
          division,
          userType,
        });
        setHeaders(response.headers);
        setRows(response.rows);
        setMessage({ type: response.rows.length > 0 ? 'success' : 'info', text: response.message });
      } else if (kind === 'student_request_report') {
        const response = await fetchStudentRequestReport({ grade: section, standard, division, fromDate, toDate });
        setHeaders(response.headers);
        setRows(response.rows);
        setMessage({ type: response.rows.length > 0 ? 'success' : 'info', text: response.message });
      } else if (kind === 'student_health_report') {
        const response = await fetchStudentHealthReport({
          grade: section,
          standard,
          division,
          fromDate,
          toDate,
          healthType,
        });
        setHeaders(response.headers);
        setRows(response.rows);
        setMessage({ type: response.rows.length > 0 ? 'success' : 'info', text: response.message });
      } else if (kind === 'student_discipline_report') {
        const response = await fetchStudentDisciplineReport({
          grade: section,
          standard,
          division,
          studentName,
          uniqueId,
          mobile,
          grno,
          fromDate,
          toDate,
        });
        setHeaders([
          { key: 'student_name', label: 'Student Name' },
          { key: 'standard_name', label: 'Standard' },
          { key: 'division_name', label: 'Division' },
          { key: 'mobile', label: 'Mobile' },
          { key: 'dicipline', label: 'Discipline' },
          { key: 'message', label: 'Message' },
          { key: 'flag_text', label: 'Flag' },
          { key: 'name', label: 'By' },
          { key: 'date_', label: 'Date' },
        ]);
        setRows(response.rows);
        setDisciplineSummary(response.summary);
        setMessage({ type: response.rows.length > 0 ? 'success' : 'info', text: response.message });
      } else if (kind === 'student_strength_report') {
        const response = await fetchStudentStrengthReport({
          oneDate,
          standardWise,
          fromDate,
          toDate,
          general,
          strength: strengthFilters,
          religion,
          cast,
          quota,
        });
        setRows(response.rows);
        setMessage({ type: response.rows.length > 0 ? 'success' : 'info', text: response.message });
      } else if (kind === 'agewise_report') {
        const response = await fetchAgewiseReport({ grade: section, standard, division });
        const bucketSummary = response.buckets.map((bucket) => {
          const totals = response.classes.reduce(
            (accumulator, className) => {
              accumulator.M += bucket.values[className]?.M || 0;
              accumulator.F += bucket.values[className]?.F || 0;
              return accumulator;
            },
            { M: 0, F: 0 }
          );
          return { age: bucket.age, ...totals };
        });

        const matrix = response.buckets.map((bucket) => {
          const row: Record<string, string | number> = { age: bucket.age };
          response.classes.forEach((className) => {
            row[`${className}_M`] = bucket.values[className]?.M || 0;
            row[`${className}_F`] = bucket.values[className]?.F || 0;
          });
          return row;
        });

        setAgewiseClasses(response.classes);
        setAgewiseBuckets(bucketSummary);
        setAgewiseMatrix(matrix);
        setGrandTotal(response.grandTotal);
        setMessage({ type: response.buckets.length > 0 ? 'success' : 'info', text: response.message });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to load report.',
      });
    } finally {
      setLoading(false);
    }
  }

  function renderAcademicFilters(required = false) {
    return (
      <SearchDropdown
        fields={['section', 'standard', 'division']}
        values={{ section, standard, division }}
        required={required ? { section: true, standard: true } : undefined}
        labels={{ section: 'Grade', standard: 'Standard', division: 'Division' }}
        placeholders={{ section: 'Select grade', standard: 'Select standard', division: 'Select division' }}
        onSectionChange={handleSectionChange}
        onStandardChange={handleStandardChange}
        onDivisionChange={handleDivisionChange}
      />
    );
  }

  function renderFilterActions() {
    return (
      <Button type="button" className="h-10 flex-1" onClick={() => void runSearch()} disabled={loading || bootstrapping}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        Search
      </Button>
    );
  }

  function renderFilters() {
    if (kind === 'student_report' || kind === 'inactive_student_report') {
      return (
        <div className="space-y-4">
          {renderAcademicFilters()}
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Order By">
              <NativeSelect value={orderBy} onChange={setOrderBy}>
                {STUDENT_REPORT_ORDER_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <div className="flex items-end gap-2">
              <DynamicFieldPickerButton
                groups={dynamicGroups}
                selected={selectedDynamicFields}
                onChange={setSelectedDynamicFields}
              />
              {renderFilterActions()}
            </div>
          </div>
        </div>
      );
    }

    if (kind === 'missing_document_report') {
      return (
        <div className="space-y-4">
          {renderAcademicFilters(userType === 'student')}
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="User Type">
              <NativeSelect value={userType} onChange={setUserType}>
                <option value="student">Student</option>
                <option value="staff">Staff</option>
              </NativeSelect>
            </Field>
            <div className="flex items-end">{renderFilterActions()}</div>
          </div>
        </div>
      );
    }

    if (kind === 'student_request_report') {
      return (
        <div className="space-y-4">
          {renderAcademicFilters()}
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="From Date">
              <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            </Field>
            <Field label="To Date">
              <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </Field>
            <div className="flex items-end">{renderFilterActions()}</div>
          </div>
        </div>
      );
    }

    if (kind === 'student_health_report') {
      return (
        <div className="space-y-4">
          {renderAcademicFilters()}
          <div className="grid gap-4 md:grid-cols-4">
            <Field label="Health Type">
              <NativeSelect value={healthType} onChange={setHealthType}>
                {STUDENT_HEALTH_TYPE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="From Date">
              <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            </Field>
            <Field label="To Date">
              <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </Field>
            <div className="flex items-end">{renderFilterActions()}</div>
          </div>
        </div>
      );
    }

    if (kind === 'student_discipline_report') {
      return (
        <div className="space-y-4">
          {renderAcademicFilters()}
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Student">
              <div className="relative">
                <Input
                  value={studentQuery}
                  onChange={(event) => {
                    setStudentQuery(event.target.value);
                    setStudentOptions([]);
                    setStudentName('');
                    setGrno('');
                  }}
                  onKeyDown={(event) => {
                    if (studentOptions.length === 0) return;
                    if (event.key === 'ArrowDown') {
                      event.preventDefault();
                      setHighlightedIndex((prev) => (prev < 0 ? 0 : Math.min(prev + 1, studentOptions.length - 1)));
                    } else if (event.key === 'ArrowUp') {
                      event.preventDefault();
                      setHighlightedIndex((prev) => (prev <= 0 ? -1 : prev - 1));
                    } else if (event.key === 'Enter') {
                      event.preventDefault();
                      const student = studentOptions[highlightedIndex >= 0 ? highlightedIndex : 0];
                      setStudentQuery(`${student.name} - - ${student.enrollmentNo}`);
                      setStudentName('');
                      setGrno('');
                      setStudentOptions([]);
                      setHighlightedIndex(-1);
                    } else if (event.key === 'Escape') {
                      setStudentOptions([]);
                      setHighlightedIndex(-1);
                    }
                  }}
                  placeholder="Type student name or GR No."
                />
                {studentOptions.length > 0 && (
                  <div id="student-options" className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
                    {studentOptions.map((student, index) => (
                      <button
                        key={student.id}
                        type="button"
                        data-index={index}
                        onClick={() => {
                          setStudentQuery(`${student.name} - - ${student.enrollmentNo}`);
                          setStudentName('');
                          setGrno('');
                          setStudentOptions([]);
                        }}
                        className={`block w-full px-3 py-2 text-left text-sm ${index === highlightedIndex ? 'bg-indigo-100' : 'hover:bg-slate-50'}`}
                      >
                        <span className="font-medium">{student.name}</span>
                        <span className="ml-2 text-slate-400">{student.enrollmentNo}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Field>
            <Field label="Unique ID">
              <Input value={uniqueId} onChange={(event) => setUniqueId(event.target.value)} />
            </Field>
            <Field label="Mobile">
              <Input value={mobile} onChange={(event) => setMobile(event.target.value)} />
            </Field>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="From Date">
              <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            </Field>
            <Field label="To Date">
              <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </Field>
            <div className="flex items-end">{renderFilterActions()}</div>
          </div>
        </div>
      );
    }

    if (kind === 'student_strength_report') {
      return (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Date Basis">
              <NativeSelect value={oneDate} onChange={setOneDate}>
                <option value="add">Admission Date</option>
                <option value="start">Entry Date</option>
              </NativeSelect>
            </Field>
            <Field label="From Date">
              <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            </Field>
            <Field label="To Date">
              <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Standard / Division Wise">
              <NativeMultiSelect value={standardWise} onChange={setStandardWise}>
                <option value="standard">Standard Wise</option>
                <option value="division">Division Wise</option>
              </NativeMultiSelect>
            </Field>
            <Field label="General">
              <NativeMultiSelect value={general} onChange={setGeneral}>
                {STRENGTH_GENERAL_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </NativeMultiSelect>
            </Field>
            <Field label="Strength">
              <NativeMultiSelect value={strengthFilters} onChange={setStrengthFilters}>
                {STRENGTH_GENDER_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </NativeMultiSelect>
            </Field>
            <Field label="Religion">
              <NativeMultiSelect value={religion} onChange={setReligion}>
                {strengthOptions.religions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </NativeMultiSelect>
            </Field>
            <Field label="Cast">
              <NativeMultiSelect value={cast} onChange={setCast}>
                {strengthOptions.casts.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </NativeMultiSelect>
            </Field>
            <Field label="Quota">
              <NativeMultiSelect value={quota} onChange={setQuota}>
                {strengthOptions.quotas.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </NativeMultiSelect>
            </Field>
          </div>

          <div className="flex justify-end">
            <div className="w-full md:w-48">{renderFilterActions()}</div>
          </div>
        </div>
      );
    }

    return (
      <div className="grid gap-4 md:grid-cols-2">
        {renderAcademicFilters()}
        <div className="flex items-end">{renderFilterActions()}</div>
      </div>
    );
  }

  function renderFlatReport() {
    return (
      <div className="space-y-3">
        {kind === 'student_request_report' ? (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={rows.length === 0}
              onClick={() =>
                exportRowsAsPdf({
                  filename: 'student-request-report.pdf',
                  title: toTitle(kind),
                  subtitle: selectedClassSummary || 'All records',
                  columns: headers.map((header) => ({ key: header.key, label: header.label })),
                  rows: rows.map((row) =>
                    Object.fromEntries(
                      headers.map((header) => [header.key, formatCellValue(header.key, row[header.key])])
                    )
                  ),
                })
              }
            >
              PDF
            </Button>
          </div>
        ) : null}
        <RecordTable
          rows={rows}
          columns={flatColumns}
          getRowKey={(row, index) => `${String(row.id || row.enrollment_no || row.student_name || 'row')}-${index}`}
          exportFilename={kind}
          exportTitle={toTitle(kind)}
          exportSubtitle={selectedClassSummary}
          emptyTitle={hasSearched ? 'No rows match the current filters.' : 'Search to load report data.'}
        />
      </div>
    );
  }

  function renderCharts() {
    if (kind === 'student_strength_report') {
      const chartRows = rows.map((row) => ({
        name: standardWise.includes('division')
          ? `${String(row.standard_name || '')}/${String(row.division_name || '')}`
          : String(row.standard_name || ''),
        total: Number(row.total_students || 0),
        male: Number(row.M || 0),
        female: Number(row.F || 0),
      }));

      return (
        <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
          <ChartCard title="Strength Distribution">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartRows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" hide />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="male" name="Boy" fill="#2563eb" />
                <Bar dataKey="female" name="Girl" fill="#f97316" />
                <Bar dataKey="total" name="Total" fill="#0f766e" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <div className="grid gap-4">
            <SummaryCard label="Rows" value={rows.length} />
            <SummaryCard label="Total Students" value={rows.reduce((sum, row) => sum + Number(row.total_students || 0), 0)} />
          </div>
        </div>
      );
    }

    if (kind === 'agewise_report') {
      return (
        <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
          <ChartCard title="Agewise Gender Distribution">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agewiseBuckets}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="age" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="M" name="Male" stackId="age" fill="#2563eb" />
                <Bar dataKey="F" name="Female" stackId="age" fill="#f97316" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <div className="grid gap-4">
            <SummaryCard label="Age Buckets" value={agewiseBuckets.length} />
            <SummaryCard label="Grand Total" value={grandTotal} />
          </div>
        </div>
      );
    }

    if (kind === 'missing_document_report') {
      return (
        <div className="grid gap-4 xl:grid-cols-2">
          <ChartCard title="Missing Documents by Type">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={flatChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" hide />
                <YAxis />
                <Tooltip />
                <Bar dataKey="missing" fill="#dc2626" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Completion Split">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={missingDocumentPie} dataKey="value" nameKey="name" outerRadius={100} label>
                  {missingDocumentPie.map((_, index) => (
                    <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      );
    }

    if (kind === 'student_discipline_report') {
      return (
        <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
          <ChartCard title="Positive vs Negative Incidents">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={flatChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" hide />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="positive" fill="#16a34a" />
                <Bar dataKey="negative" fill="#dc2626" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <div className="grid gap-4">
            <SummaryCard label="Entries" value={rows.length} />
            <SummaryCard label="Student Summaries" value={disciplineSummary.length} />
          </div>
        </div>
      );
    }

    if (flatChartData.length === 0) return null;

    return (
      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <ChartCard
          title={
            kind === 'student_request_report'
              ? 'Requests by Type'
              : kind === 'student_health_report'
                ? 'Health Entries by Student'
                : 'Rows by Standard'
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={flatChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" hide />
              <YAxis />
              <Tooltip />
              <Bar dataKey="total" fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <div className="grid gap-4">
          <SummaryCard label="Rows" value={rows.length} />
          <SummaryCard label="Filters" value={selectedClassSummary || 'All'} />
        </div>
      </div>
    );
  }

  function exportButtonSet(columns: TableExportColumn[], exportRows: TableExportRow[], title: string) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => exportRowsAsCsv({ filename: `${title.toLowerCase().replace(/\s+/g, '-')}.csv`, columns, rows: exportRows })} disabled={exportRows.length === 0}>
          CSV
        </Button>
        <Button type="button" variant="outline" onClick={() => exportRowsAsExcel({ filename: `${title.toLowerCase().replace(/\s+/g, '-')}.xls`, title, columns, rows: exportRows })} disabled={exportRows.length === 0}>
          Excel
        </Button>
        <Button type="button" variant="outline" onClick={() => exportRowsAsPdf({ filename: `${title.toLowerCase().replace(/\s+/g, '-')}.pdf`, title, subtitle: 'Legacy parity export', columns, rows: exportRows })} disabled={exportRows.length === 0}>
          PDF
        </Button>
        <Button type="button" variant="outline" onClick={() => openPrintPreview({ title, subtitle: selectedClassSummary, columns, rows: exportRows })} disabled={exportRows.length === 0}>
          Print
        </Button>
      </div>
    );
  }

  function renderStrengthTable() {
    return (
      <div className="space-y-4">
        {exportButtonSet(strengthExport.columns, strengthExport.rows, 'Student Strength Report')}
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <Table className="min-w-[1100px]">
            <TableHeader>
              <TableRow className="bg-slate-100 hover:bg-slate-100">
                <TableHead>Standard</TableHead>
                {standardWise.includes('division') ? <TableHead>Division</TableHead> : null}
                <TableHead className="text-center">Total</TableHead>
                {general.includes('new_add') ? <TableHead className="text-center">New Admission</TableHead> : null}
                {general.includes('take_lc') ? <TableHead className="text-center">Take LC</TableHead> : null}
                {strengthFilters.includes('M') ? <TableHead className="text-center">Boy</TableHead> : null}
                {strengthFilters.includes('F') ? <TableHead className="text-center">Girl</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length > 0 ? (
                rows.map((row, index) => (
                  <TableRow key={`${String(row.standard_name)}-${String(row.division_name)}-${index}`}>
                    <TableCell>{String(row.standard_name || '-')}</TableCell>
                    {standardWise.includes('division') ? <TableCell>{String(row.division_name || '-')}</TableCell> : null}
                    <TableCell className="text-center">{Number(row.total_students || 0)}</TableCell>
                    {general.includes('new_add') ? <TableCell className="text-center">{Number(row.new_add || 0)}</TableCell> : null}
                    {general.includes('take_lc') ? <TableCell className="text-center">{Number(row.take_lc || 0)}</TableCell> : null}
                    {strengthFilters.includes('M') ? <TableCell className="text-center">{Number(row.M || 0)}</TableCell> : null}
                    {strengthFilters.includes('F') ? <TableCell className="text-center">{Number(row.F || 0)}</TableCell> : null}
                  </TableRow>
                ))
              ) : (
                <EmptyTableRow
                  colSpan={3 + general.length + strengthFilters.length + (standardWise.includes('division') ? 1 : 0)}
                  label={hasSearched ? 'No strength rows match the current filters.' : 'Search to load the student strength report.'}
                />
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  function renderAgewiseTable() {
    return (
      <div className="space-y-4">
        {exportButtonSet(agewiseExport.columns, agewiseExport.rows, 'Agewise Report')}
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <Table className="min-w-[1200px]">
            <TableHeader>
              <TableRow className="bg-slate-100 hover:bg-slate-100">
                <TableHead rowSpan={2}>Age</TableHead>
                {agewiseClasses.map((className) => (
                  <TableHead key={className} colSpan={2} className="text-center">
                    {className}
                  </TableHead>
                ))}
              </TableRow>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                {agewiseClasses.flatMap((className) => [
                  <TableHead key={`${className}-M`} className="text-center">M</TableHead>,
                  <TableHead key={`${className}-F`} className="text-center">F</TableHead>,
                ])}
              </TableRow>
            </TableHeader>
            <TableBody>
              {agewiseMatrix.length > 0 ? (
                agewiseMatrix.map((row, index) => (
                  <TableRow key={`${String(row.age)}-${index}`}>
                    <TableCell>{String(row.age)}</TableCell>
                    {agewiseClasses.flatMap((className) => [
                      <TableCell key={`${className}-${index}-M`} className="text-center">{Number(row[`${className}_M`] || 0)}</TableCell>,
                      <TableCell key={`${className}-${index}-F`} className="text-center">{Number(row[`${className}_F`] || 0)}</TableCell>,
                    ])}
                  </TableRow>
                ))
              ) : (
                <EmptyTableRow
                  colSpan={Math.max(3, 1 + agewiseClasses.length * 2)}
                  label={hasSearched ? 'No agewise rows match the selected criteria.' : 'Generate the agewise report to view the matrix.'}
                />
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  const icon =
    kind === 'student_health_report'
      ? <HeartPulse className="h-4 w-4" />
      : kind === 'student_discipline_report'
        ? <ShieldAlert className="h-4 w-4" />
        : kind === 'missing_document_report'
          ? <FileSearch className="h-4 w-4" />
          : kind === 'student_strength_report'
            ? <Users className="h-4 w-4" />
            : kind === 'agewise_report'
              ? <Activity className="h-4 w-4" />
              : <FileBarChart className="h-4 w-4" />;

  return (
    <PageFrame>
      <PageHeader title={toTitle(kind)} description={toDescription(kind)} action={icon} />

      {message ? <InlineMessage type={message.type} text={message.text} /> : null}

      <SectionPanel
        title="Filters"
        description="These filters map to the existing Laravel report endpoints and reuse the established Next.js form patterns."
      >
        {renderFilters()}
      </SectionPanel>

      {bootstrapping ? (
        <SectionPanel title="Loading">
          <div className="flex h-28 items-center justify-center text-sm text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading report configuration...
          </div>
        </SectionPanel>
      ) : null}

      {kind === 'student_strength_report' ? (
        <>
          {rows.length > 0 ? <SectionPanel title="Insights">{renderCharts()}</SectionPanel> : null}
          <SectionPanel title="Report" description={selectedClassSummary || 'Search to load the student strength report.'}>
            {renderStrengthTable()}
          </SectionPanel>
        </>
      ) : null}

      {kind === 'agewise_report' ? (
        <>
          {agewiseBuckets.length > 0 ? <SectionPanel title="Insights">{renderCharts()}</SectionPanel> : null}
          <SectionPanel title="Report" description={selectedClassSummary || 'Generate the agewise report to view the matrix.'}>
            {renderAgewiseTable()}
          </SectionPanel>
        </>
      ) : null}

      {!['student_strength_report', 'agewise_report'].includes(kind) ? (
        <>
          {((rows.length > 0 && kind !== 'student_discipline_report') || (kind === 'student_discipline_report' && (rows.length > 0 || disciplineSummary.length > 0))) ? (
            <SectionPanel title="Insights">{renderCharts()}</SectionPanel>
          ) : null}
          <SectionPanel title="Report" description={selectedClassSummary || 'Search to load report data.'}>
            {renderFlatReport()}
          </SectionPanel>
        </>
      ) : null}
    </PageFrame>
  );
}
