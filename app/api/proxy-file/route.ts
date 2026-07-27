import { NextRequest } from 'next/server';
import { API_BASE_URL } from '@/app/components/utils/api_url';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const targetPath = request.nextUrl.searchParams.get('path');
  if (!targetPath) {
    return new Response('Missing path parameter', { status: 400 });
  }

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
    const message = error instanceof Error ? error.message : 'Proxy file request failed';
    return new Response(message, { status: 502 });
  }
}
