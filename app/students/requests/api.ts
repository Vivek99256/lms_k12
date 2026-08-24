'use client';

import { legacyRequest } from '@/lib/erp-legacy';

export type RequestStatus = 'pending' | 'approved' | 'rejected';

export interface StudentRequest {
  id: string;
  type: string;
  studentName: string;
  parentName: string;
  grade: string;
  section: string;
  admissionId: string;
  reason: string;
  description: string;
  proof: string;
  status: RequestStatus;
  studentImage: string;
}

function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/(?:^|\s)\w/g, (match) => match.toUpperCase())
    .trim();
}

function normalizeRequest(row: Record<string, unknown>): StudentRequest {
  const statusRaw = String(row.STATUS ?? row.status ?? 'pending').toLowerCase();
  const status = statusRaw === 'approved'
    ? 'approved'
    : statusRaw === 'rejected'
      ? 'rejected'
      : 'pending';

  return {
    id: String(row.ID ?? row.id ?? ''),
    type: toTitleCase(String(row.request_title ?? row.REQUEST_TITLE ?? row.type ?? '')),
    studentName: String(row.student_name ?? ''),
    parentName: String(row.father_name ?? ''),
    grade: String(row.grade ?? ''),
    section: String(row.division ?? ''),
    admissionId: String(row.enrollment_no ?? ''),
    reason: String(row.REASON ?? row.reason ?? ''),
    description: String(row.DESCRIPTION ?? row.description ?? ''),
    proof: String(row.PROOF_OF_DOCUMENT ?? row.proof_of_document ?? ''),
    status,
    studentImage: String(row.student_image ?? ''),
  };
}

export interface StudentRequestFilters {
  grade: string;
  standard: string;
  division: string;
}

export async function fetchStudentRequests(
  filters: StudentRequestFilters = { grade: '', standard: '', division: '' }
): Promise<StudentRequest[]> {
  const payload = await legacyRequest('student/student_request_fixed', {
    query: {
      status: '',
      grade: filters.grade,
      standard: filters.standard,
      division: filters.division,
    },
  });

  const data = Array.isArray(payload.data) ? payload.data : [];
  return data.map((item) => normalizeRequest(item as Record<string, unknown>));
}

export async function updateRequestStatus(
  id: string,
  status: 'approved' | 'rejected'
): Promise<void> {
  const capitalized = status === 'approved' ? 'Approved' : 'Rejected';
  await legacyRequest(`student/student_request/${encodeURIComponent(id)}/status`, {
    method: 'POST',
    body: { status: capitalized },
  });
}

export interface RequestTypeOption {
  id: string;
  title: string;
  proofRequired: boolean;
  proofLabel: string;
}

export interface StudentRosterRow {
  id: string;
  enrollmentNo: string;
  name: string;
  image: string;
  standardId: string;
  sectionId: string;
  standard: string;
  division: string;
}

export interface StudentRequestFormData {
  students: StudentRosterRow[];
  requestTypes: RequestTypeOption[];
}

function normalizeRequestType(row: Record<string, unknown>): RequestTypeOption {
  return {
    id: String(row.ID ?? row.id ?? ''),
    title: String(row.REQUEST_TITLE ?? row.request_title ?? ''),
    proofRequired: String(row.PROOF_DOCUMENT_REQUIED ?? row.proof_document_requied ?? '') === 'Y',
    proofLabel: String(row.PROOF_DOCUMENT_NAME ?? row.proof_document_name ?? 'Document'),
  };
}

function normalizeRosterRow(row: Record<string, unknown>): StudentRosterRow {
  const fullName = [row.first_name, row.middle_name, row.last_name]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(' ');

  return {
    id: String(row.id ?? row.student_id ?? ''),
    enrollmentNo: String(row.enrollment_no ?? ''),
    name: fullName,
    image: String(row.image ?? row.student_image ?? ''),
    standardId: String(row.standard_id ?? ''),
    sectionId: String(row.section_id ?? ''),
    standard: String(row.standard_name ?? ''),
    division: String(row.division_name ?? ''),
  };
}

export async function fetchStudentRequestFormData(
  filters: StudentRequestFilters
): Promise<StudentRequestFormData> {
  const payload = await legacyRequest('student/student_request/create', {
    query: {
      grade: filters.grade,
      standard: filters.standard,
      division: filters.division,
    },
  });

  const students = Array.isArray(payload.student_data) ? payload.student_data : [];
  const requestTypes = Array.isArray(payload.request_type_data) ? payload.request_type_data : [];

  return {
    students: students.map((item) => normalizeRosterRow(item as Record<string, unknown>)),
    requestTypes: requestTypes.map((item) => normalizeRequestType(item as Record<string, unknown>)),
  };
}

export interface NewStudentRequestRow {
  studentId: string;
  standardId: string;
  sectionId: string;
  changeRequestId: string;
  reason: string;
  description: string;
  proofOfDocument: string;
}

export async function submitStudentRequests(rows: NewStudentRequestRow[]): Promise<string> {
  if (rows.length === 0) {
    throw new Error('Select at least one student to proceed.');
  }

  const CHANGE_REQUEST_IDS: Record<string, string> = {};
  const PROOF_OF_DOCUMENTS: Record<string, string> = {};
  const REASONS: Record<string, string> = {};
  const DESCRIPTIONS: Record<string, string> = {};
  const STANDARD_IDS: Record<string, string> = {};
  const SECTION_IDS: Record<string, string> = {};

  for (const row of rows) {
    CHANGE_REQUEST_IDS[row.studentId] = row.changeRequestId;
    PROOF_OF_DOCUMENTS[row.studentId] = row.proofOfDocument;
    REASONS[row.studentId] = row.reason;
    DESCRIPTIONS[row.studentId] = row.description;
    STANDARD_IDS[row.studentId] = row.standardId;
    SECTION_IDS[row.studentId] = row.sectionId;
  }

  const payload = await legacyRequest('student/student_request', {
    method: 'POST',
    body: {
      student_request: rows.map((row) => row.studentId),
      CHANGE_REQUEST_IDS,
      PROOF_OF_DOCUMENTS,
      REASONS,
      DESCRIPTIONS,
      STANDARD_IDS,
      SECTION_IDS,
    },
  });

  return typeof payload.message === 'string'
    ? payload.message
    : 'Student request submitted successfully.';
}
