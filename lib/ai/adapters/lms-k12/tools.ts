import { z } from "zod";
import { API_BASE_URL } from "@/app/components/utils/api_url";
import {
  type ProjectContext,
  type ProjectToolDefinition,
} from "@shared/conversational-ai-core";
import {
  admissionUpdateInputSchema,
  admissionCandidateInputSchema,
  admissionConfirmInputSchema,
  admissionEnquiryInputSchema,
  admissionHydrateInputSchema,
  activityStreamInputSchema,
  contextualSuggestionsSchema,
  feesDefaulterInputSchema,
  homeworkListInputSchema,
  lmsDashboardInputSchema,
  moduleActionInputSchema,
  resultReportInputSchema,
  studentFeeDetailsInputSchema,
  studentFeeRecordInputSchema,
  studentSearchInputSchema,
  teacherDailyReportInputSchema,
} from "./schemas";
import { buildTrustedQuery, fetchLmsJson, postLmsForm } from "./server-api";
import {
  buildAdmissionSlots,
  normalizeAdmissionData,
  parseAdmissionFieldReply,
  parseAdmissionSlotInput,
} from "./admission-workflow";
import {
  canAccessStudentAnalytics,
  isAdminProfile,
  isStudentProfile,
  isTeacherProfile,
} from "../shared-utils";
import type { AdmissionConversationState } from "@shared/conversational-ai-core";
import { AdmissionStateService, type ConversationStateStore } from "@shared/conversational-ai-core";
import {
  getAdmissionState,
  setAdmissionState,
  deleteAdmissionState,
} from "@shared/conversational-ai-core";
import { parseCandidateReference } from "./admission-candidate-parser";
import { matchSavedCandidates } from "./admission-matcher";
import { mergeAdmissionData } from "./merge-admission-data";
import { hydrateAdmissionCandidate as hydrateAdmissionCandidateFromEnquiry } from "./hydrate-admission-candidate";
import { getMissingAdmissionFields } from "./get-missing-admission-fields";
import { buildAdmissionConfirmationPayload, buildRegistrationPayloadFromEnquiry } from "./build-admission-payload";
import { executePendingAdmissionAction } from "./execute-admission-action";
import { resolveStandard } from "./resolve-standard";
import { resolveDivision } from "./resolve-division";
import { resolveStudentQuota } from "./resolve-student-quota";
import { callBackendMcpTool } from "./mcp-server";
import {
  MODULE_DATA_TOOL_NAMES,
  getAttendanceOverview,
  getClassStructure,
  getClassTeachers,
  getCourseCatalog,
  getDepartmentDirectory,
  getFeesSummary,
  getModuleDataToolDefinitions,
  getStudentAttendanceDetail,
  getStudentDirectory,
  getSubjectCatalog,
  getTeacherDirectory,
} from "./module-data-tools";

function normalizeAcademicLabel(value: string | null | undefined) {
  return (value || "")
    .toLowerCase()
    .replace(/^standard\s+/i, "")
    .replace(/^std\s+/i, "")
    .replace(/^class\s+/i, "")
    .replace(/^division\s+/i, "")
    .replace(/^section\s+/i, "")
    .replace(/\s+/g, "")
    .trim();
}

type AcademicOption = {
  id: string;
  label: string;
};

type AdmissionCandidateSummary = {
  enquiryId: number;
  enquiryNo?: string;
  fullName: string;
  mobile?: string;
  standardId?: number;
  standardName?: string;
  status?: string;
};

function hasExplicitBackendId(value: string | null | undefined) {
  const normalized = (value || "").trim();
  return /^id\s*:\s*\d+$/i.test(normalized);
}

function readExplicitBackendId(value: string | null | undefined) {
  const normalized = (value || "").trim();
  const match = normalized.match(/^id\s*:\s*(\d+)$/i);
  return match ? match[1] : "";
}

function logAiDebug(event: string, detail: Record<string, unknown>) {
  console.info(`[lms-ai.debug] ${event}`, detail);
}

