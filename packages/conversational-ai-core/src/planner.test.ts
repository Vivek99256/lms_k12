import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCitations,
  describePlan,
  questionBlockedByGap,
  findBlockingGap,
  MAX_PLAN_STEPS,
  stepBudgetFor,
  toolsFromPlan,
  validatePlan,
  type ConversationPlan,
} from "./planner";

const ALLOWED = [
  "getDepartmentDirectory",
  "getDepartmentInsight",
  "getStudentDirectory",
  "findStudentsAtRisk",
];

function plan(overrides: Partial<ConversationPlan> = {}): ConversationPlan {
  return {
    goal: "Rank departments by training need.",
    steps: [
      {
        id: "departments",
        tool: "getDepartmentDirectory",
        purpose: "Load the departments.",
        dependsOn: [],
      },
    ],
    refuseIf: [],
    ...overrides,
  };
}

test("a plan naming an unavailable tool is rejected", () => {
  const result = validatePlan(
    plan({
      steps: [
        { id: "a", tool: "deleteEverything", purpose: "nope", dependsOn: [] },
      ],
    }),
    ALLOWED
  );

  assert.equal(result.valid, false);
  assert.equal(result.plan, null);
  assert.match(result.errors[0], /not available/);
});

test("a plan may only depend on steps that come before it", () => {
  // Backwards-only references make a cycle unrepresentable, so the steps can run
  // in written order without a topological sort.
  const result = validatePlan(
    plan({
      steps: [
        {
          id: "compare",
          tool: "getDepartmentInsight",
          purpose: "Compare.",
          dependsOn: ["departments"],
        },
        {
          id: "departments",
          tool: "getDepartmentDirectory",
          purpose: "Load.",
          dependsOn: [],
        },
      ],
    }),
    ALLOWED
  );

  assert.equal(result.valid, false);
  assert.match(result.errors[0], /does not appear before it/);
});

test("duplicate step ids are rejected", () => {
  const result = validatePlan(
    plan({
      steps: [
        { id: "a", tool: "getDepartmentDirectory", purpose: "one", dependsOn: [] },
        { id: "a", tool: "getStudentDirectory", purpose: "two", dependsOn: [] },
      ],
    }),
    ALLOWED
  );

  assert.equal(result.valid, false);
  assert.match(result.errors[0], /more than once/);
});

test("an empty plan is rejected", () => {
  const result = validatePlan(plan({ steps: [] }), ALLOWED);
  assert.equal(result.valid, false);
});

test("an over-length plan is rejected", () => {
  const steps = Array.from({ length: MAX_PLAN_STEPS + 1 }, (_, index) => ({
    id: `s${index}`,
    tool: "getDepartmentDirectory",
    purpose: "load",
    dependsOn: [],
  }));

  assert.equal(validatePlan(plan({ steps }), ALLOWED).valid, false);
});

test("a valid multi-step plan passes and yields its tools in order", () => {
  const valid = plan({
    steps: [
      {
        id: "departments",
        tool: "getDepartmentDirectory",
        purpose: "Load the departments.",
        dependsOn: [],
      },
      {
        id: "detail",
        tool: "getDepartmentInsight",
        purpose: "Read each department's signals.",
        dependsOn: ["departments"],
      },
    ],
  });

  assert.equal(validatePlan(valid, ALLOWED).valid, true);
  assert.deepEqual(toolsFromPlan(valid, ALLOWED), [
    "getDepartmentDirectory",
    "getDepartmentInsight",
  ]);
});

test("no plan means the full allowed set, never an empty one", () => {
  // This is the safety property: planning failing over must not leave the model
  // with fewer tools than it had before the planner existed.
  assert.deepEqual(toolsFromPlan(null, ALLOWED), ALLOWED);
});

test("the step budget grows with the plan but never shrinks below the old default", () => {
  assert.equal(stepBudgetFor(null), 6);
  assert.equal(stepBudgetFor(plan()), 6);
  assert.equal(
    stepBudgetFor(
      plan({
        steps: Array.from({ length: 5 }, (_, index) => ({
          id: `s${index}`,
          tool: "getDepartmentDirectory",
          purpose: "load",
          dependsOn: [],
        })),
      })
    ),
    7
  );
});

/*
 * The training question. The institute records no training or competency data, so
 * the only honest answer is a refusal — and it has to be produced by the pipeline,
 * not left to the model's discretion.
 */

const TRAINING_PLAN = plan({
  goal: "Identify the department with the greatest training need.",
  steps: [
    {
      id: "departments",
      tool: "getDepartmentDirectory",
      purpose: "Load the departments.",
      dependsOn: [],
    },
    {
      id: "signals",
      tool: "getDepartmentInsight",
      purpose: "Read each department's training signals.",
      dependsOn: ["departments"],
    },
  ],
  comparison: { metric: "training need", across: "departments" },
  refuseIf: [
    {
      whenUnavailable: "training records and completion",
      reason:
        "I can't determine training need — the system holds no training records, skill matrix or competency ratings.",
    },
  ],
});

