'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';

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
  appendCommonParams,
  buildSessionContext,
  createAuthHeaders,
  normalizeApiStatus,
  readString,
  type ApiEnvelope,
} from '@/lib/erp-client';

type ReceiptBookApiRow = {
  receipt_id?: string | number | null;
  receipt_line_1?: string | null;
  receipt_line_2?: string | null;
  receipt_line_3?: string | null;
  receipt_line_4?: string | null;
  receipt_prefix?: string | null;
  receipt_postfix?: string | null;
  grade?: string | null;
  standard?: string | null;
  fees_head?: string | null;
  sort_order?: string | number | null;
  status?: string | null;
  account_number?: string | null;
};

type ReceiptBookRecord = {
  id: string;
  receiptId: string;
  receiptLine1: string;
  receiptLine2: string;
  receiptLine3: string;
  receiptLine4: string;
  receiptPrefix: string;
  receiptPostfix: string;
  grade: string;
  standard: string;
  feesHead: string;
  sortOrder: string;
  status: string;
  accountNumber: string;
  searchText: string;
};

type ReceiptBookEditApiRow = {
  id?: string | number | null;
  receipt_id?: string | number | null;
  receipt_line_1?: string | null;
  receipt_line_2?: string | null;
  receipt_line_3?: string | null;
  receipt_line_4?: string | null;
  receipt_prefix?: string | null;
  receipt_postfix?: string | null;
  account_number?: string | null;
  sort_order?: string | number | null;
  last_receipt_number?: string | number | null;
  pan?: string | null;
  branch?: string | null;
  grade_id?: string | null;
  standard_id?: string | null;
  fees_head_id?: string | null;
  receipt_logo?: string | null;
  bank_logo?: string | null;
};

type SectionOption = {
  id: string;
  label: string;
};

type StandardOption = {
  id: string;
  label: string;
  gradeId: string;
};

type FeeHeadOption = {
  id: string;
  label: string;
};

type ReceiptBookCreatePayload = {
  feeHeadList?: Array<Record<string, unknown>>;
  existingMappings?: Array<Record<string, unknown>>;
  receipt_id?: string | number | null;
};

type ExistingReceiptBookMapping = {
  receipt_id: string;
  grade_id: string;
  standard_id: string;
  fees_head_id: string;
};

type ReceiptBookForm = {
  receipt_id: string;
  receipt_line_1: string;
  receipt_line_2: string;
  receipt_line_3: string;
  receipt_line_4: string;
  receipt_prefix: string;
  receipt_postfix: string;
  account_number: string;
  sort_order: string;
  last_receipt_number: string;
  pan: string;
  branch: string;
  grade: string[];
  standard: string[];
  fees_head_id: string[];
  fees_receipt_logo: File | null;
  fees_bank_logo: File | null;
  existing_receipt_logo: string;
  existing_bank_logo: string;
};

type FormErrors = Partial<Record<keyof ReceiptBookForm, string>>;

const multiSelectClassName =
  'min-h-[132px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-[12px] text-slate-700 outline-none focus:border-slate-400';

const initialForm: ReceiptBookForm = {
  receipt_id: '',
  receipt_line_1: '',
  receipt_line_2: '',
  receipt_line_3: '',
  receipt_line_4: '',
  receipt_prefix: '',
  receipt_postfix: '',
  account_number: '',
  sort_order: '',
  last_receipt_number: '0',
  pan: '',
  branch: '',
  grade: [],
  standard: [],
  fees_head_id: [],
  fees_receipt_logo: null,
  fees_bank_logo: null,
  existing_receipt_logo: '',
  existing_bank_logo: '',
};

