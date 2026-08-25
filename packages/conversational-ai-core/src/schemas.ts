import { z } from "zod";

export const conversationTypeSchema = z.enum([
  "ask",
  "learn",
  "guide",
  "do",
  "analyse",
  "recommend",
  "automate",
  "monitor",
  "coach",
]);

export const conversationDomainSchema = z.enum([
  "k12",
  "people_competency",
  "enterprise_brain",
  "shared",
]);

export const conversationIntentSchema = z.object({
  type: conversationTypeSchema,
  domain: conversationDomainSchema,
  capability: z.string().min(1),
  entities: z.record(z.string(), z.unknown()).default({}),
  confidence: z.number().min(0).max(1),
  requiresConfirmation: z.boolean(),
  requiredPermission: z.string().optional(),
  suggestedTool: z.string().optional(),
});

export const conversationMessageSchema = z.object({
  id: z.string().optional(),
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1),
});

/**
 * What the page the user is looking at is currently showing.
 *
 * Filters, an active search, the KPI tiles, a window onto the visible rows. Without
 * this the assistant knows *where* the user is but not *what is on screen*, so
 * "summarise these" and "which of these need attention?" have no referent.
 *
 * Every collection is capped here as well as at the source: this is a summary that
 * lands in a prompt, and the retrieval tools remain the way to reach a full dataset.
 * Nothing in it is trusted for access — the backend re-derives scope from the session
 * and re-checks every read.
 */
export const pageFilterSchema = z.object({
  key: z.string(),
  label: z.string().optional(),
  value: z.string(),
});

export const pageMetricSchema = z.object({
  key: z.string(),
  label: z.string().optional(),
  value: z.string(),
  unit: z.string().nullish(),
  trend: z.string().nullish(),
});

export const pageRecordSchema = z
  .object({
    id: z.union([z.string(), z.number()]).nullish(),
    label: z.string().nullish(),
  })
  .catchall(z.union([z.string(), z.number(), z.boolean()]));

export const pageContextSchema = z.object({
  title: z.string().nullish(),
  type: z.enum(["dashboard", "list", "detail", "form", "report", "settings"]).nullish(),
  filters: z.array(pageFilterSchema).max(20).optional(),
  searchQuery: z.string().nullish(),
  metrics: z.array(pageMetricSchema).max(12).optional(),
  records: z.array(pageRecordSchema).max(25).optional(),
  /** The true size of the result set, which may exceed the rows sent. */
  recordCount: z.number().int().nonnegative().optional(),
  selectedCount: z.number().int().nonnegative().optional(),
  availableActions: z
    .array(z.object({ key: z.string(), label: z.string().optional() }))
    .max(24)
    .optional(),
  /** The choices the page offers — grades, categories — not the ones applied. */
  facets: z
    .array(
      z.object({
        key: z.string(),
        label: z.string().optional(),
        values: z.array(z.string()).max(8),
      })
    )
    .max(4)
    .optional(),
});

export const trustedSessionContextSchema = z.object({
  conversationId: z.string().optional(),
  userId: z.string().optional(),
  subInstituteId: z.string().optional(),
  role: z.string().optional(),
  profileName: z.string().optional(),
  profileId: z.string().optional(),
  clientId: z.string().optional(),
  employeeNo: z.string().optional(),
  orgId: z.string().optional(),
  token: z.string().optional(),
  baseUrl: z.string().optional(),
  syear: z.string().optional(),
  termId: z.string().optional(),
  route: z.string().optional(),
  // The record the user is looking at, resolved from the route by the AI Workspace.
  // Optional and additive: when absent the assistant behaves exactly as before.
  entityType: z.string().optional(),
  entityId: z.union([z.string(), z.number()]).optional(),
  entityLabel: z.string().optional(),
  // The module the route resolved to, and what the page reports it is showing. Both
  // optional and additive: when absent the assistant behaves exactly as before.
  module: z.string().optional(),
  moduleLabel: z.string().optional(),
  page: pageContextSchema.optional(),
  cookieHeader: z.string().optional(),
  referer: z.string().optional(),
  /**
   * Tools the user has explicitly confirmed for this turn.
   *
   * A tool declaring `requiresConfirmation` does not execute unless it is named
   * here. The list is per-turn and never persisted, so a confirmation cannot be
   * carried forward into a later question the user has not seen.
   */
  confirmedTools: z.array(z.string()).optional(),
});

export const conversationRequestSchema = z.object({
  messages: z.array(conversationMessageSchema).min(1),
  responseMode: z.enum(["stream", "json"]).optional(),
  context: trustedSessionContextSchema.optional(),
});

export type ConversationType = z.infer<typeof conversationTypeSchema>;
export type ConversationDomain = z.infer<typeof conversationDomainSchema>;
export type ConversationIntent = z.infer<typeof conversationIntentSchema>;
export type ConversationMessage = z.infer<typeof conversationMessageSchema>;
export type PageContextSnapshot = z.infer<typeof pageContextSchema>;
export type TrustedSessionContext = z.infer<typeof trustedSessionContextSchema>;
export type ConversationRequest = z.infer<typeof conversationRequestSchema>;
