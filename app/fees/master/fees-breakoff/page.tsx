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
import {
  appendCommonParams,
  buildSessionContext,
  createAuthHeaders,
  normalizeApiStatus,
  readString,
  type ApiEnvelope,
} from '@/lib/erp-client';

type BreakoffListRow = {
  syear?: string | number | null;
  admission_year?: string | number | null;
  fees_head?: string | null;
  quota?: string | null;
  grade_name?: string | null;
  sta_name?: string | null;
  month_id?: string | null;
  amount?: string | number | null;
};

type BreakoffRecord = {
  syear: string;
  admissionYear: string;
  feesHead: string;
  quota: string;
  grade: string;
  standard: string;
  month: string;
  amount: string;
  searchText: string;
};

type SectionOption = {
  id: string;
  label: string;
};

type StandardOption = {
  id: string;
  label: string;
};

type StepTwoPayload = {
  gradeArr: string[];
  standardArr: string[];
  monthArr: string[];
  titleArr: Array<{ id: string; label: string }>;
  quotaArr: Array<{ id: string; label: string }>;
};

type MatrixState = Record<string, Record<string, string>>;

async function readApiResult(response: Response): Promise<ApiEnvelope | string> {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return (await response.json()) as ApiEnvelope;
  }

  const text = await response.text();
  if (!text) {
    return text;
  }

  try {
    return JSON.parse(text) as ApiEnvelope;
  } catch {
    return text;
  }
}

function readApiErrorMessage(result: ApiEnvelope | string, fallback: string): string {
  if (typeof result === 'string') {
    return result || fallback;
  }

  return result.message || fallback;
}

function mapListRow(row: BreakoffListRow): BreakoffRecord {
  const syear = readString(row.syear);
  const admissionYear = readString(row.admission_year);
  const feesHead = readString(row.fees_head);
  const quota = readString(row.quota);
  const grade = readString(row.grade_name);
  const standard = readString(row.sta_name);
  const month = readString(row.month_id);
  const amount = readString(row.amount);

  return {
    syear,
    admissionYear,
    feesHead,
    quota,
    grade,
    standard,
    month,
    amount,
    searchText: [
      syear,
      admissionYear,
      feesHead,
      quota,
      grade,
      standard,
      month,
      amount,
    ]
      .join(' ')
      .toLowerCase(),
  };
}

function readSelectedValues(event: React.ChangeEvent<HTMLSelectElement>): string[] {
  return Array.from(event.target.selectedOptions).map((option) => option.value);
}

function getRowTotal(matrix: MatrixState, quotaId: string): string {
  const row = matrix[quotaId] || {};
  const total = Object.values(row).reduce((sum, value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? sum + numeric : sum;
  }, 0);
  return total ? String(total) : '';
}

