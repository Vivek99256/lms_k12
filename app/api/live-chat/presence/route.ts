import { NextResponse } from 'next/server';
import { getAdminPresence, updateAdminPresence } from '@/lib/live-chat/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const subInstituteId = searchParams.get('subInstituteId') || undefined;

    const presence = getAdminPresence(subInstituteId);
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

    const updated = updateAdminPresence(
      String(adminId),
      adminName || 'Admin',
      subInstituteId ?? 1,
      status || 'available'
    );

    return NextResponse.json({ success: true, presence: updated });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update admin presence', detail: String(error) },
      { status: 500 }
    );
  }
}
