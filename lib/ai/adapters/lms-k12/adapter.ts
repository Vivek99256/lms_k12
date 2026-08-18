import { generateObject } from "ai";
import { z } from "zod";
import {
  detectConversationLanguage,
  getDefaultSystemPrompt,
  type ConversationIntent,
  type ProjectAIAdapter,
  type ProjectContext,
} from "@shared/conversational-ai-core";
import { createAiModel } from "@shared/conversational-ai-core/model";
import {
  describeFollowUpState,
  getFollowUpState,
  isContextualFollowUp,
  resolveConversationFocus,
} from "@shared/conversational-ai-core";
import { getLmsToolDefinitions, getAllowedToolNamesForProfile } from "./tools";
import { normalizeRoleName } from "../shared-utils";

const classifierOutputSchema = z.object({
  type: z.enum([
    "ask",
    "learn",
    "guide",
    "do",
    "analyse",
    "recommend",
    "automate",
    "monitor",
    "coach",
  ]),
  domain: z.enum(["k12", "people_competency", "enterprise_brain", "shared"]),
  capability: z.string(),
  entities: z.record(z.string(), z.unknown()).default({}),
  confidence: z.number().min(0).max(1),
  requiresConfirmation: z.boolean(),
  requiredPermission: z.string().optional(),
  suggestedTool: z.string().optional(),
});

const capabilityNormalizationMap: Record<
  string,
  Pick<ConversationIntent, "type" | "domain" | "capability" | "requiredPermission" | "suggestedTool">
> = {
  getlmsdashboard: {
    type: "analyse",
    domain: "k12",
    capability: "dashboard_insights",
    requiredPermission: "lms:dashboard:read",
    suggestedTool: "getLmsDashboard",
  },
  dashboard_insights: {
    type: "analyse",
    domain: "k12",
    capability: "dashboard_insights",
    requiredPermission: "lms:dashboard:read",
    suggestedTool: "getLmsDashboard",
  },
  getactivitystream: {
    type: "ask",
    domain: "k12",
    capability: "activity_stream",
    requiredPermission: "lms:activity:read",
    suggestedTool: "getActivityStream",
  },
  activity_stream: {
    type: "ask",
    domain: "k12",
    capability: "activity_stream",
    requiredPermission: "lms:activity:read",
    suggestedTool: "getActivityStream",
  },
  listhomework: {
    type: "ask",
    domain: "k12",
    capability: "homework",
    requiredPermission: "lms:homework:read",
    suggestedTool: "listHomework",
  },
  homework: {
    type: "ask",
    domain: "k12",
    capability: "homework",
    requiredPermission: "lms:homework:read",
    suggestedTool: "listHomework",
  },
  getresultreport: {
    type: "analyse",
    domain: "k12",
    capability: "result_report",
    requiredPermission: "lms:result:read",
    suggestedTool: "getResultReport",
  },
  listadmissionenquiries: {
    type: "ask",
    domain: "k12",
    capability: "admission_enquiries",
    requiredPermission: "admission:enquiry:read",
    suggestedTool: "listAdmissionEnquiries",
  },
  admission_enquiries: {
    type: "ask",
    domain: "k12",
    capability: "admission_enquiries",
    requiredPermission: "admission:enquiry:read",
    suggestedTool: "listAdmissionEnquiries",
  },
  pending_admissions: {
    type: "ask",
    domain: "k12",
    capability: "pending_admissions",
    requiredPermission: "admission:enquiry:read",
    suggestedTool: "listAdmissionEnquiries",
  },
  admission_confirmation: {
    type: "do",
    domain: "k12",
    capability: "admission_confirmation",
    requiredPermission: "admission:enquiry:read",
    suggestedTool: "findAdmissionCandidate",
  },
  confirm_admission_action: {
    type: "do",
    domain: "k12",
    capability: "confirm_admission_action",
    requiredPermission: "admission:enquiry:read",
    suggestedTool: "confirmAdmissionCandidate",
  },
  result_report: {
    type: "analyse",
    domain: "k12",
    capability: "result_report",
    requiredPermission: "lms:result:read",
    suggestedTool: "getResultReport",
  },
  getteacherdailyreport: {
    type: "ask",
    domain: "k12",
    capability: "teacher_activity",
    requiredPermission: "lms:teacher_daily_report:read",
    suggestedTool: "getTeacherDailyReport",
  },
  teacher_activity: {
    type: "ask",
    domain: "k12",
    capability: "teacher_activity",
    requiredPermission: "lms:teacher_daily_report:read",
    suggestedTool: "getTeacherDailyReport",
  },
  listfeesdefaulters: {
    type: "analyse",
    domain: "k12",
    capability: "unpaid_fees",
    requiredPermission: "lms:fees:defaulter:read",
    suggestedTool: "listFeesDefaulters",
  },
  unpaid_fees: {
    type: "analyse",
    domain: "k12",
    capability: "unpaid_fees",
    requiredPermission: "lms:fees:defaulter:read",
    suggestedTool: "listFeesDefaulters",
  },
  fee_collection: {
    type: "do",
    domain: "k12",
    capability: "fee_collection",
    requiredPermission: "lms:fees:collect",
    suggestedTool: "findStudentFeeRecord",
  },
  student_lookup: {
    type: "ask",
    domain: "k12",
    capability: "student_lookup",
    requiredPermission: "lms:student:read",
    suggestedTool: "searchStudents",
  },
  getcontextualsuggestions: {
    type: "guide",
    domain: "shared",
    capability: "contextual_guidance",
    requiredPermission: "assistant:suggestions:read",
    suggestedTool: "getContextualSuggestions",
  },
  module_action: {
    type: "ask",
    domain: "k12",
    capability: "module_action",
    requiredPermission: "assistant:suggestions:read",
    suggestedTool: "executeModuleAction",
  },
  getstudentdirectory: {
    type: "ask",
    domain: "k12",
    capability: "student_directory",
    requiredPermission: "lms:student:read",
    suggestedTool: "getStudentDirectory",
  },
  student_directory: {
    type: "ask",
    domain: "k12",
    capability: "student_directory",
    requiredPermission: "lms:student:read",
    suggestedTool: "getStudentDirectory",
  },
  getteacherdirectory: {
    type: "ask",
    domain: "k12",
    capability: "teacher_directory",
    requiredPermission: "lms:teacher:read",
    suggestedTool: "getTeacherDirectory",
  },
  teacher_directory: {
    type: "ask",
    domain: "k12",
    capability: "teacher_directory",
    requiredPermission: "lms:teacher:read",
    suggestedTool: "getTeacherDirectory",
  },
  getclassteachers: {
    type: "ask",
    domain: "k12",
    capability: "class_teachers",
    requiredPermission: "lms:teacher:read",
    suggestedTool: "getClassTeachers",
  },
  class_teachers: {
    type: "ask",
    domain: "k12",
    capability: "class_teachers",
    requiredPermission: "lms:teacher:read",
    suggestedTool: "getClassTeachers",
  },
  getclassstructure: {
    type: "ask",
    domain: "k12",
    capability: "class_structure",
    requiredPermission: "lms:student:read",
    suggestedTool: "getClassStructure",
  },
  class_structure: {
    type: "ask",
    domain: "k12",
    capability: "class_structure",
    requiredPermission: "lms:student:read",
    suggestedTool: "getClassStructure",
  },
  getsubjectcatalog: {
    type: "ask",
    domain: "k12",
    capability: "subject_catalog",
    requiredPermission: "lms:subject:read",
    suggestedTool: "getSubjectCatalog",
  },
  subject_catalog: {
    type: "ask",
    domain: "k12",
    capability: "subject_catalog",
    requiredPermission: "lms:subject:read",
    suggestedTool: "getSubjectCatalog",
  },
  getcoursecatalog: {
    type: "ask",
    domain: "k12",
    capability: "course_catalog",
    requiredPermission: "lms:course:read",
    suggestedTool: "getCourseCatalog",
  },
  course_catalog: {
    type: "ask",
    domain: "k12",
    capability: "course_catalog",
    requiredPermission: "lms:course:read",
    suggestedTool: "getCourseCatalog",
  },
  getattendanceoverview: {
    type: "ask",
    domain: "k12",
    capability: "student_attendance",
    requiredPermission: "lms:attendance:read",
    suggestedTool: "getAttendanceOverview",
  },
  student_attendance: {
    type: "ask",
    domain: "k12",
    capability: "student_attendance",
    requiredPermission: "lms:attendance:read",
    suggestedTool: "getAttendanceOverview",
  },
  getstudentattendancedetail: {
    type: "ask",
    domain: "k12",
    capability: "student_attendance_detail",
    requiredPermission: "lms:attendance:read",
    suggestedTool: "getStudentAttendanceDetail",
  },
  student_attendance_detail: {
    type: "ask",
    domain: "k12",
    capability: "student_attendance_detail",
    requiredPermission: "lms:attendance:read",
    suggestedTool: "getStudentAttendanceDetail",
  },
  getdepartmentdirectory: {
    type: "ask",
    domain: "k12",
    capability: "department_directory",
    requiredPermission: "hrms:department:read",
    suggestedTool: "getDepartmentDirectory",
  },
  department_directory: {
    type: "ask",
    domain: "k12",
    capability: "department_directory",
    requiredPermission: "hrms:department:read",
    suggestedTool: "getDepartmentDirectory",
  },
  getdepartmentinsight: {
    type: "analyse",
    domain: "k12",
    capability: "department_insight",
    requiredPermission: "hrms:department:read",
    suggestedTool: "getDepartmentInsight",
  },
  department_insight: {
    type: "analyse",
    domain: "k12",
    capability: "department_insight",
    requiredPermission: "hrms:department:read",
    suggestedTool: "getDepartmentInsight",
  },
  getfeessummary: {
    type: "analyse",
    domain: "k12",
    capability: "fees_summary",
    requiredPermission: "lms:fees:defaulter:read",
    suggestedTool: "getFeesSummary",
  },
  fees_summary: {
    type: "analyse",
    domain: "k12",
    capability: "fees_summary",
    requiredPermission: "lms:fees:defaulter:read",
    suggestedTool: "getFeesSummary",
  },
  analyzelmsdata: {
    type: "analyse",
    domain: "k12",
    capability: "data_analysis",
    requiredPermission: "lms:analysis:read",
    suggestedTool: "analyzeLmsData",
  },
  data_analysis: {
    type: "analyse",
    domain: "k12",
    capability: "data_analysis",
    requiredPermission: "lms:analysis:read",
    suggestedTool: "analyzeLmsData",
  },
  contextual_guidance: {
    type: "guide",
    domain: "shared",
    capability: "contextual_guidance",
    requiredPermission: "assistant:suggestions:read",
    suggestedTool: "getContextualSuggestions",
  },
};

