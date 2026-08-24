import { NextRequest } from 'next/server';
import { API_BASE_URL } from '@/app/components/utils/api_url';

function getBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_ERP_BASE_URL || API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
}

async function laravelGet(path: string, authorization?: string, cookie?: string): Promise<Record<string, unknown> | null> {
  const baseUrl = getBaseUrl();
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        ...(authorization ? { Authorization: authorization } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: '{}',
      cache: 'no-store',
    });

    if (!res.ok) return null;
    const payload = await res.json().catch(() => null);
    return payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function validateTcSession(request: NextRequest): Promise<{ userId: string; subInstituteId: string; syear: string; isStaff: boolean; isBearer: boolean } | null> {
  const authorization = request.headers.get('authorization');
  const cookie = request.headers.get('cookie');

  if (authorization) {
    const profileRecord = await laravelGet('/api/user-profiles/me', authorization, cookie || undefined);
    if (profileRecord) {
      const profile = profileRecord.data && typeof profileRecord.data === 'object'
        ? (profileRecord.data as Record<string, unknown>)
        : profileRecord;
      const userId = String(profile.user_id ?? profile.id ?? '').trim();
      const subInstituteId = String(profile.sub_institute_id ?? profile.subInstituteId ?? '').trim();
      const syear = String(profile.syear ?? profile.academic_year ?? '').trim();
      const userProfileName = String(profile.user_profile_name ?? profile.profileName ?? profile.profile_name ?? '').trim().toLowerCase();

      if (userId && subInstituteId && syear) {
        return { userId, subInstituteId, syear, isStaff: userProfileName !== 'student', isBearer: true };
      }
    }
  }

  if (cookie) {
    const profileRecord = await laravelGet('/api/user-profiles/me', undefined, cookie);
    if (profileRecord) {
      const profile = profileRecord.data && typeof profileRecord.data === 'object'
        ? (profileRecord.data as Record<string, unknown>)
        : profileRecord;
      const userId = String(profile.user_id ?? profile.id ?? '').trim();
      const subInstituteId = String(profile.sub_institute_id ?? profile.subInstituteId ?? '').trim();
      const syear = String(profile.syear ?? profile.academic_year ?? '').trim();
      const userProfileName = String(profile.user_profile_name ?? profile.profileName ?? profile.profile_name ?? '').trim().toLowerCase();

      if (userId && subInstituteId && syear) {
        return { userId, subInstituteId, syear, isStaff: userProfileName !== 'student', isBearer: false };
      }
    }
  }

  const url = new URL(request.url);
  const userId = String(url.searchParams.get('user_id') || '').trim();
  const subInstituteId = String(url.searchParams.get('sub_institute_id') || '').trim();
  const syear = String(url.searchParams.get('syear') || '').trim();

  if (!userId || !subInstituteId || !syear) {
    return null;
  }

  const profileName = String(url.searchParams.get('profile_name') || '').trim().toLowerCase();
  const isStaff = profileName !== 'student';

  return { userId, subInstituteId, syear, isStaff, isBearer: false };
}
