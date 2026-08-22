import { type NextRequest, NextResponse } from 'next/server';

/**
 * Server-side proxy for the Teacher dashboard aggregate endpoint.
 *
 * Browser → this route → Laravel. Same shape as
 * app/api/fees/dashboard/summary/route.ts (session travels as `x-*`
 * headers), which is how this module avoids browser→Laravel CORS.
 *
 * Upstream: POST {LARAVEL_BASE_URL}/api/teacher-dashboard/summary
 *   next_lms_erp/routes/api.php → RoleDashboardApiController::teacherSummary
 *   Route sits behind `api.session` (ApiSessionHydrator) — the JWT alone
 *   decides the caller's role; the Laravel controller returns 403 for any
 *   token for a different role.
 */
const LARAVEL_PATH = '/api/teacher-dashboard/summary';

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

function jsonError(message: string, status: number, details?: Record<string, unknown>) {
  return NextResponse.json({ status: '0', message, ...details }, { status });
}

function summarizeHtml(text: string) {
  return text.replace(/\s+/g, ' ').trim().slice(0, 500);
}

export async function POST(request: NextRequest) {
  const baseUrl = readHeader(request, 'x-laravel-base-url') || getDefaultBaseUrl();
  const token = readHeader(request, 'x-laravel-token');
  const subInstituteId = readHeader(request, 'x-sub-institute-id');
  const academicYearId = readHeader(request, 'x-academic-year-id');
  const userId = readHeader(request, 'x-user-id');
  const termId = readHeader(request, 'x-term-id');

  if (!baseUrl) {
    return jsonError('Laravel base URL is missing for the teacher dashboard proxy.', 400);
  }
  if (!token) {
    return jsonError('Missing session token.', 401);
  }

  const body: Record<string, unknown> = {
    type: 'JSON',
    sub_institute_id: subInstituteId,
    syear: academicYearId,
    user_id: userId,
    term_id: termId,
  };

  try {
    const headers = new Headers({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      Authorization: `Bearer ${token}`,
    });

    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader) headers.set('Cookie', cookieHeader);

    const response = await fetch(`${baseUrl}${LARAVEL_PATH}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      cache: 'no-store',
      redirect: 'manual',
    });

    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    if (response.status >= 300 && response.status < 400) {
      return jsonError('Laravel redirected the teacher dashboard request instead of returning JSON.', 502, {
        location: response.headers.get('location') || '',
      });
    }

    try {
      return NextResponse.json(JSON.parse(text) as unknown, { status: response.status });
    } catch {
      return jsonError('Laravel returned a non-JSON response for the teacher dashboard request.', 502, {
        preview: summarizeHtml(text),
        backend_status: response.status,
        content_type: contentType || 'unknown',
      });
    }
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : 'Unable to connect to the Laravel teacher dashboard endpoint.',
      502
    );
  }
}
