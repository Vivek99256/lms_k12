import { NextRequest, NextResponse } from 'next/server';
import { validateGamSession } from '@/app/pal/data/gamification-auth';
import { createVisibilityServiceFromEnv } from '@/app/pal/data/visibility-service';
import { createPalPbStore } from '@/app/pal/data/pal-pb-store';
import { createPalBadgeStore } from '@/app/pal/data/pal-badge-store';
import { getDbConfig } from '@/app/pal/data/pal-pb-store-config';

export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
    const { studentId } = await params;
    try {
        const session = await validateGamSession(request);
        if (!session) {
            return NextResponse.json({ status: '0', message: 'Missing user context' }, { status: 401 });
        }

        const targetUserId = studentId;
        const targetSubInstituteId = session.subInstituteId;
        const targetSyear = session.syear;

        const visibility = createVisibilityServiceFromEnv();
        try {
            const domains = ['mastery', 'badges', 'streak', 'personal_best', 'career_quest', 'team_challenge', 'challenge_mode', 'notifications'] as const;
            const permissions = await Promise.all(
                domains.map(async (domain) => {
                    const decision = await visibility.checkAccess({
                        actorUserId: session.userId,
                        actorRole: session.role,
                        actorSubInstituteId: session.subInstituteId,
                        actorSyear: session.syear,
                        targetUserId,
                        targetSubInstituteId,
                        targetSyear,
                        domain,
                    });
                    return {
                        domain,
                        granted: decision.granted,
                        accessLevel: decision.accessLevel,
                        canViewPersonal: decision.canViewPersonal,
                        canViewAggregate: decision.canViewAggregate,
                        canViewMilestone: decision.canViewMilestone,
                        canViewFull: decision.canViewFull,
                    };
                })
            );

            const allowedDomains = permissions.filter((p) => p.granted).map((p) => p.domain);

            if (allowedDomains.length === 0) {
                return NextResponse.json({ status: '0', message: 'Forbidden' }, { status: 403 });
            }

            const pbStore = createPalPbStore(getDbConfig());
            const badgeStore = createPalBadgeStore();

            const summary: Record<string, unknown> = {};
            let badges: Record<string, unknown>[] = [];
            let streak: Record<string, unknown>[] = [];
            let mastery: Record<string, unknown>[] = [];
            let personalBest: Record<string, unknown>[] = [];
            let notifications: Record<string, unknown>[] = [];

            try {
                if (allowedDomains.includes('badges')) {
                    const [progress, badgeSummary] = await Promise.all([
                        badgeStore.getBadgeProgress(targetUserId, targetSubInstituteId, targetSyear),
                        badgeStore.getBadgeSummary(targetUserId, targetSubInstituteId, targetSyear),
                    ]);
                    badges = progress.map((b) => ({
                        badgeCode: b.badgeCode,
                        badgeName: b.badgeName,
                        category: b.category,
                        description: b.description,
                        icon: b.icon,
                        color: b.color,
                        earned: b.earned,
                        earnedAt: b.earnedAt,
                        progress: b.progress,
                    }));
                    summary.badges = badgeSummary;
                }

                if (allowedDomains.includes('streak')) {
                    streak = await pbStore.getStreakRecords(targetUserId, targetSubInstituteId, targetSyear);
                }

                if (allowedDomains.includes('mastery')) {
                    mastery = await pbStore.getMasteryRecords(targetUserId, targetSubInstituteId, targetSyear);
                }

                if (allowedDomains.includes('personal_best')) {
                    personalBest = await pbStore.getFluencyRecords(targetUserId, targetSubInstituteId, targetSyear);
                }

                if (allowedDomains.includes('notifications')) {
                    notifications = await pbStore.getNotifications(targetUserId, targetSubInstituteId, targetSyear, 20);
                }
            } catch {
                // ignore data fetch errors
            }

            return NextResponse.json({
                status: '1',
                data: {
                    studentId: targetUserId,
                    permissions: permissions.map((p) => ({
                        domain: p.domain,
                        granted: p.granted,
                        accessLevel: p.accessLevel,
                    })),
                    summary,
                    badges,
                    streak,
                    mastery,
                    personalBest,
                    notifications,
                },
            });
        } finally {
            await visibility.close();
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to load student data.';
        const status = message === 'Missing user context' ? 401 : 500;
        return NextResponse.json({ status: '0', message }, { status });
    }
}
