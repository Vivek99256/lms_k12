import { NextRequest, NextResponse } from 'next/server';
import { createPalCmStore, createMockPalCmStore } from '@/app/pal/data/cm-store';
import { createPalCmService } from '@/app/pal/data/cm';
import { validateCmSession } from '../_auth';
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

export async function GET(request: NextRequest) {
    try {
        const session = await validateCmSession(request);
        if (!session) {
            return NextResponse.json({ status: '0', message: 'Unauthorized' }, { status: 401 });
        }

        if (!session.isStaff) {
            return NextResponse.json({ status: '0', message: 'Only teachers can view class challenge performance.' }, { status: 403 });
        }

        const url = new URL(request.url);
        const challengeId = Number(url.searchParams.get('challenge_id'));
        const weekStart = url.searchParams.get('week_start');
        const studentIdsParam = url.searchParams.get('student_ids');

        if (Number.isNaN(challengeId) || !weekStart || !studentIdsParam) {
            return NextResponse.json({
                status: '0',
                message: 'challenge_id, week_start, and student_ids are required.',
            }, { status: 400 });
        }

        const weekStartDate = new Date(weekStart);
        if (Number.isNaN(weekStartDate.getTime())) {
            return NextResponse.json({ status: '0', message: 'Invalid week_start date.' }, { status: 400 });
        }

        const isAllStudents = studentIdsParam === 'all';
        const studentIds = isAllStudents ? [] : studentIdsParam.split(',').map((id) => id.trim()).filter(Boolean);

        if (!isAllStudents && studentIds.length === 0) {
            return NextResponse.json({ status: '1', data: { entries: [] } });
        }

        const visibility = createVisibilityServiceFromEnv();
        try {
            if (!isAllStudents) {
                for (const studentId of studentIds) {
                    const decision = await visibility.checkAccess({
                        actorUserId: session.userId,
                        actorRole: session.isStaff ? 'teacher' : 'student',
                        actorSubInstituteId: session.subInstituteId,
                        actorSyear: session.syear,
                        targetUserId: studentId,
                        targetSubInstituteId: session.subInstituteId,
                        targetSyear: session.syear,
                        domain: 'challenge_mode',
                    });
                    if (!decision.granted) {
                        return NextResponse.json({ status: '0', message: decision.reason || 'Forbidden' }, { status: 403 });
                    }
                }
            }
        } finally {
            await visibility.close();
        }

        const ctx = buildContext(session);

        let store = createPalCmStore();
        let useMock = false;

        try {
            const service = createPalCmService(store);
            let entries;
            if (isAllStudents) {
                const rows = await store.getQualifiedAttemptsForLeaderboard(challengeId, ctx, weekStartDate);
                const monday = new Date(weekStartDate);
                monday.setUTCHours(0, 0, 0, 0);
                const yearStart = new Date(Date.UTC(monday.getUTCFullYear(), 0, 1));
                const weekNumber = Math.ceil((((monday.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
                entries = rows.map((r, index) => ({
                    id: index + 1,
                    challenge_id: challengeId,
                    user_id: r.attempt.user_id,
                    sub_institute_id: ctx.sub_institute_id,
                    syear: ctx.syear,
                    week_start: monday.toISOString().slice(0, 10),
                    week_number: weekNumber,
                    year_number: monday.getUTCFullYear(),
                    score: r.attempt.raw_score,
                    rank: index + 1,
                    is_qualified: r.attempt.is_qualified,
                    display_name: r.display_name,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                }));
            } else {
                entries = await service.getStudentLeaderboardForTeacher(studentIds, challengeId, weekStartDate, ctx);
            }

            try { await store.close(); } catch { /* ignore */ }

            return NextResponse.json({ status: '1', data: { entries } });
        } catch (storeErr) {
            if (!isDbError(storeErr)) throw storeErr;
            useMock = true;
        }

        if (useMock) {
            store = createMockPalCmStore();
            const service = createPalCmService(store);
            const entries = isAllStudents
                ? []
                : await service.getStudentLeaderboardForTeacher(studentIds, challengeId, weekStartDate, ctx);
            return NextResponse.json({ status: '1', data: { entries } });
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to load teacher leaderboard.';
        const status = message === 'Unauthorized' || message === 'Missing user context' ? 401 : 500;
        return NextResponse.json({ status: '0', message }, { status });
    }
}
