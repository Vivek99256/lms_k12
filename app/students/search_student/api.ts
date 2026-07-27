'use client';

import {
  appendSessionParams,
  appendSessionFormData,
  assertApiSuccess,
  asRecord,
  fetchLaravelJson,
  getFeesSession,
  readFirstString,
  readNumber,
  readString,
  toArray,
} from '@/app/fees/_lib/fees-api';
import type { Student } from './components/StudentProfilesTab';

type StudentSearchResponse = {
  status?: string | number;
  status_code?: string | number;
  message?: string;
  data?: unknown;
};

export type StudentSearchFilters = {
  gradeId?: string;
  standardId?: string;
  divisionId?: string;
  firstName?: string;
  lastName?: string;
  grNo?: string;
};

export type StudentDivisionOption = {
  value: string;
  label: string;
};

export type StudentSearchOption = StudentDivisionOption;

function first(record: Record<string, unknown>, keys: string[]): string {
  return readFirstString(record, keys);
}

function normalizeGender(value: string): string {
  const gender = value.trim().toLowerCase();
  if (gender === 'm' || gender === 'male') return 'Male';
  if (gender === 'f' || gender === 'female') return 'Female';
  return value;
}

function normalizeStudent(value: unknown): Student {
  const row = asRecord(value);
  const firstName = first(row, ['first_name', 'firstname']);
  const middleName = first(row, ['middle_name', 'middlename']);
  const lastName = first(row, ['last_name', 'lastname']);
  const fullName = first(row, ['student_name', 'name'])
    || [firstName, middleName, lastName].filter(Boolean).join(' ');
  const ended = Boolean(first(row, ['end_date', 'inactive_colour']));
  const active = readString(row.status).toLowerCase();
  const status: Student['status'] = ended || active === '0' || active === 'inactive'
    ? 'inactive'
    : active === 'transferred'
      ? 'transferred'
      : active === 'alumni'
        ? 'alumni'
        : 'active';

  return {
    id: first(row, ['student_id', 'studentId', 'id']),
    standardId: first(row, ['standard_id']),
    divisionId: first(row, ['section_id', 'division_id']),
    admissionNo: first(row, ['enrollment_no', 'admission_no', 'gr_no', 'uniqueid']),
    name: fullName,
    class: first(row, ['standard', 'standard_name', 'class_name']),
    section: first(row, ['division', 'division_name', 'section_name']),
    rollNo: first(row, ['roll_no', 'roll_number']),
    gender: normalizeGender(first(row, ['gender'])),
    dob: first(row, ['birth_date', 'date_of_birth', 'dob']),
    fatherName: first(row, ['father_name', 'father_full_name']),
    motherName: first(row, ['mother_name', 'mother_full_name']),
    guardian: first(row, ['guardian_name', 'father_name']),
    phone: first(row, ['mobile', 'mobile_no', 'phone']),
    email: first(row, ['email', 'email_id']),
    address: first(row, ['address', 'address1', 'residential_address']),
    house: first(row, ['house', 'house_name']),
    bloodGroup: first(row, ['blood_group', 'bloodgroup']),
    status,
    attendance: readNumber(row.attendance ?? row.attendance_percentage),
    lastActive: first(row, ['last_active', 'updated_at']),
    docsMissing: readNumber(row.docs_missing ?? row.missing_documents),
    vaccination: first(row, ['vaccination', 'vaccination_status']),
    allergy: first(row, ['allergy', 'allergies']) || null,
    infirmary: readNumber(row.infirmary ?? row.infirmary_visits),
  };
}

