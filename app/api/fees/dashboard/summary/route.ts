import { type NextRequest, NextResponse } from 'next/server';

/**
 * Server-side proxy for the Fees dashboard aggregate endpoint.
 *
 * Browser → this route → Laravel. Same shape as the fees report proxies in
 * app/api/fees/reports/_lib/fees-report-proxy.ts (session travels as `x-*`
 * headers), which is how this module avoids browser→Laravel CORS.
 *
 * Upstream:
 *   POST {LARAVEL_BASE_URL}/api/fees-dashboard/summary
 *   next_lms_erp/routes/api.php:205 → FeesDashboardApiController::summary
 *   Contract: next_lms_erp/docs/fees-api/fees-dashboard-contract.md
 *
 * Unlike the report proxies this forwards JSON, because the contract endpoint
 * accepts a JSON body and `routes/api.php` runs no session middleware — the
 * controller seeds session from the body itself.
 */
const LARAVEL_PATH = '/api/fees-dashboard/summary';

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

function readJsonBody(text: string): Record<string, unknown> {
  if (!text.trim()) return {};

  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export async function POST(request: NextRequest) {
  const baseUrl = readHeader(request, 'x-laravel-base-url') || getDefaultBaseUrl();
  const token = readHeader(request, 'x-laravel-token');
  const subInstituteId = readHeader(request, 'x-sub-institute-id');
  const academicYearId = readHeader(request, 'x-academic-year-id');
  const userId = readHeader(request, 'x-user-id');
  const termId = readHeader(request, 'x-term-id');

  if (!baseUrl) {
    return jsonError('Laravel base URL is missing for the fees dashboard proxy.', 400);
  }

  const requested = readJsonBody(await request.text());

  // Header session is the fallback; an explicit body value always wins.
  const body: Record<string, unknown> = {
    ...requested,
    type: 'JSON',
    sub_institute_id: requested.sub_institute_id ?? subInstituteId,
    syear: requested.syear ?? academicYearId,
    user_id: requested.user_id ?? userId,
    term_id: requested.term_id ?? termId,
  };

  if (!body.sub_institute_id || !body.syear) {
    return jsonError(
      'Academic session context is missing. Please reselect the institute and academic year.',
      400
    );
  }

  try {
    const headers = new Headers({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    });
    if (token) headers.set('Authorization', `Bearer ${token}`);

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
      return jsonError('Laravel redirected the fees dashboard request instead of returning JSON.', 502, {
        location: response.headers.get('location') || '',
      });
    }

    try {
      return NextResponse.json(JSON.parse(text) as unknown, { status: response.status });
    } catch {
      return jsonError('Laravel returned a non-JSON response for the fees dashboard request.', 502, {
        preview: summarizeHtml(text),
        backend_status: response.status,
        content_type: contentType || 'unknown',
      });
    }
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : 'Unable to connect to the Laravel fees dashboard endpoint.',
      502
    );
  }
}
