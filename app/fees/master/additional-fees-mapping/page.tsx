'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  buildSessionContext,
  createAuthHeaders,
  normalizeApiStatus,
  normalizeAcademicYear,
  readString,
  type ApiEnvelope,
} from '@/lib/erp-client';

type SectionOption = { id: string; label: string };
type StandardOption = { id: string; label: string };
type DivisionOption = { id: string; label: string };
type HeadOption = { id: string; label: string; feeTypeId: string };
type MonthOption = { id: string; label: string };

type MappingSearchForm = {
  grade: string;
  standard: string;
  division: string;
  stu_name: string;
  uniqueid: string;
  mobile: string;
  grno: string;
  fees_heads: string[];
  month_id: string[];
};

type MappingStudentCell = {
  amount: string;
  paid: string;
};

type MappingStudentRow = {
  studentId: string;
  serial: string;
  name: string;
  stdDiv: string;
  mobile: string;
  cells: Record<string, Record<string, MappingStudentCell>>;
};

type MappingResult = {
  monthsId: string[];
  monthHead: Array<{ monthId: string; feeTypeId: string; label: string }>;
  students: MappingStudentRow[];
  heads: HeadOption[];
  grade: string;
  standard: string;
  division: string;
};

const initialSearchForm: MappingSearchForm = {
  grade: '',
  standard: '',
  division: '',
  stu_name: '',
  uniqueid: '',
  mobile: '',
  grno: '',
  fees_heads: [],
  month_id: [],
};

function readStoredContextValue(
  storageKey: string,
  ...jsonSources: string[]
): string {
  if (typeof window === 'undefined') return '';

  const directValue = readString(localStorage.getItem(storageKey));
  if (directValue) {
    return directValue;
  }

  for (const sourceKey of jsonSources) {
    try {
      const source = JSON.parse(
        localStorage.getItem(sourceKey) || '{}'
      ) as Record<string, unknown>;
      const nestedValue = readString(source[storageKey]);
      if (nestedValue) {
        return nestedValue;
      }
    } catch {
      continue;
    }
  }

  return '';
}

function readSelectedValues(event: React.ChangeEvent<HTMLSelectElement>): string[] {
  return Array.from(event.target.selectedOptions).map((option) => option.value);
}

