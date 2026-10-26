import { NextResponse } from 'next/server';
import { getAdminPresence, updateAdminPresence } from '@/lib/live-chat/store';
import { dbGetAdminPresence, dbUpdateAdminPresence } from '@/lib/live-chat/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const subInstituteId = searchParams.get('subInstituteId') || undefined;

    let presence: any = null;
    try {
      presence = await dbGetAdminPresence(subInstituteId);
    } catch {
      presence = getAdminPresence(subInstituteId);
    }

    return NextResponse.json(presence);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to retrieve admin presence', detail: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { adminId, adminName, subInstituteId, status } = body;

    if (!adminId) {
      return NextResponse.json({ error: 'adminId is required' }, { status: 400 });
    }

    let updated: any = null;
    try {
      updated = await dbUpdateAdminPresence(
        String(adminId),
        adminName || 'Admin',
        subInstituteId ?? 1,
        status || 'available'
      );
    } catch (err) {
      console.warn('[LiveChat API] Failed to update presence in DB:', err);
    }

    // Also update in-memory store as fallback
    const memUpdated = updateAdminPresence(
      String(adminId),
      adminName || 'Admin',
      subInstituteId ?? 1,
      status || 'available'
    );

    return NextResponse.json({ success: true, presence: updated || memUpdated });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update admin presence', detail: String(error) },
      { status: 500 }
    );
  }
}
