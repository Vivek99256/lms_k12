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
  ConversationPermissionError,
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
  // `template`, `approval`, `recommendation` and `workflow` are listed because they
  // name things this product actually holds. Without them a sentence like "which AI
  // templates are available?" or "what needs my approval?" carried no recognised LMS
  // word, so the general-knowledge branch claimed it and answered from the model's
  // own head instead of from the library or the approval queue.
  return /dashboard|progress|performance|score|analysis|result|marks report|report card|activity|feed|stream|homework|assignment|submission|fee|defaulter|teacher|class|student|attendance|admission|application|enquiry|template|approval|recommendation|workflow|module|route|page|screen|lms|subject|course|curriculum|syllabus|chapter|department|division|standard|staff|employee|skill|training|institute|school/.test(
    text
  );
}

/**
 * Questions that need reasoning across retrieved data rather than a single
 * record lookup — comparisons, rankings, risk, trends and summaries. Gated on
 * the message also looking LMS-related so ordinary "why/how" chit-chat is not
 * routed into a data-analysis tool call.
 */
/**
 * Academic-risk questions, which belong to the intelligence layer rather than to the
 * generic analysis tool.
 *
 * This has to be consulted *before* `isAnalyticalLmsQuery`, because that matcher
 * claims the word "risk" and routes it to `analyzeLmsData` — a cross-module dataset
 * loader that can only ever return counts. That is why "analyse this student's
 * academic risk" used to come back as an enrollment breakdown: the deterministic
 * fast path answered before the classifier, and the eight intelligence tools were
 * never candidates.
 *
 * Deliberately narrow. "Which students have the highest fee risk?" is a fee question
 * and must stay with the analysis tool, so a fee/payment mention disqualifies the
 * match outright.
 */
export function getIntelligenceCapability(text: string): string | null {
  // Fees, transport and library carry their own notion of "risk" and are already
  // served well. Only academic risk belongs to the agent.
  if (/\b(fee|fees|payment|due|defaulter|transport|library|hostel)\b/.test(text)) {
    return null;
  }

  // Acting on a specific item, checked before the "show me the queue" branches
  // below. Without these, "approve recommendation 7" matches no intelligence
  // capability at all and falls through to the admission slot-filling flow, which
  // is where the word "approve" otherwise lives.
  const actOnApproval = text.match(
    /\b(approve|reject)\b[^0-9]{0,40}\b(approval|workflow step|step)\b[^0-9]{0,10}(\d+)/
  );

  if (actOnApproval) {
    return "resolve_approval";
  }

  if (/\b(approve|reject)\b[^0-9]{0,40}\brecommendation\b[^0-9]{0,10}\d+/.test(text)) {
    return "approve_recommendation";
  }

  // Checked before the recommendation branch: a workflow step waiting on a person
  // is a different queue from a recommendation waiting on one, and the words
  // overlap heavily.
  if (/\b(workflow (approvals?|steps?)|stuck workflows?|waiting (workflow|steps?)|pending (workflow )?steps?)\b/.test(text)) {
    return "workflow_approvals";
  }

  if (/\b(what needs my approval|pending recommendations?|awaiting approval|approval queue)\b/.test(text)) {
    return "pending_recommendations";
  }

  if (/\b(open cases?|flagged (students?|by the system)|what has the system flagged)\b/.test(text)) {
    return "ai_cases";
  }

  const mentionsRisk =
    /\b(academic risk|at[\s-]?risk|risk level|struggling|failing|falling behind|needs? intervention|underperforming)\b/.test(
      text
    );

  if (!mentionsRisk) {
    return null;
  }

  // "Why ... at risk" and "what is the evidence" read an existing case rather than
  // re-running detection, which is both cheaper and the honest answer.
  if (/\b(why|reason|reasons|evidence|proof|how do you know|justify)\b/.test(text)) {
    return "explain_risk";
  }

  return "academic_risk";
}

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

  // Same precedence as the fast path: academic risk before generic analysis.
  const intelligenceIntent = getIntelligenceIntent(text);
  if (intelligenceIntent) {
    return { ...intelligenceIntent, confidence: 0.72 };
  }

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
      // A fee follow-up while one student is in focus is that student's own fee
      // record, not the institute-wide defaulter list. Every other topic here
      // already branches on focus.kind; fees was the one that did not, so
      // "summarise their pending fees" after a student answer returned a list of
      // other people's dues.
      if (focus.kind === "student" && !MANY_STUDENT_FEE_SUBJECT.test(message.toLowerCase())) {
        return {
          ...base,
          type: "analyse",
          domain: "k12",
          capability: focus.id ? "student_fee_details" : "student_fee_lookup",
          requiredPermission: "lms:fees:collect",
          suggestedTool: focus.id ? "getStudentFeeDetails" : "findStudentFeeRecord",
        };
      }

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

