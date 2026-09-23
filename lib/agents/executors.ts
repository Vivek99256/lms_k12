import { callMcpTool } from '@/lib/ai/mcp-client';

import { findTool } from './registry';

/**
 * Tool executors.
 *
 * Every tool marked `available: true` in the registry has an entry here, and
 * nothing else does — `validateToolsForModule` guarantees an agent's allow-list
 * only names tools this table can run.
 *
 * TWO KINDS OF EXECUTOR, AND THE DIFFERENCE MATTERS
 *
 * A `draft` executor turns the caller's arguments into text. It is deliberately not
 * a model: it exercises the engine, the run log, the RBAC gate and the module
 * scoping end to end without any AI in the loop, and when the governed lifecycle
 * takes over drafting it replaces the body of an executor without the engine
 * changing. A draft executor returns text and changes no record.
 *
 * A `read` executor calls a governed MCP tool and returns what the school's own
 * records say. It invents nothing: every figure it reports came back from Laravel,
 * scoped to the institute in the caller's token, and the tool it calls is annotated
 * `read_only` on the backend so a read cannot write. This is what lets a Fees agent
 * answer "who owes fees" with real fee records rather than a plausible sentence.
 *
 * WHY A READ EXECUTOR NEEDS A SESSION
 *
 * Because it runs as the person who pressed Run, not as a service account. The
 * bearer token travels in `ToolContext`, is used for exactly one call and is never
 * stored — the run log records who ran it, never their credential. An executor with
 * no session fails cleanly rather than falling back to unscoped data.
 */

/** The caller's authority, for executors that reach the backend. Absent in tests. */
export interface ToolSession {
  baseUrl: string;
  token: string;
  instituteId: string;
  academicYear?: string;
  termId?: string;
}

export interface ToolContext {
  session?: ToolSession;
}

export interface ToolExecution {
  output: Record<string, unknown>;
}

type Executor = (
  args: Record<string, unknown>,
  context: ToolContext,
) => ToolExecution | Promise<ToolExecution>;

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function list(value: unknown): string[] {
  return Array.isArray(value) ? value.map((entry) => text(entry)).filter(Boolean) : [];
}

