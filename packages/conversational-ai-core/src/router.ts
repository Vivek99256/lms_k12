import type { DiscoveredTool, ProjectDiscoverySnapshot } from "./discovery";
import type { ProjectContext } from "./types";
import type { ConversationIntent } from "./schemas";

export interface RoutingCandidate {
  type: "general_knowledge" | "tool" | "workflow" | "knowledge_base";
  score: number;
  reason: string;
  toolName?: string;
}

export interface RoutingDecision {
  intent: ConversationIntent;
  selected: RoutingCandidate;
  alternatives: RoutingCandidate[];
}

function normalizeText(value: string) {
  return value.toLowerCase().trim();
}

function scoreTool(
  tool: DiscoveredTool,
  intent: ConversationIntent,
  message: string
) {
  const normalizedMessage = normalizeText(message);
  let score = 0;

  for (const capability of tool.capabilities) {
    if (normalizeText(capability) === normalizeText(intent.capability)) {
      score += 5;
    }
  }

  if (normalizedMessage.includes(normalizeText(tool.name))) {
    score += 3;
  }

  if (normalizedMessage.includes(normalizeText(tool.description))) {
    score += 2;
  }

  return score;
}

export function createRoutingDecision(input: {
  context: ProjectContext;
  intent: ConversationIntent;
  snapshot?: ProjectDiscoverySnapshot;
}): RoutingDecision {
  const { context, intent, snapshot } = input;
  const latestMessage = context.latestUserMessage.content;

  const defaultCandidate: RoutingCandidate = {
    type: "general_knowledge",
    score: 0,
    reason: "No project-specific operation was selected.",
  };

  if (!snapshot || snapshot.tools.length === 0) {
    return {
      intent,
      selected: defaultCandidate,
      alternatives: [],
    };
  }

  const alternatives = snapshot.tools
    .map((tool) => ({
      type: "tool" as const,
      score: scoreTool(tool, intent, latestMessage),
      reason: `Matched against discovered tool ${tool.name}.`,
      toolName: tool.name,
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score);

  return {
    intent,
    selected: alternatives[0] || defaultCandidate,
    alternatives,
  };
}
