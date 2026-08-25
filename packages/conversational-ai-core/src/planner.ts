import { generateObject } from "ai";
import { z } from "zod";

import { createAiModel } from "./model";
import type { ConversationIntent } from "./schemas";
import type { ProjectContext, ProjectToolDefinition } from "./types";

/**
 * Planning — deciding *which* facts a question needs before any of them are fetched.
 *
 * Without this stage a question is answered by whichever single tool the classifier
 * matched, which is fine for a lookup and wrong for anything comparative. "Which
 * department needs the most training?" needs the department list, then a training
 * metric per department, then a comparison; given one tool it becomes one lookup,
 * and the only number a lookup returns is headcount. That is exactly how a staffing
 * figure came to be presented as a capability judgement.
 *
 * Two properties make the plan trustworthy rather than just another model output:
 *
 *  - Every step is validated against the tools this caller is actually allowed to
 *    use, before anything executes. A plan naming a tool the user cannot reach is
 *    rejected outright rather than half-run.
 *
 *  - A plan may declare `refuseIf`. That is how a question the data cannot answer
 *    ends in an honest refusal instead of a proxy. The institute holds no training
 *    or competency records, so the correct answer to the department question is to
 *    say so — and the plan is where that gets decided, not the wording step.
 *
 * Failure is never fatal: an invalid or unavailable plan falls back to offering the
 * full allowed tool set, which is the behaviour that existed before this stage.
 */

export const MAX_PLAN_STEPS = 6;

export const planStepSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(40)
    .describe("Short identifier for this step, e.g. 'departments'."),
  tool: z.string().min(1).describe("The exact tool name to call."),
  purpose: z
    .string()
    .min(1)
    .max(200)
    .describe("What this step is for, in one plain sentence."),
  dependsOn: z
    .array(z.string())
    .default([])
    .describe("Ids of earlier steps whose results this one needs."),
});

export const conversationPlanSchema = z.object({
  goal: z
    .string()
    .min(1)
    .max(300)
    .describe("What a complete answer to the user's question requires."),
  // `.min(1)` states the constraint to the model rather than only to the validator.
  // Without it an empty `steps` array satisfies the schema, so the model returns one
  // for questions it thinks need no tools — and the plan is then thrown away at
  // validation, silently costing a call and leaving the turn unplanned.
  steps: z.array(planStepSchema).min(1).max(MAX_PLAN_STEPS),
  comparison: z
    .object({
      metric: z.string().min(1).describe("The quantity being compared or ranked."),
      across: z.string().min(1).describe("The set being compared, e.g. 'departments'."),
    })
    .optional()
    .describe("Set only when the question ranks or compares."),
  refuseIf: z
    .array(
      z.object({
        whenUnavailable: z
          .string()
          .min(1)
          .describe("The data that must exist for an answer to be possible."),
        reason: z
          .string()
          .min(1)
          .max(300)
          .describe("What to tell the user when it does not."),
      })
    )
    .default([])
    .describe(
      "Conditions under which the honest answer is a refusal. Set this whenever the question asks about a quality the system may not record."
    ),
});

export type ConversationPlan = z.infer<typeof conversationPlanSchema>;
export type ConversationPlanStep = z.infer<typeof planStepSchema>;

export interface PlanValidationResult {
  valid: boolean;
  plan: ConversationPlan | null;
  errors: string[];
}

/**
 * Rejects a plan that could not be executed as written.
 *
 * Runs before any tool call, so an unusable plan costs one model call rather than a
 * sequence of half-completed backend requests.
 */
export function validatePlan(
  plan: ConversationPlan,
  allowedTools: string[]
): PlanValidationResult {
  const errors: string[] = [];
  const allowed = new Set(allowedTools);
  const seen = new Set<string>();

  if (plan.steps.length === 0) {
    errors.push("A plan must contain at least one step.");
  }

  if (plan.steps.length > MAX_PLAN_STEPS) {
    errors.push(`A plan may contain at most ${MAX_PLAN_STEPS} steps.`);
  }

  for (const step of plan.steps) {
    if (!allowed.has(step.tool)) {
      errors.push(`Step "${step.id}" names "${step.tool}", which is not available.`);
    }

    if (seen.has(step.id)) {
      errors.push(`Step id "${step.id}" is used more than once.`);
    }

    // Only backwards references are legal, which makes a cycle unrepresentable and
    // lets the steps execute in the order they are written.
    for (const dependency of step.dependsOn) {
      if (!seen.has(dependency)) {
        errors.push(
          `Step "${step.id}" depends on "${dependency}", which does not appear before it.`
        );
      }
    }

    seen.add(step.id);
  }

  return { valid: errors.length === 0, plan: errors.length === 0 ? plan : null, errors };
}

