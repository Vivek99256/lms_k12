import { selectEntityOrNull, type SelectableEntity } from "./entity-selection";
import type { ConversationWorkflowState } from "./workflow-state";

export type ModuleWorkflowStage =
  | "idle"
  | "searching"
  | "selecting_entity"
  | "hydrating_context"
  | "collecting_slots"
  | "awaiting_confirmation"
  | "executing"
  | "completed"
  | "failed";

export type ModuleWorkflowAction =
  | { action: "detect_new_intent" }
  | { action: "select_entity"; input: string }
  | { action: "hydrate_entity" }
  | { action: "collect_slots"; input: string }
  | { action: "execute_action" }
  | { action: "cancel_workflow" }
  | { action: "repeat_summary" }
  | { action: "wait_for_execution" };

export interface ModuleWorkflowConfig {
  module: string;
  workflowId: string;
  listTools: string[];
  selectTool: string;
  confirmTool?: string;
  updateTool?: string;
  hydrateTool?: string;
  navigationRoute: string;
  navigationLabel: string;
  entityIdParam: string;
  entityReferenceParam?: string;
  extractEntityId: (
    entity: Record<string, unknown>,
    userMessage: string
  ) => string | null;
  buildNavigationQuery: (
    entity: Record<string, unknown>,
    workflowState: Record<string, unknown>
  ) => Record<string, string | number>;
  readyMessagePrefix: string;
}

export const DEFAULT_MODULE_WORKFLOW_CONFIG: ModuleWorkflowConfig = {
  module: "general",
  workflowId: "general_lookup",
  listTools: [],
  selectTool: "",
  navigationRoute: "/dashboard",
  navigationLabel: "Open Dashboard",
  entityIdParam: "id",
  extractEntityId: () => null,
  buildNavigationQuery: () => ({}),
  readyMessagePrefix: "I found the record for",
};

