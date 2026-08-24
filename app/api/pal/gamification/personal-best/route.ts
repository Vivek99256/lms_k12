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
                domain: 'personal_best',
            });
            if (!decision.granted) {
                return NextResponse.json({ status: '0', message: decision.reason || 'Forbidden' }, { status: 403 });
            }
        } finally {
            await visibility.close();
        }

        const store = createPalPbStore(getDbConfig());
        const [summary, fluency, streak, mastery, sessionRecords, notifications] = await Promise.all([
            store.getPersonalBestSummary(session.userId, session.subInstituteId, session.syear),
            store.getFluencyRecords(session.userId, session.subInstituteId, session.syear),
            store.getStreakRecords(session.userId, session.subInstituteId, session.syear),
            store.getMasteryRecords(session.userId, session.subInstituteId, session.syear),
            store.getSessionRecords(session.userId, session.subInstituteId, session.syear),
            store.getNotifications(session.userId, session.subInstituteId, session.syear, 20),
        ]);

        return NextResponse.json({
            status: '1',
            data: {
                summary,
                fluency,
                streak,
                mastery,
                session: sessionRecords,
                notifications,
            },
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to load personal best data.';
        if (message.includes("doesn't exist") || message.includes('does not exist')) {
            return NextResponse.json({
                status: '1',
                data: {
                    summary: { fluencyCount: 0, bestFluency: 0, streakCurrent: 0, streakLongest: 0, masteryCount: 0, bestMastery: 0, sessionCount: 0, bestSession: 0 },
                    fluency: [],
                    streak: [],
                    mastery: [],
                    session: [],
                    notifications: [],
                },
            });
        }
        const status = message === 'Unauthorized' || message === 'Missing user context' ? 401 : 500;
        return NextResponse.json({ status: '0', message }, { status });
    }
}
