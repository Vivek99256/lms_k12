import { type NextRequest, NextResponse } from 'next/server';

/**
 * Server-side proxy for the Fees category navigation feed.
 *
 * Browser → this route → Laravel, the same shape as
 * app/api/fees/dashboard/summary/route.ts, which is how the fees module keeps
 * Laravel off the browser's origin and avoids CORS.
 *
 * Upstream:
 *   GET {LARAVEL_BASE_URL}/api/fees/menu-categories
 *   next_lms_erp/routes/api.php → FeesMenuCategoryApiController::index
 *
 * The upstream route runs no session middleware, so the tenant/user context
 * travels as query parameters; they are taken from the `x-*` session headers
 * this module already sends on every fees request.
 */
const LARAVEL_PATH = '/api/fees/menu-categories';

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
  return NextResponse.json({ status: 0, message, ...details }, { status });
}

function summarizeHtml(text: string) {
  return text.replace(/\s+/g, ' ').trim().slice(0, 500);
}

export async function GET(request: NextRequest) {
  const baseUrl = readHeader(request, 'x-laravel-base-url') || getDefaultBaseUrl();
  const token = readHeader(request, 'x-laravel-token');
  const subInstituteId = readHeader(request, 'x-sub-institute-id');
  const userId = readHeader(request, 'x-user-id');
  const userProfileName = readHeader(request, 'x-user-profile-name');

  if (!baseUrl) {
    return jsonError('Laravel base URL is missing for the fees menu-categories proxy.', 400);
  }

  if (!subInstituteId || !userId) {
    return jsonError(
      'Session context is missing. Please reselect the institute and sign in again.',
      400
    );
  }

  const url = new URL(`${baseUrl}${LARAVEL_PATH}`);
  url.searchParams.set('sub_institute_id', subInstituteId);
  url.searchParams.set('user_id', userId);
  if (userProfileName) url.searchParams.set('user_profile_name', userProfileName);

  try {
    const headers = new Headers({
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    });
    if (token) headers.set('Authorization', `Bearer ${token}`);

    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader) headers.set('Cookie', cookieHeader);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers,
      cache: 'no-store',
      redirect: 'manual',
    });

    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    if (response.status >= 300 && response.status < 400) {
      return jsonError('Laravel redirected the fees menu-categories request instead of returning JSON.', 502, {
        location: response.headers.get('location') || '',
      });
    }

    try {
      return NextResponse.json(JSON.parse(text) as unknown, { status: response.status });
    } catch {
      return jsonError('Laravel returned a non-JSON response for the fees menu-categories request.', 502, {
        preview: summarizeHtml(text),
        backend_status: response.status,
        content_type: contentType || 'unknown',
      });
    }
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : 'Unable to connect to the Laravel fees menu-categories endpoint.',
      502
    );
  }
}