export const MODULE_WORKFLOW_CONFIGS: Record<string, ModuleWorkflowConfig> = {
  admissions: {
    module: "admissions",
    workflowId: "admission_confirmation",
    listTools: ["listAdmissionEnquiries"],
    selectTool: "findAdmissionCandidate",
    confirmTool: "confirmAdmissionCandidate",
    updateTool: "updateAdmissionCandidateDetails",
    hydrateTool: "hydrateAdmissionCandidate",
    navigationRoute: "/admissions/confirmation",
    navigationLabel: "Continue to Admission Confirmation",
    entityIdParam: "registration_id",
    entityReferenceParam: "enquiry_id",
    extractEntityId: (entity) => {
      const id =
        typeof entity.id === "string"
          ? entity.id
          : typeof entity.enquiryId === "string"
            ? entity.enquiryId
            : typeof entity.enquiryId === "number"
              ? String(entity.enquiryId)
              : null;
      return id;
    },
    buildNavigationQuery: (entity) => {
      const query: Record<string, string | number> = {};
      const enquiryId =
        typeof entity.enquiryId === "string"
          ? entity.enquiryId
          : typeof entity.enquiryId === "number"
            ? String(entity.enquiryId)
            : typeof entity.enquiryNo === "string"
              ? entity.enquiryNo
              : null;
      const registrationId =
        typeof entity.registrationId === "string"
          ? entity.registrationId
          : typeof entity.registrationId === "number"
            ? String(entity.registrationId)
            : typeof entity.id === "string"
              ? entity.id
              : null;
      if (enquiryId) query.enquiry_id = enquiryId;
      if (registrationId) query.registration_id = registrationId;
      return query;
    },
    readyMessagePrefix: "The admission details are ready for",
  },
  fees: {
    module: "fees",
    workflowId: "fee_collection",
    listTools: ["listFeesDefaulters", "findStudentFeeRecord"],
    selectTool: "findStudentFeeRecord",
    hydrateTool: "findStudentFeeRecord",
    confirmTool: "getStudentFeeDetails",
    navigationRoute: "/fees/collect",
    navigationLabel: "Continue to Fee Collection",
    entityIdParam: "student_id",
    entityReferenceParam: "enrollment_no",
    extractEntityId: (entity) => {
      return (
        typeof entity.id === "string"
          ? entity.id
          : typeof entity.studentId === "string"
            ? entity.studentId
            : typeof entity.studentId === "number"
              ? String(entity.studentId)
              : null
      );
    },
    buildNavigationQuery: (entity) => {
      const query: Record<string, string | number> = {};
      const studentId =
        typeof entity.id === "string"
          ? entity.id
          : typeof entity.studentId === "string"
            ? entity.studentId
            : typeof entity.studentId === "number"
              ? String(entity.studentId)
              : null;
      if (studentId) query.student_id = studentId;
      if (typeof entity.enrollmentNo === "string" && entity.enrollmentNo) {
        query.enrollment_no = entity.enrollmentNo;
      }
      if (typeof entity.rollNo === "string" && entity.rollNo) {
        query.roll_no = entity.rollNo;
      }
      return query;
    },
    readyMessagePrefix: "Fee collection is ready for",
  },
  students: {
    module: "students",
    workflowId: "student_lookup",
    listTools: ["searchStudents"],
    selectTool: "searchStudents",
    navigationRoute: "/students/search_student",
    navigationLabel: "View Student Details",
    entityIdParam: "id",
    entityReferenceParam: "enrollment_no",
    extractEntityId: (entity) => {
      return typeof entity.id === "string" ? entity.id : null;
    },
    buildNavigationQuery: (entity) => {
      const query: Record<string, string | number> = {};
      if (typeof entity.id === "string" && entity.id) query.id = entity.id;
      if (typeof entity.enrollmentNo === "string" && entity.enrollmentNo) {
        query.enrollment_no = entity.enrollmentNo;
      }
      if (typeof entity.rollNo === "string" && entity.rollNo) {
        query.roll_no = entity.rollNo;
      }
      return query;
    },
    readyMessagePrefix: "Student details found for",
  },
  results: {
    module: "results",
    workflowId: "result_report",
    listTools: ["getResultReport"],
    selectTool: "getResultReport",
    navigationRoute: "/result/marks_entry",
    navigationLabel: "View Result Report",
    entityIdParam: "id",
    extractEntityId: () => null,
    buildNavigationQuery: () => ({}),
    readyMessagePrefix: "Result report is ready for",
  },
  attendance: {
    module: "attendance",
    workflowId: "attendance_report",
<<<<<<< HEAD
    listTools: ["getTeacherDailyReport"],
    selectTool: "getTeacherDailyReport",
    navigationRoute: "/attendance",
    navigationLabel: "View Attendance",
    entityIdParam: "id",
    extractEntityId: () => null,
    buildNavigationQuery: () => ({}),
=======
    // Student attendance has its own workflow; the teacher daily report stays
    // available for teacher-attendance questions.
    listTools: ["getAttendanceOverview", "getTeacherDailyReport"],
    selectTool: "getAttendanceOverview",
    navigationRoute: "/student/daywise_student_attendance",
    navigationLabel: "Open Daywise Attendance Report",
    entityIdParam: "id",
    extractEntityId: () => null,
    buildNavigationQuery: (entity) => {
      const query: Record<string, string | number> = {};
      if (typeof entity.date === "string" && entity.date) query.date = entity.date;
      if (typeof entity.standardId === "string" && entity.standardId) {
        query.standard_id = entity.standardId;
      }
      if (typeof entity.divisionId === "string" && entity.divisionId) {
        query.division_id = entity.divisionId;
      }
      return query;
    },
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
    readyMessagePrefix: "Attendance report is ready",
  },
  homework: {
    module: "homework",
    workflowId: "homework_review",
    listTools: ["listHomework"],
    selectTool: "listHomework",
    navigationRoute: "/lms/homework/report",
    navigationLabel: "Open Homework Report",
    entityIdParam: "homework_id",
    extractEntityId: (entity) =>
      typeof entity.homeworkId === "string"
        ? entity.homeworkId
        : typeof entity.id === "string"
          ? entity.id
          : null,
    buildNavigationQuery: (entity) => {
      const query: Record<string, string | number> = {};
      const homeworkId =
        typeof entity.homeworkId === "string"
          ? entity.homeworkId
          : typeof entity.id === "string"
            ? entity.id
            : "";
      if (homeworkId) query.homework_id = homeworkId;
      if (typeof entity.standardId === "string" && entity.standardId) {
        query.standard_id = entity.standardId;
      }
      if (typeof entity.divisionId === "string" && entity.divisionId) {
        query.division_id = entity.divisionId;
      }
      if (typeof entity.subjectId === "string" && entity.subjectId) {
        query.subject_id = entity.subjectId;
      }
      if (typeof entity.date === "string" && entity.date) {
        query.from_date = entity.date;
        query.to_date = entity.date;
      }
      return query;
    },
    readyMessagePrefix: "The homework record is ready:",
  },
  exams: {
    module: "exams",
    workflowId: "exam_report",
    listTools: ["getResultReport"],
    selectTool: "getResultReport",
    navigationRoute: "/exam",
    navigationLabel: "View Exam Details",
    entityIdParam: "id",
    extractEntityId: () => null,
    buildNavigationQuery: () => ({}),
    readyMessagePrefix: "Exam details are ready",
  },
  library: {
    module: "library",
    workflowId: "library_lookup",
    listTools: [],
    selectTool: "",
    navigationRoute: "/library",
    navigationLabel: "Open Library",
    entityIdParam: "id",
    extractEntityId: () => null,
    buildNavigationQuery: () => ({}),
    readyMessagePrefix: "Library record found for",
  },
  transport: {
    module: "transport",
    workflowId: "transport_lookup",
    listTools: [],
    selectTool: "",
    navigationRoute: "/Transportation",
    navigationLabel: "Open Transport",
    entityIdParam: "id",
    extractEntityId: () => null,
    buildNavigationQuery: () => ({}),
    readyMessagePrefix: "Transport details found for",
  },
  hostel: {
    module: "hostel",
    workflowId: "hostel_lookup",
    listTools: [],
    selectTool: "",
    navigationRoute: "/hostel",
    navigationLabel: "Open Hostel",
    entityIdParam: "id",
    extractEntityId: () => null,
    buildNavigationQuery: () => ({}),
    readyMessagePrefix: "Hostel details found for",
  },
  notifications: {
    module: "notifications",
    workflowId: "notification_lookup",
    listTools: [],
    selectTool: "",
    navigationRoute: "/easy_com",
    navigationLabel: "Open Notifications",
    entityIdParam: "id",
    extractEntityId: () => null,
    buildNavigationQuery: () => ({}),
    readyMessagePrefix: "Notification found for",
  },
  accounts: {
    module: "accounts",
    workflowId: "account_lookup",
    listTools: [],
    selectTool: "",
    navigationRoute: "/accounts",
    navigationLabel: "Open Accounts",
    entityIdParam: "id",
    extractEntityId: () => null,
    buildNavigationQuery: () => ({}),
    readyMessagePrefix: "Account details found for",
  },
  teachers: {
    module: "teachers",
    workflowId: "teacher_lookup",
<<<<<<< HEAD
    listTools: ["getTeacherDailyReport"],
    selectTool: "getTeacherDailyReport",
=======
    listTools: ["getTeacherDirectory", "getClassTeachers", "getTeacherDailyReport"],
    selectTool: "getTeacherDirectory",
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
    navigationRoute: "/classteacher",
    navigationLabel: "View Teacher Details",
    entityIdParam: "id",
    extractEntityId: () => null,
    buildNavigationQuery: () => ({}),
    readyMessagePrefix: "Teacher details found for",
  },
<<<<<<< HEAD
=======
  subjects: {
    module: "subjects",
    workflowId: "subject_catalog",
    listTools: ["getSubjectCatalog"],
    selectTool: "getSubjectCatalog",
    navigationRoute: "/subjects",
    navigationLabel: "Open Subjects",
    entityIdParam: "id",
    extractEntityId: () => null,
    buildNavigationQuery: () => ({}),
    readyMessagePrefix: "Subject details found for",
  },
  courses: {
    module: "courses",
    workflowId: "course_catalog",
    listTools: ["getCourseCatalog"],
    selectTool: "getCourseCatalog",
    navigationRoute: "/course-master",
    navigationLabel: "Open Course Master",
    entityIdParam: "id",
    extractEntityId: () => null,
    buildNavigationQuery: () => ({}),
    readyMessagePrefix: "Course details found for",
  },
  departments: {
    module: "departments",
    workflowId: "department_lookup",
    listTools: ["getDepartmentDirectory"],
    selectTool: "getDepartmentDirectory",
    navigationRoute: "/Institute_Detail/Department",
    navigationLabel: "Open Departments",
    entityIdParam: "id",
    extractEntityId: () => null,
    buildNavigationQuery: () => ({}),
    readyMessagePrefix: "Department details found for",
  },
  classes: {
    module: "classes",
    workflowId: "class_structure",
    listTools: ["getClassStructure"],
    selectTool: "getClassStructure",
    navigationRoute: "/academic_setup",
    navigationLabel: "Open Academic Setup",
    entityIdParam: "id",
    extractEntityId: () => null,
    buildNavigationQuery: () => ({}),
    readyMessagePrefix: "Class details found for",
  },
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
};

