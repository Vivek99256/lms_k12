import { convertToModelMessages, type UIMessage } from "ai";
import { NextResponse } from "next/server";
import {
  conversationRequestSchema,
  generateConversationResponse,
  isConversationPermissionError,
  streamConversationResponse,
} from "@shared/conversational-ai-core";
import { resolveProjectAdapter } from "@/lib/ai/project-resolver";

export const runtime = "nodejs";
export const maxDuration = 60;

type SimpleChatMessage = {
  id?: string;
  role: "user" | "assistant";
  content: string;
};

type ChatRouteBody = {
  messages?: Array<UIMessage | SimpleChatMessage>;
  responseMode?: "stream" | "json";
  context?: Record<string, unknown>;
};

const capitalCityMap: Record<string, string> = {
  australia: "Canberra",
  india: "New Delhi",
  japan: "Tokyo",
  china: "Beijing",
  france: "Paris",
  germany: "Berlin",
  italy: "Rome",
  spain: "Madrid",
  canada: "Ottawa",
  brazil: "Brasilia",
  russia: "Moscow",
  "united states": "Washington, D.C.",
  usa: "Washington, D.C.",
  america: "Washington, D.C.",
  "united kingdom": "London",
  uk: "London",
  england: "London",
  nepal: "Kathmandu",
  bhutan: "Thimphu",
  bangladesh: "Dhaka",
  pakistan: "Islamabad",
  "sri lanka": "Sri Jayawardenepura Kotte",
  uae: "Abu Dhabi",
  "saudi arabia": "Riyadh",
  singapore: "Singapore",
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "AI chat route failed.";
}

function parseRetryAfterSeconds(message: string) {
  const match = message.match(/retry in\s+(\d+(?:\.\d+)?)s/i);
  if (!match) {
    return undefined;
  }

  const seconds = Number(match[1]);
  return Number.isFinite(seconds) ? Math.max(1, Math.ceil(seconds)) : undefined;
}

function isQuotaExceededError(message: string) {
  return /quota exceeded|rate.?limit|generativelanguage\.googleapis\.com\/generate_content_free_tier_requests/i.test(
    message
  );
}

function normalizeLookupKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[?.,!]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tryEvaluateSimpleMath(text: string) {
  const match = text.match(
    /what(?:'s| is)?\s+(-?\d+(?:\.\d+)?)\s*(plus|\+|minus|-|times|\*|x|multiplied by|divided by|\/)\s*(-?\d+(?:\.\d+)?)/i
  );
  if (!match) {
    return null;
  }

  const left = Number(match[1]);
  const operator = match[2].toLowerCase();
  const right = Number(match[3]);

  if (Number.isNaN(left) || Number.isNaN(right)) {
    return null;
  }

  if (operator === "plus" || operator === "+") {
    return String(left + right);
  }

  if (operator === "minus" || operator === "-") {
    return String(left - right);
  }

  if (
    operator === "times" ||
    operator === "*" ||
    operator === "x" ||
    operator === "multiplied by"
  ) {
    return String(left * right);
  }

  if (right === 0) {
    return null;
  }

  return String(left / right);
}

function getLatestUserText(messages?: Array<UIMessage | SimpleChatMessage>) {
  const latestUserMessage = [...(messages || [])]
    .reverse()
    .find((message) => message.role === "user");

  if (!latestUserMessage) {
    return "";
  }

  if ("parts" in latestUserMessage && Array.isArray(latestUserMessage.parts)) {
    return latestUserMessage.parts
      .filter((part) => part.type === "text")
      .map((part) => ("text" in part ? part.text : ""))
      .join("\n")
      .trim();
  }

  return "content" in latestUserMessage ? latestUserMessage.content : "";
}

function getLocalQuotaFallback(messages?: Array<UIMessage | SimpleChatMessage>) {
  const text = getLatestUserText(messages).trim();
  if (!text) {
    return null;
  }

  if (/^(hi|hello|hey|good morning|good afternoon|good evening)\b/i.test(text)) {
    return "Hello! How can I help you today?";
  }

  if (/how are you/i.test(text)) {
    return "I'm doing well, thanks. How can I help you?";
  }

  if (/\b(thank you|thanks)\b/i.test(text)) {
    return "You're welcome!";
  }

  if (/^(bye|goodbye|see you)\b/i.test(text)) {
    return "Goodbye!";
  }

  const normalizedText = normalizeLookupKey(text);
  const capitalMatch = normalizedText.match(
    /what(?:'s| is)? the capital of ([a-z\s.'-]+)$/
  );
  if (capitalMatch) {
    const country = normalizeLookupKey(capitalMatch[1]);
    const capital = capitalCityMap[country];
    if (capital) {
      return `The capital of ${capitalMatch[1].trim()} is ${capital}.`;
    }
  }

  const mathAnswer = tryEvaluateSimpleMath(text);
  if (mathAnswer) {
    return mathAnswer;
  }

  return null;
}

