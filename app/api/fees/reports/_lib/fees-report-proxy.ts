import { type NextRequest, NextResponse } from 'next/server';

type ProxySession = {
  baseUrl: string;
  token: string;
  subInstituteId: string;
  academicYearId: string;
  userId: string;
  termId: string;
  userProfileId: string;
  userProfileName: string;
  clientId: string;
};

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

function readSession(request: NextRequest): ProxySession {
  const baseUrl = readHeader(request, 'x-laravel-base-url') || getDefaultBaseUrl();

  return {
    baseUrl,
    token: readHeader(request, 'x-laravel-token'),
    subInstituteId: readHeader(request, 'x-sub-institute-id'),
    academicYearId: readHeader(request, 'x-academic-year-id'),
    userId: readHeader(request, 'x-user-id'),
    termId: readHeader(request, 'x-term-id'),
    userProfileId: readHeader(request, 'x-user-profile-id'),
    userProfileName: readHeader(request, 'x-user-profile-name'),
    clientId: readHeader(request, 'x-client-id'),
  };
}

function appendSessionSearchParams(params: URLSearchParams, session: ProxySession) {
  params.set('type', 'API');
  if (session.subInstituteId) params.set('sub_institute_id', session.subInstituteId);
  if (session.academicYearId) params.set('syear', session.academicYearId);
  if (session.userId) params.set('user_id', session.userId);
  if (session.termId) params.set('term_id', session.termId);
  if (session.token) params.set('token', session.token);
  if (session.userProfileId) params.set('user_profile_id', session.userProfileId);
  if (session.userProfileName) params.set('user_profile_name', session.userProfileName);
  if (session.clientId) params.set('client_id', session.clientId);
}

function buildLaravelUrl(request: NextRequest, laravelPath: string, session: ProxySession) {
  const url = new URL(`${session.baseUrl}${laravelPath}`);

  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.append(key, value);
  });

  appendSessionSearchParams(url.searchParams, session);

  return url;
}

function jsonError(message: string, status: number, details?: Record<string, unknown>) {
  return NextResponse.json(
    {
      status: 0,
      message,
      ...details,
    },
    { status }
  );
}

function parseJsonPayload(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function summarizeHtml(text: string) {
  return text.replace(/\s+/g, ' ').trim().slice(0, 500);
}

function inferHtmlStatus(response: Response, text: string) {
  const location = response.headers.get('location') || '';
  const combined = `${location} ${text}`.toLowerCase();
  if (response.status === 401 || response.status === 403) return response.status;
  if (combined.includes('login')) return 401;
  return response.status >= 400 ? response.status : 502;
}

function buildLaravelHeaders(request: NextRequest, session: ProxySession, extraHeaders?: HeadersInit) {
  const headers = new Headers(extraHeaders);
  headers.set('Accept', 'application/json');
  headers.set('X-Requested-With', 'XMLHttpRequest');
  if (session.token) {
    headers.set('Authorization', `Bearer ${session.token}`);
  }

  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    headers.set('Cookie', cookieHeader);
  }

  return headers;
}

async function readProxyBody(request: NextRequest, session: ProxySession) {
  const originalBody = await request.text();
  const params = new URLSearchParams(originalBody);
  appendSessionSearchParams(params, session);
  return params.toString();
}

export async function proxyFeesReportGet(request: NextRequest, laravelPath: string) {
  const session = readSession(request);

  if (!session.baseUrl) {
    return jsonError('Laravel base URL is missing for the fees report proxy.', 400);
  }

  if (!session.subInstituteId || !session.academicYearId) {
    return jsonError('Academic session context is missing. Please reselect the institute and academic year.', 400);
  }

  const targetUrl = buildLaravelUrl(request, laravelPath, session);

  try {
    const response = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: buildLaravelHeaders(request, session),
      cache: 'no-store',
      redirect: 'manual',
    });

    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();
    if (response.status >= 300 && response.status < 400) {
      return jsonError('Laravel redirected the fees report request instead of returning JSON.', inferHtmlStatus(response, text), {
        location: response.headers.get('location') || '',
      });
    }

    const payload = parseJsonPayload(text);
    if (payload === null) {
      return jsonError('Laravel returned HTML instead of JSON for the fees report request.', inferHtmlStatus(response, text), {
        preview: summarizeHtml(text),
        backend_status: response.status,
        content_type: contentType || 'unknown',
      });
    }

    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Unable to connect to the Laravel fees report endpoint.', 502);
  }
}

export async function proxyFeesReportPost(request: NextRequest, laravelPath: string) {
  const session = readSession(request);

  if (!session.baseUrl) {
    return jsonError('Laravel base URL is missing for the fees report proxy.', 400);
  }

  if (!session.subInstituteId || !session.academicYearId) {
    return jsonError('Academic session context is missing. Please reselect the institute and academic year.', 400);
  }

  const targetUrl = new URL(`${session.baseUrl}${laravelPath}`);

  try {
    const body = await readProxyBody(request, session);
    const response = await fetch(targetUrl.toString(), {
      method: 'POST',
      headers: buildLaravelHeaders(request, session, {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      }),
      body,
      cache: 'no-store',
      redirect: 'manual',
    });

    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();
    if (response.status >= 300 && response.status < 400) {
      return jsonError('Laravel redirected the fees report request instead of returning JSON.', inferHtmlStatus(response, text), {
        location: response.headers.get('location') || '',
      });
    }

    const payload = parseJsonPayload(text);
    if (payload === null) {
      return jsonError('Laravel returned HTML instead of JSON for the fees report request.', inferHtmlStatus(response, text), {
        preview: summarizeHtml(text),
        backend_status: response.status,
        content_type: contentType || 'unknown',
      });
    }

    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Unable to connect to the Laravel fees report endpoint.', 502);
  }
}

export async function proxyFeesReportTextGet(request: NextRequest, laravelPath: string) {
  const session = readSession(request);

  if (!session.baseUrl) {
    return new NextResponse('Laravel base URL is missing for the fees report proxy.', { status: 400 });
  }

  const targetUrl = buildLaravelUrl(request, laravelPath, session);

  try {
    const response = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: buildLaravelHeaders(request, session, {
        Accept: 'text/html,application/xhtml+xml',
      }),
      cache: 'no-store',
      redirect: 'manual',
    });

    if (response.status >= 300 && response.status < 400) {
      return new NextResponse('Laravel redirected the fees report request instead of returning HTML.', { status: 502 });
    }

    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    return new NextResponse(error instanceof Error ? error.message : 'Unable to connect to the Laravel fees report endpoint.', { status: 502 });
  }
}
