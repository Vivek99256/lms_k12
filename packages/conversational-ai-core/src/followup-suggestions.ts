/**
 * Follow-up chips must be things the user can *say*, not instructions telling them
 * what to say.
 *
 * The panel renders every `followUpSuggestions` entry as a button and sends its label
 * verbatim as the next user message (`ChatbotPanel.tsx` → `sendMessage(suggestion)`).
 * So a chip reading "Reply with the numbered option if shown." sends that sentence as
 * the question. Nothing matches it, the assistant repeats the same request, and the
 * conversation dead-ends in a loop the user cannot escape without retyping.
 *
 * This is the guard: a suggestion is only offered if it reads as an utterance. Meta
 * instructions are dropped rather than rewritten — a chip we cannot turn into a real
 * question is better absent than broken, and the surrounding message already tells the
 * user what to do.
 */

/**
 * Phrases that address the user about how to reply, rather than being a reply.
 * Matched at the start of the suggestion, case-insensitively.
 */
const INSTRUCTION_PREFIXES = [
  "reply with",
  "respond with",
  "answer with",
  "ask a follow-up",
  "ask a new question",
  "ask another",
  "share the",
  "share details",
  "provide the",
  "specify ",
  "select one",
  "choose one",
  "pick one",
  "add class",
  "add any available",
  "add filters",
  "refine the result",
  "review the pre-filled",
  "wait for",
  "you can reply",
  "let me know",
  "tell me the",
];

/**
 * Whether this string is a usable next utterance rather than an instruction.
 */
export function isActionableFollowUp(suggestion: unknown): suggestion is string {
  if (typeof suggestion !== "string") {
    return false;
  }

  const trimmed = suggestion.trim();

  if (trimmed.length === 0) {
    return false;
  }

  const normalized = trimmed.toLowerCase();

  return !INSTRUCTION_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

/**
 * Keep only the suggestions a user could click and have understood.
 *
 * Order is preserved and duplicates are collapsed, so a caller can concatenate
 * candidate lists without worrying about repeats.
 */
export function toActionableFollowUps(
  suggestions: unknown,
  limit = 4
): string[] {
  if (!Array.isArray(suggestions)) {
    return [];
  }

  const seen = new Set<string>();
  const actionable: string[] = [];

  for (const suggestion of suggestions) {
    if (!isActionableFollowUp(suggestion)) {
      continue;
    }

    const trimmed = suggestion.trim();
    const key = trimmed.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    actionable.push(trimmed);

    if (actionable.length >= limit) {
      break;
    }
  }

  return actionable;
}
