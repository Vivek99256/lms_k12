'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Download,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';

import { API_BASE_URL } from '@/app/components/utils/api_url';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { exportRowsAsPdf } from '@/lib/table-export';

type FeeConfigApiRow = {
  id?: number | string | null;
  late_fees_amount?: number | string | null;
  send_sms?: number | string | null;
  send_email?: number | string | null;
  fees_receipt_template?: string | null;
  fees_bank_challan_template?: string | null;
  fees_receipt_note?: string | null;
  institute_name?: string | null;
  pan_no?: string | null;
  account_to_be_credited?: string | null;
  cms_client_code?: string | null;
  auto_head_counting?: number | string | null;
  nach_account_type?: string | null;
  nach_registration_charge?: number | string | null;
  nach_transaction_charge?: number | string | null;
  nach_failed_charge?: number | string | null;
  bank_logo?: string | null;
  show_month?: number | string | null;
  created_on?: string | null;
};

type FeeConfigResponse = {
  status?: number | string;
  status_code?: number | string;
  message?: string;
  data?: FeeConfigApiRow[] | number | string | null;
};

type FeeConfigRecord = {
  id: string;
  lateFeesAmount: string;
  sendSms: string;
  sendEmail: string;
  feesReceiptTemplate: string;
  feesBankChallanTemplate: string;
  feesReceiptNote: string;
  instituteName: string;
  panNo: string;
  accountToBeCredited: string;
  cmsClientCode: string;
  autoHeadCounting: string;
  nachAccountType: string;
  nachRegistrationCharge: string;
  nachTransactionCharge: string;
  nachFailedCharge: string;
  bankLogo: string;
  showMonth: boolean;
  createdOn: string;
  searchText: string;
};

type FeeConfigForm = {
  late_fees_amount: string;
  send_sms: string;
  send_email: string;
  fees_receipt_template: string;
  fees_bank_challan_template: string;
  fees_receipt_note: string;
  institute_name: string;
  pan_no: string;
  account_to_be_credited: string;
  cms_client_code: string;
  auto_head_counting: string;
  nach_account_type: string;
  nach_registration_charge: string;
  nach_transaction_charge: string;
  nach_failed_charge: string;
  show_month: boolean;
  fees_bank_logo: File | null;
};

type FormErrors = Partial<Record<keyof FeeConfigForm, string>>;

type SessionContext = {
  baseUrl: string;
  token: string;
  subInstituteId: string;
  syear: string;
};

type SortKey =
  | 'serial'
  | 'instituteName'
  | 'panNo'
  | 'accountToBeCredited'
  | 'lateFeesAmount'
  | 'cmsClientCode';

type SortConfig = {
  key: SortKey;
  direction: 'asc' | 'desc';
};

const receiptTemplateOptions = [
  { value: 'A5', label: 'A5' },
  { value: 'A5DB', label: 'A5 Double' },
  { value: 'A4', label: 'A4' },
  { value: 'A4DB', label: 'A4 Double' },
];

const bankChallanTemplateOptions = [
  { value: 'template_1', label: 'Template 1' },
  { value: 'template_2', label: 'Template 2' },
  { value: 'template_3', label: 'Template 3' },
  { value: 'template_4', label: 'Template 4' },
];

const yesNoOptions = [
  { value: '1', label: 'Yes' },
  { value: '0', label: 'No' },
];

const nachAccountTypeOptions = [
  { value: 'saving', label: 'Saving Account' },
  { value: 'current', label: 'Current Account' },
  { value: 'cash', label: 'Cash / Credit' },
];

const pageSizeOptions = ['5', '10', '25', '50'];

const initialForm: FeeConfigForm = {
  late_fees_amount: '',
  send_sms: '',
  send_email: '',
  fees_receipt_template: '',
  fees_bank_challan_template: '',
  fees_receipt_note: '',
  institute_name: '',
  pan_no: '',
  account_to_be_credited: '',
  cms_client_code: '',
  auto_head_counting: '',
  nach_account_type: '',
  nach_registration_charge: '',
  nach_transaction_charge: '',
  nach_failed_charge: '',
  show_month: false,
  fees_bank_logo: null,
};

