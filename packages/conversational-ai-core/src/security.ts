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