/**
 * Turns an academic-risk question into the intelligence tool that answers it.
 *
 * Shared by the deterministic fast path and the error fallback so both agree; the
 * classifier prompt carries the same mapping in words.
 */
function getIntelligenceIntent(text: string): ConversationIntent | null {
  const capability = getIntelligenceCapability(text);

  if (!capability) {
    return null;
  }

  const suggestedTool = {
    academic_risk: "findStudentsAtRisk",
    explain_risk: "explainStudentRisk",
    ai_cases: "listIntelligenceCases",
    pending_recommendations: "listRecommendationsAwaitingApproval",
    workflow_approvals: "listWorkflowApprovals",
    approve_recommendation: "approveRecommendationAction",
    resolve_approval: "resolveWorkflowApproval",
  }[capability];

  if (!suggestedTool) {
    return null;
  }

  // "Approve recommendation 7" names its target in the sentence. Carrying the id and
  // the verb on the intent is what lets the deterministic path call the tool with
  // real arguments instead of calling it empty and failing schema validation.
  const entities: Record<string, unknown> = {};

  if (capability === "approve_recommendation" || capability === "resolve_approval") {
    const id = text.match(/\b(?:recommendation|approval|workflow step|step)\b[^0-9]{0,10}(\d+)/);

    if (id) {
      entities.targetId = Number(id[1]);
    }

    entities.decision = /\breject\b/.test(text) ? "rejected" : "approved";
  }

  return {
    type: "analyse",
    domain: "k12",
    capability,
    entities,
    confidence: 0.88,
    requiresConfirmation: false,
    requiredPermission: "lms:student:read",
    suggestedTool,
  };
}

/**
 * The id of the record the current page is about, when that record is a student.
 *
 * A fee question asked from a student's page names its subject by standing on it,
 * not by spelling it out, so "this student" has to be readable from the page
 * context before the message can be routed to a single-student tool.
 */
function getPageStudentId(context: ProjectContext): string {
  if ((context.entityType || "").toLowerCase() !== "student") {
    return "";
  }

  const id = context.entityId;

  if (typeof id === "number" && Number.isFinite(id)) {
    return String(id);
  }

  return typeof id === "string" ? id.trim() : "";
}

/**
 * The verbs that describe a piece of work rather than a lookup.
 *
 * One of these is ordinary phrasing — "explain the reason for this case" is still a
 * single read. Two or more in one sentence is a request for several things at once,
 * which no single tool can answer.
 */
const REASONING_VERBS =
  /\b(analy[sz]e|analysis|identify|explain|compare|summari[sz]e|group|prioriti[sz]e|recommend|prepare|draft|review|rank|evaluate|assess|outline)\b/g;

/**
 * True when the message asks for more than one tool's worth of work.
 *
 * This exists because of a real failure mode: every narrow keyword branch below was
 * written for a short, simple phrasing, and each one matches on a single word. A
 * long question that happens to contain "fees", or "template", or "falling behind"
 * was therefore collapsed into one lookup, and all the analysis, grouping and
 * drafting the user actually asked for was silently discarded. The turn then read
 * as plain conversation, because that is all that had run.
 *
 * Checked before those branches so the planner gets the turn and can sequence
 * several tools. Deliberately conservative — a short question, or one with a single
 * task verb, is still a lookup and still routes exactly as it did before.
 */
