import {
  generateText,
  stepCountIs,
  streamText,
  type ModelMessage,
} from "ai";
import { recordAuditEvent } from "./audit";
import { appendConversationHistory } from "./history";
import {
  clearConversationWorkflowState,
  getConversationWorkflowState,
  upsertConversationWorkflowState,
  type ConversationWorkflowState,
} from "./workflow-state";
import {
  buildModuleNavigationResponse,
  buildModuleSelectionResponse,
} from "./module-navigation";
import {
  resolveEntitySelection,
  type SelectableEntity,
} from "./entity-selection";
import {
  buildRecordNavigation,
  buildToolInputCandidates,
  extractModuleRecords,
} from "./module-records";
import {
  getModuleWorkflowConfig,
  getWorkflowConfigByWorkflowId,
  routeModuleWorkflow,
  shouldContinueModuleWorkflow,
} from "./module-workflow-routing";
import { getLatestUserMessage } from "./context";
import { createAiModel } from "./model";
import type { ConversationalResponse } from "./response-schema";
import type { ConversationRequest } from "./schemas";
import type {
  PreparedConversation,
  ProjectAIAdapter,
} from "./types";
import { createProjectTools } from "./tools";

function mentionsProviderRateLimit(text: string) {
  return /rate.?limit|quota|temporarily rate-limited|provider .*limited/i.test(text);
}

function isQuotaExceededError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return /quota exceeded|rate.?limit|resource_exhausted|temporarily exhausted|retry in\s+\d+(?:\.\d+)?s/i.test(
    message
  );
}

function formatIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getWeekRange(offsetWeeks: number) {
  const now = new Date();
  const start = new Date(now);
  const day = start.getDay();
  const diffToMonday = (day + 6) % 7;
  start.setDate(start.getDate() - diffToMonday + offsetWeeks * 7);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return {
    fromDate: formatIsoDate(start),
    toDate: formatIsoDate(end),
  };
}

function inferDateRangeFromMessage(message: string) {
  const text = message.toLowerCase();
  const today = new Date();

  if (/\blast week\b/.test(text)) {
    return getWeekRange(-1);
  }

  if (/\bthis week\b/.test(text)) {
    return getWeekRange(0);
  }

  if (/\byesterday\b/.test(text)) {
    const date = new Date(today);
    date.setDate(date.getDate() - 1);
    return {
      fromDate: formatIsoDate(date),
      toDate: formatIsoDate(date),
    };
  }

  if (/\btoday\b/.test(text)) {
    const date = formatIsoDate(today);
    return { fromDate: date, toDate: date };
  }

  return null;
}

function inferResultReportType(message: string) {
  const text = message.toLowerCase();

  if (/merit|top student/.test(text)) {
    return "merit_report";
  }

  if (/subject progress/.test(text)) {
    return "subject_progress_report";
  }

  if (/classwise grade|grade report/.test(text)) {
    return "classwise_grade_report";
  }

  if (/\bclasswise\b/.test(text)) {
    return "classwise_report";
  }

  if (/\bmarks?\b/.test(text)) {
    return "marks_report";
  }

  if (/weightage/.test(text)) {
    return "weightage_conversion_report";
  }

  if (/created exam/.test(text)) {
    return "created_exam_report";
  }

  if (/result|report card|exam result|overall/.test(text)) {
    return "overall_report";
  }

  return null;
}

function inferStandard(message: string) {
  const match = message.match(
    /\b(?:standard|std|class|grade)\s*[-:]?\s*([a-z0-9]+)/i
  );
  return match ? match[1].trim() : null;
}

function inferDivision(message: string) {
  const match = message.match(/\b(?:division|section)\s*[-:]?\s*([a-z0-9]+)/i);
  return match ? match[1].trim() : null;
}

