import { generateText } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createAiModel } from "@shared/conversational-ai-core/model";
import { instructionForAction } from "@/lib/ai/field-edit/actions";
import {
  FIELD_EDIT_SYSTEM_PROMPT,
  buildFieldEditPrompt,
  cleanFieldEditOutput,
  inspectFieldEditOutput,
} from "@/lib/ai/field-edit/prompt";

/**
 * Field-level AI editing.
 *
 * One field in, one replacement value out. Deliberately not a conversation: the caller
 * is a form field, the answer is text destined for that field, and every request is
 * independent so nothing carries over between two unrelated edits.
 *
 * This route does not write anything. It reads the value it was handed and returns a
 * suggestion; the existing form save path is what persists it, only after a human
 * presses Apply and then Save. That separation is what keeps the feature additive —
 * an AI failure can never corrupt a record on its own.
 *
 * Error shape mirrors `app/api/ai/chat` ({ error, code, detail, retryAfterSeconds })
 * so surfaces already handling chat failures need no new branches.
 */

export const runtime = "nodejs";
export const maxDuration = 30;

const fieldContextSchema = z.object({
  fieldType: z
    .enum([
      "question",
      "answer_option",
      "explanation",
      "learning_objective",
      "lesson_content",
      "instructions",
      "description",
      "summary",
      "announcement",
      "policy",
      "feedback",
      "title",
      "notes",
      "generic",
    ])
    .default("generic"),
  fieldLabel: z.string().max(120).optional(),
  module: z.string().max(80).optional(),
  page: z.string().max(120).optional(),
  entityType: z.string().max(80).optional(),
  entityId: z.union([z.string(), z.number()]).nullable().optional(),
  grade: z.union([z.string(), z.number()]).nullable().optional(),
  subject: z.string().max(120).nullable().optional(),
  language: z.string().max(60).nullable().optional(),
  related: z.record(z.string(), z.string().max(2000)).optional(),
  maxLength: z.number().int().positive().nullable().optional(),
});

const requestSchema = z
  .object({
    // 20k is generous for a form field and still bounded — a pasted document should
    // not become a prompt.
    value: z.string().max(20000).default(""),
    instruction: z.string().max(1000).optional(),
    actionKey: z.string().max(80).optional(),
    actionInput: z.string().max(200).optional(),
    context: fieldContextSchema,
  })
  .refine((body) => Boolean(body.instruction?.trim() || body.actionKey), {
    message: "Provide an instruction or an action.",
    path: ["instruction"],
  });

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "AI field edit failed.";
}

function parseRetryAfterSeconds(message: string) {
  const match = message.match(/retry in\s+(\d+(?:\.\d+)?)s/i);
  if (!match) return undefined;
  const seconds = Number(match[1]);
  return Number.isFinite(seconds) ? Math.max(1, Math.ceil(seconds)) : undefined;
}

function isQuotaExceededError(message: string) {
  return /quota exceeded|rate.?limit|generativelanguage\.googleapis\.com\/generate_content_free_tier_requests/i.test(
    message
  );
}

export async function POST(request: Request) {
  let body: z.infer<typeof requestSchema>;

  try {
    body = requestSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: "The AI edit request was not valid.",
        code: "AI_FIELD_EDIT_INVALID",
        detail: error instanceof z.ZodError ? z.prettifyError(error) : getErrorMessage(error),
      },
      { status: 422 }
    );
  }

  // A chip and a typed sentence resolve to the same instruction, so there is one code
  // path and one thing to debug. A typed instruction wins when both are present.
  const instruction =
    body.instruction?.trim() ||
    (body.actionKey ? instructionForAction(body.actionKey, body.actionInput) : null);

  if (!instruction) {
    return NextResponse.json(
      { error: "That action is not recognised.", code: "AI_FIELD_EDIT_UNKNOWN_ACTION" },
      { status: 422 }
    );
  }

  // Nothing to edit and nothing to build from. Refusing here saves a pointless call and
  // stops the model narrating an empty field back at the user as if it were content.
  const hasContext =
    Object.values(body.context.related ?? {}).some((value) => value.trim()) ||
    Boolean(body.context.fieldLabel?.trim());

  if (!body.value.trim() && !hasContext) {
    return NextResponse.json(
      {
        error: "There is nothing to work from yet. Type something in the field first, or fill in the rest of the form.",
        code: "AI_FIELD_EDIT_NO_CONTENT",
      },
      { status: 422 }
    );
  }

  const model = createAiModel();

  try {
    const { text } = await generateText({
      model,
      system: FIELD_EDIT_SYSTEM_PROMPT,
      prompt: buildFieldEditPrompt({
        value: body.value,
        instruction,
        context: body.context,
      }),
      // Low, not zero: an edit should be stable and faithful, but "generate a similar
      // question" still needs room to differ from the original.
      temperature: 0.3,
    });

    const result = cleanFieldEditOutput(text, body.value);
    const inspection = inspectFieldEditOutput(result, body.value);

    if (!inspection.ok) {
      return NextResponse.json(
        { error: inspection.reason, code: "AI_FIELD_EDIT_UNUSABLE" },
        { status: 422 }
      );
    }

    return NextResponse.json({
      result,
      actionKey: body.actionKey,
      model: model.modelId,
      note:
        result.trim() === body.value.trim()
          ? "No change was needed — the text already meets that instruction."
          : undefined,
    });
  } catch (error) {
    console.error("[ai/field-edit] route failure", error);
    const message = getErrorMessage(error);

    if (isQuotaExceededError(message)) {
      const retryAfterSeconds = parseRetryAfterSeconds(message);

      return NextResponse.json(
        {
          error: "The AI provider quota is temporarily exhausted. Please retry shortly.",
          detail: message,
          retryAfterSeconds,
          code: "AI_QUOTA_EXCEEDED",
        },
        {
          status: 429,
          headers: retryAfterSeconds ? { "Retry-After": String(retryAfterSeconds) } : undefined,
        }
      );
    }

    return NextResponse.json({ error: message, code: "AI_FIELD_EDIT_FAILED" }, { status: 500 });
  }
}
