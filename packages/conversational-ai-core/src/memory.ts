import type { ConversationMessage } from "./schemas";

export interface ConversationSummary {
  sessionId: string;
  summary: string;
  generatedAt: string;
  lastMessageId?: string;
}

export interface MemoryQuery {
  sessionId: string;
  userId?: string;
  limit?: number;
}

export interface ConversationMemoryStore {
  append(messages: ConversationMessage[], sessionId: string, userId?: string): Promise<void>;
  list(query: MemoryQuery): Promise<ConversationMessage[]>;
  saveSummary(summary: ConversationSummary): Promise<void>;
  getSummary(sessionId: string): Promise<ConversationSummary | null>;
}
