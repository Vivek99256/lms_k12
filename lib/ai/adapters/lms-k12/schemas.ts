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
