import { NextResponse } from 'next/server';
import {
  bookMeetingSlot,
  cancelBooking,
  checkAndExpireMissedBookings,
  recordParticipantJoin,
} from '@/lib/live-chat/store';
import {
  dbBookMeetingSlot,
  dbCancelBooking,
  dbCheckAndExpireMissedBookings,
  dbRecordParticipantJoin,
} from '@/lib/live-chat/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    let expiredList: any[] = [];
    try {
      expiredList = await dbCheckAndExpireMissedBookings();
    } catch {
      expiredList = checkAndExpireMissedBookings();
    }
    return NextResponse.json({ bookings: expiredList });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to inspect bookings', detail: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body.action || 'book';

    if (action === 'book') {
      const { slotId, sessionId, student } = body;
      if (!slotId || !sessionId || !student) {
        return NextResponse.json(
          { error: 'slotId, sessionId, and student information are required' },
          { status: 400 }
        );
      }

      let booking: any = null;
      try {
        booking = await dbBookMeetingSlot(slotId, sessionId, student);
      } catch (err) {
        console.warn('[LiveChat API] Failed to book meeting in DB:', err);
      }

      if (!booking) {
        const memResult = bookMeetingSlot(slotId, sessionId, student);
        if (!memResult.success) {
          return NextResponse.json(
            { error: memResult.error || 'Failed to book slot' },
            { status: 409 }
          );
        }
        booking = memResult.booking;
      }

      return NextResponse.json({ success: true, booking });
    }

    if (action === 'join') {
      const { bookingId, role } = body;
      if (!bookingId || !role) {
        return NextResponse.json(
          { error: 'bookingId and role (student | admin) are required' },
          { status: 400 }
        );
      }

      let updated = await dbRecordParticipantJoin(bookingId, role).catch(() => null);
      if (!updated) {
        updated = recordParticipantJoin(bookingId, role) || null;
      }
      if (!updated) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, booking: updated });
    }

    if (action === 'cancel') {
      const { bookingId, cancelledBy } = body;
      if (!bookingId) {
        return NextResponse.json({ error: 'bookingId is required' }, { status: 400 });
      }

      const resolver = cancelledBy || { id: 'user', name: 'User', role: 'user' };
      let updated = await dbCancelBooking(bookingId, resolver).catch(() => null);
      if (!updated) {
        updated = cancelBooking(bookingId, resolver) || null;
      }

      return NextResponse.json({ success: true, booking: updated });
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to process booking request', detail: String(error) },
      { status: 500 }
    );
  }
}