function normalizeCapabilityKey(value: string | undefined) {
  return (value || "").replace(/[\s_-]+/g, "").toLowerCase();
}

function isLikelyLmsQuery(text: string) {
  return /dashboard|progress|performance|score|analysis|result|marks report|report card|activity|feed|stream|homework|assignment|submission|fee|defaulter|teacher|class|student|attendance|admission|application|enquiry|module|route|page|screen|lms|subject|course|curriculum|syllabus|chapter|department|division|standard|staff|employee|skill|training|institute|school/.test(
    text
  );
}

/**
 * Questions that need reasoning across retrieved data rather than a single
 * record lookup — comparisons, rankings, risk, trends and summaries. Gated on
 * the message also looking LMS-related so ordinary "why/how" chit-chat is not
 * routed into a data-analysis tool call.
 */
export function isAnalyticalLmsQuery(text: string) {
  if (!isLikelyLmsQuery(text)) {
    return false;
  }

  return /\b(compare|comparison|versus|vs\b|highest|lowest|most|least|best|worst|top \d+|bottom \d+|rank|ranking|risk|trend|trends|insight|insights|summari[sz]e|summary of|overall situation|need attention|needs? the most|skill gap|gap analysis|improvement|improve|recommend|recommendation|why is|why are|which .*(needs?|should)|breakdown|distribution|average|percentage across)\b/.test(
    text
  );
}

function isLikelyGeneralKnowledgeQuery(text: string) {
  if (isLikelyLmsQuery(text)) {
    return false;
  }

  return /^(what|who|when|where|why|how|which|whom)\b/.test(text) || /\?$/.test(text);
}

function normalizeClassifierIntent(intent: ConversationIntent): ConversationIntent {
  const byCapability = capabilityNormalizationMap[normalizeCapabilityKey(intent.capability)];
  const bySuggestedTool = capabilityNormalizationMap[normalizeCapabilityKey(intent.suggestedTool)];
  const normalized = bySuggestedTool || byCapability;

  if (!normalized) {
    return intent;
  }

  return {
    ...intent,
    ...normalized,
  };
}

function getLatestUserMessage(messages: ProjectContext["messageHistory"]) {
  const latest = [...messages].reverse().find((message) => message.role === "user");
  if (!latest) {
    throw new Error("At least one user message is required.");
  }
  return latest;
}