export function getModuleWorkflowConfig(
  module: string | undefined
): ModuleWorkflowConfig {
  if (!module) {
    return DEFAULT_MODULE_WORKFLOW_CONFIG;
  }

  const normalized = module.toLowerCase().trim();
  return (
    MODULE_WORKFLOW_CONFIGS[normalized] ||
    MODULE_WORKFLOW_CONFIGS[normalized.replace(/s$/, "")] ||
    DEFAULT_MODULE_WORKFLOW_CONFIG
  );
}

export function getWorkflowConfigByWorkflowId(
  workflowId: string | undefined
): ModuleWorkflowConfig {
  if (!workflowId) {
    return DEFAULT_MODULE_WORKFLOW_CONFIG;
  }

  return (
    Object.values(MODULE_WORKFLOW_CONFIGS).find(
      (config) => config.workflowId === workflowId
    ) || DEFAULT_MODULE_WORKFLOW_CONFIG
  );
}

export function looksLikeDifferentModuleRequest(
  message: string,
  currentModule?: string
): boolean {
  if (!currentModule) {
    return false;
  }

  const normalized = message.toLowerCase().trim();
  const moduleKeywords: Record<string, string[]> = {
    admissions: ["admission", "enquiry", "candidate", "registration", "confirm"],
    fees: ["fee", "fees", "defaulter", "dues", "collect", "payment", "pending fees"],
    students: ["student", "learner", "parent", "guardian"],
    teachers: ["teacher", "staff", "class teacher"],
    homework: ["homework", "assignment", "classwork"],
    results: ["result", "marks", "report card", "merit", "grade report"],
    attendance: ["attendance", "absent", "present"],
    exams: ["exam", "assessment", "test"],
    timetable: ["timetable", "schedule", "period"],
    library: ["library", "book", "resource"],
    transport: ["transport", "bus", "van", "route"],
    hostel: ["hostel", "room", "mess"],
    notifications: ["notification", "notice", "message"],
    accounts: ["account", "ledger", "invoice", "expense"],
<<<<<<< HEAD
=======
    subjects: ["subject", "syllabus"],
    courses: ["course", "curriculum", "chapter"],
    departments: ["department", "sub-department", "sub department"],
    classes: ["class list", "classes", "section list", "divisions", "standards"],
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
  };

  const currentKeywords = moduleKeywords[currentModule.toLowerCase()] || [];
  const isCurrentModule =
    currentKeywords.some((keyword) => normalized.includes(keyword)) ||
    normalized.includes(currentModule.toLowerCase());

  if (isCurrentModule) {
    return false;
  }

  const allOtherKeywords = Object.entries(moduleKeywords)
    .filter(([mod]) => mod !== currentModule.toLowerCase())
    .flatMap(([, keywords]) => keywords);

  return allOtherKeywords.some((keyword) => normalized.includes(keyword));
}

