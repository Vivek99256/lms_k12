import assert from "node:assert/strict";
import { test } from "node:test";

import {
  executedTools,
  renderAnswer,
  toChatShapedReply,
  toStreamingReply,
  withStreamedTrace,
  STREAMING_STATUS,
} from "./ask-adapter";
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

/* -------------------------------------------------------------------------- */
/* A turn that has not finished yet                                            */
/* -------------------------------------------------------------------------- */

test("a turn in flight renders the text that has arrived so far", () => {
  const reply = toStreamingReply({
    messageId: "msg-7",
    text: "Two students in standard 9",
    stages: [stage("conversation")],
  });

  assert.equal(reply.message.content, "Two students in standard 9");
  assert.equal(reply.response.status, STREAMING_STATUS);
});

test("the ladder fills in stage by stage, in ladder order", () => {
  // The stages complete out of order — a late one must not jump to the bottom of a
  // ladder somebody is reading by number.
  const reply = toStreamingReply({
    messageId: "msg-8",
    text: "",
    stages: [
      stage("evidence", { order: 8 }),
      stage("conversation", { order: 1 }),
      stage("planning", { order: 4 }),
    ],
  });

  assert.deepEqual(
    reply.response.data.lifecycleTrace?.map((row) => row.key),
    ["conversation", "planning", "evidence"]
  );
});

test("nothing is offered to act on until the turn has finished", () => {
  // An Approve button drawn from a half-built trace would let somebody approve a
  // recommendation the pipeline has not finished drafting.
  const reply = toStreamingReply({
    messageId: "msg-9",
    text: "Two students are at risk.",
    stages: [stage("recommendation", { order: 10 })],
  });

  assert.deepEqual(reply.actions, []);
  assert.deepEqual(reply.response.followUpSuggestions, []);
});

test("sources appear as soon as the MCP stage reports, not at the end", () => {
  // They describe what has already happened, so showing them early is honest.
  const reply = toStreamingReply({
    messageId: "msg-10",
    text: "",
    stages: [
      stage("laravel_mcp", {
        order: 6,
        data: {
          tools: ["students.search"],
          calls: [
            { tool: "students.search", status: "completed" },
            { tool: "fees.getPending", status: "refused", error: "out of scope" },
          ],
        },
      }),
    ],
  });

  assert.deepEqual(reply.response.activeTools, ["students.search"]);
  assert.equal(reply.response.citations.length, 2);
  assert.equal(reply.response.citations[1].available, false);
  assert.deepEqual(reply.response.citations[1].unavailableSignals, ["out of scope"]);
});

test("a stage that blocks mid-stream is reported as a refusal straight away", () => {
  const reply = toStreamingReply({
    messageId: "msg-11",
    text: "",
    stages: [stage("human_approval", { order: 11, status: "blocked" })],
  });

  assert.equal(reply.response.status, "blocked");
});

test("a finished reply keeps its own settled trace", () => {
  const settled = toChatShapedReply(
    result({ lifecycle_trace: [stage("action", { order: 12 })] }),
    "msg-12"
  );

  const merged = withStreamedTrace(settled, [stage("conversation", { order: 1 })]);

  assert.deepEqual(
    merged.response.data.lifecycleTrace?.map((row) => row.key),
    ["action"]
  );
});

test("a finished reply that carries no trace keeps the one the reader watched arrive", () => {
  // Replacing rows somebody watched fill in with nothing is the worst of both.
  const settled = toChatShapedReply(result({ lifecycle_trace: [], trace: [] }), "msg-13");

  const merged = withStreamedTrace(settled, [
    stage("evidence", { order: 8 }),
    stage("conversation", { order: 1 }),
  ]);

  assert.deepEqual(
    merged.response.data.lifecycleTrace?.map((row) => row.key),
    ["conversation", "evidence"]
  );
});