export default function FeesBreakoffPage() {
  const [session] = useState(buildSessionContext);
  const [records, setRecords] = useState<BreakoffRecord[]>([]);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [standards, setStandards] = useState<StandardOption[]>([]);
  const [monthOptions, setMonthOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
  const [selectedStandards, setSelectedStandards] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [stepTwoPayload, setStepTwoPayload] = useState<StepTwoPayload | null>(null);
  const [newValues, setNewValues] = useState<MatrixState>({});
  const [oldValues, setOldValues] = useState<MatrixState>({});
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const loadList = useCallback(async () => {
    if (!session.baseUrl) {
      setError('Session is missing the ERP host name.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const url = new URL(`${session.baseUrl}/fees/fees_breackoff`);
      appendCommonParams(url.searchParams, session);

      const response = await fetch(url.toString(), {
        headers: createAuthHeaders(session),
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Failed to load fees breakoff (${response.status})`);
      }

      const payload = (await response.json()) as ApiEnvelope;
      const rows = Array.isArray(payload.data)
        ? (payload.data as BreakoffListRow[])
        : [];
      setRecords(rows.map(mapListRow));
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : 'Failed to load fees breakoff.'
      );
    } finally {
      setLoading(false);
    }
  }, [session]);

  const loadSections = useCallback(async () => {
    if (!session.baseUrl || !session.subInstituteId || !session.syear || !session.token) return;

    try {
      const formData = new URLSearchParams();
      formData.append('sub_institute_id', session.subInstituteId);
      formData.append('syear', session.syear);
      formData.append('token', session.token);

      const response = await fetch(`${session.baseUrl}/get_adminAcademicSection`, {
        method: 'POST',
        headers: createAuthHeaders(session, 'application/x-www-form-urlencoded'),
        body: formData.toString(),
      });

      if (!response.ok) return;

      const payload = (await response.json()) as ApiEnvelope;
      const rows = Array.isArray(payload.data)
        ? (payload.data as Array<Record<string, unknown>>)
        : [];
      setSections(
        rows.map((item) => ({
          id: readString(item.id),
          label: readString(item.title || item.short_name || item.name),
        }))
      );
    } catch {}
  }, [session]);

  const loadStandards = useCallback(
    async (gradeIds: string[]) => {
      if (!session.baseUrl || !session.subInstituteId || !session.syear || !session.token) {
        setStandards([]);
        return;
      }

      if (gradeIds.length === 0) {
        setStandards([]);
        return;
      }

      try {
        const responses = await Promise.all(
          gradeIds.map(async (gradeId) => {
            const formData = new URLSearchParams();
            formData.append('sub_institute_id', session.subInstituteId);
            formData.append('syear', session.syear);
            formData.append('grade_id', gradeId);
            formData.append('token', session.token);

            const response = await fetch(`${session.baseUrl}/get_adminStandard`, {
              method: 'POST',
              headers: createAuthHeaders(
                session,
                'application/x-www-form-urlencoded'
              ),
              body: formData.toString(),
            });

            if (!response.ok) return [];

            const payload = (await response.json()) as ApiEnvelope;
            return Array.isArray(payload.data)
              ? (payload.data as Array<Record<string, unknown>>)
              : [];
          })
        );

        const unique = new Map<string, StandardOption>();
        responses.flat().forEach((item) => {
          const id = readString(item.id);
          if (!id || unique.has(id)) return;
          unique.set(id, {
            id,
            label: readString(item.name || item.short_name),
          });
        });

        setStandards(Array.from(unique.values()));
      } catch {
        setStandards([]);
      }
    },
    [session]
  );

  const loadMonthOptions = useCallback(async () => {
    if (!session.baseUrl) return;

    try {
      const url = new URL(`${session.baseUrl}/fees/fees_breackoff/create`);
      appendCommonParams(url.searchParams, session);

      const response = await fetch(url.toString(), {
        headers: createAuthHeaders(session),
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Failed to load fee months (${response.status})`);
      }

      const payload = (await response.json()) as ApiEnvelope;
      const apiStatus = normalizeApiStatus(payload);
      if (apiStatus === '0') {
        throw new Error(payload.message || 'Please map fees year first.');
      }

      const source =
        payload.data &&
        typeof payload.data === 'object' &&
        'ddMonth' in payload.data &&
        payload.data.ddMonth &&
        typeof payload.data.ddMonth === 'object'
          ? (payload.data.ddMonth as Record<string, unknown>)
          : {};

      setMonthOptions(
        Object.entries(source).map(([id, label]) => ({
          id,
          label: readString(label),
        }))
      );
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : 'Failed to load fee months.'
      );
    }
  }, [session]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadList();
      void loadSections();
      void loadMonthOptions();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadList, loadMonthOptions, loadSections]);

  const filteredRecords = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return records;
    return records.filter((record) => record.searchText.includes(query));
  }, [records, searchTerm]);

  const handleGradesChange = async (values: string[]) => {
    setSelectedGrades(values);
    setSelectedStandards([]);
    setStepTwoPayload(null);
    await loadStandards(values);
  };

  const handleGenerateMatrix = async () => {
    if (!session.baseUrl) {
      setError('Session is missing the ERP host name.');
      return;
    }

    if (selectedGrades.length === 0 || selectedStandards.length === 0 || selectedMonths.length === 0) {
      setError('Select grade, standard, and at least one month.');
      return;
    }

    setFormLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const formData = new FormData();
      formData.append('type', 'API');
      formData.append('sub_institute_id', session.subInstituteId);
      formData.append('syear', session.syear);
      selectedGrades.forEach((gradeId) => formData.append('grade[]', gradeId));
      selectedStandards.forEach((standardId) =>
        formData.append('standard[]', standardId)
      );
      selectedMonths.forEach((monthId) =>
        formData.append(`month[${monthId}]`, monthId)
      );

      const response = await fetch(`${session.baseUrl}/fees/fees_breackoff`, {
        method: 'POST',
        headers: createAuthHeaders(session),
        body: formData,
      });

      const result = await readApiResult(response);
      if (!response.ok) {
        throw new Error(
          readApiErrorMessage(
            result,
            `Failed to prepare fees breakoff matrix (${response.status})`
          )
        );
      }

      const payload = typeof result === 'string' ? null : (result as ApiEnvelope);
      if (!payload) {
        throw new Error('Invalid fees breakoff response.');
      }
      const titleMap =
        payload.data &&
        typeof payload.data === 'object' &&
        'title_arr' in payload.data &&
        payload.data.title_arr &&
        typeof payload.data.title_arr === 'object'
          ? (payload.data.title_arr as Record<string, unknown>)
          : {};
      const quotaMap =
        payload.data &&
        typeof payload.data === 'object' &&
        'quota_arr' in payload.data &&
        payload.data.quota_arr &&
        typeof payload.data.quota_arr === 'object'
          ? (payload.data.quota_arr as Record<string, unknown>)
          : {};
      const payloadData =
        payload.data && typeof payload.data === 'object'
          ? (payload.data as Record<string, unknown>)
          : null;

      setStepTwoPayload({
        gradeArr: payloadData && Array.isArray(payloadData.grade_arr)
          ? (payloadData.grade_arr as string[])
          : [],
        standardArr: payloadData && Array.isArray(payloadData.std_arr)
          ? (payloadData.std_arr as string[])
          : [],
        monthArr: payloadData && Array.isArray(payloadData.month_arr)
          ? (payloadData.month_arr as string[])
          : [],
        titleArr: Object.entries(titleMap).map(([id, label]) => ({
          id,
          label: readString(label),
        })),
        quotaArr: Object.entries(quotaMap).map(([id, label]) => ({
          id,
          label: readString(label),
        })),
      });
      setNewValues({});
      setOldValues({});
    } catch (fetchError) {
      console.error('Add structure error:', fetchError);
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : 'Failed to prepare fees breakoff matrix.'
      );
    } finally {
      setFormLoading(false);
    }
  };

  const updateMatrixValue = (
    matrix: MatrixState,
    setMatrix: React.Dispatch<React.SetStateAction<MatrixState>>,
    quotaId: string,
    titleId: string,
    value: string
  ) => {
    setMatrix({
      ...matrix,
      [quotaId]: {
        ...(matrix[quotaId] || {}),
        [titleId]: value,
      },
    });
  };

  const handleSave = async () => {
    if (!session.baseUrl || !stepTwoPayload) return;

    setSaving(true);
    setError('');
    setSuccessMessage('');

    try {
      const formData = new FormData();
      formData.append('type', 'API');
      formData.append('action', 'insert');
      formData.append('sub_institute_id', session.subInstituteId);
      formData.append('syear', session.syear);
      selectedGrades.forEach((gradeId) => formData.append('grade[]', gradeId));
      selectedStandards.forEach((standardId) =>
        formData.append('standard[]', standardId)
      );
      selectedMonths.forEach((monthId) =>
        formData.append(`month[${monthId}]`, monthId)
      );

      Object.entries(newValues).forEach(([quotaId, titles]) => {
        Object.entries(titles).forEach(([titleId, amount]) => {
          formData.append(`NewValues[${quotaId}][${titleId}]`, amount);
        });
      });

      Object.entries(oldValues).forEach(([quotaId, titles]) => {
        Object.entries(titles).forEach(([titleId, amount]) => {
          formData.append(`OldValues[${quotaId}][${titleId}]`, amount);
        });
      });

      const response = await fetch(`${session.baseUrl}/fees/fees_breackoff`, {
        method: 'POST',
        headers: createAuthHeaders(session),
        body: formData,
      });

      const result = await readApiResult(response);
      if (!response.ok) {
        throw new Error(
          readApiErrorMessage(
            result,
            `Failed to save fees breakoff (${response.status})`
          )
        );
      }

      const payload = typeof result === 'string' ? null : (result as ApiEnvelope);
      if (!payload) {
        throw new Error('Invalid fees breakoff save response.');
      }
      const apiStatus = normalizeApiStatus(payload);
      if (apiStatus && apiStatus !== '1') {
        throw new Error(payload.message || 'Failed to save fees breakoff.');
      }

      setSuccessMessage(payload.message || 'Fees structure saved successfully.');
      setStepTwoPayload(null);
      setNewValues({});
      setOldValues({});
      await loadList();
    } catch (saveError) {
      console.error('Save structure error:', saveError);
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Failed to save fees breakoff.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#e9eef7] p-4 sm:p-5 lg:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <Card className="rounded-2xl border border-slate-200/90 bg-white py-0 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <CardHeader className="gap-1 border-b border-slate-200/80 px-4 py-4 sm:px-5">
            <CardTitle className="text-[16px] font-semibold text-slate-950">
              Fees breakoff
            </CardTitle>
            <CardDescription className="text-[12px] leading-5 text-slate-600">
              Create the class-wise fees structure exactly like the legacy ERP flow
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

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium text-slate-700">
                  Grade
                </Label>
                <select
                  multiple
                  value={selectedGrades}
                  onChange={(event) =>
                    void handleGradesChange(readSelectedValues(event))
                  }
                  className="min-h-[132px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-[12px] text-slate-700 outline-none"
                >
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
                  multiple
                  value={selectedStandards}
                  onChange={(event) =>
                    setSelectedStandards(readSelectedValues(event))
                  }
                  className="min-h-[132px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-[12px] text-slate-700 outline-none"
                >
                  {standards.map((standard) => (
                    <option key={standard.id} value={standard.id}>
                      {standard.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium text-slate-700">
                  Months
                </Label>
                <div className="max-h-[132px] overflow-y-auto rounded-xl border border-slate-300 bg-white px-3 py-2">
                  <div className="grid gap-2">
                    {monthOptions.map((month) => (
                      <label
                        key={month.id}
                        className="flex items-center gap-2 text-[12px] text-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={selectedMonths.includes(month.id)}
                          onChange={(event) => {
                            setSelectedMonths((current) =>
                              event.target.checked
                                ? [...current, month.id]
                                : current.filter((value) => value !== month.id)
                            );
                            setStepTwoPayload(null);
                          }}
                        />
                        {month.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                className="h-9 rounded-xl bg-[#5b4fe9] px-4 text-[12px] font-semibold text-white hover:bg-[#4d42da]"
                onClick={() => void handleGenerateMatrix()}
                disabled={formLoading}
              >
                {formLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Preparing...
                  </>
                ) : (
                  'Add fees structure'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {stepTwoPayload ? (
          <>
            <Card className="rounded-2xl border border-slate-200/90 bg-white py-0 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <CardContent className="px-4 py-4 sm:px-5">
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Grade
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {stepTwoPayload.gradeArr.map((item) => (
                        <span
                          key={item}
                          className="rounded-full bg-emerald-50 px-2 py-1 text-[12px] text-emerald-700"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Standard
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {stepTwoPayload.standardArr.map((item) => (
                        <span
                          key={item}
                          className="rounded-full bg-blue-50 px-2 py-1 text-[12px] text-blue-700"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Month
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {stepTwoPayload.monthArr.map((item) => (
                        <span
                          key={item}
                          className="rounded-full bg-slate-100 px-2 py-1 text-[12px] text-slate-700"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {(['New Student', 'Old Student'] as const).map((sectionTitle) => {
              const isNewStudent = sectionTitle === 'New Student';
              const matrix = isNewStudent ? newValues : oldValues;
              const setMatrix = isNewStudent ? setNewValues : setOldValues;

              return (
                <Card
                  key={sectionTitle}
                  className="rounded-2xl border border-slate-200/90 bg-white py-0 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                >
                  <CardHeader className="gap-1 border-b border-slate-200/80 px-4 py-4 sm:px-5">
                    <CardTitle className="text-[15px] font-semibold text-slate-950">
                      {sectionTitle}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 py-4 sm:px-5">
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full min-w-[720px] border-collapse text-sm">
                        <thead className="bg-slate-100/90">
                          <tr className="border-b border-slate-200">
                            <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                              Quota
                            </th>
                            {stepTwoPayload.titleArr.map((title) => (
                              <th
                                key={title.id}
                                className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600"
                              >
                                {title.label}
                              </th>
                            ))}
                            <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                              Total
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {stepTwoPayload.quotaArr.map((quota) => (
                            <tr
                              key={quota.id}
                              className="border-b border-slate-200/90 last:border-b-0"
                            >
                              <td className="px-3 py-3 text-[12px] font-medium text-slate-900">
                                {quota.label}
                              </td>
                              {stepTwoPayload.titleArr.map((title) => (
                                <td key={title.id} className="px-3 py-3">
                                  <Input
                                    value={matrix[quota.id]?.[title.id] || ''}
                                    onChange={(event) =>
                                      updateMatrixValue(
                                        matrix,
                                        setMatrix,
                                        quota.id,
                                        title.id,
                                        event.target.value
                                      )
                                    }
                                    className="h-9 min-w-[90px] rounded-md border-slate-300 bg-white px-3 text-[12px]"
                                  />
                                </td>
                              ))}
                              <td className="px-3 py-3">
                                <Input
                                  value={getRowTotal(matrix, quota.id)}
                                  readOnly
                                  className="h-9 min-w-[90px] rounded-md border-slate-300 bg-slate-50 px-3 text-[12px] font-semibold"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

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
                  'Save fees structure'
                )}
              </Button>
            </div>
          </>
        ) : null}

        <Card className="rounded-2xl border border-slate-200/90 bg-white py-0 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <CardHeader className="gap-4 border-b border-slate-200/80 px-4 py-4 sm:px-5">
            <div>
              <CardTitle className="text-[16px] font-semibold text-slate-950">
                Existing fees structure
              </CardTitle>
              <CardDescription className="text-[12px] leading-5 text-slate-600">
                Current breakoff rows from the Laravel ERP
              </CardDescription>
            </div>

            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search fees structure"
                className="h-9 rounded-xl border-slate-300 bg-white pl-9 text-[12px]"
              />
            </div>
          </CardHeader>
          <CardContent className="px-4 py-4 sm:px-5">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <Table>
                <TableHeader className="bg-slate-100/90">
                  <TableRow className="border-slate-200 hover:bg-transparent">
                    <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                      Syear
                    </TableHead>
                    <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                      Fee Head
                    </TableHead>
                    <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                      Admission
                    </TableHead>
                    <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                      Quota
                    </TableHead>
                    <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                      Grade
                    </TableHead>
                    <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                      Standard
                    </TableHead>
                    <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                      Month
                    </TableHead>
                    <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                      Amount
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="px-3 py-10 text-center text-[12px] text-slate-500"
                      >
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="size-4 animate-spin" />
                          Loading fees breakoff...
                        </span>
                      </TableCell>
                    </TableRow>
                  ) : filteredRecords.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="px-3 py-10 text-center text-[12px] text-slate-500"
                      >
                        {searchTerm
                          ? 'No rows match your search.'
                          : 'No fees structure rows found.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRecords.map((record, index) => (
                      <TableRow
                        key={`${record.syear}-${record.feesHead}-${record.month}-${index}`}
                        className="border-slate-200/90 hover:bg-slate-50/40"
                      >
                        <TableCell className="px-3 py-3 text-[12px] text-slate-700">
                          {record.syear}
                        </TableCell>
                        <TableCell className="px-3 py-3 text-[12px] font-semibold text-slate-900">
                          {record.feesHead}
                        </TableCell>
                        <TableCell className="px-3 py-3 text-[12px] text-slate-700">
                          {record.admissionYear}
                        </TableCell>
                        <TableCell className="px-3 py-3 text-[12px] text-slate-700">
                          {record.quota}
                        </TableCell>
                        <TableCell className="px-3 py-3 text-[12px] text-slate-700">
                          {record.grade}
                        </TableCell>
                        <TableCell className="px-3 py-3 text-[12px] text-slate-700">
                          {record.standard}
                        </TableCell>
                        <TableCell className="px-3 py-3 text-[12px] text-slate-700">
                          {record.month}
                        </TableCell>
                        <TableCell className="px-3 py-3 text-[12px] text-slate-700">
                          {record.amount}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
