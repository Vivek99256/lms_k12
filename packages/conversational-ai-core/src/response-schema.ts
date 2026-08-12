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
  messages: z.array(z.string()).optional(),
});

export type ConversationalResponse = z.infer<
  typeof conversationalResponseSchema
>;