function readString(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function normalizeAcademicYear(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const yearMatch = trimmed.match(/\d{4}/);
  return yearMatch ? yearMatch[0] : trimmed;
}

function normalizeApiStatus(payload: FeeConfigResponse | null): string {
  if (!payload) return '';
  return String(payload.status ?? payload.status_code ?? '');
}

function buildSessionContext(): SessionContext {
  if (typeof window === 'undefined') {
    return {
      baseUrl: API_BASE_URL,
      token: '',
      subInstituteId: '',
      syear: '',
    };
  }

  try {
    const userData = JSON.parse(
      localStorage.getItem('userData') || '{}'
    ) as Record<string, unknown>;
    const menuContext = JSON.parse(
      localStorage.getItem('menuContext') || '{}'
    ) as Record<string, unknown>;
    const academicYears = Array.isArray(userData.academicYears)
      ? userData.academicYears
      : [];

    let syear = readString(localStorage.getItem('selectedAcademicYear'));
    if (!syear && academicYears.length > 0) {
      syear = readString(
        (academicYears[0] as Record<string, unknown>).syear ??
          (academicYears[0] as Record<string, unknown>).academic_year
      );
    }
    if (!syear) {
      syear = readString(
        userData.academic_year_id ??
          userData.academicYearId ??
          menuContext.academic_year_id
      );
    }

    return {
      baseUrl:
        readString(userData.host_name).replace(/\/$/, '') ||
        API_BASE_URL.replace(/\/$/, ''),
      token: readString(
        userData.user_token ??
          userData.token ??
          menuContext.user_token ??
          menuContext.token
      ),
      subInstituteId: readString(
        userData.sub_institute_id ?? menuContext.sub_institute_id
      ),
      syear: normalizeAcademicYear(syear),
    };
  } catch {
    return {
      baseUrl: API_BASE_URL,
      token: '',
      subInstituteId: '',
      syear: '',
    };
  }
}

function mapConfigRow(row: FeeConfigApiRow): FeeConfigRecord {
  const lateFeesAmount = readString(row.late_fees_amount);
  const instituteName = readString(row.institute_name);
  const panNo = readString(row.pan_no);
  const accountToBeCredited = readString(row.account_to_be_credited);
  const cmsClientCode = readString(row.cms_client_code);

  return {
    id: readString(row.id),
    lateFeesAmount,
    sendSms: readString(row.send_sms),
    sendEmail: readString(row.send_email),
    feesReceiptTemplate: readString(row.fees_receipt_template),
    feesBankChallanTemplate: readString(row.fees_bank_challan_template),
    feesReceiptNote: readString(row.fees_receipt_note),
    instituteName,
    panNo,
    accountToBeCredited,
    cmsClientCode,
    autoHeadCounting: readString(row.auto_head_counting),
    nachAccountType: readString(row.nach_account_type),
    nachRegistrationCharge: readString(row.nach_registration_charge),
    nachTransactionCharge: readString(row.nach_transaction_charge),
    nachFailedCharge: readString(row.nach_failed_charge),
    bankLogo: readString(row.bank_logo),
    showMonth: readString(row.show_month) === '1',
    createdOn: readString(row.created_on),
    searchText: [
      instituteName,
      panNo,
      accountToBeCredited,
      cmsClientCode,
      lateFeesAmount,
      readString(row.fees_receipt_template),
      readString(row.nach_account_type),
    ]
      .join(' ')
      .toLowerCase(),
  };
}

function mapRecordToForm(record: FeeConfigRecord): FeeConfigForm {
  return {
    late_fees_amount: record.lateFeesAmount,
    send_sms: record.sendSms,
    send_email: record.sendEmail,
    fees_receipt_template: record.feesReceiptTemplate,
    fees_bank_challan_template: record.feesBankChallanTemplate,
    fees_receipt_note: record.feesReceiptNote,
    institute_name: record.instituteName,
    pan_no: record.panNo,
    account_to_be_credited: record.accountToBeCredited,
    cms_client_code: record.cmsClientCode,
    auto_head_counting: record.autoHeadCounting,
    nach_account_type: record.nachAccountType,
    nach_registration_charge: record.nachRegistrationCharge,
    nach_transaction_charge: record.nachTransactionCharge,
    nach_failed_charge: record.nachFailedCharge,
    show_month: record.showMonth,
    fees_bank_logo: null,
  };
}

function isNumericValue(value: string): boolean {
  return /^\d+(\.\d+)?$/.test(value.trim());
}

function validateForm(form: FeeConfigForm): FormErrors {
  const errors: FormErrors = {};

  if (!form.late_fees_amount.trim()) {
    errors.late_fees_amount = 'Late fees amount is required';
  } else if (!isNumericValue(form.late_fees_amount)) {
    errors.late_fees_amount = 'Enter a valid late fees amount';
  }

  if (!form.send_sms.trim()) {
    errors.send_sms = 'Fees paid SMS preference is required';
  }

  if (!form.send_email.trim()) {
    errors.send_email = 'Fees paid email preference is required';
  }

  if (!form.fees_receipt_template.trim()) {
    errors.fees_receipt_template = 'Fees receipt template is required';
  }

  if (!form.fees_bank_challan_template.trim()) {
    errors.fees_bank_challan_template =
      'Fees bank challan template is required';
  }

  if (!form.fees_receipt_note.trim()) {
    errors.fees_receipt_note = 'Fees receipt note is required';
  }

  if (!form.institute_name.trim()) {
    errors.institute_name = 'Institute name is required';
  }

  if (!form.pan_no.trim()) {
    errors.pan_no = 'PAN number is required';
  }

  if (!form.account_to_be_credited.trim()) {
    errors.account_to_be_credited = 'Account to be credited is required';
  }

  if (!form.cms_client_code.trim()) {
    errors.cms_client_code = 'CMS client code is required';
  }

  if (!form.nach_account_type.trim()) {
    errors.nach_account_type = 'NACH account type is required';
  }

  if (!form.nach_registration_charge.trim()) {
    errors.nach_registration_charge = 'NACH registration charge is required';
  } else if (!isNumericValue(form.nach_registration_charge)) {
    errors.nach_registration_charge =
      'Enter a valid NACH registration charge';
  }

  if (!form.nach_transaction_charge.trim()) {
    errors.nach_transaction_charge = 'NACH transaction charge is required';
  } else if (!isNumericValue(form.nach_transaction_charge)) {
    errors.nach_transaction_charge =
      'Enter a valid NACH transaction charge';
  }

  if (!form.nach_failed_charge.trim()) {
    errors.nach_failed_charge = 'NACH failed charge is required';
  } else if (!isNumericValue(form.nach_failed_charge)) {
    errors.nach_failed_charge = 'Enter a valid NACH failed charge';
  }

  if (
    form.fees_bank_logo &&
    form.fees_bank_logo.type &&
    !form.fees_bank_logo.type.startsWith('image/')
  ) {
    errors.fees_bank_logo = 'Only image files are allowed for bank logo';
  }

  return errors;
}

function buildFormData(form: FeeConfigForm): FormData {
  const payload = new FormData();

  payload.append('late_fees_amount', form.late_fees_amount.trim());
  payload.append('send_sms', form.send_sms);
  payload.append('send_email', form.send_email);
  payload.append('fees_receipt_template', form.fees_receipt_template);
  payload.append(
    'fees_bank_challan_template',
    form.fees_bank_challan_template
  );
  payload.append('fees_receipt_note', form.fees_receipt_note.trim());
  payload.append('institute_name', form.institute_name.trim());
  payload.append('pan_no', form.pan_no.trim());
  payload.append(
    'account_to_be_credited',
    form.account_to_be_credited.trim()
  );
  payload.append('cms_client_code', form.cms_client_code.trim());
  payload.append('auto_head_counting', form.auto_head_counting);
  payload.append('show_month', form.show_month ? '1' : '0');
  payload.append('nach_account_type', form.nach_account_type);
  payload.append(
    'nach_registration_charge',
    form.nach_registration_charge.trim()
  );
  payload.append(
    'nach_transaction_charge',
    form.nach_transaction_charge.trim()
  );
  payload.append('nach_failed_charge', form.nach_failed_charge.trim());
  payload.append('type', 'JSON');

  if (form.fees_bank_logo) {
    payload.append('fees_bank_logo', form.fees_bank_logo);
  }

  return payload;
}

function getPageNumbers(currentPage: number, totalPages: number): number[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 4, totalPages];
  }

  if (currentPage >= totalPages - 2) {
    return [1, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, currentPage - 1, currentPage, currentPage + 1, totalPages];
}

