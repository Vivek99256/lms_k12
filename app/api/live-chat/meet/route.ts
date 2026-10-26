import { NextResponse } from 'next/server';
import { attachGoogleMeet } from '@/lib/live-chat/store';
import type { CreateMeetRequest } from '@/lib/live-chat/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateMeetRequest;

    if (!body.sessionId || !body.senderId) {
      return NextResponse.json(
        { error: 'sessionId and senderId are required to start a Google Meet call' },
        { status: 400 }
      );
    }

    const result = attachGoogleMeet({
      sessionId: body.sessionId,
      senderId: body.senderId,
      senderName: body.senderName || 'Staff',
      senderRole: body.senderRole || 'admin',
      customMeetUrl: body.customMeetUrl,
    });

    if (!result) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      meetUrl: result.session.meetUrl,
      session: result.session,
      message: result.message,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to initiate Google Meet', detail: String(error) },
      { status: 500 }
    );
  }
}
