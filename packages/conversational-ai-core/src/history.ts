import type { ConversationMessage } from "./schemas";
import {
  deleteStoredJson,
  listStoredJsonKeys,
  readStoredJson,
  writeStoredJson,
} from "./file-store";

export interface ConversationSessionRecord {
  sessionId: string;
  userId: string;
  messages: ConversationMessage[];
  updatedAt: string;
}

const MAX_MESSAGES_PER_SESSION = 50;

function getSessionKey(userId: string, sessionId: string) {
  return `${userId}:${sessionId}`;
}

export function appendConversationHistory(params: {
  sessionId: string;
  userId: string;
  messages: ConversationMessage[];
}) {
  const key = getSessionKey(params.userId, params.sessionId);
  const current = readStoredJson<ConversationSessionRecord>("history", key);
  const mergedMessages = [...(current?.messages || []), ...params.messages].slice(
    -MAX_MESSAGES_PER_SESSION
  );

  const nextRecord: ConversationSessionRecord = {
    sessionId: params.sessionId,
    userId: params.userId,
    messages: mergedMessages,
    updatedAt: new Date().toISOString(),
  };

  writeStoredJson("history", key, nextRecord);
  return nextRecord;
}

export function getConversationHistory(userId: string, sessionId: string) {
  return (
    readStoredJson<ConversationSessionRecord>(
      "history",
      getSessionKey(userId, sessionId)
    ) || null
  );
}

export function clearConversationHistory(userId: string, sessionId?: string) {
  if (sessionId) {
    deleteStoredJson("history", getSessionKey(userId, sessionId));
    return;
  }

  for (const key of listStoredJsonKeys("history")) {
    if (key.startsWith(`${userId}:`)) {
      deleteStoredJson("history", key);
    }
  }
}