function getPreviousConversationText(context: ProjectContext) {
  return context.messageHistory
    .slice(0, -1)
    .map((message) => message.content.toLowerCase())
    .join("\n");
}

function getContextualContinuationIntent(context: ProjectContext): ConversationIntent | null {
  const text = context.latestUserMessage.content.trim().toLowerCase();
  const previousText = getPreviousConversationText(context);
  const isFeeMessage =
    /collect fees|fee collection|collect fee|pay fees|pay fee|pending fees|fees records|defaulter|fees/.test(text);
  const isAdmissionMessage =
    /confirm admission|admission confirmation|pending admissions|admission application|admission|enquiry/.test(text);

  if (!text || !previousText) {
    return null;
  }

  if (
    /^(yes|haan|ha|yep|yeah|ok|okay|sure|confirm it|do it)\b/.test(text) &&
    /ready for confirmation|confirm this admission now/.test(previousText)
  ) {
    return {
      type: "do",
      domain: "k12",
      capability: "confirm_admission_action",
      entities: {},
      confidence: 0.92,
      requiresConfirmation: false,
      requiredPermission: "admission:enquiry:read",
      suggestedTool: "confirmAdmissionCandidate",
    };
  }

  if (
    /^(yes|haan|ha|yep|yeah|ok|okay|sure)\b/.test(text) &&
    /pending admissions|admission application|confirm admission|admission confirmation/.test(previousText)
  ) {
    return {
      type: "do",
      domain: "k12",
      capability: "admission_confirmation",
      entities: {},
      confidence: 0.9,
      requiresConfirmation: false,
      requiredPermission: "admission:enquiry:read",
      suggestedTool: "findAdmissionCandidate",
    };
  }

  if (
    /^(yes|haan|ha|yep|yeah|ok|okay|sure)\b/.test(text) &&
    /pending fees|collect fees|fee collection|fees records/.test(previousText)
  ) {
    return {
      type: "do",
      domain: "k12",
      capability: "fee_collection",
      entities: {},
      confidence: 0.9,
      requiresConfirmation: false,
      requiredPermission: "lms:fees:collect",
      suggestedTool: "findStudentFeeRecord",
    };
  }

  // Homework follow-up: the previous turn listed homework records, so a short
  // reply ("2", a title, a homework ID) continues the homework workflow.
  if (
    /[a-z0-9]/.test(text) &&
    !isFeeMessage &&
    !isAdmissionMessage &&
    /homework record|which homework record|homework report/.test(previousText)
  ) {
    return {
      type: "ask",
      domain: "k12",
      capability: "homework",
      entities: {},
      confidence: 0.87,
      requiresConfirmation: false,
      requiredPermission: "lms:homework:read",
      suggestedTool: "listHomework",
    };
  }

  if (
    /[a-z]/.test(text) &&
    !isFeeMessage &&
    /confirm admission|admission confirmation|pending admissions|admission application/.test(previousText)
  ) {
    return {
      type: "do",
      domain: "k12",
      capability: "admission_confirmation",
      entities: {},
      confidence: 0.86,
      requiresConfirmation: false,
      requiredPermission: "admission:enquiry:read",
      suggestedTool: "findAdmissionCandidate",
    };
  }

  if (
    /[a-z]/.test(text) &&
    !isAdmissionMessage &&
    /collect fees|fee collection|collect fee|pay fees|pay fee|pending fees|fees records|defaulter/.test(previousText)
  ) {
    return {
      type: "do",
      domain: "k12",
      capability: "fee_collection",
      entities: {},
      confidence: 0.87,
      requiresConfirmation: false,
      requiredPermission: "lms:fees:collect",
      suggestedTool: "findStudentFeeRecord",
    };
  }

  if (
    /(standard|class|grade|division|section|roll|grno|enrollment|mobile)\b/.test(text) &&
    /collect fees|fee collection|collect fee|pay fees|pay fee|student fee|fee details|student details/.test(previousText)
  ) {
    return {
      type: "do",
      domain: "k12",
      capability: "fee_collection",
      entities: {},
      confidence: 0.88,
      requiresConfirmation: false,
      requiredPermission: "lms:fees:collect",
      suggestedTool: "findStudentFeeRecord",
    };
  }

  // Attendance follow-ups ("which division has the lowest attendance?",
  // "and for B division?") stay inside the attendance workflow so the class
  // scope from the previous turn is reused instead of being asked for again.
  if (
    /(division|section|class|standard|std|lowest|highest|which|percentage|absent|present|today|yesterday)\b/.test(text) &&
    /attendance/.test(previousText) &&
    !isFeeMessage &&
    !isAdmissionMessage
  ) {
    return {
      type: /lowest|highest|compare|which/.test(text) ? "analyse" : "ask",
      domain: "k12",
      capability: "student_attendance",
      entities: {},
      confidence: 0.88,
      requiresConfirmation: false,
      requiredPermission: "lms:attendance:read",
      suggestedTool: "getAttendanceOverview",
    };
  }

  // "Which classes?" after a pending-fees answer refers to those same students.
  if (
    /(which|what)\s+(class|classes|standard|standards|division|divisions|student|students)/.test(text) &&
    /pending fees|unpaid fee|defaulter|fees defaulter/.test(previousText)
  ) {
    return {
      type: "analyse",
      domain: "k12",
      capability: "unpaid_fees",
      entities: {},
      confidence: 0.88,
      requiresConfirmation: false,
      requiredPermission: "lms:fees:defaulter:read",
      suggestedTool: "listFeesDefaulters",
    };
  }

  if (
    /(division|section|class|standard|std|which|how many|list)\b/.test(text) &&
    /students? (?:are|of|in|from)|student directory|class strength/.test(previousText) &&
    !isFeeMessage &&
    !isAdmissionMessage
  ) {
    return {
      type: "ask",
      domain: "k12",
      capability: "student_directory",
      entities: {},
      confidence: 0.86,
      requiresConfirmation: false,
      requiredPermission: "lms:student:read",
      suggestedTool: "getStudentDirectory",
    };
  }

  if (
    /(report|overall|merit|marks|grade|division|class|term|exam|roll|subject)\b/.test(text) &&
    /result report|marks report|report card|exam result|classwise grade/.test(previousText)
  ) {
    return {
      type: "analyse",
      domain: "k12",
      capability: "result_report",
      entities: {},
      confidence: 0.88,
      requiresConfirmation: false,
      requiredPermission: "lms:result:read",
      suggestedTool: "getResultReport",
    };
  }

  return null;
}

