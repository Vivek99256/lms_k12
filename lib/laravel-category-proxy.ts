import { type NextRequest, NextResponse } from 'next/server';

/**
 * Server-side proxy for the Laravel category-navigation endpoints.
 *
 * Browser → this route → Laravel, which is how these modules keep Laravel off
 * the browser's origin and avoid CORS. The shape is lifted from
 * app/api/fees/menu-categories/route.ts, which was copied once for Teach/Learn
 * already; extracting it here is what stops it being copied a third time for
 * the generic module endpoint and a fourth for its registry.
 *
 * The upstream routes run no session middleware of their own for these calls,
 * so tenant/user context travels as query parameters, taken from the `x-*`
 * session headers every module already sends.
 */

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

export async function proxyCategoryRequest(
  request: NextRequest,
  {
    laravelPath,
    label,
    forwardParams = [],
  }: {
    /** Upstream path, e.g. '/api/modules/menu-categories'. */
    laravelPath: string;
    /** Used only in error messages, e.g. 'module menu-categories'. */
    label: string;
    /** Query parameters copied through from this request's own URL. */
    forwardParams?: string[];
  }
) {
  const baseUrl = readHeader(request, 'x-laravel-base-url') || getDefaultBaseUrl();
  const token = readHeader(request, 'x-laravel-token');
  const subInstituteId = readHeader(request, 'x-sub-institute-id');
  const userId = readHeader(request, 'x-user-id');
  const userProfileName = readHeader(request, 'x-user-profile-name');

  if (!baseUrl) {
    return jsonError(`Laravel base URL is missing for the ${label} proxy.`, 400);
  }

  if (!subInstituteId || !userId) {
    return jsonError('Session context is missing. Please reselect the institute and sign in again.', 400);
  }

  const url = new URL(`${baseUrl}${laravelPath}`);
  url.searchParams.set('sub_institute_id', subInstituteId);
  url.searchParams.set('user_id', userId);
  if (userProfileName) url.searchParams.set('user_profile_name', userProfileName);

  for (const name of forwardParams) {
    const value = request.nextUrl.searchParams.get(name)?.trim();
    if (value) url.searchParams.set(name, value);
  }

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

    // A redirect here means Laravel answered with a login page rather than
    // JSON, which would otherwise surface as an unparseable body.
    if (response.status >= 300 && response.status < 400) {
      return jsonError(`Laravel redirected the ${label} request instead of returning JSON.`, 502, {
        location: response.headers.get('location') || '',
      });
    }

    try {
      return NextResponse.json(JSON.parse(text) as unknown, { status: response.status });
    } catch {
      return jsonError(`Laravel returned a non-JSON response for the ${label} request.`, 502, {
        preview: summarizeHtml(text),
        backend_status: response.status,
        content_type: contentType || 'unknown',
      });
    }
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : `Unable to connect to the Laravel ${label} endpoint.`,
      502
    );
  }
}
