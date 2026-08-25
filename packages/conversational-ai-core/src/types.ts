import type { ToolSet } from "ai";
import type { z } from "zod";
import type { ConversationPlan } from "./planner";
import type {
  ConversationIntent,
  ConversationMessage,
  ConversationRequest,
  PageContextSnapshot,
  TrustedSessionContext,
} from "./schemas";

export interface ProjectContext {
  projectId: string;
  projectName: string;
  conversationId?: string;
  userId?: string;
  subInstituteId?: string;
  role?: string;
  profileName?: string;
  profileId?: string;
  clientId?: string;
  employeeNo?: string;
  orgId?: string;
  token?: string;
  baseUrl?: string;
  syear?: string;
  termId?: string;
  route?: string;
  /** The record the current page is about, when the workspace resolved one. */
  entityType?: string;
  entityId?: string | number;
  entityLabel?: string;
  /** The module the route resolved to, when the workspace mapped one. */
  module?: string;
  moduleLabel?: string;
  /** Filters, search, KPI tiles and visible rows, as reported by the page itself. */
  page?: PageContextSnapshot;
  cookieHeader?: string;
  referer?: string;
  request: ConversationRequest;
  latestUserMessage: ConversationMessage;
  messageHistory: ConversationMessage[];
  detectedLanguage: "english" | "hindi" | "gujarati";
}

export interface ProjectToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  requiredPermissions: string[];
  riskLevel: "low" | "medium" | "high";
  requiresConfirmation: boolean;
  /**
   * What the user is being asked to agree to, in their words.
   *
   * A confirmation prompt is the last thing standing between a model's decision and
   * a real record, so it has to say what will actually happen — not a title derived
   * from the function name. Receives the arguments the model proposed, so the
   * prompt can name the record rather than describing the action in the abstract.
   *
   * Falls back to a generated sentence when omitted, which is legible but blunt.
   */
  confirmationMessage?: (input: any) => string;
  capabilities: string[];
  execute: (input: any, context: ProjectContext) => Promise<unknown>;
}

export interface ProjectAIAdapter {
  projectId: string;
  projectName: string;
  resolveContext(input: {
    request: ConversationRequest;
    trustedContext: TrustedSessionContext;
  }): Promise<ProjectContext>;
  classifyIntent(context: ProjectContext): Promise<ConversationIntent>;
  buildSystemPrompt(
    context: ProjectContext,
    intent: ConversationIntent
  ): Promise<string>;
  getToolDefinitions(context: ProjectContext): Promise<ProjectToolDefinition[]>;
  getAllowedToolNames(context: ProjectContext): Promise<string[]>;
  validatePermission(
    intent: ConversationIntent,
    context: ProjectContext
  ): Promise<void>;
  /**
   * Optional override for the planning stage. Projects that need domain-specific
   * decomposition can supply their own; omitting it uses the shared planner.
   */
  buildPlan?(input: {
    context: ProjectContext;
    intent: ConversationIntent;
    allowedTools: string[];
    toolDefinitions: ProjectToolDefinition[];
  }): Promise<ConversationPlan | null>;
}

export interface PreparedConversation {
  adapter: ProjectAIAdapter;
  context: ProjectContext;
  intent: ConversationIntent;
  /** Null when planning was skipped, refused, or produced an invalid plan. */
  plan: ConversationPlan | null;
  systemPrompt: string;
  activeTools: string[];
  tools: ToolSet;
  toolDefinitions: ProjectToolDefinition[];
}