function DrawerField({
  label,
  required = false,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-medium text-slate-700">
        {label}
        {required ? <span className="text-rose-500">*</span> : null}
      </Label>
      {children}
      {error ? <p className="text-[11px] text-rose-600">{error}</p> : null}
    </div>
  );
}

export default function FeesConfigMasterPage() {
  const [configs, setConfigs] = useState<FeeConfigRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState('10');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: 'serial',
    direction: 'asc',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [pageSuccess, setPageSuccess] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FeeConfigRecord | null>(
    null
  );
  const [form, setForm] = useState<FeeConfigForm>(initialForm);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null);
  const [logoPreviewName, setLogoPreviewName] = useState('');
  const [recordToDelete, setRecordToDelete] = useState<FeeConfigRecord | null>(
    null
  );

  const [session] = useState<SessionContext>(() => buildSessionContext());

  const loadConfigs = useCallback(async () => {
    if (!session.baseUrl) {
      setConfigs([]);
      setPageError('API base URL is not configured.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setPageError(null);

    try {
      const url = new URL(`${session.baseUrl}/fees/fees_config_master`);
      url.searchParams.set('type', 'JSON');
      if (session.subInstituteId) {
        url.searchParams.set('sub_institute_id', session.subInstituteId);
      }
      if (session.syear) {
        url.searchParams.set('syear', session.syear);
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...(session.token
            ? { Authorization: `Bearer ${session.token}` }
            : {}),
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load fees configurations (${response.status})`);
      }

      const payload = (await response.json()) as FeeConfigResponse;
      if (normalizeApiStatus(payload) && normalizeApiStatus(payload) !== '1') {
        throw new Error(payload.message || 'Failed to load fees configurations.');
      }

      const rows = Array.isArray(payload.data) ? payload.data : [];
      setConfigs(rows.map(mapConfigRow));
    } catch (error) {
      setConfigs([]);
      setPageError(
        error instanceof Error
          ? error.message
          : 'Failed to load fees configurations.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [session.baseUrl, session.subInstituteId, session.syear, session.token]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadConfigs();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadConfigs]);

  useEffect(() => {
    document.body.style.overflow = isDrawerOpen ? 'hidden' : '';

    return () => {
      document.body.style.overflow = '';
    };
  }, [isDrawerOpen]);

  useEffect(() => {
    if (!isDrawerOpen && !recordToDelete) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (recordToDelete) {
          setRecordToDelete(null);
          return;
        }

        if (isDrawerOpen) {
          setIsDrawerOpen(false);
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isDrawerOpen, recordToDelete]);

  const filteredConfigs = (() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return configs;

    return configs.filter((record) => record.searchText.includes(query));
  })();

  const filteredAndSortedConfigs = (() => {
    const records = [...filteredConfigs];

    records.sort((first, second) => {
      const getValue = (record: FeeConfigRecord) => {
        switch (sortConfig.key) {
          case 'serial':
            return Number(record.id || 0);
          case 'instituteName':
            return record.instituteName.toLowerCase();
          case 'panNo':
            return record.panNo.toLowerCase();
          case 'accountToBeCredited':
            return record.accountToBeCredited.toLowerCase();
          case 'lateFeesAmount':
            return Number(record.lateFeesAmount || 0);
          case 'cmsClientCode':
            return record.cmsClientCode.toLowerCase();
          default:
            return '';
        }
      };

      const left = getValue(first);
      const right = getValue(second);

      if (typeof left === 'number' && typeof right === 'number') {
        return sortConfig.direction === 'asc' ? left - right : right - left;
      }

      return sortConfig.direction === 'asc'
        ? String(left).localeCompare(String(right))
        : String(right).localeCompare(String(left));
    });

    return records;
  })();

  const totalPages = Math.max(
    1,
    Math.ceil(filteredAndSortedConfigs.length / Number(pageSize))
  );
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedConfigs = (() => {
    const start = (safeCurrentPage - 1) * Number(pageSize);
    return filteredAndSortedConfigs.slice(start, start + Number(pageSize));
  })();

  const openCreateDrawer = () => {
    setEditingRecord(null);
    setForm(initialForm);
    setFormErrors({});
    setFormErrorMessage(null);
    setLogoPreviewName('');
    setPageSuccess(null);
    setPageError(null);
    setIsDrawerOpen(true);
  };

  const openEditDrawer = (record: FeeConfigRecord) => {
    setEditingRecord(record);
    setForm(mapRecordToForm(record));
    setFormErrors({});
    setFormErrorMessage(null);
    setLogoPreviewName(record.bankLogo);
    setPageSuccess(null);
    setPageError(null);
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    if (isSaving) return;
    setIsDrawerOpen(false);
  };

  const updateField = <K extends keyof FeeConfigForm>(
    field: K,
    value: FeeConfigForm[K]
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
    setFormErrors((current) => ({
      ...current,
      [field]: undefined,
    }));
    setFormErrorMessage(null);
  };

  const handleSort = (key: SortKey) => {
    setSortConfig((current) => ({
      key,
      direction:
        current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const submitForm = async () => {
    const validationErrors = validateForm(form);
    if (Object.keys(validationErrors).length > 0) {
      setFormErrors(validationErrors);
      return;
    }

    if (!session.baseUrl) {
      setFormErrorMessage('API base URL is not configured.');
      return;
    }

    setIsSaving(true);
    setFormErrorMessage(null);

    try {
      const payload = buildFormData(form);
      const url = editingRecord
        ? new URL(
            `${session.baseUrl}/fees/fees_config_master/${encodeURIComponent(
              editingRecord.id
            )}`
          )
        : new URL(`${session.baseUrl}/fees/fees_config_master`);

      url.searchParams.set('type', 'JSON');
      if (session.subInstituteId) {
        url.searchParams.set('sub_institute_id', session.subInstituteId);
      }
      if (session.syear) {
        url.searchParams.set('syear', session.syear);
      }

      if (editingRecord) {
        payload.append('_method', 'PUT');
      }

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          ...(session.token
            ? { Authorization: `Bearer ${session.token}` }
            : {}),
        },
        body: payload,
      });

      const responseText = await response.text();
      let parsedPayload: FeeConfigResponse | null = null;

      if (responseText) {
        try {
          parsedPayload = JSON.parse(responseText) as FeeConfigResponse;
        } catch {
          parsedPayload = null;
        }
      }

      if (!response.ok) {
        throw new Error(
          parsedPayload?.message ||
            `Failed to ${
              editingRecord ? 'update' : 'save'
            } fees configuration (${response.status})`
        );
      }

      if (
        normalizeApiStatus(parsedPayload) &&
        normalizeApiStatus(parsedPayload) !== '1'
      ) {
        throw new Error(
          parsedPayload?.message ||
            `Failed to ${editingRecord ? 'update' : 'save'} fees configuration.`
        );
      }

      setPageSuccess(
        parsedPayload?.message ||
          `Fees configuration ${
            editingRecord ? 'updated' : 'added'
          } successfully.`
      );
      setIsDrawerOpen(false);
      await loadConfigs();
    } catch (error) {
      setFormErrorMessage(
        error instanceof Error
          ? error.message
          : `Failed to ${
              editingRecord ? 'update' : 'save'
            } fees configuration.`
      );
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!recordToDelete || !session.baseUrl) return;

    setPendingDeleteId(recordToDelete.id);
    setPageError(null);
    setPageSuccess(null);

    try {
      const url = new URL(
        `${session.baseUrl}/fees/fees_config_master/${encodeURIComponent(
          recordToDelete.id
        )}`
      );
      url.searchParams.set('type', 'JSON');
      if (session.subInstituteId) {
        url.searchParams.set('sub_institute_id', session.subInstituteId);
      }
      if (session.syear) {
        url.searchParams.set('syear', session.syear);
      }

      const payload = new FormData();
      payload.append('_method', 'DELETE');
      payload.append('type', 'JSON');

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          ...(session.token
            ? { Authorization: `Bearer ${session.token}` }
            : {}),
        },
        body: payload,
      });

      const responseText = await response.text();
      let parsedPayload: FeeConfigResponse | null = null;

      if (responseText) {
        try {
          parsedPayload = JSON.parse(responseText) as FeeConfigResponse;
        } catch {
          parsedPayload = null;
        }
      }

      if (!response.ok) {
        throw new Error(
          parsedPayload?.message ||
            `Failed to delete fees configuration (${response.status})`
        );
      }

      if (
        normalizeApiStatus(parsedPayload) &&
        normalizeApiStatus(parsedPayload) !== '1'
      ) {
        throw new Error(
          parsedPayload?.message || 'Failed to delete fees configuration.'
        );
      }

      setPageSuccess(
        parsedPayload?.message || 'Fees configuration deleted successfully.'
      );
      setRecordToDelete(null);
      await loadConfigs();
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : 'Failed to delete fees configuration.'
      );
    } finally {
      setPendingDeleteId(null);
    }
  };

  const visiblePageNumbers = getPageNumbers(safeCurrentPage, totalPages);

  const downloadPdf = () => {
    exportRowsAsPdf({
      filename: 'fees-config-master.pdf',
      title: 'Fees Config Master',
      subtitle: `Active records: ${configs.length}`,
      columns: [
        { key: 'institute', label: 'Institute' },
        { key: 'pan', label: 'PAN no.' },
        { key: 'account', label: 'Account to be credited' },
        { key: 'cms', label: 'CMS client code' },
        { key: 'challan', label: 'Bank challan template' },
      ],
      rows: configs.map((config) => ({
        institute: config.instituteName || '-',
        pan: config.panNo || '-',
        account: config.accountToBeCredited || '-',
        cms: config.cmsClientCode || '-',
        challan: config.feesBankChallanTemplate || '-',
      })),
    });
  };
  const currentLogoUrl =
    logoPreviewName && session.baseUrl
      ? `${session.baseUrl.replace(/\/$/, '')}/storage/fees/${logoPreviewName}`
      : '';

  return (
    <>
      <div className="min-h-screen p-4 sm:p-5 lg:p-6">
        <div className="mx-auto space-y-4">
          <Card className="rounded-2xl border border-slate-200/90 bg-white py-0 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <CardHeader className="gap-3 border-b border-slate-200/80 px-4 py-4 sm:px-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-[16px] font-semibold text-slate-950">
                    Fees config master
                  </CardTitle>
                  <CardDescription className="text-[12px] leading-5 text-slate-600">
                    Configure receipt templates, NACH settings, fine defaults,
                    bank details and receipt notes for the active academic year.
                  </CardDescription>
                </div>

                <CardAction className="col-auto row-auto self-auto justify-self-auto">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className="h-9 rounded-xl border-slate-300 px-4 text-[12px] font-medium text-slate-700"
                      onClick={downloadPdf}
                      disabled={configs.length === 0}
                    ><Download className="size-3.5" />Download PDF</Button>
                    <Button
                      className="h-9 rounded-xl bg-[#5b4fe9] px-4 text-[12px] font-semibold text-white hover:bg-[#4d42da]"
                      onClick={openCreateDrawer}
                    >
                      <Plus className="size-3.5" />
                      Add new fees config
                    </Button>
                  </div>
                </CardAction>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 px-4 py-4 sm:px-5">
              {pageSuccess ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12px] text-emerald-700">
                  {pageSuccess}
                </div>
              ) : null}

              {pageError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] text-rose-700">
                  {pageError}
                </div>
              ) : null}

              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative w-full lg:max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={searchQuery}
                    onChange={(event) => {
                      setSearchQuery(event.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Search by institute, PAN, account or CMS code"
                    className="h-10 rounded-xl border-slate-200 bg-white pl-9 text-[13px] shadow-none"
                  />
                </div>

                <div className="flex items-center gap-2 self-end">
                  <Label className="text-[12px] text-slate-500">Show</Label>
                  <Select
                    value={pageSize}
                    onValueChange={(value) => {
                      setPageSize(value ?? '10');
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger
                      className="h-9 min-w-[88px] rounded-xl border-slate-200 bg-white text-[12px] shadow-none"
                      variant="default"
                      size="sm"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[90]">
                      {pageSizeOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Label className="text-[12px] text-slate-500">rows</Label>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <Table>
                  <TableHeader className="bg-slate-100/90">
                    <TableRow className="border-slate-200 hover:bg-transparent">
                      <TableHead className="h-9 w-[72px] px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1"
                          onClick={() => handleSort('serial')}
                        >
                          Sr. No.
                        </button>
                      </TableHead>
                      <TableHead className="h-9 min-w-[180px] px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1"
                          onClick={() => handleSort('instituteName')}
                        >
                          Institute Name
                        </button>
                      </TableHead>
                      <TableHead className="h-9 min-w-[120px] px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1"
                          onClick={() => handleSort('panNo')}
                        >
                          PAN No
                        </button>
                      </TableHead>
                      <TableHead className="h-9 min-w-[160px] px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1"
                          onClick={() => handleSort('accountToBeCredited')}
                        >
                          Account No
                        </button>
                      </TableHead>
                      <TableHead className="h-9 min-w-[120px] px-3 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1"
                          onClick={() => handleSort('lateFeesAmount')}
                        >
                          Late Fees
                        </button>
                      </TableHead>
                      <TableHead className="h-9 min-w-[140px] px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1"
                          onClick={() => handleSort('cmsClientCode')}
                        >
                          CMS Client Code
                        </button>
                      </TableHead>
                      <TableHead className="h-9 min-w-[140px] px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                        Receipt Template
                      </TableHead>
                      <TableHead className="h-9 min-w-[126px] px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                        Month Beside Fees
                      </TableHead>
                      <TableHead className="h-9 min-w-[132px] px-3 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                        Action
                      </TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {isLoading ? (
                      <TableRow className="border-slate-200/90 hover:bg-transparent">
                        <TableCell
                          colSpan={9}
                          className="px-3 py-12 text-center text-[13px] text-slate-500"
                        >
                          <span className="inline-flex items-center gap-2">
                            <Loader2 className="size-4 animate-spin" />
                            Loading fees configurations...
                          </span>
                        </TableCell>
                      </TableRow>
                    ) : paginatedConfigs.length === 0 ? (
                      <TableRow className="border-slate-200/90 hover:bg-transparent">
                        <TableCell
                          colSpan={9}
                          className="px-3 py-12 text-center"
                        >
                          <div className="space-y-1">
                            <p className="text-[13px] font-medium text-slate-700">
                              No fees configurations found.
                            </p>
                            <p className="text-[12px] text-slate-500">
                              {searchQuery.trim()
                                ? 'Try a different search term.'
                                : 'Add a new fees config to start using this module.'}
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedConfigs.map((record, index) => (
                        <TableRow
                          key={record.id || `${record.instituteName}-${index}`}
                          className="border-slate-200/90 hover:bg-slate-50/40"
                        >
                          <TableCell className="px-3 py-3 text-[12px] font-semibold text-slate-900">
                            {(safeCurrentPage - 1) * Number(pageSize) + index + 1}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-[12px] font-semibold text-slate-900">
                            {record.instituteName || '-'}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-[12px] text-slate-700">
                            {record.panNo || '-'}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-[12px] text-slate-700">
                            {record.accountToBeCredited || '-'}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-right text-[12px] text-slate-700">
                            {record.lateFeesAmount || '-'}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-[12px] text-slate-700">
                            {record.cmsClientCode || '-'}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-[12px] text-slate-700">
                            {record.feesReceiptTemplate || '-'}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-[12px] text-slate-700">
                            {record.showMonth ? 'Yes' : 'No'}
                          </TableCell>
                          <TableCell className="px-3 py-3">
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                className="rounded-lg text-sky-600 hover:bg-sky-50 hover:text-sky-700"
                                onClick={() => openEditDrawer(record)}
                                title="Edit fees config"
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                className="rounded-lg text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                onClick={() => setRecordToDelete(record)}
                                disabled={pendingDeleteId === record.id}
                                title="Delete fees config"
                              >
                                {pendingDeleteId === record.id ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="size-3.5" />
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

              <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[12px] text-slate-500">
                  Showing{' '}
                  {filteredAndSortedConfigs.length === 0
                    ? 0
                    : (safeCurrentPage - 1) * Number(pageSize) + 1}
                  -
                  {Math.min(
                    safeCurrentPage * Number(pageSize),
                    filteredAndSortedConfigs.length
                  )}{' '}
                  of {filteredAndSortedConfigs.length} records
                </p>

                <Pagination className="mx-0 w-auto justify-start sm:justify-end">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(event) => {
                          event.preventDefault();
                          setCurrentPage((page) => Math.max(1, page - 1));
                        }}
                        className={cn(
                          safeCurrentPage === 1 &&
                            'pointer-events-none opacity-50'
                        )}
                      />
                    </PaginationItem>

                    {visiblePageNumbers.map((pageNumber, index) => {
                      const previous = visiblePageNumbers[index - 1];
                      const showGap = previous && pageNumber - previous > 1;

                      return (
                        <div key={pageNumber} className="flex items-center">
                          {showGap ? (
                            <PaginationItem>
                              <span className="px-2 text-slate-400">...</span>
                            </PaginationItem>
                          ) : null}
                          <PaginationItem>
                            <PaginationLink
                              href="#"
                              isActive={safeCurrentPage === pageNumber}
                              onClick={(event) => {
                                event.preventDefault();
                                setCurrentPage(pageNumber);
                              }}
                              className="h-8 min-w-8 rounded-lg px-3 text-[12px]"
                            >
                              {pageNumber}
                            </PaginationLink>
                          </PaginationItem>
                        </div>
                      );
                    })}

                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(event) => {
                          event.preventDefault();
                          setCurrentPage((page) =>
                            Math.min(totalPages, page + 1)
                          );
                        }}
                        className={cn(
                          safeCurrentPage === totalPages &&
                            'pointer-events-none opacity-50'
                        )}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {isDrawerOpen ? (
        <div className="fixed inset-0 z-[70] overflow-hidden">
          <button
            type="button"
            aria-label="Close fees config drawer"
            className="absolute inset-0 bg-slate-950/45 transition-opacity duration-300 ease-out opacity-100"
            onClick={closeDrawer}
          />

          <div className="absolute inset-y-0 right-0 flex max-w-full">
            <div
              className="flex h-full w-full translate-x-0 flex-col border-l border-slate-200 bg-white shadow-[0_18px_48px_rgba(15,23,42,0.18)] transition-transform duration-300 ease-out sm:w-[32rem] lg:w-[36rem]"
            >
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 className="text-[15px] font-semibold text-slate-950">
                    {editingRecord ? 'Edit fees configuration' : 'Add fees configuration'}
                  </h2>
                  <p className="mt-1 text-[12px] text-slate-500">
                    Match the Laravel fee setup fields and receipt configuration.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeDrawer}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                >
                  <span className="text-lg leading-none">&times;</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4">
                <div className="space-y-4">
                  {formErrorMessage ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] text-rose-700">
                      {formErrorMessage}
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <DrawerField
                      label="Late Fees Amount"
                      required
                      error={formErrors.late_fees_amount}
                    >
                      <Input
                        type="number"
                        min="0"
                        value={form.late_fees_amount}
                        onChange={(event) =>
                          updateField('late_fees_amount', event.target.value)
                        }
                        className="h-9 rounded-md border-slate-300 bg-white px-3 text-[12px] shadow-none"
                      />
                    </DrawerField>

                    <DrawerField
                      label="Fees Paid Send SMS"
                      required
                      error={formErrors.send_sms}
                    >
                      <Select
                        value={form.send_sms}
                        onValueChange={(value) =>
                          updateField('send_sms', value ?? '')
                        }
                      >
                        <SelectTrigger
                          className="h-9 rounded-md border-slate-300 bg-white px-3 text-[12px] shadow-none"
                          variant="default"
                          size="sm"
                        >
                          <SelectValue placeholder="Select send SMS" />
                        </SelectTrigger>
                        <SelectContent className="z-[90]">
                          {yesNoOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </DrawerField>

                    <DrawerField
                      label="Fees Paid Send Email"
                      required
                      error={formErrors.send_email}
                    >
                      <Select
                        value={form.send_email}
                        onValueChange={(value) =>
                          updateField('send_email', value ?? '')
                        }
                      >
                        <SelectTrigger
                          className="h-9 rounded-md border-slate-300 bg-white px-3 text-[12px] shadow-none"
                          variant="default"
                          size="sm"
                        >
                          <SelectValue placeholder="Select send email" />
                        </SelectTrigger>
                        <SelectContent className="z-[90]">
                          {yesNoOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </DrawerField>

                    <DrawerField
                      label="Fees Receipt Template"
                      required
                      error={formErrors.fees_receipt_template}
                    >
                      <Select
                        value={form.fees_receipt_template}
                        onValueChange={(value) =>
                          updateField('fees_receipt_template', value ?? '')
                        }
                      >
                        <SelectTrigger
                          className="h-9 rounded-md border-slate-300 bg-white px-3 text-[12px] shadow-none"
                          variant="default"
                          size="sm"
                        >
                          <SelectValue placeholder="Select receipt template" />
                        </SelectTrigger>
                        <SelectContent className="z-[90]">
                          {receiptTemplateOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </DrawerField>

                    <DrawerField
                      label="Fees Bank Challan Template"
                      required
                      error={formErrors.fees_bank_challan_template}
                    >
                      <Select
                        value={form.fees_bank_challan_template}
                        onValueChange={(value) =>
                          updateField(
                            'fees_bank_challan_template',
                            value ?? ''
                          )
                        }
                      >
                        <SelectTrigger
                          className="h-9 rounded-md border-slate-300 bg-white px-3 text-[12px] shadow-none"
                          variant="default"
                          size="sm"
                        >
                          <SelectValue placeholder="Select bank challan template" />
                        </SelectTrigger>
                        <SelectContent className="z-[90]">
                          {bankChallanTemplateOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </DrawerField>

                    <div className="sm:col-span-2">
                      <DrawerField
                        label="Fees Receipt Note"
                        required
                        error={formErrors.fees_receipt_note}
                      >
                        <Textarea
                          value={form.fees_receipt_note}
                          onChange={(event) =>
                            updateField('fees_receipt_note', event.target.value)
                          }
                          className="min-h-24 rounded-md border-slate-300 bg-white px-3 py-2 text-[12px] shadow-none"
                          placeholder="Please write fees notes"
                        />
                      </DrawerField>
                    </div>

                    <DrawerField
                      label="Institute Name"
                      required
                      error={formErrors.institute_name}
                    >
                      <Input
                        value={form.institute_name}
                        onChange={(event) =>
                          updateField('institute_name', event.target.value)
                        }
                        className="h-9 rounded-md border-slate-300 bg-white px-3 text-[12px] shadow-none"
                      />
                    </DrawerField>

                    <DrawerField label="PAN No." required error={formErrors.pan_no}>
                      <Input
                        value={form.pan_no}
                        onChange={(event) =>
                          updateField('pan_no', event.target.value)
                        }
                        className="h-9 rounded-md border-slate-300 bg-white px-3 text-[12px] shadow-none"
                      />
                    </DrawerField>

                    <DrawerField
                      label="Account To Be Credited"
                      required
                      error={formErrors.account_to_be_credited}
                    >
                      <Input
                        value={form.account_to_be_credited}
                        onChange={(event) =>
                          updateField(
                            'account_to_be_credited',
                            event.target.value
                          )
                        }
                        className="h-9 rounded-md border-slate-300 bg-white px-3 text-[12px] shadow-none"
                      />
                    </DrawerField>

                    <DrawerField
                      label="CMS Client Code"
                      required
                      error={formErrors.cms_client_code}
                    >
                      <Input
                        value={form.cms_client_code}
                        onChange={(event) =>
                          updateField('cms_client_code', event.target.value)
                        }
                        className="h-9 rounded-md border-slate-300 bg-white px-3 text-[12px] shadow-none"
                      />
                    </DrawerField>

                    <DrawerField
                      label="Auto Head Counting"
                      error={formErrors.auto_head_counting}
                    >
                      <Select
                        value={form.auto_head_counting}
                        onValueChange={(value) =>
                          updateField('auto_head_counting', value ?? '')
                        }
                      >
                        <SelectTrigger
                          className="h-9 rounded-md border-slate-300 bg-white px-3 text-[12px] shadow-none"
                          variant="default"
                          size="sm"
                        >
                          <SelectValue placeholder="Select head count" />
                        </SelectTrigger>
                        <SelectContent className="z-[90]">
                          {yesNoOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </DrawerField>

                    <DrawerField label="NACH Account Type" required error={formErrors.nach_account_type}>
                      <Select
                        value={form.nach_account_type}
                        onValueChange={(value) =>
                          updateField('nach_account_type', value ?? '')
                        }
                      >
                        <SelectTrigger
                          className="h-9 rounded-md border-slate-300 bg-white px-3 text-[12px] shadow-none"
                          variant="default"
                          size="sm"
                        >
                          <SelectValue placeholder="Select account type" />
                        </SelectTrigger>
                        <SelectContent className="z-[90]">
                          {nachAccountTypeOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </DrawerField>

                    <DrawerField
                      label="NACH Registration Charge"
                      required
                      error={formErrors.nach_registration_charge}
                    >
                      <Input
                        type="number"
                        min="0"
                        value={form.nach_registration_charge}
                        onChange={(event) =>
                          updateField(
                            'nach_registration_charge',
                            event.target.value
                          )
                        }
                        className="h-9 rounded-md border-slate-300 bg-white px-3 text-[12px] shadow-none"
                      />
                    </DrawerField>

                    <DrawerField
                      label="NACH Transaction Charge"
                      required
                      error={formErrors.nach_transaction_charge}
                    >
                      <Input
                        type="number"
                        min="0"
                        value={form.nach_transaction_charge}
                        onChange={(event) =>
                          updateField(
                            'nach_transaction_charge',
                            event.target.value
                          )
                        }
                        className="h-9 rounded-md border-slate-300 bg-white px-3 text-[12px] shadow-none"
                      />
                    </DrawerField>

                    <DrawerField
                      label="NACH Failed Charge"
                      required
                      error={formErrors.nach_failed_charge}
                    >
                      <Input
                        type="number"
                        min="0"
                        value={form.nach_failed_charge}
                        onChange={(event) =>
                          updateField('nach_failed_charge', event.target.value)
                        }
                        className="h-9 rounded-md border-slate-300 bg-white px-3 text-[12px] shadow-none"
                      />
                    </DrawerField>

                    <div className="sm:col-span-2">
                      <DrawerField
                        label="Bank Logo"
                        error={formErrors.fees_bank_logo}
                      >
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(event) => {
                            const file = event.target.files?.[0] ?? null;
                            updateField('fees_bank_logo', file);
                            setLogoPreviewName(file?.name || editingRecord?.bankLogo || '');
                          }}
                          className="h-10 rounded-md border-slate-300 bg-white px-3 text-[12px] shadow-none file:mr-2 file:rounded-md file:bg-slate-100 file:px-2 file:py-1"
                        />
                        {logoPreviewName ? (
                          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
                            <p className="font-medium text-slate-700">
                              Current logo: {logoPreviewName}
                            </p>
                            {currentLogoUrl ? (
                              <a
                                href={currentLogoUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-1 inline-flex text-[12px] text-sky-600 hover:text-sky-700"
                              >
                                View uploaded logo
                              </a>
                            ) : null}
                          </div>
                        ) : null}
                      </DrawerField>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-[12px] text-slate-700">
                        <input
                          type="checkbox"
                          checked={form.show_month}
                          onChange={(event) =>
                            updateField('show_month', event.target.checked)
                          }
                          className="h-4 w-4 rounded border-slate-300 text-[#5b4fe9] focus:ring-[#5b4fe9]"
                        />
                        <span>Month beside fees heading</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 border-t border-slate-200 px-5 py-4">
                <Button
                  className="h-9 rounded-xl bg-[#5b4fe9] px-4 text-[12px] font-semibold text-white hover:bg-[#4d42da]"
                  onClick={submitForm}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : editingRecord ? (
                    <Pencil className="size-3.5" />
                  ) : (
                    <Plus className="size-3.5" />
                  )}
                  {editingRecord ? 'Update fees config' : 'Save fees config'}
                </Button>
                <Button
                  variant="outline"
                  className="h-9 rounded-xl border-slate-300 px-4 text-[12px] font-medium text-slate-700"
                  onClick={closeDrawer}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {recordToDelete ? (
        <div className="fixed inset-0 z-[72] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/45"
            aria-label="Close delete confirmation"
            onClick={() => setRecordToDelete(null)}
          />

          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_18px_48px_rgba(15,23,42,0.18)]">
            <div className="flex items-start gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                <AlertCircle className="size-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-[16px] font-semibold text-slate-950">
                  Delete fees configuration
                </h3>
                <p className="text-[12px] leading-5 text-slate-600">
                  Are you sure you want to delete the fees configuration for{' '}
                  <span className="font-semibold text-slate-800">
                    {recordToDelete.instituteName || 'this institute'}
                  </span>
                  ? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                className="h-9 rounded-xl border-slate-300 px-4 text-[12px] font-medium text-slate-700"
                onClick={() => setRecordToDelete(null)}
                disabled={pendingDeleteId === recordToDelete.id}
              >
                Cancel
              </Button>
              <Button
                className="h-9 rounded-xl bg-rose-600 px-4 text-[12px] font-semibold text-white hover:bg-rose-700"
                onClick={confirmDelete}
                disabled={pendingDeleteId === recordToDelete.id}
              >
                {pendingDeleteId === recordToDelete.id ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
                Delete
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
