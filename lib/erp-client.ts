import { API_BASE_URL } from '@/app/components/utils/api_url';

export type SessionContext = {
  baseUrl: string;
  token: string;
  subInstituteId: string;
  syear: string;
  userId: string;
  termId: string;
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

export function buildSessionContext(): SessionContext {
  if (typeof window === 'undefined') {
    return {
      baseUrl: API_BASE_URL.replace(/\/$/, ''),
      token: '',
      subInstituteId: '',
      syear: '',
      userId: '',
      termId: '',
    };
  }

  try {
    const userData = JSON.parse(
      localStorage.getItem('userData') || '{}'
    ) as Record<string, unknown>;
    const menuContext = JSON.parse(
      localStorage.getItem('menuContext') || '{}'
    ) as Record<string, unknown>;
    const academicYears = Array.isArray(userData.academicYears)
      ? userData.academicYears
      : [];
    const academicTerms = Array.isArray(userData.academicTerms)
      ? userData.academicTerms
      : [];

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
      readString(localStorage.getItem('selectedAcademicYear')) ||
        readString(localStorage.getItem('syear'))
    );
    let syear =
      selectedYear && (validYears.size === 0 || validYears.has(selectedYear))
        ? selectedYear
        : activeYear;
    if (!syear) {
      syear = normalizeAcademicYear(
        readString(
          userData.academic_year_id ??
            userData.academicYearId ??
            menuContext.academic_year_id
        )
      );
    }

    return {
      baseUrl:
        readString(userData.host_name).replace(/\/$/, '') ||
        API_BASE_URL.replace(/\/$/, ''),
      token: readString(
        userData.user_token ??
          userData.token ??
          menuContext.user_token ??
          menuContext.token
      ),
      subInstituteId: readString(
        userData.sub_institute_id ??
          menuContext.sub_institute_id ??
          localStorage.getItem('sub_institute_id')
      ),
      syear,
      userId: readString(
        userData.user_id ??
          userData.userId ??
          menuContext.user_id ??
          menuContext.userId
      ),
      termId: readString(
        normalizeNumericId(
          userData.term_id ??
            menuContext.term_id ??
            userData.marking_period_id ??
            menuContext.marking_period_id ??
            userData.academic_term_id ??
            menuContext.academic_term_id ??
            localStorage.getItem('term_id')
        )
      ),
    };
  } catch {
    return {
      baseUrl: API_BASE_URL.replace(/\/$/, ''),
      token: '',
      subInstituteId: '',
      syear: '',
      userId: '',
      termId: '',
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
