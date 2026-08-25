import { describeRecord } from "./module-records";
import type { ConversationalResponse } from "./response-schema";
import type { PreparedConversation } from "./types";
import type { ConversationWorkflowState, WorkflowEntitySummary } from "./workflow-state";

export function buildModuleNavigationResponse(
  prepared: PreparedConversation,
  workflowState: ConversationWorkflowState,
  route: string,
  label: string,
  query: Record<string, string | number>,
  selectedEntity: WorkflowEntitySummary,
  summary: string
): ConversationalResponse {
  const entityRecord = selectedEntity.metadata as Record<string, unknown> | null;
  const fullName =
    (typeof selectedEntity.label === "string" && selectedEntity.label) ||
    (typeof entityRecord?.studentName === "string" && entityRecord.studentName) ||
    (typeof entityRecord?.fullName === "string" && entityRecord.fullName) ||
    "the selected record";

  const describedLines = describeRecord(entityRecord);
  const details = (
    describedLines.length > 0
      ? describedLines
      : [
          typeof selectedEntity.reference === "string" && selectedEntity.reference
            ? `Reference: ${selectedEntity.reference}`
            : "",
          typeof selectedEntity.secondary === "string" && selectedEntity.secondary
            ? `Standard: ${selectedEntity.secondary}`
            : "",
        ].filter(Boolean)
  ).join("\n");

  const lines = [
    summary || `I found ${fullName}'s record.`,
    details ? `\n${details}\n` : "",
    `Click "${label}" to open the ${workflowState.module} module with this record loaded and continue the process.`,
  ];

  return {
    message: lines.filter((line) => line !== null && line !== "").join("\n"),
    conversationType: prepared.intent.type,
    status: "navigation_required",
    navigation: {
      route,
      query,
      label,
    },
    data: {
      selectedEntity,
      module: workflowState.module,
      // The structured backend record, so the destination page (and any future
      // client) receives exactly what the tools resolved.
      record: entityRecord || undefined,
    },
    toolExecutions: [
      {
        tool: `${workflowState.module}Navigation`,
        status: "completed",
        summary: `Prepared ${workflowState.module} navigation handoff.`,
      },
    ],
    followUpSuggestions: [
      `Open the ${workflowState.module} module.`,
      "Review the pre-filled details before submitting.",
    ],
    intent: prepared.intent,
    activeTools: prepared.activeTools,
  };
}

export function buildModuleSelectionResponse(
  prepared: PreparedConversation,
  toolName: string,
  entities: Array<Record<string, unknown>>,
  module: string | undefined,
  leadMessage?: string
): ConversationalResponse {
  const moduleLabel = module ? module.charAt(0).toUpperCase() + module.slice(1) : "module";
  const options = entities
    .slice(0, 5)
    .map((entity, index) => {
      const name =
        (typeof entity.label === "string" && entity.label) ||
        (typeof entity.studentName === "string" && entity.studentName) ||
        (typeof entity.fullName === "string" && entity.fullName) ||
        `Record ${index + 1}`;
      const standard =
        (typeof entity.secondary === "string" && entity.secondary) ||
        (typeof entity.standard === "string" && entity.standard) ||
        "";
      const reference =
        (typeof entity.reference === "string" && entity.reference) ||
        (typeof entity.enquiryNo === "string" && entity.enquiryNo) ||
        "";
      return `${index + 1}. ${name}${standard ? `, ${standard}` : ""}${reference ? `, ${reference}` : ""}`;
    });

  const heading =
    leadMessage || `Which ${moduleLabel} record would you like to continue with?`;

  /*
   * The chips are the records themselves, not advice about how to pick one.
   *
   * A chip's label is sent verbatim as the next user message, and `resolveEntitySelection`
   * matches on the record name — so offering the names makes one click a working
   * selection. Offering "Reply with the numbered option if shown." sent that sentence as
   * the question instead, matched nothing, and looped the user back to this same prompt.
   */
  const selectionChips = entities
    .slice(0, 4)
    .map(
      (entity, index) =>
        (typeof entity.label === "string" && entity.label) ||
        (typeof entity.studentName === "string" && entity.studentName) ||
        (typeof entity.fullName === "string" && entity.fullName) ||
        `${index + 1}`
    )
    .filter((chip) => chip.trim().length > 0);

  return {
    message: `${heading}\n${options.join("\n")}\nYou can reply with the name, reference number, or the numbered option.`,
    conversationType: prepared.intent.type,
    status: "requires_input",
    toolExecutions: [
      {
        tool: toolName,
        status: "planned",
        summary: `Waiting for the user to choose one of the ${moduleLabel} records.`,
      },
    ],
    followUpSuggestions: selectionChips,
    intent: prepared.intent,
    activeTools: prepared.activeTools,
  };
}

export function buildModuleNeedsInputResponse(
  prepared: PreparedConversation,
  toolName: string,
  module: string | undefined,
  reason: string
): ConversationalResponse {
  const moduleLabel = module ? module.charAt(0).toUpperCase() + module.slice(1) : "module";

  return {
    message: `I can continue with the ${moduleLabel} workflow. ${reason}`,
    conversationType: prepared.intent.type,
    status: "requires_input",
    toolExecutions: [
      {
        tool: toolName,
        status: "planned",
        summary: `Waiting for more details before continuing the ${moduleLabel} workflow.`,
      },
    ],
    followUpSuggestions: [
      "Share the record name or identifier.",
      "Add any available filters like Standard, Division, or ID.",
    ],
    intent: prepared.intent,
    activeTools: prepared.activeTools,
  };
}
