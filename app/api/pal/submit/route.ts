import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '@/app/components/utils/api_url';

export const runtime = 'nodejs';

/**
 * BFF proxy for PAL quiz submission.
 *
 * The Laravel `store()` action (POST /lms/pal) does NOT honor `type=API`: it
 * always responds with a 302 redirect to `pal.show`. A browser SPA cannot read
 * a cross-origin redirect `Location`, so this server-side route performs the
 * POST with `redirect: 'manual'`, reads the `Location`, and returns the
 * resulting `questionPaperId` + `online_exam_id` as JSON. No backend change.
 *
 * NOTE (documented backend gap): the cleaner long-term fix is for `store()` to
 * branch on `type == 'API'` and `return response()->json([...])` with the ids,
 * mirroring `is_mobile()` used by index/create/show. This proxy exists only
 * because that branch is missing.
 */
export async function POST(request: NextRequest) {
  const baseFromHeader = request.headers.get('x-laravel-base-url');
  const base = (baseFromHeader || API_BASE_URL).replace(/\/$/, '');
  if (!base) {
    return NextResponse.json(
      { status: '0', message: 'Missing Laravel base URL.' },
      { status: 400 }
    );
  }

  const body = await request.text();
  const authorization = request.headers.get('authorization');
  const cookie = request.headers.get('cookie');

  try {
    const upstream = await fetch(`${base}/lms/pal`, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        ...(authorization ? { Authorization: authorization } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body,
      cache: 'no-store',
    });

    const location = upstream.headers.get('location');
    const isRedirect = upstream.status >= 300 && upstream.status < 400;

    if (isRedirect && location) {
      const parsed = parsePalShowLocation(location);
      if (parsed) {
        return NextResponse.json({ status: '1', message: 'Exam submitted', ...parsed });
      }
      // Redirected somewhere unexpected (e.g. login) — surface as failure.
      return NextResponse.json(
        { status: '0', message: 'Submission was not accepted by the server.' },
        { status: 502 }
      );
    }

    // Non-redirect: try to pass through a JSON error/body from Laravel.
    const text = await upstream.text();
    let payload: Record<string, unknown> | null = null;
    try {
      payload = text ? (JSON.parse(text) as Record<string, unknown>) : null;
    } catch {
      payload = null;
    }
    if (payload && typeof payload === 'object') {
      return NextResponse.json(payload, {
        status: upstream.status >= 400 ? upstream.status : 200,
      });
    }
    return NextResponse.json(
      { status: '0', message: `Submission failed (HTTP ${upstream.status}).` },
      { status: upstream.status >= 400 ? upstream.status : 502 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Submission proxy failed';
    return NextResponse.json({ status: '0', message }, { status: 502 });
  }
}

/** Extract the ids from `.../lms/pal/{questionPaperId}?online_exam_id=...`. */
function parsePalShowLocation(
  location: string
): { questionPaperId: string; onlineExamId: string } | null {
  try {
    const url = new URL(location, 'http://placeholder.local');
    const match = url.pathname.match(/\/lms\/pal\/(\d+)/);
    const questionPaperId = match ? match[1] : '';
    if (!questionPaperId) return null;
    return {
      questionPaperId,
      onlineExamId: url.searchParams.get('online_exam_id') ?? '',
    };
  } catch {
    return null;
  }
}