export function isMultiStepQuery(text: string): boolean {
  if (text.trim().split(/\s+/).length < 14) {
    return false;
  }

  const verbs = new Set(
    (text.match(REASONING_VERBS) || []).map((verb) => verb.toLowerCase())
  );

  return verbs.size >= 2;
}

/**
 * A request that should be answered from the template library.
 *
 * The library is the existing document template store; the assistant reads its
 * `ai` category. Routing here rather than to the model is the point: a school that
 * has designed its own wording should get that wording back, versioned and
 * approved, not a fresh paraphrase of it.
 */
export function getAiTemplateIntent(text: string): ConversationIntent | null {
  if (!/\btemplates?\b/.test(text)) {
    return null;
  }

  // A question that merely *mentions* a template while asking for analysis, grouping
  // and a drafted message is not a template lookup — the template is its last step.
  // Claiming it here collapsed the whole request into a single library fetch.
  if (isMultiStepQuery(text)) {
    return null;
  }

  // The designer's own screens own creation and editing; the assistant reads.
  if (/\b(create|design|edit|delete|rename|publish|duplicate)\b/.test(text)) {
    return null;
  }

  const base = {
    type: "ask" as const,
    domain: "k12" as const,
    entities: {},
    confidence: 0.92,
    requiresConfirmation: false,
    requiredPermission: "lms:document_template:read",
  };

  // "Which templates are available?" wants the list; "use the X template" wants one.
  const wantsList =
    /\b(which|what|list|show|available|all|any)\b/.test(text) &&
    !/\b(use|open|apply|draft\s+(from|with)|fill)\b/.test(text);

  return wantsList
    ? { ...base, capability: "ai_templates", suggestedTool: "listAiTemplates" }
    : { ...base, capability: "ai_template_use", suggestedTool: "getAiTemplate" };
}

/**
 * A request to act on one admission, as opposed to a request to see the list.
 *
 * Kept as a named constant because two branches need the same reading of the
 * sentence: the intent router, and the module router that decides whether a
 * follow-up still belongs to the admissions workflow.
 */
export const ADMISSION_CONFIRM_REQUEST =
  /\badmission\s+confirmation\b|\b(confirm|approve|finalise|finalize|proceed\s+with)\b[^.?!]{0,40}\badmission\b|\b(confirm|approve|finalise|finalize)\b[^.?!]{0,25}\b(candidate|enquiry|application)\b/;

/** A fee question that is about one student rather than about a defaulter list. */
const SINGLE_STUDENT_FEE_SUBJECT =
  /\b(?:this|that|the)\s+student\b|\bstudent'?s\b|\bhis\b|\bher\b|\btheir\b|\bfor\s+(?:this|that)\s+(?:child|kid|learner|pupil)\b/;

/** A fee question that asks across students, which the defaulter list already answers. */
const MANY_STUDENT_FEE_SUBJECT =
  /\bdefaulters?\b|\bwhich\s+students?\b|\bhow\s+many\s+students?\b|\blist\s+(?:of\s+)?students?\b|\ball\s+students?\b|\bwho\s+(?:has|have)\s+not\s+paid\b|\bstudents?\s+with\s+(?:pending|unpaid|outstanding)\b/;

/**
 * Fee questions about a single student.
 *
 * These have to be claimed before the analytical branch below. "Summarise this
 * student's pending fees" matches `summarise`, so it was being routed to the
 * cross-module analysis tool and handed to the planner — which has no
 * single-student fee tool to plan with, and settled on the result report instead.
 * The user then got asked which *result report* they wanted, for a fees question.
 *
 * Deliberately narrow: it fires only when the message is about fees AND names one
 * student, so defaulter lists, collection totals and every non-fee analytical
 * question route exactly as they did before.
 */
