import { NextRequest, NextResponse } from 'next/server';
import { createPalCmStore, createMockPalCmStore } from '@/app/pal/data/cm-store';
import { createPalCmService } from '@/app/pal/data/cm';
import { validateCmSession } from '../_auth';
import { createVisibilityServiceFromEnv } from '@/app/pal/data/visibility-service';

export const runtime = 'nodejs';

function isDbError(err: unknown): boolean {
    if (!err) return false;
    const message = err instanceof Error ? err.message : String(err);
    return (
        message.includes('does not exist') ||
        message.includes("doesn't exist") ||
        message.includes('ECONNREFUSED') ||
        message.includes('ENOTFOUND') ||
        message.includes('ER_ACCESS_DENIED_ERROR') ||
        message.includes('PROTOCOL_CONNECTION_LOST') ||
        message.includes('EPIPE') ||
        message.includes('socket hang up') ||
        message.includes('Connection refused') ||
        message.includes('getaddrinfo') ||
        message.includes('Too many connections')
    );
}

function buildContext(session: { userId: string; subInstituteId: string; syear: string }) {
    return {
        sub_institute_id: session.subInstituteId,
        syear: session.syear,
        user_id: session.userId,
    };
}

export async function GET(request: NextRequest) {
    try {
        const session = await validateCmSession(request);
        if (!session) {
            return NextResponse.json({ status: '0', message: 'Unauthorized' }, { status: 401 });
        }

        const visibility = createVisibilityServiceFromEnv();
        try {
            const decision = await visibility.checkAccess({
                actorUserId: session.userId,
                actorRole: session.isStaff ? 'teacher' : 'student',
                actorSubInstituteId: session.subInstituteId,
                actorSyear: session.syear,
                targetUserId: session.userId,
                targetSubInstituteId: session.subInstituteId,
                targetSyear: session.syear,
                domain: 'challenge_mode',
            });
            if (!decision.granted) {
                return NextResponse.json({ status: '0', message: decision.reason || 'Forbidden' }, { status: 403 });
            }
        } finally {
            await visibility.close();
        }

        if (!session.isBearer || session.isStaff) {
            return NextResponse.json({ status: '0', message: 'Only students can view available challenges.' }, { status: 403 });
        }

        const ctx = buildContext(session);
        let store = createPalCmStore();
        let useMock = false;

        try {
            const service = createPalCmService(store);
            const challenges = await service.fetchAvailableChallenges(ctx);

            try { await store.close(); } catch { /* ignore */ }

            return NextResponse.json({ status: '1', data: { challenges } });
        } catch (storeErr) {
            if (!isDbError(storeErr)) throw storeErr;
            useMock = true;
        }

        if (useMock) {
            store = createMockPalCmStore();
            const service = createPalCmService(store);
            const challenges = await service.fetchAvailableChallenges(ctx);
            return NextResponse.json({ status: '1', data: { challenges } });
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to load challenges.';
        const status = message === 'Unauthorized' || message === 'Missing user context' ? 401 : 500;
        return NextResponse.json({ status: '0', message }, { status });
    }
}
