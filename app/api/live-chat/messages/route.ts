import { relayLiveChat } from '@/lib/live-chat/proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return relayLiveChat(request, 'messages');
}

export async function POST(request: Request) {
  return relayLiveChat(request, 'messages');
}
