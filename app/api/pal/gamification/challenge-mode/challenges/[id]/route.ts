import { NextRequest, NextResponse } from 'next/server';
import { createPalCmStore, createMockPalCmStore } from '@/app/pal/data/cm-store';
import { createPalCmService } from '@/app/pal/data/cm';
import { validateCmSession } from '../../_auth';
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

function extractId(request: NextRequest): number {
    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    const idx = parts.indexOf('challenges');
    const id = idx >= 0 && idx + 1 < parts.length ? parts[idx + 1] : '';
    return Number(id);
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

        const challengeId = extractId(request);
        if (Number.isNaN(challengeId)) {
            return NextResponse.json({ status: '0', message: 'Invalid challenge ID.' }, { status: 400 });
        }

        const ctx = buildContext(session);
        let store = createPalCmStore();
        let useMock = false;

        try {
            const service = createPalCmService(store);
            const challenge = await service.fetchChallengeById(challengeId, ctx);

            try { await store.close(); } catch { /* ignore */ }

            if (!challenge) {
                return NextResponse.json({ status: '0', message: 'Challenge not found.' }, { status: 404 });
            }

            return NextResponse.json({ status: '1', data: { challenge } });
        } catch (storeErr) {
            if (!isDbError(storeErr)) throw storeErr;
            useMock = true;
        }

        if (useMock) {
            store = createMockPalCmStore();
            const service = createPalCmService(store);
            const challenge = await service.fetchChallengeById(challengeId, ctx);
            if (!challenge) {
                return NextResponse.json({ status: '0', message: 'Challenge not found.' }, { status: 404 });
            }
            return NextResponse.json({ status: '1', data: { challenge } });
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to load challenge.';
        const status = message === 'Unauthorized' || message === 'Missing user context' ? 401 : 500;
        return NextResponse.json({ status: '0', message }, { status });
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await validateCmSession(request);
        if (!session) {
            return NextResponse.json({ status: '0', message: 'Unauthorized' }, { status: 401 });
        }

        const challengeId = extractId(request);
        if (Number.isNaN(challengeId)) {
            return NextResponse.json({ status: '0', message: 'Invalid challenge ID.' }, { status: 400 });
        }

        if (!session.isBearer || session.isStaff) {
            return NextResponse.json({ status: '0', message: 'Only students can start challenge attempts.' }, { status: 403 });
        }

        const ctx = buildContext(session);
        let store = createPalCmStore();
        let useMock = false;

        try {
            const service = createPalCmService(store);
            const attempt = await service.startAttempt(challengeId, ctx);

            try { await store.close(); } catch { /* ignore */ }

            if (!attempt) {
                return NextResponse.json({ status: '0', message: 'Unable to start attempt. Ensure you have opted in and the challenge is available.' }, { status: 400 });
            }

            return NextResponse.json({ status: '1', data: { attempt } });
        } catch (storeErr) {
            if (!isDbError(storeErr)) throw storeErr;
            useMock = true;
        }

        if (useMock) {
            store = createMockPalCmStore();
            const service = createPalCmService(store);
            const attempt = await service.startAttempt(challengeId, ctx);
            if (!attempt) {
                return NextResponse.json({ status: '0', message: 'Unable to start attempt. Ensure you have opted in and the challenge is available.' }, { status: 400 });
            }
            return NextResponse.json({ status: '1', data: { attempt } });
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to start attempt.';
        const status = message === 'Unauthorized' || message === 'Missing user context' ? 401 : 500;
        return NextResponse.json({ status: '0', message }, { status });
    }
}
