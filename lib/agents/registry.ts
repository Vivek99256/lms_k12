import type { AgentModuleKey } from './types';

/**
 * Module and tool catalogues.
 *
 * MODULE SCOPING LIVES HERE, NOT IN THE UI. Create Agent shows only the tools
 * whose `module` is the selected one (or `shared`), and the server re-checks the
 * same list on create — so a request that names a Fees tool for a G2G agent is
 * refused whichever way it arrives.
 *
 * RBAC KEY PER MODULE. Rights are asked of Laravel as `agents.<module>` through
 * the same /api/permissions endpoint the content screens use. The key must be
 * registered in the backend's config/rbac_modules.php; an unregistered key comes
 * back deny-all, which is the correct failure — configuration never grants.
 *
 * `available: false` marks a tool that exists in the catalogue so it can be
 * planned for, but has no executor yet. It is shown disabled and cannot be put on
 * an allow-list, so no run can ever fail on "not wired".
 */

export interface AgentModule {
  key: AgentModuleKey;
  label: string;
  description: string;
}

export type ToolRisk = 'read' | 'draft' | 'write';
export type ToolKind = 'local' | 'mcp' | 'intelligence';

export interface AgentTool {
  key: string;
  label: string;
  description: string;
  /** Owning module, or `shared` for tools every module may use. */
  module: AgentModuleKey | 'shared';
  /** read = looks at data · draft = produces text, changes nothing · write = changes records. */
  risk: ToolRisk;
  /** local = runs in this engine · mcp = governed MCP tool · intelligence = backend domain agent. */
  kind: ToolKind;
  /** False until an executor exists. Never selectable. */
  available: boolean;
  /** Example arguments, pre-filled in the Run dialog so the operator sees the shape. */
  exampleInput: Record<string, unknown>;
}

export const SHARED_MODULE = 'shared';

export const AGENT_MODULES: AgentModule[] = [
  { key: 'fees', label: 'Fees', description: 'Fee structures, collection, dues and reminders.' },
  {
    key: 'attendance',
    label: 'Attendance',
    description: 'Daily registers, absence, and following up students who are missing school.',
  },
  { key: 'g2g', label: 'G2G', description: 'Good-to-great learning and growth workflows.' },
  { key: 'admissions', label: 'Admissions', description: 'Enquiries, registrations and confirmations.' },
  { key: 'students', label: 'Students', description: 'Student records and profiles.' },
  { key: 'lms', label: 'LMS', description: 'Courses, content and assessments.' },
  { key: 'hrit', label: 'HR', description: 'Staff, leave and payroll.' },
  /*
  | The five modules whose AI Stacks were added in 2026-09.
  |
  | Each key is the `ai_modules` key, not the level-2 menu slug, because `rbacModuleKey()`
  | builds `agents.<key>` from it and `config/rbac_modules.php` registers those exact
  | strings. `student_request` is singular and underscored for that reason; the separate
  | `students` module a few lines up is a different module and is untouched.
  */
  { key: 'exam', label: 'Exam', description: 'Exams, marks and recorded results.' },
  { key: 'ptm', label: 'PTM', description: 'Parent-teacher meeting slots, bookings and attendance.' },
  { key: 'hostel', label: 'Hostel', description: 'Hostels, rooms, allocation and occupancy.' },
  {
    key: 'student_request',
    label: 'Student requests',
    description: 'Change requests raised against a student record, and their approvals.',
  },
  { key: 'circular', label: 'Circular', description: 'Circulars published to classes.' },
  /*
  | The six modules whose AI Stacks were added in 2026-09-23.
  |
  | `easy_com` and not `communication`: the key is the `ai_modules` key, because
  | `rbacModuleKey()` builds `agents.<key>` from it and `config/rbac_modules.php` registers
  | that exact string. The level-2 menu slug is `communication` and is used only in a route.
  */
  { key: 'mobile_apps', label: 'Users Mobile Apps', description: 'The parent, student and teacher apps.' },
  {
    key: 'student_icard',
    label: 'Student I-Card',
    description: 'Identity cards: who can be printed for, and what a card carries.',
  },
  { key: 'certificate', label: 'Certificate', description: 'Certificates issued and the layouts behind them.' },
  { key: 'easy_com', label: 'Communication', description: 'SMS, WhatsApp and app notifications sent.' },
  { key: 'timetable', label: 'Time Table', description: 'The published class timetable and its clashes.' },
  {
    key: 'student_medical',
    label: 'Student Medical',
    description: 'Infirmary visits, vaccinations, growth and health notes.',
  },
  /*
  | The six modules whose AI Stacks were added in 2026-09-24.
  |
  | `inward_outward` and `transportation` are spelled for the `ai_modules` keys those two
  | modules have had since the workspace was seeded, not for their menu slugs `inward-outward`
  | and `transport`. Same rule as `easy_com` above: `rbacModuleKey()` builds `agents.<key>`
  | from this string and `config/rbac_modules.php` registers those exact spellings, so a
  | key written for the slug would ask for a right nobody holds.
  |
  | `user_icard` is a different module from `student_icard` a few lines up. One reads the
  | staff record, one reads the student record, and neither can reach the other's tools.
  */
  { key: 'inward_outward', label: 'Inward', description: 'Documents received and entered in the inward register.' },
  {
    key: 'user_icard',
    label: 'User I-Card',
    description: 'Staff identity cards: who can be printed for, and what a card carries.',
  },
  { key: 'petty_cash', label: 'Petty Cash', description: 'Petty cash spends, their heads and their totals.' },
  { key: 'consent', label: 'Consent', description: 'Consents raised for students, and whether anybody has answered.' },
  {
    key: 'visitor_management',
    label: 'Visitor Management',
    description: 'Visits to the school and the times recorded at the gate.',
  },
  {
    key: 'transportation',
    label: 'Transport',
    description: 'Routes, stops, vehicles and the students assigned to them.',
  },
  /*
  | The six modules whose AI Stacks were added in 2026-09-25.
  |
  | Four of these keys predate the AI Stack work and two of them carry a HYPHEN, which is
  | unusual here and is not a typo. `rbacModuleKey()` builds `agents.<key>` verbatim and
  | `config/rbac_modules.php` registers `agents.document-templates` and
  | `agents.migration-modules` with those exact spellings.
  |
  | `migration-modules` is the UTILITY module. In this ERP, Utility is bulk data
  | operations — rollover, student transfer, custom modules — and not electricity or
  | water, none of which this estate records anywhere.
  */
  { key: 'inventory', label: 'Inventory', description: 'Items, requisitions and purchase orders.' },
  {
    key: 'front_desk',
    label: 'Front Desk',
    description: 'People coming in to meet staff about a student. Not the main visitor log.',
  },
  {
    key: 'task_management',
    label: 'Task Management',
    description: 'Tasks allocated to people, their dates and whether they are finished.',
  },
  { key: 'complaint', label: 'Complaint', description: 'Complaints raised, and whether they are closed.' },
  {
    key: 'migration-modules',
    label: 'Utility',
    description: 'Bulk data operations: rollover, student transfer and custom modules.',
  },
  {
    key: 'document-templates',
    label: 'Document Templates',
    description: 'Templates a document can be generated from, and their revisions.',
  },
  /*
  | The six modules whose AI Stacks were added in 2026-09-26, completing the ERP menu.
  |
  | Five of these keys predate the AI Stack work — `user`, `sqaa`, `library`, `lms` and
  | `institute` have had `ai_modules` rows since the workspace was seeded and were simply
  | never given a stack. `parent_communication` is new.
  |
  | `user` is a DIFFERENT module from `user_icard` above: one reads the account fields of
  | `tbluser`, the other the card fields of the same table, and neither reaches the payroll
  | columns beside them.
  */
  {
    key: 'parent_communication',
    label: 'Parent Communication',
    description: 'Messages parents wrote to the school. The inbound direction, not easy_com.',
  },
  { key: 'sqaa', label: 'Quality assurance', description: 'SQAA criteria and the evidence against them.' },
  { key: 'user', label: 'Users', description: 'Who has an ERP account, and what state it is in.' },
  { key: 'library', label: 'Library', description: 'The catalogue, the copies held and the loans out.' },
  // `lms` is NOT repeated here. It has been in this list since the beginning, a few dozen
  // lines up — adding it again gave the array two entries with the same key, which
  // `registry.test.ts` catches by comparing the set size to the length. `findModule()`
  // would have returned the first and the second would have been dead, exactly the way a
  // duplicate key in `config/ai.php` silently kept the wrong block.
  { key: 'institute', label: 'Institute', description: 'The academic structure of the school.' },
  /*
  | The six modules under the LMS + PAL menu group, whose AI Stacks were added together.
  |
  | `teach_learn` reads the SAME course/chapter/activity records as `lms` above — it is a
  | teacher-facing presentation layer over the existing LMS catalogue, not a second copy of
  | it, so its tool keys below wrap the same backend `lms.courses`/`lms.activities` MCP
  | tools `lms` already uses. That is deliberate reuse, not a leak: the two modules' pages
  | are different, the records behind them are not.
  |
  | `exam_assessment` is NOT a key here. The existing `exam` module above already covers
  | Exam & Assessment; adding a second key for the same records is exactly the duplication
  | this registry's own comments warn against.
  |
  | `curriculum_planning` promotes what was a tab inside `lms` (`/lms/curriculum-planning`)
  | to its own module key, at the school's request — its pages stay at the same URL.
  |
  | `engagement` and `interactions` had no base module at all before this batch — no table,
  | no route, no records. `engagement` is grounded in real attendance/homework/assignment
  | completion, computed live rather than stored. `interactions` is grounded in a new,
  | genuinely empty-until-used touchpoint log (`interaction_logs`), because nothing like it
  | existed to reuse.
  */
  {
    key: 'teach_learn',
    label: 'Teach/Learn',
    description: 'Courses, chapters and learning activities, as teachers and learners see them.',
  },
  {
    key: 'curriculum_planning',
    label: 'Curriculum Planning',
    description: 'Curriculum, units, chapters and learning outcomes, and their coverage.',
  },
  {
    key: 'engagement',
    label: 'Engagement',
    description: 'Student engagement, computed from attendance, homework and assignment activity.',
  },
  {
    key: 'interactions',
    label: 'Interactions',
    description: 'Logged touchpoints with students, parents and staff, and their follow-ups.',
  },
  {
    key: 'new_pal',
    label: 'New PAL',
    description: 'Personalised learning: content model, gamification and coherence mapping.',
  },
];