/* -------------------------------------------------------------------------- */
/* Every section type the backend can send                                     */
/* -------------------------------------------------------------------------- */

/*
 * The adapter is the only renderer left. Anything the backend composes that this file
 * does not handle reaches the user as nothing at all — silently, because a dropped
 * section looks exactly like a section the backend chose not to send. So each type it
 * claims to render has a test, and the key/value case below is why: reading that one
 * with `Object.entries` printed "- 0: [object Object]" for every row and nobody noticed
 * until a teacher asked what it meant.
 */

test("a records section renders the title, badge, detail lines and meta of each row", () => {
  const reply = toChatShapedReply(
    result({
      answer: {
        headline: "Two students need attention.",
        sections: [
          {
            type: "records",
            title: "At risk",
            items: [
              {
                title: "Tara Mehta",
                badge: "critical",
                lines: ["Missed 3 of 9 assignments"],
                meta: { Case: "CASE-2026-000044", Standard: "9 B" },
              },
            ],
          },
        ],
        actions: [],
        follow_ups: [],
      },
    }),
    "msg-records"
  );

  const content = reply.message.content;

  assert.match(content, /\*\*At risk\*\*/);
  assert.match(content, /- Tara Mehta \(critical\)/);
  assert.match(content, /Missed 3 of 9 assignments/);
  // Meta reads as one line of pairs, not as a JSON object.
  assert.match(content, /Case CASE-2026-000044 · Standard 9 B/);
  assert.doesNotMatch(content, /\[object Object\]/);
});

test("a steps section names each step and the state it is in", () => {
  // What the workflow answer is made of: a reader checking "what happened after I
  // approved" is reading exactly these lines.
  const reply = toChatShapedReply(
    result({
      answer: {
        headline: "The intervention workflow is part-way through.",
        sections: [
          {
            type: "steps",
            title: "Steps",
            items: [
              { label: "Draft the practice activities", step_key: "generate_activity", status: "completed" },
              { step_key: "teacher_approval", status: "awaiting_approval" },
              { label: "Create the intervention" },
            ],
          },
        ],
        actions: [],
        follow_ups: [],
      },
    }),
    "msg-steps"
  );

  const content = reply.message.content;

  assert.match(content, /- Draft the practice activities — completed/);
  // No label: the step key is the honest fallback, not an empty bullet.
  assert.match(content, /- teacher_approval — awaiting_approval/);
  // No status: "pending" is the truthful default for a step that has not started.
  assert.match(content, /- Create the intervention — pending/);
});

test("a comparison section renders each row as its own labelled pairs", () => {
  const reply = toChatShapedReply(
    result({
      answer: {
        headline: "Before and after.",
        sections: [
          {
            type: "comparison",
            title: "Assessment average",
            items: [{ metric: "Mathematics", baseline: 41, latest: 58 }],
          },
        ],
        actions: [],
        follow_ups: [],
      },
    }),
    "msg-comparison"
  );

  assert.match(reply.message.content, /- metric: Mathematics · baseline: 41 · latest: 58/);
  assert.doesNotMatch(reply.message.content, /\[object Object\]/);
});

test("several sections are separated, not run together", () => {
  // Titled sections are the structure the lifecycle composes its answer from; losing
  // the gaps turns a structured answer back into a wall of text.
  const reply = toChatShapedReply(
    result({
      answer: {
        headline: "Tara Mehta is at risk.",
        sections: [
          { type: "text", title: "Why", body: "Three signals fired." },
          { type: "text", title: "What next", body: "Start an intervention." },
        ],
        actions: [],
        follow_ups: [],
      },
    }),
    "msg-multi"
  );

  assert.equal(
    reply.message.content,
    "Tara Mehta is at risk.\n\n**Why**\nThree signals fired.\n\n**What next**\nStart an intervention."
  );
});

