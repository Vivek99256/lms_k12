import { findTool } from './registry';

/**
 * v1 tool executors.
 *
 * Every tool marked `available: true` in the registry has an entry here, and
 * nothing else does — `validateToolsForModule` guarantees an agent's allow-list
 * only names tools this table can run.
 *
 * THESE ARE DELIBERATELY NOT A MODEL. A v1 executor is a template that turns the
 * caller's arguments into text, so the engine, the run log, the RBAC gate and the
 * module scoping can all be exercised end to end without any AI in the loop.
 * When the governed lifecycle takes over drafting, it replaces the body of an
 * executor; the engine around it does not change. Every v1 executor is `draft`
 * risk: it returns text and changes no record.
 */

export interface ToolExecution {
  output: Record<string, unknown>;
}

type Executor = (args: Record<string, unknown>) => ToolExecution;

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
 */
export function executeTool(toolKey: string, args: Record<string, unknown>): ToolExecution {
  const tool = findTool(toolKey);
  if (!tool) throw new Error(`Unknown tool "${toolKey}".`);
  const executor = EXECUTORS[toolKey];
  if (!tool.available || !executor) throw new Error(`"${tool.label}" has no executor yet.`);
  return executor(args);
}
