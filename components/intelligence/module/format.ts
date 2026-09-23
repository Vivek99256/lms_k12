/**
 * Value formatting shared by every Intelligence screen.
 *
 * The same three rules `fees-intelligence-primitives.tsx` encodes — Indian
 * grouping, an em dash rather than a zero for an unknown, a currency the
 * payload names rather than one hard-coded — generalised so a non-money module
 * (Result: marks, not rupees) reads correctly through the same renderer.
 */

export type MetricFormat = 'money' | 'percent' | 'count' | 'text';

const compact = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 });
const countFormatter = new Intl.NumberFormat('en-IN');

/** Indian money at a glance: ₹38.3L, ₹1.2Cr, ₹42,101. Currency defaults to INR. */
export function money(amount: number | null | undefined, currency = 'INR'): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return '—';

  const full = new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 });

  if (currency === 'INR') {
    if (Math.abs(amount) >= 10000000) return `₹${compact.format(amount / 10000000)}Cr`;
    if (Math.abs(amount) >= 100000) return `₹${compact.format(amount / 100000)}L`;
  }

  return full.format(amount);
}

/**
 * A percentage, or an em dash.
 *
 * NULL IS NOT ZERO — a rate over no denominator is undefined, and rendering it
 * as "0%" would report a result the payload never claimed.
 */
export function percent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value >= 10 ? Math.round(value) : Number(value.toFixed(digits))}%`;
}

export function count(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return countFormatter.format(value);
}

/** A metric tile's value, dispatched on the format the payload declared for it. */
export function formatValue(value: number | string | null | undefined, format?: MetricFormat, currency?: string): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;

  switch (format) {
    case 'money':
      return money(value, currency);
    case 'percent':
      return percent(value);
    case 'count':
      return count(value);
    default:
      return countFormatter.format(value);
  }
}

/** A date the reader can scan, or '' for a value that was never recorded. */
export function timestamp(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
