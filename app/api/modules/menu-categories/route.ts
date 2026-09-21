import { type NextRequest, NextResponse } from 'next/server';

/**
 * Server-side proxy for the module category navigation feed.
 *
 * Browser → this route → Laravel, the same shape as
 * app/api/fees/menu-categories/route.ts and its Teach/Learn twin, which is how
 * every module keeps Laravel off the browser's origin and avoids CORS.
 *
 * Upstream:
 *   GET {LARAVEL_BASE_URL}/api/modules/menu-categories
 *   next_lms_erp/routes/api.php → ModuleMenuCategoryApiController::index
 *
 * Unlike the two module-specific proxies this one carries the module through:
 * `module_name` (the slug, as `/modules/<slug>/...` spells it) or
 * `level2_menu_id` (the tblmenumaster row the shell has selected). With
 * neither, the response is the module directory alone, which is what the
 * sidebar needs on start-up.
 *
 * The upstream route runs no session middleware, so the tenant/user context
 * travels as query parameters; they are taken from the `x-*` session headers
 * every module already sends.
 */
const LARAVEL_PATH = '/api/modules/menu-categories';
const UPSTREAM_TIMEOUT_MS = 15_000;

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
    return jsonError('Laravel base URL is missing for the module menu-categories proxy.', 400);
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

  // Which module is being asked about. Both forms are forwarded verbatim; the
  // controller decides which one it can resolve.
  const moduleName = request.nextUrl.searchParams.get('module_name')?.trim() || '';
  const level2MenuId = request.nextUrl.searchParams.get('level2_menu_id')?.trim() || '';
  if (moduleName) url.searchParams.set('module_name', moduleName);
  if (level2MenuId) url.searchParams.set('level2_menu_id', level2MenuId);

  try {
    const headers = new Headers({
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    });
    if (token) headers.set('Authorization', `Bearer ${token}`);

    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader) headers.set('Cookie', cookieHeader);

    const upstreamController = new AbortController();
    const timeout = setTimeout(() => upstreamController.abort(), UPSTREAM_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method: 'GET',
        headers,
        cache: 'no-store',
        redirect: 'manual',
        signal: upstreamController.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    if (response.status >= 300 && response.status < 400) {
      return jsonError('Laravel redirected the module menu-categories request instead of returning JSON.', 502, {
        location: response.headers.get('location') || '',
      });
    }

    try {
      return NextResponse.json(JSON.parse(text) as unknown, { status: response.status });
    } catch {
      return jsonError('Laravel returned a non-JSON response for the module menu-categories request.', 502, {
        preview: summarizeHtml(text),
        backend_status: response.status,
        content_type: contentType || 'unknown',
      });
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return jsonError('The Laravel module menu-categories request timed out.', 504);
    }

    return jsonError(
      error instanceof Error ? error.message : 'Unable to connect to the Laravel module menu-categories endpoint.',
      502
    );
  }
}
