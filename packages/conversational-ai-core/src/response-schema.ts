import { z } from "zod";
import {
  conversationIntentSchema,
  conversationTypeSchema,
} from "./schemas";

export const conversationalStatusSchema = z.enum([
  "completed",
  "in_progress",
  "requires_input",
  "requires_confirmation",
  "navigation_required",
  "failed",
]);

export const toolExecutionSummarySchema = z.object({
  tool: z.string(),
  status: z.enum(["planned", "completed", "failed", "skipped"]),
  summary: z.string(),
});

export const confirmationPayloadSchema = z.object({
  action: z.string(),
  riskLevel: z.enum(["low", "medium", "high"]),
  message: z.string(),
  parameters: z.record(z.string(), z.unknown()).default({}),
});

export const navigationActionSchema = z.object({
  route: z.string(),
  query: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  label: z.string(),
});

/**
 * Where a figure in the answer actually came from.
 *
 * Chat tool results were previously discarded once the reply was worded, so an
 * answer arrived with no way to see what it rested on — the agent path records
 * provenance in `ai_evidence`, and the conversational path recorded nothing. This
 * is the conversational equivalent: per turn, not persisted, and deliberately not
 * written into the agent's evidence store, which has its own governance rules.
 */
export const citationSchema = z.object({
  tool: z.string(),
  module: z.string().optional(),
  /** False when the tool reported it could not supply the data. */
  available: z.boolean(),
  /** Named datasets or qualities the tool said it does not hold. */
  unavailableSignals: z.array(z.string()).optional(),
});

export const conversationalResponseSchema = z.object({
  message: z.string(),
  conversationType: conversationTypeSchema,
  status: conversationalStatusSchema,
  data: z.unknown().optional(),
  navigation: navigationActionSchema.optional(),
  toolExecutions: z.array(toolExecutionSummarySchema).optional(),
  confirmation: confirmationPayloadSchema.optional(),
  followUpSuggestions: z.array(z.string()).optional(),
  intent: conversationIntentSchema.optional(),
  activeTools: z.array(z.string()).optional(),
  citations: z.array(citationSchema).optional(),
  messages: z.array(z.string()).optional(),
});

export type ConversationalResponse = z.infer<
  typeof conversationalResponseSchema
>;
