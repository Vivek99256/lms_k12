import { z } from "zod";

export const lmsDashboardInputSchema = z.object({
  userId: z.string().optional(),
  userProfile: z.string().optional(),
});

export const activityStreamInputSchema = z.object({});

export const homeworkListInputSchema = z.object({
  grade: z.string().optional().describe(
    "Optional. Leave empty to use the current session scope."
  ),
  standard: z.string().optional().describe(
    "Optional. Leave empty to use the logged-in user's current class or accessible scope."
  ),
  division: z.string().optional().describe(
    "Optional. Leave empty unless the user explicitly asks for a division filter."
  ),
  subject: z.string().optional().describe(
    "Optional. Leave empty unless the user asks for subject-specific homework."
  ),
  fromDate: z.string().optional().describe(
    "Optional start date filter."
  ),
  toDate: z.string().optional().describe(
    "Optional end date filter."
  ),
});

export const feesDefaulterInputSchema = z.object({
  grade: z.string().optional(),
  standard: z.string().optional(),
  division: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  enrollmentNo: z.string().optional(),
  mobileNo: z.string().optional(),
  uniqueId: z.string().optional(),
});

export const studentSearchInputSchema = z.object({
  grade: z.string().optional(),
  standard: z.string().optional(),
  division: z.string().optional(),
  studentName: z.string().optional(),
  rollNo: z.string().optional(),
  enrollmentNo: z.string().optional(),
  mobileNo: z.string().optional(),
});

export const studentFeeRecordInputSchema = z.object({
  studentName: z.string().optional(),
  grade: z.string().optional(),
  standard: z.string().optional(),
  division: z.string().optional(),
  enrollmentNo: z.string().optional(),
  rollNo: z.string().optional(),
  mobileNo: z.string().optional(),
  uniqueId: z.string().optional(),
});

export const studentFeeDetailsInputSchema = z.object({
  studentId: z.string(),
});

export const teacherDailyReportInputSchema = z.object({
  date: z.string().optional(),
  status: z.enum(["Y", "N"]).optional(),
});

export const resultReportInputSchema = z.object({
  reportOf: z.enum([
    "overall_report",
    "merit_report",
    "subject_progress_report",
    "classwise_report",
    "classwise_grade_report",
    "marks_report",
    "weightage_conversion_report",
    "created_exam_report",
  ]),
  grade: z.string().optional(),
  standard: z.string().optional(),
  division: z.string().optional(),
  term: z.string().optional(),
  subject: z.string().optional(),
  examType: z.string().optional(),
  examCreate: z.string().optional(),
  topStudents: z.string().optional(),
  rollNo: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  additionalSubjects: z.array(z.string()).optional(),
});

export const admissionEnquiryInputSchema = z.object({
  status: z.string().optional(),
  standard: z.string().optional(),
  searchText: z.string().optional(),
  onlyPending: z.boolean().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});

export const admissionCandidateInputSchema = z.object({
  studentName: z.string().optional(),
  enquiryNo: z.string().optional(),
  mobileNo: z.string().optional(),
  standard: z.string().optional(),
  onlyPending: z.boolean().optional(),
});

export const admissionConfirmInputSchema = z.object({
  id: z.string(),
  enquiryId: z.string().optional(),
  registrationEnquiryId: z.string().optional(),
  termId: z.string().optional(),
});

export const admissionUpdateInputSchema = z.object({
  id: z.string(),
  updates: z.record(z.string(), z.string()).default({}),
  studentName: z.string().optional(),
  enquiryNo: z.string().optional(),
  mobileNo: z.string().optional(),
  standard: z.string().optional(),
});

export const admissionHydrateInputSchema = z.object({
  enquiryId: z.string().optional(),
});

export const contextualSuggestionsSchema = z.object({
  module: z.string().optional(),
  context: z.string().optional(),
});

/* -------------------------------------------------------------------------- */
/* Directory, attendance, catalogue and analysis tools                        */
/* -------------------------------------------------------------------------- */

