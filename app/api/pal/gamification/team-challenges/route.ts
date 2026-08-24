import { NextRequest, NextResponse } from 'next/server';
import { createPalTcStore, createMockPalTcStore } from '@/app/pal/data/tc-store';
import { createPalTcService } from '@/app/pal/data/tc';
import { validateTcSession } from './_auth';
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

export async function GET(request: NextRequest) {
    try {
        const session = await validateTcSession(request);
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
                domain: 'team_challenge',
            });
            if (!decision.granted) {
                return NextResponse.json({ status: '0', message: decision.reason || 'Forbidden' }, { status: 403 });
            }
        } finally {
            await visibility.close();
        }

        const ctx = buildContext(session);
        const activeOnly = String(new URL(request.url).searchParams.get('active') || '').trim().toLowerCase() === 'true';

        let store = createPalTcStore();
        let useMock = false;

        try {
            const service = createPalTcService(store);
            let challenges = await service.fetchTeamChallenges(ctx);

            if (session.isBearer) {
                if (session.isStaff) {
                    challenges = challenges.filter((c) => c.created_by === Number(session.userId));
                } else {
                    challenges = challenges.filter((c) => c.has_joined);
                }
            }

            const filtered = activeOnly
                ? challenges.filter((c) => c.status === 'active' && c.progress.status !== 'completed' && c.progress.status !== 'ended')
                : challenges;

            try {
                await store.close();
            } catch {
                // ignore close error
            }

            return NextResponse.json({
                status: '1',
                data: { challenges: filtered },
            });
        } catch (storeErr) {
            if (!isDbError(storeErr)) throw storeErr;
            useMock = true;
        }

        if (useMock) {
            store = createMockPalTcStore();
            const service = createPalTcService(store);
            let challenges = await service.fetchTeamChallenges(ctx);

            if (session.isBearer) {
                if (session.isStaff) {
                    challenges = challenges.filter((c) => c.created_by === Number(session.userId));
                } else {
                    challenges = challenges.filter((c) => c.has_joined);
                }
            }

            const filtered = activeOnly
                ? challenges.filter((c) => c.status === 'active' && c.progress.status !== 'completed' && c.progress.status !== 'ended')
                : challenges;

            return NextResponse.json({
                status: '1',
                data: { challenges: filtered },
            });
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to load team challenges.';
        const status = message === 'Unauthorized' || message === 'Missing user context' ? 401 : 500;
        return NextResponse.json({ status: '0', message }, { status });
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await validateTcSession(request);
        if (!session) {
            return NextResponse.json({ status: '0', message: 'Unauthorized' }, { status: 401 });
        }

        if (session.isBearer && !session.isStaff) {
            return NextResponse.json({ status: '0', message: 'Only teachers can create challenges.' }, { status: 403 });
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

        let body: Record<string, unknown>;
        try {
            body = (await request.json()) as Record<string, unknown>;
        } catch {
            return NextResponse.json({ status: '0', message: 'Invalid JSON body.' }, { status: 400 });
        }

        const data = {
            title: String(body.title || ''),
            description: body.description ? String(body.description) : null,
            challenge_type: String(body.challenge_type || 'mastery_sprint'),
            target_type: String(body.target_type || 'concepts_mastered'),
            target_value: Number(body.target_value || 0),
            reward_type: body.reward_type ? String(body.reward_type) : null,
            reward_value: body.reward_value ? String(body.reward_value) : null,
            grade_id: body.grade_id ? Number(body.grade_id) : null,
            standard_id: body.standard_id ? Number(body.standard_id) : null,
            division_id: body.division_id ? Number(body.division_id) : null,
            start_date: body.start_date ? String(body.start_date) : null,
            deadline: body.deadline ? String(body.deadline) : null,
        };

        let store = createPalTcStore();
        let useMock = false;

        try {
            const service = createPalTcService(store);
            const challengeId = await service.createTeamChallenge(data as unknown as Parameters<typeof service.createTeamChallenge>[0], ctx);

            try {
                await store.close();
            } catch {
                // ignore
            }

            return NextResponse.json({ status: '1', data: { challengeId } });
        } catch (storeErr) {
            if (!isDbError(storeErr)) throw storeErr;
            useMock = true;
        }

        if (useMock) {
            store = createMockPalTcStore();
            const service = createPalTcService(store);
            const challengeId = await service.createTeamChallenge(data as unknown as Parameters<typeof service.createTeamChallenge>[0], ctx);

            return NextResponse.json({ status: '1', data: { challengeId } });
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to create challenge.';
        const status = message === 'Unauthorized' || message === 'Missing user context' ? 401 : 500;
        return NextResponse.json({ status: '0', message }, { status });
    }
}
