import {
  type AcademicSection,
  type Division,
  type Standard,
  type Subject,
} from "./types";

import { API_BASE_URL } from "@/app/components/utils/api_url";

interface ApiResponse<T> {
  status: number | string;
  message?: string;
  data?: T[];
}

async function postFormData<T>(
  endpoint: string,
  payload: Record<string, string>
): Promise<T[]> {
  const formData = new FormData();

  Object.entries(payload).forEach(([key, value]) => {
    formData.append(key, value);
  });

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  const result: ApiResponse<T> = await response.json();

  if (Number(result.status) !== 1) {
    throw new Error(result.message || "No records found.");
  }

  return Array.isArray(result.data) ? result.data : [];
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