export function isIntentForModule(
  intent: { capability?: string | null; suggestedTool?: string | null } | null | undefined,
  currentModule: string | undefined
): boolean {
  if (!intent || !currentModule) {
    return false;
  }

  const normalizedCapability = (intent.capability || "").toLowerCase();
  const normalizedTool = (intent.suggestedTool || "").toLowerCase();
  const normalizedModule = currentModule.toLowerCase();

  const moduleToolMap: Record<string, string[]> = {
    admissions: ["admission", "confirmAdmission", "findAdmission", "hydrateAdmission", "updateAdmission", "listAdmissionEnquiries"],
<<<<<<< HEAD
    fees: ["fee", "findStudentFee", "getStudentFee", "listFeesDefaulters"],
    students: ["student", "searchStudent"],
    teachers: ["teacher", "getTeacherDaily"],
    homework: ["homework", "listHomework"],
    results: ["result", "getResultReport"],
    attendance: ["attendance", "getTeacherDaily"],
=======
    fees: ["fee", "findStudentFee", "getStudentFee", "listFeesDefaulters", "getFeesSummary"],
    students: ["student", "searchStudent", "getStudentDirectory"],
    teachers: ["teacher", "getTeacherDaily", "getTeacherDirectory", "getClassTeachers"],
    homework: ["homework", "listHomework"],
    results: ["result", "getResultReport"],
    attendance: ["attendance", "getAttendanceOverview", "getStudentAttendanceDetail"],
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
    exams: ["exam", "result"],
    timetable: ["timetable"],
    library: ["library"],
    transport: ["transport"],
    hostel: ["hostel"],
    notifications: ["notification"],
    accounts: ["account"],
<<<<<<< HEAD
=======
    subjects: ["subject", "getSubjectCatalog"],
    courses: ["course", "getCourseCatalog"],
    departments: ["department", "getDepartmentDirectory"],
    classes: ["class_structure", "getClassStructure"],
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
  };

  const expectedTools = moduleToolMap[normalizedModule] || [];
  return (
    expectedTools.some((tool) => normalizedCapability.includes(tool)) ||
    expectedTools.some((tool) => normalizedTool.includes(tool))
  );
}

