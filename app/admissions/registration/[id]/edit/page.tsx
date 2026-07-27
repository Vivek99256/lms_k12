'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  Baby,
  CheckCircle2,
  ClipboardList,
  FileText,
  GraduationCap,
  Loader2,
  Mail,
  MapPin,
  Phone,
  User,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  appendCommonParams,
  buildSessionContext,
  createAuthHeaders,
  normalizeApiStatus,
  readString,
} from '@/lib/erp-client';
import type {
  LegacyCustomField,
  LegacyRegistrationApiRow,
  LegacyRegistrationDetailResponse,
} from '@/app/admissions/admission_registration/types';

type OptionItem = {
  display_text?: string;
  display_value?: string;
};

type DataFieldsMap = Record<string, OptionItem[]>;

type RegistrationFormState = Record<string, string>;

type DetailState = {
  record: LegacyRegistrationApiRow;
  customFields: LegacyCustomField[];
  dataFields: DataFieldsMap;
  division: Array<{ id?: string | number; name?: string | null; standard_id?: string | number }>;
  category: Array<{ id?: string | number; title?: string | null; name?: string | null }>;
  bloodgroupData: Array<{ id?: string | number; bloodgroup?: string | null; name?: string | null }>;
  religionData: Array<{ id?: string | number; name?: string | null; religion?: string | null }>;
  casteData: Array<{ id?: string | number; name?: string | null; caste?: string | null }>;
  newEnrollmentNo: string;
  displaySaveStudent: string;
};

const documentFieldKeys = [
  'enquiry_no',
  'register_number',
  'aadhar_number',
  'mother_name',
  'student_quota',
  'admission_division',
  'enrollment_no',
  'blood_group',
  'religion',
  'cast',
];

const trackedFields = [
  'enquiry_id',
  'enquiry_no',
  'first_name',
  'middle_name',
  'last_name',
  'gender',
  'mobile',
  'email',
  'date_of_birth',
  'age',
  'address',
  'previous_school_name',
  'previous_standard',
  'admission_standard',
  'source_of_enquiry',
  'remarks',
  'fees_remark',
  'followup_date',
  'register_number',
  'mother_name',
  'mother_mobile_number',
  'aadhar_number',
  'status',
  'place_of_birth',
  'student_quota',
  'admission_division',
  'enrollment_no',
  'amount',
  'blood_group',
  'payment_mode',
  'bank_name',
  'bank_branch',
  'cheque_no',
  'cheque_date',
  'date_of_payment',
  'admission_date',
  'admission_status',
  'religion',
  'cast',
];

function formatDateLabel(value: string): string {
  if (!value) return '-';

  try {
    return format(parseISO(value), 'dd MMM yyyy');
  } catch {
    return value;
  }
}

function buildInitialFormState(record: LegacyRegistrationApiRow, customFields: LegacyCustomField[]): RegistrationFormState {
  const formState: RegistrationFormState = {};

  trackedFields.forEach((field) => {
    formState[field] = readString(record[field]);
  });

  formState.enquiry_id = readString(record.enquiry_id || record.id);
  formState.status = readString(record.status).toUpperCase() || 'CLOSE';

  customFields.forEach((field) => {
    const fieldName = readString(field.field_name);
    if (!fieldName) return;
    formState[fieldName] = readString(record[fieldName]);
  });

  return formState;
}

function buildOptions(dataFields: DataFieldsMap, key: string, fallback: Array<{ label: string; value: string }> = []) {
  const apiOptions = Array.isArray(dataFields[key]) ? dataFields[key] : [];
  const normalized = apiOptions
    .map((option) => ({
      label: readString(option.display_text || option.display_value),
      value: readString(option.display_value || option.display_text),
    }))
    .filter((option) => option.label && option.value);

  return normalized.length > 0 ? normalized : fallback;
}

