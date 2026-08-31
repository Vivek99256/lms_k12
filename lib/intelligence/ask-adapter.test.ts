import assert from "node:assert/strict";
import { test } from "node:test";

import { executedTools, renderAnswer, toChatShapedReply } from "./ask-adapter";
import type { AskResult, TraceStage } from "./types";

function stage(key: string, overrides: Partial<TraceStage> = {}): TraceStage {
  return {
    key,
    order: 1,
    layer: key,
    status: "ran",
    summary: "",
    component: "",
    surface: "",
    data: {},
    records: {},
    verify: {},
    duration_ms: null,
    note: null,
    ...overrides,
  };
}

function result(overrides: Partial<AskResult> = {}): AskResult {
  return {
    conversation: { id: 1, reference: "CONV-1", turn_id: 1, turn: 1 },
    question: "Which students are at academic risk?",
    intent: { key: "student_risk_scan", label: "Find students at risk", confidence: 0.9, slots: {} },
    answer: { headline: "Two students are at risk.", sections: [], actions: [], follow_ups: [] },
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

test("the headline leads the rendered answer", () => {
  const text = renderAnswer({
    headline: "Two students are at risk.",
    sections: [{ type: "text", title: "Why", body: "Attendance fell below 70%." }],
    actions: [],
    follow_ups: [],
  });

  assert.ok(text.startsWith("Two students are at risk."));
  assert.match(text, /\*\*Why\*\*/);
  assert.match(text, /Attendance fell below 70%\./);
});

test("an evidence row keeps the table it came from", () => {
  // The provenance is the whole reason to trust the sentence above it. A render that
  // tidies the table name away leaves a claim nobody can check by hand.
  //
  // The fixture matches what AnswerComposer::evidence actually emits: `source` is a
  // pre-formatted string, not an object. An earlier version of this test invented
  // `source: { table }`, which is why it passed against a renderer that read
  // `source.table` and printed "computed" for every row in production.
  const text = renderAnswer({
    headline: "Evidence",
    sections: [
      {
        type: "evidence",
        title: "Supporting evidence",
        items: [
          {
            id: 41,
            kind: "metric",
            summary: "Attendance rate",
            value: "62%",
            source: "attendance_student #4821",
            observed_at: "2026-08-01",
            verified: true,
            is_generated: false,
          },
          {
            id: 42,
            kind: "inference",
            summary: "Predicted decline",
            value: null,
            source: "computed",
            observed_at: null,
            verified: false,
            is_generated: true,
          },
        ],
      },
    ],
    actions: [],
    follow_ups: [],
  });

  assert.match(text, /attendance_student #4821/);
  assert.match(text, /✓ Attendance rate = 62%/);
  // Unverified and generated rows are marked rather than dropped.
  assert.match(text, /○ Predicted decline \(computed\) \[generated\]/);
});

test("a key/value section renders labels, not array indices", () => {
  // The backend sends a list of {label, value}. Reading it as a keyed object produced
  // "- 0: [object Object]" for every row of every governance and breakdown section.
  const text = renderAnswer({
    headline: "Recommendation",
    sections: [
      {
        type: "key_values",
        title: "The commitment behind it",
        items: [
          { label: "Objective", value: "Raise assessment average" },
          { label: "Measured by", value: "Assessment average" },
          { label: "Checked after", value: "" },
        ],
      },
    ],
    actions: [],
    follow_ups: [],
  });

  assert.match(text, /- Objective: Raise assessment average/);
  assert.match(text, /- Measured by: Assessment average/);
  // An empty value is dropped rather than rendered as a dangling label.
  assert.doesNotMatch(text, /Checked after/);
  assert.doesNotMatch(text, /\[object Object\]/);
  assert.doesNotMatch(text, /- 0:/);
});

test("an empty section is dropped rather than rendered as a bare heading", () => {
  const text = renderAnswer({
    headline: "Nothing to report.",
    sections: [
      { type: "text", title: "Why", body: "   " },
      { type: "records", title: "Students", items: [] },
    ],
    actions: [],
    follow_ups: [],
  });

  assert.equal(text, "Nothing to report.");
});

test("executed tools are read from the transport stage, not from the plan", () => {
  // A plan names candidates; a turn selects by actually calling. Crediting an answer
  // to a candidate would attribute it to a tool that never ran.
  const trace = [
    stage("planning", { data: { candidate_tools: ["students.search", "fees.get_pending"] } }),
    stage("laravel_mcp", { data: { tools: ["students.search"] } }),
  ];

  assert.deepEqual(executedTools(trace), ["students.search"]);
});

test("a trace with no transport stage reports no tools rather than throwing", () => {
  assert.deepEqual(executedTools([stage("conversation")]), []);
});

test("a refused tool call is reported as unavailable, not omitted", () => {
  // Laravel MCP turning a call down is a governance decision the user is entitled to
  // see. Hiding it makes a partial answer look complete.
  const reply = toChatShapedReply(
    result({
      lifecycle_trace: [
        stage("laravel_mcp", {
          data: {
            tools: ["students.search"],
            calls: [
              { tool: "students.search", status: "completed" },
              { tool: "fees.get_pending", status: "blocked", error: "Outside the tool's allowed roles." },
            ],
          },
        }),
      ],
      module: {
        key: "student",
        label: "Student",
        entity_key: "student",
        capabilities: {},
        mcp_tools: [],
        agent_key: "k12_academic_risk",
        workflow_key: "k12_academic_intervention",
        case_type: "academic_risk",
        reaches_recommendation: true,
        reaches_action: true,
      },
    }),
    "msg-1"
  );

  assert.equal(reply.response.citations.length, 2);
  assert.deepEqual(reply.response.citations[0], {
    tool: "students.search",
    module: "student",
    available: true,
    unavailableSignals: undefined,
  });
  assert.equal(reply.response.citations[1].available, false);
  assert.deepEqual(reply.response.citations[1].unavailableSignals, [
    "Outside the tool's allowed roles.",
  ]);
});

test("a blocked stage makes the whole turn read as refused", () => {
  const reply = toChatShapedReply(
    result({
      lifecycle_trace: [
        stage("conversation"),
        stage("agent", { status: "blocked", summary: "The agent was not permitted to run." }),
      ],
    }),
    "msg-2"
  );

  assert.equal(reply.response.status, "blocked");
});

test("a turn where every stage ran or waited reads as ok", () => {
  const reply = toChatShapedReply(
    result({
      lifecycle_trace: [
        stage("conversation"),
        stage("human_approval", { status: "pending" }),
        stage("action", { status: "not_reached" }),
      ],
    }),
    "msg-3"
  );

  assert.equal(reply.response.status, "ok");
});

test("an offered action keeps the record id it was rendered against", () => {
  // Losing the payload would let an approval land on whatever was most recently
  // mentioned rather than on the row the user was looking at.
  const reply = toChatShapedReply(
    result({
      answer: {
        headline: "One intervention is waiting.",
        sections: [],
        actions: [
          {
            key: "approve",
            label: "Approve: extra practice",
            intent: "approve_recommendation",
            utterance: "Approve the recommendation.",
            payload: { recommendation_id: 42 },
            style: "primary",
          },
        ],
        follow_ups: ["What evidence supports this?"],
      },
    }),
    "msg-4"
  );

  assert.equal(reply.actions.length, 1);
  assert.deepEqual(reply.actions[0].payload, { recommendation_id: 42 });
  assert.equal(reply.actions[0].utterance, "Approve the recommendation.");
  assert.deepEqual(reply.response.followUpSuggestions, ["What evidence supports this?"]);
});

test("the lifecycle trace travels with the reply so the ladder can be drawn", () => {
  const trace = [stage("conversation"), stage("action", { status: "pending" })];

  const reply = toChatShapedReply(
    result({ lifecycle_trace: trace, depth_reached: 12, pipeline: "lifecycle_v2" }),
    "msg-5"
  );

  assert.equal(reply.response.data.lifecycleTrace?.length, 2);
  assert.equal(reply.response.data.depthReached, 12);
  assert.equal(reply.response.data.pipeline, "lifecycle_v2");
});

test("a turn stored by the previous pipeline still renders", () => {
  // Turns recorded before the cutover carry the fifteen-stage ladder under `trace`
  // and nothing under `lifecycle_trace`. Falling back keeps history readable.
  const reply = toChatShapedReply(
    result({
      lifecycle_trace: [],
      trace: [stage("laravel_mcp", { data: { tools: ["students.search"] } })],
    }),
    "msg-6"
  );

  assert.deepEqual(reply.response.activeTools, ["students.search"]);
});
