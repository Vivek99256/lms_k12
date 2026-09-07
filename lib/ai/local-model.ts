import { google } from "@ai-sdk/google";

/**
 * Provider factory for deliberately local, text-only AI helpers.
 *
 * Conversational and data-aware requests belong to Laravel's lifecycle. This remains
 * outside it only for bounded UI transforms such as field edit, which receive no ERP
 * data and cannot execute tools or persist a record.
 */
export function createLocalAiModel() {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY && process.env.GEMINI_API_KEY) {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = process.env.GEMINI_API_KEY;
  }

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    throw new Error(
      "GOOGLE_GENERATIVE_AI_API_KEY or GEMINI_API_KEY is required for local AI helpers."
    );
  }

  return google(process.env.GEMINI_MODEL || "gemini-2.5-flash");
}
