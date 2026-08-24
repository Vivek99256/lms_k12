import { NextRequest, NextResponse } from 'next/server';
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
            const url = new URL(request.url);
            const targetUserId = url.searchParams.get('target_user_id') || session.userId;
            const targetSubInstituteId = url.searchParams.get('target_sub_institute_id') || session.subInstituteId;
            const targetSyear = url.searchParams.get('target_syear') || session.syear;

            const domains = [
                'mastery',
                'badges',
                'streak',
                'personal_best',
                'career_quest',
                'team_challenge',
                'challenge_mode',
                'notifications',
            ] as const;

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
                        reason: decision.reason,
                    };
                })
            );

            return NextResponse.json({
                status: '1',
                data: {
                    actor: {
                        userId: session.userId,
                        role: session.role,
                        subInstituteId: session.subInstituteId,
                        syear: session.syear,
                        isBearer: session.isBearer,
                    },
                    target: {
                        userId: targetUserId,
                        subInstituteId: targetSubInstituteId,
                        syear: targetSyear,
                    },
                    permissions,
                },
            });
        } finally {
            await visibility.close();
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to load visibility permissions.';
        const status = message === 'Missing user context' ? 401 : 500;
        return NextResponse.json({ status: '0', message }, { status });
    }
}
