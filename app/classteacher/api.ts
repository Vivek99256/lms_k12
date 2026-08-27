import {
  appendCommonParams,
  buildSessionContext,
  createAuthHeaders,
  normalizeApiStatus,
  readNumber,
  readString,
  type ApiEnvelope,
  type SessionContext,
} from "@/lib/erp-client";

export type ClassTeacherAssignment = {
  id: number;
  gradeId: number;
  standardId: number;
  divisionId: number;
  teacherId: number;
  academicSectionName: string;
  standardName: string;
  divisionName: string;
  teacherName: string;
};

export type NamedOption = {
  id: number;
  name: string;
};

export type StandardOption = NamedOption & {
  gradeId: number;
};

export type DivisionOption = NamedOption & {
  standardId: number;
};

export type ClassTeacherBootstrap = {
  assignments: ClassTeacherAssignment[];
  academicSections: NamedOption[];
  standards: StandardOption[];
  divisions: DivisionOption[];
  teachers: NamedOption[];
};

export type ClassTeacherInput = {
  gradeId: number;
  standardId: number;
  divisionId: number;
  teacherId: number;
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function records(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function messageFrom(payload: unknown, fallback: string): string {
  return isRecord(payload) ? readString(payload.message) || fallback : fallback;
}

function session(): SessionContext {
  const value = buildSessionContext();
  if (!value.token || !value.subInstituteId || !value.syear) {
    throw new Error(
      "Your login session is missing a token, institute, or academic year."
    );
  }
  return value;
}

async function request(
  path: string,
  currentSession: SessionContext,
  init?: RequestInit
): Promise<unknown> {
  const params = new URLSearchParams();
  appendCommonParams(params, currentSession);
  if (currentSession.userId) {
    params.set("user_id", currentSession.userId);
  }
  const response = await fetch(
    `/api/proxy?path=${encodeURIComponent(path)}&${params.toString()}`,
    {
      cache: "no-store",
      ...init,
      headers: {
        ...createAuthHeaders(
          currentSession,
          init?.body ? "application/json" : undefined
        ),
        ...init?.headers,
      },
    }
  );
  const payload = (await response.json()) as unknown;
  if (!response.ok) {
    throw new Error(messageFrom(payload, `Request failed (${response.status}).`));
  }
  if (
    isRecord(payload) &&
    ["0", "2"].includes(normalizeApiStatus(payload as ApiEnvelope))
  ) {
    throw new Error(messageFrom(payload, "The request could not be completed."));
  }
  return payload;
}

function body(currentSession: SessionContext, values: UnknownRecord): string {
  return JSON.stringify({
    ...values,
    type: "API",
    sub_institute_id: currentSession.subInstituteId,
    syear: currentSession.syear,
    user_id: readNumber(currentSession.userId),
  });
}

function option(record: UnknownRecord, nameKey = "name"): NamedOption {
  return { id: readNumber(record.id), name: readString(record[nameKey]).trim() };
}

export async function loadClassTeachers(): Promise<ClassTeacherBootstrap> {
  const currentSession = session();
  const payload = await request("api/class-teachers", currentSession);
  const data =
    isRecord(payload) && isRecord(payload.data) ? payload.data : {};

  return {
    assignments: records(data.assignments).map((record) => ({
      id: readNumber(record.id),
      gradeId: readNumber(record.grade_id),
      standardId: readNumber(record.standard_id),
      divisionId: readNumber(record.division_id),
      teacherId: readNumber(record.teacher_id),
      academicSectionName: readString(record.academic_section_name),
      standardName: readString(record.standard_name),
      divisionName: readString(record.division_name),
      teacherName: readString(record.teacher_name).trim(),
    })),
    academicSections: records(data.academic_sections).map((record) =>
      option(record, "title")
    ),
    standards: records(data.standards).map((record) => ({
      ...option(record),
      gradeId: readNumber(record.grade_id),
    })),
    divisions: records(data.divisions).map((record) => ({
      ...option(record),
      standardId: readNumber(record.standard_id),
    })),
    teachers: records(data.teachers).map((record) =>
      option(record, "teacher_name")
    ),
  };
}

export async function createClassTeacher(
  input: ClassTeacherInput
): Promise<string> {
  const currentSession = session();
  const payload = await request("api/class-teachers", currentSession, {
    method: "POST",
    body: body(currentSession, {
      grade_id: input.gradeId,
      standard_id: input.standardId,
      division_id: input.divisionId,
      teacher_id: input.teacherId,
    }),
  });
  return messageFrom(payload, "Class teacher added successfully.");
}

export async function updateClassTeacher(
  id: number,
  input: ClassTeacherInput
): Promise<string> {
  const currentSession = session();
  const payload = await request(`api/class-teachers/${id}`, currentSession, {
    method: "POST",
    body: body(currentSession, {
      _method: "PUT",
      grade_id: input.gradeId,
      standard_id: input.standardId,
      division_id: input.divisionId,
      teacher_id: input.teacherId,
    }),
  });
  return messageFrom(payload, "Class teacher updated successfully.");
}

export async function deleteClassTeacher(id: number): Promise<string> {
  const currentSession = session();
  const payload = await request(`api/class-teachers/${id}`, currentSession, {
    method: "POST",
    body: body(currentSession, { _method: "DELETE" }),
  });
  return messageFrom(payload, "Class teacher deleted successfully.");
}
