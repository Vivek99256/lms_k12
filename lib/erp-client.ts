import { API_BASE_URL } from '@/app/components/utils/api_url';

export type SessionContext = {
  baseUrl: string;
  token: string;
  subInstituteId: string;
  syear: string;
  userId: string;
  termId: string;
  isAdmin: string;
};

export type ApiEnvelope = {
  status?: number | string;
  status_code?: number | string;
  message?: string;
  data?: unknown;
};

export function readString(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

export function readNumber(value: unknown): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

export function normalizeAcademicYear(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const yearMatch = trimmed.match(/\d{4}/);
  return yearMatch ? yearMatch[0] : trimmed;
}

export function normalizeNumericId(value: unknown): string {
  const normalized = readString(value).trim();
  return /^\d+$/.test(normalized) ? normalized : '';
}

export function normalizeApiStatus(payload: ApiEnvelope | null | undefined): string {
  if (!payload) return '';
  return String(payload.status ?? payload.status_code ?? '');
}

/**
 * Optional local-development override for the ERP host.
 *
 * The session's `host_name` normally decides which ERP server the app talks to.
 * When you are running Laravel locally to work on an API that is not deployed
 * yet, set NEXT_PUBLIC_ERP_BASE_URL in .env.local (e.g. http://127.0.0.1:8000)
 * to point every module at that instance instead. Leave it unset and behaviour
 * is exactly as before.
 */
const ERP_BASE_URL_OVERRIDE = (process.env.NEXT_PUBLIC_ERP_BASE_URL || '').replace(/\/$/, '');

export function buildSessionContext(): SessionContext {
  if (typeof window === 'undefined') {
    return {
      baseUrl: ERP_BASE_URL_OVERRIDE || API_BASE_URL.replace(/\/$/, ''),
      token: '',
      subInstituteId: '',
      syear: '',
      userId: '',
      termId: '',
      isAdmin: '',
    };
  }

  try {
    const readStoredRecord = (key: string): Record<string, unknown> => {
      const value = localStorage.getItem(key) ?? sessionStorage.getItem(key) ?? '{}';
      try {
        const parsed = JSON.parse(value) as unknown;
        return parsed && typeof parsed === 'object'
          ? (parsed as Record<string, unknown>)
          : {};
      } catch {
        return {};
      }
    };
    const userData = readStoredRecord('userData');
    const menuContext = readStoredRecord('menuContext');
    const sessionData = readStoredRecord('sessionData');
    const sessionRecords = [userData, menuContext, sessionData];
    const firstValue = (...keys: string[]) => {
      for (const record of sessionRecords) {
        for (const key of keys) {
          if (record[key] != null && record[key] !== '') return record[key];
        }
      }
      return undefined;
    };
    const academicYears = sessionRecords.flatMap((record) =>
      Array.isArray(record.academicYears) ? record.academicYears : []
    );
    const academicTerms = sessionRecords.flatMap((record) =>
      Array.isArray(record.academicTerms) ? record.academicTerms : []
    );

    // Resolve the academic year the way the Laravel session does: the *active*
    // year — the academic term whose date range covers today — which the login
    // payload surfaces via `academicTerms`. `academicYears[0]` is merely the
    // earliest year on file (often empty of data), so it must not be the
    // primary fallback. A `selectedAcademicYear` left in localStorage is only
    // honored when it matches one of this session's real years; a stale or
    // wrong-format value (e.g. a previous "2024-2025") is ignored so it cannot
    // silently blank out reports. Switching years in the header still works
    // because the chosen year is always a valid one.
    const yearOf = (entry: unknown): string => {
      const record =
        entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {};
      return normalizeAcademicYear(readString(record.syear ?? record.academic_year));
    };
    const activeYear =
      (academicTerms.length > 0 ? yearOf(academicTerms[0]) : '') ||
      (academicYears.length > 0 ? yearOf(academicYears[0]) : '');
    const validYears = new Set(
      [...academicTerms, ...academicYears].map(yearOf).filter(Boolean)
    );
    const selectedYear = normalizeAcademicYear(
      readString(localStorage.getItem('selectedAcademicYear') ?? sessionStorage.getItem('selectedAcademicYear')) ||
        readString(localStorage.getItem('syear') ?? sessionStorage.getItem('syear'))
    );
    let syear =
      selectedYear && (validYears.size === 0 || validYears.has(selectedYear))
        ? selectedYear
        : activeYear;
    if (!syear) {
      syear = normalizeAcademicYear(
        readString(
          firstValue('syear', 'academic_year', 'academic_year_id', 'academicYearId')
        )
      );
    }

    return {
      baseUrl:
        ERP_BASE_URL_OVERRIDE ||
        readString(firstValue('host_name', 'hostName')).replace(/\/$/, '') ||
        API_BASE_URL.replace(/\/$/, ''),
      token: readString(
        firstValue('user_token', 'token')
      ),
      subInstituteId: readString(
        firstValue('sub_institute_id', 'subInstituteId') ??
          localStorage.getItem('sub_institute_id')
      ),
      syear,
      userId: readString(
        firstValue('user_id', 'userId')
      ),
      termId: readString(
        normalizeNumericId(
          firstValue(
            'term_id',
            'marking_period_id',
            'academic_term_id'
          ) ??
            localStorage.getItem('term_id')
        )
      ),
      isAdmin: readString(firstValue('is_admin', 'isAdmin')),
    };
  } catch {
    return {
      baseUrl: ERP_BASE_URL_OVERRIDE || API_BASE_URL.replace(/\/$/, ''),
      token: '',
      subInstituteId: '',
      syear: '',
      userId: '',
      termId: '',
      isAdmin: '',
    };
  }
}

export function createAuthHeaders(
  session: SessionContext,
  contentType?: string
): HeadersInit {
  return {
    Accept: 'application/json',
    ...(contentType ? { 'Content-Type': contentType } : {}),
    ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
  };
}

export function appendCommonParams(
  searchParams: URLSearchParams,
  session: SessionContext
) {
  searchParams.set('type', 'API');

  if (session.subInstituteId) {
    searchParams.set('sub_institute_id', session.subInstituteId);
  }

  if (session.syear) {
    searchParams.set('syear', session.syear);
  }
}

/**
 * The ERP API now refuses the `api/*` routes that used to be anonymous
 * (config/api_guard.php in the Laravel repo). Most screens already send the
 * bearer token through createAuthHeaders(), but many older ones call fetch()
 * directly and never did. Rather than patch each of those call sites, this
 * adds the session token to any fetch aimed at the ERP API origin that did
 * not set its own Authorization header.
 *
 * It only ever touches requests to the ERP origin, so the token cannot leak
 * to a third party, and it leaves alone any request that already carries an
 * Authorization header (including the login call, which has no token yet).
 * Safe to call more than once.
 */
export function installErpAuthFetch() {
  if (typeof window === 'undefined') return;
  const w = window as Window & { __erpAuthFetchInstalled?: boolean };
  if (w.__erpAuthFetchInstalled) return;
  w.__erpAuthFetchInstalled = true;

  const nativeFetch = window.fetch.bind(window);

  const erpOrigins = () => {
    const origins = new Set<string>();
    for (const base of [API_BASE_URL, ERP_BASE_URL_OVERRIDE, buildSessionContext().baseUrl]) {
      try {
        if (base) origins.add(new URL(base, window.location.origin).origin);
      } catch {
        /* ignore an unparseable base */
      }
    }
    return origins;
  };

  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const target = new URL(rawUrl, window.location.origin);
      const sameOriginNextApi = target.origin === window.location.origin;
      if (!sameOriginNextApi && erpOrigins().has(target.origin)) {
        const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
        const { token } = buildSessionContext();
        if (token && !headers.has('Authorization')) {
          headers.set('Authorization', `Bearer ${token}`);
          return nativeFetch(input, { ...init, headers });
        }
      }
    } catch {
      /* never let auth decoration break a request */
    }
    return nativeFetch(input, init);
  };
}
