import { tool, type ToolSet } from "ai";
import type { ProjectContext, ProjectToolDefinition } from "./types";

/**
 * Marker returned in place of executing a consequential tool the user has not
 * confirmed. The conversation layer recognises it and turns the turn into a
 * confirmation request rather than an answer.
 */
export const CONFIRMATION_REQUIRED = "__requires_confirmation__";

export interface PendingConfirmation {
  [CONFIRMATION_REQUIRED]: true;
  tool: string;
  riskLevel: ProjectToolDefinition["riskLevel"];
  message: string;
  parameters: Record<string, unknown>;
}

export function isPendingConfirmation(value: unknown): value is PendingConfirmation {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as Record<string, unknown>)[CONFIRMATION_REQUIRED] === true
  );
}

function summarizeToolResult(result: unknown) {
  if (typeof result === "string") {
    return result;
  }

  return JSON.stringify(result);
}

/**
 * The sentence shown on the confirmation prompt.
 *
 * Prefers the tool's own wording. The fallback splits the camel-case name, which
 * produces "This will approve recommendation action" — understandable, but plainly
 * machine-written, so it is a backstop rather than the intended path.
 */
export function describeConfirmation(definition: ProjectToolDefinition, input: unknown): string {
  if (definition.confirmationMessage) {
    try {
      const message = definition.confirmationMessage(input).trim();

      if (message) {
        return message;
      }
    } catch {
      // A prompt that throws must not block the gate — fall through to the generic
      // wording rather than letting the action proceed unconfirmed.
    }
  }

  const readableName = definition.name.replace(/([A-Z])/g, " $1").toLowerCase().trim();

  return `This will ${readableName}. It is a real change and needs your confirmation.`;
}

/** Which tools the user has cleared for this turn. */
function confirmedTools(context: ProjectContext): Set<string> {
  return new Set(context.request.context?.confirmedTools || []);
}

export function createProjectTools(
  definitions: ProjectToolDefinition[],
  context: ProjectContext
): ToolSet {
  const confirmed = confirmedTools(context);

  const toolEntries = definitions.map((definition) => [
    definition.name,
    tool({
      description: definition.description,
      inputSchema: definition.inputSchema,
      execute: async (input: any) => {
        // The confirmation gate.
        //
        // `requiresConfirmation` was declared on the consequential tools from the
        // start and read by nothing: this factory executed every tool the moment the
        // model called it. That meant approving a recommendation — which records a
        // decision in a named user's account and starts a workflow — could happen
        // without any human ever confirming it, and the backend does not require a
        // confirmation token either. Refusing to execute here is what makes the
        // declaration mean something.
        if (definition.requiresConfirmation && !confirmed.has(definition.name)) {
          return {
            [CONFIRMATION_REQUIRED]: true,
            tool: definition.name,
            riskLevel: definition.riskLevel,
            message: describeConfirmation(definition, input),
            parameters: (input ?? {}) as Record<string, unknown>,
          } satisfies PendingConfirmation;
        }

        const result = await definition.execute(input, context);
        return typeof result === "string"
          ? result
          : {
              summary: summarizeToolResult(result),
              data: result,
            };
      },
    }),
  ]);

  return Object.fromEntries(toolEntries);
}