export default function AdditionalFeesMappingPage() {
  const [session] = useState(buildSessionContext);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [standards, setStandards] = useState<StandardOption[]>([]);
  const [divisions, setDivisions] = useState<DivisionOption[]>([]);
  const [headOptions, setHeadOptions] = useState<HeadOption[]>([]);
  const [monthOptions, setMonthOptions] = useState<MonthOption[]>([]);
  const [form, setForm] = useState<MappingSearchForm>(initialSearchForm);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [studentValues, setStudentValues] = useState<
    Record<string, Record<string, Record<string, string>>>
  >({});
  const [result, setResult] = useState<MappingResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const resolvedSubInstituteId =
    session.subInstituteId ||
    readStoredContextValue('sub_institute_id', 'userData', 'menuContext');
  const resolvedAcademicYear = normalizeAcademicYear(
    session.syear ||
      readStoredContextValue('syear', 'userData', 'menuContext') ||
      readStoredContextValue('selectedAcademicYear', 'userData', 'menuContext')
  );
  const resolvedUserId =
    session.userId ||
    readStoredContextValue('user_id', 'userData', 'menuContext') ||
    readStoredContextValue('userId', 'userData', 'menuContext');

  const appendResolvedCommonParams = useCallback(
    (searchParams: URLSearchParams) => {
      searchParams.set('type', 'API');
      if (resolvedSubInstituteId) {
        searchParams.set('sub_institute_id', resolvedSubInstituteId);
      }
      if (resolvedAcademicYear) {
        searchParams.set('syear', resolvedAcademicYear);
      }
      if (resolvedUserId) {
        searchParams.set('user_id', resolvedUserId);
      }
    },
    [resolvedAcademicYear, resolvedSubInstituteId, resolvedUserId]
  );

  const loadSections = useCallback(async () => {
    if (!session.baseUrl || !resolvedSubInstituteId || !session.token) return;

    try {
      const payload = new URLSearchParams();
      payload.append('sub_institute_id', resolvedSubInstituteId);
      payload.append('token', session.token);

      const response = await fetch(`${session.baseUrl}/get_adminAcademicSection`, {
        method: 'POST',
        headers: createAuthHeaders(session, 'application/x-www-form-urlencoded'),
        body: payload.toString(),
      });

      if (!response.ok) return;

      const parsed = (await response.json()) as ApiEnvelope;
      const items = Array.isArray(parsed.data)
        ? (parsed.data as Array<Record<string, unknown>>)
        : [];
      setSections(
        items.map((item) => ({
          id: readString(item.id),
          label: readString(item.title || item.short_name || item.name),
        }))
      );
    } catch {}
  }, [resolvedSubInstituteId, session]);

  const loadStandards = useCallback(
    async (gradeId: string) => {
      if (!session.baseUrl || !resolvedSubInstituteId || !session.token || !gradeId) {
        setStandards([]);
        return;
      }

      try {
        const payload = new URLSearchParams();
        payload.append('sub_institute_id', resolvedSubInstituteId);
        payload.append('grade_id', gradeId);
        payload.append('token', session.token);

        const response = await fetch(`${session.baseUrl}/get_adminStandard`, {
          method: 'POST',
          headers: createAuthHeaders(session, 'application/x-www-form-urlencoded'),
          body: payload.toString(),
        });

        if (!response.ok) return;

        const parsed = (await response.json()) as ApiEnvelope;
        const items = Array.isArray(parsed.data)
          ? (parsed.data as Array<Record<string, unknown>>)
          : [];
        setStandards(
          items.map((item) => ({
            id: readString(item.id),
            label: readString(item.name || item.short_name),
          }))
        );
      } catch {
        setStandards([]);
      }
    },
    [resolvedSubInstituteId, session]
  );

  const loadDivisions = useCallback(
    async (standardId: string) => {
      if (
        !session.baseUrl ||
        !resolvedSubInstituteId ||
        !resolvedAcademicYear ||
        !session.token ||
        !standardId
      ) {
        setDivisions([]);
        return;
      }

      try {
        const payload = new URLSearchParams();
        payload.append('sub_institute_id', resolvedSubInstituteId);
        payload.append('syear', resolvedAcademicYear);
        payload.append('standard_id', standardId);
        payload.append('token', session.token);

        const response = await fetch(`${session.baseUrl}/get_adminDivision`, {
          method: 'POST',
          headers: createAuthHeaders(session, 'application/x-www-form-urlencoded'),
          body: payload.toString(),
        });

        if (!response.ok) return;

        const parsed = (await response.json()) as ApiEnvelope;
        const items = Array.isArray(parsed.data)
          ? (parsed.data as Array<Record<string, unknown>>)
          : [];
        setDivisions(
          items.map((item) => ({
            id: readString(item.id),
            label: readString(item.name),
          }))
        );
      } catch (error) {
        console.error('Division API error:', error);
        setDivisions([]);
      }
    },
    [resolvedAcademicYear, resolvedSubInstituteId, session]
  );

  const loadBaseOptions = useCallback(async () => {
    if (!session.baseUrl) {
      setError('Session is missing the ERP host name.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const url = new URL(`${session.baseUrl}/fees/other_fee_map`);
      appendResolvedCommonParams(url.searchParams);

      const response = await fetch(url.toString(), {
        headers: createAuthHeaders(session),
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(
          `Failed to load additional fees mapping filters (${response.status})`
        );
      }

      const payload = (await response.json()) as ApiEnvelope;
      const monthMap =
        payload.data &&
        typeof payload.data === 'object' &&
        'ddMonth' in payload.data &&
        payload.data.ddMonth &&
        typeof payload.data.ddMonth === 'object'
          ? (payload.data.ddMonth as Record<string, unknown>)
          : {};
      const payloadData =
        payload.data && typeof payload.data === 'object'
          ? (payload.data as Record<string, unknown>)
          : null;
      const headRows =
        payloadData && Array.isArray(payloadData.heads)
          ? (payloadData.heads as Array<Record<string, unknown>>)
          : [];

      setMonthOptions(
        Object.entries(monthMap).map(([id, label]) => ({
          id,
          label: readString(label),
        }))
      );
      setHeadOptions(
        headRows.map((row) => ({
          id: readString(row.id),
          label: readString(row.display_name),
          feeTypeId: readString(row.fees_title),
        }))
      );
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : 'Failed to load additional fee mapping filters.'
      );
    } finally {
      setLoading(false);
    }
  }, [appendResolvedCommonParams, session]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadSections();
      void loadBaseOptions();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadBaseOptions, loadSections]);

  const updateField = <K extends keyof MappingSearchForm>(
    field: K,
    value: MappingSearchForm[K]
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSearch = async () => {
    if (!session.baseUrl) {
      setError('Session is missing the ERP host name.');
      return;
    }

    if (!resolvedSubInstituteId || !resolvedAcademicYear) {
      setError('Institute and academic year are required.');
      return;
    }

    if (!form.grade || !form.standard || form.fees_heads.length === 0 || form.month_id.length === 0) {
      setError('Select grade, standard, fee heads, and months before searching.');
      return;
    }

    setSearching(true);
    setError('');
    setSuccessMessage('');
    setResult(null);
    setSelectedStudents([]);

    try {
      const params = new URLSearchParams();
      params.set('type', 'API');
      params.set('sub_institute_id', resolvedSubInstituteId);
      params.set('syear', resolvedAcademicYear);
      params.set('grade', form.grade);
      params.set('standard', form.standard);
      params.set('division', form.division);
      params.set('stu_name', form.stu_name.trim());
      params.set('uniqueid', form.uniqueid.trim());
      params.set('mobile', form.mobile.trim());
      params.set('grno', form.grno.trim());
      if (resolvedUserId) {
        params.set('created_by', resolvedUserId);
        params.set('user_id', resolvedUserId);
      }
      params.append('grade_id[]', form.grade);
      params.append('standard_id[]', form.standard);
      if (form.division) {
        params.append('division_id[]', form.division);
      }
      form.fees_heads.forEach((headId) => {
        params.append('fees_heads[]', headId);
        params.append('fee_head_id[]', headId);
      });
      form.month_id.forEach((monthId) => {
        params.append('month_id[]', monthId);
        params.append('month[]', monthId);
      });

      const response = await fetch(`${session.baseUrl}/fees/other_fee_map/create?${params.toString()}`, {
        method: 'GET',
        headers: createAuthHeaders(session),
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(
          `Failed to load additional fee mapping matrix (${response.status})`
        );
      }

      const payload = (await response.json()) as ApiEnvelope & Record<string, unknown>;
      const apiStatus = normalizeApiStatus(payload);
      if (apiStatus && apiStatus !== '1') {
        throw new Error(payload.message || 'Failed to load additional fee mapping matrix.');
      }

      const payloadData =
        payload.data && typeof payload.data === 'object'
          ? (payload.data as Record<string, unknown>)
          : null;
      const monthsId = Array.isArray(payload.months_id)
        ? payload.months_id.map((value) => readString(value))
        : Array.isArray(payloadData?.months_id)
          ? (payloadData.months_id as unknown[]).map((value) => readString(value))
        : [];
      const feesTitleSource =
        payload.fees_title &&
        typeof payload.fees_title === 'object' &&
        Array.isArray((payload.fees_title as Record<string, unknown>).data)
          ? ((payload.fees_title as Record<string, unknown>).data as Array<Record<string, unknown>>)
          : payloadData?.fees_title &&
              typeof payloadData.fees_title === 'object' &&
              Array.isArray((payloadData.fees_title as Record<string, unknown>).data)
            ? (((payloadData.fees_title as Record<string, unknown>).data as Array<Record<string, unknown>>))
          : [];
      const monthHeadSource =
        payload.month_head && typeof payload.month_head === 'object'
          ? (payload.month_head as Record<string, unknown>)
          : payloadData?.month_head && typeof payloadData.month_head === 'object'
            ? (payloadData.month_head as Record<string, unknown>)
          : {};
      const studentsSource = Array.isArray(payload.stu_data)
        ? (payload.stu_data as Array<Record<string, unknown>>)
        : Array.isArray(payloadData?.students)
          ? (payloadData.students as Array<Record<string, unknown>>)
          : Array.isArray(payload.students)
            ? (payload.students as Array<Record<string, unknown>>)
            : Array.isArray(payload.data)
              ? (payload.data as Array<Record<string, unknown>>)
        : [];

      const heads =
        feesTitleSource.length > 0
          ? feesTitleSource.map((row) => ({
              id: readString(row.id),
              label: readString(row.display_name),
              feeTypeId: readString(row.fees_title),
            }))
          : headOptions
              .filter((head) => form.fees_heads.includes(head.id))
              .map((head) => ({
                id: head.id,
                label: head.label,
                feeTypeId: head.feeTypeId,
              }));

      const monthHead: Array<{ monthId: string; feeTypeId: string; label: string }> = [];
      Object.entries(monthHeadSource).forEach(([monthId, headMap]) => {
        if (!headMap || typeof headMap !== 'object') return;
        Object.entries(headMap as Record<string, unknown>).forEach(([feeTypeId, label]) => {
          monthHead.push({
            monthId,
            feeTypeId,
            label: readString(label),
          });
        });
      });
      if (monthHead.length === 0) {
        form.month_id.forEach((monthId) => {
          heads.forEach((head) => {
            monthHead.push({
              monthId,
              feeTypeId: head.feeTypeId,
              label: `${monthOptions.find((month) => month.id === monthId)?.label || monthId} - ${head.label}`,
            });
          });
        });
      }

      const students: MappingStudentRow[] = studentsSource.map((student, index) => {
        const cells: Record<string, Record<string, MappingStudentCell>> = {};
        monthsId.forEach((monthId) => {
          cells[monthId] = {};
          heads.forEach((head) => {
            const monthGroup =
              student[monthId] && typeof student[monthId] === 'object'
                ? (student[monthId] as Record<string, unknown>)
                : {};
            const cellSource =
              monthGroup[head.label] && typeof monthGroup[head.label] === 'object'
                ? (monthGroup[head.label] as Record<string, unknown>)
                : {};
            cells[monthId][head.feeTypeId] = {
              amount: readString(cellSource.amount),
              paid: readString(cellSource.paid),
            };
          });
        });

        return {
          studentId: readString(student.student_id || student.id),
          serial:
            readString(student['sr.no']) ||
            readString(student.roll_no) ||
            String(index + 1),
          name:
            readString(student.name) ||
            [
              readString(student.first_name),
              readString(student.middle_name),
              readString(student.last_name),
            ]
              .filter(Boolean)
              .join(' '),
          stdDiv:
            `${readString(student.std || student.standard_name)} / ${readString(student.div || student.division_name)}`.trim(),
          mobile: readString(student.mobile || student.mobile_no),
          cells,
        };
      });

      const effectiveMonthsId = monthsId.length > 0 ? monthsId : [...form.month_id];

      const valueState: Record<string, Record<string, Record<string, string>>> = {};
      students.forEach((student) => {
        valueState[student.studentId] = {};
        effectiveMonthsId.forEach((monthId) => {
          valueState[student.studentId][monthId] = {};
          heads.forEach((head) => {
            valueState[student.studentId][monthId][head.feeTypeId] =
              student.cells[monthId]?.[head.feeTypeId]?.amount || '';
          });
        });
      });

      setStudentValues(valueState);
      setResult({
        monthsId: effectiveMonthsId,
        monthHead,
        students,
        heads,
        grade: readString(payload.grade || payloadData?.grade) || form.grade,
        standard: readString(payload.standard || payloadData?.standard) || form.standard,
        division: readString(payload.division || payloadData?.division) || form.division,
      });

      if (students.length === 0) {
        setSuccessMessage('No students found for the selected filters.');
      }
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : 'Failed to load additional fee mapping matrix.'
      );
    } finally {
      setSearching(false);
    }
  };

  const handleSave = async () => {
    if (!session.baseUrl || !result) return;

    if (!resolvedSubInstituteId || !resolvedAcademicYear) {
      setError('Institute and academic year are required.');
      return;
    }

    if (selectedStudents.length === 0) {
      setError('Please select at least one student.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccessMessage('');

    try {
      const formData = new FormData();
      formData.append('type', 'API');
      formData.append('sub_institute_id', resolvedSubInstituteId);
      formData.append('syear', resolvedAcademicYear);
      if (resolvedUserId) {
        formData.append('created_by', resolvedUserId);
        formData.append('user_id', resolvedUserId);
      }
      formData.append('grade', result.grade);
      formData.append('standard', result.standard);
      formData.append('division', result.division);
      result.heads.forEach((head) => {
        formData.append('fee_head_id[]', head.id);
      });
      result.monthsId.forEach((monthId) => {
        formData.append('month[]', monthId);
      });

      selectedStudents.forEach((studentId) => {
        formData.append(`student_id[${studentId}]`, studentId);
        formData.append('student_ids[]', studentId);
        result.monthsId.forEach((monthId) => {
          result.heads.forEach((head) => {
            formData.append(
              `values[${studentId}][${monthId}][${head.feeTypeId}]`,
              studentValues[studentId]?.[monthId]?.[head.feeTypeId] || ''
            );
          });
        });
      });

      const response = await fetch(`${session.baseUrl}/fees/other_fee_map`, {
        method: 'POST',
        headers: createAuthHeaders(session),
        body: formData,
      });

      if (!response.ok) {
        throw new Error(
          `Failed to save additional fee mapping (${response.status})`
        );
      }

      const payload = (await response.json()) as ApiEnvelope;
      const apiStatus = normalizeApiStatus(payload);
      if (apiStatus && apiStatus !== '1') {
        throw new Error(payload.message || 'Failed to save additional fee mapping.');
      }

      setSuccessMessage(
        payload.message || 'Other fees breakoff saved successfully.'
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Failed to save additional fee mapping.'
      );
    } finally {
      setSaving(false);
    }
  };

  const selectedColumnOrder = useMemo(() => {
    if (!result) return [];
    return result.monthHead.filter((item) =>
      result.monthsId.includes(item.monthId)
    );
  }, [result]);

  return (
    <div className="min-h-screen bg-[#e9eef7] p-4 sm:p-5 lg:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <Card className="rounded-2xl border border-slate-200/90 bg-white py-0 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <CardHeader className="gap-1 border-b border-slate-200/80 px-4 py-4 sm:px-5">
            <CardTitle className="text-[16px] font-semibold text-slate-950">
              Additional fees mapping
            </CardTitle>
            <CardDescription className="text-[12px] leading-5 text-slate-600">
              Search students and map selected additional fee heads month-wise
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-4 py-4 sm:px-5">
            {error ? (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            {successMessage ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-700">
                {successMessage}
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium text-slate-700">
                  Grade
                </Label>
                <select
                  value={form.grade}
                  onChange={(event) => {
                    const value = event.target.value;
                    updateField('grade', value);
                    updateField('standard', '');
                    updateField('division', '');
                    setResult(null);
                    void loadStandards(value);
                  }}
                  className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-[12px] text-slate-700 outline-none"
                >
                  <option value="">Select grade</option>
                  {sections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium text-slate-700">
                  Standard
                </Label>
                <select
                  value={form.standard}
                  onChange={(event) => {
                    const value = event.target.value;
                    updateField('standard', value);
                    updateField('division', '');
                    setResult(null);
                    void loadDivisions(value);
                  }}
                  className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-[12px] text-slate-700 outline-none"
                >
                  <option value="">Select standard</option>
                  {standards.map((standard) => (
                    <option key={standard.id} value={standard.id}>
                      {standard.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium text-slate-700">
                  Division
                </Label>
                <select
                  value={form.division}
                  onChange={(event) => {
                    updateField('division', event.target.value);
                    setResult(null);
                  }}
                  className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-[12px] text-slate-700 outline-none"
                >
                  <option value="">All divisions</option>
                  {divisions.map((division) => (
                    <option key={division.id} value={division.id}>
                      {division.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium text-slate-700">
                  Student name
                </Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={form.stu_name}
                    onChange={(event) => updateField('stu_name', event.target.value)}
                    className="h-10 rounded-xl border-slate-300 bg-white pl-9 text-[12px]"
                    placeholder="Search by name"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium text-slate-700">
                  Unique ID / Adm. No
                </Label>
                <Input
                  value={form.uniqueid}
                  onChange={(event) => updateField('uniqueid', event.target.value)}
                  className="h-10 rounded-xl border-slate-300 bg-white text-[12px]"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium text-slate-700">
                  Mobile
                </Label>
                <Input
                  value={form.mobile}
                  onChange={(event) => updateField('mobile', event.target.value)}
                  className="h-10 rounded-xl border-slate-300 bg-white text-[12px]"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium text-slate-700">
                  GR No.
                </Label>
                <Input
                  value={form.grno}
                  onChange={(event) => updateField('grno', event.target.value)}
                  className="h-10 rounded-xl border-slate-300 bg-white text-[12px]"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2 xl:col-span-1">
                <Label className="text-[11px] font-medium text-slate-700">
                  Fees heads
                </Label>
                <select
                  multiple
                  value={form.fees_heads}
                  onChange={(event) => {
                    updateField('fees_heads', readSelectedValues(event));
                    setResult(null);
                  }}
                  className="min-h-[132px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-[12px] text-slate-700 outline-none"
                >
                  {headOptions.map((head) => (
                    <option key={head.id} value={head.id}>
                      {head.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5 md:col-span-2 xl:col-span-1">
                <Label className="text-[11px] font-medium text-slate-700">
                  Months
                </Label>
                <select
                  multiple
                  value={form.month_id}
                  onChange={(event) => {
                    updateField('month_id', readSelectedValues(event));
                    setResult(null);
                  }}
                  className="min-h-[132px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-[12px] text-slate-700 outline-none"
                >
                  {monthOptions.map((month) => (
                    <option key={month.id} value={month.id}>
                      {month.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                className="h-9 rounded-xl bg-[#5b4fe9] px-4 text-[12px] font-semibold text-white hover:bg-[#4d42da]"
                onClick={() => void handleSearch()}
                disabled={loading || searching}
              >
                {searching ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  'Search'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200/90 bg-white py-0 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <CardHeader className="gap-1 border-b border-slate-200/80 px-4 py-4 sm:px-5">
            <CardTitle className="text-[15px] font-semibold text-slate-950">
              Mapping results
            </CardTitle>
            <CardDescription className="text-[12px] leading-5 text-slate-600">
              Select students, adjust amounts, and save the month/head mapping
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-4 py-4 sm:px-5">
            {loading ? (
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-[12px] text-slate-600">
                <Loader2 className="size-4 animate-spin" />
                Loading mapping filters...
              </div>
            ) : !result ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-[12px] text-slate-500">
                Search for students to build the mapping matrix.
              </div>
            ) : result.students.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-[12px] text-slate-500">
                No data found.
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                  Note: Please select the checkbox for each student you want to save.
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                  <Table>
                    <TableHeader className="bg-slate-100/90">
                      <TableRow className="border-slate-200 hover:bg-transparent">
                        <TableHead className="h-9 w-[48px] px-3">
                          <input
                            type="checkbox"
                            checked={
                              result.students.length > 0 &&
                              selectedStudents.length === result.students.length
                            }
                            onChange={(event) =>
                              setSelectedStudents(
                                event.target.checked
                                  ? result.students.map((student) => student.studentId)
                                  : []
                              )
                            }
                          />
                        </TableHead>
                        <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                          Sr. No.
                        </TableHead>
                        <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                          Student Name
                        </TableHead>
                        <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                          Std / Div
                        </TableHead>
                        <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                          Mobile
                        </TableHead>
                        {selectedColumnOrder.map((column) => (
                          <TableHead
                            key={`${column.monthId}-${column.feeTypeId}`}
                            className="h-9 min-w-[150px] px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600"
                          >
                            {column.label}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.students.map((student) => (
                        <TableRow
                          key={student.studentId}
                          className="border-slate-200/90 hover:bg-slate-50/40"
                        >
                          <TableCell className="px-3 py-3">
                            <input
                              type="checkbox"
                              checked={selectedStudents.includes(student.studentId)}
                              onChange={(event) =>
                                setSelectedStudents((current) =>
                                  event.target.checked
                                    ? [...current, student.studentId]
                                    : current.filter((id) => id !== student.studentId)
                                )
                              }
                            />
                          </TableCell>
                          <TableCell className="px-3 py-3 text-[12px] text-slate-700">
                            {student.serial}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-[12px] font-semibold text-slate-900">
                            {student.name}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-[12px] text-slate-700">
                            {student.stdDiv}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-[12px] text-slate-700">
                            {student.mobile || '-'}
                          </TableCell>
                          {selectedColumnOrder.map((column) => {
                            const cell =
                              student.cells[column.monthId]?.[column.feeTypeId];
                            const isReadonly = Number(cell?.paid || 0) !== 0;
                            return (
                              <TableCell
                                key={`${student.studentId}-${column.monthId}-${column.feeTypeId}`}
                                className="px-3 py-3"
                              >
                                <Input
                                  value={
                                    studentValues[student.studentId]?.[column.monthId]?.[
                                      column.feeTypeId
                                    ] || ''
                                  }
                                  onChange={(event) =>
                                    setStudentValues((current) => ({
                                      ...current,
                                      [student.studentId]: {
                                        ...(current[student.studentId] || {}),
                                        [column.monthId]: {
                                          ...(current[student.studentId]?.[column.monthId] || {}),
                                          [column.feeTypeId]: event.target.value,
                                        },
                                      },
                                    }))
                                  }
                                  readOnly={isReadonly}
                                  className={cn(
                                    'h-9 rounded-md border-slate-300 bg-white px-3 text-[12px]',
                                    isReadonly && 'bg-slate-100 text-slate-500'
                                  )}
                                />
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-end">
                  <Button
                    className="h-9 rounded-xl bg-[#5b4fe9] px-4 text-[12px] font-semibold text-white hover:bg-[#4d42da]"
                    onClick={() => void handleSave()}
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save mapping'
                    )}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
