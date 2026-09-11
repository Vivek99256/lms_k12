'use client';

import { ConversationalAiAdmin } from './_components/ConversationalAiAdmin';

/**
 * Administration → AI & Intelligence → Conversational AI.
 *
 * The registry of project adapters behind the shared /api/ai endpoint, each
 * project's channel settings, and the service tokens external projects present.
 * Everything shown is read from lib/ai/project-resolver.ts and the admin store;
 * nothing on this screen is a fixed list.
 */
export default function ConversationalAiPage() {
  return <ConversationalAiAdmin />;
}
