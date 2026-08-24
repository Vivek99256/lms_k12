import { NextRequest } from 'next/server';
import { API_BASE_URL } from '@/app/components/utils/api_url';

function getBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_ERP_BASE_URL || API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
}

async function laravelGet(path: string, cookie?: string, authorization?: string): Promise<Record<string, unknown> | null> {
  const baseUrl = getBaseUrl();
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(cookie ? { Cookie: cookie } : {}),
        ...(authorization ? { Authorization: authorization } : {}),
      },
      cache: 'no-store',
    });

    if (!res.ok) return null;
    const payload = await res.json().catch(() => null);
    return payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function validateSession(request: NextRequest): Promise<{ userId: string; subInstituteId: string; syear: string; isStaff: boolean } | null> {
  const cookie = request.headers.get('cookie');
  const authorization = request.headers.get('authorization');

  if (!cookie && !authorization) {
    return null;
  }

  const profileRecord = await laravelGet('/api/user-profiles/me', cookie ?? undefined, authorization ?? undefined);
  if (!profileRecord) return null;

  const profile = profileRecord.data && typeof profileRecord.data === 'object' ? (profileRecord.data as Record<string, unknown>) : profileRecord;
  const userId = String(profile.user_id ?? profile.id ?? '').trim();
  const subInstituteId = String(profile.sub_institute_id ?? profile.subInstituteId ?? '').trim();
  const syear = String(profile.syear ?? profile.academic_year ?? '').trim();
  const userProfileName = String(profile.user_profile_name ?? profile.profileName ?? profile.profile_name ?? '').trim().toLowerCase();

  if (!userId) return null;

  const isStaff = userProfileName !== 'student';

  return { userId, subInstituteId, syear, isStaff };
}
