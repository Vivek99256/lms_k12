import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '@/app/components/utils/api_url';

export const runtime = 'nodejs';

/**
 * Dedicated proxy for the Library "Books" server-side DataTables listing.
 *
 * `BookController::index()` (next_lms_erp/app/Http/Controllers/library/BookController.php)
 * only returns the Yajra DataTables JSON when Laravel's `$request->ajax()` is
 * true (it checks the `X-Requested-With: XMLHttpRequest` header) -- any
 * other request falls through to a full Blade page render instead. The
 * generic `app/api/proxy/route.ts` deliberately does not forward that
 * header, since doing so unconditionally could change behaviour for every
 * other page that already goes through it. This route exists solely to add
 * it for this one endpoint, isolated from the shared proxy -- the same
 * pattern `app/api/library/dashboard/summary/route.ts` already uses for a
 * different Library endpoint with its own header requirements.
 *
 * Upstream: GET {LARAVEL_BASE_URL}/books
 * (next_lms_erp routes/web.php -> Route::resource('books', BookController::class))
 *
 * Tenant/session context (sub_institute_id, syear, user_id, token, ...) is
 * expected in the query string, appended by the caller via
 * `appendSessionParams` (app/fees/_lib/fees-api.ts) -- the same convention
 * every other Library page already uses. Laravel's SessionMiddleware
 * hydrates a real session from that bearer context before the controller
 * runs, which is what lets `session()->get('sub_institute_id')` resolve
 * correctly inside `BookController::index()`.
 */
export async function GET(request: NextRequest) {
  const base = API_BASE_URL.replace(/\/$/, '');
  const queryParams = new URLSearchParams(request.nextUrl.searchParams);
  const url = `${base}/books`;

  const authorization = request.headers.get('authorization');
  const cookie = request.headers.get('cookie');
  const referer = request.headers.get('referer');

  try {
    const upstream = await fetch(`${url}?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
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
    const cause = err instanceof Error && err.cause instanceof Error ? err.cause.message : undefined;
    return NextResponse.json({ message, cause, target: url }, { status: 502 });
  }
}
