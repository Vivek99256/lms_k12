import { NextRequest, NextResponse } from 'next/server';
import { getDbConfig } from '@/app/pal/data/pal-pb-store-config';
import { createPalPbStore } from '@/app/pal/data/pal-pb-store';
import { validateGamSession } from '@/app/pal/data/gamification-auth';
import { createVisibilityServiceFromEnv } from '@/app/pal/data/visibility-service';

export const runtime = 'nodejs';

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
                domain: 'notifications',
            });
            if (!decision.granted) {
                return NextResponse.json({ status: '0', message: decision.reason || 'Forbidden' }, { status: 403 });
            }
        } finally {
            await visibility.close();
        }

        const limit = Math.min(100, Math.max(1, Number(new URL(request.url).searchParams.get('limit') || 20)));

        const store = createPalPbStore(getDbConfig());
        const notifications = await store.getNotifications(session.userId, session.subInstituteId, session.syear, limit);

        return NextResponse.json({
            status: '1',
            data: {
                notifications,
                limit,
            },
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to load notifications.';
        if (message.includes("doesn't exist") || message.includes('does not exist')) {
            return NextResponse.json({ status: '1', data: { notifications: [], limit: 20 } });
        }
        const status = message === 'Unauthorized' || message === 'Missing user context' ? 401 : 500;
        return NextResponse.json({ status: '0', message }, { status });
    }
}
