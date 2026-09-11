import type { CronSchedule } from './types';

/**
 * The five-field cron the Scheduler screen edits, parsed once and used three
 * ways: to refuse an unusable expression at save time, to say in words what an
 * expression means, and to work out when a task will next run.
 *
 * WHY NOT A LIBRARY. The dependency would earn its place if this had to *fire*
 * jobs — timezones, drift, missed ticks, all of it. It does not: the backend
 * fires, and this layer only needs to agree with the operator about what they
 * typed. Parsing five fields of `*`, `n`, `a,b`, `a-b` and `a-b/n` is a small,
 * fully testable amount of code, and keeping it here means the validation the
 * screen shows and the validation the API enforces cannot drift apart.
 *
 * NEXT RUN IS COMPUTED, NEVER STORED. A stored next-run goes stale the moment
 * anyone edits the schedule, and a stale timestamp on an administration screen
 * is worse than none — it looks like an answer.
 *
 * THE DAY RULE IS STANDARD CRON, INCLUDING ITS ODDITY: when day-of-month and
 * day-of-week are both restricted, a day matching *either* runs. `0 9 1 * 1`
 * means the 1st of the month AND every Monday, not "Mondays that fall on the
 * 1st". It surprises people, so `describeSchedule` says it out loud.
 */

export interface CronField {
  name: keyof CronSchedule;
  label: string;
  min: number;
  max: number;
}

export const CRON_FIELDS: CronField[] = [
  { name: 'minute', label: 'Minute', min: 0, max: 59 },
  { name: 'hour', label: 'Hour', min: 0, max: 23 },
  { name: 'day', label: 'Day of month', min: 1, max: 31 },
  { name: 'month', label: 'Month', min: 1, max: 12 },
  { name: 'day_of_week', label: 'Day of week', min: 0, max: 6 },
];

export class CronError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CronError';
  }
}

/**
 * Expand one field to the values it matches.
 *
 * Throws with the field's own name in the message, because "Minute: 61 is above
 * 59" tells an operator where to look and "invalid cron" does not.
 */
export function expandField(expression: string, field: CronField): number[] {
  const raw = (expression ?? '').trim();
  if (!raw) throw new CronError(`${field.label} cannot be empty. Use * for every value.`);

  const values = new Set<number>();

  for (const part of raw.split(',')) {
    const piece = part.trim();
    if (!piece) throw new CronError(`${field.label} has an empty entry in its list.`);

    const [rangePart, stepPart, ...extra] = piece.split('/');
    if (extra.length) throw new CronError(`${field.label}: "${piece}" has more than one step.`);

    let step = 1;
    if (stepPart !== undefined) {
      step = Number(stepPart);
      if (!Number.isInteger(step) || step < 1) throw new CronError(`${field.label}: the step in "${piece}" must be a whole number of 1 or more.`);
    }

    let start: number;
    let end: number;
    const range = rangePart.trim();

    if (range === '*') {
      start = field.min;
      end = field.max;
    } else if (range.includes('-')) {
      const [from, to] = range.split('-');
      start = Number(from);
      end = Number(to);
      if (!Number.isInteger(start) || !Number.isInteger(end)) throw new CronError(`${field.label}: "${range}" is not a range of whole numbers.`);
      if (start > end) throw new CronError(`${field.label}: "${range}" runs backwards.`);
    } else {
      start = Number(range);
      end = start;
      if (!Number.isInteger(start)) throw new CronError(`${field.label}: "${range}" is not a whole number.`);
    }

    if (start < field.min || end > field.max) {
      throw new CronError(`${field.label}: "${range}" is outside ${field.min}–${field.max}.`);
    }

    for (let value = start; value <= end; value += step) values.add(value);
  }

  return [...values].sort((a, b) => a - b);
}

export interface ParsedSchedule {
  minute: number[];
  hour: number[];
  day: number[];
  month: number[];
  day_of_week: number[];
  /** True when the field was left as `*` — needed for the day-of-month / day-of-week rule. */
  dayRestricted: boolean;
  dowRestricted: boolean;
}

export function parseSchedule(schedule: CronSchedule): ParsedSchedule {
  const parsed = {} as Record<keyof CronSchedule, number[]>;
  for (const field of CRON_FIELDS) parsed[field.name] = expandField(schedule[field.name], field);

  return {
    minute: parsed.minute,
    hour: parsed.hour,
    day: parsed.day,
    month: parsed.month,
    day_of_week: parsed.day_of_week,
    dayRestricted: (schedule.day ?? '').trim() !== '*',
    dowRestricted: (schedule.day_of_week ?? '').trim() !== '*',
  };
}

/** Throws the first problem, or returns nothing. Used by the service before a save. */
export function assertValidSchedule(schedule: CronSchedule): void {
  parseSchedule(schedule);
}

/** The problem as a string, or null. Used by the screen while the operator types. */
export function scheduleProblem(schedule: CronSchedule): string | null {
  try {
    parseSchedule(schedule);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'That schedule cannot be read.';
  }
}

