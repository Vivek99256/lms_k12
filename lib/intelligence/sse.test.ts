import assert from "node:assert/strict";
import { test } from "node:test";

import { readSseEvents, type SseEvent } from "./sse";

/** A body that hands over exactly these byte chunks, in order. */
function bodyOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

async function collect(chunks: string[]): Promise<SseEvent[]> {
  const events: SseEvent[] = [];

  for await (const event of readSseEvents(bodyOf(chunks))) {
    events.push(event);
  }

  return events;
}

test("reads the named events Laravel emits", async () => {
  const events = await collect([
    'event: stage\ndata: {"key":"conversation"}\n\n',
    'event: token\ndata: {"delta":"Two "}\n\n',
    'event: done\ndata: {"conversation":{"id":7}}\n\n',
  ]);

  assert.deepEqual(
    events.map((event) => event.event),
    ["stage", "token", "done"]
  );
  assert.equal(JSON.parse(events[2].data).conversation.id, 7);
});

test("an event split across two network chunks is still one event", async () => {
  // The failure this guards: a parser that treats a read as a message drops half a
  // stage, and the ladder silently loses rows on a slow connection.
  const events = await collect(['event: sta', 'ge\ndata: {"key":"ev', 'idence"}\n\n']);

  assert.equal(events.length, 1);
  assert.equal(events[0].event, "stage");
  assert.equal(JSON.parse(events[0].data).key, "evidence");
});

test("several events arriving in one chunk are all read", async () => {
  const events = await collect([
    'event: token\ndata: {"delta":"a"}\n\nevent: token\ndata: {"delta":"b"}\n\n',
  ]);

  assert.equal(events.length, 2);
});

test("a final event with no trailing blank line is not dropped", async () => {
  // `done` is the last event and carries the whole answer. Losing it to a missing
  // terminator would leave a turn with a ladder and no reply.
  const events = await collect(['event: done\ndata: {"ok":true}']);

  assert.equal(events.length, 1);
  assert.equal(events[0].event, "done");
});

test("comments and unknown fields are ignored, and CRLF parses as LF", async () => {
  const events = await collect([
    ": heartbeat\n\n",
    'id: 4\r\nretry: 500\r\nevent: stage\r\ndata: {"key":"action"}\r\n\r\n',
  ]);

  assert.equal(events.length, 1);
  assert.equal(events[0].event, "stage");
});

test("multi-line data is joined the way the spec says", async () => {
  const events = await collect(["event: note\ndata: one\ndata: two\n\n"]);

  assert.equal(events[0].data, "one\ntwo");
});

test("an event with no name defaults to `message`", async () => {
  const events = await collect(["data: bare\n\n"]);

  assert.equal(events[0].event, "message");
});

test("a multi-byte character split across reads survives decoding", async () => {
  const encoder = new TextEncoder();
  const bytes = encoder.encode('event: token\ndata: {"delta":"—"}\n\n');
  const split = bytes.indexOf(0xe2); // first byte of the em dash

  const events: SseEvent[] = [];
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes.slice(0, split + 1));
      controller.enqueue(bytes.slice(split + 1));
      controller.close();
    },
  });

  for await (const event of readSseEvents(body)) {
    events.push(event);
  }

  assert.equal(JSON.parse(events[0].data).delta, "—");
});