async function fetchRegistrationDetail(id: string, signal?: AbortSignal): Promise<DetailState> {
  const session = buildSessionContext();
  if (!session.baseUrl || !session.subInstituteId || !session.syear) {
    throw new Error('Session is missing API base URL, sub institute, or academic year.');
  }

  const baseUrl = session.baseUrl.replace(/\/$/, '');
  const url = new URL(`${baseUrl}/api/admission_registration/${encodeURIComponent(id)}/edit`);
  appendCommonParams(url.searchParams, session);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: createAuthHeaders(session),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to load registration details (${response.status})`);
  }

  const payload = (await response.json()) as LegacyRegistrationDetailResponse;
  if (normalizeApiStatus(payload) !== '1' || !payload.editData) {
    throw new Error(payload.message || 'Failed to load registration details.');
  }

  return {
    record: payload.editData,
    customFields: Array.isArray(payload.custom_fields) ? payload.custom_fields : [],
    dataFields: payload.data_fields ?? {},
    division: Array.isArray(payload.division) ? payload.division : [],
    category: Array.isArray(payload.category) ? payload.category : [],
    bloodgroupData: Array.isArray(payload.bloodgroup_data) ? payload.bloodgroup_data : [],
    religionData: Array.isArray(payload.religion_data) ? payload.religion_data : [],
    casteData: Array.isArray(payload.caste_data) ? payload.caste_data : [],
    newEnrollmentNo: readString(payload.new_enrollment_no),
    displaySaveStudent: readString(payload.display_save_student),
  };
}

async function saveRegistration(id: string, formState: RegistrationFormState, customFields: LegacyCustomField[]) {
  const session = buildSessionContext();
  if (!session.baseUrl || !session.subInstituteId || !session.syear || !session.userId) {
    throw new Error('Session is missing API base URL, sub institute, academic year, or user ID.');
  }

  const payload = new URLSearchParams();
  payload.set('type', 'API');
  payload.set('sub_institute_id', session.subInstituteId);
  payload.set('syear', session.syear);
  payload.set('user_id', session.userId);

  trackedFields.forEach((field) => {
    const value = readString(formState[field]);
    if (value !== '') {
      payload.set(field, value);
    }
  });

  customFields.forEach((field) => {
    const fieldName = readString(field.field_name);
    if (!fieldName) return;
    const value = readString(formState[fieldName]);
    if (value !== '') {
      payload.set(fieldName, value);
    }
  });

  const baseUrl = session.baseUrl.replace(/\/$/, '');
  const response = await fetch(`${baseUrl}/api/admission_registration/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: createAuthHeaders(session, 'application/x-www-form-urlencoded;charset=UTF-8'),
    body: payload.toString(),
  });

  if (!response.ok) {
    throw new Error(`Failed to update registration (${response.status})`);
  }

  const responsePayload = (await response.json()) as { status_code?: string | number; message?: string };
  if (normalizeApiStatus(responsePayload) !== '1') {
    throw new Error(responsePayload.message || 'Failed to update registration.');
  }
}

function FormField({
  icon: Icon,
  label,
  htmlFor,
  children,
}: {
  icon?: LucideIcon;
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
        {Icon ? <Icon className="h-3.5 w-3.5 text-[#0D6EFD]" /> : null}
        {label}
      </Label>
      {children}
    </div>
  );
}

