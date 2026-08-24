import test from "node:test";
import assert from "node:assert/strict";
import {
  getModuleWorkflowConfig,
  getWorkflowConfigByWorkflowId,
  looksLikeDifferentModuleRequest,
  routeModuleWorkflow,
  shouldContinueModuleWorkflow,
  resolveWorkflowSelection,
} from "./module-workflow-routing";
<<<<<<< HEAD

test("shouldContinueModuleWorkflow returns false for idle stage", () => {
  const state = {
    currentStage: "idle",
    matchedEntities: [],
    collectedSlots: {},
    missingSlots: [],
  };
=======
import type { ConversationWorkflowState } from "./workflow-state";

/**
 * Routing only reads the stage/module fields, so tests describe just those and
 * let this helper supply the identifiers every stored state carries.
 */
function workflowState(
  overrides: Partial<ConversationWorkflowState> &
    Pick<ConversationWorkflowState, "currentStage">
): ConversationWorkflowState {
  return {
    conversationId: "conversation-1",
    projectId: "project-1",
    matchedEntities: [],
    collectedSlots: {},
    missingSlots: [],
    ...overrides,
  };
}

test("shouldContinueModuleWorkflow returns false for idle stage", () => {
  const state = workflowState({ currentStage: "idle" });
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d

  const result = shouldContinueModuleWorkflow(state, "How many students have pending fees?", {
    capability: "module_action",
    suggestedTool: "executeModuleAction",
  });

  assert.equal(result, false);
});

test("shouldContinueModuleWorkflow returns true for selecting_entity stage", () => {
<<<<<<< HEAD
  const state = {
    currentStage: "selecting_entity",
    matchedEntities: [],
    collectedSlots: {},
    missingSlots: [],
  };
=======
  const state = workflowState({ currentStage: "selecting_entity" });
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d

  const result = shouldContinueModuleWorkflow(state, "Rajesh", {
    capability: "fee_collection",
    suggestedTool: "findStudentFeeRecord",
  });

  assert.equal(result, true);
});

test("shouldContinueModuleWorkflow returns false when switching modules", () => {
<<<<<<< HEAD
  const state = {
    currentStage: "selecting_entity",
    module: "fees",
    matchedEntities: [],
    collectedSlots: {},
    missingSlots: [],
  };
=======
  const state = workflowState({ currentStage: "selecting_entity", module: "fees" });
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d

  const result = shouldContinueModuleWorkflow(state, "Show pending admissions", {
    capability: "admission_enquiries",
    suggestedTool: "listAdmissionEnquiries",
  });

  assert.equal(result, false);
});

test("shouldContinueModuleWorkflow returns true for affirmative in awaiting_confirmation", () => {
<<<<<<< HEAD
  const state = {
    currentStage: "awaiting_confirmation",
    module: "fees",
    matchedEntities: [],
    collectedSlots: {},
    missingSlots: [],
  };
=======
  const state = workflowState({ currentStage: "awaiting_confirmation", module: "fees" });
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d

  const result = shouldContinueModuleWorkflow(state, "yes", {
    capability: "fee_collection",
    suggestedTool: "findStudentFeeRecord",
  });

  assert.equal(result, true);
});

test("shouldContinueModuleWorkflow returns true for cancel in awaiting_confirmation", () => {
<<<<<<< HEAD
  const state = {
    currentStage: "awaiting_confirmation",
    module: "fees",
    matchedEntities: [],
    collectedSlots: {},
    missingSlots: [],
  };
=======
  const state = workflowState({ currentStage: "awaiting_confirmation", module: "fees" });
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d

  const result = shouldContinueModuleWorkflow(state, "no", {
    capability: "fee_collection",
    suggestedTool: "findStudentFeeRecord",
  });

  assert.equal(result, true);
});

test("routeModuleWorkflow returns select_entity for selecting_entity stage", () => {
<<<<<<< HEAD
  const state = {
    currentStage: "selecting_entity",
    matchedEntities: [],
    collectedSlots: {},
    missingSlots: [],
  };
=======
  const state = workflowState({ currentStage: "selecting_entity" });
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d

  const result = routeModuleWorkflow("1", state);

  assert.deepEqual(result, { action: "select_entity", input: "1" });
});

test("routeModuleWorkflow returns execute_action for yes in awaiting_confirmation", () => {
<<<<<<< HEAD
  const state = {
    currentStage: "awaiting_confirmation",
    matchedEntities: [],
    collectedSlots: {},
    missingSlots: [],
  };
=======
  const state = workflowState({ currentStage: "awaiting_confirmation" });
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d

  const result = routeModuleWorkflow("yes", state);

  assert.deepEqual(result, { action: "execute_action" });
});

test("routeModuleWorkflow returns cancel_workflow for no in awaiting_confirmation", () => {
<<<<<<< HEAD
  const state = {
    currentStage: "awaiting_confirmation",
    matchedEntities: [],
    collectedSlots: {},
    missingSlots: [],
  };
=======
  const state = workflowState({ currentStage: "awaiting_confirmation" });
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d

  const result = routeModuleWorkflow("no", state);

  assert.deepEqual(result, { action: "cancel_workflow" });
});

test("routeModuleWorkflow returns hydrate_entity for hydrating_context stage", () => {
<<<<<<< HEAD
  const state = {
    currentStage: "hydrating_context",
    matchedEntities: [],
    collectedSlots: {},
    missingSlots: [],
  };
=======
  const state = workflowState({ currentStage: "hydrating_context" });
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d

  const result = routeModuleWorkflow("continue", state);

  assert.deepEqual(result, { action: "hydrate_entity" });
});

test("resolveWorkflowSelection matches ordinal 1", () => {
  const entities = [
    { id: "1", label: "Rajesh" },
    { id: "2", label: "Amit" },
    { id: "3", label: "Priya" },
  ];

  const result = resolveWorkflowSelection("1", entities);

  assert.deepEqual(result, entities[0]);
});

test("resolveWorkflowSelection matches ordinal first", () => {
  const entities = [
    { id: "1", label: "Rajesh" },
    { id: "2", label: "Amit" },
    { id: "3", label: "Priya" },
  ];

  const result = resolveWorkflowSelection("first", entities);

  assert.deepEqual(result, entities[0]);
});

test("resolveWorkflowSelection matches by name", () => {
  const entities = [
    { id: "1", label: "Rajesh" },
    { id: "2", label: "Amit" },
    { id: "3", label: "Priya" },
  ];

  const result = resolveWorkflowSelection("Amit", entities);

  assert.deepEqual(result, entities[1]);
});

test("getModuleWorkflowConfig returns correct config for admissions", () => {
  const config = getModuleWorkflowConfig("admissions");

  assert.equal(config.module, "admissions");
  assert.equal(config.workflowId, "admission_confirmation");
  assert.equal(config.navigationRoute, "/admissions/confirmation");
  assert.equal(config.navigationLabel, "Continue to Admission Confirmation");
});

test("getModuleWorkflowConfig returns correct config for fees", () => {
  const config = getModuleWorkflowConfig("fees");

  assert.equal(config.module, "fees");
  assert.equal(config.workflowId, "fee_collection");
  assert.equal(config.navigationRoute, "/fees/collect");
  assert.equal(config.navigationLabel, "Continue to Fee Collection");
});

test("getModuleWorkflowConfig returns default for unknown module", () => {
  const config = getModuleWorkflowConfig("unknown_module");

  assert.equal(config.module, "general");
  assert.equal(config.workflowId, "general_lookup");
});

test("looksLikeDifferentModuleRequest returns false for same module", () => {
  const result = looksLikeDifferentModuleRequest("pending fees", "fees");

  assert.equal(result, false);
});

test("looksLikeDifferentModuleRequest returns true for different module", () => {
  const result = looksLikeDifferentModuleRequest("Show pending admissions", "fees");

  assert.equal(result, true);
});

test("getWorkflowConfigByWorkflowId returns correct config", () => {
  const config = getWorkflowConfigByWorkflowId("fee_collection");

  assert.equal(config.module, "fees");
  assert.equal(config.navigationRoute, "/fees/collect");
});

test("getWorkflowConfigByWorkflowId returns default for unknown workflow", () => {
  const config = getWorkflowConfigByWorkflowId("unknown_workflow");

  assert.equal(config.module, "general");
});
