import { type NextRequest, NextResponse } from 'next/server';

/**
 * Server-side proxy that exchanges a Google ID token for an LMS session.
 *
 * Browser → this route → Laravel. The browser only ever sees its own
 * Google credential; the backend then validates it server-side and
 * returns the same login payload shape `AuthContext.login()` consumes
 * (data, academicTerms, academicYears), so the post-login flow stays
 * identical to email/password.
 *
 * Upstream: POST {LARAVEL_BASE_URL}/api/google-auth
 *   Body: { id_token, credential, type: 'API' }
 *   Expected: same shape as /api/api-login on success.
 */
const LARAVEL_PATH = '/api/google-auth';

function getDefaultBaseUrl() {
  const productionBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL_PROD || '').trim().replace(/\/$/, '');
  const developmentBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL_DEV || '').trim().replace(/\/$/, '');

  if (process.env.NODE_ENV === 'production') {
    return productionBaseUrl || developmentBaseUrl;
  }

  return developmentBaseUrl || productionBaseUrl;
}

function readHeader(request: NextRequest, name: string) {
  return request.headers.get(name)?.trim() || '';
}

function summarizeHtml(text: string) {
  return text.replace(/\s+/g, ' ').trim().slice(0, 500);
}

export async function POST(request: NextRequest) {
  const baseUrl = readHeader(request, 'x-laravel-base-url') || getDefaultBaseUrl();
  if (!baseUrl) {
    return NextResponse.json(
      { status: '0', message: 'Laravel base URL is missing for the Google auth proxy.' },
      { status: 400 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { status: '0', message: 'Invalid JSON body.' },
      { status: 400 }
    );
  }

  const credential = typeof body.credential === 'string' ? body.credential : '';
  const idToken = typeof body.id_token === 'string' ? body.id_token : '';
  const token = credential || idToken;
  if (!token) {
    return NextResponse.json(
      { status: '0', message: 'Google credential is required.' },
      { status: 400 }
    );
  }

  try {
    const headers = new Headers({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    });

    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader) headers.set('Cookie', cookieHeader);

    const response = await fetch(`${baseUrl}${LARAVEL_PATH}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ credential: token, id_token: token, type: 'API' }),
      cache: 'no-store',
      redirect: 'manual',
    });

    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    if (response.status >= 300 && response.status < 400) {
      return NextResponse.json(
        { status: '0', message: 'Laravel redirected the Google auth request instead of returning JSON.' },
        { status: 502 }
      );
    }

    try {
      return NextResponse.json(JSON.parse(text) as unknown, { status: response.status });
    } catch {
      return NextResponse.json(
        {
          status: '0',
          message: 'Laravel returned a non-JSON response for the Google auth request.',
          preview: summarizeHtml(text),
          backend_status: response.status,
          content_type: contentType || 'unknown',
        },
        { status: 502 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      {
        status: '0',
        message: error instanceof Error ? error.message : 'Unable to connect to the Laravel Google auth endpoint.',
      },
      { status: 502 }
    );
  }
}