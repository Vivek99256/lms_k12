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
   * Who owes fees, from the fee records themselves.
   *
   * Backed by `fees.arrears`, which reports `students_checked` and `cohort_size`
   * alongside the defaulters so a bounded sweep is never presented as a school-wide
   * figure. The agent passes that straight through rather than summarising it away.
   */
  'fees.list_defaulters': (args, context) =>
    readViaMcp(
      context,
      'fees.arrears',
      given({
        standard_id: count(args.standard_id ?? args.class_id),
        section_id: count(args.section_id),
        min_amount: typeof args.min_amount === 'number' ? args.min_amount : count(args.min_amount),
        limit: count(args.limit),
      }),
    ).then((output) => ({ output })),

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
