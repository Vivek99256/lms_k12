import { type NextRequest, NextResponse } from 'next/server';

/**
 * Server-side proxy for the Laravel "send password reset link" endpoint.
 *
 * Browser → this route → Laravel. Keeps the Laravel base URL server-side
 * and avoids CORS, matching the pattern used by every other Laravel proxy
 * under /app/api/* (see e.g. app/api/dashboard/admin/route.ts).
 *
 * Upstream: POST {LARAVEL_BASE_URL}/forget-password
 *   Triz's reset-password controller lives at the root, NOT under /api —
 *   /api/forget-password and the obvious REST variants 404 with HTML,
 *   which is why the earlier proxy returned the 'non-JSON response' 502.
 *   Body: { user_email } — that's the field the Blade form on
 *   dev.triz.co.in/forget-password submits (the controller maps it to the
 *   user table's email column). We also accept `email` as a fallback for
 *   callers that send the more conventional name.
 *   Expected: { success: true|false, message: '...' } on success.
 */
const LARAVEL_PATH = '/forget-password';

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
      { success: false, message: 'Laravel base URL is missing for the forgot-password proxy.' },
      { status: 400 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { success: false, message: 'Invalid JSON body.' },
      { status: 400 }
    );
  }

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (!email) {
    return NextResponse.json(
      { success: false, message: 'Email is required.' },
      { status: 400 }
    );
  }

  // Triz's reset-password controller reads `user_email` from the request
  // (it's a Laravel form controller, not a JSON API, so we have to send the
  // form-style field name). The page-level X-Requested-With + Accept headers
  // keep Laravel on the JSON response branch where it has one.
  const upstreamBody = {
    user_email: email,
    email,
    type: 'API',
  };

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
      body: JSON.stringify(upstreamBody),
      cache: 'no-store',
      redirect: 'manual',
    });

    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    if (response.status >= 300 && response.status < 400) {
      return NextResponse.json(
        { success: false, message: 'Laravel redirected the forgot-password request instead of returning JSON.' },
        { status: 502 }
      );
    }

    try {
      return NextResponse.json(JSON.parse(text) as unknown, { status: response.status });
    } catch {
      // Laravel often returns its Blade page here (the /forget-password
      // GET view), even on POST. Detect that case and surface a friendly
      // error rather than the raw HTML preview.
      const isHtml = /<\s*(html|!doctype|body|head)\b/i.test(text);
      return NextResponse.json(
        {
          success: false,
          message: isHtml
            ? 'The reset email service is unavailable. Please contact support.'
            : 'Laravel returned a non-JSON response for the forgot-password request.',
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
        success: false,
        message: error instanceof Error ? error.message : 'Unable to connect to the Laravel forgot-password endpoint.',
      },
      { status: 502 }
    );
  }
}