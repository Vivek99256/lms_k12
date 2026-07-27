import {
  type AcademicSection,
  type Division,
  type Standard,
  type Subject,
} from "./types";

interface ApiResponse<T> {
  status?: number | string;
  status_code?: number | string;
  message?: string;
  data?: T[] | Record<string, T> | null;
}

function normalizeItems<T>(payload: ApiResponse<T>): T[] {
  if (Array.isArray(payload.data)) {
    return payload.data;
  }

  if (payload.data && typeof payload.data === "object") {
    return Object.values(payload.data);
  }

  return [];
}

async function postFormData<T>(
  endpoint: string,
  payload: Record<string, string>
): Promise<T[]> {
  const body = new URLSearchParams();
  Object.entries(payload).forEach(([key, value]) => {
    body.set(key, value);
  });

  const proxyParams = new URLSearchParams({
    path: endpoint.replace(/^\//, ""),
  });

  const response = await fetch(`/api/proxy?${proxyParams.toString()}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    body: body.toString(),
  });

  const result: ApiResponse<T> = await response.json();

  if (!response.ok) {
    throw new Error(
      result.message || `Request failed with status ${response.status}`
    );
  }

  if (Number(result.status ?? result.status_code) !== 1) {
    throw new Error(result.message || "No records found.");
  }

  return normalizeItems(result);
}

export function getAcademicSections(params: {
  subInstituteId: string;
  token: string;
}) {
  return postFormData<AcademicSection>("/get_adminAcademicSection", {
    sub_institute_id: params.subInstituteId,
    token: params.token,
  });
}

export function getStandards(params: {
  subInstituteId: string;
  gradeId: string;
  token: string;
}) {
  return postFormData<Standard>("/get_adminStandard", {
    sub_institute_id: params.subInstituteId,
    grade_id: params.gradeId,
    token: params.token,
  });
}

export function getDivisions(params: {
  subInstituteId: string;
  standardId: string;
  token: string;
}) {
  return postFormData<Division>("/get_adminDivision", {
    sub_institute_id: params.subInstituteId,
    standard_id: params.standardId,
    token: params.token,
  });
}

export function getSubjects(params: {
  subInstituteId: string;
  standardId: string;
  token: string;
}) {
  return postFormData<Subject>("/get_adminSubject", {
    sub_institute_id: params.subInstituteId,
    standard_id: params.standardId,
    token: params.token,
  });
}
