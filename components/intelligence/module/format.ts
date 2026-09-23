import type { ValueFormat } from './payload';

/**
 * Value formatting for every Intelligence screen.
 *
 * Generalised from `app/fees/intelligence/_components/fees-intelligence-primitives.tsx`,
 * which hard-coded rupees because it only ever had to render money. Result
 * renders students and percentages, Attendance renders sessions, Library
 * renders days overdue — so the unit travels with the value (see payload.ts)
 * and this module reads it.
 *
 * ── THE ONE RULE ────────────────────────────────────────────────────────────
 *
 * NULL RENDERS AS AN EM DASH, NEVER AS ZERO. A collection rate over no demand,
 * a pass rate over no candidates, an average over an empty set — all undefined,
 * none of them zero. Substituting a zero reports catastrophic performance where
 * there is simply no denominator, and that single substitution is the most
 * common way an honest pipeline turns into a misleading dashboard.
 */

export const EM_DASH = '—';

const compact = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 });
const plain = new Intl.NumberFormat('en-IN');

/** Memoised, because `Intl.NumberFormat` construction is not cheap in a table. */
const currencyFormatters = new Map<string, Intl.NumberFormat>();

function currencyFormatter(currency: string): Intl.NumberFormat {
  let formatter = currencyFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    });
    currencyFormatters.set(currency, formatter);
  }
  return formatter;
}

function isMissing(value: number | null | undefined): value is null | undefined {
  return value === null || value === undefined || !Number.isFinite(value);
}

/**
 * Money at a glance: ₹38.3L, ₹1.2Cr, ₹42,101.
 *
 * The lakh/crore compaction is applied only to INR, which is the grouping
 * Indian readers expect and the one `App\Brain\Intelligence\Narrative::money()`
 * produces on the backend — so a figure rendered from a payload string and the
 * same figure rendered from a number read identically on one screen. Any other
 * currency falls through to the locale's own compact notation rather than being
 * mislabelled in lakhs.
 */
export function money(amount: number | null | undefined, currency = 'INR'): string {
  if (isMissing(amount)) return EM_DASH;

  if (currency === 'INR') {
    if (Math.abs(amount) >= 10000000) return `₹${compact.format(amount / 10000000)}Cr`;
    if (Math.abs(amount) >= 100000) return `₹${compact.format(amount / 100000)}L`;
  }

  return currencyFormatter(currency).format(amount);
}

/** Exact amount, for tooltips and drill-downs where the rounded form is not enough. */
export function moneyExact(amount: number | null | undefined, currency = 'INR'): string {
  if (isMissing(amount)) return EM_DASH;
  return currencyFormatter(currency).format(amount);
}

/** A percentage, or an em dash. See THE ONE RULE above. */
export function percent(value: number | null | undefined, digits = 1): string {
  if (isMissing(value)) return EM_DASH;
  return `${value >= 10 ? Math.round(value) : Number(value.toFixed(digits))}%`;
}

export function count(value: number | null | undefined): string {
  if (isMissing(value)) return EM_DASH;
  return plain.format(value);
}

export function decimal(value: number | null | undefined, digits = 1): string {
  if (isMissing(value)) return EM_DASH;
  return value.toFixed(digits);
}

/**
 * A span of days, in the words a school uses.
 *
 * Kept deliberately coarse: "3 months" is what a principal acts on, and
 * "94 days overdue" invites a precision the underlying date arithmetic does not
 * always have.
 */
export function duration(days: number | null | undefined): string {
  if (isMissing(days)) return EM_DASH;
  const whole = Math.round(days);
  if (Math.abs(whole) < 45) return `${plain.format(whole)} day${Math.abs(whole) === 1 ? '' : 's'}`;
  if (Math.abs(whole) < 365) return `${Math.round(whole / 30)} months`;
  return `${decimal(whole / 365)} years`;
}

/**
 * The single entry point the renderer uses: format a value the way the payload
 * says it should be read.
 */
export function formatValue(
  value: number | null | undefined,
  format: ValueFormat,
  currency?: string | null,
): string {
  switch (format) {
    case 'currency':
      return money(value, currency ?? 'INR');
    case 'currencyExact':
      return moneyExact(value, currency ?? 'INR');
    case 'percent':
      return percent(value);
    case 'decimal':
      return decimal(value);
    case 'duration':
      return duration(value);
    case 'count':
      return count(value);
    case 'text':
    default:
      return isMissing(value) ? EM_DASH : String(value);
  }
}

/**
 * A timestamp in the reader's locale, or the honest absence of one.
 *
 * Returns null rather than "Never" so the caller decides the wording — "not yet
 * analysed" and "never recorded" are different statements about the same null.
 */
export function timestamp(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