export const AGENT_TOOLS: AgentTool[] = [
  // ---- Fees ---------------------------------------------------------------
  {
    key: 'fees.draft_reminder',
    label: 'Draft a fee reminder',
    description: 'Writes a reminder message for one family from the details you give it. Sends nothing.',
    module: 'fees',
    risk: 'draft',
    kind: 'local',
    available: true,
    exampleInput: { student_name: 'Aarav Shah', class_name: 'Grade 6-B', amount: 12500, due_date: '2026-07-15', tone: 'gentle' },
  },
  {
    key: 'fees.list_defaulters',
    label: 'List fee defaulters',
    description:
      'Reads the live fee records and reports who owes anything, with how many students it checked. Changes nothing.',
    module: 'fees',
    risk: 'read',
    kind: 'mcp',
    available: true,
    // The arguments `fees.arrears` accepts. All optional — an empty run sweeps the
    // default cohort, which is the safe default for a read.
    exampleInput: { standard_id: null, section_id: null, min_amount: null, limit: 25 },
  },
  {
    key: 'fees.collection_report',
    label: 'Read the fee collection report',
    description: 'Reads what was actually collected over a date range, from the receipts. Changes nothing.',
    module: 'fees',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { from_date: '', to_date: '', payment_mode: '', limit: 25 },
  },
  {
    key: 'fees.fee_structure',
    label: 'Read a fee structure',
    description: 'Reads the fee heads and amounts for a class and term.',
    module: 'fees',
    risk: 'read',
    kind: 'mcp',
    available: false,
    exampleInput: { class_id: 12, term_id: 2 },
  },
  // ---- Attendance ---------------------------------------------------------
  //
  // Both reads are backed by MCP tools annotated `read_only` on the backend, so
  // neither can mark a register. The drafter writes text and sends nothing — a
  // message to a family about their child's absence is never dispatched by an
  // agent.
  {
    key: 'attendance.low_attendance',
    label: 'List students with low attendance',
    description:
      'Reads the marked register and reports who is attending least, with how many students it could judge. Changes nothing.',
    module: 'attendance',
    risk: 'read',
    kind: 'mcp',
    available: true,
    // The arguments `attendance.overview` accepts. All optional — an empty run
    // sweeps the default cohort over the last 30 days, which is the safe default
    // for a read.
    exampleInput: { standard_id: null, division_id: null, days: 30, limit: 25 },
  },
  {
    key: 'attendance.student_record',
    label: "Read one student's attendance",
    description:
      'Reads one student\'s present and absent day counts and the dates they were recorded absent. Changes nothing.',
    module: 'attendance',
    risk: 'read',
    kind: 'mcp',
    available: true,
    // `student_id` is required by the tool; the dialog pre-fills the shape, not a
    // real child — the operator names the student they are looking at.
    exampleInput: { student_id: null, days: 30 },
  },
  {
    key: 'attendance.draft_parent_note',
    label: 'Draft an attendance note to a parent',
    description:
      'Writes a short note to one family about their child\'s attendance, from the figures you give it. Sends nothing.',
    module: 'attendance',
    risk: 'draft',
    kind: 'local',
    available: true,
    exampleInput: {
      student_name: '',
      class_name: '',
      present_days: 0,
      absent_days: 0,
      window_days: 30,
      tone: 'gentle',
    },
  },

  // ---- G2G ----------------------------------------------------------------
  {
    key: 'g2g.draft_growth_note',
    label: 'Draft a growth note',
    description: 'Writes a short growth note for a learner from the observations you give it.',
    module: 'g2g',
    risk: 'draft',
    kind: 'local',
    available: true,
    exampleInput: { learner_name: 'Diya Patel', strengths: ['curiosity'], next_step: 'reads one chapter a day' },
  },
  {
    key: 'g2g.progress_snapshot',
    label: 'Read a progress snapshot',
    description: "Reads a learner's latest G2G progress figures.",
    module: 'g2g',
    risk: 'read',
    kind: 'mcp',
    available: false,
    exampleInput: { learner_id: 4021 },
  },
  // ---- Admissions ---------------------------------------------------------
  //
  // The three reads are backed by MCP tools annotated `read_only` on the backend,
  // so none of them can edit an enquiry or confirm an admission. `admissions.confirm`
  // and `admissions.updateEnquiry` are real tools in that registry and they write;
  // neither appears here, so no agent allow-list can reach them.
  {
    key: 'admissions.enquiry_followup',
    label: 'Draft an enquiry follow-up',
    description: 'Writes a follow-up message to a family that enquired and has not registered.',
    module: 'admissions',
    risk: 'draft',
    kind: 'local',
    available: true,
    exampleInput: { parent_name: 'Mrs Rao', child_name: 'Kabir', grade_applied: 'Grade 1', enquiry_date: '2026-06-02' },
  },
  {
    key: 'admissions.list_enquiries',
    label: 'List admission enquiries',
    description:
      'Reads the live admission enquiries for this institute and academic year, with the status and follow-up date each record carries. Changes nothing.',
    module: 'admissions',
    risk: 'read',
    kind: 'mcp',
    available: true,
    // The arguments `admissions.listEnquiries` accepts. All optional — an empty run
    // sweeps the open pipeline, which is the safe default for a read.
    exampleInput: { search_text: '', only_pending: true, limit: 25 },
  },
  {
    key: 'admissions.todays_registrations',
    label: "Read a day's admission registrations",
    description:
      'Reads the admission registrations recorded on one date, with the payment mode and amount on each. Changes nothing.',
    module: 'admissions',
    risk: 'read',
    kind: 'mcp',
    available: true,
    // `date` defaults to today on the backend; the dialog shows the shape rather than
    // pinning a date somebody would have to clear.
    exampleInput: { date: '', admission_status: '', limit: 25 },
  },
  {
    key: 'admissions.enquiry_details',
    label: 'Read one admission enquiry',
    description:
      'Reads one enquiry in full, with the registration details and what the confirmation check says is still missing. Changes nothing.',
    module: 'admissions',
    risk: 'read',
    kind: 'mcp',
    available: true,
    // `enquiry_id` is required by the tool; the dialog pre-fills the shape, not a real
    // family — the operator names the enquiry they are looking at.
    exampleInput: { enquiry_id: null },
  },
  // ---- Students -----------------------------------------------------------
  //
  // Reads first, then the drafter. Every read is an MCP tool annotated `read_only`,
  // so none of them can change a student record; the drafter writes text and sends
  // nothing.
  {
    key: 'students.directory',
    label: 'List students in a class',
    description:
      'Reads the students enrolled in a grade, standard or division this academic year, and reports the whole cohort size beside the rows it returns. Changes nothing.',
    module: 'students',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { grade_id: null, standard_id: null, division_id: null, active_only: true, limit: 50 },
  },
  {
    key: 'students.find',
    label: 'Find a student',
    description:
      'Searches students by name, admission id, enrolment number, mobile or email within this institute. Changes nothing.',
    module: 'students',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { query: '', student_id: null, active_only: true, limit: 20 },
  },
  {
    key: 'students.enrolment_history',
    label: "Read one student's enrolment history",
    description:
      'Reads which class a student was in each academic year, how long they have been at the school, and whether a year appears twice. Changes nothing.',
    module: 'students',
    risk: 'read',
    kind: 'mcp',
    available: true,
    // `student_id` is required by the tool; the dialog pre-fills the shape, not a real
    // child — the operator names the student they are looking at.
    exampleInput: { student_id: null },
  },
  {
    key: 'students.draft_record_request',
    label: 'Draft a record request to a parent',
    description:
      "Writes a short message asking one family for a detail the student record is missing, from the fields you give it. Sends nothing.",
    module: 'students',
    risk: 'draft',
    kind: 'local',
    available: true,
    exampleInput: {
      student_name: '',
      class_name: '',
      missing_fields: [],
      purpose: '',
      return_instructions: '',
    },
  },
  {
    key: 'students.risk_scan',
    label: 'Run the student risk scan',
    description: 'Runs the backend student-risk detector over a cohort.',
    module: 'students',
    risk: 'read',
    kind: 'intelligence',
    available: false,
    exampleInput: { limit: 50 },
  },
  // ---- Exam ---------------------------------------------------------------
  //
  // Two reads and one drafter. Both reads are MCP tools annotated `read_only` on the
  // backend, so neither can change a mark; the drafter writes text and sends nothing.
  // There is no write tool in this family at all — entering and correcting marks stays on
  // the Mark Entry screen, where a teacher does it as themselves.
  {
    key: 'exam.list',
    label: 'List the exams defined',
    description:
      'Reads the exams set up for this institute, with their titles, terms and weightings. Use it to resolve an exam named in a question into the id a results read needs. Changes nothing.',
    module: 'exam',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { standard_id: null, limit: 50 },
  },
  {
    key: 'exam.results',
    label: 'Read recorded exam marks',
    description:
      'Reads the marks recorded for this institute, filtered by student, exam, subject or class. Absences carry no score and are counted separately rather than averaged in as zeros. Changes nothing.',
    module: 'exam',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { student_id: null, exam_id: null, subject_name: '', standard_name: '', limit: 100 },
  },
  {
    key: 'exam.draft_result_note',
    label: 'Draft a result note to a family',
    description:
      'Writes a short note telling one family what an exam record says, from the figures you give it. States the marks and nothing about the child. Sends nothing.',
    module: 'exam',
    risk: 'draft',
    kind: 'local',
    available: true,
    exampleInput: {
      student_name: '',
      class_name: '',
      exam_title: '',
      subject_name: '',
      marks: '',
      percentage: '',
      grade: '',
      absent: false,
    },
  },

  // ---- PTM ----------------------------------------------------------------
  //
  // Reads first, then the drafter. `ptm.bookings` reports a booking with no attendance
  // saved as "not recorded" rather than as an absence, and the agent passes that straight
  // through — which is the whole reason this module's read is a governed tool rather than
  // a query somebody writes in a prompt.
  {
    key: 'ptm.meetings',
    label: 'List parent-teacher meetings',
    description:
      'Reads the PTM slots scheduled for this institute and academic year, with the class each was opened for and how many families booked, attended or have no attendance recorded. Changes nothing.',
    module: 'ptm',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { standard_id: null, division_id: null, from_date: '', to_date: '', limit: 50 },
  },
  {
    key: 'ptm.bookings',
    label: 'Read PTM bookings and attendance',
    description:
      'Reads individual PTM bookings: the student and family, the slot, the confirmation given and the attendance a teacher recorded. Changes nothing.',
    module: 'ptm',
    risk: 'read',
    kind: 'mcp',
    available: true,
    // `attended` accepts Yes, No or not_recorded. Blank here so an empty run reports all
    // three rather than pinning one the operator would have to clear.
    exampleInput: { slot_id: null, student_id: null, attended: '', limit: 50 },
  },
  {
    key: 'ptm.draft_invitation',
    label: 'Draft a PTM invitation',
    description:
      'Writes a short invitation to one family for a parent-teacher meeting, from the slot details you give it. Sends nothing and books nothing.',
    module: 'ptm',
    risk: 'draft',
    kind: 'local',
    available: true,
    exampleInput: {
      parent_name: '',
      student_name: '',
      class_name: '',
      meeting_title: '',
      meeting_date: '',
      from_time: '',
      to_time: '',
      venue: '',
    },
  },

  // ---- Hostel -------------------------------------------------------------
  //
  // Three reads and nothing else. Allocating a room is a decision with a bed behind it and
  // it stays on the Hostel Room Allocation screen; no drafter is offered either, because
  // there is no hostel message this module's records support writing without a person
  // deciding something first.
  {
    key: 'hostel.occupancy',
    label: 'Read hostel occupancy',
    description:
      'Reads the hostels this institute runs, with the warden on each, how many rooms it has and how many are occupied this year. Rooms carry no recorded bed capacity, so no percentage of capacity is reported. Changes nothing.',
    module: 'hostel',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { hostel_id: null, hostel_name: '', limit: 50 },
  },
  {
    key: 'hostel.allocations',
    label: 'Read hostel room allocations',
    description:
      'Reads who is allocated to which hostel room this academic year, with the bed, locker and admission category recorded. Occupants may be students or staff and each row says which. Changes nothing.',
    module: 'hostel',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { hostel_id: null, room_id: null, student_id: null, limit: 50 },
  },
  {
    key: 'hostel.available_rooms',
    label: 'Read unallocated hostel rooms',
    description:
      'Reads the rooms with no allocation for this institute in this academic year, with their floor, building and hostel. A partly filled room is not listed, because rooms carry no recorded bed capacity. Changes nothing.',
    module: 'hostel',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { hostel_id: null, limit: 50 },
  },

  // ---- Student requests ---------------------------------------------------
  //
  // Two reads and an acknowledgement drafter. Nothing here approves or rejects a request:
  // `student_requests.list` and `.details` are annotated `read_only` on the backend and
  // there is no write tool in this family, so a decision stays a person's act on the
  // Student Request screen however a question is worded.
  {
    key: 'student_request.list',
    label: 'List student change requests',
    description:
      'Reads the change requests raised against student records this academic year, with the type, reason, status and class each carries. Reports the whole queue size and a breakdown by status beside the rows. Changes nothing.',
    module: 'student_request',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { status: '', only_pending: true, standard_id: null, search_text: '', limit: 50 },
  },
  {
    key: 'student_request.details',
    label: 'Read one student request',
    description:
      'Reads one change request in full, with the reason given, whether its type requires a proof document and whether one was supplied, and who decided it. Changes nothing.',
    module: 'student_request',
    risk: 'read',
    kind: 'mcp',
    available: true,
    // `request_id` is required by the tool; the dialog pre-fills the shape, not a real
    // family — the operator names the request they are looking at.
    exampleInput: { request_id: null },
  },
  {
    key: 'student_request.draft_acknowledgement',
    label: 'Draft a request acknowledgement',
    description:
      "Writes a short note confirming a family's request was received and naming anything still needed before it can be considered. States no decision. Sends nothing.",
    module: 'student_request',
    risk: 'draft',
    kind: 'local',
    available: true,
    exampleInput: {
      parent_name: '',
      student_name: '',
      class_name: '',
      request_title: '',
      raised_on: '',
      outstanding_documents: [],
    },
  },

  // ---- Circular -----------------------------------------------------------
  //
  // One read and one drafter. The drafter writes the text of a circular and publishes
  // nothing: publishing is what sends a notice to every family in a class, and it stays on
  // the Circular screen where a person presses the button.
  {
    key: 'circular.list',
    label: 'List published circulars',
    description:
      'Reads the circulars published this academic year, with the title, type, date and class each was addressed to. One row is one circular to one class, so both the row count and the count of distinct circulars are reported. Changes nothing.',
    module: 'circular',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { standard_id: null, type_id: null, from_date: '', to_date: '', search_text: '', limit: 50 },
  },
  {
    key: 'circular.draft',
    label: 'Draft a circular',
    description:
      'Turns a subject and a few points into the body of a circular a person can review and publish. Publishes nothing and sends nothing.',
    module: 'circular',
    risk: 'draft',
    kind: 'local',
    available: true,
    exampleInput: {
      title: '',
      audience: '',
      points: [],
      effective_date: '',
      action_required: '',
      contact: '',
    },
  },

  // ---- Users Mobile Apps --------------------------------------------------
  //
  // Two reads and nothing else. The tables hold the app's configured navigation, and a
  // drafter would have nothing to write: there is no app message, no push composer and no
  // recipient here. Sending a notification is the Communication module's job.
  {
    key: 'mobile_apps.homescreen',
    label: 'Read the mobile app home screen',
    description:
      'Reads the tiles configured on a mobile app home screen for this institute, per user profile, with the screen each opens and whether it is switched on. Configuration, not usage. Changes nothing.',
    module: 'mobile_apps',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { app: 'parent', user_profile_name: '', section: '', status: '', limit: 50 },
  },
  {
    key: 'mobile_apps.sections',
    label: 'Read the mobile app sections',
    description:
      'Reads the sections each mobile app is built from, with how many tiles sit under each and how many are on. Reported per app, because the parent and teacher apps are configured separately. Changes nothing.',
    module: 'mobile_apps',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { limit: 100 },
  },

  // ---- Student I-Card -----------------------------------------------------
  //
  // Two reads over the card's own fields. No student directory tool is offered to this
  // module at all — see the module block in `config/ai.php` for why that absence is the
  // boundary rather than an omission.
  {
    key: 'student_icard.roster',
    label: 'Read the I-card print list',
    description:
      'Reads the students a card can be printed for in a class, with only the fields a card prints, and reports which cards are missing a photo, roll number or class. Changes nothing.',
    module: 'student_icard',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { grade_id: null, standard_id: null, division_id: null, with_transport: false, limit: 50 },
  },
  {
    key: 'student_icard.card_details',
    label: "Read one student's card fields",
    description:
      'Reads the identity-card fields for one student and which of them are missing. No card number or issue date is reported, because this estate records none. Changes nothing.',
    module: 'student_icard',
    risk: 'read',
    kind: 'mcp',
    available: true,
    // `student_id` is required by the tool; the dialog pre-fills the shape, not a real
    // child — the operator names the student they are looking at.
    exampleInput: { student_id: null },
  },

  // ---- Certificate --------------------------------------------------------
  //
  // Two reads. Issuing a certificate is a write with a numbered, printed document behind
  // it and it stays on the Certificate screen; no write tool exists here to select.
  {
    key: 'certificate.issued',
    label: 'Read issued certificates',
    description:
      'Reads the certificates issued this academic year with the type, number, student and date, and a breakdown by type. The printed certificate text is deliberately not returned. Changes nothing.',
    module: 'certificate',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { certificate_type: '', student_id: null, from_date: '', to_date: '', limit: 50 },
  },
  {
    key: 'certificate.templates',
    label: 'Read the certificate layouts',
    description:
      'Reads the certificate layouts this institute can issue from, with the type each serves and whether it is active. Changes nothing.',
    module: 'certificate',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { certificate_type: '', only_active: true, limit: 100 },
  },

  // ---- Communication ------------------------------------------------------
  //
  // Two reads and a drafter. The drafter writes text and sends nothing: sending reaches
  // every family in a class, and it stays a person pressing the button on the send screen.
  {
    key: 'easy_com.messages',
    label: 'Read what the school has sent',
    description:
      'Reads messages sent across SMS to parents, SMS to staff, WhatsApp and app notifications, with a per-channel breakdown. Only WhatsApp records a delivery outcome; for the rest the send was logged, not confirmed. Changes nothing.',
    module: 'easy_com',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { channel: '', student_id: null, search_text: '', from_date: '', to_date: '', limit: 50 },
  },
  {
    key: 'easy_com.channels',
    label: 'Read the communication channels',
    description:
      'Reads every channel, whether its log exists on this estate, how much it holds, when it was last used and whether it records a delivery outcome at all. Changes nothing.',
    module: 'easy_com',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { from_date: '', to_date: '' },
  },
  {
    key: 'easy_com.draft_message',
    label: 'Draft a message to families',
    description:
      'Writes a short message to families from the points you give it, for a person to review before sending. Sends nothing and schedules nothing.',
    module: 'easy_com',
    risk: 'draft',
    kind: 'local',
    available: true,
    exampleInput: {
      audience: '',
      subject: '',
      points: [],
      action_required: '',
      contact: '',
      channel: 'sms',
    },
  },

  // ---- Time Table ---------------------------------------------------------
  //
  // Two reads. Changing a timetable moves a class, and nothing here does it.
  {
    key: 'timetable.schedule',
    label: 'Read the published timetable',
    description:
      'Reads the published timetable for this institute and year: one row per period of one class on one weekday, with the times, subject and teacher. Drafts are excluded. Changes nothing.',
    module: 'timetable',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { standard_id: null, division_id: null, teacher_id: null, week_day: '', limit: 50 },
  },
  {
    key: 'timetable.conflicts',
    label: 'Find timetable clashes',
    description:
      'Reads teachers booked into two or more different classes in the same period on the same weekday. The table records no room and no availability, so nothing else about a timetable is judged. Changes nothing.',
    module: 'timetable',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { teacher_id: null, week_day: '', limit: 50 },
  },

  // ---- Student Medical ----------------------------------------------------
  //
  // Four reads and NO DRAFTER, which is the one deliberate difference from every other
  // module in this catalogue. A drafter here would compose prose around a child's clinical
  // record — the exact act the module's policy and prompts forbid — so none is offered,
  // and an agent cannot be configured to do it because there is no tool to allow.
  //
  // Every read is annotated `read_only` on the backend and carries
  // `student_medical.read`, and none of these tools is bound to any other module.
  {
    key: 'student_medical.visits',
    label: 'Read infirmary visits',
    description:
      'Reads infirmary visits with the date, case number, doctor and whether the case is open. Clinical detail is returned only for a read naming one student. Nothing is interpreted. Changes nothing.',
    module: 'student_medical',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { student_id: null, from_date: '', to_date: '', open_only: true, limit: 50 },
  },
  {
    key: 'student_medical.vaccinations',
    label: 'Read recorded vaccinations',
    description:
      'Reads vaccinations recorded for students of this institute this year. A student with no row has none RECORDED, which is not the same as unvaccinated. Changes nothing.',
    module: 'student_medical',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { student_id: null, vaccination_type: '', limit: 50 },
  },
  {
    key: 'student_medical.growth',
    label: 'Read height and weight records',
    description:
      'Reads height and weight exactly as recorded. The columns carry no unit, so no index is calculated and no child is described as under or over any weight. Changes nothing.',
    module: 'student_medical',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { student_id: null, from_date: '', to_date: '', limit: 50 },
  },
  {
    key: 'student_medical.health_records',
    label: 'Read health notes',
    description:
      'Reads general health notes with the doctor and whether a document is attached. An attached medical document is reported as present and never returned. Changes nothing.',
    module: 'student_medical',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { student_id: null, limit: 50 },
  },

  // ---- Inward -------------------------------------------------------------
  //
  // Two reads. No drafter: the module's example policy leaves `use_ai_for_generating_answers`
  // off, and a "follow-up note" about a document whose status nobody records would be an
  // invention with a reference number attached.
  {
    key: 'inward.register',
    label: 'Read the inward register',
    description:
      'Reads documents received and entered in the inward register, with the place each came from, the file it was filed into and whether a scan is attached. This register records no status at all, so nothing it returns is pending or closed. Changes nothing.',
    module: 'inward_outward',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { place_id: null, file_location_id: null, from_date: '', to_date: '', search_text: '', limit: 50 },
  },
  {
    key: 'inward.unfiled',
    label: 'Find gaps in the inward register',
    description:
      'Reads inward records with no physical file location recorded, or no scan attached, oldest first. A gap is a gap in the register, not a document awaiting action. Changes nothing.',
    module: 'inward_outward',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { gap: 'any', place_id: null, from_date: '', to_date: '', limit: 50 },
  },

  // ---- User I-Card --------------------------------------------------------
  //
  // Two reads over `tbluser`, which also holds payroll, bank and government identity
  // numbers. The service selects an explicit column list and neither tool can return
  // anything else — the restriction is in the query, not in an instruction.
  {
    key: 'user_icard.roster',
    label: 'Read the staff card print list',
    description:
      'Reads which staff a card can be printed for and which are missing a photograph, an employee number or a profile. Only the fields a card prints are returned — never salary, bank, PAN, Aadhaar or contract details. Changes nothing.',
    module: 'user_icard',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: {
      user_profile_id: null,
      department_id: null,
      missing_photo_only: false,
      account_expired_only: false,
      search_text: '',
      limit: 50,
    },
  },
  {
    key: 'user_icard.card_details',
    label: 'Read one member of staff’s card',
    description:
      'Reads the card fields for one member of staff of this institute. A staff id belonging to another institute returns not-found. Payroll and government identity numbers are not readable. Changes nothing.',
    module: 'user_icard',
    risk: 'read',
    kind: 'mcp',
    available: true,
    // `staff_id`, not `user_id`: the backend forbids the latter on any tool, because an
    // argument by that name reads as "act as this user" rather than "read this person's
    // card". See `UserIcardService`.
    exampleInput: { staff_id: null },
  },

  // ---- Petty Cash ---------------------------------------------------------
  //
  // Two reads and no drafter, deliberately. The module's example policy leaves
  // `use_ai_for_generating_answers` off: a composed answer about money, on a book with no
  // approval trail behind it, is the one output here worth refusing.
  {
    key: 'petty_cash.transactions',
    label: 'Read petty cash spends',
    description:
      'Reads petty cash spends with the head, amount, date, who entered them and whether a bill is on file. The total covers every matching transaction, not just the rows listed. No approval is recorded anywhere in this book. Changes nothing.',
    module: 'petty_cash',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: {
      title_id: null,
      from_date: '',
      to_date: '',
      min_amount: null,
      without_bill_only: false,
      limit: 50,
    },
  },
  {
    key: 'petty_cash.summary',
    label: 'Total petty cash by head and month',
    description:
      'Reads petty cash spending totalled by head and by month. The total is money recorded as going out — this book records no float or top-up, so it is not a balance. Changes nothing.',
    module: 'petty_cash',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { title_id: null, from_date: '', to_date: '', min_amount: null },
  },

  // ---- Consent ------------------------------------------------------------
  //
  // Two reads and one drafter. The drafter exists because a reminder to a family is this
  // module's real deliverable, and its example policy turns `use_ai_for_generating_answers`
  // on for exactly that. It composes text and sends nothing.
  {
    key: 'consent.records',
    label: 'Read consents',
    description:
      'Reads consents raised for students, with the class, date, accountability and decision state. An empty decision means nobody has answered — it is never a refusal. Changes nothing.',
    module: 'consent',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: {
      student_id: null,
      standard_id: null,
      division_id: null,
      decision: 'any',
      from_date: '',
      to_date: '',
      limit: 50,
    },
  },
  {
    key: 'consent.summary',
    label: 'Count consents by decision state',
    description:
      'Reads consents counted by decision state and by accountability. Consents nobody has answered are counted under their own name and never folded into a refusal. Changes nothing.',
    module: 'consent',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { standard_id: null, division_id: null, decision: 'any', from_date: '', to_date: '' },
  },
  {
    key: 'consent.draft_reminder',
    label: 'Draft a consent reminder',
    description:
      'Writes a short reminder asking a family to answer a consent, for a person to review before sending. It cannot say the family refused, because not answering is not refusing. Sends nothing and schedules nothing.',
    module: 'consent',
    risk: 'draft',
    kind: 'local',
    available: true,
    exampleInput: { consent_title: '', consent_date: '', class_name: '', respond_by: '', contact: '', channel: 'sms' },
  },

  // ---- Visitor Management -------------------------------------------------
  //
  // Two reads. No drafter and no write: the only decision at a gate is whether to let
  // somebody in, and nothing here goes near it.
  {
    key: 'visitor.visits',
    label: 'Read the visitor register',
    description:
      'Reads visits with the visitor, host, purpose, date and the entry and exit times recorded. A missing exit time means no exit was recorded, never that the person is still in the building. Changes nothing.',
    module: 'visitor_management',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { visitor_type_id: null, appointment_type: '', from_date: '', to_date: '', search_text: '', limit: 50 },
  },
  {
    key: 'visitor.without_exit',
    label: 'Find visits with no exit recorded',
    description:
      'Reads visits with an entry time and no exit time, oldest first, with how many are from a day already past. Deliberately not a list of who is on the premises — the register cannot tell. Changes nothing.',
    module: 'visitor_management',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { visitor_type_id: null, from_date: '', to_date: '', limit: 50 },
  },

  // ---- Transport ----------------------------------------------------------
  //
  // Three reads and one drafter. Nothing writes: changing a stop or a bus moves a child's
  // journey home.
  {
    key: 'transport.routes',
    label: 'Read transport routes',
    description:
      'Reads routes with their scheduled times, the stops they call at and the vehicles assigned to run them. The times are the schedule; nothing records what actually ran. Changes nothing.',
    module: 'transportation',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { route_id: null, search_text: '', limit: 50 },
  },
  {
    key: 'transport.vehicles',
    label: 'Read vehicles and seats against assignments',
    description:
      'Reads vehicles with seating capacity, driver, shift and routes, and how many students are assigned — counted separately for the morning and afternoon legs, which must never be added together. Changes nothing.',
    module: 'transportation',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { vehicle_id: null, search_text: '', limit: 50 },
  },
  {
    key: 'transport.assignments',
    label: 'Read student transport assignments',
    description:
      'Reads students assigned to transport with their bus and stop each way, the distance and the fee on the mapping. An assignment is a plan, not a journey — nothing records a boarding. Changes nothing.',
    module: 'transportation',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { student_id: null, vehicle_id: null, stop_id: null, search_text: '', limit: 50 },
  },
  {
    key: 'transportation.draft_notice',
    label: 'Draft a transport notice',
    description:
      'Writes a short notice about a route, stop or timing for a person to review before sending. States a scheduled time as scheduled, never as an arrival. Sends nothing and schedules nothing.',
    module: 'transportation',
    risk: 'draft',
    kind: 'local',
    available: true,
    exampleInput: { route_name: '', change: '', effective_from: '', stop_name: '', contact: '', channel: 'sms' },
  },

  // ---- Inventory ----------------------------------------------------------
  //
  // Three reads and no drafter. The module's example policy leaves
  // `use_ai_for_generating_answers` off: a composed answer about stock levels, on a figure
  // this schema cannot make accurate, is the one output here worth refusing.
  //
  // There is no vendor tool. A purchase order needs the vendor's name, which
  // `inventory.purchase_orders` already joins; a tool over the vendor table would put bank
  // accounts, PAN and registration numbers one question away.
  {
    key: 'inventory.items',
    label: 'Read the inventory item master',
    description:
      'Reads items with the stock figure RECORDED against each and its reorder level. This system never decreases that figure when stock is issued, so it overstates the shelf and nothing may be called in stock or out of stock. Changes nothing.',
    module: 'inventory',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { category_id: null, item_type_id: null, at_or_below_minimum_only: false, search_text: '', limit: 50 },
  },
  {
    key: 'inventory.requisitions',
    label: 'Read inventory requisitions',
    description:
      'Reads requisitions with the item, the quantity requested and approved, who raised it and who approved it. An approved requisition is a decision, not proof that anything was handed over. Changes nothing.',
    module: 'inventory',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { item_id: null, department_id: null, status: '', from_date: '', to_date: '', limit: 50 },
  },
  {
    key: 'inventory.purchase_orders',
    label: 'Read purchase orders',
    description:
      'Reads purchase order lines with the item, the vendor’s name, quantity, amount and approval status. An order is not a delivery. The vendor’s bank, PAN and registration details are not readable. Changes nothing.',
    module: 'inventory',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { item_id: null, vendor_id: null, po_number: '', limit: 50 },
  },

  // ---- Front Desk ---------------------------------------------------------
  //
  // One read, over a register holding a single row across the whole estate. The school's
  // actual visitor log belongs to Visitor Management and is a different module's tool.
  {
    key: 'front_desk.visits',
    label: 'Read the front desk register',
    description:
      'Reads people who came in to meet a member of staff about a student, with the times recorded. A non-admin sees only the visits they were the subject of. This is NOT the school’s whole visitor log, so an empty result never means nobody visited. Changes nothing.',
    module: 'front_desk',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { student_id: null, staff_id: null, visitor_type: '', from_date: '', to_date: '', limit: 50 },
  },

  // ---- Task Management ----------------------------------------------------
  //
  // Three reads. Nothing writes: reassigning a task or moving a deadline changes what
  // somebody is accountable for.
  {
    key: 'tasks.list',
    label: 'Read the task list',
    description:
      'Reads tasks with their dates, assignees and status. The status column holds two spellings of "complete", so every count is made on a normalised value and the raw spellings are reported beside it. Changes nothing.',
    module: 'task_management',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { state: 'any', assigned_to: null, allocated_by: null, from_date: '', to_date: '', limit: 50 },
  },
  {
    key: 'tasks.overdue',
    label: 'Find overdue tasks',
    description:
      'Reads tasks past their date that are not complete, oldest first, with how many have no assignee. A task with no date is undated rather than overdue and is excluded. Changes nothing.',
    module: 'task_management',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { assigned_to: null, task_type: '', limit: 50 },
  },
  {
    key: 'tasks.projects',
    label: 'Read task projects and workstreams',
    description:
      'Reads the project structure layered beside the task list. It holds single-digit row counts across the estate and maps only a handful of tasks, so it never accounts for the school’s work. Changes nothing.',
    module: 'task_management',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { project_id: null, limit: 50 },
  },

  // ---- Complaint ----------------------------------------------------------
  //
  // Two reads and no drafter. A reply to somebody's grievance is not a thing to compose
  // from a status word, which is the only outcome this table records.
  {
    key: 'complaints.list',
    label: 'Read complaints',
    description:
      'Reads complaints with the title, date, who raised it, the group it sits with and its status. The column named COMPLAINT_SOLUTION is the STATUS field — no resolution text exists — and there is no priority, due date, SLA or escalation. Changes nothing.',
    module: 'complaint',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { state: 'any', user_group_id: null, raised_by: null, from_date: '', to_date: '', limit: 50 },
  },
  {
    key: 'complaints.summary',
    label: 'Count complaints by status and group',
    description:
      'Reads complaints counted by status and by the group they were assigned to. Groups are reported as ids because this table records no department name. Changes nothing.',
    module: 'complaint',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { user_group_id: null, from_date: '', to_date: '' },
  },

  // ---- Utility ------------------------------------------------------------
  //
  // Two reads, and note the module key: `migration-modules`. In this ERP, Utility is bulk
  // data operations and NOT electricity, water or bills — this estate records none of
  // those anywhere. Nothing writes, because the operations rewrite a year of records for
  // a whole school.
  {
    key: 'utility.custom_modules',
    label: 'Read custom module definitions',
    description:
      'Reads tables somebody defined from the custom-module screen, with the columns on each. These are definitions, not data. The Utility module here is bulk data operations, not utility bills. Changes nothing.',
    module: 'migration-modules',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { module_type: '', search_text: '', limit: 50 },
  },
  {
    key: 'utility.rollover_scope',
    label: 'Read what a rollover would act on',
    description:
      'Reads the academic years with enrolments recorded and the institutes of the same client a transfer could target. No operation history is recorded anywhere, so nothing says what has been run. Changes nothing.',
    module: 'migration-modules',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: {},
  },

  // ---- Document Templates -------------------------------------------------
  //
  // Two reads and one drafter. The drafter exists because composing template content for
  // review is this module's actual job, and its example policy turns
  // `use_ai_for_generating_answers` on for exactly that. It writes text and saves nothing.
  {
    key: 'doc_templates.list',
    label: 'Read document templates',
    description:
      'Reads templates with their status, version and the merge fields parsed from their content. The document body is measured but never returned. These tables are empty across the estate, and an empty result means exactly that. Changes nothing.',
    module: 'document-templates',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { status: '', category: '', search_text: '', limit: 50 },
  },
  {
    key: 'doc_templates.versions',
    label: 'Read a template’s revisions',
    description:
      'Reads the saved revisions of one template, with who saved each. A version is a save, not an approval. A template id belonging to another institute returns not-found. Changes nothing.',
    module: 'document-templates',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { template_id: null, limit: 20 },
  },
  {
    key: 'document-templates.draft_content',
    label: 'Draft document template content',
    description:
      'Writes a draft template body from the sections and merge fields you give it, for a person to review before it is saved. It invents no merge field and saves, publishes and sends nothing.',
    module: 'document-templates',
    risk: 'draft',
    kind: 'local',
    available: true,
    exampleInput: { template_name: '', purpose: '', sections: [], merge_fields: [], closing: '' },
  },

  // ---- Parent Communication -----------------------------------------------
  //
  // Two reads and one drafter. The drafter exists because a reply to a parent is this
  // module's real deliverable, and its example policy turns
  // `use_ai_for_generating_answers` on for exactly that. It composes text and sends
  // nothing.
  {
    key: 'parent_communication.messages',
    label: 'Read messages from parents',
    description:
      'Reads messages PARENTS wrote to the school, with the student each concerns and whether a reply is recorded. The message body comes back only for a read naming one student or one message. This is the inbound direction, not the Communication module. Changes nothing.',
    module: 'parent_communication',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { student_id: null, state: 'any', from_date: '', to_date: '', limit: 50 },
  },
  {
    key: 'parent_communication.summary',
    label: 'Count parent messages by month',
    description:
      'Reads messages from parents counted by month and by whether a reply is recorded, with the oldest unanswered date. Returns no message body at all. Changes nothing.',
    module: 'parent_communication',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { from_date: '', to_date: '' },
  },
  {
    key: 'parent_communication.draft_reply',
    label: 'Draft a reply to a parent',
    description:
      'Writes a short reply to one parent message, for a person to review before sending. It promises nothing the school has not decided and states no date or outcome it was not given. Sends nothing.',
    module: 'parent_communication',
    risk: 'draft',
    kind: 'local',
    available: true,
    exampleInput: { subject: '', acknowledge: '', points: [], next_step: '', contact: '' },
  },

  // ---- Quality assurance (SQAA) -------------------------------------------
  //
  // Two reads and nothing else. No drafter: composing prose about how ready a school is
  // for accreditation is precisely what this module must not do.
  {
    key: 'sqaa.criteria',
    label: 'Read the quality assurance criteria',
    description:
      'Reads the SQAA criteria tree by level. No rubric, weighting or grade boundary is recorded anywhere, so nothing here scores or ranks anything. Changes nothing.',
    module: 'sqaa',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { level: null, parent_id: null, limit: 50 },
  },
  {
    key: 'sqaa.evidence',
    label: 'Read quality assurance evidence',
    description:
      'Reads the evidence uploaded against the document slots, with whether it was marked available and whether a file is actually attached. The number of slots defined is always returned beside it. Changes nothing.',
    module: 'sqaa',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { menu_id: null, search_text: '', limit: 50 },
  },

  // ---- Users --------------------------------------------------------------
  //
  // One read, over the account fields of `tbluser`. `user_icard.*` reads the card fields
  // of the same table and is a different module; neither reaches the payroll columns.
  {
    key: 'user_accounts.directory',
    label: 'Read the ERP account register',
    description:
      'Reads who has an account, their profile, status, administrator and portal flags, and the last login. Payroll, bank, PAN and Aadhaar are not readable. The last login is the only activity recorded, so nothing describes how much anybody uses the system. Changes nothing.',
    module: 'user',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: {
      user_profile_id: null,
      include_inactive: false,
      never_logged_in_only: false,
      administrators_only: false,
      limit: 50,
    },
  },

  // ---- Library ------------------------------------------------------------
  {
    key: 'library.catalogue',
    label: 'Read the library catalogue',
    description:
      'Reads titles with the author, publisher, ISBN and classification, plus how many physical copies are held and how many are on loan. One row is a TITLE, not a book on the shelf. Changes nothing.',
    module: 'library',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { search_text: '', language: '', limit: 50 },
  },
  {
    key: 'library.circulation',
    label: 'Read library loans',
    description:
      'Reads loans with the title, borrower and dates, and which are still out or past their due date. A loan with no due date is undated rather than overdue. No fine or reservation is recorded. Changes nothing.',
    module: 'library',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { state: 'any', student_id: null, book_id: null, limit: 50 },
  },

  // ---- Learning (LMS) -----------------------------------------------------
  //
  // Both tools were registered long before this module had a stack; they are listed here
  // so the Automations tab can offer them. They read CONFIGURATION, not achievement.
  {
    key: 'lms.courses',
    label: 'Read configured courses',
    description:
      'Reads the courses set up for this institute, with their subject and class. This is configuration and not achievement: nothing here says what a child learned or how well. Changes nothing.',
    module: 'lms',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { search_text: '', limit: 50 },
  },
  {
    key: 'lms.activities',
    label: 'Read learning activities',
    description:
      'Reads the activities recorded against courses. An activity being recorded means it was set up, not that anybody completed it. Changes nothing.',
    module: 'lms',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { limit: 50 },
  },

  // ---- Institute ----------------------------------------------------------
  //
  // Both are shared reads that several modules bind. They are offered here because the
  // shape of the school is what this module is FOR, not a lookup it borrows.
  {
    key: 'academics.structure',
    label: 'Read the academic structure',
    description:
      'Reads the sections, standards and divisions of this institute. This is the shape of the school and not a count of the people in it. Changes nothing.',
    module: 'institute',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { limit: 50 },
  },
  {
    key: 'hr.departments',
    label: 'Read the departments',
    description:
      'Reads the departments recorded for this institute. Nothing here says who works in one or how large it is. Changes nothing.',
    module: 'institute',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: {},
  },

  // ---- Teach/Learn ----------------------------------------------------------
  //
  // Teach/Learn is a teacher-facing lens on the SAME course/chapter/activity records `lms`
  // already reads — these two keys wrap the identical backend tools (`lms.courses`,
  // `lms.activities`) rather than re-deriving the query, which is deliberate reuse of real
  // data across two modules' pages, not a leak of one module's data into another's.
  {
    key: 'teach_learn.courses',
    label: 'Read configured courses',
    description:
      'Reads the courses, subjects and chapters set up for this institute, exactly as Teach/Learn shows them. Configuration, not achievement — nothing here says what a learner completed. Changes nothing.',
    module: 'teach_learn',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { standard_name: '', subject_id: null, include_chapters: true, limit: 50 },
  },
  {
    key: 'teach_learn.activities',
    label: 'Read learning activities',
    description:
      'Reads what is on for a class this week: sessions and homework on one timeline. Changes nothing.',
    module: 'teach_learn',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { standard_id: null, days_ahead: 7, days_back: 7, limit: 50 },
  },

  // ---- Curriculum Planning --------------------------------------------------
  {
    key: 'curriculum_planning.status',
    label: 'Read curriculum coverage',
    description:
      'Reads the curriculum → unit → chapter hierarchy for a subject and standard, with planned vs. completed periods and coverage. Changes nothing.',
    module: 'curriculum_planning',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { standard_id: null, subject_id: null, syear: null },
  },
  {
    key: 'curriculum_planning.outcomes',
    label: 'Read learning outcomes',
    description:
      'Reads the learning outcomes and competencies declared against a curriculum, and which chapters claim them. Changes nothing.',
    module: 'curriculum_planning',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { curriculum_id: null },
  },

  // ---- Engagement ------------------------------------------------------------
  //
  // No engagement table exists in this estate. Both tools compute a live signal from
  // attendance, homework and assignment records that already exist — nothing here is
  // stored, and nothing here is invented.
  {
    key: 'engagement.student_summary',
    label: 'Read a student’s engagement signal',
    description:
      'Computes attendance rate, homework completion and assignment completion for a student over a period, from the real records in each. Changes nothing.',
    module: 'engagement',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { student_id: null, standard_id: null, days_back: 30 },
  },
  {
    key: 'engagement.students_needing_attention',
    label: 'Read students below the engagement threshold',
    description:
      'Reads students whose computed attendance, homework or assignment completion falls below a threshold. The threshold is a filter, not a stored score. Changes nothing.',
    module: 'engagement',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { standard_id: null, threshold_percent: 60, days_back: 30, limit: 50 },
  },

  // ---- Interactions ------------------------------------------------------------
  //
  // Backed by a new table, `interaction_logs`, genuinely empty until staff log a call,
  // meeting or note. No seed rows.
  {
    key: 'interactions.list',
    label: 'Read logged interactions',
    description:
      'Reads logged touchpoints with a student, parent or staff member — calls, meetings, notes and follow-ups — as staff recorded them. Changes nothing.',
    module: 'interactions',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { related_type: '', related_id: null, status: '', limit: 50 },
  },
  {
    key: 'interactions.summary',
    label: 'Read interaction counts and open follow-ups',
    description: 'Reads counts by type and status, and which follow-ups are still open. Changes nothing.',
    module: 'interactions',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { days_back: 30 },
  },

  // ---- New PAL ------------------------------------------------------------
  //
  // `new_pal` is a distinct module from `pal` even though both concern personalised
  // learning: `new_pal` reads the richer content-model/gamification/coherence tables the
  // rebuilt workspace introduced, and none of these three tools reaches the older `pal`
  // module's tables.
  {
    key: 'new_pal.gamification_summary',
    label: 'Read learning engagement signals',
    description:
      'Reads recorded learning events, streaks and framework progress for a student or class. Changes nothing.',
    module: 'new_pal',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { student_id: null, standard_id: null, days_back: 30 },
  },
  {
    key: 'new_pal.content_model_status',
    label: 'Read content model coverage',
    description:
      'Reads which chapters have an authored or system-generated content model, and which do not. Changes nothing.',
    module: 'new_pal',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { standard_id: null, subject_id: null },
  },
  {
    key: 'new_pal.coherence_gaps',
    label: 'Read concept coherence gaps',
    description: 'Reads concept relations and mastery evidence, and where coverage is thin. Changes nothing.',
    module: 'new_pal',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { standard_id: null, subject_id: null, limit: 50 },
  },

  // ---- Shared -------------------------------------------------------------
  {
    key: 'shared.compose_note',
    label: 'Compose a note',
    description: 'Turns a heading and bullet points into a short, plain-language note.',
    module: SHARED_MODULE,
    risk: 'draft',
    kind: 'local',
    available: true,
    exampleInput: { heading: 'Term-2 fee schedule', points: ['Due 15 July', 'Pay online or at the office'] },
  },
];

