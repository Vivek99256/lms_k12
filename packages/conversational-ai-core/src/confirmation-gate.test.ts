import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

import { createProjectTools, isPendingConfirmation } from "./tools";
import type { ProjectContext, ProjectToolDefinition } from "./types";

let executions = 0;

function definition(
  overrides: Partial<ProjectToolDefinition> = {}
): ProjectToolDefinition {
  return {
    name: "approveRecommendationAction",
    description: "Approve a recommendation.",
    inputSchema: z.object({ recommendationId: z.number() }),
    requiredPermissions: [],
    riskLevel: "high",
    requiresConfirmation: true,
    capabilities: [],
    execute: async () => {
      executions += 1;
      return { approved: true };
    },
    ...overrides,
  };
}

function contextWith(confirmedTools?: string[]) {
  return {
    projectId: "lms_k12",
    userId: "7013",
    request: { messages: [], context: confirmedTools ? { confirmedTools } : {} },
  } as unknown as ProjectContext;
}

/** Calls the tool the way the AI SDK would. */
async function invoke(tools: Record<string, any>, name: string) {
  return tools[name].execute({ recommendationId: 4 }, {});
}

test.beforeEach(() => {
  executions = 0;
});

test("a consequential tool does not execute without confirmation", async () => {
  // The safety property. `requiresConfirmation` was declared on this tool from the
  // start and read by nothing, so approving — which records a decision in a named
  // user's account and starts a workflow — could happen with no human involved.
  const tools = createProjectTools([definition()], contextWith());
  const result = await invoke(tools, "approveRecommendationAction");

  assert.equal(executions, 0, "the tool must not have run");
  assert.ok(isPendingConfirmation(result));
});

test("the confirmation request names the action and its risk", async () => {
  const tools = createProjectTools([definition()], contextWith());
  const result: any = await invoke(tools, "approveRecommendationAction");

  assert.equal(result.tool, "approveRecommendationAction");
  assert.equal(result.riskLevel, "high");
  assert.deepEqual(result.parameters, { recommendationId: 4 });
  assert.ok(result.message.length > 0);
});

test("it executes once the user has confirmed that specific tool", async () => {
  const tools = createProjectTools(
    [definition()],
    contextWith(["approveRecommendationAction"])
  );
  const result: any = await invoke(tools, "approveRecommendationAction");

  assert.equal(executions, 1);
  assert.equal(isPendingConfirmation(result), false);
  assert.deepEqual(result.data, { approved: true });
});

test("confirming one tool does not confirm another", async () => {
  // Confirmation is per tool, so agreeing to one action cannot be reused to run a
  // different one in the same turn.
  const tools = createProjectTools(
    [definition({ name: "resolveWorkflowApproval" }), definition()],
    contextWith(["resolveWorkflowApproval"])
  );

  const gated = await invoke(tools, "approveRecommendationAction");
  assert.ok(isPendingConfirmation(gated));
  assert.equal(executions, 0);

  const allowed = await invoke(tools, "resolveWorkflowApproval");
  assert.equal(isPendingConfirmation(allowed), false);
  assert.equal(executions, 1);
});

test("ordinary tools are unaffected", async () => {
  const tools = createProjectTools(
    [definition({ name: "getStudentDirectory", requiresConfirmation: false, riskLevel: "low" })],
    contextWith()
  );

  const result: any = await invoke(tools, "getStudentDirectory");

  assert.equal(executions, 1);
  assert.equal(isPendingConfirmation(result), false);
});

test("the tool's own wording is used when it supplies one", async () => {
  const tools = createProjectTools(
    [
      definition({
        confirmationMessage: (input) =>
          `Approve recommendation #${input.recommendationId}? The decision will be recorded in your name.`,
      }),
    ],
    contextWith()
  );

  const result: any = await invoke(tools, "approveRecommendationAction");

  assert.equal(
    result.message,
    "Approve recommendation #4? The decision will be recorded in your name."
  );
});

test("a message that throws falls back to the generic wording, still gated", async () => {
  // The gate must not depend on the prompt succeeding. A broken message is a
  // cosmetic failure; letting the action through would not be.
  const tools = createProjectTools(
    [
      definition({
        confirmationMessage: () => {
          throw new Error("bad template");
        },
      }),
    ],
    contextWith()
  );

  const result: any = await invoke(tools, "approveRecommendationAction");

  assert.equal(executions, 0, "the action must still be blocked");
  assert.ok(isPendingConfirmation(result));
  assert.match(result.message, /needs your confirmation/);
});

test("an empty message falls back rather than showing a blank prompt", async () => {
  const tools = createProjectTools(
    [definition({ confirmationMessage: () => "   " })],
    contextWith()
  );

  const result: any = await invoke(tools, "approveRecommendationAction");

  assert.match(result.message, /needs your confirmation/);
});

test("isPendingConfirmation rejects ordinary payloads", () => {
  assert.equal(isPendingConfirmation(null), false);
  assert.equal(isPendingConfirmation({ data: { approved: true } }), false);
  assert.equal(isPendingConfirmation("approved"), false);
});
