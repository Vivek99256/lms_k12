import test from "node:test";
import assert from "node:assert/strict";
import { getIntelligenceCapability, isAnalyticalLmsQuery } from "./adapter";

function capability(message: string) {
  return getIntelligenceCapability(message.toLowerCase());
}

/*
 * These cover the defect that kept the agentic backend unreachable: the
 * deterministic fast path matched "risk" via isAnalyticalLmsQuery and returned
 * analyzeLmsData before the classifier ever ran, so the eight intelligence tools
 * were never candidates. getIntelligenceCapability has to claim these first.
 */

test("academic risk questions are claimed for the intelligence layer", () => {
  assert.equal(capability("Analyze this student's academic risk"), "academic_risk");
  assert.equal(capability("Which students are at academic risk?"), "academic_risk");
  assert.equal(capability("Who is struggling in Standard 7?"), "academic_risk");
  assert.equal(capability("Which students need intervention?"), "academic_risk");
  assert.equal(capability("Is this student falling behind?"), "academic_risk");
});

test("asking why or for evidence reads the existing case instead of re-running it", () => {
  assert.equal(capability("Why is this student at risk?"), "explain_risk");
  assert.equal(capability("What evidence supports the academic risk flag?"), "explain_risk");
  assert.equal(capability("How do you know she is at risk?"), "explain_risk");
});

test("case and approval questions reach their own tools", () => {
  assert.equal(capability("What has the system flagged?"), "ai_cases");
  assert.equal(capability("Show me the open cases"), "ai_cases");
  assert.equal(capability("What needs my approval?"), "pending_recommendations");
  assert.equal(capability("Any pending recommendations?"), "pending_recommendations");
});

test("acting on a named item routes to the tool that acts, not the one that lists", () => {
  // Without this the word "approve" is claimed by the admission confirmation flow,
  // which then asks for enrollment and mobile numbers that a recommendation has no
  // notion of.
  assert.equal(capability("Approve recommendation 7."), "approve_recommendation");
  assert.equal(capability("Reject recommendation 4"), "approve_recommendation");
  assert.equal(capability("Approve approval 5"), "resolve_approval");
  assert.equal(capability("Approve workflow step 5"), "resolve_approval");
  assert.equal(capability("Reject approval 5"), "resolve_approval");
});

test("acting requires a named item, so a bare verb still asks rather than acts", () => {
  assert.equal(capability("Approve"), null);
  assert.equal(capability("Approve the recommendation"), null);
});

test("a workflow waiting on a person is a different queue from a pending recommendation", () => {
  // These two overlap heavily in wording and mean different things: one starts a
  // workflow, the other releases one that is already running and is the only route
  // to an intervention actually being created.
  assert.equal(capability("What workflow steps are waiting?"), "workflow_approvals");
  assert.equal(capability("Any stuck workflows?"), "workflow_approvals");
  assert.equal(capability("What pending steps do we have?"), "workflow_approvals");
  assert.equal(capability("What needs my approval?"), "pending_recommendations");
});

test("other modules keep their own notion of risk", () => {
  // A fee-risk ranking is a genuine cross-module analysis question and must stay
  // with analyzeLmsData; routing it to the academic risk agent would be both wrong
  // and expensive.
  assert.equal(capability("Which students have the highest fee risk?"), null);
  assert.equal(capability("Which students are at risk of transport fee default?"), null);
  assert.equal(capability("Any library risk this term?"), null);
});

test("ordinary lookups are not claimed", () => {
  assert.equal(capability("How many students are there?"), null);
  assert.equal(capability("Show homework for Standard 7"), null);
  assert.equal(capability("What is the capital of Japan?"), null);
});

test("the analytical matcher still recognises these, so ordering is what protects them", () => {
  // isAnalyticalLmsQuery deliberately still matches "risk" — it is used for genuine
  // cross-module analysis. The guarantee is precedence, not exclusion, so this
  // asserts the overlap really exists and the fix cannot be silently reordered away.
  assert.equal(isAnalyticalLmsQuery("which students are at academic risk?"), true);
  assert.equal(capability("which students are at academic risk?"), "academic_risk");
});