export function shouldContinueModuleWorkflow(
  workflowState: ConversationWorkflowState | null | undefined,
  message: string,
  intent: { capability?: string | null; suggestedTool?: string | null } | null | undefined
): boolean {
  if (!workflowState || (workflowState.currentStage as string) === "idle") {
    return false;
  }

  const normalizedMessage = message.trim();
  if (!normalizedMessage) {
    return false;
  }

  const stage = workflowState.currentStage as string;
  const currentModule = workflowState.module as string | undefined;

  if (/^(yes|haan|ha|yep|yeah|ok|okay|sure|continue|go ahead|proceed|confirm|open)\b/i.test(normalizedMessage)) {
    return (
      stage === "awaiting_confirmation" ||
      stage === "selecting_entity" ||
      stage === "hydrating_context"
    );
  }

  if (/^(no|nah|na|cancel|don't|do not|stop)\b/i.test(normalizedMessage)) {
    return (
      stage === "awaiting_confirmation" ||
      stage === "selecting_entity"
    );
  }

  if (looksLikeDifferentModuleRequest(normalizedMessage, currentModule)) {
    return false;
  }

  if (isIntentForModule(intent, currentModule)) {
    return true;
  }

  return (
    stage === "selecting_entity" ||
    stage === "collecting_slots" ||
    stage === "hydrating_context" ||
    stage === "awaiting_confirmation"
  );
}

export function routeModuleWorkflow(
  userMessage: string,
  workflowState: ConversationWorkflowState
): ModuleWorkflowAction {
  const stage = workflowState.currentStage as string;

  switch (stage) {
    case "selecting_entity":
      return { action: "select_entity", input: userMessage };
    case "hydrating_context":
      return { action: "hydrate_entity" };
    case "collecting_slots":
      return { action: "collect_slots", input: userMessage };
    case "awaiting_confirmation":
      if (/^(yes|haan|ha|yep|yeah|ok|okay|sure|confirm|open|go ahead|proceed)\b/i.test(userMessage)) {
        return { action: "execute_action" };
      }
      if (/^(no|nah|na|cancel|don't|do not|stop)\b/i.test(userMessage)) {
        return { action: "cancel_workflow" };
      }
      return { action: "repeat_summary" };
    case "executing":
      return { action: "wait_for_execution" };
    default:
      return { action: "detect_new_intent" };
  }
}

/**
 * Resolves the user's reply to one of the records a previous tool returned.
 * Delegates to the shared selection resolver so every module (Admissions, Fees,
 * Homework, …) accepts the same selection styles: a number, a name, a name plus
 * standard, a name plus reference, or the full displayed line.
 */
export function resolveWorkflowSelection(
  message: string,
  entities: Array<Record<string, unknown>>
): Record<string, unknown> | null {
  return selectEntityOrNull(message, (entities || []) as SelectableEntity[]) as
    | Record<string, unknown>
    | null;
}
