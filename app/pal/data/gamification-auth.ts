import { NextRequest } from 'next/server';
import { API_BASE_URL } from '@/app/components/utils/api_url';

export type ActorRole = 'student' | 'teacher' | 'parent' | 'admin';

function getBaseUrl(): string {
    return (process.env.NEXT_PUBLIC_ERP_BASE_URL || API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
}

async function laravelGet(path: string, authorization?: string, cookie?: string): Promise<Record<string, unknown> | null> {
    const baseUrl = getBaseUrl();
    try {
        const headers: Record<string, string> = {
            Accept: 'application/json',
            ...(authorization ? { Authorization: authorization } : {}),
            ...(cookie ? { Cookie: cookie } : {}),
        };
        const res = await fetch(`${baseUrl}${path}`, {
            method: 'POST',
            headers,
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

function detectRole(profileName: string): ActorRole {
    const normalized = profileName.trim().toLowerCase();
    if (normalized === 'admin') return 'admin';
    if (normalized === 'parent' || normalized === 'guardian') return 'parent';
    if (normalized === 'student' || normalized === 'learner') return 'student';
    return 'teacher';
}

export async function validateGamSession(request: NextRequest): Promise<{ userId: string; subInstituteId: string; syear: string; role: ActorRole; isBearer: boolean } | null> {
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
            const userProfileName = String(profile.user_profile_name ?? profile.profileName ?? profile.profile_name ?? '').trim();

            if (userId && subInstituteId && syear) {
                return { userId, subInstituteId, syear, role: detectRole(userProfileName), isBearer: true };
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
            const userProfileName = String(profile.user_profile_name ?? profile.profileName ?? profile.profile_name ?? '').trim();

            if (userId && subInstituteId && syear) {
                return { userId, subInstituteId, syear, role: detectRole(userProfileName), isBearer: false };
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

    const profileName = String(url.searchParams.get('profile_name') || 'student').trim();
    return { userId, subInstituteId, syear, role: detectRole(profileName), isBearer: false };
}