function inferStudentName(message: string) {
  const normalizedMessage = message.replace(
    /\b(for|of|to)(?=[A-Z][a-z])/g,
    "$1 "
  );
  const patterns = [
    /\b(?:collect fees?|pay fees?|fee collection)\s+(?:for\s+)?([a-z][a-z\s.'-]{1,60})$/i,
    /\b(?:student|learner)\s+([a-z][a-z\s.'-]{1,60})$/i,
    /\bfor\s+([a-z][a-z\s.'-]{1,60})$/i,
  ];

  for (const pattern of patterns) {
    const match = normalizedMessage.match(pattern);
    if (match?.[1]) {
      const candidate = match[1]
        .trim()
        .replace(/^(?:for|of|to)\s+/i, "")
        .trim();
      if (!/\b(standard|division|section|grade|class)\b/i.test(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

function inferPersonName(message: string) {
  const inferredStudent = inferStudentName(message);
  if (inferredStudent) {
    return inferredStudent;
  }

  const cleaned = message
    .trim()
    .replace(/^(yes|haan|ha|ok|okay|sure|student|for)\s+/i, "")
    .trim();

  if (
    /^[a-z][a-z\s.'-]{1,80}$/i.test(cleaned) &&
    !/\b(standard|division|section|grade|class|pending|fees|admission|confirm)\b/i.test(cleaned)
  ) {
    return cleaned;
  }

  return null;
}

function inferEnrollmentNo(message: string) {
  const match = message.match(/\b(?:gr\.?\s*no|grno|enrollment(?:\s*no)?)\s*[-:]?\s*([a-z0-9-]+)/i);
  return match ? match[1].trim() : null;
}

function inferEnquiryNo(message: string) {
  const match = message.match(/\b(?:enquiry(?:\s*no|\s*number)?|inquiry(?:\s*no|\s*number)?)\s*[-:]?\s*([a-z0-9-]+)/i);
  return match ? match[1].trim() : null;
}

function inferRollNo(message: string) {
  const match = message.match(/\broll(?:\s*no)?\s*[-:]?\s*([a-z0-9-]+)/i);
  return match ? match[1].trim() : null;
}

function inferMobileNo(message: string) {
  const match = message.match(/\b(\d{10})\b/);
  return match ? match[1] : null;
}

function inferPreviousRouteId(
  messages: PreparedConversation["context"]["messageHistory"],
  routePattern: RegExp
) {
  const previousText = [...messages]
    .reverse()
    .map((message) => message.content)
    .join("\n");
  const match = previousText.match(routePattern);
  return match?.[1] ? match[1].trim() : null;
}

function isAffirmativeMessage(message: string) {
  return /^(yes|haan|ha|yep|yeah|ok|okay|sure|confirm|confirm it|do it|proceed)\b/i.test(
    message.trim()
  );
}

function getWorkflowSessionIds(prepared: PreparedConversation) {
  const userId = prepared.context.userId || "anonymous";
  const conversationId =
    prepared.context.conversationId ||
    prepared.context.request.context?.conversationId ||
    userId;
  return {
    userId,
    conversationId,
  };
}

function resolveWorkflowSelection(
  message: string,
  entities: Array<Record<string, unknown>>
) {
  const result = resolveEntitySelection(message, entities as SelectableEntity[]);
  return result.status === "resolved"
    ? (result.entity as Record<string, unknown>)
    : null;
}

/**
 * Returns the structured backend record behind the current selection. This is
 * the conversation's memory of "who we are already talking about": every
 * follow-up tool call reads identifiers from here rather than re-parsing the
 * user's message.
 */
function getSelectedRecord(
  workflowState: Pick<
    ConversationWorkflowState,
    "selectedRecord" | "hydratedEntity" | "selectedEntity"
  > | null | undefined
): Record<string, unknown> | null {
  if (!workflowState) {
    return null;
  }

  if (workflowState.selectedRecord && Object.keys(workflowState.selectedRecord).length > 0) {
    return workflowState.selectedRecord;
  }

  const metadata = workflowState.selectedEntity?.metadata;
  if (metadata && typeof metadata === "object" && Object.keys(metadata).length > 0) {
    return metadata;
  }

  if (workflowState.hydratedEntity && Object.keys(workflowState.hydratedEntity).length > 0) {
    return workflowState.hydratedEntity;
  }

  return workflowState.selectedEntity
    ? (workflowState.selectedEntity as unknown as Record<string, unknown>)
    : null;
}

/**
 * Merges the structured, backend-sourced input for a tool over whatever could be
 * inferred from the raw message. Backend values always win, so information the
 * conversation already resolved is never asked for again.
 */
function mergeToolInput(
  inferred: Record<string, unknown> | null,
  contextInput: Record<string, unknown> | undefined
) {
  if (!contextInput || Object.keys(contextInput).length === 0) {
    return inferred;
  }

  return {
    ...(inferred || {}),
    ...contextInput,
  };
}

function hasUsableToolInput(input: unknown) {
  if (!input || typeof input !== "object") {
    return false;
  }

  return Object.values(input as Record<string, unknown>).some((value) => {
    if (typeof value === "string") return value.trim().length > 0;
    if (typeof value === "number") return Number.isFinite(value);
    return false;
  });
}

function buildLocalizedMessage(
  language: PreparedConversation["context"]["detectedLanguage"],
  english: string,
  hindi: string,
  gujarati: string
) {
  if (language === "hindi") {
    return hindi;
  }

  if (language === "gujarati") {
    return gujarati;
  }

  return english;
}

const capitalCityMap: Record<string, string> = {
  australia: "Canberra",
  india: "New Delhi",
  japan: "Tokyo",
  china: "Beijing",
  france: "Paris",
  germany: "Berlin",
  italy: "Rome",
  spain: "Madrid",
  canada: "Ottawa",
  brazil: "Brasilia",
  russia: "Moscow",
  "united states": "Washington, D.C.",
  usa: "Washington, D.C.",
  america: "Washington, D.C.",
  "united kingdom": "London",
  uk: "London",
  england: "London",
  nepal: "Kathmandu",
  bhutan: "Thimphu",
  bangladesh: "Dhaka",
  pakistan: "Islamabad",
  "sri lanka": "Sri Jayawardenepura Kotte",
  uae: "Abu Dhabi",
  "saudi arabia": "Riyadh",
  singapore: "Singapore",
};

/**
 * Tools that answer a broad "show me the list" question. Their multi-row result
 * keeps the natural language summary; every other record-returning tool asks the
 * user to pick one of the rows it just matched.
 */
const DISCOVERY_LIST_TOOLS = [
  "listFeesDefaulters",
  "listAdmissionEnquiries",
  "listHomework",
  "searchStudents",
];

function shouldBypassTools(intent: PreparedConversation["intent"]) {
  return (
    intent.domain === "shared" &&
    ["greeting", "general_conversation", "general_knowledge"].includes(intent.capability)
  );
}

const MISSING_FIELD_TO_SLOT: Record<string, { key: string; label: string; type: string; required: boolean }> = {
  firstName: { key: "first_name", label: "First name", type: "text", required: true },
  lastName: { key: "last_name", label: "Last name", type: "text", required: true },
  dateOfBirth: { key: "date_of_birth", label: "Date of birth", type: "date", required: true },
  standardId: { key: "admission_standard", label: "Admission standard", type: "select", required: true },
  divisionId: { key: "admission_division", label: "Division", type: "select", required: true },
  studentQuotaId: { key: "student_quota", label: "Student quota", type: "select", required: true },
  admissionDate: { key: "admission_date", label: "Admission date", type: "date", required: true },
};

function buildMissingSlotsFromFields(fields: string[]) {
  return fields.map((field) => {
    const slot = MISSING_FIELD_TO_SLOT[field];
    return slot || { key: field, label: field, required: true, type: "text" };
  });
}

function normalizeLookupKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[?.,!]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tryEvaluateSimpleMath(text: string) {
  const match = text.match(
    /what(?:'s| is)?\s+(-?\d+(?:\.\d+)?)\s*(plus|\+|minus|-|times|\*|x|multiplied by|divided by|\/)\s*(-?\d+(?:\.\d+)?)/i
  );
  if (!match) {
    return null;
  }

  const left = Number(match[1]);
  const operator = match[2].toLowerCase();
  const right = Number(match[3]);

  if (Number.isNaN(left) || Number.isNaN(right)) {
    return null;
  }

  if (operator === "plus" || operator === "+") {
    return String(left + right);
  }

  if (operator === "minus" || operator === "-") {
    return String(left - right);
  }

  if (
    operator === "times" ||
    operator === "*" ||
    operator === "x" ||
    operator === "multiplied by"
  ) {
    return String(left * right);
  }

  if (right === 0) {
    return null;
  }

  return String(left / right);
}

function getLocalSharedAnswer(prepared: PreparedConversation) {
  if (!shouldBypassTools(prepared.intent)) {
    return null;
  }

  const text = prepared.context.latestUserMessage.content.trim();
  const normalizedText = normalizeLookupKey(text);

  if (/^(hi|hello|hey|good morning|good afternoon|good evening)\b/i.test(text)) {
    return buildLocalizedMessage(
      prepared.context.detectedLanguage,
      "Hello! How can I help you today?",
      "नमस्ते! मैं आज आपकी कैसे मदद कर सकता हूँ?",
      "નમસ્તે! હું આજે તમારી કેવી રીતે મદદ કરી શકું?"
    );
  }

  if (/how are you/i.test(text)) {
    return buildLocalizedMessage(
      prepared.context.detectedLanguage,
      "I'm doing well, thanks. How can I help you?",
      "मैं ठीक हूँ, धन्यवाद। मैं आपकी कैसे मदद कर सकता हूँ?",
      "હું મજા માં છું, આભાર. હું તમારી કેવી રીતે મદદ કરી શકું?"
    );
  }

  if (/\b(thank you|thanks)\b/i.test(text)) {
    return buildLocalizedMessage(
      prepared.context.detectedLanguage,
      "You're welcome!",
      "आपका स्वागत है!",
      "તમારું સ્વાગત છે!"
    );
  }

  if (/^(bye|goodbye|see you)\b/i.test(text)) {
    return buildLocalizedMessage(
      prepared.context.detectedLanguage,
      "Goodbye!",
      "अलविदा!",
      "આવજો!"
    );
  }

  if (/who are you|what is your name/i.test(text)) {
    return buildLocalizedMessage(
      prepared.context.detectedLanguage,
      "I'm the Teach Connect LMS assistant. I can help with LMS tasks and simple questions.",
      "मैं Teach Connect LMS सहायक हूँ। मैं LMS कार्यों और सरल सवालों में मदद कर सकता हूँ।",
      "હું Teach Connect LMS સહાયક છું. હું LMS કામો અને સરળ પ્રશ્નોમાં મદદ કરી શકું છું."
    );
  }

  const capitalMatch = normalizedText.match(
    /what(?:'s| is)? the capital of ([a-z\s.'-]+)$/
  );
  if (capitalMatch) {
    const country = normalizeLookupKey(capitalMatch[1]);
    const capital = capitalCityMap[country];
    if (capital) {
      return buildLocalizedMessage(
        prepared.context.detectedLanguage,
        `The capital of ${capitalMatch[1].trim()} is ${capital}.`,
        `${capitalMatch[1].trim()} की राजधानी ${capital} है।`,
        `${capitalMatch[1].trim()} ની રાજધાની ${capital} છે.`
      );
    }
  }

  const mathAnswer = tryEvaluateSimpleMath(text);
  if (mathAnswer) {
    return buildLocalizedMessage(
      prepared.context.detectedLanguage,
      mathAnswer,
      mathAnswer,
      mathAnswer
    );
  }

  if (prepared.intent.capability === "general_conversation") {
    return buildLocalizedMessage(
      prepared.context.detectedLanguage,
      "I can help with LMS tasks and simple questions. Try asking about homework, reports, or a basic general question.",
      "मैं LMS कार्यों और सरल सवालों में मदद कर सकता हूँ। आप होमवर्क, रिपोर्ट या कोई आसान सामान्य प्रश्न पूछ सकते हैं।",
      "હું LMS કામો અને સરળ પ્રશ્નોમાં મદદ કરી શકું છું. તમે હોમવર્ક, રિપોર્ટ અથવા કોઈ સરળ સામાન્ય પ્રશ્ન પૂછી શકો છો."
    );
  }

  return null;
}

async function getFallbackToolInput(prepared: PreparedConversation, toolName: string) {
  const message = prepared.context.latestUserMessage.content;
  const dateRange = inferDateRangeFromMessage(message);
  const standard = inferStandard(message);
  const division = inferDivision(message);
  const studentName = inferPersonName(message);
  const enrollmentNo = inferEnrollmentNo(message);
  const enquiryNo = inferEnquiryNo(message);
  const rollNo = inferRollNo(message);
  const mobileNo = inferMobileNo(message);
  const previousAdmissionId = inferPreviousRouteId(
    prepared.context.messageHistory,
    /\/admissions\/confirmation\/([^/\s]+)\/follow-up/i
  );
  const workflowIds = getWorkflowSessionIds(prepared);
  const workflowState = getConversationWorkflowState(
    prepared.context.projectId,
    workflowIds.userId,
    workflowIds.conversationId
  );

  switch (toolName) {
    case "getLmsDashboard":
    case "getActivityStream":
    case "listFeesDefaulters":
    case "getContextualSuggestions":
      return {};
    case "listAdmissionEnquiries":
      return {
        onlyPending: /\bpending|open\b/i.test(message),
        status: /\bapproved\b/i.test(message)
          ? "Approved"
          : /\bclosed\b/i.test(message)
            ? "Closed"
            : undefined,
        ...(dateRange || {}),
      };
    case "executeModuleAction":
      return {
        module: /student|learner|parent|guardian/.test(message)
          ? "students"
          : /teacher|staff/.test(message)
            ? "teachers"
            : /fee|fees|defaulter|dues|collect|payment/.test(message)
              ? "fees"
              : /homework|assignment|classwork/.test(message)
                ? "homework"
                : /mark|marks|result|report card|report/.test(message)
                  ? "results"
                  : /attendance|absent|present/.test(message)
                    ? "attendance"
                    : /timetable|schedule|period/.test(message)
                      ? "timetable"
                      : /exam|assessment|test/.test(message)
                        ? "exams"
                        : /library|book|resource/.test(message)
                          ? "library"
                          : /transport|bus|van|route/.test(message)
                            ? "transport"
                            : /hostel|room|mess/.test(message)
                              ? "hostel"
                              : /notification|notice|message/.test(message)
                                ? "notifications"
                                : /account|ledger|invoice|expense/.test(message)
                                  ? "accounts"
                                  : undefined,
        action: /confirm|approve/.test(message)
          ? "confirm"
          : /collect|pay|receive/.test(message)
            ? "collect"
            : /defaulter|pending|due|outstanding/.test(message)
              ? "list_defaulters"
              : undefined,
        searchText: message,
        standard,
        division,
        enrollmentNo,
        rollNo,
        mobileNo,
        grade: undefined,
        subject: undefined,
        fromDate: dateRange?.fromDate,
        toDate: dateRange?.toDate,
      };
    case "findAdmissionCandidate":
      if (workflowState?.matchedEntities?.length) {
        const selected = resolveWorkflowSelection(
          message,
          workflowState.matchedEntities as unknown as Array<Record<string, unknown>>
        );
        if (selected) {
          return {
            studentName:
              typeof selected.label === "string" ? selected.label : undefined,
            enquiryNo:
              typeof selected.reference === "string" ? selected.reference : undefined,
            standard:
              typeof selected.secondary === "string" ? selected.secondary : standard || undefined,
            onlyPending: true,
          };
        }
      }
      return {
        studentName: studentName || undefined,
        enquiryNo: enquiryNo || enrollmentNo || undefined,
        mobileNo: mobileNo || undefined,
        standard: standard || undefined,
        onlyPending: true,
      };
    case "hydrateAdmissionCandidate": {
      const selectedEntityId =
        typeof workflowState?.selectedEntity?.metadata?.enquiryId === "string"
          ? workflowState.selectedEntity.metadata.enquiryId
          : typeof workflowState?.selectedEntity?.metadata?.enquiryId === "number"
            ? String(workflowState.selectedEntity.metadata.enquiryId)
            : typeof workflowState?.selectedEntity?.id === "string" &&
                workflowState.selectedEntity.id.trim()
              ? workflowState.selectedEntity.id
              : null;

      if (selectedEntityId) {
        return {
          enquiryId: selectedEntityId,
        };
      }

      return null;
    }
    case "confirmAdmissionCandidate": {
      if (workflowState?.pendingAction?.tool === "confirmAdmissionCandidate") {
        return workflowState.pendingAction.payload;
      }
      if (!previousAdmissionId) {
        return null;
      }

      return {
        id: previousAdmissionId,
      };
    }
    case "updateAdmissionCandidateDetails":
      if (!workflowState?.selectedEntity?.id || !workflowState.missingSlots.length) {
        return null;
      }

      const readAdmissionField = (slotKey: string) => {
        switch (slotKey) {
          case "first_name":
            return message.match(/(?:first\s*name|firstname)\s*[:=-]\s*([^,;\n]+)/i)?.[1]?.trim();
          case "middle_name":
            return message.match(/(?:middle\s*name|middlename)\s*[:=-]\s*([^,;\n]+)/i)?.[1]?.trim();
          case "last_name":
            return message.match(/(?:last\s*name|lastname|surname)\s*[:=-]\s*([^,;\n]+)/i)?.[1]?.trim();
          case "mobile":
            return message.match(/(?:mobile\s*(?:number|no)?|phone)\s*[:=-]\s*([0-9+\-\s]+)/i)?.[1]?.trim();
          case "date_of_birth":
            return message.match(/(?:date\s*of\s*birth|birth\s*date|dob)\s*[:=-]\s*([^,;\n]+)/i)?.[1]?.trim();
          case "admission_standard":
            return message.match(/(?:admission\s*standard|standard|std|class|grade)\s*[:=-]\s*([^,;\n]+)/i)?.[1]?.trim();
          case "admission_division":
            return message.match(/(?:division|divisio|div|section)\s*[:=-]\s*([^,;\n]+)/i)?.[1]?.trim();
          case "student_quota":
            return message.match(/(?:student\s*quota|quota)\s*[:=-]\s*([^,;\n]+)/i)?.[1]?.trim();
          case "admission_date":
            return message.match(/(?:admission\s*date|admissiondate)\s*[:=-]\s*([^,;\n]+)/i)?.[1]?.trim();
          default:
            return undefined;
        }
      };

      const csvParts = message
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
      const positionalUpdates =
        csvParts.length >= workflowState.missingSlots.length
          ? Object.fromEntries(
              workflowState.missingSlots
                .map((slot, index) => {
                  const value = csvParts[index];
                  return typeof slot.key === "string" && value ? [slot.key, value] : null;
                })
                .filter((entry): entry is [string, string] => Array.isArray(entry))
            )
          : {};

      return {
        id: workflowState.selectedEntity.id,
        studentName:
          typeof workflowState.selectedEntity.label === "string"
            ? workflowState.selectedEntity.label
            : undefined,
        enquiryNo:
          typeof workflowState.selectedEntity.reference === "string"
            ? workflowState.selectedEntity.reference
            : undefined,
        standard:
          typeof workflowState.selectedEntity.secondary === "string"
            ? workflowState.selectedEntity.secondary
            : undefined,
        updates: {
          ...positionalUpdates,
          ...Object.fromEntries(
            workflowState.missingSlots
              .map((slot) => {
                if (typeof slot.key !== "string") {
                  return null;
                }

                const value = slot.options?.find((option) =>
                  message.toLowerCase().includes(option.label.toLowerCase())
                )?.value;

                if (value) {
                  return [slot.key, value];
                }

                const labelledValue = readAdmissionField(slot.key);
                if (labelledValue) {
                  return [slot.key, labelledValue];
                }

                if (slot.key === "admission_division") {
                  const match = message.match(/\b(?:division|section)\s*[-:]?\s*([a-z0-9]+)/i);
                  return match?.[1] ? [slot.key, match[1]] : null;
                }

                if (slot.key === "admission_standard") {
                  const match = message.match(/\b(?:standard|std|class|grade)\s*[-:]?\s*([a-z0-9]+)/i);
                  return match?.[1] ? [slot.key, match[1]] : null;
                }

                if (slot.key === "mobile") {
                  const match = message.match(/\b(\d{10})\b/);
                  return match?.[1] ? [slot.key, match[1]] : null;
                }

                if (slot.key === "date_of_birth" || slot.key === "admission_date") {
                  const match = message.match(/\b(\d{4}-\d{2}-\d{2}|\d{2}[\/-]\d{2}[\/-]\d{4})\b/);
                  return match?.[1] ? [slot.key, match[1]] : null;
                }

                return null;
              })
              .filter((entry): entry is [string, string] => Array.isArray(entry))
          ),
        },
      };
    case "listHomework":
      return dateRange || {};
    case "getTeacherDailyReport":
      return dateRange ? { date: dateRange.toDate } : {};
    case "searchStudents":
      return {
        standard: standard || undefined,
        division: division || undefined,
        studentName: studentName || undefined,
        enrollmentNo: enrollmentNo || undefined,
        rollNo: rollNo || undefined,
        mobileNo: mobileNo || undefined,
      };
    case "findStudentFeeRecord":
      return {
        studentName: studentName || undefined,
        standard: standard || undefined,
        division: division || undefined,
        enrollmentNo: enrollmentNo || undefined,
        rollNo: rollNo || undefined,
        mobileNo: mobileNo || undefined,
      };
    case "getResultReport": {
      const reportOf = inferResultReportType(message);
      if (!reportOf) {
        return null;
      }

      return {
        reportOf,
        ...(dateRange || {}),
      };
    }
    default:
      return null;
  }
}

function normalizeDirectToolResult(result: unknown) {
  return typeof result === "string"
    ? {
        summary: result,
        data: result,
      }
    : {
        summary: JSON.stringify(result),
        data: result,
      };
}

function buildResultReportNeedsInputResponse(
  prepared: PreparedConversation,
  toolName: string,
  reason?: string
): ConversationalResponse {
  return {
    message: buildLocalizedMessage(
      prepared.context.detectedLanguage,
      "I can fetch the result report, but I need a bit more information because the LMS backend requires more filters for this request. Please share details like report type, class or grade, division, term, exam, or the student's roll number.",
      "मैं result report ला सकता हूँ, लेकिन इस request के लिए LMS backend को कुछ और जानकारी चाहिए। कृपया report type, class या grade, division, term, exam, या student का roll number बताइए।",
      "હું result report મેળવી શકું છું, પરંતુ આ request માટે LMS backend ને થોડી વધુ માહિતી જોઈએ છે. કૃપા કરીને report type, class અથવા grade, division, term, exam, અથવા વિદ્યાર્થીનો roll number આપો."
    ),
    conversationType: prepared.intent.type,
    status: "requires_input",
    toolExecutions: [
      {
        tool: toolName,
        status: "planned",
        summary:
          reason ||
          "The LMS backend requested additional result-report filters before execution.",
      },
    ],
    followUpSuggestions: [
      "Specify report type such as marks report or overall report.",
      "Add class, grade, division, term, or exam details.",
      "Provide the student's roll number if available.",
    ],
    intent: prepared.intent,
    activeTools: prepared.activeTools,
  };
}

function buildFeeCollectionNeedsInputResponse(
  prepared: PreparedConversation,
  toolName: string
): ConversationalResponse {
  return {
    message: buildLocalizedMessage(
      prepared.context.detectedLanguage,
      "I can continue with fee collection. Please share the student's full name first. If you already know them, you can also send the Standard, Division, roll number, GR number, or mobile number.",
      "मैं fee collection में आगे बढ़ सकता हूँ, लेकिन सही छात्र रिकॉर्ड खोजने के लिए मुझे छात्र का Standard और Division चाहिए। आप roll number, GR number, या mobile number भी साझा कर सकते हैं।",
      "હું fee collection આગળ વધારી શકું છું, પરંતુ સાચો વિદ્યાર્થી રેકોર્ડ શોધવા માટે મને વિદ્યાર્થીનું Standard અને Division જોઈએ. તમે roll number, GR number, અથવા mobile number પણ આપી શકો છો."
    ),
    conversationType: prepared.intent.type,
    status: "requires_input",
    toolExecutions: [
      {
        tool: toolName,
        status: "planned",
        summary: "Waiting for more student identifiers before opening the fee collection workflow.",
      },
    ],
    followUpSuggestions: [
      "Share the student's full name.",
      "Add Standard and Division if available.",
      "Provide roll number, GR number, or mobile number.",
      "If you know it, share the student's full name exactly as registered.",
    ],
    intent: prepared.intent,
    activeTools: prepared.activeTools,
  };
}

function readStringValue(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return "";
}

function buildAdmissionCandidateNavigationResponse(
  prepared: PreparedConversation,
  candidate: Record<string, unknown>,
  toolName: string
): ConversationalResponse {
  const enquiryId =
    readStringValue(candidate.enquiryId) ||
    readStringValue(candidate.enquiry_id) ||
    readStringValue(candidate.enquiryNo) ||
    readStringValue(candidate.enquiry_no) ||
    readStringValue(candidate.id);
  const registrationId =
    readStringValue(candidate.registrationId) ||
    readStringValue(candidate.registration_id) ||
    readStringValue(candidate.registrationEnquiryId) ||
    readStringValue(candidate.registration_enquiry_id) ||
    readStringValue(candidate.id);
  const fullName =
    readStringValue(candidate.studentName) ||
    readStringValue(candidate.fullName) ||
    "the selected student";
  const mobile = readStringValue(candidate.mobileNo) || readStringValue(candidate.mobile);
  const standard = readStringValue(candidate.standard) || readStringValue(candidate.standardName);
  const enquiryNo = readStringValue(candidate.enquiryNo) || enquiryId;

  const lines = [
    `I found ${fullName}'s admission record.`,
    "",
    [
      enquiryNo ? `Enquiry No.: ${enquiryNo}` : null,
      mobile ? `Mobile: ${mobile}` : null,
      standard ? `Standard: ${standard}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    "",
    "Click \"Continue to Admission Confirmation\" to open the confirmation module with this student's data loaded. Complete any remaining mandatory fields there and submit the confirmation.",
  ].filter((line) => line !== null);

  return {
    message: lines.join("\n"),
    conversationType: prepared.intent.type,
    status: "navigation_required",
    navigation: {
      route: "/admissions/confirmation",
      query: {
        ...(enquiryId ? { enquiry_id: enquiryId } : {}),
        ...(registrationId ? { registration_id: registrationId } : {}),
      },
      label: "Continue to Admission Confirmation",
    },
    data: {
      candidate: {
        enquiryId,
        registrationId,
        fullName,
        mobile,
        standard,
      },
    },
    toolExecutions: [
      {
        tool: toolName,
        status: "completed",
        summary: "Matched the admission candidate and prepared the confirmation page handoff.",
      },
    ],
    followUpSuggestions: [
      "Open the admission confirmation module.",
      "Review the pre-filled details before submitting.",
    ],
    intent: prepared.intent,
    activeTools: prepared.activeTools,
  };
}

function buildAdmissionConfirmationNeedsInputResponse(
  prepared: PreparedConversation,
  toolName: string
): ConversationalResponse {
  return {
    message: buildLocalizedMessage(
      prepared.context.detectedLanguage,
      "I can continue with admission confirmation. Please share the student's full name, enquiry number, or mobile number so I can locate the correct admission record.",
      "मैं admission confirmation आगे बढ़ा सकता हूँ। कृपया छात्र का पूरा नाम, enquiry number, या mobile number साझा करें ताकि मैं सही admission record ढूँढ सकूँ।",
      "હું admission confirmation આગળ વધારી શકું છું. કૃપા કરીને વિદ્યાર્થીનું સંપૂર્ણ નામ, enquiry number, અથવા mobile number આપો જેથી હું સાચો admission record શોધી શકું."
    ),
    conversationType: prepared.intent.type,
    status: "requires_input",
    toolExecutions: [
      {
        tool: toolName,
        status: "planned",
        summary: "Waiting for a student identifier before continuing the admission confirmation workflow.",
      },
    ],
    followUpSuggestions: [
      "Share the student's full name.",
      "Provide the enquiry number if available.",
      "Provide the registered mobile number.",
    ],
    intent: prepared.intent,
    activeTools: prepared.activeTools,
  };
}

function getNestedObject(
  source: Record<string, unknown> | null,
  key: string
): Record<string, unknown> | null {
  if (!source) {
    return null;
  }

  const value = source[key];
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getStringArray(source: Record<string, unknown> | null, key: string) {
  if (!source) {
    return [];
  }

  const value = source[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function getReadableCount(data: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = data[key];
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

function buildActivityStreamMessage(prepared: PreparedConversation, data: Record<string, unknown>) {
  const normalized = getNestedObject(data, "normalized");
  const count =
    getReadableCount(data, ["count", "total", "total_count"]) ??
    getReadableCount(normalized || {}, ["count", "total", "total_count"]);
  const highlights = getStringArray(normalized, "highlights").slice(0, 3);
  const latestTimestamp =
    normalized && typeof normalized.latestTimestamp === "string"
      ? normalized.latestTimestamp
      : null;

  if (highlights.length > 0) {
    const intro = count != null
      ? `Here is the latest LMS activity stream with ${count} recent update${count === 1 ? "" : "s"}.`
      : "Here is the latest LMS activity stream.";
    const latestNote = latestTimestamp ? ` The most recent activity was recorded at ${latestTimestamp}.` : "";
    return buildLocalizedMessage(
      prepared.context.detectedLanguage,
      `${intro}${latestNote} Highlights: ${highlights.join("; ")}.`,
      `${count != null ? `यह नवीनतम LMS activity stream है जिसमें ${count} हाल की update${count === 1 ? "" : "s"} हैं।` : "यह नवीनतम LMS activity stream है।"}${latestTimestamp ? ` सबसे हाल की activity ${latestTimestamp} पर दर्ज हुई।` : ""} मुख्य बिंदु: ${highlights.join("; ")}।`,
      `${count != null ? `આ નવીનતમ LMS activity stream છે જેમાં ${count} તાજેતરની update${count === 1 ? "" : "s"} છે.` : "આ નવીનતમ LMS activity stream છે."}${latestTimestamp ? ` સૌથી તાજેતરની activity ${latestTimestamp} પર નોંધાઈ હતી.` : ""} મુખ્ય મુદ્દા: ${highlights.join("; ")}.`
    );
  }

  if (count != null) {
    return buildLocalizedMessage(
      prepared.context.detectedLanguage,
      `Here is the latest LMS activity stream. I found ${count} recent activity record${count === 1 ? "" : "s"} from the backend.`,
      `यह नवीनतम LMS activity stream है। मुझे backend से ${count} हाल की activity record${count === 1 ? "" : "s"} मिली हैं।`,
      `આ નવીનતમ LMS activity stream છે. મને backendમાંથી ${count} તાજેતરની activity record${count === 1 ? "" : "s"} મળી છે.`
    );
  }

  return buildLocalizedMessage(
    prepared.context.detectedLanguage,
    "I fetched the latest LMS activity stream, but there were no readable activity highlights in the returned data.",
    "मैंने नवीनतम LMS activity stream प्राप्त की, लेकिन लौटाए गए data में कोई स्पष्ट activity highlight नहीं मिली।",
    "મેં નવીનતમ LMS activity stream મેળવી, પરંતુ મળેલા data માં કોઈ સ્પષ્ટ activity highlight મળી નથી."
  );
}

function buildAdmissionEnquiryFollowUpMessage(prepared: PreparedConversation) {
  return buildLocalizedMessage(
    prepared.context.detectedLanguage,
    "Would you like to confirm admission for any of these students?",
    "क्या आप इनमें से किसी छात्र का admission confirm करना चाहते हैं?",
    "શું તમે આમાંથી કોઈ વિદ્યાર્થીનું admission confirm કરવા માંગો છો?"
  );
}

function buildAdmissionEnquiryMessage(
  prepared: PreparedConversation,
  data: Record<string, unknown>
) {
  const normalized = getNestedObject(data, "normalized");
  const pendingCount =
    getReadableCount(normalized || {}, ["filteredCount", "pendingCount"]) ??
    getReadableCount(data, ["pendingCount", "count", "total"]);
  const highlights =
    getStringArray(normalized, "filteredHighlights").length > 0
      ? getStringArray(normalized, "filteredHighlights").slice(0, 3)
      : getStringArray(normalized, "highlights").slice(0, 3);

  if (highlights.length > 0) {
    return buildLocalizedMessage(
      prepared.context.detectedLanguage,
      `I found ${pendingCount ?? highlights.length} admission application${pendingCount === 1 ? "" : "s"} matching your request.\n\n**Pending Admissions:**\n\n${highlights.map((h, i) => `${i + 1}. ${h}`).join("\n")}`,
      `मुझे आपकी request के अनुसार ${pendingCount ?? highlights.length} admission application${pendingCount === 1 ? "" : "s"} मिली हैं।\n\n**Pending Admissions:**\n\n${highlights.map((h, i) => `${i + 1}. ${h}`).join("\n")}`,
      `તમારી request મુજબ મને ${pendingCount ?? highlights.length} admission application${pendingCount === 1 ? "" : "s"} મળી છે. મુખ્ય મુદ્દા: ${highlights.join("; ")}. શું તમે આમાંથી કોઈ વિદ્યાર્થીનું admission confirm કરવા માંગો છો?`
    );
  }

  if (pendingCount != null) {
    return buildLocalizedMessage(
      prepared.context.detectedLanguage,
      `I found ${pendingCount} admission application${pendingCount === 1 ? "" : "s"} matching your request.`,
      `मुझे आपकी request के अनुसार ${pendingCount} admission application${pendingCount === 1 ? "" : "s"} मिली हैं।`,
      `તમારી request મુજબ મને ${pendingCount} admission application${pendingCount === 1 ? "" : "s"} મળી છે.`
    );
  }

  return buildLocalizedMessage(
    prepared.context.detectedLanguage,
    "I fetched the admission enquiry data, but there were no matching application records to summarize.",
    "मैंने admission enquiry data प्राप्त किया, लेकिन सारांश के लिए कोई matching application record नहीं मिली।",
    "મેં admission enquiry data મેળવી, પરંતુ સારાંશ માટે કોઈ matching application record મળી નથી."
  );
}

function summarizeToolBackedResult(
  prepared: PreparedConversation,
  toolResults: Array<{ toolName?: string; output?: unknown }>
) {
  const latestToolResult = toolResults.at(-1);
  const output = latestToolResult?.output;

  if (!output || typeof output !== "object") {
    return null;
  }

  const resultRecord = output as Record<string, unknown>;
  const data =
    typeof resultRecord.data === "object" && resultRecord.data !== null
      ? (resultRecord.data as Record<string, unknown>)
      : null;

  if (!data) {
    return null;
  }

  const toolName = latestToolResult?.toolName || prepared.activeTools.at(-1);

  if (toolName === "listHomework") {
    const count =
      typeof data.count === "number"
        ? data.count
        : Array.isArray(data.data)
          ? data.data.length
          : Array.isArray(data.homework)
            ? data.homework.length
            : null;

    if (count == null) {
      return null;
    }

    const homeworkRecords = extractModuleRecords("listHomework", data);
    if (homeworkRecords && homeworkRecords.entities.length > 0) {
      const options = homeworkRecords.entities.slice(0, 5).map((entity, index) => {
        const details = [entity.secondary, entity.reference ? `#${entity.reference}` : ""]
          .filter(Boolean)
          .join(", ");
        return `${index + 1}. ${entity.label}${details ? `, ${details}` : ""}`;
      });

      return `I found ${count} homework record${count === 1 ? "" : "s"} in the LMS backend.\n\n${options.join("\n")}\n\nWhich homework record would you like to open? You can reply with the number, the title, or the homework ID.`;
    }

    const dateRange =
      typeof data.filters === "object" && data.filters !== null
        ? data.filters
        : null;

    const fromDate =
      dateRange && typeof (dateRange as Record<string, unknown>).from_date === "string"
        ? String((dateRange as Record<string, unknown>).from_date)
        : null;
    const toDate =
      dateRange && typeof (dateRange as Record<string, unknown>).to_date === "string"
        ? String((dateRange as Record<string, unknown>).to_date)
        : null;

    if (fromDate && toDate && fromDate === toDate) {
      return `Retrieved ${count} homework record(s) from the LMS backend for ${fromDate}.`;
    }

    if (fromDate && toDate) {
      return `Retrieved ${count} homework record(s) from the LMS backend for ${fromDate} to ${toDate}.`;
    }

    return `Retrieved ${count} homework record(s) from the LMS backend.`;
  }

  if (toolName === "getResultReport") {
    const count =
      typeof data.count === "number"
        ? data.count
        : Array.isArray(data.data)
          ? data.data.length
          : Array.isArray(data.results)
            ? data.results.length
            : null;

    if (count != null) {
      return `Retrieved ${count} result record(s) from the LMS backend.`;
    }

    return "Retrieved the requested result report from the LMS backend.";
  }

  if (toolName === "getActivityStream") {
    return buildActivityStreamMessage(prepared, data);
  }

  if (toolName === "listAdmissionEnquiries") {
    return buildAdmissionEnquiryMessage(prepared, data);
  }

  if (toolName === "executeModuleAction") {
    const resultRecord = data as Record<string, unknown>;
    const summaryText = typeof resultRecord.summary === "string" ? resultRecord.summary : null;
    const moduleName = typeof resultRecord.module === "string" ? resultRecord.module : "module";
    if (summaryText) {
      return summaryText;
    }

    return `Retrieved ${moduleName} data from the linked backend workflow.`;
  }

  if (toolName === "findAdmissionCandidate") {
    const count =
      typeof data.totalCount === "number"
        ? data.totalCount
        : Array.isArray(data.candidates)
          ? data.candidates.length
          : null;

    if (count == null) {
      return null;
    }

    if (count === 0) {
      return "I couldn't find a matching admission record yet. Please share the student's full name, enquiry number, or mobile number.";
    }

    const candidates = Array.isArray(data.candidates)
      ? (data.candidates as Array<Record<string, unknown>>)
      : [];
    const first = candidates[0];
    const name = typeof first?.studentName === "string" ? first.studentName : "the student";
    const readiness = typeof first?.readiness === "string" ? first.readiness : "";

    if (count === 1 && readiness === "already_confirmed") {
      return `${name}'s admission is already confirmed in the backend. No duplicate confirmation was performed.`;
    }

    if (count === 1) {
      return buildAdmissionCandidateNavigationResponse(prepared, first, toolName).message;
    }

    const options = candidates
      .slice(0, 5)
      .map((candidate, index) => {
        const candidateName =
          typeof candidate.studentName === "string" ? candidate.studentName : "Unknown student";
        const candidateStandard =
          typeof candidate.standard === "string" ? candidate.standard : "";
        const candidateEnquiry =
          typeof candidate.enquiryNo === "string" ? candidate.enquiryNo : "";
        return `${index + 1}. ${candidateName}${candidateStandard ? `, Standard ${candidateStandard}` : ""}${candidateEnquiry ? `, Enquiry ${candidateEnquiry}` : ""}`;
      });
    return `I found ${count} matching admission records. Please choose one:\n${options.join("\n")}`;
  }

  if (toolName === "confirmAdmissionCandidate") {
    const payload =
      typeof data.payload === "object" && data.payload !== null
        ? (data.payload as Record<string, unknown>)
        : null;
    if (payload && typeof payload.message === "string" && payload.message.trim()) {
      return payload.message;
    }
    return "Admission confirmed successfully through the existing admissions backend workflow.";
  }

  if (toolName === "updateAdmissionCandidateDetails") {
    const candidate =
      typeof data.candidate === "object" && data.candidate !== null
        ? (data.candidate as Record<string, unknown>)
        : null;
    if (!candidate) {
      return "I updated the admission record and refreshed the backend details.";
    }

    const candidateName =
      typeof candidate.studentName === "string" ? candidate.studentName : "the student";
    const candidateMissingFields = Array.isArray(candidate.missingFields)
      ? candidate.missingFields.filter((value): value is string => typeof value === "string")
      : [];
    if (Boolean(candidate.canConfirm)) {
      return `I updated ${candidateName}'s admission record with the details you provided.\n\nEverything required is now available. Would you like to continue with admission confirmation?`;
    }
    return `I updated ${candidateName}'s admission record. I still need ${candidateMissingFields.join(", ")} before I can confirm the admission.`;
  }

  if (toolName === "getLmsDashboard") {
    return "Retrieved the latest LMS dashboard data from the backend.";
  }

  if (toolName === "getTeacherDailyReport") {
    return "Retrieved the teacher daily report from the LMS backend.";
  }

  if (toolName === "listFeesDefaulters") {
    const count =
      typeof data.totalCount === "number"
        ? data.totalCount
        : Array.isArray(data.students)
          ? data.students.length
          : null;

    if (count == null) {
      return "Retrieved the fees defaulter report from the LMS backend.";
    }

    if (count === 0) {
      return "I checked the fees defaulter records, but there are no matching pending-fee students for those filters.";
    }

    const students = Array.isArray(data.students)
      ? (data.students as Array<Record<string, unknown>>)
      : [];
    const highlights = students
      .slice(0, 5)
      .map((student) => {
        const name = typeof student.studentName === "string" ? student.studentName : "Unknown student";
        const standard = typeof student.standard === "string" ? student.standard : "";
        const division = typeof student.division === "string" ? student.division : "";
        const pendingFees =
          typeof student.pendingFees === "number"
            ? student.pendingFees
            : Number(student.pendingFees || 0);
        return `${name}${standard ? `, Standard ${standard}` : ""}${division ? ` ${division}` : ""}${pendingFees > 0 ? `, pending fees ${pendingFees}` : ""}`;
      });

    return `I found ${count} student${count === 1 ? "" : "s"} with pending fees. ${highlights.join("; ")}. Would you like to collect fees for any of these students?`;
  }

  if (toolName === "searchStudents") {
    const count =
      typeof data.totalCount === "number"
        ? data.totalCount
        : Array.isArray(data.students)
          ? data.students.length
          : null;

    if (count == null) {
      return null;
    }

    if (count === 0) {
      return "I searched the student records, but I could not find a matching student.";
    }

    const students = Array.isArray(data.students)
      ? (data.students as Array<Record<string, unknown>>)
      : [];
    const highlights = students
      .slice(0, 3)
      .map((student) => {
        const name = typeof student.studentName === "string" ? student.studentName : "Unknown student";
        const standard = typeof student.standard === "string" ? student.standard : "";
        const division = typeof student.division === "string" ? student.division : "";
        return `${name}${standard ? `, Standard ${standard}` : ""}${division ? ` ${division}` : ""}`;
      });

    return `I found ${count} matching student record(s). ${highlights.join("; ")}.`;
  }

  if (toolName === "findStudentFeeRecord") {
    const count =
      typeof data.totalCount === "number"
        ? data.totalCount
        : Array.isArray(data.students)
          ? data.students.length
          : null;

    if (count == null) {
      return null;
    }

    if (count === 0) {
      return "I couldn't find a matching student in the fees collection records yet.";
    }

    const students = Array.isArray(data.students)
      ? (data.students as Array<Record<string, unknown>>)
      : [];
    const first = students[0];
    const name = typeof first?.studentName === "string" ? first.studentName : "the student";
    const standard = typeof first?.standard === "string" ? first.standard : "";
    const division = typeof first?.division === "string" ? first.division : "";
    const studentId = typeof first?.id === "string" ? first.id : null;
    const route = studentId ? `/fees/collect/${studentId}` : "/fees/collect";

    if (count === 1) {
      return `I found ${name}${standard ? ` in Standard ${standard}` : ""}${division ? ` ${division}` : ""}. You can continue fee collection here: ${route}. Would you like to open this fee collection record now?`;
    }

    return `I found ${count} matching student records for the fee workflow. Please confirm the student's Standard and Division so I can open the right fee collection page.`;
  }

  if (toolName === "getStudentFeeDetails") {
    const pendingRows = Array.isArray(data.data) ? data.data.length : 0;
    return `I loaded the student's fee details from the LMS backend${pendingRows > 0 ? ` with ${pendingRows} payment record(s)` : ""}.`;
  }

  return null;
}

async function executePreferredTool(
  prepared: PreparedConversation
): Promise<ConversationalResponse | null> {
  const workflowIds = getWorkflowSessionIds(prepared);
  const workflowState = getConversationWorkflowState(
    prepared.context.projectId,
    workflowIds.userId,
    workflowIds.conversationId
  );
  const latestMessage = prepared.context.latestUserMessage.content;
  let toolName = prepared.intent.suggestedTool;

  if (
    !toolName &&
    shouldContinueModuleWorkflow(workflowState, latestMessage, prepared.intent)
  ) {
    // An active module workflow keeps ownership of short follow-up replies
    // ("4", "Zeel J Tank, 7, 233") that the intent classifier cannot route on
    // its own.
    const activeConfig = getModuleWorkflowConfig(workflowState?.module);
    toolName =
      activeConfig.selectTool || activeConfig.hydrateTool || activeConfig.listTools[0];
  }

  if (!toolName) {
    return null;
  }

  if (
    workflowState?.pendingAction &&
    typeof workflowState.pendingAction.tool === "string" &&
    /^(yes|haan|ha|yep|yeah|ok|okay|sure|continue|open|go ahead)\b/i.test(latestMessage)
  ) {
    const pendingTool = workflowState.pendingAction.tool;
    const moduleConfig = getWorkflowConfigByWorkflowId(workflowState.workflowId);
    const selectedEntity = workflowState.selectedEntity;

    if (pendingTool === "moduleNavigation" && selectedEntity && moduleConfig.navigationRoute) {
      const pendingRecord =
        getSelectedRecord(workflowState) ||
        (selectedEntity as unknown as Record<string, unknown>);
      // Prefer the record-driven route (it can carry path parameters such as
      // /fees/collect/{studentId}); fall back to the module landing route.
      const target =
        buildRecordNavigation(workflowState.module, pendingRecord) || {
          route: moduleConfig.navigationRoute,
          label: moduleConfig.navigationLabel,
          query: moduleConfig.buildNavigationQuery(
            pendingRecord,
            workflowState as unknown as Record<string, unknown>
          ),
        };

      return buildModuleNavigationResponse(
        prepared,
        workflowState,
        target.route,
        target.label,
        target.query,
        selectedEntity,
        `${moduleConfig.readyMessagePrefix} ${selectedEntity.label || "the selected record"}.`
      );
    }

    if (
      pendingTool === "admissionConfirmationNavigation" &&
      selectedEntity
    ) {
      const entityRecord = selectedEntity.metadata as Record<string, unknown> | null;
      return buildModuleNavigationResponse(
        prepared,
        workflowState,
        "/admissions/confirmation",
        "Continue to Admission Confirmation",
        {
          ...(typeof selectedEntity.metadata?.enquiryId === "string" ? { enquiry_id: selectedEntity.metadata.enquiryId } : {}),
          ...(typeof selectedEntity.id === "string" ? { registration_id: selectedEntity.id } : {}),
          ...(typeof entityRecord?.registrationId === "string" ? { registration_id: entityRecord.registrationId } : {}),
        },
        selectedEntity,
        `The admission details are ready for ${selectedEntity.label || "the student"}.`
      );
    }
  }

  const shouldUseModuleWorkflow = shouldContinueModuleWorkflow(
    workflowState,
    latestMessage,
    prepared.intent
  );

  if (shouldUseModuleWorkflow && workflowState) {
    const workflowRouting = routeModuleWorkflow(latestMessage, workflowState);

    switch (workflowRouting.action) {
      case "select_entity": {
        const entities = (workflowState.matchedEntities || []) as unknown as Array<Record<string, unknown>>;
        const selection = resolveEntitySelection(
          workflowRouting.input,
          entities as SelectableEntity[]
        );

        if (selection.status === "ambiguous") {
          return buildModuleSelectionResponse(
            prepared,
            toolName,
            selection.candidates as Array<Record<string, unknown>>,
            workflowState.module,
            "I found multiple matching records. Please select one:"
          );
        }

        if (selection.status !== "resolved" && entities.length > 0) {
          return buildModuleSelectionResponse(
            prepared,
            toolName,
            entities,
            workflowState.module,
            isAffirmativeMessage(latestMessage)
              ? undefined
              : "I couldn't match that selection with the available records. Please select one of the listed records by number, name, or reference number."
          );
        }

        const selected = selection.entity as Record<string, unknown> | null;

        if (selected) {
          const config = getModuleWorkflowConfig(workflowState.module);
          // Admissions resolves the candidate first (selectTool) and hydrates
          // afterwards; Fees resolves and hydrates with the same tool.
          toolName = config.selectTool || config.hydrateTool || toolName;

          const selectedRecord =
            (selected.metadata as Record<string, unknown> | undefined) || selected;
          const selectedEntity = {
            id: typeof selected.id === "string" ? selected.id : "",
            label: typeof selected.label === "string" ? selected.label : "Unknown",
            reference: typeof selected.reference === "string" ? selected.reference : undefined,
            secondary: typeof selected.secondary === "string" ? selected.secondary : undefined,
            metadata: selectedRecord,
          };
          // The record is ready when the module needs no hydration step, or when
          // it already came from that hydration tool.
          const recordIsHydrated =
            !config.hydrateTool || workflowState.lastTool === config.hydrateTool;
          const selectionNavigation = recordIsHydrated
            ? buildRecordNavigation(workflowState.module, selectedRecord)
            : null;

          const selectedState = upsertConversationWorkflowState(
            prepared.context.projectId,
            workflowIds.userId,
            workflowIds.conversationId,
            {
              currentStage: selectionNavigation ? "completed" : "hydrating_context",
              selectedEntity,
              selectedRecord,
            }
          );

          // Modules whose list rows are already complete records (homework,
          // students) act on the selection immediately; modules with a hydrate
          // step (fees, admissions) re-resolve the full record first.
          if (selectionNavigation) {
            return buildModuleNavigationResponse(
              prepared,
              selectedState,
              selectionNavigation.route,
              selectionNavigation.label,
              selectionNavigation.query,
              selectedEntity,
              `${config.readyMessagePrefix} ${selectedEntity.label}.`
            );
          }

          break;
        }

        break;
      }
      case "hydrate_entity": {
        const config = getModuleWorkflowConfig(workflowState.module || "");
        if (config.hydrateTool) {
          toolName = config.hydrateTool;
        }
        break;
      }
      case "collect_slots": {
        const config = getModuleWorkflowConfig(workflowState.module || "");
        if (config.updateTool) {
          toolName = config.updateTool;
        }
        break;
      }
      case "execute_action": {
        const config = getModuleWorkflowConfig(workflowState.module || "");
        if (config.confirmTool && workflowState.pendingAction?.tool === config.confirmTool) {
          toolName = config.confirmTool;
        } else if (config.confirmTool) {
          toolName = config.confirmTool;
        }
        break;
      }
      case "cancel_workflow": {
        clearConversationWorkflowState(
          prepared.context.projectId,
          workflowIds.userId,
          workflowIds.conversationId
        );
        return {
          message: `The ${workflowState.module || "module"} workflow was cancelled. Let me know if you need anything else.`,
          conversationType: prepared.intent.type,
          status: "completed",
          toolExecutions: [
            {
              tool: `cancel${(workflowState.module || "module").charAt(0).toUpperCase()}${(workflowState.module || "module").slice(1)}Workflow`,
              status: "completed",
              summary: "Workflow cancelled by user.",
            },
          ],
          followUpSuggestions: ["Start over", "Ask a new question"],
          intent: prepared.intent,
          activeTools: prepared.activeTools,
        };
      }
      case "repeat_summary": {
        const fullName =
          (typeof workflowState.selectedEntity?.label === "string" &&
            workflowState.selectedEntity.label) ||
          "the selected record";
        return {
          message: `I'm ready to continue with ${fullName}. Please reply "yes" to proceed or "no" to cancel.`,
          conversationType: prepared.intent.type,
          status: "requires_input",
          toolExecutions: [
            {
              tool: "repeatWorkflowSummary",
              status: "completed",
              summary: "Repeated workflow summary.",
            },
          ],
          followUpSuggestions: ["Yes, proceed", "No, cancel"],
          intent: prepared.intent,
          activeTools: prepared.activeTools,
        };
      }
      case "wait_for_execution":
        return {
          message: "I'm processing your request. Please wait a moment...",
          conversationType: prepared.intent.type,
          status: "in_progress",
          toolExecutions: [
            {
              tool: toolName,
              status: "planned",
              summary: "Waiting for backend response.",
            },
          ],
          followUpSuggestions: ["Wait for completion"],
          intent: prepared.intent,
          activeTools: prepared.activeTools,
        };
      default:
        break;
    }
  }
  if (
    workflowState?.workflowId &&
    workflowState.currentStage === "collecting_slots"
  ) {
    const config = getModuleWorkflowConfig(workflowState.module);
    if (config.updateTool) {
      toolName = config.updateTool;
    }
  }

  if (
    workflowState?.workflowId &&
    workflowState.currentStage === "awaiting_confirmation" &&
    isAffirmativeMessage(latestMessage)
  ) {
    const config = getModuleWorkflowConfig(workflowState.module);
    if (config.confirmTool) {
      toolName = config.confirmTool;
    }
  }

  const definitions = await prepared.adapter.getToolDefinitions(prepared.context);
  const definition = definitions.find((candidate) => candidate.name === toolName);
  if (!definition) {
    return null;
  }

  // Re-read the workflow state so the record picked in this same turn is
  // visible, then project that real backend record onto the next tool's input.
  const activeWorkflowState =
    getConversationWorkflowState(
      prepared.context.projectId,
      workflowIds.userId,
      workflowIds.conversationId
    ) || workflowState;
  const selectedRecord = getSelectedRecord(activeWorkflowState);
  const contextInputCandidates = buildToolInputCandidates(toolName, selectedRecord);

  const inferredInput = mergeToolInput(
    await getFallbackToolInput(prepared, toolName),
    contextInputCandidates[0]
  );

  if (toolName === "getResultReport" && inferredInput == null) {
    return buildResultReportNeedsInputResponse(prepared, toolName);
  }

  if (toolName === "confirmAdmissionCandidate" && inferredInput == null) {
    return buildAdmissionConfirmationNeedsInputResponse(prepared, toolName);
  }

  if (toolName === "updateAdmissionCandidateDetails" && inferredInput == null) {
    const missingLabels = workflowState?.missingSlots
      ?.map((slot) => slot.label)
      .filter(
        (value): value is string => typeof value === "string" && value.trim().length > 0
      );
    return {
      message: `I still need ${missingLabels?.join(", ") || "the remaining required details"} before I can continue the admission confirmation workflow.`,
      conversationType: prepared.intent.type,
      status: "requires_input",
      toolExecutions: [
        {
          tool: toolName,
          status: "planned",
          summary: "Waiting for the remaining admission details.",
        },
      ],
      followUpSuggestions: [
        "Share the missing fields in one message.",
        "Include Division, Standard, or Quota if those are missing.",
      ],
      intent: prepared.intent,
      activeTools: prepared.activeTools,
    };
  }

  if (
    workflowState?.workflowId &&
    workflowState.currentStage === "selecting_entity" &&
    isAffirmativeMessage(prepared.context.latestUserMessage.content) &&
    (workflowState.matchedEntities || []).length > 0
  ) {
    return buildModuleSelectionResponse(
      prepared,
      toolName,
      (workflowState.matchedEntities || []) as unknown as Array<Record<string, unknown>>,
      workflowState.module
    );
  }

  // `requires_input` may only happen when nothing usable was resolved — neither
  // from the message nor from the record already held in conversation state.
  if (
    toolName === "findAdmissionCandidate" &&
    inferredInput &&
    typeof inferredInput === "object" &&
    !hasUsableToolInput(inferredInput)
  ) {
    return buildAdmissionConfirmationNeedsInputResponse(prepared, toolName);
  }

  if (
    (toolName === "findStudentFeeRecord" || toolName === "getStudentFeeDetails") &&
    !hasUsableToolInput(inferredInput)
  ) {
    return buildFeeCollectionNeedsInputResponse(prepared, toolName);
  }

  if (
    toolName === "updateAdmissionCandidateDetails" &&
    inferredInput &&
    typeof inferredInput === "object" &&
    "updates" in inferredInput &&
    Object.keys((inferredInput as { updates: Record<string, string> }).updates || {}).length === 0
  ) {
    const missingLabels = workflowState?.missingSlots
      ?.map((slot) => slot.label)
      .filter(
        (value): value is string => typeof value === "string" && value.trim().length > 0
      );
    return {
      message: `I still need ${missingLabels?.join(", ") || "the remaining required details"} before I can continue the admission confirmation workflow.`,
      conversationType: prepared.intent.type,
      status: "requires_input",
      toolExecutions: [
        {
          tool: toolName,
          status: "planned",
          summary: "Waiting for the remaining admission details.",
        },
      ],
      followUpSuggestions: [
        "Share the missing fields in one message.",
        "Include Division, Standard, or Quota if those are missing.",
      ],
      intent: prepared.intent,
      activeTools: prepared.activeTools,
    };
  }

  const parsedInput = definition.inputSchema.parse(inferredInput ?? {});
  let directResult: unknown;

  try {
    directResult = await definition.execute(parsedInput, prepared.context);

    // The strictest projection of the selected record can over-filter (for
    // example when the defaulter report and the collection API label the same
    // class differently). Retry with the looser projections of the SAME backend
    // record before giving up — never by inventing values.
    if (contextInputCandidates.length > 1) {
      const initialRecords = extractModuleRecords(toolName, directResult);
      if (initialRecords && initialRecords.entities.length === 0) {
        for (const candidate of contextInputCandidates.slice(1)) {
          try {
            const retryResult = await definition.execute(
              definition.inputSchema.parse(candidate),
              prepared.context
            );
            const retryRecords = extractModuleRecords(toolName, retryResult);
            if (retryRecords && retryRecords.entities.length > 0) {
              directResult = retryResult;
              break;
            }
          } catch {
            // Try the next, looser projection.
          }
        }
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "");

    if (
      toolName === "findAdmissionCandidate" &&
      /not found/i.test(message)
    ) {
      return {
        message:
          "I couldn't find a matching admission record with the details provided. Please share the student's full name, enquiry number, or mobile number.",
        conversationType: prepared.intent.type,
        status: "requires_input",
        toolExecutions: [
          {
            tool: toolName,
            status: "failed",
            summary: message,
          },
        ],
        followUpSuggestions: [
          "Share the student's full name.",
          "Provide the enquiry number.",
          "Provide the registered mobile number.",
        ],
        intent: prepared.intent,
        activeTools: prepared.activeTools,
      };
    }

    if (
      toolName === "findStudentFeeRecord" &&
      /student details not found|not found/i.test(message)
    ) {
      return {
        message:
          "I couldn't find a matching student in the fees records with the details provided. Please share the student's full name, GR number, roll number, or mobile number.",
        conversationType: prepared.intent.type,
        status: "requires_input",
        toolExecutions: [
          {
            tool: toolName,
            status: "failed",
            summary: message,
          },
        ],
        
        followUpSuggestions: [
          "Share the student's full name.",
          "Provide GR number or roll number.",
          "Provide mobile number if available.",
        ],
        intent: prepared.intent,
        activeTools: prepared.activeTools,
      };
    }

    if (
      toolName === "listFeesDefaulters" &&
      /student details not found|not found/i.test(message)
    ) {
      return {
        message:
          "I couldn't find pending-fee records for that filter combination. Please try another class, division, or student filter.",
        conversationType: prepared.intent.type,
        status: "completed",
        toolExecutions: [
          {
            tool: toolName,
            status: "failed",
            summary: message,
          },
        ],
        followUpSuggestions: [
          "Try another standard or division.",
          "Remove some filters and search again.",
        ],
        intent: prepared.intent,
        activeTools: prepared.activeTools,
      };
    }

    if (toolName === "getResultReport" && /validation failed|required|invalid/i.test(message)) {
      return buildResultReportNeedsInputResponse(prepared, toolName, message);
    }

    throw error;
  }

  const toolResult = normalizeDirectToolResult(directResult);
  const summary =
    summarizeToolBackedResult(prepared, [{ toolName, output: toolResult }]) ||
    "I completed the requested LMS action.";

  let status: ConversationalResponse["status"] = "completed";
  if (
    toolName === "findAdmissionCandidate" &&
    directResult &&
    typeof directResult === "object" &&
    "totalCount" in (directResult as Record<string, unknown>)
  ) {
    const count = Number((directResult as Record<string, unknown>).totalCount || 0);
    if (count !== 1) {
      status = "requires_input";
    } else {
      const first = Array.isArray((directResult as Record<string, unknown>).candidates)
        ? ((directResult as Record<string, unknown>).candidates as Array<Record<string, unknown>>)[0]
        : null;
      if (first && !Boolean(first.canConfirm)) {
        status = "requires_input";
      }
    }
  }

  if (
    toolName === "findStudentFeeRecord" &&
    directResult &&
    typeof directResult === "object" &&
    "totalCount" in (directResult as Record<string, unknown>)
  ) {
    const count = Number((directResult as Record<string, unknown>).totalCount || 0);
    if (count === 0 || count > 1) {
      status = "requires_input";
    }
  }

  // Generic, module-agnostic record capture. Any tool that returns backend rows
  // stores them as selectable records so the next user message can be resolved
  // against real data instead of being re-parsed from natural language.
  const capturedRecords =
    toolName === "findAdmissionCandidate" ||
    toolName === "updateAdmissionCandidateDetails"
      ? null // handled by the admission readiness pipeline below
      : extractModuleRecords(toolName, directResult);

  if (capturedRecords && capturedRecords.entities.length > 0) {
    const entities = capturedRecords.entities;
    const single = entities.length === 1 ? entities[0] : undefined;
    const singleRecord = single?.metadata as Record<string, unknown> | undefined;
    // Admissions confirms through its own hydrate + readiness pipeline, so a
    // single enquiry moves to hydration rather than straight to navigation.
    const isAdmissionsWorkflow = capturedRecords.module === "admissions";
    const navigation =
      single && !isAdmissionsWorkflow
        ? buildRecordNavigation(capturedRecords.module, singleRecord)
        : null;

    const nextState = upsertConversationWorkflowState(
      prepared.context.projectId,
      workflowIds.userId,
      workflowIds.conversationId,
      {
        module: capturedRecords.module,
        intent: capturedRecords.intent,
        workflowId: capturedRecords.workflowId,
        currentStage: !single
          ? "selecting_entity"
          : isAdmissionsWorkflow
            ? "hydrating_context"
            : navigation
              ? "completed"
              : "awaiting_confirmation",
        matchedEntities: entities,
        selectedEntity: single,
        selectedRecord: singleRecord,
        hydratedEntity: singleRecord,
        missingSlots: [],
        // A fresh discovery listing starts a new workflow; a targeted lookup
        // keeps whatever the user already supplied.
        collectedSlots: DISCOVERY_LIST_TOOLS.includes(toolName)
          ? {}
          : activeWorkflowState?.collectedSlots || {},
        lastTool: toolName,
        pendingAction:
          single && !isAdmissionsWorkflow && !navigation
            ? {
                tool: "moduleNavigation",
                payload: singleRecord || {},
                confirmationRequired: true,
              }
            : undefined,
      }
    );

    // A broad listing keeps its natural summary; a targeted lookup that still
    // matched several records asks the user to pick one of the real rows.
    if (
      entities.length > 1 &&
      !DISCOVERY_LIST_TOOLS.includes(toolName) &&
      !isAdmissionsWorkflow
    ) {
      return buildModuleSelectionResponse(
        prepared,
        toolName,
        entities as unknown as Array<Record<string, unknown>>,
        capturedRecords.module,
        "I found multiple matching records. Please select one:"
      );
    }

    // A single resolved record means the workflow can act: hand the user off to
    // the real module page with that record pre-selected.
    if (single && navigation) {
      return buildModuleNavigationResponse(
        prepared,
        nextState,
        navigation.route,
        navigation.label,
        navigation.query,
        single,
        `${getModuleWorkflowConfig(capturedRecords.module).readyMessagePrefix} ${single.label || "the selected record"}.`
      );
    }
  }

  if (
    toolName === "getStudentFeeDetails" ||
    toolName === "confirmAdmissionCandidate" ||
    toolName === "getResultReport" ||
    toolName === "getTeacherDailyReport" ||
    toolName === "getLmsDashboard" ||
    toolName === "getActivityStream"
  ) {
    clearConversationWorkflowState(
      prepared.context.projectId,
      workflowIds.userId,
      workflowIds.conversationId
    );
  }

  let admissionNavigationCandidate: Record<string, unknown> | null = null;

  if (toolName === "findAdmissionCandidate" || toolName === "updateAdmissionCandidateDetails") {
    const resultRecord =
      directResult && typeof directResult === "object"
        ? (directResult as Record<string, unknown>)
        : null;
    const appliedUpdates =
      resultRecord?.updates && typeof resultRecord.updates === "object"
        ? (resultRecord.updates as Record<string, unknown>)
        : {};
    const candidates = Array.isArray(resultRecord?.candidates)
      ? (resultRecord.candidates as Array<Record<string, unknown>>)
      : resultRecord?.candidate && typeof resultRecord.candidate === "object"
        ? [resultRecord.candidate as Record<string, unknown>]
        : [];
    const first = candidates[0];

    if (first) {
      const matchedEntities = candidates.map((candidate) => ({
        id: typeof candidate.id === "string" ? candidate.id : "",
        label:
          typeof candidate.studentName === "string"
            ? candidate.studentName
            : "Unknown student",
        reference:
          typeof candidate.enquiryNo === "string" ? candidate.enquiryNo : undefined,
        secondary:
          typeof candidate.standard === "string" ? candidate.standard : undefined,
        metadata: candidate,
      }));
      const readiness =
        typeof first.readiness === "string"
          ? first.readiness
          : Boolean(first.canConfirm)
            ? "ready"
            : "blocked";
      const missingSlots = Array.isArray(first.missingSlots)
        ? first.missingSlots.filter(
            (slot): slot is {
              key: string;
              label: string;
              required: boolean;
              value?: unknown;
              options?: Array<{ value: string; label: string }>;
            } =>
              typeof slot === "object" &&
              slot !== null &&
              typeof (slot as { key?: unknown }).key === "string" &&
              typeof (slot as { label?: unknown }).label === "string"
          )
        : [];

      if (candidates.length > 1) {
        upsertConversationWorkflowState(
          prepared.context.projectId,
          workflowIds.userId,
          workflowIds.conversationId,
          {
            module: "admissions",
            intent: "confirm_admission",
            workflowId: "admission_confirmation",
            currentStage: "selecting_entity",
            matchedEntities,
            selectedEntity: undefined,
            hydratedEntity: undefined,
            missingSlots: [],
            collectedSlots: {},
            pendingAction: undefined,
          }
        );
      } else if (readiness === "ready") {
        admissionNavigationCandidate = first;
        upsertConversationWorkflowState(
          prepared.context.projectId,
          workflowIds.userId,
          workflowIds.conversationId,
          {
            module: "admissions",
            intent: "confirm_admission",
            workflowId: "admission_confirmation",
            currentStage: "awaiting_confirmation",
            matchedEntities,
            selectedEntity: matchedEntities[0],
            hydratedEntity:
              typeof first.detail === "object" && first.detail !== null
                ? (first.detail as Record<string, unknown>)
                : undefined,
            missingSlots: [],
            collectedSlots: {
              ...(workflowState?.collectedSlots || {}),
              ...appliedUpdates,
            },
            pendingAction: {
              tool: "admissionConfirmationNavigation",
              payload: {
                id: typeof first.id === "string" ? first.id : "",
                enquiryId: typeof first.enquiryId === "string" ? first.enquiryId : undefined,
                registrationEnquiryId:
                  typeof first.registrationEnquiryId === "string"
                    ? first.registrationEnquiryId
                    : undefined,
              },
              confirmationRequired: true,
            },
          }
        );
      } else if (readiness === "missing_fields") {
        admissionNavigationCandidate = first;
        upsertConversationWorkflowState(
          prepared.context.projectId,
          workflowIds.userId,
          workflowIds.conversationId,
          {
            module: "admissions",
            intent: "confirm_admission",
            workflowId: "admission_confirmation",
            currentStage: "collecting_slots",
            matchedEntities,
            selectedEntity: matchedEntities[0],
            hydratedEntity:
              typeof first.detail === "object" && first.detail !== null
                ? (first.detail as Record<string, unknown>)
                : undefined,
            missingSlots,
            collectedSlots: {
              ...(workflowState?.collectedSlots || {}),
              ...appliedUpdates,
            },
            pendingAction: undefined,
          }
        );
      } else {
        if (readiness !== "already_confirmed") {
          admissionNavigationCandidate = first;
        }
        upsertConversationWorkflowState(
          prepared.context.projectId,
          workflowIds.userId,
          workflowIds.conversationId,
          {
            module: "admissions",
            intent: "confirm_admission",
            workflowId: "admission_confirmation",
            currentStage: readiness === "already_confirmed" ? "completed" : "failed",
            matchedEntities,
            selectedEntity: matchedEntities[0],
            hydratedEntity:
              typeof first.detail === "object" && first.detail !== null
                ? (first.detail as Record<string, unknown>)
                : undefined,
            missingSlots: [],
            collectedSlots: {},
            pendingAction: undefined,
          }
        );
      }
    }
  }

  if (toolName === "confirmAdmissionCandidate") {
    clearConversationWorkflowState(
      prepared.context.projectId,
      workflowIds.userId,
      workflowIds.conversationId
    );
  }

  if (
    toolName === "hydrateAdmissionCandidate" &&
    directResult &&
    typeof directResult === "object"
  ) {
    const resultRecord = directResult as Record<string, unknown>;
    const hydrateStatus = typeof resultRecord.status === "string" ? resultRecord.status : "";
    const data =
      typeof resultRecord.data === "object" && resultRecord.data !== null
        ? (resultRecord.data as Record<string, unknown>)
        : {};

    if (hydrateStatus === "ready_for_confirmation") {
      const entityId = String(
        typeof data.registrationId === "number"
          ? data.registrationId
          : typeof data.enquiryId === "number"
            ? data.enquiryId
            : ""
      );
      const enquiryIdStr = String(data.enquiryId || entityId || "");
      const navCandidate = {
        id: entityId,
        enquiryId: data.enquiryId,
        enquiryNo: data.enquiryNo,
        studentName: data.fullName,
        mobile: data.mobile,
        standard: data.standardName,
        standardName: data.standardName,
        registrationId: data.registrationId,
        status: typeof data.status === "string" ? data.status : "New",
        canConfirm: true,
        readiness: "ready",
        missingFields: [],
        missingSlots: [],
        detail: data,
      };

      upsertConversationWorkflowState(
        prepared.context.projectId,
        workflowIds.userId,
        workflowIds.conversationId,
        {
          module: "admissions",
          intent: "confirm_admission",
          workflowId: "admission_confirmation",
          currentStage: "awaiting_confirmation",
          matchedEntities: workflowState?.matchedEntities || [],
          selectedEntity: workflowState?.selectedEntity || {
            id: entityId,
            label:
              typeof data.fullName === "string"
                ? data.fullName
                : "Unknown student",
            reference:
              typeof data.enquiryNo === "string" ? data.enquiryNo : undefined,
          },
          hydratedEntity: data,
          missingSlots: [],
          collectedSlots: {
            ...(workflowState?.collectedSlots || {}),
          },
          pendingAction: {
            tool: "admissionConfirmationNavigation",
            payload: {
              id: entityId,
              enquiryId: enquiryIdStr,
              registrationEnquiryId:
                typeof data.registrationId === "string"
                  ? data.registrationId
                  : undefined,
            },
            confirmationRequired: true,
          },
        }
      );

      admissionNavigationCandidate = navCandidate;
    } else if (hydrateStatus === "missing_fields") {
      const missingFields = Array.isArray(data.missingFields)
        ? data.missingFields.filter(
            (f): f is string => typeof f === "string"
          )
        : [];
      const missingSlots = buildMissingSlotsFromFields(missingFields);

      const entityId = String(
        typeof data.registrationId === "number"
          ? data.registrationId
          : typeof data.enquiryId === "number"
            ? data.enquiryId
            : ""
      );
      const navCandidate = {
        id: entityId,
        enquiryId: data.enquiryId,
        enquiryNo: data.enquiryNo,
        studentName: data.fullName,
        mobile: data.mobile,
        standard: data.standardName,
        standardName: data.standardName,
        registrationId: data.registrationId,
        status: typeof data.status === "string" ? data.status : "New",
        canConfirm: false,
        readiness: "missing_fields",
        missingFields,
        missingSlots,
        detail: data,
      };

      upsertConversationWorkflowState(
        prepared.context.projectId,
        workflowIds.userId,
        workflowIds.conversationId,
        {
          module: "admissions",
          intent: "confirm_admission",
          workflowId: "admission_confirmation",
          currentStage: "collecting_slots",
          matchedEntities: workflowState?.matchedEntities || [],
          selectedEntity: workflowState?.selectedEntity || {
            id: entityId,
            label:
              typeof data.fullName === "string"
                ? data.fullName
                : "Unknown student",
            reference:
              typeof data.enquiryNo === "string" ? data.enquiryNo : undefined,
          },
          hydratedEntity: data,
          missingSlots,
          collectedSlots: {
            ...(workflowState?.collectedSlots || {}),
          },
          pendingAction: undefined,
        }
      );

      admissionNavigationCandidate = navCandidate;
    } else if (hydrateStatus === "error") {
      return {
        message:
          typeof resultRecord.message === "string"
            ? resultRecord.message
            : "I couldn't load the full admission details for this student. Please try again.",
        conversationType: prepared.intent.type,
        status: "requires_input",
        toolExecutions: [
          {
            tool: toolName,
            status: "failed",
            summary:
              typeof resultRecord.message === "string"
                ? resultRecord.message
                : "Hydration failed.",
          },
        ],
        followUpSuggestions: [
          "Share the student's full name or enquiry number again.",
          "Try selecting a different student from the list.",
        ],
        intent: prepared.intent,
        activeTools: prepared.activeTools,
      };
    }
  }

  if (admissionNavigationCandidate) {
    return buildAdmissionCandidateNavigationResponse(
      prepared,
      admissionNavigationCandidate,
      toolName
    );
  }

  if (toolName === "listAdmissionEnquiries") {
    const admissionMessage = summary || "I completed the requested LMS action.";
    return {
      message: admissionMessage,
      conversationType: prepared.intent.type,
      status,
      data: toolResult.data,
      messages: [buildAdmissionEnquiryFollowUpMessage(prepared)],
      toolExecutions: [
        {
          tool: toolName,
          status: "completed",
          summary: "Executed directly through the LMS backend workflow.",
        },
      ],
      followUpSuggestions:
        status === "requires_input"
          ? [
              "Share more student details to narrow the match.",
              "Add Standard and Division if available.",
            ]
          : [
              "Ask a follow-up question.",
              "Refine the result with more filters.",
            ],
      intent: prepared.intent,
      activeTools: prepared.activeTools,
    };
  }

  if (toolName === "executeModuleAction") {
    return {
      message: summary || "I completed the requested module action.",
      conversationType: prepared.intent.type,
      status,
      data: toolResult.data,
      toolExecutions: [
        {
          tool: toolName,
          status: "completed",
          summary: "Executed the module action through the shared LMS backend workflow.",
        },
      ],
      followUpSuggestions: [
        "Ask a follow-up question about the same module.",
        "Refine the result with more filters or a specific record.",
      ],
      intent: prepared.intent,
      activeTools: prepared.activeTools,
    };
  }

  return {
    message: summary,
    conversationType: prepared.intent.type,
    status,
    data: toolResult.data,
    toolExecutions: [
      {
        tool: toolName,
        status: "completed",
        summary: "Executed directly through the LMS backend workflow.",
      },
    ],
    followUpSuggestions:
      status === "requires_input"
        ? [
            "Share more student details to narrow the match.",
            "Add Standard and Division if available.",
          ]
        : [
            "Ask a follow-up question.",
            "Refine the result with more filters.",
          ],
    intent: prepared.intent,
    activeTools: prepared.activeTools,
  };
}

async function executeQuotaFallback(
  prepared: PreparedConversation
): Promise<ConversationalResponse | null> {
  const definitions = await prepared.adapter.getToolDefinitions(prepared.context);
  const toolName = prepared.activeTools.at(0);

  if (!toolName) {
    return null;
  }

  const definition = definitions.find((candidate) => candidate.name === toolName);
  if (!definition) {
    return null;
  }

  const inferredInput = await getFallbackToolInput(prepared, toolName);
  if (inferredInput == null) {
    return {
      message: buildLocalizedMessage(
        prepared.context.detectedLanguage,
        "I can still fetch the backend data, but I need one more detail to continue: please specify which result report you want, such as overall report, merit report, classwise grade report, or marks report.",
        "मैं बैकएंड से डेटा ला सकता हूँ, लेकिन आगे बढ़ने के लिए मुझे एक और जानकारी चाहिए: कृपया बताइए कि आपको कौन-सी result report चाहिए, जैसे overall report, merit report, classwise grade report, या marks report.",
        "હું બેકએન્ડમાંથી ડેટા મેળવી શકું છું, પરંતુ આગળ વધવા માટે મને એક વધુ માહિતી જોઈએ: કૃપા કરીને જણાવો કે તમને કઈ result report જોઈએ છે, જેમ કે overall report, merit report, classwise grade report, અથવા marks report."
      ),
      conversationType: prepared.intent.type,
      status: "requires_input",
      toolExecutions: [
        {
          tool: toolName,
          status: "planned",
          summary: "Waiting for one required parameter before executing the LMS tool.",
        },
      ],
      followUpSuggestions: [
        "Specify the exact result report type.",
        "Add class, division, term, or subject filters if needed.",
      ],
      intent: prepared.intent,
      activeTools: prepared.activeTools,
    };
  }

  const parsedInput = definition.inputSchema.parse(inferredInput);
  let directResult: unknown;

  try {
    directResult = await definition.execute(parsedInput, prepared.context);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "");

    if (
      toolName === "getResultReport" &&
      /validation failed|required|invalid/i.test(message)
    ) {
      return buildResultReportNeedsInputResponse(prepared, toolName, message);
    }

    throw error;
  }

  const toolResult = normalizeDirectToolResult(directResult);
  const fallbackMessage =
    summarizeToolBackedResult(prepared, [{ toolName, output: toolResult }]) ||
    buildLocalizedMessage(
      prepared.context.detectedLanguage,
      "The AI provider is temporarily unavailable, but I fetched the requested data directly from the LMS backend.",
      "AI provider अभी अस्थायी रूप से उपलब्ध नहीं है, लेकिन मैंने अनुरोधित डेटा सीधे LMS backend से प्राप्त कर लिया है।",
      "AI provider હાલમાં તાત્કાલિક રીતે ઉપલબ્ધ નથી, પરંતુ મેં માંગેલ ડેટા સીધું LMS backend માંથી મેળવી લીધું છે."
    );

  return {
    message: fallbackMessage,
    conversationType: prepared.intent.type,
    status: "completed",
    data: toolResult.data,
    toolExecutions: [
      {
        tool: toolName,
        status: "completed",
        summary: "Executed directly through the LMS backend because the AI provider is temporarily rate-limited.",
      },
    ],
    followUpSuggestions: [
      "Ask a follow-up question.",
      "Refine the result with more filters.",
    ],
    intent: prepared.intent,
    activeTools: prepared.activeTools,
  };
}

export async function prepareConversation(
  adapter: ProjectAIAdapter,
  request: ConversationRequest,
  messages: ModelMessage[]
): Promise<PreparedConversation> {
  const context = await adapter.resolveContext({
    request,
    trustedContext: request.context || {},
  });
  const intent = await adapter.classifyIntent(context);
  await adapter.validatePermission(intent, context);

  const allowedTools = await adapter.getAllowedToolNames(context);
  const definitions = await adapter.getToolDefinitions(context);
  const activeTools = shouldBypassTools(intent)
    ? []
    : intent.suggestedTool && allowedTools.includes(intent.suggestedTool)
      ? [intent.suggestedTool]
      : allowedTools;
  const tools = createProjectTools(
    definitions.filter((definition) => activeTools.includes(definition.name)),
    context
  );
  const systemPrompt = await adapter.buildSystemPrompt(context, intent);

  recordAuditEvent(
    "conversation.request",
    {
      projectId: adapter.projectId,
      intentType: intent.type,
      capability: intent.capability,
      activeTools,
      messageCount: messages.length,
    },
    {
      userId: context.userId,
      organizationId: context.orgId,
    }
  );

  return {
    adapter,
    context,
    intent,
    systemPrompt,
    activeTools,
    tools,
    toolDefinitions: definitions.filter((definition) => activeTools.includes(definition.name)),
  };
}

export async function generateConversationResponse(
  adapter: ProjectAIAdapter,
  request: ConversationRequest,
  messages: ModelMessage[]
): Promise<ConversationalResponse> {
  const prepared = await prepareConversation(adapter, request, messages);
  const latestUserMessage = getLatestUserMessage(request);
  const sessionId = prepared.context.userId || "anonymous";
  const userId = prepared.context.userId || "anonymous";

  appendConversationHistory({
    sessionId,
    userId,
    messages: [latestUserMessage],
  });

  let response: ConversationalResponse;
  const localSharedAnswer = getLocalSharedAnswer(prepared);

  if (localSharedAnswer) {
    response = {
      message: localSharedAnswer,
      conversationType: prepared.intent.type,
      status: "completed",
      toolExecutions: [],
      followUpSuggestions: [
        "Ask a follow-up question.",
        "Ask about an LMS task like homework or reports.",
      ],
      intent: prepared.intent,
      activeTools: prepared.activeTools,
    };

    appendConversationHistory({
      sessionId,
      userId,
      messages: [
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: response.message,
        },
      ],
    });

    recordAuditEvent(
      "conversation.response",
      {
        projectId: adapter.projectId,
        capability: prepared.intent.capability,
        conversationType: prepared.intent.type,
        activeTools: prepared.activeTools,
        status: response.status,
      },
      {
        userId: prepared.context.userId,
        organizationId: prepared.context.orgId,
      }
    );

    return response;
  }

  const directToolResponse = await executePreferredTool(prepared);
  if (directToolResponse) {
    appendConversationHistory({
      sessionId,
      userId,
      messages: [
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: directToolResponse.message,
        },
      ],
    });

    recordAuditEvent(
      "conversation.response",
      {
        projectId: adapter.projectId,
        capability: prepared.intent.capability,
        conversationType: prepared.intent.type,
        activeTools: prepared.activeTools,
        status: directToolResponse.status,
      },
      {
        userId: prepared.context.userId,
        organizationId: prepared.context.orgId,
      }
    );

    return directToolResponse;
  }

  try {
    const result = await generateText({
      model: createAiModel(),
      system: prepared.systemPrompt,
      messages,
      stopWhen: stepCountIs(6),
      maxRetries: 0,
      tools: prepared.tools,
      activeTools: prepared.activeTools,
      providerOptions: {
        google: {
          thinkingConfig: {
            thinkingBudget: 0,
            includeThoughts: false,
          },
        },
      },
    });

    const fallbackMessage = summarizeToolBackedResult(prepared, result.toolResults);
    const generatedMessage = result.text?.trim();
    const safeMessage =
      generatedMessage && mentionsProviderRateLimit(generatedMessage) && fallbackMessage
        ? fallbackMessage
        : generatedMessage;

    response = {
      message:
        safeMessage ||
        fallbackMessage ||
        "I completed the request, but there was no visible text to display.",
      conversationType: prepared.intent.type,
      status: "completed",
      toolExecutions: prepared.activeTools.map((toolName) => ({
        tool: toolName,
        status: "completed",
        summary: "Executed through the shared conversational AI pipeline.",
      })),
      followUpSuggestions: [
        "Ask a follow-up question.",
        "Refine the result with more filters.",
      ],
      intent: prepared.intent,
      activeTools: prepared.activeTools,
    };
  } catch (error) {
    if (!isQuotaExceededError(error)) {
      throw error;
    }

    const sharedFallback = getLocalSharedAnswer(prepared);
    if (sharedFallback) {
      response = {
        message: sharedFallback,
        conversationType: prepared.intent.type,
        status: "completed",
        toolExecutions: [],
        followUpSuggestions: [
          "Ask a follow-up question.",
          "Ask about an LMS task like homework or reports.",
        ],
        intent: prepared.intent,
        activeTools: prepared.activeTools,
      };

      appendConversationHistory({
        sessionId,
        userId,
        messages: [
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: response.message,
          },
        ],
      });

      recordAuditEvent(
        "conversation.response",
        {
          projectId: adapter.projectId,
          capability: prepared.intent.capability,
          conversationType: prepared.intent.type,
          activeTools: prepared.activeTools,
          status: response.status,
        },
        {
          userId: prepared.context.userId,
          organizationId: prepared.context.orgId,
        }
      );

      return response;
    }

    const fallbackResponse = await executeQuotaFallback(prepared);
    if (!fallbackResponse) {
      throw error;
    }

    response = fallbackResponse;
  }

  appendConversationHistory({
    sessionId,
    userId,
    messages: [
      {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response.message,
      },
    ],
  });

  recordAuditEvent(
    "conversation.response",
    {
      projectId: adapter.projectId,
      capability: prepared.intent.capability,
      conversationType: prepared.intent.type,
      activeTools: prepared.activeTools,
      status: response.status,
    },
    {
      userId: prepared.context.userId,
      organizationId: prepared.context.orgId,
    }
  );

  return response;
}

export async function streamConversationResponse(
  adapter: ProjectAIAdapter,
  request: ConversationRequest,
  messages: ModelMessage[]
) {
  const prepared = await prepareConversation(adapter, request, messages);

  return {
    intent: prepared.intent,
    activeTools: prepared.activeTools,
    result: streamText({
      model: createAiModel(),
      system: prepared.systemPrompt,
      messages,
      stopWhen: stepCountIs(6),
      maxRetries: 0,
      tools: prepared.tools,
      activeTools: prepared.activeTools,
      providerOptions: {
        google: {
          thinkingConfig: {
            thinkingBudget: 0,
            includeThoughts: false,
          },
        },
      },
    }),
  };
}
