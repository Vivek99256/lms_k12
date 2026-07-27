'use client';

import {
  isRecord,
  labelledKeys,
  legacyRequest,
  messageFrom,
  readNumber,
  readString,
  recordArray,
  type LabelledKey,
} from '@/lib/erp-legacy';

export type StudentReportKind =
  | 'student_report'
  | 'inactive_student_report'
  | 'missing_document_report'
  | 'student_request_report'
  | 'student_health_report'
  | 'student_discipline_report'
  | 'student_strength_report'
  | 'agewise_report';

export type SelectOption = {
  id: string;
  label: string;
};

export type DynamicFieldGroup = {
  title: string;
  options: SelectOption[];
};

export type FlatRow = Record<string, unknown>;

export type FlatReportResult = {
  rows: FlatRow[];
  headers: LabelledKey[];
  message: string;
};

export type DisciplineSummaryRow = {
  studentName: string;
  totalPoints: number;
  positiveCount: number;
  negativeCount: number;
};

export type StrengthFilterOptions = {
  religions: SelectOption[];
  casts: SelectOption[];
  quotas: SelectOption[];
};

function rootPayload(payload: unknown): Record<string, unknown> {
  if (!isRecord(payload)) return {};
  const nested = isRecord(payload.data) ? payload.data : null;
  return nested && Object.keys(nested).length > 0 ? nested : payload;
}

function normalizeFlatRows(rows: unknown) {
  return recordArray(rows).map((row) => {
    const next: FlatRow = {};
    Object.entries(row).forEach(([key, value]) => {
      next[key] = value;
    });
    return next;
  });
}

