import {
  deleteStoredJson,
  readStoredJson,
  writeStoredJson,
} from "./file-store";

export interface WorkflowEntitySummary {
  id: string;
  label: string;
  reference?: string;
  secondary?: string;
  metadata?: Record<string, unknown>;
}

export interface WorkflowSlotState {
  key: string;
  label: string;
  required: boolean;
  value?: unknown;
  options?: Array<{ value: string; label: string }>;
}

export interface ConversationWorkflowState {
  conversationId: string;
  projectId: string;
  module?: string;
  intent?: string;
  workflowId?: string;
  currentStage:
    | "idle"
    | "searching"
    | "selecting_entity"
    | "hydrating_context"
    | "collecting_slots"
    | "awaiting_confirmation"
    | "executing"
    | "completed"
    | "failed";
  matchedEntities: WorkflowEntitySummary[];
  selectedEntity?: WorkflowEntitySummary;
  /**
   * The structured backend record behind {@link selectedEntity}, stored with the
   * field names the module's own APIs use. Every follow-up tool call reads its
   * identifiers from here instead of re-parsing the user's message.
   */
  selectedRecord?: Record<string, unknown>;
  hydratedEntity?: Record<string, unknown>;
  lastTool?: string;
  collectedSlots: Record<string, unknown>;
  missingSlots: WorkflowSlotState[];
  pendingAction?: {
    tool: string;
    payload: Record<string, unknown>;
    confirmationRequired: boolean;
  };
  lastResult?: unknown;
}

function getWorkflowKey(projectId: string, userId: string, conversationId: string) {
  return `${projectId}:${userId}:${conversationId}`;
}

export function getConversationWorkflowState(
  projectId: string,
  userId: string,
  conversationId: string
) {
  return (
    readStoredJson<ConversationWorkflowState>(
      "workflow-state",
      getWorkflowKey(projectId, userId, conversationId)
    ) || null
  );
}

export function upsertConversationWorkflowState(
  projectId: string,
  userId: string,
  conversationId: string,
  patch: Partial<ConversationWorkflowState>
) {
  const key = getWorkflowKey(projectId, userId, conversationId);
  const current = readStoredJson<ConversationWorkflowState>("workflow-state", key);
  const next: ConversationWorkflowState = {
    conversationId,
    projectId,
    currentStage: "idle",
    matchedEntities: [],
    collectedSlots: {},
    missingSlots: [],
    ...current,
    ...patch,
  };
  writeStoredJson("workflow-state", key, next);
  return next;
}

export function clearConversationWorkflowState(
  projectId: string,
  userId: string,
  conversationId: string
) {
  deleteStoredJson(
    "workflow-state",
    getWorkflowKey(projectId, userId, conversationId)
  );
}