export function findModule(key: string): AgentModule | undefined {
  return AGENT_MODULES.find((module) => module.key === key);
}

export function isKnownModule(key: string): boolean {
  return Boolean(findModule(key));
}

/** The Laravel permission key an agent in this module is gated on. */
export function rbacModuleKey(module: AgentModuleKey): string {
  return `agents.${module}`;
}

/** Tools a Create Agent form may offer for one module: the module's own plus shared. */
export function toolsForModule(module: AgentModuleKey): AgentTool[] {
  return AGENT_TOOLS.filter((tool) => tool.module === module || tool.module === SHARED_MODULE);
}

export function findTool(key: string): AgentTool | undefined {
  return AGENT_TOOLS.find((tool) => tool.key === key);
}

/**
 * The reason an allow-list is not acceptable for a module, or null if it is.
 *
 * Duplicates are tolerated (the engine de-duplicates); an empty list, an unknown
 * key, a key from another module, or a tool with no executor are not.
 */
export function validateToolsForModule(module: AgentModuleKey, toolKeys: string[]): string | null {
  const unique = Array.from(new Set(toolKeys));
  if (!unique.length) return 'Choose at least one tool.';

  const offered = new Set(toolsForModule(module).map((tool) => tool.key));
  for (const key of unique) {
    const tool = findTool(key);
    if (!tool) return `Unknown tool "${key}".`;
    if (!offered.has(key)) return `"${tool.label}" belongs to ${tool.module}, not ${module}.`;
    if (!tool.available) return `"${tool.label}" is not available yet.`;
  }
  return null;
}
