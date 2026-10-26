import { NextResponse } from 'next/server';
import { addMessage, getMessages, getSession } from '@/lib/live-chat/store';
import type { SendMessageRequest } from '@/lib/live-chat/types';

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

    const session = getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const messages = getMessages(sessionId, since);
    return NextResponse.json({ messages, sessionStatus: session.status, meetUrl: session.meetUrl });
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

    const message = addMessage({
      sessionId: body.sessionId,
      senderId: body.senderId,
      senderName: body.senderName || 'Anonymous',
      senderRole: body.senderRole || 'user',
      text: body.text.trim(),
      type: body.type || 'text',
      meetUrl: body.meetUrl,
    });

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
