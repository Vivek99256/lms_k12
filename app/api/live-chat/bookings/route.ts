import { NextResponse } from 'next/server';
import {
  bookMeetingSlot,
  cancelBooking,
  checkAndExpireMissedBookings,
  recordParticipantJoin,
} from '@/lib/live-chat/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const expiredList = checkAndExpireMissedBookings();
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

      const result = bookMeetingSlot(slotId, sessionId, student);
      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Failed to book slot' },
          { status: 409 } // 409 Conflict for double booking
        );
      }

      return NextResponse.json({ success: true, booking: result.booking });
    }

    if (action === 'join') {
      const { bookingId, role } = body;
      if (!bookingId || !role) {
        return NextResponse.json(
          { error: 'bookingId and role (student | admin) are required' },
          { status: 400 }
        );
      }

      const updated = recordParticipantJoin(bookingId, role);
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

      const updated = cancelBooking(
        bookingId,
        cancelledBy || { id: 'user', name: 'User', role: 'user' }
      );

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
