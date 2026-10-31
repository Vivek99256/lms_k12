import { NextResponse } from 'next/server';
import { addMessage, getMessages, getSession } from '@/lib/live-chat/store';
import { dbAddMessage, dbGetMessages, dbGetSession } from '@/lib/live-chat/db';
import type { LiveChatMessage, SendMessageRequest } from '@/lib/live-chat/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const since = searchParams.get('since') || undefined;

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    let session = await dbGetSession(sessionId).catch(() => null);
    if (!session) {
      session = getSession(sessionId) || null;
    }

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.status === 'closed') {
      return NextResponse.json({
        messages: [],
        sessionStatus: session.status,
        meetUrl: session.activeMeetUrl || (session as any).meetUrl,
      });
    }

    let messages = await dbGetMessages(sessionId, since).catch(() => null);
    if (!messages || messages.length === 0) {
      messages = getMessages(sessionId, since);
    }

    return NextResponse.json({
      messages: messages || [],
      sessionStatus: session.status,
      meetUrl: session.activeMeetUrl || (session as any).meetUrl,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to retrieve messages', detail: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SendMessageRequest;

    if (!body.sessionId || !body.senderId || !body.text?.trim()) {
      return NextResponse.json(
        { error: 'sessionId, senderId, and non-empty text are required' },
        { status: 400 }
      );
    }

    const payload: SendMessageRequest = {
      sessionId: body.sessionId,
      senderId: body.senderId,
      senderName: body.senderName || 'Anonymous',
      senderRole: body.senderRole || 'user',
      text: body.text.trim(),
      type: body.type || 'text',
      meetUrl: body.meetUrl,
    };

    let message: LiveChatMessage | null = null;
    let databaseAvailable = true;
    try {
      message = await dbAddMessage(payload);
    } catch (err) {
      databaseAvailable = false;
      console.warn('[LiveChat API] Failed to add message to DB:', err);
    }

    if (!message) {
      if (databaseAvailable) {
        const session = await dbGetSession(payload.sessionId).catch(() => null);
        if (session?.status === 'closed') {
          return NextResponse.json({ error: 'Session not found or closed' }, { status: 404 });
        }
      }
      message = addMessage(payload);
    }

    if (!message) {
      return NextResponse.json({ error: 'Session not found or closed' }, { status: 404 });
    }

    return NextResponse.json({ message });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to post message', detail: String(error) },
      { status: 500 }
    );
  }
}
