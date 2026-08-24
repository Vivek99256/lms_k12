import { NextRequest, NextResponse } from 'next/server';
import { evaluateBadges, recordBadgeEvent } from '@/app/pal/data/pal-badge';
import { createPalBadgeStore, createMockPalBadgeStore } from '@/app/pal/data/pal-badge-store';
import { validateGamSession } from '@/app/pal/data/gamification-auth';
import { createVisibilityServiceFromEnv } from '@/app/pal/data/visibility-service';

export const runtime = 'nodejs';

function badRequest(message: string) {
    return NextResponse.json({ status: '0', message }, { status: 400 });
}

function ok(payload: { processed: boolean; awarded: Array<Record<string, unknown>> }) {
    return NextResponse.json({ status: '1', data: payload });
}

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

export async function POST(request: NextRequest) {
    try {
        const session = await validateGamSession(request);
        if (!session) {
            return NextResponse.json({ status: '0', message: 'Missing user context' }, { status: 401 });
        }

        const visibility = createVisibilityServiceFromEnv();
        let granted = false;
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
            granted = decision.granted;
            if (!granted) {
                return NextResponse.json({ status: '0', message: decision.reason || 'Forbidden' }, { status: 403 });
            }
        } finally {
            await visibility.close();
        }

        let body: Record<string, unknown>;
        try {
            body = (await request.json()) as Record<string, unknown>;
        } catch {
            return badRequest('Invalid JSON body.');
        }

        const quizData = Array.isArray(body.quizData)
            ? (body.quizData as Array<{ conceptName: string; masteryLevel: number; fluency: number; sessionCount: number }>)
            : undefined;

        const eventType = String(body.eventType || 'manual');
        const sourceId = body.sourceId ? String(body.sourceId) : undefined;
        const eventContext = body.context && typeof body.context === 'object' ? (body.context as Record<string, unknown>) : undefined;

        let useMock = false;
        let store = createPalBadgeStore();

        if (eventType !== 'manual') {
            try {
                await recordBadgeEvent(
                    {
                        userId: session.userId,
                        subInstituteId: session.subInstituteId,
                        syear: session.syear,
                        eventType,
                        sourceId,
                        context: eventContext,
                    },
                    store
                );
            } catch (storeErr) {
                if (!isDbError(storeErr)) throw storeErr;
                useMock = true;
            }
        }

        try {
            const result = await evaluateBadges(
                {
                    userId: session.userId,
                    subInstituteId: session.subInstituteId,
                    syear: session.syear,
                    quizData,
                    sessionStart: body.sessionStart as string | undefined,
                    sessionEnd: body.sessionEnd as string | undefined,
                },
                store
            );

            return ok({
                processed: result.processed,
                awarded: result.awarded.map((a) => ({
                    badgeCode: a.badgeCode,
                    badgeName: a.badgeName,
                    category: a.category,
                    awarded: a.awarded,
                    reason: a.reason,
                    evidence: a.evidence,
                })),
            });
        } catch (storeErr) {
            if (!isDbError(storeErr)) throw storeErr;
            useMock = true;
        }

        if (useMock) {
            store = createMockPalBadgeStore();
            const result = await evaluateBadges(
                {
                    userId: session.userId,
                    subInstituteId: session.subInstituteId,
                    syear: session.syear,
                    quizData,
                    sessionStart: body.sessionStart as string | undefined,
                    sessionEnd: body.sessionEnd as string | undefined,
                },
                store
            );

            return ok({
                processed: result.processed,
                awarded: result.awarded.map((a) => ({
                    badgeCode: a.badgeCode,
                    badgeName: a.badgeName,
                    category: a.category,
                    awarded: a.awarded,
                    reason: a.reason,
                    evidence: a.evidence,
                })),
            });
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Badge evaluation failed.';
        const status = message === 'Unauthorized' || message === 'Missing user context' ? 401 : 500;
        return NextResponse.json({ status: '0', message }, { status });
    }
}