function matchesDay(parsed: ParsedSchedule, date: Date): boolean {
  if (!parsed.month.includes(date.getMonth() + 1)) return false;

  const dayHit = parsed.day.includes(date.getDate());
  const dowHit = parsed.day_of_week.includes(date.getDay());

  // Standard cron: restricted on both means either matches; otherwise the
  // restricted one decides and the `*` one always agrees.
  if (parsed.dayRestricted && parsed.dowRestricted) return dayHit || dowHit;
  if (parsed.dayRestricted) return dayHit;
  if (parsed.dowRestricted) return dowHit;
  return true;
}

/**
 * The next moment this schedule fires, at or after `from`.
 *
 * Walks forward a day at a time and only looks at hours and minutes on days that
 * match — a minute-by-minute walk would be 525,600 steps for a yearly task.
 * Gives up after four years, which only a schedule that can never fire reaches
 * (29 February in a month that has no 29th, say); null is the honest answer
 * there, and the screen says so rather than showing a date that will not happen.
 */
export function nextRunAt(schedule: CronSchedule, from: Date = new Date()): Date | null {
  let parsed: ParsedSchedule;
  try {
    parsed = parseSchedule(schedule);
  } catch {
    return null;
  }

  // Start at the next whole minute: a task due at 09:00 is not "due now" at 09:00:30.
  const cursor = new Date(from.getTime());
  cursor.setSeconds(0, 0);
  cursor.setMinutes(cursor.getMinutes() + 1);

  const startOfSearchDay = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());

  for (let dayOffset = 0; dayOffset < 366 * 4; dayOffset += 1) {
    const day = new Date(startOfSearchDay.getTime());
    day.setDate(day.getDate() + dayOffset);
    if (!matchesDay(parsed, day)) continue;

    const isFirstDay = dayOffset === 0;
    for (const hour of parsed.hour) {
      if (isFirstDay && hour < cursor.getHours()) continue;
      for (const minute of parsed.minute) {
        if (isFirstDay && hour === cursor.getHours() && minute < cursor.getMinutes()) continue;
        return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute, 0, 0);
      }
    }
  }

  return null;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function joinWords(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function timesOfDay(parsed: ParsedSchedule, schedule: CronSchedule): string {
  const everyMinute = parsed.minute.length === 60;
  const everyHour = parsed.hour.length === 24;

  if (everyMinute && everyHour) return 'every minute';
  if (everyMinute) return `every minute during ${joinWords(parsed.hour.map((hour) => `${String(hour).padStart(2, '0')}:00`))}`;

  const stepped = /^\*\/(\d+)$/.exec((schedule.minute ?? '').trim());
  if (stepped && everyHour) return `every ${stepped[1]} minutes`;
  if (stepped) return `every ${stepped[1]} minutes during ${joinWords(parsed.hour.map((hour) => `${String(hour).padStart(2, '0')}:00`))}`;

  if (everyHour) return `every hour at ${joinWords(parsed.minute.map((minute) => `:${String(minute).padStart(2, '0')}`))}`;

  const times: string[] = [];
  for (const hour of parsed.hour) {
    for (const minute of parsed.minute) {
      times.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
      if (times.length >= 6) return `${joinWords(times)} and other times`;
    }
  }
  return `at ${joinWords(times)}`;
}

/** The schedule as a sentence, for the row beneath the five inputs. */
export function describeSchedule(schedule: CronSchedule): string {
  let parsed: ParsedSchedule;
  try {
    parsed = parseSchedule(schedule);
  } catch (error) {
    return error instanceof Error ? error.message : 'That schedule cannot be read.';
  }

  const when = timesOfDay(parsed, schedule);

  const days: string[] = [];
  if (parsed.dowRestricted) {
    days.push(`on ${joinWords(parsed.day_of_week.map((day) => DAY_NAMES[day]))}`);
  }
  if (parsed.dayRestricted) {
    days.push(`on day ${joinWords(parsed.day.map(String))} of the month`);
  }
  const months = parsed.month.length === 12 ? '' : ` in ${joinWords(parsed.month.map((month) => MONTH_NAMES[month - 1]))}`;

  if (!days.length) return `Runs ${when}, every day${months}.`;

  // Say the OR out loud — this is the rule operators get wrong.
  const dayPart = days.length === 2 ? `${days[0]} or ${days[1]}` : days[0];
  return `Runs ${when} ${dayPart}${months}.`;
}

/** `0 9 * * 1-5`, for the mono column that shows the raw expression. */
export function scheduleToString(schedule: CronSchedule): string {
  return [schedule.minute, schedule.hour, schedule.day, schedule.month, schedule.day_of_week]
    .map((part) => (part ?? '').trim() || '*')
    .join(' ');
}

export function schedulesEqual(a: CronSchedule, b: CronSchedule): boolean {
  return scheduleToString(a) === scheduleToString(b);
}
