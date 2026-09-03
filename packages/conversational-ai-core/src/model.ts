import { google } from "@ai-sdk/google";

export function createAiModel() {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY && process.env.GEMINI_API_KEY) {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = process.env.GEMINI_API_KEY;
  }

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    throw new Error(
      "GOOGLE_GENERATIVE_AI_API_KEY or GEMINI_API_KEY is required for AI SDK usage."
    );
  }

  // gemini-2.5-flash has been retired and now refuses new callers outright,
  // which surfaced as every AI field edit failing with a provider error.
  // Override per-environment with GEMINI_MODEL to move to a newer model.
  return google(process.env.GEMINI_MODEL || "gemini-3.6-flash");
}
