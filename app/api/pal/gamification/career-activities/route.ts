import { NextRequest, NextResponse } from 'next/server';
import { createPalCqStore, createMockPalCqStore } from '@/app/pal/data/cq-store';
import { createPalCqService } from '@/app/pal/data/cq';
import { validateCqSession, readGrade } from '../career-quest/_auth';
import type { ActivityCompletionInput } from '@/app/pal/data/cq-types';
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

export async function POST(request: NextRequest) {
    try {
        const session = await validateCqSession(request);
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
                domain: 'career_quest',
            });
            if (!decision.granted) {
                return NextResponse.json({ status: '0', message: decision.reason || 'Forbidden' }, { status: 403 });
            }
        } finally {
            await visibility.close();
        }

        const grade = readGrade(request);
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ status: '0', message: 'Invalid JSON body.' }, { status: 400 });
    }

    const activityType = String(body.activity_type ?? body.activityType ?? '').trim().toLowerCase();
    const activityName = String(body.activity_name ?? body.activityName ?? '').trim();

    if (!activityType || !activityName) {
      return NextResponse.json(
        { status: '0', message: 'activity_type and activity_name are required.' },
        { status: 400 }
      );
    }

    const validTypes = ['exploration', 'skill_builder', 'pathway_discovery', 'riasec_assessment', 'nsqf_module'];
    if (!validTypes.includes(activityType)) {
      return NextResponse.json(
        { status: '0', message: `Invalid activity_type. Allowed: ${validTypes.join(', ')}.` },
        { status: 400 }
      );
    }

    const input: ActivityCompletionInput = {
      activityType: activityType as ActivityCompletionInput['activityType'],
      activityName,
      pathwayId: body.pathway_id != null ? Number(body.pathway_id) : (body.pathwayId != null ? Number(body.pathwayId) : null),
      skillId: body.skill_id != null ? Number(body.skill_id) : (body.skillId != null ? Number(body.skillId) : null),
      sourceId: body.source_id != null ? String(body.source_id) : (body.sourceId != null ? String(body.sourceId) : null),
      metadata: body.metadata ? (typeof body.metadata === 'object' ? (body.metadata as Record<string, unknown>) : null) : null,
    };

    const ctx = {
      userId: session.userId,
      subInstituteId: session.subInstituteId,
      syear: session.syear,
    };

    let store = createPalCqStore();
    let useMock = false;

    try {
      const service = createPalCqService(store);
      const activity = await service.recordActivity(ctx.userId, ctx.subInstituteId, ctx.syear, grade, input);

      try {
        await store.close();
      } catch {
        // ignore close error
      }

      return NextResponse.json({
        status: '1',
        data: { activity },
      });
    } catch (storeErr) {
      if (!isDbError(storeErr)) throw storeErr;
      useMock = true;
    }

    if (useMock) {
      store = createMockPalCqStore();
      const service = createPalCqService(store);
      const activity = await service.recordActivity(ctx.userId, ctx.subInstituteId, ctx.syear, grade, input);

      return NextResponse.json({
        status: '1',
        data: { activity },
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to record activity.';
    const status = message === 'Unauthorized' || message === 'Missing user context' ? 401 : 500;
    return NextResponse.json({ status: '0', message }, { status });
  }
}