function dateLabel(value: unknown) {
  const text = readString(value).trim();
  if (!text) return '-';
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return text;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

export function formatCellValue(key: string, value: unknown) {
  if (value == null || value === '') return '-';
  if (
    key === 'admission_date' ||
    key === 'dob' ||
    key === 'date' ||
    key === 'birthdate' ||
    key === 'created_on' ||
    key === 'birthday' ||
    key === 'created_at' ||
    key === 'medical_close_date' ||
    key === 'date_'
  ) {
    return dateLabel(value);
  }
  return readString(value);
}

export function parseDynamicFieldGroups(value: unknown): DynamicFieldGroup[] {
  if (!isRecord(value)) return [];

  return Object.entries(value)
    .map(([title, options]) => ({
      title,
      options: recordArray(options).map((record) => ({
        id: `${readString(record.field_name)}/${readString(record.id)}`,
        label: readString(record.field_label),
      })),
    }))
    .filter((group) => group.options.length > 0);
}

export async function loadDynamicBootstrap(
  kind: 'student_report' | 'inactive_student_report'
): Promise<DynamicFieldGroup[]> {
  const path =
    kind === 'student_report' ? 'student/student_report' : 'student/inactive_student_report';
  const payload = rootPayload(await legacyRequest(path));
  return parseDynamicFieldGroups(payload.data);
}

export async function loadStrengthFilterOptions(): Promise<StrengthFilterOptions> {
  const payload = rootPayload(await legacyRequest('student/add_student'));

  return {
    religions: recordArray(payload.religion_data).map((record) => ({
      id: readString(record.id),
      label: readString(record.religion_name || record.name || record.religion),
    })),
    casts: recordArray(payload.caste_data).map((record) => ({
      id: readString(record.id),
      label: readString(record.caste_name || record.name || record.caste),
    })),
    quotas: recordArray(payload.student_quota).map((record) => ({
      id: readString(record.id),
      label: readString(record.title || record.name),
    })),
  };
}

export async function fetchStudentListingReport(input: {
  inactive?: boolean;
  grade: string;
  standard: string;
  division: string;
  orderBy: string;
  dynamicFields: string[];
}): Promise<FlatReportResult> {
  const path = input.inactive ? 'student/inactive_student_report/create' : 'student/show_student_report';
  const payload = rootPayload(
    await legacyRequest(path, {
      method: input.inactive ? 'GET' : 'POST',
      ...(input.inactive
        ? {
            query: {
              grade: input.grade,
              standard: input.standard,
              division: input.division,
              order_by: input.orderBy,
              dynamicFields: input.dynamicFields,
            },
          }
        : {
            body: {
              grade: input.grade,
              standard: input.standard,
              division: input.division,
              order_by: input.orderBy,
              dynamicFields: input.dynamicFields,
            },
          }),
    })
  );

  return {
    rows: normalizeFlatRows(payload.student_data),
    headers: labelledKeys(payload.headers),
    message: messageFrom(payload, input.inactive ? 'Inactive student report loaded.' : 'Student report loaded.'),
  };
}

export async function fetchMissingDocumentReport(input: {
  grade: string;
  standard: string;
  division: string;
  userType: string;
}) {
  const payload = rootPayload(
    await legacyRequest('student/missing_document_report/create', {
      query: {
        grade: input.grade,
        standard: input.standard,
        division: input.division,
        user_type: input.userType,
      },
    })
  );

  const documentTypes = recordArray(payload.docment_type_data).map((record) => ({
    id: readString(record.id),
    label: readString(record.document_type),
  }));

  const headers: LabelledKey[] = [
    ...(input.userType === 'student' ? [{ key: 'enrollment_no', label: 'GR No' }] : []),
    { key: 'student_name', label: input.userType === 'staff' ? 'Staff Name' : 'Student Name' },
    ...(input.userType === 'student'
      ? [
          { key: 'standard_name', label: 'Standard' },
          { key: 'division_name', label: 'Division' },
        ]
      : []),
    ...documentTypes.map((documentType) => ({ key: `document_${documentType.id}`, label: documentType.label })),
  ];

  const rows = normalizeFlatRows(payload.result_report).map((row) => {
    const values = readString(row.document_list)
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);

    const next: FlatRow = {
      enrollment_no: row.enrollment_no,
      student_name: row.student_name,
      standard_name: row.standard_name,
      division_name: row.division_name,
    };

    documentTypes.forEach((documentType) => {
      next[`document_${documentType.id}`] = values.includes(documentType.id) ? 'Submitted' : 'Missing';
    });

    return next;
  });

  return {
    rows,
    headers,
    documentTypes,
    message: messageFrom(payload, 'Missing document report loaded.'),
  };
}

export async function fetchStudentRequestReport(input: {
  fromDate: string;
  toDate: string;
}): Promise<FlatReportResult> {
  const payload = rootPayload(
    await legacyRequest('student/student_request_report/create', {
      query: {
        from_date: input.fromDate,
        to_date: input.toDate,
      },
    })
  );

  return {
    rows: normalizeFlatRows(payload.result_report),
    headers: [
      { key: 'enrollment_no', label: 'GR No' },
      { key: 'student_name', label: 'Student Name' },
      { key: 'standard', label: 'Standard' },
      { key: 'division', label: 'Division' },
      { key: 'REQUEST', label: 'Request' },
      { key: 'REASON', label: 'Reason' },
      { key: 'DESCRIPTION', label: 'Description' },
    ],
    message: messageFrom(payload, 'Student request report loaded.'),
  };
}

export async function fetchStudentHealthReport(input: {
  grade: string;
  standard: string;
  division: string;
  fromDate: string;
  toDate: string;
  healthType: string;
}): Promise<FlatReportResult> {
  const payload = rootPayload(
    await legacyRequest('student/show_student_health_report', {
      method: 'POST',
      body: {
        grade: input.grade,
        standard: input.standard,
        division: input.division,
        from_date: input.fromDate,
        to_date: input.toDate,
        health_type: input.healthType,
      },
    })
  );

  return {
    rows: normalizeFlatRows(payload.health_data),
    headers: labelledKeys(payload.headers),
    message: messageFrom(payload, 'Student health report loaded.'),
  };
}

