import { NextRequest, NextResponse } from 'next/server';
import { getDbConfig } from '@/app/pal/data/pal-pb-store-config';
import { createPalSsStore, createMockSessionSummaryStore } from '@/app/pal/data/ss-store';
import { createPalPbStore } from '@/app/pal/data/pal-pb-store';
import { createPalCqStore, createMockPalCqStore } from '@/app/pal/data/cq-store';
import { createPalSsService } from '@/app/pal/data/ss';
import { validateSsSession } from '../_auth';
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

function extractSessionId(request: NextRequest): string {
    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    const summaryIdx = parts.indexOf('session-summary');
    const id = summaryIdx >= 0 && summaryIdx + 1 < parts.length ? parts[summaryIdx + 1] : '';
    return decodeURIComponent(id);
}

export async function GET(request: NextRequest) {
    try {
        const session = await validateSsSession(request);
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
                domain: 'personal_best',
            });
            if (!decision.granted) {
                return NextResponse.json({ status: '0', message: decision.reason || 'Forbidden' }, { status: 403 });
            }
        } finally {
            await visibility.close();
        }

        const sessionId = extractSessionId(request);
        if (!sessionId) {
            return NextResponse.json({ status: '0', message: 'Missing session ID.' }, { status: 400 });
        }

        const userId = session.userId;
        const subInstituteId = session.subInstituteId;
        const syear = session.syear;

        function makeMockPbStore() {
            return {
                getStreakRecord: async () => null,
                getNotifications: async () => [],
            } as unknown as ReturnType<typeof createPalPbStore>;
        }

        let store = createPalSsStore();
        let pbStore = createPalPbStore(getDbConfig());
        let cqStore = createPalCqStore();
        let useMock = false;

        try {
            const service = createPalSsService(store, pbStore, cqStore);
            const summary = await service.getSessionSummary(userId, subInstituteId, syear, sessionId);

            try {
                await store.close();
                await cqStore.close();
            } catch {
                // ignore close errors
            }

            if (!summary) {
                return NextResponse.json({ status: '0', message: 'Session summary not found.' }, { status: 404 });
            }

            return NextResponse.json({ status: '1', data: summary });
        } catch (storeErr) {
            if (!isDbError(storeErr)) throw storeErr;
            useMock = true;
        }

        if (useMock) {
            store = createMockSessionSummaryStore();
            pbStore = makeMockPbStore();
            cqStore = createMockPalCqStore();
            const service = createPalSsService(store, pbStore, cqStore);
            const summary = await service.getSessionSummary(userId, subInstituteId, syear, sessionId);

            try {
                await store.close();
                await cqStore.close();
            } catch {
                // ignore close errors
            }

            if (!summary) {
                return NextResponse.json({ status: '0', message: 'Session summary not found.' }, { status: 404 });
            }

            return NextResponse.json({ status: '1', data: summary });
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to load session summary.';
        const status = message === 'Unauthorized' || message === 'Missing user context' ? 401 : 500;
        return NextResponse.json({ status: '0', message }, { status });
    }
}