async function requestStudents(
  includingInactive: boolean,
  filters: StudentSearchFilters,
  signal?: AbortSignal,
): Promise<Student[]> {
  const session = getFeesSession();
  const form = new FormData();
  appendSessionFormData(form, session);
  if (includingInactive) form.set('including_inactive', 'Yes');
  if (filters.gradeId) form.set('grade', filters.gradeId);
  if (filters.standardId) form.set('standard', filters.standardId);
  if (filters.divisionId) form.set('division', filters.divisionId);
  if (filters.firstName?.trim()) form.set('first_name', filters.firstName.trim());
  if (filters.lastName?.trim()) form.set('last_name', filters.lastName.trim());
  if (filters.grNo?.trim()) form.set('gr_no', filters.grNo.trim());

  const payload = await fetchLaravelJson<StudentSearchResponse>(
    session,
    '/api/proxy?path=get_adminStudentSearch',
    { method: 'POST', body: form, signal },
  );
  assertApiSuccess(payload, 'Unable to load students.');
  return toArray(payload.data).map(normalizeStudent);
}

export async function fetchStudents(
  filters: StudentSearchFilters = {},
  signal?: AbortSignal,
): Promise<Student[]> {
  return requestStudents(true, filters, signal);
}

export async function updateStudent(student: Student): Promise<void> {
  const session = getFeesSession();
  const body = new URLSearchParams();
  appendSessionParams(body, session);
  body.set('name', student.name);
  body.set('admission_no', student.admissionNo);
  body.set('roll_no', student.rollNo);
  body.set('class_name', student.class);
  body.set('section_name', student.section);
  body.set('house', student.house);
  body.set('gender', student.gender);
  body.set('dob', student.dob);
  body.set('father_name', student.fatherName);
  body.set('mother_name', student.motherName);
  body.set('mobile', student.phone);
  body.set('email', student.email);
  body.set('address', student.address);
  body.set('blood_group', student.bloodGroup);

  const payload = await fetchLaravelJson<StudentSearchResponse>(
    session,
    `/api/proxy?path=get_adminStudentSearch/${encodeURIComponent(student.id)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    },
  );
  assertApiSuccess(payload, 'Unable to update student.');
}

export async function fetchDivisions(
  standardId: string,
  signal?: AbortSignal,
): Promise<StudentDivisionOption[]> {
  if (!standardId) return [];

  const session = getFeesSession();
  const form = new FormData();
  form.set('sub_institute_id', session.subInstituteId);
  form.set('standard_id', standardId);
  if (session.academicYearId) form.set('syear', session.academicYearId);
  if (session.token) form.set('token', session.token);

  const payload = await fetchLaravelJson<StudentSearchResponse>(
    session,
    '/api/proxy?path=get_adminDivision',
    { method: 'POST', body: form, signal },
  );

  return toArray(payload.data)
    .map((value) => {
      const row = asRecord(value);
      return {
        value: first(row, ['id', 'division_id']),
        label: first(row, ['name', 'division']),
      };
    })
    .filter((option) => option.value && option.label);
}

async function fetchAcademicOptions(
  path: string,
  form: FormData,
  signal?: AbortSignal,
): Promise<StudentSearchOption[]> {
  const session = getFeesSession();
  if (session.token && !form.has('token')) form.set('token', session.token);
  if (session.subInstituteId && !form.has('sub_institute_id')) {
    form.set('sub_institute_id', session.subInstituteId);
  }

  const payload = await fetchLaravelJson<StudentSearchResponse>(
    session,
    `/api/proxy?path=${path}`,
    { method: 'POST', body: form, signal },
  );

  return toArray(payload.data)
    .map((value) => {
      const row = asRecord(value);
      return {
        value: first(row, ['id']),
        label: first(row, ['title', 'name']),
      };
    })
    .filter((option) => option.value && option.label);
}

export function fetchAcademicSections(signal?: AbortSignal): Promise<StudentSearchOption[]> {
  return fetchAcademicOptions('get_adminAcademicSection', new FormData(), signal);
}

export function fetchStandards(
  gradeId: string,
  signal?: AbortSignal,
): Promise<StudentSearchOption[]> {
  if (!gradeId) return Promise.resolve([]);
  const form = new FormData();
  form.set('grade_id', gradeId);
  return fetchAcademicOptions('get_adminStandard', form, signal);
}
