import assert from "node:assert/strict";
import { test } from "node:test";

import {
  askDataOf,
  stagesOf,
  textOf,
  toPanelMessage,
  usableStoredMessages,
  type AskUIMessage,
} from "./ui-messages";
import type { ChatShapedReply } from "./ask-adapter";
import type { TraceStage } from "./types";

function stage(key: string, order: number): TraceStage {
  return {
    key,
    order,
    layer: key,
    status: "ran",
    summary: `${key} ran`,
    component: "",
    surface: "",
    data: {},
    records: {},
    verify: {},
    duration_ms: null,
    note: null,
  };
}

function reply(overrides: Partial<ChatShapedReply["response"]["data"]> = {}): ChatShapedReply {
  return {
    message: { id: "answer", content: "Two students are at risk." },
    response: {
      message: "Two students are at risk.",
      status: "ok",
      conversationType: "student_risk_scan",
      activeTools: ["students.directory"],
      followUpSuggestions: ["What evidence supports this?"],
      citations: [{ tool: "students.directory", available: true }],
      data: { module: "student", lifecycleTrace: [stage("action", 12)], sections: [{ type: "text", title: "Why", body: "Three signals fired." }], ...overrides },
    },
    actions: [
      {
        key: "approve",
        label: "Approve",
        intent: "approve_recommendation",
        utterance: "Approve the recommendation.",
        payload: { recommendation_id: 143 },
        style: "primary",
      },
    ],
  };
}

function message(parts: AskUIMessage["parts"]): AskUIMessage {
  return { id: "m1", role: "assistant", parts };
}

test("the answer is the text parts, joined", () => {
  const turn = message([
    { type: "text", text: "Two students " },
    { type: "text", text: "are at risk." },
  ]);

  assert.equal(textOf(turn), "Two students are at risk.");
});

test("stages render in ladder order, not arrival order", () => {
  // A stage that reports late must not jump to the bottom of a ladder someone is
  // scanning by number.
  const turn = message([
    { type: "data-stage", id: "stage-action", data: stage("action", 12) },
    { type: "data-stage", id: "stage-conversation", data: stage("conversation", 1) },
  ]);

  assert.deepEqual(
    stagesOf(turn).map((row) => row.key),
    ["conversation", "action"]
  );
});

test("a streaming turn draws the ladder from the stages that have arrived", () => {
  // This is the whole point of streaming the stages: the ladder fills in while the
  // turn runs, instead of appearing whole at the end.
  const turn = message([
    { type: "data-stage", id: "stage-conversation", data: stage("conversation", 1) },
    { type: "data-stage", id: "stage-planning", data: stage("planning", 4) },
    { type: "text", text: "Looking..." },
  ]);

  const panel = toPanelMessage(turn);

  assert.equal(panel.lifecycleTrace.length, 2);
  assert.equal(panel.content, "Looking...");
  // Nothing is offered for approval until the turn has actually finished.
  assert.deepEqual(panel.actions, []);
});

test("once the turn finishes, the settled trace wins over the streamed stages", () => {
  const turn = message([
    { type: "data-stage", id: "stage-conversation", data: stage("conversation", 1) },
    { type: "text", text: "Two students are at risk." },
    { type: "data-ask", id: "ask", data: { conversationId: 7, reply: reply() } },
  ]);

  const panel = toPanelMessage(turn);

  assert.deepEqual(
    panel.lifecycleTrace.map((row) => row.key),
    ["action"]
  );
  assert.equal(panel.module, "student");
  assert.equal(panel.followUps[0], "What evidence supports this?");
  assert.equal(panel.citations[0].tool, "students.directory");
  assert.equal(panel.actions[0].payload.recommendation_id, 143);
});

test("a finished turn whose backend trace is empty keeps the streamed ladder", () => {
  // An empty `lifecycleTrace` is not nullish, so a `??` fallback would have thrown the
  // streamed rows away and left the reader with no ladder at all.
  const turn = message([
    { type: "data-stage", id: "stage-evidence", data: stage("evidence", 8) },
    { type: "data-ask", id: "ask", data: { conversationId: 7, reply: reply({ lifecycleTrace: [] }) } },
  ]);

  assert.deepEqual(
    toPanelMessage(turn).lifecycleTrace.map((row) => row.key),
    ["evidence"]
  );
});

test("the thread id travels with the finished answer", () => {
  const turn = message([
    { type: "data-ask", id: "ask", data: { conversationId: 7, reply: reply() } },
  ]);

  assert.equal(askDataOf(turn)?.conversationId, 7);
});

test("a turn still in flight has no answer part", () => {
  assert.equal(askDataOf(message([{ type: "text", text: "..." }])), null);
});

test("messages stored by an older build of the panel are discarded", () => {
  // The previous transport persisted `{role, content}` with no parts. Rendering one
  // would throw, so a stale key costs the transcript rather than the panel.
  const usable = usableStoredMessages([
    { id: "old-1", role: "assistant", content: "no parts here" },
    null,
    "not a message",
    { id: "m1", role: "user", parts: [{ type: "text", text: "Hello" }] },
  ]);

  assert.equal(usable.length, 1);
  assert.equal(usable[0].id, "m1");
});

test("an assistant turn is incomplete until its answer part arrives", () => {
  // The panel tells "still arriving" from "stopped before it finished" by whether a
  // request is in flight; both read as incomplete here.
  const inFlight = message([{ type: "text", text: "Two students" }]);
  const finished = message([
    { type: "text", text: "Two students are at risk." },
    { type: "data-ask", id: "ask", data: { conversationId: 7, reply: reply() } },
  ]);

  assert.equal(toPanelMessage(inFlight).isComplete, false);
  assert.equal(toPanelMessage(finished).isComplete, true);
  // A question the user typed is never waiting on anything.
  assert.equal(
    toPanelMessage({ id: "u1", role: "user", parts: [{ type: "text", text: "Hi" }] }).isComplete,
    true
  );
});

test("a turn in flight shows the tools that have already run", () => {
  // Proves the streaming path goes through the adapter rather than rendering blanks
  // until `done`.
  const turn = message([
    {
      type: "data-stage",
      id: "stage-laravel_mcp",
      data: {
        ...stage("laravel_mcp", 6),
        data: { calls: [{ tool: "students.search", status: "completed" }] },
      },
    },
  ]);

  const panel = toPanelMessage(turn);

  assert.equal(panel.citations.length, 1);
  assert.equal(panel.citations[0].tool, "students.search");
  assert.equal(panel.isComplete, false);
});

test("the streamed text is what the reader keeps when the turn finishes", () => {
  // Swapping it for the composed copy on the last chunk would re-render the bubble
  // for no reason — they are the same words.
  const turn = message([
    { type: "text", text: "Two students are at risk." },
    { type: "data-ask", id: "ask", data: { conversationId: 7, reply: reply() } },
  ]);

  assert.equal(toPanelMessage(turn).content, "Two students are at risk.");
});

test("a finished turn exposes its sections; a streaming one has none yet", () => {
  // The backend composes the answer at the end, so there is nothing structured to draw
  // until `done` — the streamed text carries the turn until then.
  const streaming = message([{ type: "text", text: "Looking..." }]);
  const finished = message([
    { type: "data-ask", id: "ask", data: { conversationId: 7, reply: reply() } },
  ]);

  assert.deepEqual(toPanelMessage(streaming).sections, []);
  assert.equal(Array.isArray(toPanelMessage(finished).sections), true);
});