test("a declared gap in the results forces the refusal", () => {
  const gap = findBlockingGap(TRAINING_PLAN, [
    {
      available: true,
      largestDepartment: { name: "Aircraft Maintenance", totalEmployees: 31 },
      unavailableSignals: [
        "skill matrix and competency ratings",
        "training records and completion",
      ],
    },
  ]);

  assert.notEqual(gap, null);
  assert.match(gap!.reason, /no training records/);
  assert.ok(gap!.missing.includes("training records and completion"));
});

test("results that carry the needed data do not trigger a refusal", () => {
  assert.equal(
    findBlockingGap(TRAINING_PLAN, [
      { available: true, departments: [{ name: "Aircraft Maintenance" }] },
    ]),
    null
  );
});

test("a plan with no refuseIf rule never refuses", () => {
  assert.equal(
    findBlockingGap(plan(), [{ unavailableSignals: ["training records and completion"] }]),
    null
  );
});

test("an unrelated gap does not trigger this plan's refusal", () => {
  assert.equal(
    findBlockingGap(TRAINING_PLAN, [{ unavailableSignals: ["bus route telemetry"] }]),
    null
  );
});

test("the rendered plan tells the model to run every step and when to refuse", () => {
  const described = describePlan(TRAINING_PLAN);

  assert.match(described!, /Call getDepartmentDirectory/);
  assert.match(described!, /Call getDepartmentInsight/);
  assert.match(described!, /compare training need across departments/);
  assert.match(described!, /do not answer the question/);
});

test("no plan renders no instructions", () => {
  assert.equal(describePlan(null), null);
});

/*
 * The deterministic and quota-fallback paths have no plan and no model, so the
 * refusal has to be decided from the question against whatever the tool said it
 * does not hold. This is the check that stops "which department needs the most
 * training?" being answered from headcount when the model is unavailable.
 */

const DEPARTMENT_RESULT = {
  available: true,
  largestDepartment: { name: "Aircraft Maintenance", totalEmployees: 31 },
  unavailableSignals: [
    "skill matrix and competency ratings",
    "training records and completion",
    "workload or task allocation",
    "staff attendance and leave",
    "performance appraisal",
  ],
};

test("a question about data the system does not record is refused", () => {
  const gap = questionBlockedByGap(
    "Which department needs the most training?",
    DEPARTMENT_RESULT
  );

  assert.notEqual(gap, null);
  assert.deepEqual(gap!.missing, ["training records and completion"]);
  assert.match(gap!.reason, /does not record/);
});

test("other unrecorded qualities are matched too", () => {
  assert.deepEqual(
    questionBlockedByGap("Which department has the worst workload?", DEPARTMENT_RESULT)!.missing,
    ["workload or task allocation"]
  );
  assert.deepEqual(
    questionBlockedByGap("Show me appraisal scores by department", DEPARTMENT_RESULT)!.missing,
    ["performance appraisal"]
  );
});

test("a question the data can answer is not refused", () => {
  // The guard must not fire on headcount questions, which this tool answers well.
  assert.equal(questionBlockedByGap("How many departments are there?", DEPARTMENT_RESULT), null);
  assert.equal(
    questionBlockedByGap("Which department has the most employees?", DEPARTMENT_RESULT),
    null
  );
});

test("generic words in a gap description do not cause false refusals", () => {
  // "records" and "completion" appear in "training records and completion" but are
  // too generic to imply the question is about training.
  assert.equal(
    questionBlockedByGap("How many student records are there?", DEPARTMENT_RESULT),
    null
  );
});

test("a result declaring no gaps never refuses", () => {
  assert.equal(questionBlockedByGap("Which department needs the most training?", {}), null);
  assert.equal(questionBlockedByGap("anything", null), null);
});

test("citations report the tools that actually ran", () => {
  const citations = buildCitations([
    { toolName: "getFeesSummary", output: { module: "fees", available: true } },
    { toolName: "getStudentDirectory", output: { module: "students", available: true } },
  ]);

  assert.deepEqual(
    citations.map((citation) => citation.tool),
    ["getFeesSummary", "getStudentDirectory"]
  );
  assert.equal(citations[0].module, "fees");
  assert.ok(citations.every((citation) => citation.available));
});

test("citations unwrap an envelope and carry the declared gaps", () => {
  const citations = buildCitations([
    {
      toolName: "getDepartmentDirectory",
      output: {
        data: {
          module: "departments",
          available: true,
          unavailableSignals: ["training records and completion"],
        },
      },
    },
  ]);

  assert.equal(citations[0].module, "departments");
  assert.deepEqual(citations[0].unavailableSignals, ["training records and completion"]);
});

test("a tool that returned nothing is marked unavailable", () => {
  const citations = buildCitations([
    { toolName: "getResultReport", output: { available: false, reason: "needs filters" } },
  ]);

  assert.equal(citations[0].available, false);
});

test("repeated calls to one tool are cited once", () => {
  const citations = buildCitations([
    { toolName: "getDepartmentInsight", output: { module: "departments" } },
    { toolName: "getDepartmentInsight", output: { module: "departments" } },
  ]);

  assert.equal(citations.length, 1);
});

test("a turn with no tool calls cites nothing", () => {
  // The property that matters: an answer the model produced unaided must not come
  // back looking sourced.
  assert.deepEqual(buildCitations([]), []);
});