function fallbackIntent(context: ProjectContext): ConversationIntent {
  const text = context.latestUserMessage.content.toLowerCase();

  if (isAnalyticalLmsQuery(text)) {
    return {
      type: "analyse",
      domain: "k12",
      capability: "data_analysis",
      entities: {},
      confidence: 0.76,
      requiresConfirmation: false,
      requiredPermission: "lms:analysis:read",
      suggestedTool: "analyzeLmsData",
    };
  }

  const moduleDataIntent = getModuleDataIntent(text);
  if (moduleDataIntent) {
    return { ...moduleDataIntent, confidence: 0.76 };
  }

  if (/unpaid fee|pending fee|fees defaulter|defaulter/.test(text)) {
    return {
      type: "analyse",
      domain: "k12",
      capability: "unpaid_fees",
      entities: {},
      confidence: 0.78,
      requiresConfirmation: false,
      requiredPermission: "lms:fees:defaulter:read",
      suggestedTool: "listFeesDefaulters",
    };
  }

  if (/collect fee|collect fees|fee collection|pay fee for|pay fees for|take fee from/.test(text)) {
    return {
      type: "do",
      domain: "k12",
      capability: "fee_collection",
      entities: {},
      confidence: 0.78,
      requiresConfirmation: false,
      requiredPermission: "lms:fees:collect",
      suggestedTool: "findStudentFeeRecord",
    };
  }

  if (/student|learner|parent|guardian/.test(text)) {
    return {
      type: "ask",
      domain: "k12",
      capability: "student_lookup",
      entities: {},
      confidence: 0.74,
      requiresConfirmation: false,
      requiredPermission: "lms:student:read",
      suggestedTool: "searchStudents",
    };
  }

  if (/teacher.*absent|absent teacher|teacher daily|teachers are absent/.test(text)) {
    return {
      type: "ask",
      domain: "k12",
      capability: "teacher_activity",
      entities: {},
      confidence: 0.76,
      requiresConfirmation: false,
      requiredPermission: "lms:teacher_daily_report:read",
      suggestedTool: "getTeacherDailyReport",
    };
  }

  if (/admission|application|enquiry/.test(text)) {
    return {
      type: "ask",
      domain: "k12",
      capability: /pending|open/.test(text)
        ? "pending_admissions"
        : "admission_enquiries",
      entities: {},
      confidence: 0.77,
      requiresConfirmation: false,
      requiredPermission: "admission:enquiry:read",
      suggestedTool: "listAdmissionEnquiries",
    };
  }

  if (/confirm admission|admission confirmation|approve admission/.test(text)) {
    return {
      type: "do",
      domain: "k12",
      capability: "admission_confirmation",
      entities: {},
      confidence: 0.82,
      requiresConfirmation: false,
      requiredPermission: "admission:enquiry:read",
      suggestedTool: "findAdmissionCandidate",
    };
  }

  if (/dashboard|progress|performance|score|result|marks report|analysis/.test(text)) {
    const suggestedTool =
      /result report|marks report|report card|merit|classwise|exam result/.test(text)
        ? "getResultReport"
        : "getLmsDashboard";
    return {
      type: "analyse",
      domain: "k12",
      capability:
        suggestedTool === "getResultReport" ? "result_report" : "dashboard_insights",
      entities: {},
      confidence: 0.77,
      requiresConfirmation: false,
      requiredPermission:
        suggestedTool === "getResultReport"
          ? "lms:result:read"
          : "lms:dashboard:read",
      suggestedTool,
    };
  }

  if (/activity|today|upcoming|recent|feed|stream/.test(text)) {
    return {
      type: "ask",
      domain: "k12",
      capability: "activity_stream",
      entities: {},
      confidence: 0.73,
      requiresConfirmation: false,
      requiredPermission: "lms:activity:read",
      suggestedTool: "getActivityStream",
    };
  }

  if (/homework|assignment|submission/.test(text)) {
    return {
      type: "ask",
      domain: "k12",
      capability: "homework",
      entities: {},
      confidence: 0.74,
      requiresConfirmation: false,
      requiredPermission: "lms:homework:read",
      suggestedTool: "listHomework",
    };
  }

  if (/attendance|timetable|schedule|exam|teacher|parent portal|report\b/.test(text)) {
    return {
      type: "guide",
      domain: "shared",
      capability: "contextual_guidance",
      entities: {},
      confidence: 0.7,
      requiresConfirmation: false,
      requiredPermission: "assistant:suggestions:read",
      suggestedTool: "getContextualSuggestions",
    };
  }

  if (
    /(student|learner|parent|guardian|teacher|staff|attendance|timetable|schedule|exam|library|transport|hostel|account|notification|marks|result|fees?|homework|assignment|classwork|module|route)/.test(text)
  ) {
    return {
      type: "ask",
      domain: "k12",
      capability: "module_action",
      entities: {},
      confidence: 0.72,
      requiresConfirmation: false,
      requiredPermission: "assistant:suggestions:read",
      suggestedTool: "executeModuleAction",
    };
  }

  if (isLikelyGeneralKnowledgeQuery(text)) {
    return {
      type: "ask",
      domain: "shared",
      capability: "general_knowledge",
      entities: {},
      confidence: 0.72,
      requiresConfirmation: false,
    };
  }

  return {
    type: "ask",
    domain: "shared",
    capability: /^(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(text)
      ? "greeting"
      : "general_conversation",
    entities: {},
    confidence: 0.55,
    requiresConfirmation: false,
  };
}

function getSessionIds(context: ProjectContext) {
  const userId = context.userId || "anonymous";
  return {
    userId,
    sessionId: context.conversationId || userId,
  };
}

/**
 * The module a message is asking about, from the words in the message itself.
 *
 * This is what a question *wants*, as opposed to what it is *about*. "How many
 * students are in it?" and "What is its attendance?" share a subject but need
 * completely different data, so the subject alone can never decide the answer.
 *
 * Ordered so the more specific topic wins: a message naming both attendance and
 * students is an attendance question about students, not a roster request.
 */
export function detectQuestionTopic(text: string) {
  if (/attendance|absent|present\b/.test(text)) return "attendance";
  if (/fee|fees|defaulter|dues|outstanding|collection/.test(text)) return "fees";
  if (/homework|assignment|classwork/.test(text)) return "homework";
  if (/subject|syllabus/.test(text)) return "subjects";
  if (/course|curriculum|chapter/.test(text)) return "courses";
  if (/result|marks|grade report|report card|merit/.test(text)) return "results";
  if (/admission|enquiry|application/.test(text)) return "admissions";
  if (/department|sub[- ]department/.test(text)) return "departments";
  if (/teacher|staff|faculty/.test(text)) return "teachers";
  if (/student|learner|pupil|roll|strength|enrol/.test(text)) return "students";
  return null;
}

/**
 * True when the message names its own module and does not lean on the previous
 * turn — "Show attendance for Standard 7" rather than "and for Standard 8?".
 *
 * Continuation heuristics are skipped for these, because a self-contained
 * question must be answered on its own terms even when the previous answer was
 * about something adjacent.
 */
export function namesOwnModule(text: string) {
  if (isContextualFollowUp(text)) {
    return false;
  }

  // Scope words (standard, division, class) are not topics: they say *where* to
  // look, not *what* to look at, so they never make a message self-contained.
  return detectQuestionTopic(text) !== null;
}

/**
 * Routes a message that cannot stand on its own — "Why?", "that department",
 * "which employees are affected?" — back to the record the previous answer was
 * about.
 *
 * This runs before the general-knowledge check, because otherwise a bare "Why?"
 * looks like a generic question and gets answered from the model's own head
 * instead of from the institute's data.
 */
export function getContextualFollowUpIntent(context: ProjectContext): ConversationIntent | null {
  const message = context.latestUserMessage.content;

  if (!isContextualFollowUp(message)) {
    return null;
  }

  const ids = getSessionIds(context);
  const resolved = resolveConversationFocus(
    getFollowUpState(ids.userId, ids.sessionId),
    message
  );

  if (!resolved) {
    return null;
  }

  const { focus } = resolved;
  const attributes = focus.attributes || {};

  const readAttribute = (keys: string[]) => {
    for (const key of keys) {
      const value = attributes[key];
      if (typeof value === "string" && value.trim()) return value.trim();
      if (typeof value === "number" && Number.isFinite(value)) return String(value);
    }
    return "";
  };

  // The subject is carried as concrete filters, not just as a label, so the tool
  // that answers the follow-up is scoped to the same records as the last answer.
  const entities: Record<string, unknown> = {
    focusKind: focus.kind,
    focusName: focus.name,
    ...(focus.id ? { focusId: focus.id } : {}),
  };

  if (focus.kind === "class" || focus.kind === "student") {
    const standard = readAttribute(["standard", "standardName", "standard_name"]);
    const division = readAttribute(["division", "divisionName", "division_name"]);
    if (standard) entities.focusStandard = standard;
    if (division) entities.focusDivision = division;
  }

  if (focus.kind === "student") {
    entities.focusStudentName = focus.name;
  }

  if (focus.kind === "department") {
    entities.focusDepartmentName = focus.name;
  }

  const base = {
    entities,
    confidence: 0.9,
    requiresConfirmation: false,
  } as const;

  const topic = detectQuestionTopic(message.toLowerCase());

  /**
   * What the follow-up asks for wins over what it is about. Asking "how many
   * students are in it?" while a class is in focus is a roster question scoped
   * to that class — not another attendance report.
   */
  switch (topic) {
    case "attendance":
      return focus.kind === "student"
        ? {
            ...base,
            type: "analyse",
            domain: "k12",
            capability: "student_attendance_detail",
            requiredPermission: "lms:attendance:read",
            suggestedTool: "getStudentAttendanceDetail",
          }
        : {
            ...base,
            type: "analyse",
            domain: "k12",
            capability: "student_attendance",
            requiredPermission: "lms:attendance:read",
            suggestedTool: "getAttendanceOverview",
          };
    case "students":
      return {
        ...base,
        type: "ask",
        domain: "k12",
        capability: "student_directory",
        requiredPermission: "lms:student:read",
        suggestedTool: "getStudentDirectory",
      };
    case "teachers":
      return focus.kind === "class"
        ? {
            ...base,
            type: "ask",
            domain: "k12",
            capability: "class_teachers",
            requiredPermission: "lms:teacher:read",
            suggestedTool: "getClassTeachers",
          }
        : {
            ...base,
            type: "ask",
            domain: "k12",
            capability: "teacher_directory",
            requiredPermission: "lms:teacher:read",
            suggestedTool: "getTeacherDirectory",
          };
    case "subjects":
      return {
        ...base,
        type: "ask",
        domain: "k12",
        capability: "subject_catalog",
        requiredPermission: "lms:subject:read",
        suggestedTool: "getSubjectCatalog",
      };
    case "courses":
      return {
        ...base,
        type: "ask",
        domain: "k12",
        capability: "course_catalog",
        requiredPermission: "lms:course:read",
        suggestedTool: "getCourseCatalog",
      };
    case "fees":
      return {
        ...base,
        type: "analyse",
        domain: "k12",
        capability: "unpaid_fees",
        requiredPermission: "lms:fees:defaulter:read",
        suggestedTool: "listFeesDefaulters",
      };
    case "departments":
      return {
        ...base,
        type: "analyse",
        domain: "k12",
        capability: "department_insight",
        requiredPermission: "hrms:department:read",
        suggestedTool: "getDepartmentInsight",
      };
    default:
      break;
  }

  // No topic of its own — a bare "Why?" or "tell me more". Explain the subject.
  switch (focus.kind) {
    case "department":
      return {
        ...base,
        type: "analyse",
        domain: "k12",
        capability: "department_insight",
        requiredPermission: "hrms:department:read",
        suggestedTool: "getDepartmentInsight",
      };
    case "class":
      return {
        ...base,
        type: "analyse",
        domain: "k12",
        capability: "student_attendance",
        requiredPermission: "lms:attendance:read",
        suggestedTool: "getAttendanceOverview",
      };
    case "student":
      return {
        ...base,
        type: "analyse",
        domain: "k12",
        capability: "student_attendance_detail",
        requiredPermission: "lms:attendance:read",
        suggestedTool: "getStudentAttendanceDetail",
      };
    case "teacher":
      return {
        ...base,
        type: "ask",
        domain: "k12",
        capability: "teacher_directory",
        requiredPermission: "lms:teacher:read",
        suggestedTool: "getTeacherDirectory",
      };
    default:
      return {
        ...base,
        type: "analyse",
        domain: "k12",
        capability: "data_analysis",
        requiredPermission: "lms:analysis:read",
        suggestedTool: "analyzeLmsData",
      };
  }
}

/**
 * Direct-lookup routing for the modules whose data comes from the LMS
 * directories and catalogues. These are checked before the older keyword rules
 * so that, for example, "show today's attendance" reaches the attendance
 * workflow rather than the activity stream.
 */
export function getModuleDataIntent(text: string): ConversationIntent | null {
  const base = {
    entities: {},
    confidence: 0.93,
    requiresConfirmation: false,
  } as const;

  if (/attendance|absent|present/.test(text)) {
    // Teacher attendance keeps its existing daily-report workflow.
    if (/teacher|staff|faculty/.test(text)) {
      return {
        ...base,
        type: "ask",
        domain: "k12",
        capability: "teacher_activity",
        requiredPermission: "lms:teacher_daily_report:read",
        suggestedTool: "getTeacherDailyReport",
      };
    }

    return {
      ...base,
      type: "ask",
      domain: "k12",
      capability: "student_attendance",
      requiredPermission: "lms:attendance:read",
      suggestedTool: "getAttendanceOverview",
    };
  }

  if (/department|sub[- ]department/.test(text)) {
    return {
      ...base,
      type: "ask",
      domain: "k12",
      capability: "department_directory",
      requiredPermission: "hrms:department:read",
      suggestedTool: "getDepartmentDirectory",
    };
  }

  if (/subject|syllabus/.test(text)) {
    return {
      ...base,
      type: "ask",
      domain: "k12",
      capability: "subject_catalog",
      requiredPermission: "lms:subject:read",
      suggestedTool: "getSubjectCatalog",
    };
  }

  if (/course|curriculum|chapter/.test(text)) {
    return {
      ...base,
      type: "ask",
      domain: "k12",
      capability: "course_catalog",
      requiredPermission: "lms:course:read",
      suggestedTool: "getCourseCatalog",
    };
  }

  // "Class strength of Standard 7 B" is a roster count for one named class,
  // so it belongs to the student directory rather than the class structure.
  if (
    /\b(class strength|strength of)\b/.test(text) &&
    /\b(standard|std|class|grade|division|section)\s*[-:]?\s*[a-z0-9]/.test(text)
  ) {
    return {
      ...base,
      type: "ask",
      domain: "k12",
      capability: "student_directory",
      requiredPermission: "lms:student:read",
      suggestedTool: "getStudentDirectory",
    };
  }

  if (/\b(class list|classes|section list|divisions|standards|class strength)\b/.test(text)) {
    return {
      ...base,
      type: "ask",
      domain: "k12",
      capability: "class_structure",
      requiredPermission: "lms:student:read",
      suggestedTool: "getClassStructure",
    };
  }

  if (/teacher|staff|faculty/.test(text)) {
    if (/assigned|teaches|teaching|which teacher/.test(text) && /class|standard|division|std/.test(text)) {
      return {
        ...base,
        type: "ask",
        domain: "k12",
        capability: "class_teachers",
        requiredPermission: "lms:teacher:read",
        suggestedTool: "getClassTeachers",
      };
    }

    if (/how many|count|total|list|show|all/.test(text)) {
      return {
        ...base,
        type: "ask",
        domain: "k12",
        capability: "teacher_directory",
        requiredPermission: "lms:teacher:read",
        suggestedTool: "getTeacherDirectory",
      };
    }
  }

  if (
    /student|learner|pupil/.test(text) &&
    /how many|count|total|strength|list|show|all students|students of|students in|students from/.test(text) &&
    !/fee|defaulter|homework|assignment|admission|result|marks/.test(text)
  ) {
    return {
      ...base,
      type: "ask",
      domain: "k12",
      capability: "student_directory",
      requiredPermission: "lms:student:read",
      suggestedTool: "getStudentDirectory",
    };
  }

  if (
    /fee|fees/.test(text) &&
    /total|summary|collection rate|collected|outstanding|demand|how much/.test(text)
  ) {
    return {
      ...base,
      type: "analyse",
      domain: "k12",
      capability: "fees_summary",
      requiredPermission: "lms:fees:defaulter:read",
      suggestedTool: "getFeesSummary",
    };
  }

  return null;
}

function getDeterministicIntent(context: ProjectContext): ConversationIntent | null {
  const text = context.latestUserMessage.content.trim().toLowerCase();

  if (!text) {
    return null;
  }

  // A message that names its own module answers its own question. Continuation
  // heuristics look at what the *previous* turn was about, so letting them run
  // here is how "Show attendance for Standard 7" ends up returning the student
  // list from the turn before it.
  const selfContained = namesOwnModule(text);

  const continuationIntent = selfContained
    ? null
    : getContextualContinuationIntent(context);
  if (continuationIntent) {
    return continuationIntent;
  }

  if (/^(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(text)) {
    return {
      type: "ask",
      domain: "shared",
      capability: "greeting",
      entities: {},
      confidence: 0.95,
      requiresConfirmation: false,
    };
  }

  // A pronoun or a bare "Why?" belongs to whatever the last answer was about,
  // so it is resolved before the general-knowledge branch can claim it.
  const followUpIntent = getContextualFollowUpIntent(context);
  if (followUpIntent) {
    return followUpIntent;
  }

  if (isLikelyGeneralKnowledgeQuery(text)) {
    return {
      type: "ask",
      domain: "shared",
      capability: "general_knowledge",
      entities: {},
      confidence: 0.9,
      requiresConfirmation: false,
    };
  }

  // Analytical questions are routed to the cross-module analysis tool so the
  // model reasons over real retrieved rows instead of a single record lookup.
  if (isAnalyticalLmsQuery(text)) {
    return {
      type: "analyse",
      domain: "k12",
      capability: "data_analysis",
      entities: {},
      confidence: 0.9,
      requiresConfirmation: false,
      requiredPermission: "lms:analysis:read",
      suggestedTool: "analyzeLmsData",
    };
  }

  const moduleDataIntent = getModuleDataIntent(text);
  if (moduleDataIntent) {
    return moduleDataIntent;
  }

  if (/admission|application|enquiry/.test(text)) {
    return {
      type: "ask",
      domain: "k12",
      capability: /pending|open/.test(text)
        ? "pending_admissions"
        : "admission_enquiries",
      entities: {},
      confidence: 0.95,
      requiresConfirmation: false,
      requiredPermission: "admission:enquiry:read",
      suggestedTool: "listAdmissionEnquiries",
    };
  }

  if (/confirm admission|admission confirmation|approve admission/.test(text)) {
    return {
      type: "do",
      domain: "k12",
      capability: "admission_confirmation",
      entities: {},
      confidence: 0.96,
      requiresConfirmation: false,
      requiredPermission: "admission:enquiry:read",
      suggestedTool: "findAdmissionCandidate",
    };
  }

  if (
    /homework|assignment|submission|show homework|home work|classwork/.test(text)
  ) {
    return {
      type: "ask",
      domain: "k12",
      capability: "homework",
      entities: {},
      confidence: 0.96,
      requiresConfirmation: false,
      requiredPermission: "lms:homework:read",
      suggestedTool: "listHomework",
    };
  }

  if (/activity|today|upcoming|recent|feed|stream/.test(text)) {
    return {
      type: "ask",
      domain: "k12",
      capability: "activity_stream",
      entities: {},
      confidence: 0.95,
      requiresConfirmation: false,
      requiredPermission: "lms:activity:read",
      suggestedTool: "getActivityStream",
    };
  }

  if (/dashboard|progress|performance|score|analysis/.test(text)) {
    return {
      type: "analyse",
      domain: "k12",
      capability: "dashboard_insights",
      entities: {},
      confidence: 0.95,
      requiresConfirmation: false,
      requiredPermission: "lms:dashboard:read",
      suggestedTool: "getLmsDashboard",
    };
  }

  if (/result report|marks report|report card|merit|classwise|exam result|result\b|marks\b/.test(text)) {
    return {
      type: "analyse",
      domain: "k12",
      capability: "result_report",
      entities: {},
      confidence: 0.95,
      requiresConfirmation: false,
      requiredPermission: "lms:result:read",
      suggestedTool: "getResultReport",
    };
  }

  if (/unpaid fee|pending fee|fees defaulter|defaulter/.test(text)) {
    return {
      type: "analyse",
      domain: "k12",
      capability: "unpaid_fees",
      entities: {},
      confidence: 0.95,
      requiresConfirmation: false,
      requiredPermission: "lms:fees:defaulter:read",
      suggestedTool: "listFeesDefaulters",
    };
  }

  if (/teacher.*absent|absent teacher|teacher daily|teachers are absent/.test(text)) {
    return {
      type: "ask",
      domain: "k12",
      capability: "teacher_activity",
      entities: {},
      confidence: 0.95,
      requiresConfirmation: false,
      requiredPermission: "lms:teacher_daily_report:read",
      suggestedTool: "getTeacherDailyReport",
    };
  }

  if (
    /collect fee|collect fees|fee collection|pay fee for|pay fees for|take fee from/.test(text)
  ) {
    return {
      type: "do",
      domain: "k12",
      capability: "fee_collection",
      entities: {},
      confidence: 0.96,
      requiresConfirmation: false,
      requiredPermission: "lms:fees:collect",
      suggestedTool: "findStudentFeeRecord",
    };
  }

  if (/student|learner|parent|guardian/.test(text)) {
    return {
      type: "ask",
      domain: "k12",
      capability: "student_lookup",
      entities: {},
      confidence: 0.84,
      requiresConfirmation: false,
      requiredPermission: "lms:student:read",
      suggestedTool: "searchStudents",
    };
  }

  if (/attendance|timetable|schedule|exam|teacher|parent portal|report\b/.test(text)) {
    return {
      type: "guide",
      domain: "shared",
      capability: "contextual_guidance",
      entities: {},
      confidence: 0.75,
      requiresConfirmation: false,
      requiredPermission: "assistant:suggestions:read",
      suggestedTool: "getContextualSuggestions",
    };
  }

  if (
    /(student|learner|parent|guardian|teacher|staff|attendance|timetable|schedule|exam|library|transport|hostel|account|notification|marks|result|fees?|homework|assignment|classwork|module|route)/.test(text)
  ) {
    return {
      type: "ask",
      domain: "k12",
      capability: "module_action",
      entities: {},
      confidence: 0.84,
      requiresConfirmation: false,
      requiredPermission: "assistant:suggestions:read",
      suggestedTool: "executeModuleAction",
    };
  }

  return null;
}

function getPermissions(profileName?: string) {
  const normalized = normalizeRoleName(profileName);
  if (!normalized) {
    return ["assistant:suggestions:read"];
  }

  if (normalized.includes("student")) {
    return [
      "assistant:suggestions:read",
      "lms:dashboard:read",
      "lms:activity:read",
      "lms:result:read",
      "lms:student:read",
      "lms:subject:read",
      "lms:course:read",
      "lms:attendance:read",
    ];
  }

  if (normalized.includes("teacher")) {
    return [
      "assistant:suggestions:read",
      "lms:dashboard:read",
      "lms:activity:read",
      "lms:homework:read",
      "lms:result:read",
      "lms:teacher_daily_report:read",
      "lms:student:read",
      "lms:teacher:read",
      "lms:subject:read",
      "lms:course:read",
      "lms:attendance:read",
      "lms:analysis:read",
    ];
  }

  return [
    "*",
    "admission:enquiry:read",
    "assistant:suggestions:read",
    "lms:dashboard:read",
    "lms:activity:read",
    "lms:homework:read",
    "lms:fees:defaulter:read",
    "lms:fees:collect",
    "lms:result:read",
    "lms:student:read",
    "lms:teacher_daily_report:read",
    "lms:teacher:read",
    "lms:subject:read",
    "lms:course:read",
    "lms:attendance:read",
    "lms:analysis:read",
    "hrms:department:read",
  ];
}

function hasPermission(profileName: string | undefined, permission: string) {
  const permissions = getPermissions(profileName);
  return permissions.includes("*") || permissions.includes(permission);
}

export const lmsK12Adapter: ProjectAIAdapter = {
  projectId: "lms_k12",
  projectName: "Teach Connect LMS_K12",
  async resolveContext({ request, trustedContext }) {
    const latestUserMessage = getLatestUserMessage(request.messages);

    return {
      projectId: "lms_k12",
      projectName: "Teach Connect LMS_K12",
      conversationId: trustedContext.conversationId,
      userId: trustedContext.userId,
      subInstituteId: trustedContext.subInstituteId,
      role: trustedContext.role,
      profileName: trustedContext.profileName || trustedContext.role,
      profileId: trustedContext.profileId,
      clientId: trustedContext.clientId,
      employeeNo: trustedContext.employeeNo,
      orgId: trustedContext.orgId,
      token: trustedContext.token,
      baseUrl: trustedContext.baseUrl || process.env.NEXT_PUBLIC_ERP_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL_DEV || process.env.NEXT_PUBLIC_API_BASE_URL_PROD,
      syear: trustedContext.syear,
      termId: trustedContext.termId,
      route: trustedContext.route,
      cookieHeader: trustedContext.cookieHeader,
      referer: trustedContext.referer,
      request,
      latestUserMessage,
      messageHistory: request.messages,
      detectedLanguage: detectConversationLanguage(latestUserMessage.content),
    };
  },
  async classifyIntent(context) {
    const deterministicIntent = getDeterministicIntent(context);
    if (deterministicIntent) {
      return deterministicIntent;
    }

    try {
      const { object } = await generateObject({
        model: createAiModel(),
        schema: classifierOutputSchema,
        prompt: `Classify the user's request for the Teach Connect LMS conversational assistant.

User profile: ${context.profileName || "unknown"}
Route context: ${context.route || "dashboard"}
User message: ${context.latestUserMessage.content}

Prefer these mappings:
- admission enquiries, pending admission applications, open admissions, admission inquiries for today -> listAdmissionEnquiries
- dashboard, progress, score, performance -> getLmsDashboard
- activity stream, today, recent, upcoming -> getActivityStream
- homework, assignments, submissions -> listHomework
- unpaid fees, defaulters -> listFeesDefaulters
- teacher absence, teacher daily activity -> getTeacherDailyReport
- result report, merit report, classwise grade, report card -> getResultReport
- marks report, marksheet, exam marks -> getResultReport
- route or module help -> getContextualSuggestions
- how many students, class strength, students of a standard or division -> getStudentDirectory
- how many teachers, teacher or staff list -> getTeacherDirectory
- which teachers are assigned to a class -> getClassTeachers
- available standards, divisions or class structure -> getClassStructure
- available subjects or subjects of a standard -> getSubjectCatalog
- available courses, curriculum or chapters -> getCourseCatalog
- student attendance for a date, class or division -> getAttendanceOverview
- one named student's attendance record or percentage -> getStudentAttendanceDetail
- departments, sub-departments or employee distribution -> getDepartmentDirectory
- total fee demand, collection, outstanding amount or collection rate -> getFeesSummary
- comparisons, rankings, risk, trends, skill gaps, "which X needs the most", or any question needing more than one module -> analyzeLmsData
- student, parent, teacher, staff, attendance, timetable, exam, library, transport, hostel, accounts, notification, marks, fees, homework, or other module lookups and actions -> executeModuleAction
- greetings, simple chit-chat, and general knowledge questions -> shared capability with no tool call

If the request mentions admission, enquiry, inquiries, or applications, prefer the admissions tool even if words like today, recent, or latest are also present.

For homework requests, grade, standard, division, subject, and date filters are optional.
If the user does not provide those filters, use listHomework with empty filters and rely on the trusted LMS session scope instead of asking for grade or standard first.
If the user asks a simple non-LMS question, a greeting, or a basic general knowledge question, do not route to an LMS tool.

Return only structured output.`,
      });

      return normalizeClassifierIntent(object);
    } catch (error) {
      console.warn("[lms-ai.intent] falling back to rules", error);
      return fallbackIntent(context);
    }
  },
  async buildSystemPrompt(context, intent) {
    const allowedTools = getAllowedToolNamesForProfile(context.profileName);
    const basePrompt = getDefaultSystemPrompt(context, intent.capability, allowedTools);
    const ids = getSessionIds(context);
    const conversationState = describeFollowUpState(
      getFollowUpState(ids.userId, ids.sessionId)
    );

    const groundingRules = [
      "GROUNDING — non negotiable:",
      "Never state a number, name, date, status or total about this institute unless it came from a tool result in this conversation.",
      "Never estimate, extrapolate, average, or carry a figure over from an example or from your own knowledge.",
      "Name the actual record whenever a tool returned one — the department, class, division, subject, course, teacher or student by name — instead of describing it generically.",
      "When a tool result reports that the information is unavailable, say so plainly and give the reason in business language. Do not substitute an estimate.",
      "When a result lists signals or datasets that could not be read, say which ones were missing rather than filling the gap yourself.",
      "If the data supports a count but not a cause, give the count and say the data does not show the cause. Offer the specific extra information that would answer it.",
    ].join(" ");

    const followUpRules = [
      "FOLLOW-UPS:",
      "Treat every message as part of one continuous conversation. Resolve pronouns and elisions — 'why?', 'that department', 'their names', 'and for Standard 8' — against the previous turns and the conversation state below.",
      "When a follow-up changes only one filter, reuse every other filter from the previous turn rather than asking the user to repeat it.",
      "When a follow-up asks for the detail behind a figure you already gave, fetch the records that carry that detail with the same scope.",
    ].join(" ");

    const styleRules = [
      "STYLE:",
      "Lead with the answer, in plain business language, as if speaking to a school administrator.",
      "Never expose tool names, function names, dataset ids, route paths, controller names, table names, raw JSON, or internal status values. The user must never see text such as a tool identifier or a serialised object.",
      "Present several records as a short list, not as prose or as a data structure.",
      "Format money in Indian rupees with Indian digit grouping. Keep identifiers exactly as the backend returned them, and only mention an identifier when the user asked for one.",
      "Do not claim to have made a change, an approval or a payment: this conversation reads data only.",
    ].join(" ");

    const sections = [
      basePrompt,
      groundingRules,
      followUpRules,
      styleRules,
    ];

    if (intent.capability === "data_analysis") {
      sections.push(
        [
          "THIS QUESTION IS ANALYTICAL:",
          "Retrieve the data first with only the datasets the question needs, then explain, compare or rank strictly using the figures that came back.",
          "Show what the ranking rests on by quoting the retrieved numbers, and separate the measured fact from your interpretation of it.",
        ].join(" ")
      );
    }

    const focusName =
      typeof intent.entities?.focusName === "string" ? intent.entities.focusName : "";
    const focusKind =
      typeof intent.entities?.focusKind === "string" ? intent.entities.focusKind : "";

    if (focusName) {
      sections.push(
        `THIS MESSAGE IS A FOLLOW-UP about the ${focusKind || "record"} "${focusName}", which the previous answer was about. Answer about that record; do not treat the question as a new topic and do not ask the user which one they mean.`
      );
    }

    if (conversationState) {
      sections.push(
        `CONVERSATION STATE — what has already been retrieved in this session (context for you, never quote it back to the user):\n${conversationState}`
      );
    }

    return sections.filter(Boolean).join("\n\n");
  },
  async getToolDefinitions() {
    return getLmsToolDefinitions();
  },
  async getAllowedToolNames(context) {
    return getAllowedToolNamesForProfile(context.profileName);
  },
  async validatePermission(intent, context) {
    if (!intent.requiredPermission) {
      return;
    }

    if (!hasPermission(context.profileName, intent.requiredPermission)) {
      // Phrased for the chat surface: the message is what the user sees when a
      // request falls outside their profile's rights.
      throw new Error(
        `Your ${context.profileName || "current"} profile does not have access to this information in the LMS, so I can't answer that. (Required right: ${intent.requiredPermission}.)`
      );
    }
  },
};