function normalizeModuleName(value: string | null | undefined) {
  return (value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function inferModuleName(input: { module?: string; searchText?: string }, context: ProjectContext) {
  const text = `${input.module || ""} ${input.searchText || ""} ${context.latestUserMessage.content || ""}`.toLowerCase();
  const route = (context.route || "").toLowerCase();

  if (/admission|enquiry|application/.test(text)) {
    return "admissions";
  }

  if (/fee|fees|defaulter|dues|collect|payment/.test(text)) {
    return "fees";
  }

  if (/homework|assignment|classwork/.test(text)) {
    return "homework";
  }

  if (/mark|marks|result|report card|report/.test(text)) {
    return "results";
  }

  if (/attendance|absent|present/.test(text)) {
    return "attendance";
  }

  if (/subject|syllabus/.test(text)) {
    return "subjects";
  }

  if (/course|curriculum|chapter|content/.test(text)) {
    return "courses";
  }

  if (/department|division head|sub department/.test(text)) {
    return "departments";
  }

  if (/timetable|schedule|period/.test(text)) {
    return "timetable";
  }

  if (/exam|assessment|test/.test(text)) {
    return "exams";
  }

  if (/library|book|resource/.test(text)) {
    return "library";
  }

  if (/transport|bus|van|route/.test(text)) {
    return "transport";
  }

  if (/hostel|room|mess/.test(text)) {
    return "hostel";
  }

  if (/notification|notice|message/.test(text)) {
    return "notifications";
  }

  if (/account|ledger|invoice|expense/.test(text)) {
    return "accounts";
  }

  if (/teacher|staff/.test(text)) {
    return "teachers";
  }

  if (/student|learner|parent|guardian/.test(text)) {
    return "students";
  }

  // Only reached when the message is about the class structure itself rather
  // than the people or records inside a class.
  if (/\b(class list|classes|section list|divisions|standards)\b/.test(text)) {
    return "classes";
  }

  if (/dashboard|progress/.test(text) || /\/lms|\/dashboard/.test(route)) {
    return "dashboard";
  }

  if (/activity|stream|feed/.test(text) || /\/activity/.test(route)) {
    return "activity";
  }

  const moduleToken = normalizeModuleName(input.module);
  return moduleToken || "general";
}

/**
 * Pulls a proper name out of free text ("attendance of Zeel Tank", "Computer
 * Science department") so it can be resolved against real backend rows. Returns
 * an empty string when the message carries no name, because a wrong guess would
 * silently narrow the result set.
 */
function inferStudentNameFromText(text: string) {
  const source = (text || "").trim();
  if (!source) {
    return "";
  }

  const labelled = source.match(
    /\b(?:of|for|named|name(?:d)?\s*[:=-]?|about)\s+([A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){0,3})/
  );
  if (labelled?.[1]) {
    return labelled[1].trim();
  }

  const capitalized = source.match(
    /\b([A-Z][a-z]{1,}(?:\s+[A-Z][A-Za-z.'-]*){1,3})\b/
  );
  return capitalized?.[1]?.trim() || "";
}

function inferModuleAction(input: { action?: string; searchText?: string }, context: ProjectContext) {
  const text = `${input.action || ""} ${input.searchText || ""} ${context.latestUserMessage.content || ""}`.toLowerCase();

  if (/confirm|approve/.test(text)) {
    return "confirm";
  }

  if (/collect|pay|receive|record/.test(text)) {
    return "collect";
  }

  if (/defaulter|pending|due|outstanding/.test(text)) {
    return "list_defaulters";
  }

  if (/create|add|new/.test(text)) {
    return "create";
  }

  if (/update|edit|change/.test(text)) {
    return "update";
  }

  if (/delete|remove/.test(text)) {
    return "delete";
  }

  if (/find|search|show|list|view|get|what|who/.test(text)) {
    return "search";
  }

  return input.action || "search";
}

function readOptionRows(payload: Record<string, unknown>) {
  const raw = Array.isArray(payload.data)
    ? payload.data
    : payload.data && typeof payload.data === "object"
      ? Object.values(payload.data as Record<string, unknown>)
      : [];

  return raw.filter(
    (item): item is Record<string, unknown> => typeof item === "object" && item !== null
  );
}

function toAcademicOptions(rows: Array<Record<string, unknown>>): AcademicOption[] {
  return rows
    .map((row) => ({
      id: pickFirstString(row, ["id"]) || "",
      label:
        pickFirstString(row, ["name", "title", "display_name", "label"]) || "",
    }))
    .filter((row) => row.id && row.label);
}

function getAdmissionStateKey(context: ProjectContext): string {
  const projectId = context.projectId || "lms_k12";
  const conversationId = context.conversationId || context.userId || "anonymous";
  return `${projectId}:${conversationId}:confirm_admission`;
}

const admissionStateService = new AdmissionStateService({
  get: async <T>(key: string): Promise<T | null> => getAdmissionState(key) as T | null,
  set: async <T>(key: string, value: T): Promise<void> => {
    await setAdmissionState(key, value as AdmissionConversationState);
  },
  delete: async (key: string): Promise<void> => {
    await deleteAdmissionState(key);
  },
});

const admissionApi = {
  async listStandards(ctx: { subInstituteId: string | number; academicYear: string | number }) {
    return postAdminLookup({} as ProjectContext, "/get_adminStandard", {
      sub_institute_id: String(ctx.subInstituteId),
      grade_id: "",
      token: "",
    });
  },

  async listDivisions(ctx: { standardId: string | number; subInstituteId: string | number; academicYear: string | number }) {
    return postAdminLookup({} as ProjectContext, "/get_adminDivision", {
      sub_institute_id: String(ctx.subInstituteId),
      standard_id: String(ctx.standardId),
      token: "",
    });
  },

  async listStudentQuotas(ctx: { subInstituteId: string | number; academicYear: string | number }) {
    const query = new URLSearchParams();
    query.set("sub_institute_id", String(ctx.subInstituteId));
    query.set("syear", String(ctx.academicYear));
    const payload = await fetchLmsJson({} as ProjectContext, `/api/proxy?path=student-setup/quota&${query.toString()}`);
    const rows = Array.isArray(payload.data)
      ? payload.data.filter(
          (item): item is Record<string, unknown> =>
            typeof item === "object" && item !== null
        )
      : [];
    return rows.map((row) => ({
      id: pickFirstString(row, ["id"]) || "",
      name: pickFirstString(row, ["name"]) || "",
    })).filter((item) => item.id && item.name);
  },

  async getEnquiryDetails(ctx: {
    enquiryId: number;
    subInstituteId: string | number;
    academicYear: string | number;
    token?: string;
  }) {
    try {
      const result = await callBackendMcpTool(
        {
          ...({} as ProjectContext),
          baseUrl: API_BASE_URL,
          subInstituteId: String(ctx.subInstituteId),
          syear: String(ctx.academicYear),
          token: ctx.token,
        } as ProjectContext,
        "admissions.getEnquiryDetails",
        { enquiry_id: ctx.enquiryId }
      );
      const toolResult = result.result && typeof result.result === "object"
        ? (result.result as Record<string, unknown>)
        : {};
      const data = toolResult.data && typeof toolResult.data === "object"
        ? (toolResult.data as Record<string, unknown>)
        : {};
      return data.enquiry && typeof data.enquiry === "object"
        ? (data.enquiry as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  },

  async findRegistrationByEnquiryId(ctx: {
    enquiryId: number;
    subInstituteId: string | number;
    academicYear: string | number;
    token?: string;
  }) {
    try {
      return this.getEnquiryDetails(ctx);
    } catch {
      return null;
    }
  },

  async getStudentByRegistrationId(ctx: {
    registrationId: number;
    subInstituteId: string | number;
    token?: string;
  }) {
    try {
      const result = await callBackendMcpTool(
        {
          ...({} as ProjectContext),
          baseUrl: API_BASE_URL,
          subInstituteId: String(ctx.subInstituteId),
          token: ctx.token,
        } as ProjectContext,
        "students.search",
        { query: String(ctx.registrationId), limit: 1, active_only: false }
      );
      const data = result.result && typeof result.result === "object"
        ? (result.result as Record<string, unknown>)
        : {};
      const students = Array.isArray(data.students) ? data.students : [];
      return students[0] && typeof students[0] === "object"
        ? (students[0] as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  },

  async createRegistration(payload: Record<string, any>): Promise<{ registrationId?: string | number; id?: string | number }> {
    const query = new URLSearchParams();
    query.set("type", "API");
    const body = new URLSearchParams();
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        body.set(key, String(value));
      }
    });
    const response = await fetchLmsJson({} as ProjectContext, `/api/admission_registration?${query.toString()}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: body.toString(),
    });
    return {
      registrationId: pickFirstString(response, ["registrationId", "registration_id", "id"]) ?? undefined,
      id: pickFirstString(response, ["id"]) ?? undefined,
    };
  },

  async confirmAdmission(payload: Record<string, any>) {
    const context = payload.__context as ProjectContext | undefined;
    const confirmationToken =
      typeof payload.confirmation_token === "string"
        ? payload.confirmation_token
        : undefined;
    if (!context) {
      throw new Error("Admission confirmation context is missing.");
    }

    const result = await callBackendMcpTool(
      context,
      "admissions.confirm",
      { enquiry_id: Number(payload.enquiry_id || payload.id || 0) },
      confirmationToken
    );
    const toolResult = result.result && typeof result.result === "object"
      ? (result.result as Record<string, unknown>)
      : result;
    return {
      success: toolResult.success === true,
      message: typeof toolResult.message === "string" ? toolResult.message : "",
      data: toolResult.data,
    };
  },

  async getAdmissionStatusByEnquiryId(ctx: { enquiryId: number; subInstituteId: string | number }): Promise<{ status?: string } | null> {
    try {
      const listPayload = await fetchLmsJson({} as ProjectContext, `/api/admission_enquiry?type=API&sub_institute_id=${ctx.subInstituteId}`);
      const rows = Array.isArray(listPayload.data)
        ? listPayload.data.filter(
            (item): item is Record<string, unknown> =>
              typeof item === "object" && item !== null
          )
        : [];
      const row = rows.find((r) => String(r.id) === String(ctx.enquiryId));
      if (!row) return null;
      const status = pickFirstString(row, ["status"]);
      return status ? { status } : null;
    } catch {
      return null;
    }
  },
};


async function postAdminLookup(
  context: ProjectContext,
  path: string,
  fields: Record<string, string>
) {
  const body = new URLSearchParams();
  Object.entries(fields).forEach(([key, value]) => {
    if (value.trim()) {
      body.set(key, value.trim());
    }
  });

  const payload = await postLmsForm(context, path, body);
  return toAcademicOptions(readOptionRows(payload));
}

async function getAcademicSections(context: ProjectContext) {
  if (!context.subInstituteId) {
    return [] as AcademicOption[];
  }

  return postAdminLookup(context, "/get_adminAcademicSection", {
    sub_institute_id: context.subInstituteId,
    token: context.token || "",
  });
}

async function getStandardsForGrade(context: ProjectContext, gradeId: string) {
  if (!context.subInstituteId || !gradeId) {
    return [] as AcademicOption[];
  }

  return postAdminLookup(context, "/get_adminStandard", {
    sub_institute_id: context.subInstituteId,
    grade_id: gradeId,
    token: context.token || "",
  });
}

async function getDivisionsForStandard(context: ProjectContext, standardId: string) {
  if (!context.subInstituteId || !standardId) {
    return [] as AcademicOption[];
  }

  return postAdminLookup(context, "/get_adminDivision", {
    sub_institute_id: context.subInstituteId,
    standard_id: standardId,
    token: context.token || "",
  });
}

function findAcademicOptionId(
  options: AcademicOption[],
  inputValue: string | null | undefined
) {
  if (!inputValue?.trim()) {
    return "";
  }

  const normalizedInput = normalizeAcademicLabel(inputValue);
  const exact = options.find(
    (option) => normalizeAcademicLabel(option.label) === normalizedInput
  );

  if (exact) {
    return exact.id;
  }

  const partial = options.find((option) =>
    normalizeAcademicLabel(option.label).includes(normalizedInput)
  );

  return partial?.id || "";
}

function normalizeLooseText(value: string | null | undefined) {
  return (value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

function resolveAdmissionOptionValue(
  value: string,
  options: Array<{ value: string; label: string }>
) {
  if (!value.trim()) {
    return "";
  }

  const wanted = normalizeLooseText(value);
  const exact = options.find((option) => {
    return (
      normalizeLooseText(option.label) === wanted ||
      normalizeLooseText(option.value) === wanted
    );
  });

  if (exact) {
    return exact.value;
  }

  const partial = options.find((option) => {
    const label = normalizeLooseText(option.label);
    return label.includes(wanted) || wanted.includes(label);
  });

  return partial?.value || value.trim();
}

function pickFirstString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function pickFirstNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function extractActivityItems(payload: Record<string, unknown>) {
  const candidates = [
    payload.data,
    payload.activities,
    payload.activity_stream,
    payload.activityStream,
    payload.records,
    payload.result,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter(
        (item): item is Record<string, unknown> =>
          typeof item === "object" && item !== null
      );
    }
  }

  const nestedCandidates = Object.values(payload);
  for (const candidate of nestedCandidates) {
    if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) {
      continue;
    }

    const nested = candidate as Record<string, unknown>;
    const nestedArray = [
      nested.data,
      nested.activities,
      nested.activity_stream,
      nested.activityStream,
      nested.records,
      nested.result,
    ].find(Array.isArray);

    if (Array.isArray(nestedArray)) {
      return nestedArray.filter(
        (item): item is Record<string, unknown> =>
          typeof item === "object" && item !== null
      );
    }
  }

  return [];
}

function buildActivityHighlight(item: Record<string, unknown>) {
  const title = pickFirstString(item, [
    "title",
    "activity_title",
    "activity",
    "message",
    "description",
    "remarks",
    "note",
    "name",
  ]);
  const actor = pickFirstString(item, [
    "student_name",
    "user_name",
    "teacher_name",
    "created_by",
    "actor",
    "username",
  ]);
  const subject = pickFirstString(item, [
    "subject_name",
    "subject",
    "module_name",
    "module",
    "category",
  ]);
  const timestamp = pickFirstString(item, [
    "created_at",
    "updated_at",
    "activity_date",
    "date",
    "timestamp",
    "time",
  ]);

  const parts = [title];
  if (actor) {
    parts.push(`by ${actor}`);
  }
  if (subject) {
    parts.push(`in ${subject}`);
  }
  if (timestamp) {
    parts.push(`at ${timestamp}`);
  }

  return parts.filter(Boolean).join(" ");
}

function normalizeActivityStreamPayload(payload: Record<string, unknown>) {
  const items = extractActivityItems(payload);
  const count =
    pickFirstNumber(payload, ["count", "total", "total_count", "recordsTotal"]) ??
    items.length;
  const highlights = items
    .map(buildActivityHighlight)
    .filter((value): value is string => Boolean(value))
    .slice(0, 5);
  const latestTimestamp =
    pickFirstString(payload, ["latest_timestamp", "last_updated", "updated_at"]) ||
    items
      .map((item) =>
        pickFirstString(item, [
          "created_at",
          "updated_at",
          "activity_date",
          "date",
          "timestamp",
          "time",
        ])
      )
      .find((value): value is string => Boolean(value)) ||
    null;

  return {
    count,
    highlights,
    latestTimestamp,
    items: items.slice(0, 10),
  };
}

function normalizeAdmissionStatus(value: unknown) {
  const text = pickFirstString({ value }, ["value"]);
  const status = text?.replace(/[_-]/g, " ").trim();
  if (!status) {
    return "New";
  }
  if (status.toLowerCase() === "approve") {
    return "Approved";
  }

  return status.replace(/\w\S*/g, (word) => word[0].toUpperCase() + word.slice(1).toLowerCase());
}

function isPendingAdmissionStatus(status: string) {
  const normalized = status.toLowerCase();
  return normalized !== "approved" && normalized !== "converted" && normalized !== "closed";
}

function normalizeIsoDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function normalizeAdmissionEnquiryPayload(payload: Record<string, unknown>) {
  const rows = Array.isArray(payload.data)
    ? payload.data.filter(
        (item): item is Record<string, unknown> =>
          typeof item === "object" && item !== null
      )
    : [];

  const enquiries = rows.map((row) => {
    const firstName = pickFirstString(row, ["first_name"]) || "";
    const middleName = pickFirstString(row, ["middle_name"]) || "";
    const lastName = pickFirstString(row, ["last_name"]) || "";
    const studentName = [firstName, middleName, lastName].filter(Boolean).join(" ").trim();
    const standard = pickFirstString(row, ["admission_standard", "standard", "grade"]);
    const status = normalizeAdmissionStatus(row.status);
    const followUpDate = pickFirstString(row, ["followup_date"]);
    const enquiryNo = pickFirstString(row, ["enquiry_no", "id"]);
    const source = pickFirstString(row, ["source_of_enquiry"]);

    return {
      id: pickFirstString(row, ["id"]) || enquiryNo || studentName || "unknown",
      enquiryNo,
      studentName: studentName || `Enquiry ${enquiryNo || "-"}`,
      standard,
      status,
      followUpDate,
      source,
      mobile: pickFirstString(row, ["mobile"]),
      remarks: pickFirstString(row, ["remarks"]),
      createdOn: pickFirstString(row, ["created_on"]),
      activityDate: normalizeIsoDate(
        pickFirstString(row, ["activity_date", "created_on", "followup_date"])
      ),
    };
  });

  const pending = enquiries.filter((entry) => isPendingAdmissionStatus(entry.status));

  return {
    count: enquiries.length,
    pendingCount: pending.length,
    enquiries: enquiries.slice(0, 50),
    pendingEnquiries: pending.slice(0, 20),
    highlights: pending
      .slice(0, 5)
      .map((entry) =>
        [
          entry.studentName,
          entry.standard ? `for Grade ${entry.standard}` : null,
          `status ${entry.status}`,
          entry.followUpDate ? `follow-up ${entry.followUpDate}` : null,
        ]
          .filter(Boolean)
          .join(" ")
      ),
  };
}

function isTruthyRequired(value: unknown) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  return ["1", "true", "yes", "y"].includes(normalized);
}

async function fetchAdmissionRegistrationDetail(
  context: ProjectContext,
  id: string
) {
  const query = buildTrustedQuery(context);
  const payload = await fetchLmsJson(
    context,
    `/api/admission_registration/${encodeURIComponent(id)}/edit?${query.toString()}`
  );

  return payload;
}

function buildAdmissionCandidateFromDetail(
  row: Record<string, unknown>,
  detailPayload: Record<string, unknown> | null
) {
  const detail =
    detailPayload && typeof detailPayload.editData === "object" && detailPayload.editData !== null
      ? (detailPayload.editData as Record<string, unknown>)
      : row;
  const customFields = Array.isArray(detailPayload?.custom_fields)
    ? detailPayload!.custom_fields.filter(
        (item): item is Record<string, unknown> =>
          typeof item === "object" && item !== null
      )
    : [];
  const studentName =
    [
      pickFirstString(detail, ["first_name"]),
      pickFirstString(detail, ["middle_name"]),
      pickFirstString(detail, ["last_name"]),
    ]
      .filter(Boolean)
      .join(" ")
      .trim() || pickFirstString(row, ["studentName"]) || "Unknown student";
  const detailStatus =
    pickFirstString(detail, ["status"]) ||
    pickFirstString(row, ["status"]) ||
    "New";
  const displaySaveStudent = pickFirstString(
    detailPayload || {},
    ["display_save_student"]
  );
  const totalStudentCount = pickFirstNumber(detail, ["total_student_count"]) ?? 0;
  const registrationEnquiryId = pickFirstString(detail, ["registration_enquiry_id"]);
  const enquiryId = pickFirstString(detail, ["enquiry_id", "id"]) || pickFirstString(row, ["id"]);
  const missingSlots = buildAdmissionSlots(detail, detailPayload);
  const missingFields = missingSlots.map((slot) => slot.label);
  customFields.forEach((field) => {
    if (!isTruthyRequired(field.required)) {
      return;
    }
    const fieldName = pickFirstString(field, ["field_name"]);
    const fieldLabel =
      pickFirstString(field, ["field_label", "field_name"]) || "required field";
    if (!fieldName || String(detail[fieldName] ?? "").trim()) {
      return;
    }
    missingFields.push(fieldLabel.replace(/_/g, " "));
  });
  const uniqueMissingFields = Array.from(new Set(missingFields)).slice(0, 8);
  const isAlreadyConfirmed = totalStudentCount > 0;
  const hasBlockingReadinessIssue =
    displaySaveStudent !== "1" && !isAlreadyConfirmed && uniqueMissingFields.length === 0;
  const canConfirm =
    !isAlreadyConfirmed &&
    displaySaveStudent === "1" &&
    uniqueMissingFields.length === 0 &&
    Boolean(registrationEnquiryId || enquiryId || pickFirstString(detail, ["id"]));

  return {
    id: pickFirstString(detail, ["id"]) || pickFirstString(row, ["id"]) || "unknown",
    enquiryId,
    registrationEnquiryId,
    enquiryNo: pickFirstString(detail, ["enquiry_no"]) || pickFirstString(row, ["enquiryNo"]),
    studentName,
    standard:
      pickFirstString(detail, ["std_name", "admission_standard"]) ||
      pickFirstString(row, ["standard"]),
    status: totalStudentCount > 0 ? "Confirmed" : detailStatus,
    followUpDate:
      pickFirstString(detail, ["followup_date"]) ||
      pickFirstString(row, ["followUpDate"]),
    mobileNo: pickFirstString(detail, ["mobile"]),
    canConfirm,
    readiness:
      isAlreadyConfirmed
        ? "already_confirmed"
        : canConfirm
          ? "ready"
          : uniqueMissingFields.length > 0
            ? "missing_fields"
            : "blocked",
    missingFields: uniqueMissingFields,
    missingSlots,
    blockingReason: hasBlockingReadinessIssue
      ? "The backend did not mark this record as ready for confirmation yet."
      : "",
    confirmationPath: `/admissions/confirmation/${pickFirstString(detail, ["id"]) || pickFirstString(row, ["id"])}/follow-up`,
    editPath: `/admissions/registration/${pickFirstString(detail, ["id"]) || pickFirstString(row, ["id"])}/edit`,
    detail,
  };
}

function buildResolvedAdmissionUpdates(
  rawUpdates: Record<string, string>,
  detailPayload: Record<string, unknown> | null
) {
  const detail =
    detailPayload && typeof detailPayload.editData === "object" && detailPayload.editData !== null
      ? (detailPayload.editData as Record<string, unknown>)
      : {};
  const missingSlots = buildAdmissionSlots(detail, detailPayload);
  const parsedFromLabels = parseAdmissionFieldReply(
    Object.entries(rawUpdates)
      .map(([key, value]) => `${key}: ${value}`)
      .join(", "),
    missingSlots.map((slot) => slot.key)
  );
  const slotUpdates = parseAdmissionSlotInput(
    Object.entries({ ...parsedFromLabels, ...rawUpdates })
      .map(([key, value]) => `${key}: ${value}`)
      .join(", "),
    missingSlots
  );
  const normalized = normalizeAdmissionData({
    ...detail,
    ...parsedFromLabels,
    ...rawUpdates,
    ...slotUpdates,
  });

  const standardOptions = Array.isArray(detailPayload?.standard)
    ? detailPayload.standard
        .map((item) => {
          if (!item || typeof item !== "object") {
            return null;
          }
          const option = item as Record<string, unknown>;
          const optionValue = pickFirstString(option, ["id"]);
          const optionLabel = pickFirstString(option, ["name", "title"]);
          return optionValue && optionLabel
            ? { value: optionValue, label: optionLabel }
            : null;
        })
        .filter((item): item is { value: string; label: string } => Boolean(item))
    : [];
  const divisionOptions = Array.isArray(detailPayload?.division)
    ? detailPayload.division
        .map((item) => {
          if (!item || typeof item !== "object") {
            return null;
          }
          const option = item as Record<string, unknown>;
          const optionValue = pickFirstString(option, ["id"]);
          const optionLabel = pickFirstString(option, ["name", "title"]);
          return optionValue && optionLabel
            ? { value: optionValue, label: optionLabel }
            : null;
        })
        .filter((item): item is { value: string; label: string } => Boolean(item))
    : [];
  const quotaOptions = Array.isArray(detailPayload?.category)
    ? detailPayload.category
        .map((item) => {
          if (!item || typeof item !== "object") {
            return null;
          }
          const option = item as Record<string, unknown>;
          const optionValue = pickFirstString(option, ["id"]);
          const optionLabel = pickFirstString(option, ["title", "name"]);
          return optionValue && optionLabel
            ? { value: optionValue, label: optionLabel }
            : null;
        })
        .filter((item): item is { value: string; label: string } => Boolean(item))
    : [];

  const resolvedUpdates: Record<string, string> = {};
  const firstName = pickFirstString(normalized, ["first_name", "firstName"]);
  const middleName = pickFirstString(normalized, ["middle_name", "middleName"]);
  const lastName = pickFirstString(normalized, ["last_name", "lastName"]);
  const dateOfBirth = pickFirstString(normalized, ["date_of_birth", "dateOfBirth"]);
  const admissionDate = pickFirstString(normalized, ["admission_date", "admissionDate"]);
  const mobile = pickFirstString(normalized, ["mobile"]);
  const standardValue =
    pickFirstString(normalized, ["admission_standard"]) ||
    pickFirstString(normalized, ["standardId", "standard_id"]) ||
    pickFirstString(normalized, ["standardName", "standard_name"]);
  const divisionValue =
    pickFirstString(normalized, ["admission_division"]) ||
    pickFirstString(normalized, ["divisionId", "division_id"]) ||
    pickFirstString(normalized, ["divisionName", "division_name"]);
  const quotaValue =
    pickFirstString(normalized, ["student_quota"]) ||
    pickFirstString(normalized, ["studentQuotaId", "student_quota_id"]) ||
    pickFirstString(normalized, ["studentQuotaName", "student_quota_name"]);

  if (firstName) resolvedUpdates.first_name = firstName;
  if (middleName) resolvedUpdates.middle_name = middleName;
  if (lastName) resolvedUpdates.last_name = lastName;
  if (dateOfBirth) resolvedUpdates.date_of_birth = dateOfBirth;
  if (admissionDate) resolvedUpdates.admission_date = admissionDate;
  if (mobile) resolvedUpdates.mobile = mobile;
  if (standardValue) {
    resolvedUpdates.admission_standard = resolveAdmissionOptionValue(
      standardValue,
      standardOptions
    );
  }
  if (divisionValue) {
    resolvedUpdates.admission_division = resolveAdmissionOptionValue(
      divisionValue,
      divisionOptions
    );
  }
  if (quotaValue) {
    resolvedUpdates.student_quota = resolveAdmissionOptionValue(
      quotaValue,
      quotaOptions
    );
  }

  return resolvedUpdates;
}

function normalizeStudentRows(rows: Array<Record<string, unknown>>) {
  return rows.map((row) => ({
    id: pickFirstString(row, ["id", "student_id"]) || "unknown",
    studentName:
      pickFirstString(row, ["student_name", "name", "full_name"]) || "Unknown student",
    enrollmentNo: pickFirstString(row, ["enrollment_no", "grno"]),
    rollNo: pickFirstString(row, ["roll_no"]),
    mobileNo: pickFirstString(row, ["mobile"]),
    standard: pickFirstString(row, ["standard_name", "standard"]),
    division: pickFirstString(row, ["division_name", "division"]),
    grade: pickFirstString(row, ["grade", "grade_name"]),
    pendingFees:
      pickFirstNumber(row, ["pending", "pending_fees", "bkoff", "remain", "outstanding"]) ?? 0,
  }));
}

function filterStudentRows(
  rows: Array<Record<string, unknown>>,
  input: {
    studentName?: string;
    rollNo?: string;
    enrollmentNo?: string;
    mobileNo?: string;
    standard?: string;
    division?: string;
  }
) {
  const normalizedRows = normalizeStudentRows(rows);

  return normalizedRows.filter((row) => {
    if (
      input.studentName?.trim() &&
      !row.studentName.toLowerCase().includes(input.studentName.trim().toLowerCase())
    ) {
      return false;
    }

    if (input.rollNo?.trim() && (row.rollNo || "").trim() !== input.rollNo.trim()) {
      return false;
    }

    if (
      input.enrollmentNo?.trim() &&
      (row.enrollmentNo || "").trim() !== input.enrollmentNo.trim()
    ) {
      return false;
    }

    if (input.mobileNo?.trim() && (row.mobileNo || "").trim() !== input.mobileNo.trim()) {
      return false;
    }

    if (
      input.standard?.trim() &&
      normalizeAcademicLabel(row.standard) !== normalizeAcademicLabel(input.standard)
    ) {
      return false;
    }

    if (
      input.division?.trim() &&
      normalizeAcademicLabel(row.division) !== normalizeAcademicLabel(input.division)
    ) {
      return false;
    }

    return true;
  });
}

async function resolveAcademicIds(
  context: ProjectContext,
  input: {
    grade?: string;
    standard?: string;
    division?: string;
  }
) {
  const resolved: { grade: string; standard: string; division: string } = {
    grade: hasExplicitBackendId(input.grade) ? readExplicitBackendId(input.grade) : "",
    standard: hasExplicitBackendId(input.standard)
      ? readExplicitBackendId(input.standard)
      : "",
    division: hasExplicitBackendId(input.division)
      ? readExplicitBackendId(input.division)
      : "",
  };

  logAiDebug("resolveAcademicIds.start", {
    userId: context.userId,
    subInstituteId: context.subInstituteId,
    syear: context.syear,
    input,
  });

  if (!context.token || !context.subInstituteId) {
    logAiDebug("resolveAcademicIds.skipped", {
      reason: "missing-session-context",
      resolved,
    });
    return resolved;
  }

  try {
    if (!resolved.grade && input.grade?.trim()) {
      const sections = await getAcademicSections(context);
      resolved.grade = findAcademicOptionId(sections, input.grade);
    }

    if (!resolved.standard && input.standard?.trim() && resolved.grade) {
      const standards = await getStandardsForGrade(context, resolved.grade);
      resolved.standard = findAcademicOptionId(standards, input.standard);
    }

    if (!resolved.division && input.division?.trim() && resolved.standard) {
      const divisions = await getDivisionsForStandard(context, resolved.standard);
      resolved.division = findAcademicOptionId(divisions, input.division);
    }
  } catch (error) {
    logAiDebug("resolveAcademicIds.lookup_failed", {
      input,
      message: error instanceof Error ? error.message : String(error || ""),
    });
  }

  logAiDebug("resolveAcademicIds.complete", {
    input,
    resolved,
  });

  return resolved;
}

async function getLmsDashboard(
  input: z.infer<typeof lmsDashboardInputSchema>,
  context: ProjectContext
) {
  const userId = input.userId || context.userId;
  const userProfile =
    input.userProfile || context.profileName || context.role || "Student";

  if (!userId) {
    throw new Error("The current LMS session does not include a user ID.");
  }

  const url = new URL("/lms/lmsdashboard", context.baseUrl);
  url.searchParams.set("type", "API");
  url.searchParams.set("sub_institute_id", context.subInstituteId || "");
  url.searchParams.set("syear", context.syear || "");
  url.searchParams.set("user_id", userId);
  url.searchParams.set("user_profile", userProfile);

  return fetchLmsJson(context, `${url.pathname}${url.search}`);
}

async function getActivityStream(_: unknown, context: ProjectContext) {
  const url = new URL("/lms/lmsActivityStream", context.baseUrl);
  url.searchParams.set("type", "API");
  url.searchParams.set("sub_institute_id", context.subInstituteId || "");
  url.searchParams.set("syear", context.syear || "");
  url.searchParams.set("user_id", context.userId || "");
  url.searchParams.set("user_profile", context.profileName || context.role || "");
  if (context.profileId) {
    url.searchParams.set("user_profile_id", context.profileId);
  }
  if (context.termId) {
    url.searchParams.set("term_id", context.termId);
  }

  const payload = await fetchLmsJson(context, `${url.pathname}${url.search}`);
  return {
    source: "lms_backend",
    normalized: normalizeActivityStreamPayload(payload),
    payload,
  };
}

async function listHomework(
  input: z.infer<typeof homeworkListInputSchema>,
  context: ProjectContext
) {
  return fetchLmsJson(context, "/api/lms-homework/list", {
    method: "POST",
    body: JSON.stringify({
      type: "Homework",
      sub_institute_id: Number(context.subInstituteId || 0),
      syear: Number(context.syear || 0),
      user_id: Number(context.userId || 0),
      user_profile_name: context.profileName || "",
      user_name: context.profileName || "",
      grade: input.grade || null,
      standard_id: input.standard || null,
      division_id: input.division || null,
      subject_id: input.subject || null,
      from_date: input.fromDate || null,
      to_date: input.toDate || null,
    }),
  });
}

async function listFeesDefaulters(
  input: z.infer<typeof feesDefaulterInputSchema>,
  context: ProjectContext
) {
  const academicIds = await resolveAcademicIds(context, {
    grade: input.grade,
    standard: input.standard,
    division: input.division,
  });
  const body = new URLSearchParams();
  if (academicIds.grade) body.set("grade", academicIds.grade);
  if (academicIds.standard) body.set("standard", academicIds.standard);
  if (academicIds.division) body.set("division", academicIds.division);
  if (input.firstName) body.set("first_name", input.firstName);
  if (input.lastName) body.set("last_name", input.lastName);
  if (input.enrollmentNo) body.set("enrollment_no", input.enrollmentNo);
  if (input.mobileNo) body.set("mobile_no", input.mobileNo);
  if (input.uniqueId) body.set("uniqueid", input.uniqueId);

  logAiDebug("listFeesDefaulters.request", {
    originalInput: input,
    resolvedAcademicIds: academicIds,
    payload: Object.fromEntries(body.entries()),
  });

  const query = buildTrustedQuery(context);
  const payload = await postLmsForm(context, `/fees/fees_defaulter_report?${query.toString()}`, body);
  const feesData =
    payload.fees_data && typeof payload.fees_data === "object" && !Array.isArray(payload.fees_data)
      ? Object.values(payload.fees_data as Record<string, unknown>)
      : [];

  const students = feesData
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((row) => {
      const stddiv = pickFirstString(row, ["stddiv"]) || "";
      const [standard = "", division = ""] = stddiv
        .split(/[-/]/)
        .map((value) => value.trim());

      const totalRow =
        typeof row["-"] === "object" && row["-"] !== null
          ? (row["-"] as Record<string, unknown>)
          : null;

      return {
        id: pickFirstString(row, ["student_id", "id", "enrollment"]) || "unknown",
        studentName: pickFirstString(row, ["name", "student_name"]) || "Unknown student",
        standard,
        division,
        enrollmentNo: pickFirstString(row, ["enrollment"]),
        mobileNo: pickFirstString(row, ["mobile"]),
        pendingFees: pickFirstNumber(totalRow || {}, ["remain", "bk"]) || 0,
      };
    })
    .filter((row) => {
      if (
        input.standard?.trim() &&
        normalizeAcademicLabel(row.standard) !== normalizeAcademicLabel(input.standard)
      ) {
        return false;
      }
      if (
        input.division?.trim() &&
        normalizeAcademicLabel(row.division) !== normalizeAcademicLabel(input.division)
      ) {
        return false;
      }
      return true;
    });

  return {
    source: "lms_backend",
    students: students.slice(0, 25),
    totalCount: students.length,
    payload,
  };
}

async function searchStudents(
  input: z.infer<typeof studentSearchInputSchema>,
  context: ProjectContext
) {
  const payload = await fetchLmsJson(context, "/api/lms-homework/students", {
    method: "POST",
    body: JSON.stringify({
      sub_institute_id: Number(context.subInstituteId || 0),
      syear: Number(context.syear || 0),
      grade: input.grade || null,
      standard: input.standard || null,
      division: input.division || null,
    }),
  });

  const rows = Array.isArray(payload.data)
    ? payload.data.filter(
        (item): item is Record<string, unknown> =>
          typeof item === "object" && item !== null
      )
    : [];

  const filtered = filterStudentRows(rows, input);

  return {
    source: "lms_backend",
    students: filtered.slice(0, 25),
    totalCount: filtered.length,
    payload,
  };
}

async function findStudentFeeRecord(
  input: z.infer<typeof studentFeeRecordInputSchema>,
  context: ProjectContext
) {
  const academicIds = await resolveAcademicIds(context, {
    grade: input.grade,
    standard: input.standard,
    division: input.division,
  });
  const body = new URLSearchParams();
  body.set("type", "API");
  body.set("sub_institute_id", context.subInstituteId || "");
  body.set("syear", context.syear || "");
  if (input.studentName) body.set("stu_name", input.studentName);
  if (academicIds.grade) body.set("grade", academicIds.grade);
  if (academicIds.standard) body.set("standard", academicIds.standard);
  if (academicIds.division) body.set("division", academicIds.division);
  if (input.enrollmentNo) body.set("grno", input.enrollmentNo);
  if (input.mobileNo) body.set("mobile", input.mobileNo);
  if (input.uniqueId) body.set("uniqueid", input.uniqueId);

  logAiDebug("findStudentFeeRecord.request", {
    originalInput: input,
    resolvedAcademicIds: academicIds,
    payload: Object.fromEntries(body.entries()),
  });

  const payload = await postLmsForm(context, "/fees/fees_collect/show_student", body);
  const rows = Array.isArray(payload.stu_data)
    ? payload.stu_data.filter(
        (item): item is Record<string, unknown> =>
          typeof item === "object" && item !== null
      )
    : [];

  const normalized = filterStudentRows(rows, {
    studentName: input.studentName,
    rollNo: input.rollNo,
    enrollmentNo: input.enrollmentNo,
    mobileNo: input.mobileNo,
    standard: input.standard,
    division: input.division,
  });

  const enrichedInput =
    normalized.length === 1
      ? {
          studentName: normalized[0].studentName || input.studentName,
          standard: normalized[0].standard || input.standard,
          division: normalized[0].division || input.division,
          enrollmentNo: normalized[0].enrollmentNo || input.enrollmentNo,
          rollNo: normalized[0].rollNo || input.rollNo,
          mobileNo: normalized[0].mobileNo || input.mobileNo,
          studentId: normalized[0].id || "",
          academicYear: context.syear || "",
        }
      : {
          studentName: input.studentName,
          standard: input.standard,
          division: input.division,
          enrollmentNo: input.enrollmentNo,
          rollNo: input.rollNo,
          mobileNo: input.mobileNo,
          academicYear: context.syear || "",
        };

  logAiDebug("findStudentFeeRecord.resolved", {
    originalInput: input,
    enrichedInput,
    matchedStudents: normalized.slice(0, 3),
  });

  return {
    source: "lms_backend",
    students: normalized.slice(0, 10),
    totalCount: normalized.length,
    originalInput: enrichedInput,
    payload,
  };
}

async function getStudentFeeDetails(
  input: z.infer<typeof studentFeeDetailsInputSchema>,
  context: ProjectContext
) {
  const result = await callBackendMcpTool(context, "fees.getPending", {
    student_id: Number(input.studentId),
  });
  return result.result && typeof result.result === "object"
    ? result.result
    : result;
}

async function getTeacherDailyReport(
  input: z.infer<typeof teacherDailyReportInputSchema>,
  context: ProjectContext
) {
  const date =
    input.date || new Date().toISOString().slice(0, 10);

  return fetchLmsJson(context, "/api/teacher-daily-reports/search", {
    method: "POST",
    body: JSON.stringify({
      sub_institute_id: Number(context.subInstituteId || 0),
      syear: Number(context.syear || 0),
      user_id: Number(context.userId || 0),
      date,
      status: input.status || undefined,
    }),
  });
}

async function getResultReport(
  input: z.infer<typeof resultReportInputSchema>,
  context: ProjectContext
) {
  return fetchLmsJson(context, "/api/result/result-report/show", {
    method: "POST",
    body: JSON.stringify({
      report_of: input.reportOf,
      grade: input.grade || "",
      standard: input.standard || "",
      division: input.division || "",
      term: input.term || "",
      subject: input.subject || "",
      exam_type: input.examType || "",
      exam_create: input.examCreate || "",
      top_students: input.topStudents || "",
      roll_no: input.rollNo || "",
      from_date: input.fromDate || "",
      to_date: input.toDate || "",
      additional_subjects: input.additionalSubjects || [],
      sub_institute_id: Number(context.subInstituteId || 0),
      syear: Number(context.syear || 0),
      user_id: Number(context.userId || 0),
    }),
  });
}

async function listAdmissionEnquiries(
  input: z.infer<typeof admissionEnquiryInputSchema>,
  context: ProjectContext
) {
  const result = await callBackendMcpTool(context, "admissions.listEnquiries", {
    search_text: input.searchText || undefined,
    only_pending: input.onlyPending ?? false,
    limit: 50,
  });
  const toolResult = result.result && typeof result.result === "object"
    ? (result.result as Record<string, unknown>)
    : {};
  const data = toolResult.data && typeof toolResult.data === "object"
    ? (toolResult.data as Record<string, unknown>)
    : {};
  const rawRows = Array.isArray(data.enquiries)
    ? data.enquiries.map((entry) =>
        typeof entry === "object" && entry !== null
          ? {
              id: String((entry as Record<string, unknown>).enquiry_id ?? ""),
              enquiryNo: String((entry as Record<string, unknown>).enquiry_no ?? ""),
              studentName: String((entry as Record<string, unknown>).student_name ?? ""),
              standard: String((entry as Record<string, unknown>).standard_name ?? ""),
              status: String((entry as Record<string, unknown>).status ?? ""),
              followUpDate: String((entry as Record<string, unknown>).followup_date ?? ""),
              mobile: String((entry as Record<string, unknown>).mobile ?? ""),
              activityDate: null,
              source: "",
              remarks: "",
            }
          : null
      ).filter(Boolean)
    : [];
  const dedupedMap = new Map<string, any>();
  for (const row of rawRows as Array<any>) {
    const dedupeKey = String(row.id || row.enquiryNo || "").trim();
    if (!dedupeKey) {
      continue;
    }
    if (!dedupedMap.has(dedupeKey)) {
      dedupedMap.set(dedupeKey, row);
    }
  }
  const rows = Array.from(dedupedMap.values());
  const normalized = {
    count: rows.length,
    pendingCount: rows.length,
    enquiries: rows as Array<any>,
    pendingEnquiries: rows as Array<any>,
    highlights: (rows as Array<any>).slice(0, 5).map((entry) => {
      const parts = [
        entry.studentName,
        entry.standard ? `for Grade ${entry.standard}` : null,
        `— Status: ${entry.status}`,
        entry.followUpDate ? `(Follow-up: ${entry.followUpDate})` : null,
      ];
      return parts.filter(Boolean).join(" ");
    }),
  };

  let filtered = normalized.enquiries;
  if (input.onlyPending) {
    filtered = filtered.filter((entry) => isPendingAdmissionStatus(entry.status));
  }
  if (input.status?.trim()) {
    const wanted = input.status.trim().toLowerCase();
    filtered = filtered.filter((entry) => entry.status.toLowerCase() === wanted);
  }
  if (input.standard?.trim()) {
    const wanted = input.standard.trim().toLowerCase();
    filtered = filtered.filter((entry) => (entry.standard || "").toLowerCase() === wanted);
  }
  if (input.searchText?.trim()) {
    const wanted = input.searchText.trim().toLowerCase();
    filtered = filtered.filter((entry) =>
      [
        entry.studentName,
        entry.enquiryNo,
        entry.status,
        entry.standard,
        entry.source,
        entry.remarks,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(wanted)
    );
  }
  if (input.fromDate?.trim()) {
    filtered = filtered.filter((entry) => {
      const createdDate = entry.activityDate;
      return Boolean(createdDate && createdDate >= input.fromDate!.trim());
    });
  }
  if (input.toDate?.trim()) {
    filtered = filtered.filter((entry) => {
      const createdDate = entry.activityDate;
      return Boolean(createdDate && createdDate <= input.toDate!.trim());
    });
  }

  const candidates = filtered.map((entry) => ({
    enquiryId: Number(entry.id || entry.enquiryNo || 0),
    enquiryNo: entry.enquiryNo || undefined,
    fullName: entry.studentName || "Unknown student",
    mobile: entry.mobile || undefined,
    standardId: undefined,
    standardName: entry.standard || undefined,
    status: entry.status || undefined,
  }));

  const stateKey = getAdmissionStateKey(context);
  const state = await admissionStateService.get(stateKey);
  state.workflow = "confirm_admission";
  state.stage = "awaiting_candidate_selection";
  state.candidates = candidates;
  state.lastTool = "listAdmissionEnquiries";
  await admissionStateService.save(stateKey, state);

  return {
    source: "lms_backend",
    total: candidates.length,
    candidates: candidates.slice(0, 50),
    normalized: {
      ...normalized,
      filteredCount: filtered.length,
      filteredEnquiries: filtered.slice(0, 20),
      filteredHighlights: filtered
        .slice(0, 5)
        .map((entry) => {
          const parts = [
            entry.studentName,
            entry.standard ? `for Grade ${entry.standard}` : null,
            `— Status: ${entry.status}`,
            entry.followUpDate ? `(Follow-up: ${entry.followUpDate})` : null,
          ];
          return parts.filter(Boolean).join(" ");
        }),
    },
    payload: result,
  };
}

async function hydrateAdmissionCandidate(
  input: z.infer<typeof admissionHydrateInputSchema>,
  context: ProjectContext
) {
  const stateKey = getAdmissionStateKey(context);
  const state = await admissionStateService.get(stateKey);

  if (!state.enquiryId) {
    return {
      source: "lms_backend",
      status: "error",
      message: "No admission enquiry was selected. Please list pending admissions first.",
    };
  }

  const enquiryId = Number(input.enquiryId) || state.enquiryId;

  try {
    const hydrated = await hydrateAdmissionCandidateFromEnquiry(
      {
        enquiryId,
        subInstituteId: context.subInstituteId || 0,
        academicYear: context.syear || 0,
        token: context.token,
        userId: context.userId,
      },
      { admissionApi }
    );

    state.hydratedData = hydrated;
    state.registrationId = hydrated.registrationId ? Number(hydrated.registrationId) : undefined;
    state.studentId = hydrated.studentId ? Number(hydrated.studentId) : undefined;
  } catch (error) {
    state.stage = "awaiting_candidate_selection";
    state.lastError = error instanceof Error ? error.message : String(error);
    await admissionStateService.save(stateKey, state);

    return {
      source: "lms_backend",
      status: "error",
      message: `I couldn't load the full admission details. ${state.lastError}`,
    };
  }

  const merged = {
    ...state.hydratedData,
    ...state.collectedFields,
  };

  const missingFields = getMissingAdmissionFields(merged);
  state.missingFields = missingFields;

  if (missingFields.length === 0) {
    const preview = await callBackendMcpTool(context, "admissions.confirm", {
      enquiry_id: state.enquiryId,
    });
    state.stage = "awaiting_confirmation";
    state.pendingAction = {
      name: "confirmAdmission",
      payload: buildAdmissionConfirmationPayload(merged),
      idempotencyKey: `confirm-admission:${state.enquiryId}`,
      confirmationToken:
        preview.confirmation && typeof preview.confirmation === "object"
          ? String((preview.confirmation as Record<string, unknown>).token ?? "")
          : undefined,
    };
  } else {
    state.stage = "collecting_missing_fields";
  }

  state.lastTool = "hydrateAdmissionCandidate";
  await admissionStateService.save(stateKey, state);

  return {
    source: "lms_backend",
    status: missingFields.length === 0 ? "ready_for_confirmation" : "missing_fields",
    data: {
      enquiryId: state.enquiryId,
      registrationId: state.registrationId,
      studentId: state.studentId,
      fullName: state.selectedCandidate?.fullName || merged.fullName || "Unknown student",
      enquiryNo: merged.enquiryNo || state.selectedCandidate?.enquiryNo || String(state.enquiryId),
      mobile: merged.mobile || state.selectedCandidate?.mobile || "N/A",
      standardName: merged.standardName || state.selectedCandidate?.standardName || "N/A",
      divisionName: merged.divisionName || "N/A",
      studentQuotaName: merged.studentQuotaName || "N/A",
      status: merged.status || state.selectedCandidate?.status || "New",
      missingFields,
      confirmationPayload: state.pendingAction?.payload || {},
    },
  };
}

async function findAdmissionCandidate(
  input: z.infer<typeof admissionCandidateInputSchema>,
  context: ProjectContext
) {
  const stateKey = getAdmissionStateKey(context);
  const state = await admissionStateService.get(stateKey);

  if (state.enquiryId && state.selectedCandidate) {
    const candidate = state.selectedCandidate;
    const summaryRow = {
      id: String(candidate.enquiryId),
      enquiryNo: candidate.enquiryNo,
      studentName: candidate.fullName,
      standard: candidate.standardName,
      status: candidate.status,
      mobile: candidate.mobile,
    };

    let detailPayload: Record<string, unknown> | null = null;
    try {
      detailPayload = await fetchAdmissionRegistrationDetail(
        context,
        String(candidate.enquiryId)
      );
    } catch {
      detailPayload = null;
    }

    const detailedCandidate = buildAdmissionCandidateFromDetail(
      summaryRow,
      detailPayload
    );

    return {
      source: "conversation_state",
      candidates: [detailedCandidate as Record<string, unknown>],
      totalCount: 1,
    };
  }

  const parsed = parseCandidateReference(
    input.studentName || input.enquiryNo || input.mobileNo || "",
    {
      fullName: input.studentName,
      mobile: input.mobileNo,
      enquiryNo: input.enquiryNo,
      standard: input.standard,
    }
  );

  const localMatches = matchSavedCandidates(state.candidates, parsed);

  if (localMatches.length === 1) {
    const candidate = localMatches[0];
    state.selectedCandidate = candidate;
    state.enquiryId = candidate.enquiryId;
    state.stage = "hydrating_candidate";
    state.lastTool = "findAdmissionCandidate";
    await admissionStateService.save(stateKey, state);

    const summaryRow = {
      id: String(candidate.enquiryId),
      enquiryNo: candidate.enquiryNo,
      studentName: candidate.fullName,
      standard: candidate.standardName,
      status: candidate.status,
      mobile: candidate.mobile,
    };

    let detailPayload: Record<string, unknown> | null = null;
    let hydrated: Record<string, unknown> | null = null;

    try {
      [detailPayload, hydrated] = await Promise.all([
        fetchAdmissionRegistrationDetail(
          context,
          String(candidate.enquiryId)
        ).catch(() => null as Record<string, unknown> | null),
        hydrateAdmissionCandidateFromEnquiry(
          {
            enquiryId: candidate.enquiryId,
            subInstituteId: context.subInstituteId || 0,
            academicYear: context.syear || 0,
            token: context.token,
            userId: context.userId,
          },
          { admissionApi }
        ).catch(() => null as Record<string, unknown> | null),
      ]);
    } catch {
      detailPayload = null;
      hydrated = null;
    }

    const detailedCandidate = buildAdmissionCandidateFromDetail(
      summaryRow,
      detailPayload
    );

    if (hydrated) {
      state.hydratedData = hydrated;
      state.registrationId = hydrated.registrationId
        ? Number(hydrated.registrationId)
        : undefined;
      state.studentId = hydrated.studentId
        ? Number(hydrated.studentId)
        : undefined;

      const merged = { ...state.hydratedData, ...state.collectedFields };
      const missingFields = getMissingAdmissionFields(merged);
      state.missingFields = missingFields;

      if (missingFields.length === 0) {
        try {
          const preview = await callBackendMcpTool(context, "admissions.confirm", {
            enquiry_id: state.enquiryId,
          });

          state.stage = "awaiting_confirmation";
          state.pendingAction = {
            name: "confirmAdmission",
            payload: buildAdmissionConfirmationPayload(merged),
            idempotencyKey: `confirm-admission:${state.enquiryId}`,
            confirmationToken:
              preview.confirmation && typeof preview.confirmation === "object"
                ? String(
                    (preview.confirmation as Record<string, unknown>)
                      .token as string | undefined
                  ) || undefined
                : undefined,
          };
        } catch {
          state.stage = "awaiting_confirmation";
          state.pendingAction = {
            name: "confirmAdmission",
            payload: buildAdmissionConfirmationPayload(merged),
            idempotencyKey: `confirm-admission:${state.enquiryId}`,
          };
        }
      } else {
        state.stage = "collecting_missing_fields";
      }
    }

    await admissionStateService.save(stateKey, state);

    return {
      source: "hydrated_candidate",
      candidates: [detailedCandidate as Record<string, unknown>],
      totalCount: 1,
    };
  }

  if (localMatches.length > 1) {
    return {
      source: "saved_candidate_list",
      candidates: localMatches.map((candidate) => ({
        id: String(candidate.enquiryId),
        enquiryId: String(candidate.enquiryId),
        studentName: candidate.fullName,
        standard: candidate.standardName,
        status: candidate.status || "New",
        canConfirm: false,
        readiness: "blocked",
        missingFields: [],
        missingSlots: [],
        detail: null,
      }) as Record<string, unknown>),
      totalCount: localMatches.length,
    };
  }

  const enquiryResult = await listAdmissionEnquiries(
    {
      onlyPending: input.onlyPending ?? true,
      standard: input.standard,
      searchText: input.studentName || input.enquiryNo || input.mobileNo,
    },
    context
  );

  const sourceRows =
    enquiryResult.normalized?.filteredEnquiries ||
    enquiryResult.normalized?.pendingEnquiries ||
    enquiryResult.normalized?.enquiries ||
    [];

  const rows = Array.isArray(sourceRows)
    ? sourceRows.filter(
        (item) => typeof item === "object" && item !== null
      ) as Array<Record<string, unknown>>
    : [];

  const filtered = rows.filter((row) => {
    if (
      input.studentName?.trim() &&
      !String(row.studentName || "")
        .toLowerCase()
        .includes(input.studentName.trim().toLowerCase())
    ) {
      return false;
    }

    if (
      input.enquiryNo?.trim() &&
      String(row.enquiryNo || "").trim() !== input.enquiryNo.trim()
    ) {
      return false;
    }

    if (
      input.mobileNo?.trim() &&
      String(row.mobile || "").trim() !== input.mobileNo.trim()
    ) {
      return false;
    }

    return true;
  });

  const backendCandidates: AdmissionCandidateSummary[] = filtered.map((row) => ({
    enquiryId: Number(row.id || row.enquiryNo || 0),
    enquiryNo: typeof row.enquiryNo === "string" ? row.enquiryNo : undefined,
    fullName: typeof row.studentName === "string" ? row.studentName : "Unknown student",
    mobile: typeof row.mobile === "string" ? row.mobile : undefined,
    standardId: undefined,
    standardName: typeof row.standard === "string" ? row.standard : undefined,
    status: typeof row.status === "string" ? row.status : undefined,
  }));

  const backendMatches = matchSavedCandidates(backendCandidates, parsed);

  if (backendMatches.length === 1) {
    const candidate = backendMatches[0];
    state.selectedCandidate = candidate;
    state.enquiryId = candidate.enquiryId;
    state.stage = "hydrating_candidate";
    state.lastTool = "findAdmissionCandidate";
    await admissionStateService.save(stateKey, state);
  } else if (backendMatches.length > 1) {
    state.candidates = backendCandidates;
    state.stage = "awaiting_candidate_selection";
    state.lastTool = "findAdmissionCandidate";
    await admissionStateService.save(stateKey, state);
  }

  const detailedCandidates = await Promise.all(
    filtered.slice(0, 10).map(async (row) => {
      try {
        const detailPayload = await fetchAdmissionRegistrationDetail(
          context,
          String(row.id || "")
        );
        return buildAdmissionCandidateFromDetail(row, detailPayload);
      } catch {
        return buildAdmissionCandidateFromDetail(row, null);
      }
    })
  );

  return {
    source: "lms_backend",
    candidates: detailedCandidates,
    totalCount: detailedCandidates.length,
  };
}

async function updateAdmissionCandidateDetails(
  input: z.infer<typeof admissionUpdateInputSchema>,
  context: ProjectContext
) {
  let currentDetailPayload: Record<string, unknown> | null = null;
  try {
    currentDetailPayload = await fetchAdmissionRegistrationDetail(context, input.id);
  } catch {
    currentDetailPayload = null;
  }

  const resolvedUpdates = buildResolvedAdmissionUpdates(
    input.updates,
    currentDetailPayload
  );
  const body = new URLSearchParams();
  body.set("type", "API");
  body.set("sub_institute_id", context.subInstituteId || "");
  body.set("syear", context.syear || "");
  if (context.userId) {
    body.set("user_id", context.userId);
  }

  Object.entries(resolvedUpdates).forEach(([key, value]) => {
    if (value.trim()) {
      body.set(key, value.trim());
    }
  });

  await fetchLmsJson(
    context,
    `/api/admission_registration/${encodeURIComponent(input.id)}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: body.toString(),
    }
  );

  let detailPayload: Record<string, unknown> | null = null;
  try {
    detailPayload = await fetchAdmissionRegistrationDetail(context, input.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "");
    if (
      /record not found/i.test(message) &&
      (input.studentName || input.enquiryNo || input.mobileNo)
    ) {
      const fallback = await findAdmissionCandidate(
        {
          studentName: input.studentName,
          enquiryNo: input.enquiryNo,
          mobileNo: input.mobileNo,
          standard: input.standard,
          onlyPending: true,
        },
        context
      );
      const fallbackCandidate = Array.isArray(fallback.candidates)
        ? fallback.candidates[0]
        : null;
      if (fallbackCandidate) {
        return {
          source: "lms_backend",
          candidate: fallbackCandidate,
          updates: resolvedUpdates,
          recoveredFromRefreshFailure: true,
        };
      }
    }

    throw error;
  }

  const candidate = buildAdmissionCandidateFromDetail({ id: input.id }, detailPayload);
  return {
    source: "lms_backend",
    candidate,
    updates: resolvedUpdates,
  };
}

async function confirmAdmissionCandidate(
  input: z.infer<typeof admissionConfirmInputSchema>,
  context: ProjectContext
) {
  const stateKey = getAdmissionStateKey(context);
  const state = await admissionStateService.get(stateKey);

  if (state.pendingAction && state.pendingAction.name === "confirmAdmission") {
    const result = await executePendingAdmissionAction(state, {
      stateService: admissionStateService,
      stateKey,
      admissionApi,
      auth: {
        subInstituteId: context.subInstituteId || 0,
        academicYear: context.syear || 0,
        userId: context.userId || 0,
        userProfileId: context.profileId,
        token: context.token,
      },
    });

    if (result.status === "already_completed") {
      return {
        source: "lms_backend",
        id: input.id,
        enquiryId: state.enquiryId,
        registrationEnquiryId: state.registrationId,
        payload: result.data,
        message: result.message,
      };
    }

    if (result.status === "completed") {
      return {
        source: "lms_backend",
        id: input.id,
        enquiryId: state.enquiryId,
        registrationEnquiryId: state.registrationId,
        payload: result.data,
        message: result.message,
      };
    }

    if (result.status === "failed") {
      throw new Error(result.message);
    }
  }

  const body = new URLSearchParams();
  body.set("type", "API");
  body.set("sub_institute_id", context.subInstituteId || "");
  body.set("syear", context.syear || "");
  body.set(
    "id",
    input.registrationEnquiryId || input.enquiryId || input.id
  );
  if (input.termId || context.termId) {
    body.set("term_id", input.termId || context.termId || "");
  }

  const payload = await postLmsForm(context, "/api/admission_student?type=API", body);
  return {
    source: "lms_backend",
    id: input.id,
    enquiryId: input.enquiryId,
    registrationEnquiryId: input.registrationEnquiryId,
    payload,
  };
}

async function getContextualSuggestions(
  input: z.infer<typeof contextualSuggestionsSchema>,
  context: ProjectContext
) {
  const route = input.context || context.route || "dashboard";
  const moduleName = input.module || route.split("/").filter(Boolean)[0] || "lms";
  const profile = context.profileName || context.role || "User";

  const suggestions = [
    `You are in the ${moduleName} module.`,
    isStudentProfile(profile)
      ? "Ask about your dashboard, activity stream, homework, or learning progress."
      : isTeacherProfile(profile)
        ? "Ask about class activity, homework, or learner progress."
        : "Ask about dashboard insights, activities, homework, or learning workflows.",
    route !== "dashboard" ? `Current route context: ${route}.` : "Current route context: dashboard.",
  ];

  return {
    module: moduleName,
    route,
    suggestions,
  };
}

async function executeModuleAction(
  input: z.infer<typeof moduleActionInputSchema>,
  context: ProjectContext
) {
  const moduleName = inferModuleName(input, context);
  const action = inferModuleAction(input, context);
  const searchText = input.searchText || context.latestUserMessage.content || "";
  const route = context.route || "dashboard";

  const sharedFilters = {
    grade: input.grade,
    standard: input.standard,
    division: input.division,
    subject: input.subject,
    fromDate: input.fromDate,
    toDate: input.toDate,
    enrollmentNo: input.enrollmentNo,
    rollNo: input.rollNo,
    mobileNo: input.mobileNo,
    status: input.status,
    term: input.term,
    examType: input.examType,
    searchText,
    recordId: input.recordId,
  };

  const normalized = Object.fromEntries(
    Object.entries(sharedFilters).filter(([, value]) => value !== undefined && value !== "")
  );

  switch (moduleName) {
    case "admissions": {
      if (action === "confirm") {
        return findAdmissionCandidate(
          {
            studentName: normalized.searchText,
            onlyPending: true,
          },
          context
        );
      }

      return listAdmissionEnquiries(
        {
          onlyPending: /pending|open/i.test(searchText),
          status: /closed/i.test(searchText) ? "Closed" : /approved/i.test(searchText) ? "Approved" : undefined,
          ...normalized,
        },
        context
      );
    }
    case "fees": {
      // Institute-level money questions ("total collection", "how much is
      // outstanding") are answered by the fee dashboard, not by a student row.
      if (
        /total|summary|collection rate|collected|outstanding|demand|how much/.test(searchText) &&
        !/collect fee|collect fees/.test(searchText)
      ) {
        return getFeesSummary(
          {
            grade: normalized.grade,
            standard: normalized.standard,
            division: normalized.division,
            fromDate: normalized.fromDate,
            toDate: normalized.toDate,
          },
          context
        );
      }

      if (action === "collect") {
        return findStudentFeeRecord(
          {
            studentName: normalized.searchText,
            standard: normalized.standard,
            division: normalized.division,
            enrollmentNo: normalized.enrollmentNo,
            rollNo: normalized.rollNo,
            mobileNo: normalized.mobileNo,
          },
          context
        );
      }

      if (action === "list_defaulters" || /defaulter|pending|due|outstanding/.test(searchText)) {
        return listFeesDefaulters(
          {
            standard: normalized.standard,
            division: normalized.division,
            firstName: normalized.searchText,
            mobileNo: normalized.mobileNo,
          },
          context
        );
      }

      return findStudentFeeRecord(
        {
          studentName: normalized.searchText,
          standard: normalized.standard,
          division: normalized.division,
          enrollmentNo: normalized.enrollmentNo,
          rollNo: normalized.rollNo,
          mobileNo: normalized.mobileNo,
        },
        context
      );
    }
    case "homework":
      return listHomework(
        {
          standard: normalized.standard,
          division: normalized.division,
          subject: normalized.subject,
          fromDate: normalized.fromDate,
          toDate: normalized.toDate,
        },
        context
      );
    case "results":
    case "marks":
    case "exams":
    case "exam": {
      return getResultReport(
        {
          reportOf: /marks|marksheet|exam/.test(searchText) ? "marks_report" : "overall_report",
          standard: normalized.standard,
          division: normalized.division,
          term: normalized.term,
          subject: normalized.subject,
          examType: normalized.examType,
          rollNo: normalized.rollNo,
          fromDate: normalized.fromDate,
          toDate: normalized.toDate,
        },
        context
      );
    }
    case "attendance": {
      // Teacher attendance stays on the teacher daily report; every other
      // attendance question is student attendance, which has its own workflow.
      if (/teacher|staff|faculty/.test(searchText)) {
        return getTeacherDailyReport(
          {
            date: normalized.fromDate || normalized.toDate,
            status: normalized.status as "Y" | "N" | undefined,
          },
          context
        );
      }

      const namedStudent = inferStudentNameFromText(searchText);
      if (namedStudent || normalized.enrollmentNo) {
        return getStudentAttendanceDetail(
          {
            studentName: namedStudent,
            enrollmentNo: normalized.enrollmentNo,
            standard: normalized.standard,
            division: normalized.division,
            fromDate: normalized.fromDate,
            toDate: normalized.toDate,
          },
          context
        );
      }

      return getAttendanceOverview(
        {
          date: normalized.fromDate || normalized.toDate,
          standard: normalized.standard,
          division: normalized.division,
        },
        context
      );
    }
    case "teachers":
    case "staff": {
      if (/absent|present|daily report|daily activity|leave/.test(searchText)) {
        return getTeacherDailyReport(
          {
            date: normalized.fromDate || normalized.toDate,
          },
          context
        );
      }

      if (normalized.standard || normalized.division) {
        return getClassTeachers(
          {
            standard: normalized.standard,
            division: normalized.division,
          },
          context
        );
      }

      return getTeacherDirectory(
        {
          teacherName: inferStudentNameFromText(searchText),
        },
        context
      );
    }
    case "students":
    case "parents":
    case "guardian": {
      // Counts, class rosters and "students of Standard 7" come from the real
      // enrolment directory; the homework-scoped search stays for the workflows
      // that already depend on it.
      if (
        /how many|count|total|list|strength|all students|show students/.test(searchText) ||
        !normalized.searchText
      ) {
        return getStudentDirectory(
          {
            grade: normalized.grade,
            standard: normalized.standard,
            division: normalized.division,
            studentName: inferStudentNameFromText(searchText),
            enrollmentNo: normalized.enrollmentNo,
            rollNo: normalized.rollNo,
            mobileNo: normalized.mobileNo,
            groupBy: /how many|count|total|strength/.test(searchText)
              ? normalized.standard
                ? "division"
                : "standard"
              : "none",
          },
          context
        );
      }

      return searchStudents(
        {
          standard: normalized.standard,
          division: normalized.division,
          studentName: normalized.searchText,
          enrollmentNo: normalized.enrollmentNo,
          rollNo: normalized.rollNo,
          mobileNo: normalized.mobileNo,
        },
        context
      );
    }
    case "subjects":
      return getSubjectCatalog(
        {
          grade: normalized.grade,
          standard: normalized.standard,
          division: normalized.division,
        },
        context
      );
    case "courses":
      return getCourseCatalog(
        {
          grade: normalized.grade,
          standard: normalized.standard,
        },
        context
      );
    case "classes":
      return getClassStructure({}, context);
    case "departments":
      return getDepartmentDirectory(
        {
          departmentName: inferStudentNameFromText(searchText),
          includeEmployees: /employee|staff|member|who/.test(searchText),
        },
        context
      );
    case "dashboard":
      return getLmsDashboard({}, context);
    case "activity":
      return getActivityStream({}, context);
    default: {
      // No LMS data source is wired to this module yet. Say so plainly rather
      // than answering from anything other than backend data.
      const guidance = await getContextualSuggestions({ module: moduleName, context: route }, context);
      return {
        module: moduleName,
        action,
        route,
        available: false,
        summary: `I don't currently have a connected LMS data source for the ${moduleName} module, so I can't answer that from real records. I can help with students, teachers, classes, subjects, courses, attendance, homework, results, fees, admissions, and departments.`,
        suggestions: guidance.suggestions,
      };
    }
  }
}

export function getLmsToolDefinitions(): ProjectToolDefinition[] {
  return [
    {
      name: "getLmsDashboard",
      description:
        "Load the real LMS dashboard for the current user from the LMS backend.",
      inputSchema: lmsDashboardInputSchema,
      requiredPermissions: ["lms:dashboard:read"],
      riskLevel: "low",
      requiresConfirmation: false,
      capabilities: ["dashboard_insights", "learning_progress", "student_progress"],
      execute: getLmsDashboard,
    },
    {
      name: "getActivityStream",
      description:
        "Load the real LMS activity stream for the current session from the LMS backend.",
      inputSchema: activityStreamInputSchema,
      requiredPermissions: ["lms:activity:read"],
      riskLevel: "low",
      requiresConfirmation: false,
      capabilities: ["activity_stream", "today_updates", "recent_updates"],
      execute: getActivityStream,
    },
    {
      name: "listHomework",
      description:
        "Load real LMS homework records using the existing LMS homework APIs. Grade, standard, division, subject, and date filters are optional. If the user does not provide filters, call this tool with empty filters and use the current LMS session scope instead of asking a follow-up question.",
      inputSchema: homeworkListInputSchema,
      requiredPermissions: ["lms:homework:read"],
      riskLevel: "low",
      requiresConfirmation: false,
      capabilities: ["homework", "assignments", "submissions"],
      execute: listHomework,
    },
    {
      name: "listFeesDefaulters",
      description:
        "Load the real LMS fees defaulter report using the existing Laravel fees workflow.",
      inputSchema: feesDefaulterInputSchema,
      requiredPermissions: ["lms:fees:defaulter:read"],
      riskLevel: "low",
      requiresConfirmation: false,
      capabilities: ["fees", "unpaid_fees", "defaulters"],
      execute: listFeesDefaulters,
    },
    {
      name: "searchStudents",
      description:
        "Search student records in the current institute scope for student-specific questions and follow-up workflows.",
      inputSchema: studentSearchInputSchema,
      requiredPermissions: ["lms:student:read"],
      riskLevel: "low",
      requiresConfirmation: false,
      capabilities: ["students", "student_lookup", "parents", "student_search"],
      execute: searchStudents,
    },
    {
      name: "findStudentFeeRecord",
      description:
        "Locate a student in the fees collection workflow so the assistant can continue with fee collection naturally.",
      inputSchema: studentFeeRecordInputSchema,
      requiredPermissions: ["lms:fees:collect"],
      riskLevel: "low",
      requiresConfirmation: false,
      capabilities: ["fee_collection", "collect_fees", "student_fee_lookup"],
      execute: findStudentFeeRecord,
    },
    {
      name: "getStudentFeeDetails",
      description:
        "Load the detailed fee breakdown for a single student before redirecting to the fee collection flow.",
      inputSchema: studentFeeDetailsInputSchema,
      requiredPermissions: ["lms:fees:collect"],
      riskLevel: "low",
      requiresConfirmation: false,
      capabilities: ["fee_collection_details", "student_fee_details"],
      execute: getStudentFeeDetails,
    },
    {
      name: "getTeacherDailyReport",
      description:
        "Load the teacher daily report summary from the LMS API with current user rights applied.",
      inputSchema: teacherDailyReportInputSchema,
      requiredPermissions: ["lms:teacher_daily_report:read"],
      riskLevel: "low",
      requiresConfirmation: false,
      capabilities: ["teacher_activity", "teacher_absence", "daily_attendance"],
      execute: getTeacherDailyReport,
    },
    {
      name: "getResultReport",
      description:
        "Generate a real LMS result report through the existing result report controller and APIs.",
      inputSchema: resultReportInputSchema,
      requiredPermissions: ["lms:result:read"],
      riskLevel: "low",
      requiresConfirmation: false,
      capabilities: ["result_report", "exam_results", "classwise_grade_report"],
      execute: getResultReport,
    },
    {
      name: "listAdmissionEnquiries",
      description:
        "Load real admission enquiry and application records from the LMS admissions backend. Use this for pending admissions, new enquiries, and application status questions.",
      inputSchema: admissionEnquiryInputSchema,
      requiredPermissions: ["admission:enquiry:read"],
      riskLevel: "low",
      requiresConfirmation: false,
      capabilities: ["admission_enquiries", "pending_admissions", "admission_applications"],
      execute: listAdmissionEnquiries,
    },
    {
      name: "hydrateAdmissionCandidate",
      description:
        "Load complete admission enquiry, registration, and student details for the selected candidate and calculate missing fields.",
      inputSchema: admissionHydrateInputSchema,
      requiredPermissions: ["admission:enquiry:read"],
      riskLevel: "low",
      requiresConfirmation: false,
      capabilities: ["admission_confirmation_lookup", "confirm_admission", "admission_followup"],
      execute: hydrateAdmissionCandidate,
    },
    {
      name: "findAdmissionCandidate",
      description:
        "Find a specific admission candidate from the pending-admissions workflow and prepare the correct confirmation or edit route.",
      inputSchema: admissionCandidateInputSchema,
      requiredPermissions: ["admission:enquiry:read"],
      riskLevel: "low",
      requiresConfirmation: false,
      capabilities: ["admission_confirmation_lookup", "confirm_admission", "admission_followup"],
      execute: findAdmissionCandidate,
    },
    {
      name: "confirmAdmissionCandidate",
      description:
        "Confirm an admission using the existing admission confirmation backend API after the student record is ready.",
      inputSchema: admissionConfirmInputSchema,
      requiredPermissions: ["admission:enquiry:read"],
      riskLevel: "medium",
      requiresConfirmation: true,
      capabilities: ["confirm_admission_action", "admission_confirmation"],
      execute: confirmAdmissionCandidate,
    },
    {
      name: "updateAdmissionCandidateDetails",
      description:
        "Update only the genuinely missing admission registration fields before confirmation.",
      inputSchema: admissionUpdateInputSchema,
      requiredPermissions: ["admission:enquiry:read"],
      riskLevel: "medium",
      requiresConfirmation: false,
      capabilities: ["admission_slot_filling", "admission_update"],
      execute: updateAdmissionCandidateDetails,
    },
    {
      name: "getContextualSuggestions",
      description:
        "Generate route-aware LMS guidance for the current module and workflow.",
      inputSchema: contextualSuggestionsSchema,
      requiredPermissions: ["assistant:suggestions:read"],
      riskLevel: "low",
      requiresConfirmation: false,
      capabilities: ["contextual_guidance", "lms_help"],
      execute: getContextualSuggestions,
    },
    {
      name: "executeModuleAction",
      description:
        "Resolve a user request for students, teachers, fees, homework, marks, attendance, timetable, exams, library, transport, hostel, parents, staff, accounts, notifications, or other ERP modules by routing it to the appropriate existing LMS backend workflow.",
      inputSchema: moduleActionInputSchema,
      requiredPermissions: ["assistant:suggestions:read"],
      riskLevel: "low",
      requiresConfirmation: false,
      capabilities: ["module_action", "module_lookup", "erp_workflow"],
      execute: executeModuleAction,
    },
    // Directory, catalogue, attendance, department, fee-summary and analysis
    // tools for the modules that had no conversational coverage before.
    ...getModuleDataToolDefinitions(),
  ];
}

export function getAllowedToolNamesForProfile(profileName?: string) {
  const toolNames = ["getContextualSuggestions", "executeModuleAction"] as string[];

  if (canAccessStudentAnalytics(profileName)) {
    toolNames.push("getLmsDashboard", "getActivityStream", "getResultReport", "searchStudents");
  }

  // Students may ask about their own attendance and the catalogue they study
  // from; the backend still scopes every row to their session.
  if (isStudentProfile(profileName)) {
    toolNames.push(
      "getClassStructure",
      "getSubjectCatalog",
      "getCourseCatalog",
      "getStudentAttendanceDetail"
    );
  }

  if (isTeacherProfile(profileName) || isAdminProfile(profileName)) {
    // Institute-wide analysis stays with the profiles that can already see the
    // underlying rows, so a cross-module question cannot widen a user's scope.
    toolNames.push(
      "listHomework",
      "getTeacherDailyReport",
      "searchStudents",
      ...MODULE_DATA_TOOL_NAMES.read,
      ...MODULE_DATA_TOOL_NAMES.analysis
    );
  }

  if (isAdminProfile(profileName)) {
    toolNames.push(
      "listFeesDefaulters",
      "listAdmissionEnquiries",
      "findAdmissionCandidate",
      "hydrateAdmissionCandidate",
      "confirmAdmissionCandidate",
      "updateAdmissionCandidateDetails",
      "findStudentFeeRecord",
      "getStudentFeeDetails",
      ...MODULE_DATA_TOOL_NAMES.admin
    );
  }

  return [...new Set(toolNames)];
}

export { admissionApi, admissionStateService, getAdmissionStateKey };
export { findAdmissionCandidate, hydrateAdmissionCandidate, listAdmissionEnquiries, updateAdmissionCandidateDetails, confirmAdmissionCandidate };