function mapRecord(row: ReceiptBookApiRow): ReceiptBookRecord {
  const receiptLine1 = readString(row.receipt_line_1);
  const receiptLine2 = readString(row.receipt_line_2);
  const receiptLine3 = readString(row.receipt_line_3);
  const receiptLine4 = readString(row.receipt_line_4);
  const receiptPrefix = readString(row.receipt_prefix);
  const receiptPostfix = readString(row.receipt_postfix);
  const grade = readString(row.grade);
  const standard = readString(row.standard);
  const feesHead = readString(row.fees_head);
  const sortOrder = readString(row.sort_order);
  const status = readString(row.status);
  const accountNumber = readString(row.account_number);

  return {
    id: readString(row.receipt_id),
    receiptId: readString(row.receipt_id),
    receiptLine1,
    receiptLine2,
    receiptLine3,
    receiptLine4,
    receiptPrefix,
    receiptPostfix,
    grade,
    standard,
    feesHead,
    sortOrder,
    status,
    accountNumber,
    searchText: [
      receiptLine1,
      receiptLine2,
      receiptLine3,
      receiptLine4,
      receiptPrefix,
      receiptPostfix,
      grade,
      standard,
      feesHead,
      sortOrder,
      status,
      accountNumber,
    ]
      .join(' ')
      .toLowerCase(),
  };
}

