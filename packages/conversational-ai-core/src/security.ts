import type { ConversationIntent } from "./schemas";
import type { ProjectContext, ProjectToolDefinition } from "./types";

export interface SecurityGuardResult {
  allowed: boolean;
  reason?: string;
  sanitizedMessage?: string;
}

export interface PromptSecurityGuard {
  inspectMessage(input: {
    message: string;
    context: ProjectContext;
    intent: ConversationIntent;
  }): Promise<SecurityGuardResult>;
}

export interface ToolExecutionGuard {
  authorize(input: {
    tool: ProjectToolDefinition;
    context: ProjectContext;
    intent: ConversationIntent;
  }): Promise<SecurityGuardResult>;
}

/**
 * Thrown when a request falls outside the caller's profile rights.
 *
 * A distinct type because a refusal is not a failure: the assistant worked correctly
 * and declined. Transports should map this to 403 and surfaces should render it as a
 * normal reply, not a red error — a user reading "you don't have access to this" has
 * been served, not crashed at.
 */
export class ConversationPermissionError extends Error {
  readonly requiredPermission?: string;

  readonly role?: string;

  constructor(message: string, options?: { requiredPermission?: string; role?: string }) {
    super(message);
    this.name = "ConversationPermissionError";
    this.requiredPermission = options?.requiredPermission;
    this.role = options?.role;

    // Preserves `instanceof` when the class is transpiled down.
    Object.setPrototypeOf(this, ConversationPermissionError.prototype);
  }
}

/** Type guard that survives bundling boundaries where `instanceof` can be brittle. */
export function isConversationPermissionError(
  error: unknown
): error is ConversationPermissionError {
  return (
    error instanceof ConversationPermissionError ||
    (error instanceof Error && error.name === "ConversationPermissionError")
  );
}
