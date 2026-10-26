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

    const presence = getAdminPresence(subInstituteId || undefined);

    if (sessionId) {
      const session = getSession(sessionId);
      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      return NextResponse.json({ session, adminOnline: presence.isOnline });
    }

    if (adminQueue === 'true') {
      const sessions = listSessions({
        subInstituteId: subInstituteId ? Number(subInstituteId) : undefined,
        excludeAdminRole: true,
      });
      return NextResponse.json({ sessions, adminOnline: presence.isOnline });
    }

    if (userId) {
      const sessions = listSessions();
      const userSession = sessions.find(
        (s) => String(s.userId) === String(userId) && (s.status === 'waiting' || s.status === 'active')
      );
      return NextResponse.json({ session: userSession || null, adminOnline: presence.isOnline });
    }

    const all = listSessions();
    return NextResponse.json({ sessions: all, adminOnline: presence.isOnline });
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

      const { session, messages, adminOnline } = getOrCreateUserSession(
        user,
        body.pagePath,
        body.pageTitle,
        body.initialMessage
      );

      return NextResponse.json({ session, messages, adminOnline });
    }

    if (action === 'assign_admin') {
      const { sessionId, adminId, adminName } = body;
      if (!sessionId || !adminId) {
        return NextResponse.json({ error: 'sessionId and adminId are required' }, { status: 400 });
      }
      const updated = assignAdmin(sessionId, { adminId, adminName: adminName || 'Admin' });
      if (!updated) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      return NextResponse.json({ session: updated });
    }

    if (action === 'close_session') {
      const { sessionId, closedBy } = body;
      if (!sessionId) {
        return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
      }
      const updated = closeSession(sessionId, closedBy || { id: 'admin', name: 'Admin', role: 'admin' });
      return NextResponse.json({ session: updated });
    }

    if (action === 'mark_read') {
      const { sessionId, role } = body;
      if (sessionId && (role === 'user' || role === 'admin')) {
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
