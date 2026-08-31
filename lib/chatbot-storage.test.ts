import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import {
  TEACH_ASSISTANT_LIFECYCLE_THREAD_KEY,
  TEACH_ASSISTANT_MESSAGES_KEY,
  clearTeachAssistantStorage,
  readLifecycleThreadId,
  writeLifecycleThreadId,
  writeStoredMessages,
} from "./chatbot-storage";

/**
 * The thread id has to persist on exactly the same terms as the transcript.
 *
 * The bug these cover: the messages were written to sessionStorage and the backend's
 * `ai_conversations` id was not, so collapsing the assistant panel — which unmounts it —
 * brought the whole conversation back on screen with no thread behind it. The next
 * question opened a second thread and answered with no memory of the student named in
 * the messages the user could still see.
 *
 * So the three properties worth pinning down are: a written id comes back, clearing the
 * thread clears it along with the messages, and a value that cannot be parsed yields
 * null rather than throwing inside the panel's render.
 */

class FakeStorage implements Storage {
  private data = new Map<string, string>();

  get length() {
    return this.data.size;
  }

  clear() {
    this.data.clear();
  }

  getItem(key: string) {
    return this.data.has(key) ? (this.data.get(key) as string) : null;
  }

  key(index: number) {
    return [...this.data.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.data.delete(key);
  }

  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

let session: FakeStorage;

beforeEach(() => {
  session = new FakeStorage();

  (globalThis as unknown as { window: unknown }).window = {
    sessionStorage: session,
    localStorage: new FakeStorage(),
  };
});

// The import above is hoisted above the stub, and that is fine: `store()` reads
// `window` when it is called rather than when the module loads, so every test sees the
// storage `beforeEach` installed for it.

test("a written thread id is read back", () => {
  writeLifecycleThreadId(113);

  assert.equal(session.getItem(TEACH_ASSISTANT_LIFECYCLE_THREAD_KEY), "113");
  assert.equal(readLifecycleThreadId(), 113);
});

test("no stored id reads as null, so the first question opens a thread", () => {
  assert.equal(readLifecycleThreadId(), null);
});

test("writing null forgets the thread", () => {
  writeLifecycleThreadId(113);
  writeLifecycleThreadId(null);

  assert.equal(readLifecycleThreadId(), null);
  assert.equal(session.getItem(TEACH_ASSISTANT_LIFECYCLE_THREAD_KEY), null);
});

test("the thread is cleared with the messages, never separately", () => {
  writeStoredMessages([{ id: "assistant-1", role: "assistant" }]);
  writeLifecycleThreadId(113);

  clearTeachAssistantStorage();

  // Both or neither. A cleared transcript beside a live thread is the mirror image of
  // the original bug: the user sees an empty panel and the backend keeps answering
  // against a student they walked away from.
  assert.equal(session.getItem(TEACH_ASSISTANT_MESSAGES_KEY), null);
  assert.equal(readLifecycleThreadId(), null);
});

test("an unparseable stored value yields null rather than throwing", () => {
  for (const junk of ["", "abc", "NaN", "{}", "-4", "0"]) {
    session.setItem(TEACH_ASSISTANT_LIFECYCLE_THREAD_KEY, junk);

    assert.equal(readLifecycleThreadId(), null, `expected null for ${JSON.stringify(junk)}`);
  }
});

test("a decimal id is truncated to the row id, not rejected", () => {
  session.setItem(TEACH_ASSISTANT_LIFECYCLE_THREAD_KEY, "113.0");

  assert.equal(readLifecycleThreadId(), 113);
});

test("storage being unavailable costs continuity, not the panel", () => {
  (globalThis as unknown as { window: unknown }).window = {
    get sessionStorage(): Storage {
      throw new Error("blocked by browser settings");
    },
    get localStorage(): Storage {
      throw new Error("blocked by browser settings");
    },
  };

  assert.doesNotThrow(() => writeLifecycleThreadId(113));
  assert.equal(readLifecycleThreadId(), null);
});