/** The distinct tools a plan needs, in first-use order. */
export function toolsFromPlan(
  plan: ConversationPlan | null,
  allowedTools: string[]
): string[] {
  if (!plan) {
    return allowedTools;
  }

  const allowed = new Set(allowedTools);
  const tools = plan.steps.map((step) => step.tool).filter((tool) => allowed.has(tool));

  // An empty result would leave the model with nothing to call at all, which is
  // worse than being over-broad.
  return tools.length > 0 ? [...new Set(tools)] : allowedTools;
}

/**
 * Reports whether a tool result withheld something the plan said was required.
 *
 * Tools declare gaps in two shapes already used across this codebase:
 * `available: false` for a whole dataset, and `unavailableSignals` for a named
 * quality the module simply does not record.
 */
export function findBlockingGap(
  plan: ConversationPlan | null,
  toolResults: unknown[]
): { reason: string; missing: string[] } | null {
  if (!plan || plan.refuseIf.length === 0) {
    return null;
  }

  const missing = new Set<string>();

  for (const result of toolResults) {
    const record = result as
      | { unavailableSignals?: unknown; available?: unknown }
      | null
      | undefined;

    if (!record || typeof record !== "object") {
      continue;
    }

    if (Array.isArray(record.unavailableSignals)) {
      for (const signal of record.unavailableSignals) {
        if (typeof signal === "string") {
          missing.add(signal.toLowerCase());
        }
      }
    }
  }

  if (missing.size === 0) {
    return null;
  }

  for (const rule of plan.refuseIf) {
    const needle = rule.whenUnavailable.toLowerCase();
    const hit = [...missing].some(
      (signal) => signal.includes(needle) || needle.includes(signal)
    );

    if (hit) {
      return { reason: rule.reason, missing: [...missing] };
    }
  }

  return null;
}

/**
 * How many reason/tool cycles the answering model may take.
 *
 * A plan of N steps needs N tool calls plus room to compose the answer and to
 * recover from one step returning nothing. The previous fixed budget of 6 was
 * generous for a single lookup and too tight for a multi-step comparison.
 */
export function stepBudgetFor(plan: ConversationPlan | null): number {
  const planned = plan?.steps.length ?? 0;
  return Math.min(12, Math.max(6, planned + 2));
}

/**
 * Turns what the tools actually returned into per-turn provenance.
 *
 * Reports the tools that really ran, not the ones that were merely offered — a
 * distinction the previous summary lost by listing every active tool as
 * "completed".
 */
export function buildCitations(
  entries: Array<{ toolName?: string; output?: unknown }>
): Array<{
  tool: string;
  module?: string;
  available: boolean;
  unavailableSignals?: string[];
}> {
  const citations = new Map<
    string,
    { tool: string; module?: string; available: boolean; unavailableSignals?: string[] }
  >();

  for (const entry of entries) {
    const tool = entry.toolName;

    if (!tool || citations.has(tool)) {
      continue;
    }

    const raw = entry.output as Record<string, unknown> | undefined;
    const payload =
      raw && typeof raw === "object" && "data" in raw
        ? (raw.data as Record<string, unknown> | undefined)
        : raw;

    const unavailableSignals = Array.isArray(payload?.unavailableSignals)
      ? payload.unavailableSignals.filter(
          (signal): signal is string => typeof signal === "string"
        )
      : undefined;

    citations.set(tool, {
      tool,
      module: typeof payload?.module === "string" ? payload.module : undefined,
      // Absent `available` means the tool returned data without the flag.
      available: payload?.available !== false,
      unavailableSignals:
        unavailableSignals && unavailableSignals.length > 0 ? unavailableSignals : undefined,
    });
  }

  return [...citations.values()];
}

/**
 * Refusal for the deterministic path, where there is no plan and no model.
 *
 * `findBlockingGap` needs a plan's `refuseIf` rules. A single-tool lookup has
 * neither, so the question itself is matched against whatever the tool said it does
 * not hold. Without this, "which department needs the most training?" resolves to a
 * department lookup, and the answer is narrated from the one number present —
 * headcount — while the tool's own `unavailableSignals` saying training is not
 * recorded goes unread. That is the original defect, reached by a different route.
 *
 * Matching is on the significant words of each declared gap, so "training records
 * and completion" is triggered by a question mentioning "training".
 */
