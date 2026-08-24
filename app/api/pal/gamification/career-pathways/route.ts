import { NextRequest, NextResponse } from 'next/server';
import { createPalCqStore, createMockPalCqStore } from '@/app/pal/data/cq-store';
import { createPalCqService } from '@/app/pal/data/cq';
import { validateCqSession } from '../career-quest/_auth';
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

        const activeOnly = String(new URL(request.url).searchParams.get('active') || '').trim().toLowerCase() === 'true';

    let store = createPalCqStore();
    let useMock = false;

    try {
      const service = createPalCqService(store);
      const pathways = await service.getCareerPathways(activeOnly);

      try {
        await store.close();
      } catch {
        // ignore close error
      }

      return NextResponse.json({
        status: '1',
        data: { pathways },
      });
    } catch (storeErr) {
      if (!isDbError(storeErr)) throw storeErr;
      useMock = true;
    }

    if (useMock) {
      store = createMockPalCqStore();
      const service = createPalCqService(store);
      const pathways = await service.getCareerPathways(activeOnly);

      return NextResponse.json({
        status: '1',
        data: { pathways },
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to load career pathways.';
    const status = message === 'Unauthorized' || message === 'Missing user context' ? 401 : 500;
    return NextResponse.json({ status: '0', message }, { status });
  }
}
