import { API_BASE_URL } from '@/app/components/utils/api_url';

export type SessionContext = {
  baseUrl: string;
  token: string;
  subInstituteId: string;
  syear: string;
  userId: string;
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

    let syear =
      readString(localStorage.getItem('selectedAcademicYear')) ||
      readString(localStorage.getItem('syear'));
    if (!syear && academicYears.length > 0) {
      syear = readString(
        (academicYears[0] as Record<string, unknown>).syear ??
          (academicYears[0] as Record<string, unknown>).academic_year
      );
    }
    if (!syear) {
      syear = readString(
        userData.academic_year_id ??
          userData.academicYearId ??
          menuContext.academic_year_id
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
      syear: normalizeAcademicYear(syear),
      userId: readString(
        userData.user_id ??
          userData.userId ??
          menuContext.user_id ??
          menuContext.userId
      ),
    };
  } catch {
    return {
      baseUrl: API_BASE_URL.replace(/\/$/, ''),
      token: '',
      subInstituteId: '',
      syear: '',
      userId: '',
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