export function questionBlockedByGap(
  question: string,
  result: unknown
): { reason: string; missing: string[] } | null {
  const record = result as { unavailableSignals?: unknown } | null | undefined;

  if (!record || typeof record !== "object" || !Array.isArray(record.unavailableSignals)) {
    return null;
  }

  const asked = question.toLowerCase();
  const stopWords = new Set(["and", "or", "the", "of", "records", "completion", "ratings"]);
  const hits: string[] = [];

  for (const signal of record.unavailableSignals) {
    if (typeof signal !== "string") {
      continue;
    }

    const terms = signal
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((term) => term.length > 3 && !stopWords.has(term));

    if (terms.some((term) => asked.includes(term))) {
      hits.push(signal);
    }
  }

  if (hits.length === 0) {
    return null;
  }

  return {
    reason:
      `I can't answer that — this system does not record ${hits.join(", ")}. ` +
      `I can tell you what it does hold, but none of it answers the question you asked.`,
    missing: hits,
  };
}

/** Renders the plan into the instructions the answering model follows. */
export function describePlan(plan: ConversationPlan | null): string | null {
  if (!plan || plan.steps.length === 0) {
    return null;
  }

  const lines = [
    "PLAN FOR THIS QUESTION — follow it before answering:",
    `Goal: ${plan.goal}`,
    ...plan.steps.map(
      (step, index) =>
        `${index + 1}. Call ${step.tool} — ${step.purpose}${
          step.dependsOn.length > 0 ? ` (uses: ${step.dependsOn.join(", ")})` : ""
        }`
    ),
  ];

  if (plan.comparison) {
    lines.push(
      `Then compare ${plan.comparison.metric} across ${plan.comparison.across} and state what the ranking rests on.`
    );
  }

  for (const rule of plan.refuseIf) {
    lines.push(
      `If "${rule.whenUnavailable}" is not present in the results, do not answer the question. Say: ${rule.reason}`
    );
  }

  lines.push(
    "Run every step before answering. If a step returns no data, say which step and why rather than substituting another figure."
  );

  return lines.join("\n");
}

/**
 * Builds a plan for the question. Returns null when planning is unnecessary or
 * unavailable, in which case the caller keeps its existing behaviour.
 */
export async function buildPlan(input: {
  context: ProjectContext;
  intent: ConversationIntent;
  allowedTools: string[];
  toolDefinitions: ProjectToolDefinition[];
}): Promise<ConversationPlan | null> {
  const { context, intent, allowedTools, toolDefinitions } = input;

  if (allowedTools.length === 0) {
    return null;
  }

  const catalogue = toolDefinitions
    .filter((definition) => allowedTools.includes(definition.name))
    .map((definition) => `- ${definition.name}: ${definition.description}`)
    .join("\n");

  if (!catalogue) {
    return null;
  }

  try {
    const { object } = await generateObject({
      model: createAiModel(),
      schema: conversationPlanSchema,
      prompt: `Plan how to answer the user's question using only the tools listed.

Question: ${context.latestUserMessage.content}
Understood as: ${intent.capability}${
        intent.suggestedTool ? ` (a likely starting tool is ${intent.suggestedTool})` : ""
      }
Current module: ${context.moduleLabel || context.module || "unknown"}${
        context.entityType && context.entityId
          ? `\nThe page is about ${context.entityType} ${context.entityId}${
              context.entityLabel ? ` (${context.entityLabel})` : ""
            }, so a step about "this ${context.entityType}" should use that identifier.`
          : ""
      }

Available tools:
${catalogue}

Rules:
- Use only tool names from the list above, spelled exactly.
- Always produce at least one step. If the question needs no data, plan the single
  tool that comes closest and say so in the purpose.
- A simple lookup is a one-step plan. Do not invent extra steps.
- A question that ranks or compares needs a step that loads the set, a step that
  loads the quantity being ranked, and a comparison.
- Set refuseIf whenever the question asks about a quality the tools might not
  record — training need, competency, skill gaps, workload, appraisal, morale.
  Name the data that would be required in whenUnavailable.
- Never plan to answer a question about one quantity using a different one. Ranking
  by headcount does not answer a question about training need.
- At most ${MAX_PLAN_STEPS} steps.`,
    });

    const validation = validatePlan(object, allowedTools);

    if (!validation.valid) {
      console.warn("[planner] discarding invalid plan", validation.errors);
      return null;
    }

    return validation.plan;
  } catch (error) {
    console.warn("[planner] planning failed, falling back to full tool set", error);
    return null;
  }
}
