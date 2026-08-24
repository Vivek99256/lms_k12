'use client';

export const TEACH_ASSISTANT_MESSAGES_KEY = 'teach-assistant-messages';
export const TEACH_ASSISTANT_CONVERSATION_ID_KEY = 'teach-assistant-conversation-id';

export function clearTeachAssistantStorage() {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(TEACH_ASSISTANT_MESSAGES_KEY);
  localStorage.removeItem(TEACH_ASSISTANT_CONVERSATION_ID_KEY);
}
