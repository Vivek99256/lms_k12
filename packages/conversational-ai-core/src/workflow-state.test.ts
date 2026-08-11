import test from "node:test";
import assert from "node:assert/strict";
import {
  clearConversationWorkflowState,
  getConversationWorkflowState,
  upsertConversationWorkflowState,
} from "./workflow-state";

test("workflow state persists and clears pending admission actions", () => {
  const projectId = "lms_k12";
  const userId = "42";
  const conversationId = "42";

  upsertConversationWorkflowState(projectId, userId, conversationId, {
    workflowId: "admission_confirmation",
    currentStage: "awaiting_confirmation",
    matchedEntities: [],
    collectedSlots: {},
    missingSlots: [],
    pendingAction: {
      tool: "confirmAdmissionCandidate",
      payload: { id: "2022009" },
      confirmationRequired: true,
    },
  });

  const stored = getConversationWorkflowState(projectId, userId, conversationId);
  assert.equal(stored?.pendingAction?.tool, "confirmAdmissionCandidate");

  clearConversationWorkflowState(projectId, userId, conversationId);
  assert.equal(
    getConversationWorkflowState(projectId, userId, conversationId),
    null
  );
});