test("a section type this build does not know is dropped, not rendered as noise", () => {
  // The backend may grow a section type before the panel learns it. Dropping it keeps
  // an older client readable instead of printing an object at the user.
  const reply = toChatShapedReply(
    result({
      answer: {
        headline: "Answer.",
        // Deliberately not a member of AnswerSection — this is the forward-compat case.
        sections: [{ type: "timeline", title: "When", items: [{ at: "2026-09-01" }] } as never],
        actions: [],
        follow_ups: [],
      },
    }),
    "msg-unknown"
  );

  assert.equal(reply.message.content, "Answer.");
});

test("an answer with no sections at all is just its headline", () => {
  const reply = toChatShapedReply(result(), "msg-bare");

  assert.equal(reply.message.content, "Two students are at risk.");
});

test("the rendered text and the response message are the same words", () => {
  // The panel draws `message.content`; anything reading `response.message` — a log, an
  // export, a test — must not see a different answer.
  const reply = toChatShapedReply(
    result({
      answer: {
        headline: "Answer.",
        sections: [{ type: "text", title: "Detail", body: "Something true." }],
        actions: [],
        follow_ups: [],
      },
    }),
    "msg-parity"
  );

  assert.equal(reply.message.content, reply.response.message);
});

test("a citation is labelled with the module that answered", () => {
  // The panel prints `module || tool`, so an unlabelled citation shows an internal
  // tool name to a teacher. The module is what makes a source read as a place.
  const reply = toChatShapedReply(
    result({
      module: { key: "fees", label: "Fees" } as never,
      lifecycle_trace: [
        stage("laravel_mcp", {
          data: { calls: [{ tool: "fees.arrears", status: "completed" }] },
        }),
      ],
    }),
    "msg-citation-module"
  );

  assert.equal(reply.response.citations[0].module, "fees");
});

test("a transport stage with no calls yields no citations rather than throwing", () => {
  // The stage can report before it has called anything — every turn passes through
  // this state while streaming.
  const reply = toChatShapedReply(
    result({ lifecycle_trace: [stage("laravel_mcp", { data: {} })] }),
    "msg-no-calls"
  );

  assert.deepEqual(reply.response.citations, []);
  assert.deepEqual(reply.response.activeTools, []);
});

test("a tools list with non-string entries is filtered, not rendered", () => {
  // Defensive: this crosses a network boundary from PHP, where an array can carry
  // anything, and the value lands directly in the panel's source line.
  const reply = toChatShapedReply(
    result({
      lifecycle_trace: [
        stage("laravel_mcp", {
          data: { tools: ["students.search", null, 42, { name: "x" }, "fees.arrears"] },
        }),
      ],
    }),
    "msg-dirty-tools"
  );

  assert.deepEqual(reply.response.activeTools, ["students.search", "fees.arrears"]);
});

test("the answer's sections travel structured, not only flattened to text", () => {
  // The whole point of the section passthrough: a records section has to reach the
  // panel as rows it can draw a table from, not as the bullet points `renderAnswer`
  // makes of it. Both are carried — the text is the fallback and the transcript.
  const sections = [
    { type: "records" as const, title: "At risk", items: [{ title: "Abhi Raval", badge: "Critical" }] },
    { type: "key_values" as const, title: "Commitment", items: [{ label: "Measured by", value: "Assessment average" }] },
  ];

  const reply = toChatShapedReply(
    result({
      answer: { headline: "Two at risk.", sections, actions: [], follow_ups: [] },
    }),
    "msg-sections"
  );

  assert.equal(reply.response.data.sections?.length, 2);
  assert.equal(reply.response.data.sections?.[0].type, "records");
  // And the flattened copy still exists, unchanged.
  assert.match(reply.message.content, /At risk/);
});

test("a turn with no sections carries an empty list rather than undefined", () => {
  // The panel branches on `sections.length`; undefined would throw before it could.
  const reply = toChatShapedReply(result(), "msg-no-sections");

  assert.deepEqual(reply.response.data.sections, []);
});
