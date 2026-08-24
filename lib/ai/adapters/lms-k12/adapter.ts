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
  return /dashboard|progress|performance|score|analysis|result|marks report|report card|activity|feed|stream|homework|assignment|submission|fee|defaulter|teacher|class|student|attendance|admission|application|enquiry|module|route|page|screen|lms/.test(
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

function getDeterministicIntent(context: ProjectContext): ConversationIntent | null {
  const text = context.latestUserMessage.content.trim().toLowerCase();

  if (!text) {
    return null;
  }

  const continuationIntent = getContextualContinuationIntent(context);
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
    return getDefaultSystemPrompt(context, intent.capability, allowedTools);
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
      throw new Error(
        `Permission denied for ${intent.requiredPermission}. Profile ${context.profileName || "unknown"} cannot perform this action.`
      );
    }
  },
};
