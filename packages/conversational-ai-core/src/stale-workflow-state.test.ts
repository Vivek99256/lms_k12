import path from "node:path";
import os from "node:os";

// Point the file store at a scratch directory before anything imports it, so the
// test never touches a developer's real .kilo state.
process.env.CONVERSATIONAL_AI_STATE_DIR = path.join(
  os.tmpdir(),
  "conversational-ai-stale-state-test"
);

import test from "node:test";
import assert from "node:assert/strict";
import { clearStaleWorkflowState, moduleForTool } from "./conversation";
import {
  clearConversationWorkflowState,
  getConversationWorkflowState,
  upsertConversationWorkflowState,
} from "./workflow-state";
import type { ConversationIntent } from "./schemas";
import type { ProjectContext } from "./types";

const PROJECT = "lms_k12";
const USER = "7013";
const CONVERSATION = "7013";

/** Only the fields clearStaleWorkflowState actually reads. */
function contextFor(message: string) {
  return {
    projectId: PROJECT,
    userId: USER,
    conversationId: CONVERSATION,
    latestUserMessage: { role: "user", content: message },
    request: { context: { conversationId: CONVERSATION } },
  } as unknown as ProjectContext;
}

function intentFor(suggestedTool?: string): ConversationIntent {
  return {
    type: "analyse",
    domain: "k12",
    capability: "test",
    entities: {},
    confidence: 0.9,
    requiresConfirmation: false,
    suggestedTool,
  };
}

/** Reinstates the half-finished fee-collection flow seen in the real transcripts. */
function openFeeCollectionFlow() {
  upsertConversationWorkflowState(PROJECT, USER, CONVERSATION, {
    module: "fees",
    currentStage: "collecting_slots",
    matchedEntities: [],
    collectedSlots: {},
    missingSlots: [],
  });
}

test.afterEach(() => {
  clearConversationWorkflowState(PROJECT, USER, CONVERSATION);
});

test("moduleForTool identifies the module a tool belongs to", () => {
  assert.equal(moduleForTool("getFeesSummary"), "fees");
  assert.equal(moduleForTool("listAdmissionEnquiries"), "admissions");
  assert.equal(moduleForTool("getDepartmentDirectory"), "hrms");
  assert.equal(moduleForTool("getStudentDirectory"), "student");
  assert.equal(moduleForTool("findStudentsAtRisk"), "intelligence");
  // Ambiguous or unknown tools yield nothing, which keeps the guard conservative.
  assert.equal(moduleForTool("analyzeLmsData"), null);
  assert.equal(moduleForTool(undefined), null);
});

test("an abandoned fee flow no longer answers an unrelated student question", () => {
  // The exact failure from the stored transcript: mid fee-collection, the user asked
  // a student question and got "Fee collection is ready for Unknown student".
  openFeeCollectionFlow();

  clearStaleWorkflowState(
    contextFor("How many students are enrolled?"),
    intentFor("getStudentDirectory")
  );

  assert.equal(getConversationWorkflowState(PROJECT, USER, CONVERSATION), null);
});

test("switching to an academic risk question also drops the stale flow", () => {
  openFeeCollectionFlow();

  clearStaleWorkflowState(
    contextFor("Analyze this student's academic risk"),
    intentFor("findStudentsAtRisk")
  );

  assert.equal(getConversationWorkflowState(PROJECT, USER, CONVERSATION), null);
});

test("slot answers inside the open flow are preserved", () => {
  // A bare name and class is how the user answers "which student?". It resolves to
  // no module, so the flow must survive — clearing here would restart the task.
  openFeeCollectionFlow();

  clearStaleWorkflowState(
    contextFor("GREEVA RAJESH RAFALIYA, 7, 102"),
    intentFor(undefined)
  );

  assert.equal(
    getConversationWorkflowState(PROJECT, USER, CONVERSATION)?.currentStage,
    "collecting_slots"
  );
});

test("a question in the same module keeps its flow", () => {
  openFeeCollectionFlow();

  clearStaleWorkflowState(
    contextFor("What is the outstanding amount?"),
    intentFor("getFeesSummary")
  );

  assert.equal(
    getConversationWorkflowState(PROJECT, USER, CONVERSATION)?.module,
    "fees"
  );
});

test("a bare follow-up keeps its flow, because it names no tool", () => {
  // "why?" carries no subject, so the classifier resolves no tool and no module can
  // be derived. The guard has nothing to act on and the open flow survives — which
  // is what lets "why?" still mean "why, about the thing we were just discussing".
  openFeeCollectionFlow();

  clearStaleWorkflowState(contextFor("why?"), intentFor(undefined));

  assert.equal(
    getConversationWorkflowState(PROJECT, USER, CONVERSATION)?.module,
    "fees"
  );
});

test("a completed flow is left alone", () => {
  upsertConversationWorkflowState(PROJECT, USER, CONVERSATION, {
    module: "fees",
    currentStage: "completed",
    matchedEntities: [],
    collectedSlots: {},
    missingSlots: [],
  });

  clearStaleWorkflowState(
    contextFor("How many students are enrolled?"),
    intentFor("getStudentDirectory")
  );

  assert.equal(
    getConversationWorkflowState(PROJECT, USER, CONVERSATION)?.currentStage,
    "completed"
  );
});
