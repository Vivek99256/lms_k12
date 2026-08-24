'use client';

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
  RegistrationPipelineDetail,
} from './types';

export type OptionItem = {
  display_text?: string;
  display_value?: string;
};

export type DataFieldsMap = Record<string, OptionItem[]>;
export type RegistrationFormState = Record<string, string>;

export const documentFieldKeys = [
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

export const trackedFields = [
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

export function buildInitialFormState(
  record: LegacyRegistrationApiRow,
  customFields: LegacyCustomField[]
): RegistrationFormState {
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

export function mergeFormState(
  base: RegistrationFormState,
  updates: Partial<RegistrationFormState>
): RegistrationFormState {
  const nextState = { ...base };

  Object.entries(updates).forEach(([key, value]) => {
    if (typeof value !== 'string') return;

    if (value.trim() === '') {
      nextState[key] = readString(base[key]);
      return;
    }

    nextState[key] = value;
  });

  return nextState;
}

export function buildOptions(
  dataFields: DataFieldsMap,
  key: string,
  fallback: Array<{ label: string; value: string }> = []
) {
  const apiOptions = Array.isArray(dataFields[key]) ? dataFields[key] : [];
  const normalized = apiOptions
    .map((option) => ({
      label: readString(option.display_text || option.display_value),
      value: readString(option.display_value || option.display_text),
    }))
    .filter((option) => option.label && option.value);

  return normalized.length > 0 ? normalized : fallback;
}

export async function fetchRegistrationDetail(
  id: string,
  signal?: AbortSignal
): Promise<RegistrationPipelineDetail | null> {
  const session = buildSessionContext();
  if (!session.baseUrl || !session.subInstituteId || !session.syear) return null;

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
    standard: Array.isArray(payload.standard) ? payload.standard : [],
    bloodgroupData: Array.isArray(payload.bloodgroup_data) ? payload.bloodgroup_data : [],
    religionData: Array.isArray(payload.religion_data) ? payload.religion_data : [],
    casteData: Array.isArray(payload.caste_data) ? payload.caste_data : [],
    newEnrollmentNo: readString(payload.new_enrollment_no),
    nextRegisterNumber: readString(payload.next_register_number),
    displaySaveStudent: readString(payload.display_save_student),
  };
}

export async function saveRegistration(
  id: string,
  detail: RegistrationPipelineDetail,
  updates: Partial<RegistrationFormState>
) {
  const session = buildSessionContext();
  if (!session.baseUrl || !session.subInstituteId || !session.syear || !session.userId) {
    throw new Error('Session is missing API base URL, sub institute, academic year, or user ID.');
  }

  const merged = mergeFormState(buildInitialFormState(detail.record, detail.customFields), updates);
  const payload = new URLSearchParams();

  payload.set('type', 'API');
  payload.set('sub_institute_id', session.subInstituteId);
  payload.set('syear', session.syear);
  payload.set('user_id', session.userId);

  trackedFields.forEach((field) => {
    const value = readString(merged[field]);
    if (value !== '') payload.set(field, value);
  });

  detail.customFields.forEach((field) => {
    const fieldName = readString(field.field_name);
    if (!fieldName) return;
    const value = readString(merged[fieldName]);
    if (value !== '') payload.set(fieldName, value);
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

  const refreshedDetail = await fetchRegistrationDetail(id);
  if (!refreshedDetail) {
    throw new Error('Registration was updated but the latest record could not be reloaded.');
  }

  return {
    merged,
    detail: refreshedDetail,
  };
}

export async function confirmAdmission(input: {
  id: string;
  enquiryId?: string;
  registrationEnquiryId?: string;
  termId?: string;
}) {
  const session = buildSessionContext();
  if (!session.baseUrl || !session.subInstituteId || !session.syear) {
    throw new Error('Session is missing API base URL, sub institute, or academic year.');
  }

  const confirmationId =
    readString(input.registrationEnquiryId) ||
    readString(input.enquiryId) ||
    readString(input.id);

  if (!confirmationId) {
    throw new Error('Confirmation record is missing the linked enquiry identifier.');
  }

  const payload = new URLSearchParams();
  payload.set('type', 'API');
  payload.set('sub_institute_id', session.subInstituteId);
  payload.set('syear', session.syear);
  payload.set('id', confirmationId);
  const effectiveTermId = readString(input.termId) || session.termId;
  if (effectiveTermId) {
    payload.set('term_id', effectiveTermId);
  }

  const baseUrl = session.baseUrl.replace(/\/$/, '');
  const response = await fetch(`${baseUrl}/api/admission_student?type=API`, {
    method: 'POST',
    headers: createAuthHeaders(session, 'application/x-www-form-urlencoded;charset=UTF-8'),
    body: payload.toString(),
  });

  if (!response.ok) {
    throw new Error(`Failed to confirm admission (${response.status})`);
  }

  const responsePayload = (await response.json()) as { status_code?: string | number; message?: string };
  if (normalizeApiStatus(responsePayload) !== '1') {
    throw new Error(responsePayload.message || 'Failed to confirm admission.');
  }

  return responsePayload;
}
