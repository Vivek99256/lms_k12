import { NextResponse } from 'next/server';
import { configureAdminSlots, deleteSlot, getAvailableSlots, getDefaultMeetUrl } from '@/lib/live-chat/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const subInstituteId = searchParams.get('subInstituteId') || undefined;
    const date = searchParams.get('date') || undefined;
    const includeBooked = searchParams.get('includeBooked') === 'true';

    const slots = getAvailableSlots(subInstituteId, date, { includeBooked });
    const defaultMeetUrl = getDefaultMeetUrl();
    return NextResponse.json({ slots, defaultMeetUrl });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to retrieve available slots', detail: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.action === 'delete') {
      const { slotId } = body;
      if (!slotId) {
        return NextResponse.json({ error: 'slotId is required for deletion' }, { status: 400 });
      }
      const ok = deleteSlot(slotId);
      return NextResponse.json({ success: ok });
    }

    const { adminId, adminName, subInstituteId, date, slots, overwrite, defaultMeetUrl } = body;
    const resolvedAdminId = adminId ? String(adminId) : 'admin-default';
    const resolvedAdminName = adminName || 'Academic Administrator';

    if (!date || !Array.isArray(slots)) {
      return NextResponse.json(
        { error: 'date and slots array are required' },
        { status: 400 }
      );
    }

    const created = configureAdminSlots(
      resolvedAdminId,
      resolvedAdminName,
      subInstituteId ?? 1,
      date,
      slots,
      {
        overwrite: Boolean(overwrite),
        defaultMeetUrl: typeof defaultMeetUrl === 'string' ? defaultMeetUrl : undefined,
      }
    );

    return NextResponse.json({
      success: true,
      slots: created,
      defaultMeetUrl: getDefaultMeetUrl(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to configure time slots', detail: String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slotId = searchParams.get('slotId');
    if (!slotId) {
      return NextResponse.json({ error: 'slotId query param is required' }, { status: 400 });
    }

    const ok = deleteSlot(slotId);
    return NextResponse.json({ success: ok });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete slot', detail: String(error) },
      { status: 500 }
    );
  }
}
