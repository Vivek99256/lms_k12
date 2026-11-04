import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '@/app/components/utils/api_url';

export const runtime = 'nodejs';

const allowedGateways = new Set(['hdfc', 'axis', 'aggre_pay', 'icici', 'razorpay', 'payphi', 'hdfcrazorpay', 'icici_orange']);

export async function POST(request: NextRequest, context: { params: Promise<{ gateway: string }> }) {
  const { gateway } = await context.params;
  if (!allowedGateways.has(gateway)) return NextResponse.json({ message: 'Unsupported payment gateway.' }, { status: 404 });
  const form = await request.formData();
  const token = String(form.get('token') || '');
  form.delete('token');
  const origin = request.headers.get('origin') || request.nextUrl.origin;
  const upstream = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/fees/online_fees_payment_api/${encodeURIComponent(gateway)}`, { method: 'POST', headers: { Accept: 'text/html, application/json', Origin: origin, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: form, redirect: 'manual' });
  const body = await upstream.arrayBuffer();
  // The gateway returns an HTML page (usually an auto-submitting form to the bank). It is served from this
  // origin, so it runs sandboxed: scripts and form posts still work, but the page gets a throw-away origin
  // and can never read this app's localStorage (which holds the session token).
  const headers: Record<string, string> = {
    'Content-Type': upstream.headers.get('content-type') || 'text/html; charset=utf-8',
    'Content-Security-Policy': 'sandbox allow-forms allow-scripts allow-top-navigation allow-popups',
    'Cache-Control': 'no-store',
  };
  const location = upstream.headers.get('location');
  // Only an http(s) address is passed on; javascript: and data: redirects never are.
  if (location && /^https?:\/\//i.test(location)) headers.Location = location;
  return new NextResponse(body, { status: upstream.status, headers });
}