function normalizeUiMessages(
  messages: Array<UIMessage | SimpleChatMessage>
): UIMessage[] {
  return messages.map((message, index) => {
    if ("parts" in message && Array.isArray(message.parts)) {
      return message as UIMessage;
    }

    const simpleMessage = message as SimpleChatMessage;
    return {
      id: simpleMessage.id || `msg-${index + 1}`,
      role: simpleMessage.role,
      parts: [{ type: "text", text: simpleMessage.content }],
    } as UIMessage;
  });
}

function toConversationMessages(messages: Array<UIMessage | SimpleChatMessage>) {
  return messages.map((message, index) => {
    if ("parts" in message && Array.isArray(message.parts)) {
      const content = message.parts
        .filter((part) => part.type === "text")
        .map((part) => ("text" in part ? part.text : ""))
        .join("\n")
        .trim();

      return {
        id: message.id || `msg-${index + 1}`,
        role: message.role,
        content: content || "[non-text message]",
      };
    }

    const simpleMessage = message as SimpleChatMessage;
    return {
      id: simpleMessage.id || `msg-${index + 1}`,
      role: simpleMessage.role,
      content: simpleMessage.content,
    };
  });
}

export async function POST(request: Request) {
  let rawBody: ChatRouteBody = {};

  try {
    rawBody = (await request.json()) as ChatRouteBody;

    const body = conversationRequestSchema.parse({
      ...rawBody,
      messages: rawBody.messages ? toConversationMessages(rawBody.messages) : [],
      context: {
        ...(rawBody.context || {}),
        token:
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
          (typeof rawBody.context?.token === "string" ? rawBody.context.token : undefined),
        cookieHeader: request.headers.get("cookie") || undefined,
        referer: request.headers.get("referer") || undefined,
      },
    });

    const messages = await convertToModelMessages(normalizeUiMessages(body.messages));
    const adapter = resolveProjectAdapter();

    if (body.responseMode === "json") {
      const result = await generateConversationResponse(adapter, body, messages);

      return NextResponse.json({
        message: {
          id: `assistant-${Date.now()}`,
          role: "assistant" as const,
          content: result.message,
        },
        response: result,
      });
    }

    const { result } = await streamConversationResponse(adapter, body, messages);
    return result.toUIMessageStreamResponse({
      onError: (error: unknown) => {
        console.error("[ai/chat] error", error);
        return error instanceof Error ? error.message : "AI agent request failed.";
      },
    });
  } catch (error) {
    // A permission refusal is the assistant working, not failing. Log it quietly,
    // answer 403, and hand the surface a normal assistant reply so the user reads a
    // sentence rather than a red crash banner.
    if (isConversationPermissionError(error)) {
      console.info("[ai/chat] permission refused", {
        requiredPermission: error.requiredPermission,
        role: error.role,
      });

      return NextResponse.json(
        {
          message: {
            id: `assistant-${Date.now()}`,
            role: "assistant" as const,
            content: error.message,
          },
          response: {
            message: error.message,
            conversationType: "ask",
            status: "failed",
            toolExecutions: [],
            activeTools: [],
          },
          code: "AI_PERMISSION_DENIED",
        },
        { status: 403 }
      );
    }

    console.error("[ai/chat] route failure", error);
    const message = getErrorMessage(error);

    if (isQuotaExceededError(message)) {
      const retryAfterSeconds = parseRetryAfterSeconds(message);
      const localFallback = getLocalQuotaFallback(rawBody.messages);

      if (localFallback) {
        return NextResponse.json({
          message: {
            id: `assistant-${Date.now()}`,
            role: "assistant" as const,
            content: localFallback,
          },
          response: {
            message: localFallback,
            conversationType: "ask",
            status: "completed",
            toolExecutions: [],
            followUpSuggestions: [
              "Ask a follow-up question.",
              "Ask about an LMS task like homework or reports.",
            ],
            activeTools: [],
          },
        });
      }

      return NextResponse.json(
        {
          error:
            "The AI provider quota is temporarily exhausted. Please retry shortly or switch to a billed Gemini API key/model configuration.",
          detail: message,
          retryAfterSeconds,
          code: "AI_QUOTA_EXCEEDED",
        },
        {
          status: 429,
          headers: retryAfterSeconds
            ? { "Retry-After": String(retryAfterSeconds) }
            : undefined,
        }
      );
    }

    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 }
    );
  }
}
