/**
 * Client for the login-free parent fee payment API (Laravel: routes/public_pay.php).
 * Calls go through the generic /api/proxy relay, so the browser only ever talks to this site.
 */
import { API_BASE_URL } from '@/app/components/utils/api_url';

export type PayMonth = { id: string; label: string; fee: number; paid: number; due: number };

export type PaySchool = { name: string; code: string; gateway: string; inline: boolean };

export type PayStudent = { id: string; name: string };

export type PayFees = {
  student: { id: string; name: string; class: string; uniqueId: string };
  year: number;
  clearingEarlierYear: boolean;
  feesType: string;
  fixed: boolean;
  due: number;
  months: PayMonth[];
  gateway: string;
};

export type RazorpayOrder = {
  orderId: string;
  keyId: string;
  paymentRef: string;
  amount: number;
  studentName: string;
  schoolName: string;
};

export type PayOutcome = {
  state: 'paid' | 'pending';
  amount: number;
  reference: string;
  receiptNo?: string | null;
  receiptHtml?: string | null;
};

export class PayError extends Error {
  /** 202 means the money moved but the receipt is still being prepared. */
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function call<T>(code: string, action: string, body?: Record<string, unknown>): Promise<T> {
  const path = `api/public-pay/${encodeURIComponent(code)}${action ? `/${action}` : ''}`;
  let response: Response;
  try {
    response = await fetch(`/api/proxy?path=${encodeURIComponent(path)}`, {
      method: body ? 'POST' : 'GET',
      headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new PayError('We could not reach the server. Check your internet connection and try again.', 0);
  }
  const payload = (await response.json().catch(() => null)) as { status?: number; message?: string; data?: T } | null;
  if (!response.ok || !payload || Number(payload.status ?? 1) !== 1) {
    if (response.status === 429) throw new PayError('Too many attempts. Please wait a minute and try again.', 429);
    throw new PayError(payload?.message || 'Something went wrong. Please try again.', response.status);
  }
  return payload.data as T;
}

export const payApi = {
  school: (code: string) => call<PaySchool>(code, ''),
  lookup: (code: string, mobile: string) => call<{ students: PayStudent[] }>(code, 'lookup', { mobile }),
  fees: (code: string, mobile: string, studentId: string) => call<PayFees>(code, 'fees', { mobile, student_id: studentId }),
  startRazorpay: (code: string, mobile: string, studentId: string, amount: number) =>
    call<RazorpayOrder>(code, 'pay', { mobile, student_id: studentId, amount }),
  confirmRazorpay: (code: string, mobile: string, studentId: string, body: Record<string, string>) =>
    call<PayOutcome>(code, 'razorpay/confirm', { mobile, student_id: studentId, ...body }),
};

/** Hand the browser to a redirect-style gateway: the school's bank page replaces this one. */
export function submitToGateway(code: string, fields: Record<string, string>) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = `${API_BASE_URL.replace(/\/$/, '')}/api/public-pay/${encodeURIComponent(code)}/checkout`;
  Object.entries(fields).forEach(([name, value]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
}

export function formatRupees(amount: number, decimals = false): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** 2025 -> "2025-26" */
export function formatYear(year: number): string {
  return `${year}-${String((year + 1) % 100).padStart(2, '0')}`;
}

type RazorpayCtor = new (options: Record<string, unknown>) => { open: () => void; on: (event: string, handler: (response: unknown) => void) => void };

export function razorpayCtor(): RazorpayCtor | undefined {
  return (window as unknown as { Razorpay?: RazorpayCtor }).Razorpay;
}

let razorpayLoader: Promise<void> | null = null;

export function loadRazorpay(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (razorpayCtor()) return Promise.resolve();
  razorpayLoader ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      razorpayLoader = null;
      reject(new Error('Could not load the payment window. Check your connection and try again.'));
    };
    document.body.appendChild(script);
  });
  return razorpayLoader;
}
