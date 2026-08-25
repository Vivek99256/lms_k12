import test from "node:test";
import assert from "node:assert/strict";
import type { ProjectContext } from "@shared/conversational-ai-core";
import {
  clearFollowUpState,
  recordFollowUpQuery,
  type ConversationFocusEntity,
} from "@shared/conversational-ai-core";
import {
  getContextualFollowUpIntent,
  getStudentFeeIntent,
  isAnalyticalLmsQuery,
} from "./adapter";

const USER = "user-fees";
const CONVERSATION = "conversation-fees";

function contextFor(
  message: string,
  page: Partial<ProjectContext> = {}
): ProjectContext {
  return {
    projectId: "lms_k12",
    projectName: "Teach Connect LMS_K12",
    userId: USER,
    conversationId: CONVERSATION,
    latestUserMessage: { role: "user", content: message },
    messageHistory: [{ role: "user", content: message }],
    detectedLanguage: "english",
    request: { messages: [{ role: "user", content: message }] },
    ...page,
  } as unknown as ProjectContext;
}

function route(message: string, page: Partial<ProjectContext> = {}) {
  return getStudentFeeIntent(contextFor(message, page), message.toLowerCase());
}

function rememberFocus(focus: ConversationFocusEntity, module: string) {
  clearFollowUpState(USER);
  recordFollowUpQuery(
    { userId: USER, sessionId: CONVERSATION },
    {
      tool: "seed",
      module,
      filters: {},
      focus,
      candidates: [focus],
      resolvedEntities: [],
      status: "success",
    }
  );
}

const STUDENT_FOCUS: ConversationFocusEntity = {
  kind: "student",
  name: "Zeel J Tank",
  id: "233",
  attributes: { standard: "7", division: "B" },
};

const CLASS_FOCUS: ConversationFocusEntity = {
  kind: "class",
  name: "7 B",
  attributes: { standard: "7", division: "B" },
};

/* -------------------------------------------------------------------------- */
/* The reported defect                                                        */
/* -------------------------------------------------------------------------- */

test("the reported defect: a single-student fees question is not an analytical query", () => {
  // "summarise" put this on the analytical branch, which handed the turn to the
  // planner. With no single-student fee tool to plan with, the planner settled on
  // the result report — and the user was asked which report type they wanted.
  const message = "Summarize this student's pending fees.";

  // The analytical matcher still fires; that is why this has to be claimed first.
  assert.equal(isAnalyticalLmsQuery(message.toLowerCase()), true);

  const intent = route(message, { entityType: "student", entityId: 233 });
  assert.equal(intent?.suggestedTool, "getStudentFeeDetails");
  assert.equal(intent?.capability, "student_fee_details");
  assert.equal(intent?.entities.focusStudentId, "233");
});

test("the student on the page supplies the id, so nothing has to be restated", () => {
  const intent = route("Summarize this student's pending fees.", {
    entityType: "student",
    entityId: "512",
  });

  assert.equal(intent?.suggestedTool, "getStudentFeeDetails");
  assert.equal(intent?.entities.focusStudentId, "512");
});

test("without an id the lookup tool runs first, rather than a report question", () => {
  const intent = route("Summarize this student's pending fees.");

  assert.equal(intent?.suggestedTool, "findStudentFeeRecord");
  assert.equal(intent?.capability, "student_fee_lookup");
});

test("other single-student phrasings reach the same tool", () => {
  const page = { entityType: "student", entityId: 233 };

  assert.equal(route("What are her pending fees?", page)?.suggestedTool, "getStudentFeeDetails");
  assert.equal(route("Show his fee dues", page)?.suggestedTool, "getStudentFeeDetails");
  assert.equal(
    route("What is this student's outstanding amount?", page)?.suggestedTool,
    "getStudentFeeDetails"
  );
  assert.equal(
    route("Give me a summary of the student's fees", page)?.suggestedTool,
    "getStudentFeeDetails"
  );
});

/* -------------------------------------------------------------------------- */
/* Existing fee behaviour is left alone                                       */
/* -------------------------------------------------------------------------- */

test("questions across students still belong to the defaulter list", () => {
  const page = { entityType: "student", entityId: 233 };

  // Even standing on a student's page, a question about many students is not
  // about that student.
  assert.equal(route("Which students have pending fees?", page), null);
  assert.equal(route("Show me the fees defaulters", page), null);
  assert.equal(route("How many students have unpaid fees?", page), null);
  assert.equal(route("Who has not paid this term?", page), null);
  assert.equal(route("List students with outstanding dues", page), null);
});

test("collecting a fee keeps its own workflow", () => {
  const page = { entityType: "student", entityId: 233 };

  assert.equal(route("Collect fees for this student", page), null);
  assert.equal(route("Pay this student's fees", page), null);
});

test("non-fee questions are untouched, including on a student's page", () => {
  const page = { entityType: "student", entityId: 233 };

  assert.equal(route("Summarize this student's attendance", page), null);
  assert.equal(route("Show me the merit report", page), null);
  assert.equal(route("Which students are at academic risk?", page), null);
  assert.equal(route("How many students are there?", page), null);
});

test("a fees question on a page that is not about a student needs a named subject", () => {
  // No page student and no single-student wording: nothing to claim.
  assert.equal(route("Show the fee collection total", { entityType: "class", entityId: 7 }), null);
});

/* -------------------------------------------------------------------------- */
/* The follow-up router: fees was the one topic ignoring what was in focus     */
/* -------------------------------------------------------------------------- */

test("a fee follow-up about the student in focus reads that student's record", () => {
  rememberFocus(STUDENT_FOCUS, "fees");

  const intent = getContextualFollowUpIntent(contextFor("What about their pending fees?"));

  assert.equal(intent?.suggestedTool, "getStudentFeeDetails");
  assert.equal(intent?.capability, "student_fee_details");
});

test("a fee follow-up about a class in focus still lists defaulters", () => {
  rememberFocus(CLASS_FOCUS, "fees");

  const intent = getContextualFollowUpIntent(contextFor("What about their pending fees?"));

  assert.equal(intent?.suggestedTool, "listFeesDefaulters");
  assert.equal(intent?.capability, "unpaid_fees");
});

test("a defaulter follow-up stays on the defaulter list even with a student in focus", () => {
  rememberFocus(STUDENT_FOCUS, "fees");

  const intent = getContextualFollowUpIntent(
    contextFor("Which students in their class are defaulters?")
  );

  assert.equal(intent?.suggestedTool, "listFeesDefaulters");
});