export function getStudentFeeIntent(
  context: ProjectContext,
  text: string
): ConversationIntent | null {
  if (!/\bfee|fees|dues|outstanding|unpaid\b/.test(text)) {
    return null;
  }

  // A question spanning students belongs to the defaulter list, not to one record.
  if (MANY_STUDENT_FEE_SUBJECT.test(text)) {
    return null;
  }

  // Collecting a fee is an action with its own workflow; only reading is claimed here.
  if (/\bcollect\b|\bpay\b|\bpayment\s+of\b|\breceive\b/.test(text)) {
    return null;
  }

  const pageStudentId = getPageStudentId(context);
  const namesOneStudent = SINGLE_STUDENT_FEE_SUBJECT.test(text);

  if (!namesOneStudent && !pageStudentId) {
    return null;
  }

  // With an id in hand the detail tool can run straight away. Without one, the
  // lookup tool finds the student first and the detail call follows from its result,
  // which is the same two-step the fee collection flow already uses.
  return pageStudentId
    ? {
        type: "analyse",
        domain: "k12",
        capability: "student_fee_details",
        entities: { focusStudentId: pageStudentId },
        confidence: 0.94,
        requiresConfirmation: false,
        requiredPermission: "lms:fees:collect",
        suggestedTool: "getStudentFeeDetails",
      }
    : {
        type: "analyse",
        domain: "k12",
        capability: "student_fee_lookup",
        entities: {},
        confidence: 0.9,
        requiresConfirmation: false,
        requiredPermission: "lms:fees:collect",
        suggestedTool: "findStudentFeeRecord",
      };
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

  // A question asking for several things at once goes to the planner, before any of
  // the single-tool branches can claim it on one matched keyword. Without this,
  // "analyse the students with pending fees, explain why, group them by priority and
  // draft a parent message" was answered by whichever branch matched first — and the
  // reasoning, grouping and drafting never ran at all.
  //
  // Placed ahead of the intelligence layer deliberately: a cross-module request that
  // happens to say "falling behind" is an analysis, not an academic-risk case. A
  // question that genuinely asks for the risk agent ("which students are at academic
  // risk and need intervention?") carries only one task verb and still routes there.
  if (isMultiStepQuery(text)) {
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

  // Academic risk belongs to the intelligence layer, and has to be claimed before
  // the analytical branch below — that branch matches on "risk" and would send the
  // question to a dataset loader that can only return counts.
  const intelligenceIntent = getIntelligenceIntent(text);
  if (intelligenceIntent) {
    return intelligenceIntent;
  }

  // One student's fees is a record lookup, not a cross-module analysis. Claimed
  // before the analytical branch because "summarise" would otherwise take it there.
  const studentFeeIntent = getStudentFeeIntent(context, text);
  if (studentFeeIntent) {
    return studentFeeIntent;
  }

  // Templates come from the library, not from the model. Claimed before the
  // analytical branch for the same reason as fees: "draft" and "prepare" sit in
  // that regex, and a template request routed to cross-module analysis would have
  // the model invent wording the school has already designed.
  const templateIntent = getAiTemplateIntent(text);
  if (templateIntent) {
    return templateIntent;
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

  // "Confirm the admission for Riya" asks to act on one candidate, not to list
  // every enquiry. The generic branch below matches the bare word "admission", so
  // it swallowed every natural confirm phrasing and re-showed the whole list —
  // which is what made the user pick from five records they had not asked for. The
  // narrower `confirm admission` branch further down could never be reached,
  // because "confirm THE admission" does not match it and the generic branch had
  // already returned.
  if (ADMISSION_CONFIRM_REQUEST.test(text)) {
    return {
      type: "do",
      domain: "k12",
      capability: "admission_confirmation",
      entities: {},
      confidence: 0.95,
      requiresConfirmation: false,
      requiredPermission: "admission:enquiry:read",
      suggestedTool: "findAdmissionCandidate",
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
      // Reading the template library. Templates hold no student rows; the data
      // merged into one is fetched separately under that data own permission.
      "lms:document_template:read",
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
    "lms:document_template:read",
    "hrms:department:read",
  ];
}

function hasPermission(profileName: string | undefined, permission: string) {
  const permissions = getPermissions(profileName);
  return permissions.includes("*") || permissions.includes(permission);
}

/**
 * The CURRENT PAGE block: where the user is standing, and what is on the screen.
 *
 * This is what makes "summarise these", "why is this student at risk?" and "which of
 * these need attention?" answerable without the user restating what they are looking
 * at. Three rules keep it from doing harm:
 *
 *  - It describes; it never authorises. Tools re-derive scope from the session, so a
 *    page claiming to show records the user may not read changes nothing.
 *  - The listed rows are a *window*, not the dataset. The model is told so explicitly,
 *    because a summary drawn from 25 of 300 rows and presented as the whole is worse
 *    than no summary.
 *  - Page context loses to an explicit reference. If the user names a different record,
 *    that one wins — the page is a default subject, not a constraint.
 *
 * Returns "" when the page said nothing, in which case the prompt is unchanged from
 * what it was before any of this existed.
 */
function describeCurrentPage(context: ProjectContext): string {
  const page = context.page;
  const lines: string[] = [];

  const place = context.moduleLabel || context.module;
  if (place) {
    lines.push(
      `The user is in the ${place} module${page?.title ? `, on "${page.title}"` : ""}.`
    );
  } else if (page?.title) {
    lines.push(`The user is on "${page.title}".`);
  }

  // The record the page is about. Stated with its id so tools are called with it
  // rather than the user being asked to name what they are already looking at.
  if (context.entityType && context.entityId) {
    lines.push(
      `They are viewing ${context.entityType} ${context.entityId}${
        context.entityLabel ? ` (${context.entityLabel})` : ""
      }.`,
      `Resolve "this ${context.entityType}", "this record", "them" and "here" to that record, and call tools with that identifier instead of asking again.`
    );
  }

  if (page?.searchQuery) {
    lines.push(`A search for "${page.searchQuery}" is active on this page.`);
  }

  if (page?.filters?.length) {
    const described = page.filters
      .map((filter) => `${filter.label || filter.key}: ${filter.value}`)
      .join(", ");
    lines.push(`The view is filtered by ${described}.`);
    lines.push(
      "Apply those same filters when retrieving data for this page, unless the user asks for something wider."
    );
  }

  if (page?.metrics?.length) {
    const described = page.metrics
      .map((metric) => `${metric.label || metric.key} = ${metric.value}${metric.unit ? ` ${metric.unit}` : ""}`)
      .join("; ");
    lines.push(`Figures currently displayed: ${described}.`);
  }

  if (typeof page?.selectedCount === "number" && page.selectedCount > 0) {
    lines.push(
      `The user has selected ${page.selectedCount} record${page.selectedCount === 1 ? "" : "s"}. "These", "the selected ones" and "them" refer to that selection.`
    );
  }

  if (page?.records?.length) {
    const total = page.recordCount ?? page.records.length;
    const window = page.records.length;

    lines.push(
      total > window
        ? `The page is showing ${window} of ${total} records. The rows below are only that window — if the user asks about the full set, retrieve it with a tool rather than generalising from these.`
        : `The page is showing ${total} record${total === 1 ? "" : "s"}.`
    );

    // Compact and labelled, so the model can name real rows rather than describing
    // "the records" generically — the same rule the grounding section imposes.
    const sample = page.records.slice(0, 10).map((record) => {
      const attributes = Object.entries(record)
        .filter(([key]) => key !== "id" && key !== "label")
        .slice(0, 4)
        .map(([key, value]) => `${key}: ${value}`)
        .join(", ");

      return `- ${record.label ?? record.id ?? "(unnamed)"}${attributes ? ` — ${attributes}` : ""}`;
    });

    lines.push(`Rows on screen:\n${sample.join("\n")}`);
  }

  // What the page can be narrowed by. Lets the assistant answer "what grades are
  // there?" from the screen, and resolve "Grade 5" to a real option rather than
  // guessing whether one exists.
  if (page?.facets?.length) {
    const described = page.facets
      .map((facet) => `${facet.label || facet.key}: ${facet.values.join(", ")}`)
      .join("; ");
    lines.push(`Options available on this page — ${described}.`);
  }

  if (page?.availableActions?.length) {
    const described = page.availableActions
      .map((action) => action.label || action.key)
      .join(", ");
    lines.push(
      `Actions available on this page: ${described}. Use these when the user asks what they can do here; do not invent others.`
    );
  }

  if (!lines.length) {
    return "";
  }

  lines.push(
    "This is context, not a limit. If the user asks about something outside this page, answer it from the right data source instead of telling them to navigate somewhere else.",
    "If the user clearly names a different record, use the one they named."
  );

  return `CURRENT PAGE:\n${lines.join("\n")}`;
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
      entityType: trustedContext.entityType,
      entityId: trustedContext.entityId,
      entityLabel: trustedContext.entityLabel,
      module: trustedContext.module,
      moduleLabel: trustedContext.moduleLabel,
      page: trustedContext.page,
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
Current module: ${context.moduleLabel || context.module || "unknown"}${
          context.entityType && context.entityId
            ? `\nViewing: ${context.entityType} ${context.entityId}${context.entityLabel ? ` (${context.entityLabel})` : ""}`
            : ""
        }${
          context.page?.filters?.length
            ? `\nActive filters: ${context.page.filters
                .map((filter) => `${filter.label || filter.key}=${filter.value}`)
                .join(", ")}`
            : ""
        }
User message: ${context.latestUserMessage.content}

The module and filters above are where the user is standing. Use them to disambiguate a
message that names no module — "who has not paid?" on the fees module is a fees lookup.
They are not a restriction: a message that clearly names another module routes there.

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
- which AI templates exist, available templates, the template library -> listAiTemplates
- use, open or draft from a named AI template -> getAiTemplate
- one student's pending fees, dues, fee breakdown or "summarise this student's fees" -> getStudentFeeDetails when a student id is known, otherwise findStudentFeeRecord
- never answer a fees question with a result, marks or report-card tool
- a named or current student's academic risk, "analyse this student", risk level, who is at risk, who is struggling, who needs intervention -> findStudentsAtRisk
- why a student is at risk, or the evidence and reasoning behind a flag -> explainStudentRisk
- what the system has flagged, open cases -> listIntelligenceCases
- what needs my approval, pending recommendations -> listRecommendationsAwaitingApproval
- workflow steps waiting on someone, stuck workflows, what is holding an intervention -> listWorkflowApprovals
- approve or reject a named recommendation -> approveRecommendationAction
- approve or reject a named workflow approval or step -> resolveWorkflowApproval
- comparisons, rankings, trends, "which X needs the most", or any question needing more than one module -> analyzeLmsData
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

    const pageContextRules = describeCurrentPage(context);

    const groundingRules = [
      "GROUNDING — non negotiable:",
      "Never state a number, name, date, status or total about this institute unless it came from a tool result in this conversation.",
      "Never estimate, extrapolate, average, or carry a figure over from an example or from your own knowledge.",
      "Name the actual record whenever a tool returned one — the department, class, division, subject, course, teacher or student by name — instead of describing it generically.",
      "When a tool result reports that the information is unavailable, say so plainly and give the reason in business language. Do not substitute an estimate.",
      "When a result lists signals or datasets that could not be read, say which ones were missing rather than filling the gap yourself.",
      "If the data supports a count but not a cause, give the count and say the data does not show the cause. Offer the specific extra information that would answer it.",
      "When a tool result carries `unavailableSignals`, you may not answer any question that depends on those signals. Say plainly which data the system does not hold, give only what was actually measured, and state that it does not answer the question asked. A ranking question about a quality the institute does not record — training need, competency, workload — must be refused on those grounds, never answered from headcount or any other proxy.",
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

    // Added last so the record on screen is the freshest thing in the prompt, but
    // still below the explicit follow-up focus above — if the previous turn pinned a
    // different record, that one wins.
    if (pageContextRules) {
      sections.push(pageContextRules);
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
      // request falls outside their profile's rights. Typed so the transport can
      // answer 403 rather than 500 — being declined is the assistant working.
      // The required right is deliberately not shown to the user; it means nothing
      // to a teacher and reads as a fault. It stays on the error for the logs.
      throw new ConversationPermissionError(
        `Your ${context.profileName || "current"} profile does not have access to this information, so I can't answer that. Ask an administrator if you need it.`,
        { requiredPermission: intent.requiredPermission, role: context.role }
      );
    }
  },
};
