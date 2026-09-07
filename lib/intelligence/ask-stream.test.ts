import assert from "node:assert/strict";
import { test } from "node:test";

import { askUiChunks } from "./ask-stream";
import type { AskResult, TraceStage } from "./types";

function stage(key: string, order: number): Partial<TraceStage> {
  return { key, order, layer: key, status: "ran", summary: `${key} ran` };
}

function askResult(overrides: Partial<AskResult> = {}) {
  return {
    conversation: { id: 7, reference: "CONV-7", turn_id: 1, turn: 1 },
    question: "Which students are at academic risk?",
    intent: { key: "student_risk_scan", label: "Find students at risk", confidence: 0.9, slots: {} },
    answer: {
      headline: "Two students are at risk.",
      sections: [],
      actions: [],
      follow_ups: [],
    },
    trace: [],
    ladder: [],
    stage_counts: {},
    lifecycle_trace: [],
    lifecycle_stage_counts: {},
    links: {},
    duration_ms: 12,
    ...overrides,
  };
}

/** A Laravel-shaped SSE body: named events, one JSON payload each. */
function sseBody(events: Array<[string, unknown]>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      for (const [name, data] of events) {
        controller.enqueue(
          encoder.encode(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      }
      controller.close();
    },
  });
}

async function chunksOf(events: Array<[string, unknown]>) {
  const chunks: Array<Record<string, unknown>> = [];

  for await (const chunk of askUiChunks(sseBody(events))) {
    chunks.push(chunk as unknown as Record<string, unknown>);
  }

  return chunks;
}

test("stages become keyed data parts, so the ladder fills in live", async () => {
  const chunks = await chunksOf([
    ["stage", stage("conversation", 1)],
    ["stage", stage("planning", 4)],
    ["done", askResult()],
  ]);

  const stages = chunks.filter((chunk) => chunk.type === "data-stage");

  assert.equal(stages.length, 2);
  assert.equal(stages[0].id, "stage-conversation");
  assert.equal(stages[1].id, "stage-planning");
});

test("tokens open one text part, stream into it, and close it on done", async () => {
  const chunks = await chunksOf([
    ["token", { delta: "Two " }],
    ["token", { delta: "students." }],
    ["done", askResult()],
  ]);

  assert.deepEqual(
    chunks.map((chunk) => chunk.type),
    ["start", "text-start", "text-delta", "text-delta", "text-end", "data-ask", "finish"]
  );
  assert.equal(
    chunks
      .filter((chunk) => chunk.type === "text-delta")
      .map((chunk) => chunk.delta)
      .join(""),
    "Two students."
  );
});

test("a turn that streams no tokens still sends its composed answer", async () => {
  // Most lifecycle answers are assembled from rows rather than generated. Without
  // this the panel would show a ladder and an empty bubble.
  const chunks = await chunksOf([["done", askResult()]]);
  const deltas = chunks.filter((chunk) => chunk.type === "text-delta");

  assert.equal(deltas.length, 1);
  assert.match(String(deltas[0].delta), /Two students are at risk\./);
});

test("the composed answer is not appended to an answer that already streamed", async () => {
  const chunks = await chunksOf([
    ["token", { delta: "Two students are at risk." }],
    ["done", askResult()],
  ]);

  assert.equal(chunks.filter((chunk) => chunk.type === "text-delta").length, 1);
});

test("done carries the thread id and the adapted reply", async () => {
  const chunks = await chunksOf([["done", askResult()]]);
  const ask = chunks.find((chunk) => chunk.type === "data-ask");
  const data = ask?.data as {
    conversationId: number;
    reply: { response: { conversationType: string } };
  };

  assert.equal(data.conversationId, 7);
  assert.equal(data.reply.response.conversationType, "student_risk_scan");
});

test("an upstream error closes the open text part before reporting", async () => {
  // Leaving the part open renders a bubble that never stops streaming.
  const chunks = await chunksOf([
    ["token", { delta: "Two " }],
    ["error", { message: "The question could not be answered.", code: "ask_failed" }],
  ]);

  const types = chunks.map((chunk) => chunk.type);

  assert.ok(types.indexOf("text-end") < types.indexOf("error"));
  assert.equal(chunks.find((chunk) => chunk.type === "error")?.errorText, "The question could not be answered.");
});

test("a stream that stops mid-answer closes the text part and reports the stop", async () => {
  const chunks = await chunksOf([["token", { delta: "Two " }]]);

  assert.deepEqual(
    chunks.map((chunk) => chunk.type),
    ["start", "text-start", "text-delta", "text-end", "error", "finish"]
  );
});

test("an unknown event is ignored rather than failing the turn", async () => {
  // The backend may grow an event this build does not know about.
  const chunks = await chunksOf([
    ["heartbeat", { at: 1 }],
    ["done", askResult()],
  ]);

  assert.ok(chunks.some((chunk) => chunk.type === "data-ask"));
});

test("a stream that dies before answering says so instead of ending quietly", async () => {
  // Observed for real: a cohort scan that runs past PHP's execution limit dies
  // mid-stream and Laravel writes an HTML error page into the SSE frames. Every byte
  // after that is unparseable, so without this the turn ends with a half-drawn ladder
  // and an empty bubble.
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          `event: stage\ndata: ${JSON.stringify(stage("planning", 4))}\n\n`
        )
      );
      controller.enqueue(encoder.encode("<!DOCTYPE html><html><body>Fatal error"));
      controller.close();
    },
  });

  const chunks: Array<Record<string, unknown>> = [];

  for await (const chunk of askUiChunks(body)) {
    chunks.push(chunk as unknown as Record<string, unknown>);
  }

  const failure = chunks.find((chunk) => chunk.type === "error");

  assert.ok(failure, "the turn should report that it stopped");
  assert.match(String(failure.errorText), /stopped before it finished/);
  // The stages it did complete are still shown — they are true.
  assert.ok(chunks.some((chunk) => chunk.type === "data-stage"));
});

test("a turn that answered normally reports no failure", async () => {
  const chunks = await chunksOf([["done", askResult()]]);

  assert.equal(chunks.some((chunk) => chunk.type === "error"), false);
});

test("an upstream error is reported once, not twice", async () => {
  const chunks = await chunksOf([
    ["error", { message: "The question could not be answered." }],
  ]);

  assert.equal(chunks.filter((chunk) => chunk.type === "error").length, 1);
});
