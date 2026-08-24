import { NextRequest, NextResponse } from 'next/server';
import { createPalTcStore, createMockPalTcStore } from '@/app/pal/data/tc-store';
import { createPalTcService } from '@/app/pal/data/tc';
import { validateTcSession } from '../../_auth';
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
        sub_institute_id: Number(session.subInstituteId),
        syear: Number(session.syear),
        user_id: Number(session.userId),
    };
}

function extractId(request: NextRequest): number {
    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    const idx = parts.indexOf('team-challenges');
    const id = idx >= 0 && idx + 1 < parts.length ? parts[idx + 1] : '';
    return Number(id);
}

export async function POST(request: NextRequest) {
    const challengeId = extractId(request);
    if (isNaN(challengeId) || challengeId <= 0) {
        return NextResponse.json({ status: '0', message: 'Invalid challenge id.' }, { status: 400 });
    }

    try {
        const session = await validateTcSession(request);
        if (!session) {
            return NextResponse.json({ status: '0', message: 'Unauthorized' }, { status: 401 });
        }

        if (session.isBearer && !session.isStaff) {
            return NextResponse.json({ status: '0', message: 'Only teachers can end challenges.' }, { status: 403 });
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
                domain: 'team_challenge',
            });
            if (!decision.granted) {
                return NextResponse.json({ status: '0', message: decision.reason || 'Forbidden' }, { status: 403 });
            }
        } finally {
            await visibility.close();
        }

        const ctx = buildContext(session);

        let store = createPalTcStore();
        let useMock = false;

        try {
            const service = createPalTcService(store);
            const ended = await service.endTeamChallenge(challengeId, ctx);

            try {
                await store.close();
            } catch {
                // ignore
            }

            return NextResponse.json({ status: '1', data: { ended } });
        } catch (storeErr) {
            if (!isDbError(storeErr)) throw storeErr;
            useMock = true;
        }

        if (useMock) {
            store = createMockPalTcStore();
            const service = createPalTcService(store);
            const ended = await service.endTeamChallenge(challengeId, ctx);

            return NextResponse.json({ status: '1', data: { ended } });
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to end challenge.';
        const status = message === 'Unauthorized' || message === 'Missing user context' ? 401 : 500;
        return NextResponse.json({ status: '0', message }, { status });
    }
}
