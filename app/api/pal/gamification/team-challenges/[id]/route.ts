import { NextRequest, NextResponse } from 'next/server';
import { createPalTcStore, createMockPalTcStore } from '@/app/pal/data/tc-store';
import { createPalTcService } from '@/app/pal/data/tc';
import type { TeamChallengeUpdateData } from '@/app/pal/data/tc-types';
import { validateTcSession } from '../_auth';
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

export async function GET(request: NextRequest) {
    const challengeId = extractId(request);
    if (isNaN(challengeId) || challengeId <= 0) {
        return NextResponse.json({ status: '0', message: 'Invalid challenge id.' }, { status: 400 });
    }

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

        let store = createPalTcStore();
        let useMock = false;

        try {
            const service = createPalTcService(store);
            const detail = await service.fetchChallengeDetail(challengeId, ctx);

            try {
                await store.close();
            } catch {
                // ignore
            }

            if (!detail) {
                return NextResponse.json({ status: '0', message: 'Challenge not found.' }, { status: 404 });
            }

            if (!session.isStaff) {
                const isParticipant = detail.participants.some((p) => p.user_id === Number(session.userId));
                if (!isParticipant) {
                    return NextResponse.json({ status: '0', message: 'You are not a participant in this challenge.' }, { status: 403 });
                }
                detail.contributions = detail.contributions.filter((c) => c.user_id === Number(session.userId));
                detail.participants = detail.participants.filter((p) => p.user_id === Number(session.userId));
            }

            return NextResponse.json({ status: '1', data: { challenge: detail } });
        } catch (storeErr) {
            if (!isDbError(storeErr)) throw storeErr;
            useMock = true;
        }

        if (useMock) {
            store = createMockPalTcStore();
            const service = createPalTcService(store);
            const detail = await service.fetchChallengeDetail(challengeId, ctx);

            if (!detail) {
                return NextResponse.json({ status: '0', message: 'Challenge not found.' }, { status: 404 });
            }

            if (!session.isStaff) {
                const isParticipant = detail.participants.some((p) => p.user_id === Number(session.userId));
                if (!isParticipant) {
                    return NextResponse.json({ status: '0', message: 'You are not a participant in this challenge.' }, { status: 403 });
                }
                detail.contributions = detail.contributions.filter((c) => c.user_id === Number(session.userId));
                detail.participants = detail.participants.filter((p) => p.user_id === Number(session.userId));
            }

            return NextResponse.json({ status: '1', data: { challenge: detail } });
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to load challenge.';
        const status = message === 'Unauthorized' || message === 'Missing user context' ? 401 : 500;
        return NextResponse.json({ status: '0', message }, { status });
    }
}

export async function PATCH(request: NextRequest) {
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
            return NextResponse.json({ status: '0', message: 'Only teachers can update challenges.' }, { status: 403 });
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

        const data: Record<string, unknown> = {};
        if (body.title !== undefined) data.title = String(body.title);
        if (body.description !== undefined) data.description = body.description ? String(body.description) : null;
        if (body.challenge_type !== undefined) data.challenge_type = String(body.challenge_type);
        if (body.target_type !== undefined) data.target_type = String(body.target_type);
        if (body.target_value !== undefined) data.target_value = Number(body.target_value);
        if (body.reward_type !== undefined) data.reward_type = body.reward_type ? String(body.reward_type) : null;
        if (body.reward_value !== undefined) data.reward_value = body.reward_value ? String(body.reward_value) : null;
        if (body.status !== undefined) data.status = String(body.status);
        if (body.start_date !== undefined) data.start_date = body.start_date ? String(body.start_date) : null;
        if (body.deadline !== undefined) data.deadline = body.deadline ? String(body.deadline) : null;
        if (body.ended_at !== undefined) data.ended_at = body.ended_at ? String(body.ended_at) : null;

        let store = createPalTcStore();
        let useMock = false;

        try {
            const service = createPalTcService(store);
            const updated = await service.updateTeamChallenge(challengeId, data as unknown as TeamChallengeUpdateData, ctx);

            try {
                await store.close();
            } catch {
                // ignore
            }

            return NextResponse.json({ status: '1', data: { updated } });
        } catch (storeErr) {
            if (!isDbError(storeErr)) throw storeErr;
            useMock = true;
        }

        if (useMock) {
            store = createMockPalTcStore();
            const service = createPalTcService(store);
            const updated = await service.updateTeamChallenge(challengeId, data as unknown as TeamChallengeUpdateData, ctx);

            return NextResponse.json({ status: '1', data: { updated } });
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to update challenge.';
        const status = message === 'Unauthorized' || message === 'Missing user context' ? 401 : 500;
        return NextResponse.json({ status: '0', message }, { status });
    }
}
