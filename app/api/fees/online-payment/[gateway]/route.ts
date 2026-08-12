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
  return new NextResponse(body, { status: upstream.status, headers: { 'Content-Type': upstream.headers.get('content-type') || 'text/html; charset=utf-8', ...(upstream.headers.get('location') ? { Location: upstream.headers.get('location')! } : {}) } });
}
