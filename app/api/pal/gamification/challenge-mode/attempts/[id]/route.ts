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
    const idx = parts.indexOf('attempts');
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

        const attemptId = extractId(request);
        if (Number.isNaN(attemptId)) {
            return NextResponse.json({ status: '0', message: 'Invalid attempt ID.' }, { status: 400 });
        }

        const ctx = buildContext(session);
        let store = createPalCmStore();
        let useMock = false;

        try {
            const service = createPalCmService(store);
            const attempt = await service.getAttempt(attemptId, ctx);

            try { await store.close(); } catch { /* ignore */ }

            if (!attempt) {
                return NextResponse.json({ status: '0', message: 'Attempt not found.' }, { status: 404 });
            }

            if (String(attempt.user_id) !== session.userId) {
                return NextResponse.json({ status: '0', message: 'Forbidden' }, { status: 403 });
            }

            return NextResponse.json({ status: '1', data: { attempt } });
        } catch (storeErr) {
            if (!isDbError(storeErr)) throw storeErr;
            useMock = true;
        }

        if (useMock) {
            store = createMockPalCmStore();
            const service = createPalCmService(store);
            const attempt = await service.getAttempt(attemptId, ctx);
            if (!attempt) {
                return NextResponse.json({ status: '0', message: 'Attempt not found.' }, { status: 404 });
            }
            return NextResponse.json({ status: '1', data: { attempt } });
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to load attempt.';
        const status = message === 'Unauthorized' || message === 'Missing user context' ? 401 : 500;
        return NextResponse.json({ status: '0', message }, { status });
    }
}
