import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '@/app/components/utils/api_url';

export const runtime = 'nodejs';

function resolveTargetPath(targetPath: string): string {
  const normalized = targetPath.replace(/^\/+/, '');

  if (
    normalized === 'proxy_master' ||
    normalized.startsWith('proxy_master/') ||
    normalized === 'ajax_getproxyperiod'
  ) {
    return `school_setup/${normalized}`;
  }

  return normalized;
}

export async function GET(request: NextRequest) {
  const targetPath = request.nextUrl.searchParams.get('path');
  if (!targetPath) {
    return NextResponse.json({ message: 'Missing path parameter' }, { status: 400 });
  }

  const base = API_BASE_URL.replace(/\/$/, '');
  const url = `${base}/${resolveTargetPath(targetPath)}`;

  const upstreamParams = new URLSearchParams(request.nextUrl.searchParams);
  upstreamParams.delete('path');
  const authorization = request.headers.get('authorization');
  const cookie = request.headers.get('cookie');
  const referer = request.headers.get('referer');

  try {
    const upstream = await fetch(`${url}?${upstreamParams.toString()}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(authorization ? { Authorization: authorization } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...(referer ? { Referer: referer } : {}),
      },
      cache: 'no-store',
    });

    const text = await upstream.text();
    let payload: unknown = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { raw: text };
    }

    return NextResponse.json(payload, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy request failed';
    return NextResponse.json({ message }, { status: 502 });
  }
}

async function forwardMutation(request: NextRequest) {
export async function POST(request: NextRequest) {
  return forwardWithBody(request, 'POST');
}

export async function PUT(request: NextRequest) {
  return forwardWithBody(request, 'PUT');
}

export async function PATCH(request: NextRequest) {
  return forwardWithBody(request, 'PATCH');
}

export async function DELETE(request: NextRequest) {
  return forwardWithBody(request, 'DELETE');
}

async function forwardWithBody(request: NextRequest, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE') {
  const targetPath = request.nextUrl.searchParams.get('path');
  if (!targetPath) {
    return NextResponse.json({ message: 'Missing path parameter' }, { status: 400 });
  }

  const base = API_BASE_URL.replace(/\/$/, '');
  const url = `${base}/${resolveTargetPath(targetPath)}`;

  const contentType = request.headers.get('content-type') || '';
  const body = await request.arrayBuffer();
  const authorization = request.headers.get('authorization');
  const cookie = request.headers.get('cookie');

  try {
    const upstream = await fetch(url, {
      method: request.method,
      headers: {
        ...(contentType ? { 'Content-Type': contentType } : {}),
        Accept: 'application/json',
        ...(authorization ? { Authorization: authorization } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body.byteLength > 0 ? body : undefined,
      cache: 'no-store',
    });

    const text = await upstream.text();
    let payload: unknown = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { raw: text };
    }

    return NextResponse.json(payload, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy request failed';
    return NextResponse.json({ message }, { status: 502 });
  }
}

export const POST = forwardMutation;
export const PUT = forwardMutation;
export const PATCH = forwardMutation;
export const DELETE = forwardMutation;
