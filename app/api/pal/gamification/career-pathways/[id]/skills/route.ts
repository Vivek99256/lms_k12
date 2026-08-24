import { NextRequest, NextResponse } from 'next/server';
import { createPalCqStore, createMockPalCqStore } from '@/app/pal/data/cq-store';
import { createPalCqService } from '@/app/pal/data/cq';
import { validateCqSession } from '../../../career-quest/_auth';
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

function extractPathwayId(request: NextRequest): number {
  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  const idx = parts.indexOf('career-pathways');
  const id = idx >= 0 && idx + 1 < parts.length ? parts[idx + 1] : '';
  return Number(id);
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

        const pathwayId = extractPathwayId(request);
    if (!Number.isFinite(pathwayId) || pathwayId <= 0) {
      return NextResponse.json({ status: '0', message: 'Invalid pathway id.' }, { status: 400 });
    }

    const ctx = {
      userId: session.userId,
      subInstituteId: session.subInstituteId,
      syear: session.syear,
    };

    let store = createPalCqStore();
    let useMock = false;

    try {
      const service = createPalCqService(store);
      const pathway = await service.getPathwayWithSkills(pathwayId, ctx.userId, ctx.subInstituteId, ctx.syear);

      try {
        await store.close();
      } catch {
        // ignore close error
      }

      if (!pathway) {
        return NextResponse.json({ status: '0', message: 'Pathway not found.' }, { status: 404 });
      }

      return NextResponse.json({
        status: '1',
        data: { pathway },
      });
    } catch (storeErr) {
      if (!isDbError(storeErr)) throw storeErr;
      useMock = true;
    }

    if (useMock) {
      store = createMockPalCqStore();
      const service = createPalCqService(store);
      const pathway = await service.getPathwayWithSkills(pathwayId, ctx.userId, ctx.subInstituteId, ctx.syear);

      if (!pathway) {
        return NextResponse.json({ status: '0', message: 'Pathway not found.' }, { status: 404 });
      }

      return NextResponse.json({
        status: '1',
        data: { pathway },
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to load pathway skills.';
    const status = message === 'Unauthorized' || message === 'Missing user context' ? 401 : 500;
    return NextResponse.json({ status: '0', message }, { status });
  }
}