function parseCsvIds(value: unknown): string[] {
  return readString(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function mapEditPayload(row: ReceiptBookEditApiRow): Partial<ReceiptBookForm> {
  return {
    receipt_id: readString(row.receipt_id),
    receipt_line_1: readString(row.receipt_line_1),
    receipt_line_2: readString(row.receipt_line_2),
    receipt_line_3: readString(row.receipt_line_3),
    receipt_line_4: readString(row.receipt_line_4),
    receipt_prefix: readString(row.receipt_prefix),
    receipt_postfix: readString(row.receipt_postfix),
    account_number: readString(row.account_number),
    sort_order: readString(row.sort_order),
    last_receipt_number: readString(row.last_receipt_number),
    pan: readString(row.pan),
    branch: readString(row.branch),
    grade: parseCsvIds(row.grade_id),
    standard: parseCsvIds(row.standard_id),
    fees_head_id: parseCsvIds(row.fees_head_id),
    existing_receipt_logo: readString(row.receipt_logo),
    existing_bank_logo: readString(row.bank_logo),
  };
}

function normalizeCreatePayload(
  payload: ApiEnvelope | null
): ReceiptBookCreatePayload {
  if (!payload) {
    return {};
  }

  const source =
    payload.data && typeof payload.data === 'object'
      ? (payload.data as Record<string, unknown>)
      : (payload as Record<string, unknown>);

  return {
    feeHeadList:
      'feeHeadList' in source && Array.isArray(source.feeHeadList)
        ? (source.feeHeadList as Array<Record<string, unknown>>)
        : [],
    existingMappings:
      'existingMappings' in source && Array.isArray(source.existingMappings)
        ? (source.existingMappings as Array<Record<string, unknown>>)
        : [],
    receipt_id:
      'receipt_id' in source ? (source.receipt_id as string | number | null) : '',
  };
}

function mapExistingMappings(
  items: Array<Record<string, unknown>>
): ExistingReceiptBookMapping[] {
  return items.map((item) => ({
    receipt_id: readString(item.receipt_id),
    grade_id: readString(item.grade_id),
    standard_id: readString(item.standard_id),
    fees_head_id: readString(item.fees_head_id),
  }));
}

function readSelectedValues(event: React.ChangeEvent<HTMLSelectElement>): string[] {
  return Array.from(event.target.selectedOptions).map((option) => option.value);
}

export default function FeesReceiptBookMasterPage() {
  const [session] = useState(buildSessionContext);
  const [records, setRecords] = useState<ReceiptBookRecord[]>([]);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [standards, setStandards] = useState<StandardOption[]>([]);
  const [feeHeadOptions, setFeeHeadOptions] = useState<FeeHeadOption[]>([]);
  const [existingMappings, setExistingMappings] = useState<ExistingReceiptBookMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ReceiptBookRecord | null>(null);
  const [form, setForm] = useState<ReceiptBookForm>(initialForm);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);

  const loadRecords = useCallback(async () => {
    if (!session.baseUrl) {
      setError('Session is missing the ERP host name.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const url = new URL(`${session.baseUrl}/fees/fees_receipt_book_master`);
      appendCommonParams(url.searchParams, session);

      const response = await fetch(url.toString(), {
        headers: createAuthHeaders(session),
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(
          `Failed to load receipt books (${response.status})`
        );
      }

      const payload = (await response.json()) as ApiEnvelope;
      const apiStatus = normalizeApiStatus(payload);
      if (apiStatus && apiStatus !== '1') {
        throw new Error(payload.message || 'Failed to load receipt books.');
      }
      const rows = Array.isArray(payload.data)
        ? (payload.data as ReceiptBookApiRow[])
        : [];
      setRecords(rows.map(mapRecord));
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : 'Failed to load receipt books.'
      );
    } finally {
      setLoading(false);
    }
  }, [session]);

  const loadSections = useCallback(async () => {
    if (!session.baseUrl || !session.subInstituteId || !session.syear || !session.token) {
      return;
    }

    try {
      const formData = new URLSearchParams();
      formData.append('sub_institute_id', session.subInstituteId);
      formData.append('syear', session.syear);
      formData.append('token', session.token);

      const response = await fetch(
        `${session.baseUrl}/get_adminAcademicSection`,
        {
          method: 'POST',
          headers: createAuthHeaders(session, 'application/x-www-form-urlencoded'),
          body: formData.toString(),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to load grades (${response.status})`);
      }

      const payload = (await response.json()) as ApiEnvelope;
      const items = Array.isArray(payload.data)
        ? (payload.data as Array<Record<string, unknown>>)
        : [];
      setSections(
        items.map((item) => ({
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

        const merged = responses.flat();
        const unique = new Map<string, StandardOption>();
        merged.forEach((item) => {
          const id = readString(item.id);
          if (!id || unique.has(id)) return;
          unique.set(id, {
            id,
            label: readString(item.name || item.short_name),
            gradeId: readString(item.grade_id),
          });
        });

        setStandards(Array.from(unique.values()));
      } catch {
        setStandards([]);
      }
    },
    [session]
  );

  const loadCreateMetadata = useCallback(async () => {
    if (!session.baseUrl) return;

    setFormLoading(true);
    setError('');

    try {
      const url = new URL(`${session.baseUrl}/fees/fees_receipt_book_master/create`);
      appendCommonParams(url.searchParams, session);

      const response = await fetch(url.toString(), {
        headers: createAuthHeaders(session),
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(
          `Failed to load receipt book form (${response.status})`
        );
      }

      const payload = (await response.json()) as ApiEnvelope;
      const createData = normalizeCreatePayload(payload);
      const rawFeeHeads = createData.feeHeadList ?? [];
      const rawMappings = createData.existingMappings ?? [];
      const nextReceiptId = readString(createData.receipt_id);

      setFeeHeadOptions(
        rawFeeHeads.map((item) => ({
          id: readString(item.id),
          label: readString(item.display_name),
        }))
      );
      setExistingMappings(mapExistingMappings(rawMappings));

      setForm((current) => ({
        ...current,
        receipt_id: nextReceiptId || current.receipt_id,
      }));
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : 'Failed to load receipt book form.'
      );
    } finally {
      setFormLoading(false);
    }
  }, [session]);

  const loadEditPayload = useCallback(
    async (record: ReceiptBookRecord) => {
      if (!session.baseUrl) return;

      setFormLoading(true);
      setError('');

      try {
        const url = new URL(
          `${session.baseUrl}/fees/fees_receipt_book_master/${encodeURIComponent(
            record.receiptId
          )}/edit`
        );
        appendCommonParams(url.searchParams, session);

        const response = await fetch(url.toString(), {
          headers: createAuthHeaders(session),
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error(
            `Failed to load receipt book details (${response.status})`
          );
        }

        const payload = (await response.json()) as ApiEnvelope;
        const apiStatus = normalizeApiStatus(payload);
        if (apiStatus && apiStatus !== '1') {
          throw new Error(payload.message || 'Receipt book record not found.');
        }

        const payloadData =
          payload.data && typeof payload.data === 'object'
            ? (payload.data as Record<string, unknown>)
            : null;
        const rawRecord =
          payloadData &&
          'record' in payloadData &&
          payloadData.record &&
          typeof payloadData.record === 'object'
            ? (payloadData.record as ReceiptBookEditApiRow)
            : null;

        if (!rawRecord) {
          throw new Error(payload.message || 'Receipt book record not found.');
        }

        const rawFeeHeads =
          payloadData &&
          'feeHeadList' in payloadData &&
          Array.isArray(payloadData.feeHeadList)
            ? (payloadData.feeHeadList as Array<Record<string, unknown>>)
            : [];
        const rawMappings =
          payloadData &&
          'existingMappings' in payloadData &&
          Array.isArray(payloadData.existingMappings)
            ? (payloadData.existingMappings as Array<Record<string, unknown>>)
            : [];
        const parsed = mapEditPayload(rawRecord);

        setFeeHeadOptions(
          rawFeeHeads.map((item) => ({
            id: readString(item.id),
            label: readString(item.display_name),
          }))
        );
        setExistingMappings(mapExistingMappings(rawMappings));

        setForm({
          ...initialForm,
          ...parsed,
          fees_receipt_logo: null,
          fees_bank_logo: null,
        });
        setEditingRecord(record);
        await loadStandards(parsed.grade ?? []);
        setIsDrawerOpen(true);
      } catch (fetchError) {
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : 'Failed to load receipt book details.'
        );
      } finally {
        setFormLoading(false);
      }
    },
    [loadStandards, session]
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadRecords();
      void loadSections();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadRecords, loadSections]);

  useEffect(() => {
    if (isDrawerOpen) {
      const frame = window.requestAnimationFrame(() => {
        setIsDrawerVisible(true);
      });
      document.body.style.overflow = 'hidden';
      return () => window.cancelAnimationFrame(frame);
    }

    document.body.style.overflow = '';
    const timeout = window.setTimeout(() => setIsDrawerVisible(false), 300);
    return () => window.clearTimeout(timeout);
  }, [isDrawerOpen]);

  const filteredRecords = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return records;
    return records.filter((record) => record.searchText.includes(query));
  }, [records, searchTerm]);

  const selectedStandards = useMemo(
    () => standards.filter((option) => form.standard.includes(option.id)),
    [form.standard, standards]
  );

  const selectedFeeHeads = useMemo(
    () => feeHeadOptions.filter((option) => form.fees_head_id.includes(option.id)),
    [feeHeadOptions, form.fees_head_id]
  );

  const unavailableFeeHeadIds = useMemo(() => {
    if (form.standard.length === 0) {
      return new Set<string>();
    }

    return new Set(
      existingMappings
        .filter((mapping) => {
          if (editingRecord && mapping.receipt_id === editingRecord.receiptId) {
            return false;
          }

          return form.standard.includes(mapping.standard_id);
        })
        .map((mapping) => mapping.fees_head_id)
    );
  }, [editingRecord, existingMappings, form.standard]);

  const updateField = <K extends keyof ReceiptBookForm>(
    field: K,
    value: ReceiptBookForm[K]
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: undefined }));
  };

  const openCreateDrawer = async () => {
    setEditingRecord(null);
    setForm(initialForm);
    setFormErrors({});
    setIsDrawerOpen(true);
    await loadCreateMetadata();
  };

  const closeDrawer = () => {
    if (submitting || formLoading) return;
    setIsDrawerOpen(false);
    setEditingRecord(null);
    setForm(initialForm);
    setFormErrors({});
  };

  const validateForm = () => {
    const nextErrors: FormErrors = {};

    if (!form.receipt_line_1.trim()) nextErrors.receipt_line_1 = 'Receipt line 1 is required';
    if (!form.receipt_line_2.trim()) nextErrors.receipt_line_2 = 'Receipt line 2 is required';
    if (!form.sort_order.trim()) nextErrors.sort_order = 'Sort order is required';
    if (form.grade.length === 0) nextErrors.grade = 'Select at least one grade';
    if (form.standard.length === 0) nextErrors.standard = 'Select at least one standard';
    if (form.fees_head_id.length === 0) nextErrors.fees_head_id = 'Select at least one fee head';
    if (form.fees_head_id.some((id) => unavailableFeeHeadIds.has(id))) {
      nextErrors.fees_head_id =
        'One or more selected fee heads are already mapped for the selected standard.';
    }

    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleGradeChange = async (gradeIds: string[]) => {
    updateField('grade', gradeIds);
    updateField('standard', []);
    await loadStandards(gradeIds);
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    if (!session.baseUrl) {
      setError('Session is missing the ERP host name.');
      return;
    }
    if (!session.subInstituteId || !session.syear) {
      setError('Institute ID and academic year are required.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccessMessage('');

    try {
      const formData = new FormData();
      formData.append('type', 'API');
      formData.append('receipt_id', form.receipt_id);
      formData.append('receipt_line_1', form.receipt_line_1.trim());
      formData.append('receipt_line_2', form.receipt_line_2.trim());
      formData.append('receipt_line_3', form.receipt_line_3.trim());
      formData.append('receipt_line_4', form.receipt_line_4.trim());
      formData.append('receipt_prefix', form.receipt_prefix.trim());
      formData.append('receipt_postfix', form.receipt_postfix.trim());
      formData.append('account_number', form.account_number.trim());
      formData.append('sort_order', form.sort_order.trim());
      formData.append('last_receipt_number', form.last_receipt_number.trim());
      formData.append('pan', form.pan.trim());
      formData.append('branch', form.branch.trim());
      formData.append('submit', editingRecord ? 'Update' : 'Save');
      formData.append('sub_institute_id', session.subInstituteId);
      formData.append('syear', session.syear);

      form.grade.forEach((gradeId) => formData.append('grade[]', gradeId));
      form.standard.forEach((standardId) =>
        formData.append('standard[]', standardId)
      );
      form.fees_head_id.forEach((headId) =>
        formData.append('fees_head_id[]', headId)
      );

      if (form.fees_receipt_logo) {
        formData.append('fees_receipt_logo', form.fees_receipt_logo);
      } else if (editingRecord && form.existing_receipt_logo) {
        formData.append(
          'receipt_logo',
          form.existing_receipt_logo.split('/').pop() || ''
        );
      }

      if (form.fees_bank_logo) {
        formData.append('fees_bank_logo', form.fees_bank_logo);
      }

      const response = await fetch(
        `${session.baseUrl}/fees/fees_receipt_book_master`,
        {
          method: 'POST',
          headers: createAuthHeaders(session),
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to ${editingRecord ? 'update' : 'save'} receipt book (${response.status})`
        );
      }

      const payload = (await response.json()) as ApiEnvelope;
      const apiStatus = normalizeApiStatus(payload);
      if (apiStatus && apiStatus !== '1') {
        if ((payload.message || '').toLowerCase().includes('fees head')) {
          setFormErrors((current) => ({
            ...current,
            fees_head_id: payload.message || 'Failed to save receipt book.',
          }));
        }
        throw new Error(payload.message || 'Failed to save receipt book.');
      }

      setSuccessMessage(
        payload.message ||
          `Receipt book ${editingRecord ? 'updated' : 'saved'} successfully.`
      );
      closeDrawer();
      await loadRecords();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Failed to save receipt book.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (record: ReceiptBookRecord) => {
    if (!session.baseUrl) {
      setError('Session is missing the ERP host name.');
      return;
    }

    if (!window.confirm(`Delete receipt book ${record.receiptId}?`)) {
      return;
    }

    setDeletingId(record.receiptId);
    setError('');
    setSuccessMessage('');

    try {
      const url = new URL(
        `${session.baseUrl}/fees/fees_receipt_book_master/${encodeURIComponent(
          record.receiptId
        )}`
      );
      appendCommonParams(url.searchParams, session);

      const response = await fetch(url.toString(), {
        method: 'DELETE',
        headers: createAuthHeaders(session),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to delete receipt book (${response.status})`
        );
      }

      const payload = (await response.json()) as ApiEnvelope;
      const apiStatus = normalizeApiStatus(payload);
      if (apiStatus && apiStatus !== '1') {
        throw new Error(payload.message || 'Failed to delete receipt book.');
      }

      setSuccessMessage(payload.message || 'Receipt book deleted successfully.');
      await loadRecords();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Failed to delete receipt book.'
      );
    } finally {
      setDeletingId('');
    }
  };

  return (
    <>
      <div className="min-h-screen bg-[#e9eef7] p-4 sm:p-5 lg:p-6">
        <div className="mx-auto max-w-7xl">
          <Card className="rounded-2xl border border-slate-200/90 bg-white py-0 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <CardHeader className="gap-4 border-b border-slate-200/80 px-4 py-4 sm:px-5">
              <div>
                <CardTitle className="text-[16px] font-semibold text-slate-950">
                  Fees receipt book master
                </CardTitle>
                <CardDescription className="text-[12px] leading-5 text-slate-600">
                  Receipt books, numbering prefixes and class-to-fee-head mappings
                </CardDescription>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search receipt books"
                    className="h-9 rounded-xl border-slate-300 bg-white pl-9 text-[12px]"
                  />
                </div>

                <Button
                  className="h-9 rounded-xl bg-[#5b4fe9] px-4 text-[12px] font-semibold text-white hover:bg-[#4d42da]"
                  onClick={() => void openCreateDrawer()}
                >
                  <Plus className="size-4" />
                  Add receipt book
                </Button>
              </div>
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

              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <Table>
                  <TableHeader className="bg-slate-100/90">
                    <TableRow className="border-slate-200 hover:bg-transparent">
                      <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                        Id
                      </TableHead>
                      <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                        Rec line 1
                      </TableHead>
                      <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                        Rec line 2
                      </TableHead>
                      <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                        Grade
                      </TableHead>
                      <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                        Standard
                      </TableHead>
                      <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                        Fees title
                      </TableHead>
                      <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                        Sort order
                      </TableHead>
                      <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                        Status
                      </TableHead>
                      <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                        Account number
                      </TableHead>
                      <TableHead className="h-9 px-3 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell
                          colSpan={10}
                          className="px-3 py-10 text-center text-[12px] text-slate-500"
                        >
                          <span className="inline-flex items-center gap-2">
                            <Loader2 className="size-4 animate-spin" />
                            Loading receipt books...
                          </span>
                        </TableCell>
                      </TableRow>
                    ) : filteredRecords.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={10}
                          className="px-3 py-10 text-center text-[12px] text-slate-500"
                        >
                          {searchTerm
                            ? 'No receipt books match your search.'
                            : 'No receipt books found.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRecords.map((record) => (
                        <TableRow
                          key={record.receiptId}
                          className="border-slate-200/90 hover:bg-slate-50/40"
                        >
                          <TableCell className="px-3 py-3 text-[12px] font-semibold text-slate-900">
                            {record.receiptId}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-[12px] text-slate-700">
                            {record.receiptLine1 || '-'}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-[12px] text-slate-700">
                            {record.receiptLine2 || '-'}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-[12px] text-slate-700">
                            {record.grade || '-'}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-[12px] text-slate-700">
                            {record.standard || '-'}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-[12px] text-slate-700">
                            {record.feesHead || '-'}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-[12px] text-slate-700">
                            {record.sortOrder || '-'}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-[12px] text-slate-700">
                            {record.status || '-'}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-[12px] text-slate-700">
                            {record.accountNumber || '-'}
                          </TableCell>
                          <TableCell className="px-3 py-3">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 rounded-lg"
                                onClick={() => void loadEditPayload(record)}
                                disabled={formLoading}
                                title="Edit receipt book"
                              >
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 rounded-lg border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                onClick={() => void handleDelete(record)}
                                disabled={deletingId === record.receiptId}
                                title="Delete receipt book"
                              >
                                {deletingId === record.receiptId ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <Trash2 className="size-4" />
                                )}
                              </Button>
                            </div>
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

      {isDrawerVisible ? (
        <div className="fixed inset-0 z-[70] overflow-hidden">
          <button
            type="button"
            aria-label="Close receipt book drawer"
            className={cn(
              'absolute inset-0 bg-slate-950/45 transition-opacity duration-300 ease-out',
              isDrawerOpen ? 'opacity-100' : 'opacity-0'
            )}
            onClick={closeDrawer}
          />
          <div className="absolute inset-y-0 right-0 flex max-w-full">
            <div
              className={cn(
                'flex h-full w-full flex-col border-l border-slate-200 bg-white shadow-[0_18px_48px_rgba(15,23,42,0.18)] transition-transform duration-300 ease-out sm:w-[34rem] lg:w-[40rem]',
                isDrawerOpen ? 'translate-x-0' : 'translate-x-full'
              )}
            >
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <h2 className="text-[15px] font-semibold text-slate-950">
                  {editingRecord ? 'Edit receipt book' : 'Add receipt book'}
                </h2>
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <span className="text-lg leading-none">&times;</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4">
                {formLoading ? (
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-[12px] text-slate-600">
                    <Loader2 className="size-4 animate-spin" />
                    Loading receipt book form...
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-medium text-slate-700">
                        Receipt line 1
                      </Label>
                      <Input
                        value={form.receipt_line_1}
                        onChange={(event) =>
                          updateField('receipt_line_1', event.target.value)
                        }
                        className={cn(
                          'h-9 rounded-md border-slate-300 bg-white px-3 text-[12px]',
                          formErrors.receipt_line_1 && 'border-red-300'
                        )}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-medium text-slate-700">
                        Receipt line 2
                      </Label>
                      <Input
                        value={form.receipt_line_2}
                        onChange={(event) =>
                          updateField('receipt_line_2', event.target.value)
                        }
                        className={cn(
                          'h-9 rounded-md border-slate-300 bg-white px-3 text-[12px]',
                          formErrors.receipt_line_2 && 'border-red-300'
                        )}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-medium text-slate-700">
                        Receipt line 3
                      </Label>
                      <Input
                        value={form.receipt_line_3}
                        onChange={(event) =>
                          updateField('receipt_line_3', event.target.value)
                        }
                        className="h-9 rounded-md border-slate-300 bg-white px-3 text-[12px]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-medium text-slate-700">
                        Receipt line 4
                      </Label>
                      <Input
                        value={form.receipt_line_4}
                        onChange={(event) =>
                          updateField('receipt_line_4', event.target.value)
                        }
                        className="h-9 rounded-md border-slate-300 bg-white px-3 text-[12px]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-medium text-slate-700">
                        Receipt prefix
                      </Label>
                      <Input
                        value={form.receipt_prefix}
                        onChange={(event) =>
                          updateField('receipt_prefix', event.target.value)
                        }
                        readOnly={Boolean(editingRecord)}
                        className="h-9 rounded-md border-slate-300 bg-white px-3 text-[12px]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-medium text-slate-700">
                        Receipt postfix
                      </Label>
                      <Input
                        value={form.receipt_postfix}
                        onChange={(event) =>
                          updateField('receipt_postfix', event.target.value)
                        }
                        readOnly={Boolean(editingRecord)}
                        className="h-9 rounded-md border-slate-300 bg-white px-3 text-[12px]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-medium text-slate-700">
                        Account number
                      </Label>
                      <Input
                        value={form.account_number}
                        onChange={(event) =>
                          updateField('account_number', event.target.value)
                        }
                        className="h-9 rounded-md border-slate-300 bg-white px-3 text-[12px]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-medium text-slate-700">
                        Sort order
                      </Label>
                      <Input
                        value={form.sort_order}
                        onChange={(event) =>
                          updateField('sort_order', event.target.value)
                        }
                        readOnly={Boolean(editingRecord)}
                        className={cn(
                          'h-9 rounded-md border-slate-300 bg-white px-3 text-[12px]',
                          formErrors.sort_order && 'border-red-300'
                        )}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-medium text-slate-700">
                        Last receipt number
                      </Label>
                      <Input
                        value={form.last_receipt_number}
                        onChange={(event) =>
                          updateField('last_receipt_number', event.target.value)
                        }
                        readOnly={Boolean(editingRecord)}
                        className="h-9 rounded-md border-slate-300 bg-white px-3 text-[12px]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-medium text-slate-700">
                        Pan
                      </Label>
                      <Input
                        value={form.pan}
                        onChange={(event) => updateField('pan', event.target.value)}
                        className="h-9 rounded-md border-slate-300 bg-white px-3 text-[12px]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-medium text-slate-700">
                        Bank branch
                      </Label>
                      <Input
                        value={form.branch}
                        onChange={(event) =>
                          updateField('branch', event.target.value)
                        }
                        className="h-9 rounded-md border-slate-300 bg-white px-3 text-[12px]"
                      />
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-[11px] font-medium text-slate-700">
                        Grade
                      </Label>
                      <select
                        multiple
                        value={form.grade}
                        onChange={(event) =>
                          void handleGradeChange(readSelectedValues(event))
                        }
                        className={cn(
                          multiSelectClassName,
                          formErrors.grade && 'border-red-300'
                        )}
                      >
                        {sections.map((section) => (
                          <option key={section.id} value={section.id}>
                            {section.label}
                          </option>
                        ))}
                      </select>
                      {formErrors.grade ? (
                        <p className="text-[11px] text-red-600">
                          {formErrors.grade}
                        </p>
                      ) : null}
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-[11px] font-medium text-slate-700">
                        Standard
                      </Label>
                      <select
                        multiple
                        value={form.standard}
                        onChange={(event) =>
                          updateField('standard', readSelectedValues(event))
                        }
                        className={cn(
                          multiSelectClassName,
                          formErrors.standard && 'border-red-300'
                        )}
                      >
                        {standards.map((standard) => (
                          <option key={standard.id} value={standard.id}>
                            {standard.label}
                          </option>
                        ))}
                      </select>
                      {formErrors.standard ? (
                        <p className="text-[11px] text-red-600">
                          {formErrors.standard}
                        </p>
                      ) : null}
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-[11px] font-medium text-slate-700">
                        Fee Head
                      </Label>
                      <p className="text-[11px] text-slate-500">
                        Select one or more fee heads for this receipt book.
                      </p>
                      <select
                        multiple
                        value={form.fees_head_id}
                        onChange={(event) =>
                          updateField('fees_head_id', readSelectedValues(event))
                        }
                        className={cn(
                          multiSelectClassName,
                          formErrors.fees_head_id && 'border-red-300'
                        )}
                      >
                        {feeHeadOptions.length === 0 ? (
                          <option value="" disabled>
                            No fee heads available
                          </option>
                        ) : null}
                        {feeHeadOptions.map((option) => (
                          <option
                            key={option.id}
                            value={option.id}
                            disabled={unavailableFeeHeadIds.has(option.id)}
                          >
                            {unavailableFeeHeadIds.has(option.id)
                              ? `${option.label} (already mapped)`
                              : option.label}
                          </option>
                        ))}
                      </select>
                      {formErrors.fees_head_id ? (
                        <p className="text-[11px] text-red-600">
                          {formErrors.fees_head_id}
                        </p>
                      ) : null}
                      {feeHeadOptions.length === 0 ? (
                        <p className="text-[11px] text-amber-700">
                          Fee Head options could not be loaded from the backend.
                        </p>
                      ) : null}
                      {selectedFeeHeads.length > 0 ? (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-[12px] text-slate-600">
                          <span className="font-medium text-slate-700">
                            Selected:
                          </span>{' '}
                          {selectedFeeHeads.map((item) => item.label).join(', ')}
                        </div>
                      ) : null}
                      {form.standard.length > 0 && unavailableFeeHeadIds.size > 0 ? (
                        <p className="text-[11px] text-slate-500">
                          Fee heads marked as already mapped cannot be selected for the chosen standards.
                        </p>
                      ) : null}
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-medium text-slate-700">
                        Bank logo
                      </Label>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(event) =>
                          updateField(
                            'fees_bank_logo',
                            event.target.files?.[0] ?? null
                          )
                        }
                        className="h-10 rounded-md border-slate-300 bg-white text-[12px]"
                      />
                      {form.existing_bank_logo ? (
                        <p className="text-[11px] text-slate-500">
                          Current: {form.existing_bank_logo}
                        </p>
                      ) : null}
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-medium text-slate-700">
                        Receipt logo
                      </Label>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(event) =>
                          updateField(
                            'fees_receipt_logo',
                            event.target.files?.[0] ?? null
                          )
                        }
                        className="h-10 rounded-md border-slate-300 bg-white text-[12px]"
                      />
                      {form.existing_receipt_logo ? (
                        <p className="text-[11px] text-slate-500">
                          Current: {form.existing_receipt_logo}
                        </p>
                      ) : null}
                    </div>

                    {selectedStandards.length > 0 ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-[12px] text-slate-600 sm:col-span-2">
                        Selected standards: {selectedStandards.map((item) => item.label).join(', ')}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 border-t border-slate-200 px-5 py-4">
                <Button
                  className="h-9 rounded-xl bg-[#5b4fe9] px-4 text-[12px] font-semibold text-white hover:bg-[#4d42da]"
                  onClick={() => void handleSubmit()}
                  disabled={submitting || formLoading}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Saving...
                    </>
                  ) : editingRecord ? (
                    'Update receipt book'
                  ) : (
                    'Save receipt book'
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="h-9 rounded-xl border-slate-300 px-4 text-[12px] font-medium text-slate-700"
                  onClick={closeDrawer}
                  disabled={submitting || formLoading}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
