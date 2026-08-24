import test from "node:test";
import assert from "node:assert/strict";
import type { ProjectContext } from "@shared/conversational-ai-core";
import {
  clearFollowUpState,
  recordFollowUpQuery,
  type ConversationFocusEntity,
} from "@shared/conversational-ai-core";
import {
  detectQuestionTopic,
  getContextualFollowUpIntent,
  namesOwnModule,
} from "./adapter";

const USER = "user-1";
const CONVERSATION = "conversation-1";

function contextFor(message: string): ProjectContext {
  return {
    projectId: "lms_k12",
    projectName: "Teach Connect LMS_K12",
    userId: USER,
    conversationId: CONVERSATION,
    latestUserMessage: { role: "user", content: message },
    messageHistory: [{ role: "user", content: message }],
    detectedLanguage: "english",
    request: { messages: [{ role: "user", content: message }] },
  } as unknown as ProjectContext;
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

const CLASS_FOCUS: ConversationFocusEntity = {
  kind: "class",
  name: "7 B",
  attributes: { standard: "7", division: "B", standardId: "7", divisionId: "12" },
};

/* -------------------------------------------------------------------------- */
/* A question that names its own module answers its own question              */
/* -------------------------------------------------------------------------- */

test("a message naming its own module is self-contained", () => {
  // The reported defect: this was being answered with the previous turn's
  // student list because a continuation rule matched the word "standard".
  assert.equal(namesOwnModule("Show attendance for Standard 7"), true);
  assert.equal(namesOwnModule("Show homework for Standard 7 B"), true);
  assert.equal(namesOwnModule("Show fees defaulters in Standard 9"), true);
  assert.equal(namesOwnModule("Which subjects are mapped to Standard 7?"), true);
});

test("an elliptical message is not self-contained, so context still applies", () => {
  assert.equal(namesOwnModule("Which division is lowest?"), false);
  assert.equal(namesOwnModule("And for Standard 8?"), false);
  assert.equal(namesOwnModule("How many students are in it?"), false);
  assert.equal(namesOwnModule("Why?"), false);
});

test("scope words alone never make a message self-contained", () => {
  // "Standard" and "division" say where to look, not what to look at.
  assert.equal(namesOwnModule("What about Standard 8"), false);
  assert.equal(detectQuestionTopic("and division b"), null);
});

/* -------------------------------------------------------------------------- */
/* Topic detection                                                            */
/* -------------------------------------------------------------------------- */

test("the topic comes from what the question asks for", () => {
  assert.equal(detectQuestionTopic("show attendance for standard 7"), "attendance");
  assert.equal(detectQuestionTopic("how many students are in it"), "students");
  assert.equal(detectQuestionTopic("which teachers are assigned to it"), "teachers");
  assert.equal(detectQuestionTopic("what about their fees"), "fees");
  assert.equal(detectQuestionTopic("which subjects does it have"), "subjects");
  assert.equal(detectQuestionTopic("why"), null);
});

test("attendance wins over students when a question names both", () => {
  assert.equal(
    detectQuestionTopic("which students were absent in standard 7"),
    "attendance"
  );
});

/* -------------------------------------------------------------------------- */
/* Follow-ups route on the question, not only on the subject                  */
/* -------------------------------------------------------------------------- */

test("a roster follow-up about a class returns students, not attendance", () => {
  rememberFocus(CLASS_FOCUS, "attendance");

  const intent = getContextualFollowUpIntent(contextFor("How many students are in it?"));

  assert.equal(intent?.suggestedTool, "getStudentDirectory");
  // The class must travel with it, or the count widens to the whole institute.
  assert.equal(intent?.entities.focusStandard, "7");
  assert.equal(intent?.entities.focusDivision, "B");
});

test("an attendance follow-up about the same class returns attendance", () => {
  rememberFocus(CLASS_FOCUS, "students");

  const intent = getContextualFollowUpIntent(contextFor("What is its attendance today?"));

  assert.equal(intent?.suggestedTool, "getAttendanceOverview");
  assert.equal(intent?.entities.focusStandard, "7");
});

test("a teacher follow-up about a class returns that class's teachers", () => {
  rememberFocus(CLASS_FOCUS, "attendance");

  const intent = getContextualFollowUpIntent(contextFor("Which teachers teach it?"));

  assert.equal(intent?.suggestedTool, "getClassTeachers");
});

test("a bare 'Why?' explains the subject rather than switching module", () => {
  rememberFocus(
    { kind: "department", name: "Workplace Safety and Health", attributes: {} },
    "departments"
  );

  const intent = getContextualFollowUpIntent(contextFor("Why?"));

  assert.equal(intent?.suggestedTool, "getDepartmentInsight");
  assert.equal(intent?.entities.focusDepartmentName, "Workplace Safety and Health");
});

test("a fee follow-up about a student stays on that student's name", () => {
  rememberFocus(
    {
      kind: "student",
      name: "Zeel J Tank",
      attributes: { standard: "7", division: "A" },
    },
    "fees"
  );

  const intent = getContextualFollowUpIntent(contextFor("What is their attendance like?"));

  assert.equal(intent?.suggestedTool, "getStudentAttendanceDetail");
  assert.equal(intent?.entities.focusStudentName, "Zeel J Tank");
});

test("with nothing remembered, a follow-up yields no intent to guess from", () => {
  clearFollowUpState(USER);
  assert.equal(getContextualFollowUpIntent(contextFor("Why?")), null);
});
