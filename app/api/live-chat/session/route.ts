import { NextResponse } from 'next/server';
import {
  assignAdmin,
  closeSession,
  getAdminPresence,
  getOrCreateUserSession,
  getSession,
  listSessions,
  markAsRead,
} from '@/lib/live-chat/store';
import {
  dbAssignAdmin,
  dbCloseSession,
  dbGetAdminPresence,
  dbGetOrCreateUserSession,
  dbGetSession,
  dbListSessions,
  dbMarkAsRead,
} from '@/lib/live-chat/db';
import type { LiveChatUser } from '@/lib/live-chat/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const userId = searchParams.get('userId');
    const adminQueue = searchParams.get('adminQueue');
    const subInstituteId = searchParams.get('subInstituteId');

    let isOnline = false;
    try {
      const dbPresence = await dbGetAdminPresence(subInstituteId || undefined);
      isOnline = dbPresence.isOnline;
    } catch {
      isOnline = getAdminPresence(subInstituteId || undefined).isOnline;
    }

    if (sessionId) {
      let session = await dbGetSession(sessionId).catch(() => null);
      if (!session) {
        session = getSession(sessionId) || null;
      }
      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      return NextResponse.json({ session, adminOnline: isOnline });
    }

    if (adminQueue === 'true') {
      let sessions = await dbListSessions({
        subInstituteId: subInstituteId ? Number(subInstituteId) : undefined,
        excludeAdminRole: true,
      }).catch(() => null);

      if (sessions === null) {
        const memSessions = listSessions({
          subInstituteId: subInstituteId ? Number(subInstituteId) : undefined,
          excludeAdminRole: true,
        });
        if (memSessions.length > 0) {
          sessions = memSessions;
        }
      }
      return NextResponse.json({ sessions: sessions || [], adminOnline: isOnline });
    }

    if (userId) {
      let sessions = await dbListSessions().catch(() => null);
      if (!sessions || sessions.length === 0) {
        sessions = listSessions();
      }
      const userSession = (sessions || []).find(
        (s) => String(s.userId) === String(userId) && (s.status === 'waiting' || s.status === 'active')
      );
      return NextResponse.json({ session: userSession || null, adminOnline: isOnline });
    }

    let all = await dbListSessions().catch(() => null);
    if (!all || all.length === 0) {
      all = listSessions();
    }
    return NextResponse.json({ sessions: all || [], adminOnline: isOnline });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to retrieve session', detail: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body.action || 'create_or_get';

    if (action === 'create_or_get') {
      const user = body.user as LiveChatUser;
      if (!user || !user.userId) {
        return NextResponse.json({ error: 'User details are required' }, { status: 400 });
      }

      let result: { session: any; messages: any[]; adminOnline: boolean } | null = null;
      try {
        result = await dbGetOrCreateUserSession(
          user,
          body.pagePath,
          body.pageTitle,
          body.initialMessage
        );
      } catch (dbErr) {
        console.warn('[LiveChat API] DB error during session creation, falling back to in-memory store:', dbErr);
        result = getOrCreateUserSession(
          user,
          body.pagePath,
          body.pageTitle,
          body.initialMessage
        );
      }

      return NextResponse.json(result);
    }

    if (action === 'assign_admin') {
      const { sessionId, adminId, adminName } = body;
      if (!sessionId || !adminId) {
        return NextResponse.json({ error: 'sessionId and adminId are required' }, { status: 400 });
      }

      let updated = await dbAssignAdmin(sessionId, { adminId, adminName: adminName || 'Admin' }).catch(() => null);
      if (!updated) {
        updated = assignAdmin(sessionId, { adminId, adminName: adminName || 'Admin' }) || null;
      }
      if (!updated) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      return NextResponse.json({ session: updated });
    }

    if (action === 'close_session') {
      const { sessionId } = body;
      if (!sessionId) {
        return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
      }

      let updated = null;
      let databaseError: unknown;
      try {
        updated = await dbCloseSession(sessionId);
      } catch (error) {
        databaseError = error;
        console.error('[LiveChat API] Failed to close session in database:', error);
      }

      if (!updated) {
        updated = closeSession(sessionId) || null;
      } else {
        closeSession(sessionId);
      }

      if (!updated && databaseError) {
        return NextResponse.json(
          { error: 'Failed to close live chat session' },
          { status: 500 }
        );
      }
      if (!updated) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }

      return NextResponse.json({ session: updated });
    }

    if (action === 'mark_read') {
      const { sessionId, role } = body;
      if (sessionId && (role === 'user' || role === 'admin')) {
        await dbMarkAsRead(sessionId, role).catch(() => null);
        markAsRead(sessionId, role);
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to process session request', detail: String(error) },
      { status: 500 }
    );
  }
}
