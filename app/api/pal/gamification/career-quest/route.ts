import { NextRequest, NextResponse } from 'next/server';
import { createPalCqStore, createMockPalCqStore } from '@/app/pal/data/cq-store';
import { createPalCqService } from '@/app/pal/data/cq';
import { validateCqSession, readGrade } from './_auth';
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

export async function GET(request: NextRequest) {
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
    const ctx = {
      userId: session.userId,
      subInstituteId: session.subInstituteId,
      syear: session.syear,
    };

    let store = createPalCqStore();
    let useMock = false;

    try {
      const service = createPalCqService(store);
      const state = await service.getCareerQuestState(ctx.userId, ctx.subInstituteId, ctx.syear, grade);
      const stages = await service.getStageDefinitions();
      const summary = await service.getCareerQuestSummary(
        ctx.userId,
        ctx.subInstituteId,
        ctx.syear,
        state.primaryPathwayId,
        state.secondaryPathwayId
      );

      try {
        await store.close();
      } catch {
        // ignore close error
      }

      return NextResponse.json({
        status: '1',
        data: {
          state,
          stages,
          grade,
          summary,
        },
      });
    } catch (storeErr) {
      if (!isDbError(storeErr)) throw storeErr;
      useMock = true;
    }

    if (useMock) {
      store = createMockPalCqStore();
      const service = createPalCqService(store);
      const state = await service.getCareerQuestState(ctx.userId, ctx.subInstituteId, ctx.syear, grade);
      const stages = await service.getStageDefinitions();
      const summary = await service.getCareerQuestSummary(
        ctx.userId,
        ctx.subInstituteId,
        ctx.syear,
        state.primaryPathwayId,
        state.secondaryPathwayId
      );

      return NextResponse.json({
        status: '1',
        data: {
          state,
          stages,
          grade,
          summary,
        },
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to load career quest state.';
    const status = message === 'Unauthorized' || message === 'Missing user context' ? 401 : 500;
    return NextResponse.json({ status: '0', message }, { status });
  }
}
