import test from "node:test";
import assert from "node:assert/strict";
import { shouldContinueAdmissionWorkflow } from "./admission-workflow-routing";

test("fee requests do not continue the admission workflow", () => {
  const state = {
    stage: "awaiting_confirmation",
  };

  const result = shouldContinueAdmissionWorkflow(state, "How many students have pending fees?", {
    capability: "module_action",
    suggestedTool: "executeModuleAction",
  });

  assert.equal(result, false);
});

test("admission follow-up messages continue the admission workflow", () => {
  const state = {
    stage: "awaiting_confirmation",
  };

  const result = shouldContinueAdmissionWorkflow(state, "yes", {
    capability: "admission_confirmation",
    suggestedTool: "findAdmissionCandidate",
  });

  assert.equal(result, true);
});