export const studentDirectoryInputSchema = z.object({
  grade: z.string().optional().describe("Academic section name, e.g. Primary."),
  standard: z
    .string()
    .optional()
    .describe("Standard/class name or id, e.g. '7' or 'Standard 7'."),
  division: z.string().optional().describe("Division/section name or id, e.g. 'B'."),
  studentName: z.string().optional(),
  enrollmentNo: z.string().optional(),
  rollNo: z.string().optional(),
  mobileNo: z.string().optional(),
  gender: z.string().optional().describe("'male' or 'female' when the user asks for one."),
  groupBy: z
    .enum(["standard", "division", "grade", "gender", "none"])
    .optional()
    .describe("Return counts grouped by this dimension in addition to the rows."),
});

export const teacherDirectoryInputSchema = z.object({
  teacherName: z.string().optional(),
  profileName: z.string().optional().describe("Filter by user profile, e.g. Class Teacher."),
});

export const subjectCatalogInputSchema = z.object({
  standard: z
    .string()
    .optional()
    .describe("Standard/class whose subjects are requested. Optional."),
  division: z.string().optional(),
  grade: z.string().optional(),
});

export const classTeachersInputSchema = z.object({
  // Optional at the schema level so a missing class produces a conversational
  // follow-up question instead of a validation error.
  standard: z
    .string()
    .optional()
    .describe("Standard/class whose assigned teachers are requested."),
  division: z.string().optional(),
});

export const courseCatalogInputSchema = z.object({
  standard: z.string().optional(),
  grade: z.string().optional(),
});

export const attendanceOverviewInputSchema = z.object({
  date: z
    .string()
    .optional()
    .describe("Attendance date in YYYY-MM-DD. Defaults to today."),
  standard: z.string().optional(),
  division: z.string().optional(),
  taken: z
    .enum(["yes", "no"])
    .optional()
    .describe("Restrict to classes that have or have not submitted attendance."),
});

export const studentAttendanceDetailInputSchema = z.object({
  studentName: z.string().optional(),
  studentId: z.string().optional(),
  enrollmentNo: z.string().optional(),
  standard: z.string().optional(),
  division: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});

export const departmentInsightInputSchema = z.object({
  departmentName: z
    .string()
    .optional()
    .describe(
      "The department to explain. Leave empty to use the department the conversation is already about."
    ),
});

export const departmentDirectoryInputSchema = z.object({
  departmentName: z.string().optional(),
  includeEmployees: z.boolean().optional(),
});

export const feesSummaryInputSchema = z.object({
  grade: z.string().optional(),
  standard: z.string().optional(),
  division: z.string().optional(),
  monthId: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});

export const lmsAnalysisInputSchema = z.object({
  question: z
    .string()
    .describe("The user's analytical question, repeated verbatim."),
  datasets: z
    .array(
      z.enum([
        "students",
        "teachers",
        "classes",
        "attendance",
        "fees_pending",
        "fees_summary",
        "departments",
        "homework",
        "admissions",
      ])
    )
    .min(1)
    .describe("Which real LMS datasets must be loaded before reasoning."),
  standard: z.string().optional(),
  division: z.string().optional(),
  grade: z.string().optional(),
  date: z.string().optional(),
  compareStandards: z
    .array(z.string())
    .optional()
    .describe("Two or more standards to compare against each other."),
});

export const moduleActionInputSchema = z.object({
  module: z.string().optional(),
  action: z.string().optional(),
  searchText: z.string().optional(),
  recordId: z.string().optional(),
  grade: z.string().optional(),
  standard: z.string().optional(),
  division: z.string().optional(),
  subject: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  enrollmentNo: z.string().optional(),
  rollNo: z.string().optional(),
  mobileNo: z.string().optional(),
  status: z.string().optional(),
  term: z.string().optional(),
  examType: z.string().optional(),
});

/**
 * Templates the assistant may use, read from the existing document template
 * library's `ai` category. There is no separate AI template store: these are the
 * same records the designer at /document-templates creates and versions.
 */
export const aiTemplateListInputSchema = z.object({
  search: z
    .string()
    .optional()
    .describe("Optional text to match against the template name or description."),
});

export const aiTemplateInputSchema = z.object({
  templateId: z
    .number()
    .optional()
    .describe("The template's id, when it is already known."),
  name: z
    .string()
    .optional()
    .describe("The template's title, when the user referred to it by name."),
  enquiryId: z
    .number()
    .optional()
    .describe(
      "The admission enquiry to fill the template with. Without it the assistant can only list what is available."
    ),
});