function SelectField({
  id,
  label,
  icon,
  value,
  options,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  icon?: LucideIcon;
  value: string;
  options: Array<{ label: string; value: string }>;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const normalizedOptions =
    value && !options.some((option) => option.value === value)
      ? [{ label: value, value }, ...options]
      : options;

  return (
    <FormField icon={icon} label={label} htmlFor={id}>
      <Select value={value} onValueChange={(next) => onChange(next ?? '')}>
        <SelectTrigger id={id} className="h-10 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {normalizedOptions.map((option) => (
            <SelectItem key={`${id}-${option.value}`} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  );
}

export default function EditRegistrationPage() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const recordId = Array.isArray(params.id) ? params.id[0] : params.id;
  const isConfirmationFlow = pathname.includes('/confirmation/');
  const returnPath = isConfirmationFlow ? '/admissions/confirmation' : '/admissions/admission_registration';

  const [detail, setDetail] = useState<DetailState | null>(null);
  const [formState, setFormState] = useState<RegistrationFormState>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!recordId) return;

    const controller = new AbortController();

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const nextDetail = await fetchRegistrationDetail(recordId, controller.signal);
        setDetail(nextDetail);
        setFormState(buildInitialFormState(nextDetail.record, nextDetail.customFields));
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load registration details.');
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    void load();

    return () => controller.abort();
  }, [recordId]);

  const statusOptions = useMemo(
    () =>
      buildOptions(detail?.dataFields ?? {}, 'status', [
        { label: 'OPEN', value: 'OPEN' },
        { label: 'CLOSE', value: 'CLOSE' },
      ]),
    [detail]
  );

  const quotaOptions = useMemo(() => {
    const fallback = (detail?.category ?? [])
      .map((option) => ({
        label: readString(option.title || option.name),
        value: readString(option.id),
      }))
      .filter((option) => option.label && option.value);

    return buildOptions(detail?.dataFields ?? {}, 'student_quota', fallback);
  }, [detail]);
  const divisionOptions = useMemo(() => {
    const apiOptions = Array.isArray(detail?.dataFields?.admission_division)
      ? buildOptions(detail?.dataFields ?? {}, 'admission_division')
      : [];

    if (apiOptions.length > 0) return apiOptions;

    const fallbackDivision = (detail?.division ?? []).map((option) => ({
      label: readString(option.name),
      value: readString(option.id),
    }));

    return fallbackDivision.filter((option) => option.label && option.value);
  }, [detail]);
  const bloodGroupOptions = useMemo(() => {
    const fallback = (detail?.bloodgroupData ?? [])
      .map((option) => ({
        label: readString(option.bloodgroup || option.name),
        value: readString(option.id),
      }))
      .filter((option) => option.label && option.value);

    return buildOptions(detail?.dataFields ?? {}, 'blood_group', fallback);
  }, [detail]);
  const paymentModeOptions = useMemo(
    () =>
      buildOptions(detail?.dataFields ?? {}, 'payment_mode', [
        { label: 'Cash', value: 'cash' },
        { label: 'Cheque', value: 'cheque' },
        { label: 'DD', value: 'dd' },
      ]),
    [detail]
  );
  const admissionStatusOptions = useMemo(
    () =>
      buildOptions(detail?.dataFields ?? {}, 'admission_status', [
        { label: 'Open', value: 'OPEN' },
        { label: 'Close', value: 'CLOSE' },
      ]),
    [detail]
  );
  const religionOptions = useMemo(() => {
    const fallback = (detail?.religionData ?? [])
      .map((option) => ({
        label: readString(option.name || option.religion),
        value: readString(option.id),
      }))
      .filter((option) => option.label && option.value);

    return buildOptions(detail?.dataFields ?? {}, 'religion', fallback);
  }, [detail]);
  const casteOptions = useMemo(() => {
    const fallback = (detail?.casteData ?? [])
      .map((option) => ({
        label: readString(option.name || option.caste),
        value: readString(option.id),
      }))
      .filter((option) => option.label && option.value);

    return buildOptions(detail?.dataFields ?? {}, 'cast', fallback);
  }, [detail]);

  const documentChecklist = useMemo(() => {
    const customChecks = (detail?.customFields ?? []).map((field) => {
      const fieldName = readString(field.field_name);
      const label = readString(field.field_label || fieldName || 'Custom field');
      const value = readString(formState[fieldName]);
      return {
        id: fieldName || label,
        label,
        value,
        required: String(field.required ?? '') === '1',
      };
    });

    const baseChecks = documentFieldKeys.map((fieldName) => ({
      id: fieldName,
      label: fieldName.replace(/_/g, ' '),
      value: readString(formState[fieldName]),
      required: true,
    }));

    return [...baseChecks, ...customChecks].map((item) => ({
      ...item,
      label: item.label.replace(/\b\w/g, (char) => char.toUpperCase()),
      available: item.value.trim() !== '',
    }));
  }, [detail, formState]);

  const completionText = useMemo(() => {
    const total = documentChecklist.length;
    const completed = documentChecklist.filter((item) => item.available).length;
    return total > 0 ? `${completed} of ${total} document fields verified` : 'No document fields mapped';
  }, [documentChecklist]);

  const studentName = [formState.first_name, formState.middle_name, formState.last_name].filter(Boolean).join(' ');

  const handleChange = (field: string, value: string) => {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!recordId || !detail) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await saveRegistration(recordId, formState, detail.customFields);
      router.push(formState.status === 'OPEN' ? '/admissions/confirmation' : '/admissions/admission_registration');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to update registration.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    if (!recordId) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/20 flex items-center justify-center px-4">
          <div className="rounded-xl border border-rose-200 bg-white p-6 text-center shadow-sm">
            <div className="inline-flex items-center gap-2 text-rose-600">
              <AlertCircle className="h-4 w-4" />
              Registration id is missing.
            </div>
            <div className="mt-4">
              <Button variant="outline" onClick={() => router.push(returnPath)}>
                Back
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/20 flex items-center justify-center">
        <div className="inline-flex items-center gap-2 text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading registration details...
        </div>
      </div>
    );
  }

  if (error && !detail) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/20 flex items-center justify-center px-4">
        <div className="rounded-xl border border-rose-200 bg-white p-6 text-center shadow-sm">
          <div className="inline-flex items-center gap-2 text-rose-600">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
          <div className="mt-4">
            <Button variant="outline" onClick={() => router.push(returnPath)}>
              Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/20">
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6 lg:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push(returnPath)}
              className="h-9 w-9 rounded-lg text-slate-500 hover:bg-slate-100"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <div className="h-8 w-1 rounded-full bg-gradient-to-b from-[#0D6EFD] to-[#7ED957]" />
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  {isConfirmationFlow ? 'Admission Confirmation' : 'Registration Step'}
                </h1>
              </div>
              <p className="ml-3 mt-1 text-sm text-slate-500">
                Legacy admission registration fields and verification flow for{' '}
                <span className="font-medium text-slate-700">{studentName || readString(formState.enquiry_no) || 'selected record'}</span>
              </p>
            </div>
          </div>
          <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-medium text-[#0D6EFD]">
            {readString(detail?.record.registration_no || detail?.record.id)}
          </span>
        </div>

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <div className="inline-flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <form onSubmit={handleSubmit} className="space-y-6">
            <Card className="overflow-hidden border-gray-200/60 shadow-lg shadow-gray-200/50">
              <div className="h-1.5 bg-gradient-to-r from-[#0D6EFD] via-blue-500 to-[#7ED957]" />
              <CardHeader className="bg-gradient-to-br from-gray-50/80 to-white pb-6 pt-6">
                <CardTitle className="flex items-center gap-2 text-lg font-bold text-gray-800">
                  <GraduationCap className="h-5 w-5 text-[#0D6EFD]" />
                  Student Details Verification
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-5 p-5 md:grid-cols-2 xl:grid-cols-3 md:p-6">
                <FormField icon={ClipboardList} label="Enquiry Number" htmlFor="enquiry_no">
                  <Input id="enquiry_no" value={formState.enquiry_no || ''} onChange={(event) => handleChange('enquiry_no', event.target.value)} className="h-10 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white" />
                </FormField>
                <FormField icon={User} label="First Name" htmlFor="first_name">
                  <Input id="first_name" value={formState.first_name || ''} onChange={(event) => handleChange('first_name', event.target.value)} className="h-10 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white" />
                </FormField>
                <FormField icon={User} label="Middle Name" htmlFor="middle_name">
                  <Input id="middle_name" value={formState.middle_name || ''} onChange={(event) => handleChange('middle_name', event.target.value)} className="h-10 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white" />
                </FormField>
                <FormField icon={User} label="Last Name" htmlFor="last_name">
                  <Input id="last_name" value={formState.last_name || ''} onChange={(event) => handleChange('last_name', event.target.value)} className="h-10 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white" />
                </FormField>
                <FormField icon={Phone} label="Mobile" htmlFor="mobile">
                  <Input id="mobile" value={formState.mobile || ''} onChange={(event) => handleChange('mobile', event.target.value)} className="h-10 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white" />
                </FormField>
                <FormField icon={Mail} label="Email" htmlFor="email">
                  <Input id="email" type="email" value={formState.email || ''} onChange={(event) => handleChange('email', event.target.value)} className="h-10 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white" />
                </FormField>
                <FormField icon={Baby} label="Date Of Birth" htmlFor="date_of_birth">
                  <Input id="date_of_birth" value={formState.date_of_birth || ''} onChange={(event) => handleChange('date_of_birth', event.target.value)} className="h-10 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white" />
                </FormField>
                <FormField icon={Baby} label="Age" htmlFor="age">
                  <Input id="age" value={formState.age || ''} onChange={(event) => handleChange('age', event.target.value)} className="h-10 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white" />
                </FormField>
                <FormField icon={ClipboardList} label="Gender" htmlFor="gender">
                  <Input id="gender" value={formState.gender || ''} onChange={(event) => handleChange('gender', event.target.value)} className="h-10 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white" />
                </FormField>
                <FormField icon={GraduationCap} label="Admission Standard" htmlFor="admission_standard">
                  <Input id="admission_standard" value={formState.admission_standard || ''} onChange={(event) => handleChange('admission_standard', event.target.value)} className="h-10 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white" />
                </FormField>
                <FormField icon={GraduationCap} label="Previous School" htmlFor="previous_school_name">
                  <Input id="previous_school_name" value={formState.previous_school_name || ''} onChange={(event) => handleChange('previous_school_name', event.target.value)} className="h-10 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white" />
                </FormField>
                <FormField icon={GraduationCap} label="Previous Standard" htmlFor="previous_standard">
                  <Input id="previous_standard" value={formState.previous_standard || ''} onChange={(event) => handleChange('previous_standard', event.target.value)} className="h-10 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white" />
                </FormField>
                <div className="md:col-span-2 xl:col-span-3">
                  <FormField icon={MapPin} label="Address" htmlFor="address">
                    <Textarea id="address" value={formState.address || ''} onChange={(event) => handleChange('address', event.target.value)} className="min-h-[100px] rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white resize-none" />
                  </FormField>
                </div>
                <div className="md:col-span-2 xl:col-span-3">
                  <FormField icon={ClipboardList} label="Remarks" htmlFor="remarks">
                    <Textarea id="remarks" value={formState.remarks || ''} onChange={(event) => handleChange('remarks', event.target.value)} className="min-h-[100px] rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white resize-none" />
                  </FormField>
                </div>
              </CardContent>
            </Card>

            <Card className="border-gray-200/60 shadow-lg shadow-gray-200/50">
              <CardHeader className="pb-4 pt-5">
                <CardTitle className="flex items-center gap-2 text-lg font-bold text-gray-800">
                  <CheckCircle2 className="h-5 w-5 text-[#0D6EFD]" />
                  Registration & Verification
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-5 p-5 md:grid-cols-2 xl:grid-cols-3 md:p-6 pt-0">
                <FormField icon={ClipboardList} label="Register Number" htmlFor="register_number">
                  <Input id="register_number" value={formState.register_number || ''} onChange={(event) => handleChange('register_number', event.target.value)} className="h-10 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white" />
                </FormField>
                <FormField icon={User} label="Mother Name" htmlFor="mother_name">
                  <Input id="mother_name" value={formState.mother_name || ''} onChange={(event) => handleChange('mother_name', event.target.value)} className="h-10 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white" />
                </FormField>
                <FormField icon={Phone} label="Mother Mobile" htmlFor="mother_mobile_number">
                  <Input id="mother_mobile_number" value={formState.mother_mobile_number || ''} onChange={(event) => handleChange('mother_mobile_number', event.target.value)} className="h-10 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white" />
                </FormField>
                <FormField icon={ClipboardList} label="Aadhar Number" htmlFor="aadhar_number">
                  <Input id="aadhar_number" value={formState.aadhar_number || ''} onChange={(event) => handleChange('aadhar_number', event.target.value)} className="h-10 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white" />
                </FormField>
                <FormField icon={MapPin} label="Place Of Birth" htmlFor="place_of_birth">
                  <Input id="place_of_birth" value={formState.place_of_birth || ''} onChange={(event) => handleChange('place_of_birth', event.target.value)} className="h-10 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white" />
                </FormField>
                <SelectField id="status" label="Status" icon={ClipboardList} value={formState.status || 'CLOSE'} options={statusOptions} placeholder="Select status" onChange={(value) => handleChange('status', value.toUpperCase())} />
                <SelectField id="student_quota" label="Student Quota" icon={ClipboardList} value={formState.student_quota || ''} options={quotaOptions} placeholder="Select quota" onChange={(value) => handleChange('student_quota', value)} />
                <SelectField id="admission_division" label="Admission Division" icon={ClipboardList} value={formState.admission_division || ''} options={divisionOptions} placeholder="Select division" onChange={(value) => handleChange('admission_division', value)} />
                <FormField icon={ClipboardList} label="Enrollment No." htmlFor="enrollment_no">
                  <Input id="enrollment_no" value={formState.enrollment_no || ''} onChange={(event) => handleChange('enrollment_no', event.target.value)} className="h-10 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white" />
                </FormField>
                <FormField icon={ClipboardList} label="Amount" htmlFor="amount">
                  <Input id="amount" value={formState.amount || ''} onChange={(event) => handleChange('amount', event.target.value)} className="h-10 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white" />
                </FormField>
                <SelectField id="blood_group" label="Blood Group" icon={ClipboardList} value={formState.blood_group || ''} options={bloodGroupOptions} placeholder="Select blood group" onChange={(value) => handleChange('blood_group', value)} />
                <SelectField id="religion" label="Religion" icon={ClipboardList} value={formState.religion || ''} options={religionOptions} placeholder="Select religion" onChange={(value) => handleChange('religion', value)} />
                <SelectField id="cast" label="Cast" icon={ClipboardList} value={formState.cast || ''} options={casteOptions} placeholder="Select cast" onChange={(value) => handleChange('cast', value)} />
                <FormField icon={ClipboardList} label="Admission Date" htmlFor="admission_date">
                  <Input id="admission_date" value={formState.admission_date || ''} onChange={(event) => handleChange('admission_date', event.target.value)} className="h-10 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white" />
                </FormField>
                <SelectField id="admission_status" label="Admission Status" icon={ClipboardList} value={formState.admission_status || ''} options={admissionStatusOptions} placeholder="Select admission status" onChange={(value) => handleChange('admission_status', value)} />
                <FormField icon={ClipboardList} label="Follow Up Date" htmlFor="followup_date">
                  <Input id="followup_date" value={formState.followup_date || ''} onChange={(event) => handleChange('followup_date', event.target.value)} className="h-10 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white" />
                </FormField>
              </CardContent>
            </Card>

            <Card className="border-gray-200/60 shadow-lg shadow-gray-200/50">
              <CardHeader className="pb-4 pt-5">
                <CardTitle className="flex items-center gap-2 text-lg font-bold text-gray-800">
                  <FileText className="h-5 w-5 text-[#0D6EFD]" />
                  Document & Payment Process
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-5 p-5 md:grid-cols-2 xl:grid-cols-3 md:p-6 pt-0">
                <SelectField id="payment_mode" label="Payment Mode" icon={ClipboardList} value={formState.payment_mode || ''} options={paymentModeOptions} placeholder="Select payment mode" onChange={(value) => handleChange('payment_mode', value)} />
                <FormField icon={ClipboardList} label="Bank Name" htmlFor="bank_name">
                  <Input id="bank_name" value={formState.bank_name || ''} onChange={(event) => handleChange('bank_name', event.target.value)} className="h-10 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white" />
                </FormField>
                <FormField icon={ClipboardList} label="Bank Branch" htmlFor="bank_branch">
                  <Input id="bank_branch" value={formState.bank_branch || ''} onChange={(event) => handleChange('bank_branch', event.target.value)} className="h-10 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white" />
                </FormField>
                <FormField icon={ClipboardList} label="Cheque No." htmlFor="cheque_no">
                  <Input id="cheque_no" value={formState.cheque_no || ''} onChange={(event) => handleChange('cheque_no', event.target.value)} className="h-10 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white" />
                </FormField>
                <FormField icon={ClipboardList} label="Cheque Date" htmlFor="cheque_date">
                  <Input id="cheque_date" value={formState.cheque_date || ''} onChange={(event) => handleChange('cheque_date', event.target.value)} className="h-10 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white" />
                </FormField>
                <FormField icon={ClipboardList} label="Date Of Payment" htmlFor="date_of_payment">
                  <Input id="date_of_payment" value={formState.date_of_payment || ''} onChange={(event) => handleChange('date_of_payment', event.target.value)} className="h-10 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white" />
                </FormField>
                <FormField icon={ClipboardList} label="Fees Remark" htmlFor="fees_remark">
                  <Textarea id="fees_remark" value={formState.fees_remark || ''} onChange={(event) => handleChange('fees_remark', event.target.value)} className="min-h-[100px] rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white resize-none md:col-span-2 xl:col-span-3" />
                </FormField>
                {detail?.customFields.map((field) => {
                  const fieldName = readString(field.field_name);
                  if (!fieldName) return null;

                  return (
                    <FormField
                      key={fieldName}
                      icon={ClipboardList}
                      label={readString(field.field_label || fieldName)}
                      htmlFor={fieldName}
                    >
                      <Input
                        id={fieldName}
                        value={formState[fieldName] || ''}
                        onChange={(event) => handleChange(fieldName, event.target.value)}
                        className="h-10 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white"
                      />
                    </FormField>
                  );
                })}
              </CardContent>
            </Card>

            <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => router.push(returnPath)} className="h-10 rounded-lg border-gray-200 px-6 text-gray-600 hover:bg-gray-50">
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="h-10 rounded-lg bg-gradient-to-r from-[#0D6EFD] to-blue-600 px-8 font-semibold text-white shadow-md shadow-blue-500/20 hover:from-[#0D6EFD]/90 hover:to-blue-600/90">
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Update
              </Button>
            </div>
          </form>

          <div className="space-y-6">
            <Card className="border-slate-200/80 bg-white shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold text-slate-800">Workflow Snapshot</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-600">
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Enquiry Date</div>
                  <div className="mt-1 font-medium text-slate-800">{formatDateLabel(readString(detail?.record.created_on))}</div>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Current Stage</div>
                  <div className="mt-1 font-medium text-slate-800">{formState.status === 'OPEN' ? 'Admission Confirmation' : 'Registration Pipeline'}</div>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Verification Summary</div>
                  <div className="mt-1 font-medium text-slate-800">{completionText}</div>
                </div>
                <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-blue-800">
                  Setting status to <span className="font-semibold">OPEN</span> moves this record into Admission Confirmation, matching the old ERP workflow.
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200/80 bg-white shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold text-slate-800">Document Verification</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {documentChecklist.map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <div>
                      <div className="text-sm font-medium text-slate-800">{item.label}</div>
                      <div className="text-xs text-slate-500">{item.value || 'Missing value'}</div>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        item.available ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {item.available ? 'Verified' : item.required ? 'Required' : 'Pending'}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