export async function fetchStudentDisciplineReport(input: {
  grade: string;
  standard: string;
  division: string;
  studentName: string;
  uniqueId: string;
  mobile: string;
  grno: string;
  fromDate: string;
  toDate: string;
}) {
  const payload = rootPayload(
    await legacyRequest('front_desk/dicipline_report/create', {
      query: {
        grade: input.grade,
        standard: input.standard,
        division: input.division,
        stu_name: input.studentName,
        uniqueid: input.uniqueId,
        mobile: input.mobile,
        grno: input.grno,
        from_date: input.fromDate,
        to_date: input.toDate,
      },
      tolerateStatusZero: true,
    })
  );

  return {
    rows: normalizeFlatRows(payload.data),
    summary: recordArray(payload.student_summary).map((row) => ({
      studentName: readString(row.student_name),
      totalPoints: readNumber(row.total_points),
      positiveCount: readNumber(row.positive_count),
      negativeCount: readNumber(row.negative_count),
    })),
    message: messageFrom(payload, 'Student discipline report loaded.'),
  };
}

export async function fetchStudentStrengthReport(input: {
  oneDate: string;
  standardWise: string[];
  fromDate: string;
  toDate: string;
  general: string[];
  strength: string[];
  religion: string[];
  cast: string[];
  quota: string[];
}) {
  const payload = rootPayload(
    await legacyRequest('student/student_strength_report/create', {
      query: {
        one_date: input.oneDate,
        standard_wise: input.standardWise,
        from_date: input.fromDate,
        to_date: input.toDate,
        general: input.general,
        strength: input.strength,
        religion: input.religion,
        cast: input.cast,
        quota: input.quota,
      },
    })
  );

  return {
    rows: normalizeFlatRows(payload.result),
    message: messageFrom(payload, 'Student strength report loaded.'),
  };
}

export async function fetchAgewiseReport(input: {
  grade: string;
}) {
  const payload = rootPayload(
    await legacyRequest('student/agewise', {
      query: {
        grade_id: input.grade,
      },
    })
  );

  const reportRecord = isRecord(payload.report) ? payload.report : {};
  const classes = Array.isArray(payload.classes)
    ? payload.classes.map((entry) => readString(entry)).filter(Boolean)
    : [];
  const buckets = Object.entries(reportRecord).map(([age, classMap]) => {
    const values: Record<string, { M: number; F: number }> = {};
    classes.forEach((className) => {
      const entry = isRecord(classMap) && isRecord(classMap[className]) ? classMap[className] : {};
      values[className] = {
        M: readNumber(isRecord(entry) ? entry.M : 0),
        F: readNumber(isRecord(entry) ? entry.F : 0),
      };
    });
    return { age, values };
  });

  return {
    classes,
    buckets,
    grandTotal: readNumber(payload.grandTotal),
    message: messageFrom(payload, 'Agewise report loaded.'),
  };
}

export const STUDENT_REPORT_ORDER_OPTIONS: SelectOption[] = [
  { id: 'student_name', label: 'Student Name' },
  { id: 'standard_id', label: 'Standard' },
  { id: 'enrollment_no', label: 'GR No' },
  { id: 'roll_no', label: 'Roll No' },
  { id: 'last_name', label: 'Last Name' },
];

export const STUDENT_HEALTH_TYPE_OPTIONS: SelectOption[] = [
  { id: 'student_infirmary', label: 'Infirmary Info' },
  { id: 'student_vaccination', label: 'Vaccination Info' },
  { id: 'student_height_weight', label: 'Height & Weight Info' },
  { id: 'student_health', label: 'Health Info' },
];

export const STRENGTH_GENERAL_OPTIONS: SelectOption[] = [
  { id: 'new_add', label: 'New Admission' },
  { id: 'take_lc', label: 'Take LC' },
];

export const STRENGTH_GENDER_OPTIONS: SelectOption[] = [
  { id: 'M', label: 'Boy' },
  { id: 'F', label: 'Girl' },
];
