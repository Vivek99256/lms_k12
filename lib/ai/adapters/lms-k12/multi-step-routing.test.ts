import test from "node:test";
import assert from "node:assert/strict";
import type { ProjectContext } from "@shared/conversational-ai-core";
import { isMultiStepQuery, lmsK12Adapter } from "./adapter";

function ctx(message: string): ProjectContext {
  return {
    projectId: "lms_k12",
    projectName: "Teach Connect LMS_K12",
    userId: "u",
    conversationId: "c",
    profileName: "admin",
    latestUserMessage: { role: "user", content: message },
    messageHistory: [{ role: "user", content: message }],
    detectedLanguage: "english",
    request: { messages: [{ role: "user", content: message }] },
  } as unknown as ProjectContext;
}

/** The deterministic tool for a message, or null when the turn goes to the model. */
async function routeTo(message: string) {
  try {
    return (await lmsK12Adapter.classifyIntent(ctx(message))).suggestedTool ?? null;
  } catch {
    // No model key in tests: reaching the classifier means no deterministic match.
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* A request for several things is not a lookup                               */
/* -------------------------------------------------------------------------- */

test("a request with several task verbs is recognised as multi-step", () => {
  assert.equal(
    isMultiStepQuery(
      "analyse the students with pending fees, explain the reasons, group them by priority and prepare a parent message"
    ),
    true
  );
});

test("a short question, or one with a single task verb, is still a lookup", () => {
  // One verb: ordinary phrasing for a single read.
  assert.equal(isMultiStepQuery("explain the reason for this case"), false);
  assert.equal(
    isMultiStepQuery(
      "explain in detail the reason this particular student was flagged by the system this term"
    ),
    false
  );
  // Two verbs but too short to be a piece of work.
  assert.equal(isMultiStepQuery("compare and rank them"), false);
  assert.equal(isMultiStepQuery("how many students are there?"), false);
});

test("the reported queries reach the planner instead of a single lookup", async () => {
  // Both of these were collapsed into one template fetch: they mention a template,
  // and the template branch matched on that word alone.
  assert.equal(
    await routeTo(
      "Analyze the students with pending fees, identify the students who appear to have the highest payment risk based on the available data, explain the reasons, group them by priority, and prepare a parent follow-up message using the approved AI template."
    ),
    "analyzeLmsData"
  );

  assert.equal(
    await routeTo(
      "Review the currently open admission enquiries, identify the candidates that should be prioritized based on their follow-up status and available admission information, explain why, and prepare the appropriate admission follow-up communication using the approved AI template."
    ),
    "analyzeLmsData"
  );
});

test("a cross-module analysis is not mistaken for an academic-risk case", async () => {
  // "falling behind" is an academic-risk phrase, so the intelligence layer claimed
  // this attendance comparison and answered it as a risk explanation.
  assert.equal(
    await routeTo(
      "Compare attendance across divisions of Standard 7 and explain which division is falling behind and why."
    ),
    "analyzeLmsData"
  );
});

test("multi-step requests in other modules reach the planner too", async () => {
  assert.equal(
    await routeTo(
      "Review the homework submissions for Standard 7, identify which subjects have the most outstanding work, and recommend which teachers to follow up with."
    ),
    "analyzeLmsData"
  );
  assert.equal(
    await routeTo(
      "Analyse the department headcount and recommend how staffing should be rebalanced across sub-departments."
    ),
    "analyzeLmsData"
  );
});

/* -------------------------------------------------------------------------- */
/* Everything that already worked keeps working                               */
/* -------------------------------------------------------------------------- */

test("single-purpose questions route exactly as they did before", async () => {
  const expected: Array<[string, string]> = [
    ["How many students are there?", "getStudentDirectory"],
    ["Which students have pending fees?", "listFeesDefaulters"],
    ["Show pending admissions", "listAdmissionEnquiries"],
    ["Confirm the admission for Riya Mayur Patel", "findAdmissionCandidate"],
    ["Summarize this student's pending fees.", "findStudentFeeRecord"],
    ["Which students are showing academic risk and need intervention?", "findStudentsAtRisk"],
    ["Why is this student at risk?", "explainStudentRisk"],
    ["Approve recommendation 12", "approveRecommendationAction"],
    ["Show today's attendance", "getAttendanceOverview"],
    ["Show homework for Standard 7", "listHomework"],
    ["Show me the merit report", "getResultReport"],
    ["Which courses are available?", "getCourseCatalog"],
    ["How many teachers are there?", "getTeacherDirectory"],
  ];

  for (const [message, tool] of expected) {
    assert.equal(await routeTo(message), tool, `"${message}" should route to ${tool}`);
  }
});

/* -------------------------------------------------------------------------- */
/* Product nouns are LMS words, not general knowledge                         */
/* -------------------------------------------------------------------------- */

test("questions about templates and approvals reach their own tools", async () => {
  // These carried no recognised LMS word, so the general-knowledge branch claimed
  // them and answered from the model rather than from the library or the queue.
  assert.equal(await routeTo("Which AI templates are available?"), "listAiTemplates");
  assert.equal(await routeTo("Use the Intervention Letter template"), "getAiTemplate");
  assert.equal(
    await routeTo("What needs my approval?"),
    "listRecommendationsAwaitingApproval"
  );
});
