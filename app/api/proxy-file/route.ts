import { NextRequest } from 'next/server';
import { API_BASE_URL } from '@/app/components/utils/api_url';
import { isSafeRelayPath, rejectOversizedBody } from '@/lib/security/request-guards';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const targetPath = request.nextUrl.searchParams.get('path');
  if (!targetPath) {
    return new Response('Missing path parameter', { status: 400 });
  }
  if (!isSafeRelayPath(targetPath)) {
    return new Response('Invalid path parameter', { status: 400 });
  }
  const oversized = rejectOversizedBody(request);
  if (oversized) return oversized;

  const base = API_BASE_URL.replace(/\/$/, '');
  const upstreamParams = new URLSearchParams(request.nextUrl.searchParams);
  upstreamParams.delete('path');
  const queryString = upstreamParams.toString();
  const url = `${base}/${targetPath.replace(/^\//, '')}${queryString ? `?${queryString}` : ''}`;

  const contentType = request.headers.get('content-type') || '';
  const isMultipart = contentType.toLowerCase().includes('multipart/form-data');
  const body = isMultipart ? await request.formData() : await request.text();
  const authorization = request.headers.get('authorization');
  const cookie = request.headers.get('cookie');

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        ...(!isMultipart && contentType ? { 'Content-Type': contentType } : {}),
        ...(authorization ? { Authorization: authorization } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: isMultipart ? body : body || undefined,
      cache: 'no-store',
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream',
        'Content-Disposition': upstream.headers.get('content-disposition') || 'inline',
      },
    });
  } catch (error) {
    // Low-level fetch errors can name internal hosts: log them, return a plain message.
    console.error('[api/proxy-file] upstream request failed', error);
    return new Response('Proxy file request failed', { status: 502 });
  }
}
