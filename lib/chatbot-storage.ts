'use client';

export const TEACH_ASSISTANT_MESSAGES_KEY = 'teach-assistant-messages';
export const TEACH_ASSISTANT_CONVERSATION_ID_KEY = 'teach-assistant-conversation-id';

/**
 * The backend's `ai_conversations` row id for this thread.
 *
 * Stored beside the messages, and for the same reason. The transcript survives a panel
 * collapse because it lives here; the thread id used to live only in a `useRef`, so it
 * did not. The user reopened the panel, saw every previous message restored, asked a
 * follow-up — and the backend received `conversation_id: null`, opened a second thread,
 * and answered with no memory of the student named a moment earlier. Two halves of one
 * conversation have to be persisted together or neither should be.
 */
export const TEACH_ASSISTANT_LIFECYCLE_THREAD_KEY = 'teach-assistant-lifecycle-thread';

/**
 * Chat persistence.
 *
 * Two behaviours the panel needs, and they pull in opposite directions:
 *
 *  - A refresh must start a clean conversation.
 *  - Collapsing and reopening the panel must NOT lose the conversation — the panel is
 *    unmounted while closed (`{isChatbotOpen && <ChatbotPanel/>}` in DashboardShell),
 *    so its React state does not survive a toggle. Neither does navigating between
 *    routes if the shell ever remounts it.
 *
 * So the thread has to be stored somewhere, and then deliberately cleared once per
 * page load. `pageSessionStarted` is that discriminator: a module-scope variable is
 * re-initialised when the browser re-evaluates the module (a real page load) but
 * survives every component remount in between. That is exactly the distinction we
 * need, and it needs no timestamps or navigation-timing guesswork.
 *
 * Storage is `sessionStorage` rather than `localStorage`. Given the page-load clear
 * the two would behave alike, but sessionStorage fails safe: if the clear ever did
 * not run, a thread would still die with the tab instead of persisting for days.
 */

let pageSessionStarted = false;

function store(): Storage | null {
  if (typeof window === 'undefined') return null;

  try {
    return window.sessionStorage;
  } catch {
    // Storage can be unavailable (private mode, blocked cookies). The panel still
    // works; it just will not survive a collapse.
    return null;
  }
}

function safeRemove(storage: Storage | null, key: string) {
  if (!storage) return;

  try {
    storage.removeItem(key);
  } catch {
    /* nothing useful to do */
  }
}

/**
 * Clears the thread if this is the first call since the page loaded.
 *
 * Call it from the panel's lazy state initialiser, so the very first render already
 * sees an empty thread — clearing in an effect would flash the previous conversation
 * before wiping it.
 *
 * Idempotent, and safe under React StrictMode's double-invoked mounts: the first call
 * sets the flag and every later one is a no-op.
 */
export function beginChatPageSession() {
  if (pageSessionStarted) return;

  pageSessionStarted = true;
  clearTeachAssistantStorage();
}

/**
 * Wipes the stored thread.
 *
 * Also clears the legacy `localStorage` keys this used to be written to, so a user
 * upgrading does not carry an old conversation forward invisibly. Safe to keep
 * indefinitely — removing an absent key costs nothing.
 */
export function clearTeachAssistantStorage() {
  const session = store();

  safeRemove(session, TEACH_ASSISTANT_MESSAGES_KEY);
  safeRemove(session, TEACH_ASSISTANT_CONVERSATION_ID_KEY);
  safeRemove(session, TEACH_ASSISTANT_LIFECYCLE_THREAD_KEY);

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(TEACH_ASSISTANT_MESSAGES_KEY);
      window.localStorage.removeItem(TEACH_ASSISTANT_CONVERSATION_ID_KEY);
    } catch {
      /* nothing useful to do */
    }
  }
}

export function readStoredMessages<T>(): T[] {
  const storage = store();

  if (!storage) return [];

  try {
    const raw = storage.getItem(TEACH_ASSISTANT_MESSAGES_KEY);

    if (!raw) return [];

    const parsed = JSON.parse(raw);

    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function writeStoredMessages(messages: unknown[]) {
  const storage = store();

  if (!storage) return;

  try {
    storage.setItem(TEACH_ASSISTANT_MESSAGES_KEY, JSON.stringify(messages));
  } catch {
    // Quota exceeded, most likely. Losing persistence is preferable to breaking send.
  }
}

/**
 * The lifecycle thread id this session is part-way through, or null for a fresh one.
 *
 * Returns null rather than throwing on anything unparseable, so a corrupted key costs
 * one thread's continuity instead of breaking the panel.
 */
export function readLifecycleThreadId(): number | null {
  const storage = store();

  if (!storage) return null;

  try {
    const raw = storage.getItem(TEACH_ASSISTANT_LIFECYCLE_THREAD_KEY);

    if (!raw) return null;

    const parsed = Number.parseInt(raw, 10);

    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export function writeLifecycleThreadId(id: number | null) {
  const storage = store();

  if (!storage) return;

  try {
    if (id === null) {
      storage.removeItem(TEACH_ASSISTANT_LIFECYCLE_THREAD_KEY);

      return;
    }

    storage.setItem(TEACH_ASSISTANT_LIFECYCLE_THREAD_KEY, String(id));
  } catch {
    // Quota or blocked storage. Losing continuity is preferable to breaking send.
  }
}

function createConversationId() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `conversation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** The current conversation id, creating one if this session has none. */
export function ensureConversationId() {
  const storage = store();

  if (!storage) return 'ephemeral-conversation';

  try {
    const existing = storage.getItem(TEACH_ASSISTANT_CONVERSATION_ID_KEY);

    if (existing) return existing;

    const next = createConversationId();
    storage.setItem(TEACH_ASSISTANT_CONVERSATION_ID_KEY, next);

    return next;
  } catch {
    return 'ephemeral-conversation';
  }
}

/**
 * Starts a fresh conversation and returns its id.
 *
 * The new id matters as much as the cleared messages. The backend keys its follow-up
 * and workflow state on `conversationId`, so reusing the old one would carry the
 * previous conversation's slot-filling state into the new thread — the user would
 * clear the screen and still be asked to confirm something they no longer see.
 */
export function startNewChatSession() {
  clearTeachAssistantStorage();

  const storage = store();
  const next = createConversationId();

  if (storage) {
    try {
      storage.setItem(TEACH_ASSISTANT_CONVERSATION_ID_KEY, next);
    } catch {
      /* fall through — the id is still returned and used in memory */
    }
  }

  return next;
}