/** Indian grouping with the rupee sign, as the design system's currency rule asks. */
export function formatRupees(value: unknown): string {
  const amount = typeof value === 'number' ? value : Number(String(value ?? '').replace(/[^\d.]/g, ''));
  if (!Number.isFinite(amount)) return '';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

function formatDate(value: unknown): string {
  const raw = text(value);
  if (!raw) return '';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function wordCount(message: string): number {
  return message.split(/\s+/).filter(Boolean).length;
}

/** A positive integer argument, or undefined so the tool applies its own default. */
function count(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : Number(String(value ?? '').trim());
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

/** Drop the keys the caller left blank: an MCP tool rejects unknown or empty properties. */
function given(args: Record<string, unknown | undefined>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(args).filter(([, value]) => value !== undefined && value !== ''));
}

/**
 * Call one governed MCP tool as the person who pressed Run.
 *
 * Refuses rather than guesses when there is no session: an agent run with no
 * credential must fail visibly in the run log, not silently return an empty cohort
 * that reads like "nobody owes anything".
 */
async function readViaMcp(
  context: ToolContext,
  tool: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const session = context.session;

  if (!session?.token) {
    // Names no module: this helper now backs Fees and Attendance reads, and a Fees
    // sentence shown after an attendance run would send somebody to the wrong screen.
    throw new Error('This tool reads live records and needs your signed-in session. Sign in again and retry.');
  }

  const payload = (await callMcpTool(
    {
      token: session.token,
      baseUrl: session.baseUrl,
      meta: {
        instituteId: session.instituteId,
        academicYear: session.academicYear,
        termId: session.termId,
      },
    },
    { tool, arguments: args },
  )) as Record<string, unknown>;

  // MCP answers {success, message, data}. `callMcpTool` already throws on a failure
  // envelope, so anything arriving here succeeded and `data` is the school's answer.
  const data = payload.data;

  return {
    ...(data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : { result: data }),
    ...(typeof payload.message === 'string' ? { summary: payload.message } : {}),
    source: tool,
    reads_live_records: true,
  };
}

const EXECUTORS: Record<string, Executor> = {
  'fees.draft_reminder': (args) => {
    const student = text(args.student_name, 'your child');
    const className = text(args.class_name);
    const amount = formatRupees(args.amount);
    const dueDate = formatDate(args.due_date);
    const firm = text(args.tone) === 'firm';

    const opening = firm
      ? `This is a reminder that the fee payment for ${student}${className ? ` (${className})` : ''} is still outstanding.`
      : `A gentle reminder that the fee payment for ${student}${className ? ` (${className})` : ''} is due.`;
    const amountLine = amount ? `Amount due: ${amount}.` : '';
    const dateLine = dueDate ? (firm ? `The due date was ${dueDate}.` : `Please pay by ${dueDate}.`) : '';
    const closing = firm
      ? 'Please clear the balance at the earliest to avoid a late fee. If you have already paid, kindly ignore this message.'
      : 'You can pay online or at the school office. If you have already paid, please ignore this message.';

    const message = ['Dear Parent,', '', opening, [amountLine, dateLine].filter(Boolean).join(' '), '', closing, '', 'Regards,', 'Accounts Office']
      .filter((line, index, all) => !(line === '' && all[index - 1] === ''))
      .join('\n');

    return {
      output: {
        subject: `Fee reminder${student !== 'your child' ? ` — ${student}` : ''}`,
        message,
        tone: firm ? 'firm' : 'gentle',
        word_count: wordCount(message),
        sends: false,
      },
    };
  },

  /**
   * What was collected, from the receipts. Backed by `fees.collection_report`.
   */
  'fees.collection_report': (args, context) =>
    readViaMcp(
      context,
      'fees.collection_report',
      given({
        from_date: text(args.from_date),
        to_date: text(args.to_date),
        student_id: count(args.student_id),
        payment_mode: text(args.payment_mode),
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  /**
   * Who is attending least, from the marked register itself.
   *
   * Backed by `attendance.overview`, which reports `students_judged` and
   * `students_with_insufficient_data` alongside the list — so a student nobody has
   * marked is never presented as a student who does not attend. The agent passes
   * that straight through rather than summarising it away.
   */
  'attendance.low_attendance': (args, context) =>
    readViaMcp(
      context,
      'attendance.overview',
      given({
        standard_id: count(args.standard_id ?? args.class_id),
        division_id: count(args.division_id ?? args.section_id),
        student_id: count(args.student_id),
        days: count(args.days),
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  /**
   * One student's own record, day by day. Backed by `attendance.student`.
   */
  'attendance.student_record': (args, context) =>
    readViaMcp(
      context,
      'attendance.student',
      given({
        student_id: count(args.student_id),
        days: count(args.days),
      }),
    ).then((output) => ({ output })),

  /**
   * A note to a family about their child's attendance.
   *
   * Says only what it was given, and asks rather than asserts: the register records
   * that a child was away and nothing about why, so a note that supplied a reason
   * would be inventing the one piece of information the school most needs to hear
   * from the family. It sends nothing.
   */
  'attendance.draft_parent_note': (args) => {
    const student = text(args.student_name, 'your child');
    const className = text(args.class_name);
    const present = count(args.present_days);
    const absent = count(args.absent_days);
    const windowDays = count(args.window_days);
    const firm = text(args.tone) === 'firm';

    const marked = (present ?? 0) + (absent ?? 0);
    // Stated only when both counts are present. A rate computed from one of them
    // would be a figure nobody supplied.
    const rate = marked > 0 && present !== undefined ? Math.round((present / marked) * 100) : null;

    const opening = firm
      ? `We are writing about ${student}'s${className ? ` (${className})` : ''} attendance, which the school is concerned about.`
      : `We wanted to let you know about ${student}'s${className ? ` (${className})` : ''} attendance.`;

    const figures = absent
      ? `Our records show ${absent} day${absent === 1 ? '' : 's'} marked absent${
          marked > 0 ? ` out of ${marked} marked day${marked === 1 ? '' : 's'}` : ''
        }${windowDays ? ` over the last ${windowDays} days` : ''}${rate === null ? '' : `, an attendance rate of ${rate}%`}.`
      : '';

    const closing =
      'If there is something going on that the school should know about, please do tell us — we would rather help than assume. If our records are wrong, let us know and we will correct them.';

    const message = [
      'Dear Parent,',
      '',
      opening,
      figures,
      '',
      closing,
      '',
      'Regards,',
      'School Office',
    ]
      .filter((line, index, all) => !(line === '' && all[index - 1] === ''))
      .join('\n');

    return {
      output: {
        subject: `Attendance${student !== 'your child' ? ` — ${student}` : ''}`,
        message,
        tone: firm ? 'firm' : 'gentle',
        attendance_rate_percent: rate,
        word_count: wordCount(message),
        // No reason for the absence is stated, because none was supplied and the
        // register does not hold one.
        states_reason_for_absence: false,
        sends: false,
      },
    };
  },

  'g2g.draft_growth_note': (args) => {
    const learner = text(args.learner_name, 'the learner');
    const strengths = list(args.strengths);
    const nextStep = text(args.next_step);

    const lines = [
      `${learner} is making steady progress.`,
      strengths.length ? `Strengths noticed: ${strengths.join(', ')}.` : '',
      nextStep ? `Next step: ${nextStep}.` : '',
    ].filter(Boolean);
    const message = lines.join(' ');

    return { output: { message, word_count: wordCount(message), sends: false } };
  },

  'admissions.enquiry_followup': (args) => {
    const parent = text(args.parent_name, 'Parent');
    const child = text(args.child_name, 'your child');
    const grade = text(args.grade_applied);
    const enquiryDate = formatDate(args.enquiry_date);

    const message = [
      `Dear ${parent},`,
      '',
      `Thank you for your enquiry${enquiryDate ? ` on ${enquiryDate}` : ''} about admission for ${child}${grade ? ` to ${grade}` : ''}.`,
      'Seats are being confirmed now. If you would like to go ahead, the registration form takes about ten minutes and our office can help with any questions.',
      '',
      'Regards,',
      'Admissions Office',
    ].join('\n');

    return { output: { subject: `Admission enquiry — ${child}`, message, word_count: wordCount(message), sends: false } };
  },

  /**
   * The admission enquiries on file, from the enquiry records themselves.
   *
   * Backed by `admissions.listEnquiries`, which reports `count` alongside the rows
   * and is scoped to the institute and academic year on the caller's token. The agent
   * passes that straight through rather than summarising it away.
   */
  'admissions.list_enquiries': (args, context) =>
    readViaMcp(
      context,
      'admissions.listEnquiries',
      given({
        search_text: text(args.search_text ?? args.query),
        only_pending: typeof args.only_pending === 'boolean' ? args.only_pending : undefined,
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  /**
   * What was registered on one day, from the registration records.
   *
   * Backed by `admissions.today`, whose `date` defaults to today on the backend — so
   * an empty run answers "what came in today" rather than failing for want of a date.
   */
  'admissions.todays_registrations': (args, context) =>
    readViaMcp(
      context,
      'admissions.today',
      given({
        date: text(args.date),
        admission_status: text(args.admission_status ?? args.status),
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  /**
   * One enquiry in full. Backed by `admissions.getEnquiryDetails`, which also returns
   * the confirmation check — so the agent can say what the record is still missing
   * without deciding that for itself.
   */
  'admissions.enquiry_details': (args, context) =>
    readViaMcp(
      context,
      'admissions.getEnquiryDetails',
      given({ enquiry_id: count(args.enquiry_id) }),
    ).then((output) => ({ output })),

  /**
   * Who is enrolled where, from the enrolment records themselves.
   *
   * Backed by `students.directory`, which counts the whole cohort before applying the
   * limit and reports `unresolved_filters` when a named class does not exist — so a
   * filter naming a class the school does not have returns nothing and says so, rather
   * than quietly widening to every student.
   */
  'students.directory': (args, context) =>
    readViaMcp(
      context,
      'students.directory',
      given({
        grade_id: count(args.grade_id),
        standard_id: count(args.standard_id ?? args.class_id),
        division_id: count(args.division_id ?? args.section_id),
        standard_name: text(args.standard_name),
        division_name: text(args.division_name),
        active_only: typeof args.active_only === 'boolean' ? args.active_only : undefined,
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  /**
   * One named student. Backed by `students.search`.
   */
  'students.find': (args, context) =>
    readViaMcp(
      context,
      'students.search',
      given({
        student_id: count(args.student_id),
        query: text(args.query ?? args.search_text),
        active_only: typeof args.active_only === 'boolean' ? args.active_only : undefined,
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  /**
   * Which class a student was in each year. Backed by `students.history` — the only
   * student tool that looks beyond the current academic year.
   */
  'students.enrolment_history': (args, context) =>
    readViaMcp(
      context,
      'students.history',
      given({ student_id: count(args.student_id) }),
    ).then((output) => ({ output })),

  /**
   * A message to a family asking for a detail the student record is missing.
   *
   * Says only what it was given. The directory holds a name, a class and a contact and
   * nothing about how the child is doing, so this never characterises the student — and
   * it names the missing fields exactly as the caller supplied them rather than guessing
   * which ones a school requires. It sends nothing.
   */
  'students.draft_record_request': (args) => {
    const student = text(args.student_name, 'your child');
    const className = text(args.class_name);
    const missing = list(args.missing_fields);
    const purpose = text(args.purpose);
    const how = text(args.return_instructions);

    const needed =
      missing.length === 0
        ? 'some details for our records'
        : missing.length === 1
          ? missing[0]
          : `${missing.slice(0, -1).join(', ')} and ${missing[missing.length - 1]}`;

    const opening = `We are updating our records for ${student}${className ? ` (${className})` : ''}, and we are missing ${needed}.`;
    const why = purpose ? `We need it ${purpose}.` : '';
    const closing = how
      ? `Please send it to us ${how}.`
      : 'Please send it to the school office, or reply to this message with the details.';

    const message = ['Dear Parent,', '', opening, why, '', closing, '', 'Regards,', 'School Office']
      .filter((line, index, all) => !(line === '' && all[index - 1] === ''))
      .join('\n');

    return {
      output: {
        subject: `Record update${student !== 'your child' ? ` — ${student}` : ''}`,
        message,
        missing_fields: missing,
        word_count: wordCount(message),
        // Nothing is said about the student beyond the class they are in, because
        // nothing else was supplied and the directory holds nothing else.
        characterises_student: false,
        sends: false,
      },
    };
  },

  // ---- Exam ---------------------------------------------------------------

  /**
   * The exams that exist, so a results question can name one. Backed by `exams.list`.
   */
  'exam.list': (args, context) =>
    readViaMcp(
      context,
      'exams.list',
      given({
        standard_id: count(args.standard_id ?? args.class_id),
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  /**
   * The marks as recorded. Backed by `exams.results`, which reports `scored_count` and
   * `absent_count` alongside the average — so a child marked absent is never folded in as
   * a zero and a missed exam is never reported as a failed one. The agent passes that
   * straight through rather than summarising it away.
   */
  'exam.results': (args, context) =>
    readViaMcp(
      context,
      'exams.results',
      given({
        student_id: count(args.student_id),
        exam_id: count(args.exam_id),
        subject_name: text(args.subject_name),
        standard_name: text(args.standard_name ?? args.class_name),
        exam_title: text(args.exam_title),
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  /**
   * A note to a family about one exam record.
   *
   * States the figures it was given and nothing else. An exam mark is a record of one
   * performance on one day; it is not a statement about a child's ability, so this never
   * praises, warns, ranks or advises. An absence is reported as an absence, never as a
   * zero — which is the same rule the tool that reads the marks applies, kept here so the
   * text cannot contradict the figures it came from.
   */
  'exam.draft_result_note': (args) => {
    const student = text(args.student_name, 'your child');
    const className = text(args.class_name);
    const exam = text(args.exam_title, 'the recent exam');
    const subject = text(args.subject_name);
    const marks = text(args.marks);
    const percentage = text(args.percentage);
    const grade = text(args.grade);
    const absent = args.absent === true || text(args.absent).toLowerCase() === 'yes';

    const subjectLine = subject ? ` in ${subject}` : '';

    const body = absent
      ? `Our records show that ${student}${className ? ` (${className})` : ''} was marked absent for ${exam}${subjectLine}. No marks were recorded, and the record holds no reason for the absence.`
      : [
          `This is the result recorded for ${student}${className ? ` (${className})` : ''} in ${exam}${subjectLine}.`,
          [
            marks ? `Marks: ${marks}.` : '',
            percentage ? `Percentage: ${percentage}.` : '',
            grade ? `Grade: ${grade}.` : '',
          ]
            .filter(Boolean)
            .join(' '),
        ]
          .filter(Boolean)
          .join(' ');

    const closing =
      'If anything here does not match your own record, please tell the school office and we will check it.';

    const message = ['Dear Parent,', '', body, '', closing, '', 'Regards,', 'Examinations Office']
      .filter((line, index, all) => !(line === '' && all[index - 1] === ''))
      .join('\n');

    return {
      output: {
        subject: `${exam}${student !== 'your child' ? ` — ${student}` : ''}`,
        message,
        absent,
        word_count: wordCount(message),
        // Nothing is said about the child beyond the figures supplied, because a mark
        // does not support saying anything else.
        characterises_student: false,
        sends: false,
      },
    };
  },

  // ---- Teach/Learn ----------------------------------------------------------
  //
  // Wraps the SAME backend tools `lms.*` already binds — see the registry comment on
  // `teach_learn.courses`. No new backend tool for this module.

  'teach_learn.courses': (args, context) =>
    readViaMcp(
      context,
      'lms.courses',
      given({
        standard_id: count(args.standard_id ?? args.class_id),
        standard_name: text(args.standard_name ?? args.class_name),
        subject_id: count(args.subject_id),
        category: text(args.category),
        query: text(args.query),
        include_chapters: args.include_chapters === false ? false : undefined,
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  'teach_learn.activities': (args, context) =>
    readViaMcp(
      context,
      'lms.activities',
      given({
        standard_id: count(args.standard_id ?? args.class_id),
        student_id: count(args.student_id),
        days_ahead: count(args.days_ahead),
        days_back: count(args.days_back),
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  // ---- Curriculum Planning ---------------------------------------------------

  'curriculum_planning.status': (args, context) =>
    readViaMcp(
      context,
      'curriculum_planning.status',
      given({
        standard_id: count(args.standard_id ?? args.class_id),
        subject_id: count(args.subject_id),
        syear: text(args.syear),
      }),
    ).then((output) => ({ output })),

  'curriculum_planning.outcomes': (args, context) =>
    readViaMcp(
      context,
      'curriculum_planning.outcomes',
      given({
        curriculum_id: count(args.curriculum_id),
      }),
    ).then((output) => ({ output })),

  // ---- Engagement -------------------------------------------------------------

  'engagement.student_summary': (args, context) =>
    readViaMcp(
      context,
      'engagement.student_summary',
      given({
        student_id: count(args.student_id),
        standard_id: count(args.standard_id ?? args.class_id),
        days_back: count(args.days_back),
      }),
    ).then((output) => ({ output })),

  'engagement.students_needing_attention': (args, context) =>
    readViaMcp(
      context,
      'engagement.students_needing_attention',
      given({
        standard_id: count(args.standard_id ?? args.class_id),
        threshold_percent: count(args.threshold_percent),
        days_back: count(args.days_back),
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  // ---- Interactions -------------------------------------------------------------

  'interactions.list': (args, context) =>
    readViaMcp(
      context,
      'interactions.list',
      given({
        related_type: text(args.related_type),
        related_id: count(args.related_id),
        status: text(args.status),
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  'interactions.summary': (args, context) =>
    readViaMcp(
      context,
      'interactions.summary',
      given({
        days_back: count(args.days_back),
      }),
    ).then((output) => ({ output })),

  // ---- New PAL ------------------------------------------------------------

  'new_pal.gamification_summary': (args, context) =>
    readViaMcp(
      context,
      'new_pal.gamification_summary',
      given({
        student_id: count(args.student_id),
        standard_id: count(args.standard_id ?? args.class_id),
        days_back: count(args.days_back),
      }),
    ).then((output) => ({ output })),

  'new_pal.content_model_status': (args, context) =>
    readViaMcp(
      context,
      'new_pal.content_model_status',
      given({
        standard_id: count(args.standard_id ?? args.class_id),
        subject_id: count(args.subject_id),
      }),
    ).then((output) => ({ output })),

  'new_pal.coherence_gaps': (args, context) =>
    readViaMcp(
      context,
      'new_pal.coherence_gaps',
      given({
        standard_id: count(args.standard_id ?? args.class_id),
        subject_id: count(args.subject_id),
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  // ---- PTM ----------------------------------------------------------------

  /**
   * The PTM programme. Backed by `ptm.meetings`, which counts bookings whose attendance
   * has not been saved in their own bucket — so an unsaved register is never reported as
   * families who stayed away.
   */
  'ptm.meetings': (args, context) =>
    readViaMcp(
      context,
      'ptm.meetings',
      given({
        standard_id: count(args.standard_id ?? args.class_id),
        division_id: count(args.division_id ?? args.section_id),
        from_date: text(args.from_date),
        to_date: text(args.to_date),
        title: text(args.title),
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  /**
   * The individual bookings. Backed by `ptm.bookings`.
   */
  'ptm.bookings': (args, context) =>
    readViaMcp(
      context,
      'ptm.bookings',
      given({
        slot_id: count(args.slot_id),
        student_id: count(args.student_id),
        standard_id: count(args.standard_id ?? args.class_id),
        division_id: count(args.division_id ?? args.section_id),
        from_date: text(args.from_date),
        to_date: text(args.to_date),
        attended: text(args.attended),
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  /**
   * An invitation to one family for a parent-teacher meeting.
   *
   * Says only what it was given, and books nothing: the slot, the date and the time are
   * details a person has already chosen on the PTM screen. It never states what the
   * meeting will be about, because the booking record does not hold that and a family
   * told "we need to discuss your child's progress" has been told something the school
   * did not say.
   */
  'ptm.draft_invitation': (args) => {
    const parent = text(args.parent_name, 'Parent');
    const student = text(args.student_name, 'your child');
    const className = text(args.class_name);
    const title = text(args.meeting_title, 'a parent-teacher meeting');
    const date = formatDate(args.meeting_date);
    const from = text(args.from_time);
    const to = text(args.to_time);
    const venue = text(args.venue);

    const slot = [from, to].filter(Boolean).join(' to ');
    const when = [date ? `on ${date}` : '', slot ? `from ${slot}` : ''].filter(Boolean).join(' ');

    const opening = `You are invited to ${title} for ${student}${className ? ` (${className})` : ''}${
      when ? ` ${when}` : ''
    }${venue ? `, at ${venue}` : ''}.`;

    const closing =
      'If that time does not suit you, please tell the school office and we will try to find another. If you cannot attend at all, let us know so the slot can go to another family.';

    const message = [`Dear ${parent},`, '', opening, '', closing, '', 'Regards,', 'School Office']
      .filter((line, index, all) => !(line === '' && all[index - 1] === ''))
      .join('\n');

    return {
      output: {
        subject: `${title}${student !== 'your child' ? ` — ${student}` : ''}`,
        message,
        word_count: wordCount(message),
        // No agenda is stated, because the booking record holds none.
        states_meeting_agenda: false,
        books: false,
        sends: false,
      },
    };
  },

  // ---- Hostel -------------------------------------------------------------

  /**
   * The hostels and how full they are. Backed by `hostel.occupancy`, which reports rooms
   * and occupants rather than a percentage — rooms carry no bed capacity in this schema,
   * and the agent must not supply one.
   */
  'hostel.occupancy': (args, context) =>
    readViaMcp(
      context,
      'hostel.occupancy',
      given({
        hostel_id: count(args.hostel_id),
        hostel_name: text(args.hostel_name),
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  /**
   * Who is where. Backed by `hostel.allocations`, which says for each row whether the
   * occupant is a student or a member of staff rather than assuming.
   */
  'hostel.allocations': (args, context) =>
    readViaMcp(
      context,
      'hostel.allocations',
      given({
        hostel_id: count(args.hostel_id),
        room_id: count(args.room_id),
        admission_category_id: count(args.admission_category_id),
        student_id: count(args.student_id ?? args.user_id),
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  /**
   * What is free. Backed by `hostel.available_rooms`, which uses the estate's own
   * definition: a room with no allocation for this institute this academic year.
   */
  'hostel.available_rooms': (args, context) =>
    readViaMcp(
      context,
      'hostel.available_rooms',
      given({
        hostel_id: count(args.hostel_id),
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  // ---- Student requests ---------------------------------------------------

  /**
   * The request queue. Backed by `student_requests.list`, which reports the whole queue
   * size and a breakdown by status alongside the page — so a page of fifty is never read
   * as fifty pending requests.
   */
  'student_request.list': (args, context) =>
    readViaMcp(
      context,
      'student_requests.list',
      given({
        status: text(args.status),
        only_pending: typeof args.only_pending === 'boolean' ? args.only_pending : undefined,
        request_type_id: count(args.request_type_id),
        student_id: count(args.student_id),
        standard_id: count(args.standard_id ?? args.class_id),
        division_id: count(args.division_id ?? args.section_id),
        search_text: text(args.search_text ?? args.query),
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  /**
   * One request in full. Backed by `student_requests.details`, which also reports whether
   * the request type required a proof document and whether one was supplied — so the agent
   * can say what is outstanding without deciding anything.
   */
  'student_request.details': (args, context) =>
    readViaMcp(
      context,
      'student_requests.details',
      given({ request_id: count(args.request_id) }),
    ).then((output) => ({ output })),

  /**
   * An acknowledgement of a request the school has received.
   *
   * Confirms receipt and names anything still outstanding. It states no decision and
   * predicts none: a pending request has not been approved and has not been refused, and a
   * family told either would have been told something nobody decided. Deciding stays on the
   * Student Request screen.
   */
  'student_request.draft_acknowledgement': (args) => {
    const parent = text(args.parent_name, 'Parent');
    const student = text(args.student_name, 'your child');
    const className = text(args.class_name);
    const title = text(args.request_title, 'your request');
    const raised = formatDate(args.raised_on);
    const outstanding = list(args.outstanding_documents);

    const opening = `We have received ${title} for ${student}${className ? ` (${className})` : ''}${
      raised ? `, submitted on ${raised}` : ''
    }.`;

    const needed =
      outstanding.length === 0
        ? 'Nothing further is needed from you at this stage.'
        : outstanding.length === 1
          ? `Before it can be considered, we still need ${outstanding[0]}.`
          : `Before it can be considered, we still need ${outstanding.slice(0, -1).join(', ')} and ${
              outstanding[outstanding.length - 1]
            }.`;

    const closing =
      'The school will review the request and write to you with the outcome. If you have any questions in the meantime, please contact the school office.';

    const message = [`Dear ${parent},`, '', opening, needed, '', closing, '', 'Regards,', 'School Office']
      .filter((line, index, all) => !(line === '' && all[index - 1] === ''))
      .join('\n');

    return {
      output: {
        subject: `${title}${student !== 'your child' ? ` — ${student}` : ''}`,
        message,
        outstanding_documents: outstanding,
        word_count: wordCount(message),
        // The two things this must never do, recorded on the output so a reviewer can see
        // they did not happen.
        states_decision: false,
        predicts_decision: false,
        sends: false,
      },
    };
  },

  // ---- Circular -----------------------------------------------------------

  /**
   * The circular register. Backed by `circulars.list`, which reports rows and distinct
   * circulars separately — one notice to six classes is six rows, and reporting only the
   * first number would turn it into six notices.
   */
  'circular.list': (args, context) =>
    readViaMcp(
      context,
      'circulars.list',
      given({
        standard_id: count(args.standard_id ?? args.class_id),
        division_id: count(args.division_id ?? args.section_id),
        type_id: count(args.type_id),
        from_date: text(args.from_date),
        to_date: text(args.to_date),
        search_text: text(args.search_text ?? args.query),
        with_attachment: typeof args.with_attachment === 'boolean' ? args.with_attachment : undefined,
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  /**
   * The body of a circular, from a subject and a few points.
   *
   * Publishes nothing. Publishing a circular sends it to every family in a class, and that
   * stays a person pressing a button on the Circular screen — this produces text for them
   * to read first. It says only what it was given: no date, no venue and no instruction is
   * invented, because a circular is the school speaking and a detail nobody supplied would
   * be the school saying something it did not decide.
   */
  'circular.draft': (args) => {
    const title = text(args.title, 'Notice');
    const audience = text(args.audience);
    const points = list(args.points);
    const effective = formatDate(args.effective_date);
    const action = text(args.action_required);
    const contact = text(args.contact);

    const opening = [
      audience ? `This circular is for ${audience}.` : '',
      effective ? `It takes effect from ${effective}.` : '',
    ]
      .filter(Boolean)
      .join(' ');

    const body = points.length ? points.map((point) => `• ${point}`).join('\n') : '';

    const message = [
      title,
      '',
      opening,
      body,
      '',
      action ? `What to do: ${action}` : '',
      contact ? `Questions: ${contact}` : '',
      '',
      'School Office',
    ]
      .filter(Boolean)
      .filter((line, index, all) => !(line === '' && all[index - 1] === ''))
      .join('\n');

    return {
      output: {
        title,
        message,
        point_count: points.length,
        word_count: wordCount(message),
        publishes: false,
        sends: false,
      },
    };
  },

  // ---- Users Mobile Apps --------------------------------------------------

  'mobile_apps.homescreen': (args, context) =>
    readViaMcp(
      context,
      'mobile_apps.homescreen',
      given({
        app: text(args.app),
        user_profile_name: text(args.user_profile_name ?? args.profile),
        section: text(args.section),
        status: text(args.status),
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  'mobile_apps.sections': (args, context) =>
    readViaMcp(context, 'mobile_apps.sections', given({ limit: count(args.limit) })).then((output) => ({ output })),

  // ---- Student I-Card -----------------------------------------------------

  /**
   * The card print list. Backed by `student_icard.roster`, which reports `card_ready` and
   * `missing_fields` per student — so the agent can say which cards are held up and by
   * what, without deciding that a child without a photo is a child without a card.
   */
  'student_icard.roster': (args, context) =>
    readViaMcp(
      context,
      'student_icard.roster',
      given({
        grade_id: count(args.grade_id),
        standard_id: count(args.standard_id ?? args.class_id),
        division_id: count(args.division_id ?? args.section_id),
        student_id: count(args.student_id),
        search_text: text(args.search_text ?? args.query),
        with_transport: typeof args.with_transport === 'boolean' ? args.with_transport : undefined,
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  'student_icard.card_details': (args, context) =>
    readViaMcp(context, 'student_icard.card_details', given({ student_id: count(args.student_id) })).then(
      (output) => ({ output }),
    ),

  // ---- Certificate --------------------------------------------------------

  /**
   * The issue register. Backed by `certificate.issued`, which reports the whole year's
   * breakdown by type beside the page — and deliberately never returns the printed
   * document, so an agent cannot quote what a certificate says about a child.
   */
  'certificate.issued': (args, context) =>
    readViaMcp(
      context,
      'certificate.issued',
      given({
        certificate_type: text(args.certificate_type ?? args.type),
        student_id: count(args.student_id),
        certificate_number: text(args.certificate_number),
        from_date: text(args.from_date),
        to_date: text(args.to_date),
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  'certificate.templates': (args, context) =>
    readViaMcp(
      context,
      'certificate.templates',
      given({
        certificate_type: text(args.certificate_type ?? args.type),
        only_active: typeof args.only_active === 'boolean' ? args.only_active : undefined,
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  // ---- Communication ------------------------------------------------------

  /**
   * What was sent. Backed by `communication.messages`, which reports a per-channel
   * breakdown and marks every channel that records no delivery outcome — so an agent
   * cannot report an SMS as received.
   */
  'easy_com.messages': (args, context) =>
    readViaMcp(
      context,
      'communication.messages',
      given({
        channel: text(args.channel),
        student_id: count(args.student_id),
        search_text: text(args.search_text ?? args.query),
        from_date: text(args.from_date),
        to_date: text(args.to_date),
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  'easy_com.channels': (args, context) =>
    readViaMcp(
      context,
      'communication.channels',
      given({ from_date: text(args.from_date), to_date: text(args.to_date) }),
    ).then((output) => ({ output })),

  /**
   * A message to families, for a person to review before sending.
   *
   * Says only what it was given. Sending reaches every family in a class, so this
   * produces text and stops — and it states no date, deadline or instruction that was not
   * supplied, because a circular-style message is the school speaking and a detail nobody
   * supplied would be the school saying something it did not decide.
   */
  'easy_com.draft_message': (args) => {
    const audience = text(args.audience, 'parents');
    const subject = text(args.subject, 'A message from the school');
    const points = list(args.points);
    const action = text(args.action_required);
    const contact = text(args.contact);
    const channel = text(args.channel, 'sms').toLowerCase();

    // An SMS is read on a phone and is charged by length, so the same content is written
    // tighter for it. The channel changes the shape, never the facts.
    const brief = channel === 'sms';

    const body = points.length
      ? brief
        ? points.join(' ')
        : points.map((point) => `• ${point}`).join('\n')
      : '';

    const lines = brief
      ? [subject, body, action ? `Please ${action}.` : '', contact ? `Contact: ${contact}` : '']
      : [
          'Dear Parent,',
          '',
          subject,
          body,
          '',
          action ? `What to do: ${action}` : '',
          contact ? `Questions: ${contact}` : '',
          '',
          'Regards,',
          'School Office',
        ];

    const message = lines
      .filter(Boolean)
      .filter((line, index, all) => !(line === '' && all[index - 1] === ''))
      .join(brief ? ' ' : '\n')
      .trim();

    return {
      output: {
        subject,
        audience,
        channel: brief ? 'sms' : channel,
        message,
        point_count: points.length,
        word_count: wordCount(message),
        // A real constraint on the channel this may be sent over, reported so a reviewer
        // can see it rather than discovering it at send time.
        character_count: message.length,
        sends: false,
        schedules: false,
      },
    };
  },

  // ---- Time Table ---------------------------------------------------------

  'timetable.schedule': (args, context) =>
    readViaMcp(
      context,
      'timetable.schedule',
      given({
        standard_id: count(args.standard_id ?? args.class_id),
        division_id: count(args.division_id ?? args.section_id),
        teacher_id: count(args.teacher_id),
        subject_id: count(args.subject_id),
        period_id: count(args.period_id),
        week_day: text(args.week_day ?? args.day),
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  /**
   * Clashes. Backed by `timetable.conflicts`, which finds the one conflict the table can
   * prove — a teacher in two different classes at once — and says so, so an agent does
   * not go on to judge whether a timetable is balanced.
   */
  'timetable.conflicts': (args, context) =>
    readViaMcp(
      context,
      'timetable.conflicts',
      given({
        teacher_id: count(args.teacher_id),
        week_day: text(args.week_day ?? args.day),
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  // ---- Student Medical ----------------------------------------------------
  //
  // Four reads and no drafter. See the registry entries for why nothing here writes text.

  'student_medical.visits': (args, context) =>
    readViaMcp(
      context,
      'student_medical.visits',
      given({
        student_id: count(args.student_id),
        from_date: text(args.from_date),
        to_date: text(args.to_date),
        open_only: typeof args.open_only === 'boolean' ? args.open_only : undefined,
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  'student_medical.vaccinations': (args, context) =>
    readViaMcp(
      context,
      'student_medical.vaccinations',
      given({
        student_id: count(args.student_id),
        vaccination_type: text(args.vaccination_type ?? args.type),
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  'student_medical.growth': (args, context) =>
    readViaMcp(
      context,
      'student_medical.growth',
      given({
        student_id: count(args.student_id),
        from_date: text(args.from_date),
        to_date: text(args.to_date),
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  'student_medical.health_records': (args, context) =>
    readViaMcp(
      context,
      'student_medical.health_records',
      given({ student_id: count(args.student_id), limit: count(args.limit) }),
    ).then((output) => ({ output })),

  // ---- Inward -------------------------------------------------------------

  'inward.register': (args, context) =>
    readViaMcp(
      context,
      'inward.register',
      given({
        place_id: count(args.place_id),
        file_location_id: count(args.file_location_id ?? args.file_id),
        from_date: text(args.from_date),
        to_date: text(args.to_date),
        search_text: text(args.search_text ?? args.search ?? args.query),
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  /**
   * The register's own gaps. Backed by `inward.unfiled`, which reports where a record is
   * missing a file location or a scan and says plainly that this is not a status — the
   * table has none — so an agent does not go on to call anything overdue.
   */
  'inward.unfiled': (args, context) =>
    readViaMcp(
      context,
      'inward.unfiled',
      given({
        gap: text(args.gap),
        place_id: count(args.place_id),
        from_date: text(args.from_date),
        to_date: text(args.to_date),
        search_text: text(args.search_text ?? args.search),
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  // ---- User I-Card --------------------------------------------------------
  //
  // Both reads go to a service that selects an explicit column list, so no argument an
  // agent can construct reaches a payroll or government identity column.

  'user_icard.roster': (args, context) =>
    readViaMcp(
      context,
      'user_icard.roster',
      given({
        user_profile_id: count(args.user_profile_id ?? args.profile_id),
        department_id: count(args.department_id),
        missing_photo_only:
          typeof args.missing_photo_only === 'boolean' ? args.missing_photo_only : undefined,
        account_expired_only:
          typeof args.account_expired_only === 'boolean' ? args.account_expired_only : undefined,
        search_text: text(args.search_text ?? args.search ?? args.name),
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  'user_icard.card_details': (args, context) =>
    readViaMcp(
      context,
      'user_icard.card_details',
      // The tool takes `staff_id` and nothing else; `user_id` is accepted here only as an
      // input alias, because an agent asked to "read the card for user 41" will phrase it
      // that way. What goes over the wire is the name the schema declares.
      given({ staff_id: count(args.staff_id ?? args.user_id ?? args.employee_id) }),
    ).then((output) => ({ output })),

  // ---- Petty Cash ---------------------------------------------------------

  'petty_cash.transactions': (args, context) =>
    readViaMcp(
      context,
      'petty_cash.transactions',
      given({
        title_id: count(args.title_id ?? args.head_id),
        from_date: text(args.from_date),
        to_date: text(args.to_date),
        min_amount: typeof args.min_amount === 'number' ? args.min_amount : undefined,
        without_bill_only:
          typeof args.without_bill_only === 'boolean' ? args.without_bill_only : undefined,
        search_text: text(args.search_text ?? args.search),
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  /**
   * Totals by head and month. Backed by `petty_cash.summary` so the arithmetic is done in
   * SQL over the whole filtered set — an agent that added up a page of rows would report
   * a month's spending as a page's.
   */
  'petty_cash.summary': (args, context) =>
    readViaMcp(
      context,
      'petty_cash.summary',
      given({
        title_id: count(args.title_id ?? args.head_id),
        from_date: text(args.from_date),
        to_date: text(args.to_date),
        min_amount: typeof args.min_amount === 'number' ? args.min_amount : undefined,
        search_text: text(args.search_text ?? args.search),
      }),
    ).then((output) => ({ output })),

  // ---- Consent ------------------------------------------------------------

  'consent.records': (args, context) =>
    readViaMcp(
      context,
      'consent.records',
      given({
        student_id: count(args.student_id),
        standard_id: count(args.standard_id ?? args.class_id),
        division_id: count(args.division_id ?? args.section_id),
        decision: text(args.decision ?? args.state),
        accountable_status: text(args.accountable_status),
        from_date: text(args.from_date),
        to_date: text(args.to_date),
        search_text: text(args.search_text ?? args.search),
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  'consent.summary': (args, context) =>
    readViaMcp(
      context,
      'consent.summary',
      given({
        standard_id: count(args.standard_id ?? args.class_id),
        division_id: count(args.division_id ?? args.section_id),
        decision: text(args.decision ?? args.state),
        from_date: text(args.from_date),
        to_date: text(args.to_date),
      }),
    ).then((output) => ({ output })),

  /**
   * A reminder asking a family to answer a consent.
   *
   * Local, like every drafter here: it composes text from what it was given and touches
   * no record. What it will not do is the point — there is no parameter for "they
   * refused", and the wording never suggests the family has ignored anything, because the
   * only thing known about them is that no answer has been recorded.
   */
  'consent.draft_reminder': (args) => {
    const consent = text(args.consent_title, 'a consent form');
    const consentDate = text(args.consent_date);
    const className = text(args.class_name);
    const respondBy = text(args.respond_by);
    const contact = text(args.contact);
    const channel = text(args.channel, 'sms').toLowerCase();

    const brief = channel === 'sms';

    const subject = className
      ? `Consent still needed: ${consent} (${className})`
      : `Consent still needed: ${consent}`;

    // Every line is conditional on having been given the fact. A reminder that invented a
    // deadline would be asking a family to meet one the school never set.
    const lines = brief
      ? [
          subject,
          consentDate ? `Raised ${consentDate}.` : '',
          'We have not received your response yet.',
          respondBy ? `Please respond by ${respondBy}.` : 'Please respond when you can.',
          contact ? `Contact: ${contact}` : '',
        ]
      : [
          'Dear Parent,',
          '',
          `We are writing about ${consent}${className ? ` for ${className}` : ''}${
            consentDate ? `, raised on ${consentDate}` : ''
          }.`,
          '',
          'Our records do not yet show a response from you.',
          respondBy ? `Please let us know by ${respondBy}.` : 'Please let us know when you can.',
          contact ? `If you have any questions, contact ${contact}.` : '',
          '',
          'Regards,',
          'School Office',
        ];

    const message = lines
      .filter(Boolean)
      .filter((line, index, all) => !(line === '' && all[index - 1] === ''))
      .join(brief ? ' ' : '\n')
      .trim();

    return {
      output: {
        subject,
        message,
        channel,
        word_count: wordCount(message),
        character_count: message.length,
        // Stated in the output so a reviewer sees it without reading the code.
        asserts_refusal: false,
        deadline_stated: respondBy !== '',
        sends: false,
        schedules: false,
      },
    };
  },

  // ---- Visitor Management -------------------------------------------------

  'visitor.visits': (args, context) =>
    readViaMcp(
      context,
      'visitor.visits',
      given({
        visitor_type_id: count(args.visitor_type_id ?? args.visitor_type),
        appointment_type: text(args.appointment_type),
        from_date: text(args.from_date ?? args.date),
        to_date: text(args.to_date ?? args.date),
        search_text: text(args.search_text ?? args.search ?? args.name),
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  /**
   * Visits with no exit recorded. Backed by `visitor.without_exit`, whose payload says in
   * its own rule that this is not a list of people on the premises and reports how many
   * rows are from a day already past — so an agent has the counter-evidence in hand rather
   * than having to know it.
   */
  'visitor.without_exit': (args, context) =>
    readViaMcp(
      context,
      'visitor.without_exit',
      given({
        visitor_type_id: count(args.visitor_type_id ?? args.visitor_type),
        from_date: text(args.from_date ?? args.date),
        to_date: text(args.to_date ?? args.date),
        search_text: text(args.search_text ?? args.search),
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  // ---- Transport ----------------------------------------------------------

  'transport.routes': (args, context) =>
    readViaMcp(
      context,
      'transport.routes',
      given({
        route_id: count(args.route_id),
        search_text: text(args.search_text ?? args.search ?? args.route_name),
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  /**
   * Seats against assignments. The service counts the morning and afternoon legs
   * separately and says so in the payload's rule, because adding them is the one mistake
   * that turns a full bus into an emergency.
   */
  'transport.vehicles': (args, context) =>
    readViaMcp(
      context,
      'transport.vehicles',
      given({
        vehicle_id: count(args.vehicle_id ?? args.bus_id),
        search_text: text(args.search_text ?? args.search ?? args.vehicle_number),
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  'transport.assignments': (args, context) =>
    readViaMcp(
      context,
      'transport.assignments',
      given({
        student_id: count(args.student_id),
        vehicle_id: count(args.vehicle_id ?? args.bus_id),
        stop_id: count(args.stop_id),
        search_text: text(args.search_text ?? args.search),
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  /**
   * A notice about a route, stop or timing.
   *
   * Local and inert. It labels a scheduled time as scheduled in the text itself, so the
   * distinction survives being pasted into a message by somebody who did not read the
   * tool's rule.
   */
  'transportation.draft_notice': (args) => {
    const route = text(args.route_name, 'your child’s bus route');
    const change = text(args.change);
    const effectiveFrom = text(args.effective_from);
    const stop = text(args.stop_name);
    const contact = text(args.contact);
    const channel = text(args.channel, 'sms').toLowerCase();

    const brief = channel === 'sms';
    const subject = `Transport notice: ${route}`;

    const lines = brief
      ? [
          subject,
          change,
          stop ? `Stop: ${stop}.` : '',
          effectiveFrom ? `From ${effectiveFrom}.` : '',
          contact ? `Contact: ${contact}` : '',
        ]
      : [
          'Dear Parent,',
          '',
          `This is a notice about ${route}.`,
          change,
          stop ? `Stop: ${stop}` : '',
          effectiveFrom ? `Effective from: ${effectiveFrom}` : '',
          '',
          // Said in the message, not only in the tool's rule: the person pasting this
          // into a send screen is not the person who read the rule.
          'Times shown are the published schedule.',
          contact ? `Questions: ${contact}` : '',
          '',
          'Regards,',
          'School Office',
        ];

    const message = lines
      .filter(Boolean)
      .filter((line, index, all) => !(line === '' && all[index - 1] === ''))
      .join(brief ? ' ' : '\n')
      .trim();

    return {
      output: {
        subject,
        message,
        channel,
        word_count: wordCount(message),
        character_count: message.length,
        states_arrival_time: false,
        sends: false,
        schedules: false,
      },
    };
  },

  // ---- Inventory ----------------------------------------------------------

  'inventory.items': (args, context) =>
    readViaMcp(
      context,
      'inventory.items',
      given({
        category_id: count(args.category_id),
        sub_category_id: count(args.sub_category_id),
        item_type_id: count(args.item_type_id),
        item_id: count(args.item_id),
        at_or_below_minimum_only:
          typeof args.at_or_below_minimum_only === 'boolean' ? args.at_or_below_minimum_only : undefined,
        search_text: text(args.search_text ?? args.search ?? args.item),
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  'inventory.requisitions': (args, context) =>
    readViaMcp(
      context,
      'inventory.requisitions',
      given({
        item_id: count(args.item_id),
        department_id: count(args.department_id),
        status: text(args.status),
        from_date: text(args.from_date),
        to_date: text(args.to_date),
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  'inventory.purchase_orders': (args, context) =>
    readViaMcp(
      context,
      'inventory.purchase_orders',
      given({
        item_id: count(args.item_id),
        vendor_id: count(args.vendor_id),
        po_number: text(args.po_number ?? args.po),
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  // ---- Front Desk ---------------------------------------------------------
  //
  // The service applies the non-admin restriction from the caller's own token, so an agent
  // cannot widen it by any argument it constructs here.

  'front_desk.visits': (args, context) =>
    readViaMcp(
      context,
      'front_desk.visits',
      given({
        student_id: count(args.student_id),
        staff_id: count(args.staff_id ?? args.to_meet ?? args.user_id),
        visitor_type: text(args.visitor_type),
        from_date: text(args.from_date ?? args.date),
        to_date: text(args.to_date ?? args.date),
        search_text: text(args.search_text ?? args.search),
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  // ---- Task Management ----------------------------------------------------

  'tasks.list': (args, context) =>
    readViaMcp(
      context,
      'tasks.list',
      given({
        state: text(args.state ?? args.status),
        assigned_to: count(args.assigned_to ?? args.assignee_id ?? args.user_id),
        allocated_by: count(args.allocated_by ?? args.allocator_id),
        task_type: text(args.task_type),
        from_date: text(args.from_date),
        to_date: text(args.to_date),
        search_text: text(args.search_text ?? args.search),
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  /**
   * Overdue tasks. Backed by `tasks.overdue`, which normalises both spellings of
   * "complete" before it decides — an agent filtering on the raw word would leave the two
   * `COMPLETED` rows in the list forever.
   */
  'tasks.overdue': (args, context) =>
    readViaMcp(
      context,
      'tasks.overdue',
      given({
        assigned_to: count(args.assigned_to ?? args.assignee_id ?? args.user_id),
        allocated_by: count(args.allocated_by),
        task_type: text(args.task_type),
        search_text: text(args.search_text ?? args.search),
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  'tasks.projects': (args, context) =>
    readViaMcp(
      context,
      'tasks.projects',
      given({ project_id: count(args.project_id), limit: count(args.limit) }),
    ).then((output) => ({ output })),

  // ---- Complaint ----------------------------------------------------------

  'complaints.list': (args, context) =>
    readViaMcp(
      context,
      'complaints.list',
      given({
        state: text(args.state ?? args.status),
        user_group_id: count(args.user_group_id ?? args.group_id ?? args.department_id),
        raised_by: count(args.raised_by ?? args.complaint_by),
        from_date: text(args.from_date),
        to_date: text(args.to_date),
        search_text: text(args.search_text ?? args.search),
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  'complaints.summary': (args, context) =>
    readViaMcp(
      context,
      'complaints.summary',
      given({
        user_group_id: count(args.user_group_id ?? args.group_id),
        from_date: text(args.from_date),
        to_date: text(args.to_date),
      }),
    ).then((output) => ({ output })),

  // ---- Utility ------------------------------------------------------------

  'utility.custom_modules': (args, context) =>
    readViaMcp(
      context,
      'utility.custom_modules',
      given({
        module_type: text(args.module_type ?? args.type),
        search_text: text(args.search_text ?? args.search),
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  /**
   * Rollover scope. Takes no arguments at all: the institute, the client and the year come
   * from the caller's token, and there is nothing here a caller could widen.
   */
  'utility.rollover_scope': (_args, context) =>
    readViaMcp(context, 'utility.rollover_scope', {}).then((output) => ({ output })),

  // ---- Document Templates -------------------------------------------------

  'doc_templates.list': (args, context) =>
    readViaMcp(
      context,
      'doc_templates.list',
      given({
        status: text(args.status),
        category: text(args.category),
        search_text: text(args.search_text ?? args.search ?? args.name),
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  'doc_templates.versions': (args, context) =>
    readViaMcp(
      context,
      'doc_templates.versions',
      given({ template_id: count(args.template_id ?? args.id), limit: count(args.limit) }),
    ).then((output) => ({ output })),

  /**
   * A draft template body.
   *
   * Local, like every drafter here: it composes text from what it was given and touches no
   * record. The merge fields it emits are the ones it was handed — it invents none, which
   * matters because a placeholder that does not resolve renders as literal `{{…}}` in a
   * letter that goes to a family.
   */
  'document-templates.draft_content': (args) => {
    const name = text(args.template_name, 'Untitled template');
    const purpose = text(args.purpose);
    const sections = list(args.sections);
    const fields = list(args.merge_fields);
    const closing = text(args.closing);

    // Normalised to the `{{field}}` form the renderer expects, from whatever shape the
    // caller used. Nothing is added to the list.
    const placeholders = fields
      .map((field) => field.replace(/[{}\s]/g, ''))
      .filter(Boolean)
      .map((field) => `{{${field}}}`);

    const body = [
      name,
      '',
      purpose,
      '',
      ...sections.map((section) => section),
      '',
      placeholders.length ? `Fields this draft uses: ${placeholders.join(', ')}` : '',
      '',
      closing,
    ]
      .filter((line, index, all) => !(line === '' && all[index - 1] === ''))
      .join('\n')
      .trim();

    return {
      output: {
        template_name: name,
        draft: body,
        section_count: sections.length,
        merge_fields: placeholders,
        // Stated in the output so a reviewer sees it without reading the code.
        invents_merge_fields: false,
        saves: false,
        publishes: false,
      },
    };
  },

  // ---- Parent Communication -----------------------------------------------

  'parent_communication.messages': (args, context) =>
    readViaMcp(
      context,
      'parent_communication.messages',
      given({
        student_id: count(args.student_id),
        message_id: count(args.message_id),
        state: text(args.state),
        from_date: text(args.from_date),
        to_date: text(args.to_date),
        search_text: text(args.search_text ?? args.search ?? args.title),
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  'parent_communication.summary': (args, context) =>
    readViaMcp(
      context,
      'parent_communication.summary',
      given({ from_date: text(args.from_date), to_date: text(args.to_date) }),
    ).then((output) => ({ output })),

  /**
   * A reply to one parent.
   *
   * Local and inert. What it will not do is the point: there is no parameter for a
   * decision, a date or an outcome, so it cannot promise anything the school has not
   * decided — and it cannot apologise for something it was not told happened.
   */
  'parent_communication.draft_reply': (args) => {
    const subject = text(args.subject, 'your message');
    const acknowledge = text(args.acknowledge);
    const points = list(args.points);
    const nextStep = text(args.next_step);
    const contact = text(args.contact);

    const lines = [
      'Dear Parent,',
      '',
      acknowledge || `Thank you for writing to us about ${subject}.`,
      '',
      ...points.map((point) => `• ${point}`),
      '',
      nextStep ? `What happens next: ${nextStep}` : '',
      contact ? `If you would like to discuss this further, please contact ${contact}.` : '',
      '',
      'Regards,',
      'School Office',
    ];

    const message = lines
      .filter(Boolean)
      .filter((line, index, all) => !(line === '' && all[index - 1] === ''))
      .join('\n')
      .trim();

    return {
      output: {
        subject,
        message,
        point_count: points.length,
        word_count: wordCount(message),
        // Stated in the output so a reviewer sees it without reading the code.
        states_a_decision: nextStep !== '',
        sends: false,
        schedules: false,
      },
    };
  },

  // ---- Quality assurance (SQAA) -------------------------------------------

  'sqaa.criteria': (args, context) =>
    readViaMcp(
      context,
      'sqaa.criteria',
      given({
        level: count(args.level),
        parent_id: count(args.parent_id),
        search_text: text(args.search_text ?? args.search),
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  'sqaa.evidence': (args, context) =>
    readViaMcp(
      context,
      'sqaa.evidence',
      given({
        menu_id: count(args.menu_id ?? args.criterion_id),
        search_text: text(args.search_text ?? args.search),
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  // ---- Users --------------------------------------------------------------

  'user_accounts.directory': (args, context) =>
    readViaMcp(
      context,
      'user_accounts.directory',
      given({
        user_profile_id: count(args.user_profile_id ?? args.profile_id),
        department_id: count(args.department_id),
        include_inactive: typeof args.include_inactive === 'boolean' ? args.include_inactive : undefined,
        never_logged_in_only:
          typeof args.never_logged_in_only === 'boolean' ? args.never_logged_in_only : undefined,
        administrators_only:
          typeof args.administrators_only === 'boolean' ? args.administrators_only : undefined,
        search_text: text(args.search_text ?? args.search ?? args.name),
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  // ---- Library ------------------------------------------------------------

  'library.catalogue': (args, context) =>
    readViaMcp(
      context,
      'library.catalogue',
      given({
        language: text(args.language),
        classification: text(args.classification),
        search_text: text(args.search_text ?? args.search ?? args.title ?? args.author),
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  /**
   * Loans. Backed by `library.circulation`, which decides overdue from a recorded due date
   * and a missing return date — an agent filtering on dates itself would count the undated
   * loans as overdue.
   */
  'library.circulation': (args, context) =>
    readViaMcp(
      context,
      'library.circulation',
      given({
        state: text(args.state),
        student_id: count(args.student_id ?? args.borrower_id),
        book_id: count(args.book_id ?? args.title_id),
        from_date: text(args.from_date),
        to_date: text(args.to_date),
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

  // ---- Learning (LMS) -----------------------------------------------------

  'lms.courses': (args, context) =>
    readViaMcp(
      context,
      'lms.courses',
      given({ search_text: text(args.search_text ?? args.search), limit: count(args.limit) }),
    ).then((output) => ({ output })),

  'lms.activities': (args, context) =>
    readViaMcp(context, 'lms.activities', given({ limit: count(args.limit) })).then((output) => ({ output })),

  // ---- Institute ----------------------------------------------------------

  'academics.structure': (args, context) =>
    readViaMcp(context, 'academics.structure', given({ limit: count(args.limit) })).then((output) => ({ output })),

  'hr.departments': (_args, context) =>
    readViaMcp(context, 'hr.departments', {}).then((output) => ({ output })),

  'shared.compose_note': (args) => {
    const heading = text(args.heading, 'Note');
    const points = list(args.points);
    const message = [heading, '', ...points.map((point) => `• ${point}`)].join('\n').trim();

    return { output: { heading, message, point_count: points.length, word_count: wordCount(message), sends: false } };
  },
};

export function hasExecutor(toolKey: string): boolean {
  return Boolean(EXECUTORS[toolKey]);
}

/**
 * Run one tool. Throws for a tool the registry does not know or does not mark
 * available — the engine treats that as a failed run and logs it as such.
 *
 * Async because a `read` executor calls the backend. A `draft` executor still
 * returns synchronously and is simply awaited, so nothing about it changed.
 */
export async function executeTool(
  toolKey: string,
  args: Record<string, unknown>,
  context: ToolContext = {},
): Promise<ToolExecution> {
  const tool = findTool(toolKey);
  if (!tool) throw new Error(`Unknown tool "${toolKey}".`);
  const executor = EXECUTORS[toolKey];
  if (!tool.available || !executor) throw new Error(`"${tool.label}" has no executor yet.`);
  return executor(args, context);
}
