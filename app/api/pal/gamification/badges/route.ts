import { NextRequest, NextResponse } from 'next/server';
import { createPalBadgeStore, createMockPalBadgeStore } from '@/app/pal/data/pal-badge-store';
import { validateGamSession } from '@/app/pal/data/gamification-auth';
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

export async function GET(request: NextRequest) {
    try {
        const session = await validateGamSession(request);
        if (!session) {
            return NextResponse.json({ status: '0', message: 'Missing user context' }, { status: 401 });
        }

        const visibility = createVisibilityServiceFromEnv();
        try {
            const decision = await visibility.checkAccess({
                actorUserId: session.userId,
                actorRole: session.role,
                actorSubInstituteId: session.subInstituteId,
                actorSyear: session.syear,
                targetUserId: session.userId,
                targetSubInstituteId: session.subInstituteId,
                targetSyear: session.syear,
                domain: 'badges',
            });
            if (!decision.granted) {
                return NextResponse.json({ status: '0', message: decision.reason || 'Forbidden' }, { status: 403 });
            }
        } finally {
            await visibility.close();
        }

        let store = createPalBadgeStore();
        let useMock = false;

        try {
            const [progress, summary] = await Promise.all([
                store.getBadgeProgress(session.userId, session.subInstituteId, session.syear),
                store.getBadgeSummary(session.userId, session.subInstituteId, session.syear),
            ]);
            return NextResponse.json({
                status: '1',
                data: {
                    summary,
                    badges: progress,
                },
            });
        } catch (storeErr) {
            if (!isDbError(storeErr)) throw storeErr;
            useMock = true;
        }

        if (useMock) {
            store = createMockPalBadgeStore();
            const [progress, summary] = await Promise.all([
                store.getBadgeProgress(session.userId, session.subInstituteId, session.syear),
                store.getBadgeSummary(session.userId, session.subInstituteId, session.syear),
            ]);
            return NextResponse.json({
                status: '1',
                data: {
                    summary,
                    badges: progress,
                },
            });
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to load badge data.';
        const status = message === 'Unauthorized' || message === 'Missing user context' ? 401 : 500;
        return NextResponse.json({ status: '0', message }, { status });
    }
}
