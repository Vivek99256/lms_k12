import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createAiModel } from "@shared/conversational-ai-core/model";
import {
  convertSopProcedure,
  findModule,
  toIntakeText,
  type ParseIssue,
  type ProcessSpec,
} from "@/lib/process";

/**
 * SOP procedure text -> a proposed Process, Workflow and task set.
 *
 * Two things this route deliberately does not do.
 *
 * It does not persist. It returns a proposal; `general/add_process` saves only
 * after a person has reviewed it and pressed Save. That is the SOP's own rule
 * (BR-07, 7.4) applied to the converter itself - the conversion of a procedure
 * is exactly the kind of AI output that must never reach a record unattended.
 *
 * It does not let the model define the process. The deterministic parser
 * (`lib/process/parser.ts`) runs first and, for a procedure copied out of an
 * SOP with its tables intact, finishes the job with no model call at all. The
 * model is the fallback for prose, and even then its only job is *normalising*
 * the prose into the canonical block format - which is then parsed and
 * validated by the same code as a hand-pasted procedure. So a hallucinated
 * business rule or an invented actor fails the same checks either way.
 *
 * Error shape mirrors `app/api/ai/field-edit` so existing surfaces need no new
 * branches.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({
  /** The procedure as transcribed. Bounded: an SOP procedure, not a whole SOP. */
  text: z.string().min(20).max(20000),
  moduleKey: z.string().min(1).max(60),
  /** Set when the caller picked a procedure from the module index. */
  procedureRef: z.string().max(20).optional(),
  /**
   * When false the route is deterministic-only - it reports a parse failure
   * rather than calling the model. Degraded mode (6.15.8) uses this.
   */
  allowAi: z.boolean().default(true),
});

/**
 * What the model is allowed to return. Narrow on purpose: the fields of the
 * SOP's own procedure anatomy and nothing else. There is no free-form field
 * the model could use to smuggle in a conclusion.
 */
const proposalSchema = z.object({
  procedureRef: z.string().describe("Procedure number exactly as printed, e.g. 6.9.4"),
  title: z.string(),
  primaryActor: z
    .enum(["Teacher", "AI", "Teacher + AI", "Student", "Student + AI"])
    .describe("One of the five SOP acting modes"),
  objective: z.string(),
  trigger: z.string(),
  preconditions: z.array(z.string()),
  inputs: z.array(z.string()),
  completionCriteria: z.string(),
  steps: z
    .array(
      z.object({
        no: z.number().int().positive(),
        actor: z.enum(["Teacher", "AI", "Teacher + AI", "Student", "Student + AI"]),
        userAction: z.string().describe("What the person does; empty for unattended system steps"),
        systemAction: z.string(),
        decision: z.string().describe("The validation or branch, including any BR-nn reference stated in the source"),
        result: z.string(),
      })
    )
    .min(1),
  outputs: z.array(z.string()),
});

const SYSTEM_PROMPT = `You normalise Standard Operating Procedure text into a fixed structure.

You are transcribing, not authoring. Every field you emit must be traceable to the supplied text.

Rules:
- Never invent a business rule reference. Copy BR-nn citations only where the source states them.
- Never invent steps, actors, preconditions or outputs. If the source does not state something, leave the field empty.
- Actors must be one of exactly: Teacher, AI, Teacher + AI, Student, Student + AI. Map any other wording onto the closest of these five, and if the source names a role that is none of them, use the acting mode implied (a person acting alone is Teacher; the system acting alone is AI).
- A step where only the system acts has an empty userAction.
- Keep the source's own wording. Do not improve, expand or summarise it.
- Preserve step order and numbering.`;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "SOP conversion failed.";
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

function hasErrors(issues: ParseIssue[]) {
  return issues.some((issue) => issue.level === "error");
}

interface ConvertResponse {
  spec: ProcessSpec | null;
  issues: ParseIssue[];
  /** How the returned spec was produced, for the provenance banner on the review screen. */
  method: "structured" | "ai";
  /** Set when the model was used. */
  model?: string;
  /** The normalised block text, so the reviewer can see and edit what was parsed. */
  intakeText?: string;
}

export async function POST(request: Request) {
  let body: z.infer<typeof requestSchema>;

  try {
    body = requestSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: "The conversion request was not valid.",
        code: "PROCESS_CONVERT_INVALID",
        detail: error instanceof z.ZodError ? z.prettifyError(error) : getErrorMessage(error),
      },
      { status: 422 }
    );
  }

  const sopModule = findModule(body.moduleKey);
  if (!sopModule) {
    return NextResponse.json(
      { error: `No SOP module is registered under "${body.moduleKey}".`, code: "PROCESS_MODULE_UNKNOWN" },
      { status: 404 }
    );
  }

  // 1. Deterministic first. A procedure copied out of the SOP with its tables
  //    intact needs no model, costs nothing and cannot drift.
  const structured = convertSopProcedure(body.text, sopModule);
  if (structured.spec && !hasErrors(structured.issues)) {
    return NextResponse.json({
      spec: structured.spec,
      issues: structured.issues,
      method: "structured",
    } satisfies ConvertResponse);
  }

  if (!body.allowAi) {
    return NextResponse.json({
      spec: structured.spec,
      issues: structured.issues,
      method: "structured",
    } satisfies ConvertResponse);
  }

  // 2. Fall back to normalising prose, then convert the normalised text through
  //    the very same parser.
  try {
    // Inside the try: with no API key configured this throws, and an
    // unconfigured environment should read as "AI is unavailable, convert it
    // structurally instead" (6.15.8 degraded mode) rather than as a crash.
    const model = createAiModel();

    const { object } = await generateObject({
      model,
      schema: proposalSchema,
      system: SYSTEM_PROMPT,
      prompt: buildPrompt(body, sopModule.name),
      temperature: 0,
    });

    const intakeText = toIntakeText({
      procedureRef: body.procedureRef || object.procedureRef,
      title: object.title,
      primaryActor: object.primaryActor,
      objective: object.objective,
      trigger: object.trigger,
      preconditions: object.preconditions,
      inputs: object.inputs,
      completionCriteria: object.completionCriteria,
      steps: object.steps,
      outputs: object.outputs,
    });

    const converted = convertSopProcedure(intakeText, sopModule, { method: "ai", model: model.modelId });

    if (!converted.spec) {
      return NextResponse.json(
        {
          error:
            "The text could not be read as an SOP procedure. Check that it names a procedure number and lists numbered steps.",
          code: "PROCESS_CONVERT_UNUSABLE",
          detail: converted.issues.map((issue) => issue.message).join(" "),
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      spec: converted.spec,
      issues: converted.issues,
      method: "ai",
      model: model.modelId,
      intakeText,
    } satisfies ConvertResponse);
  } catch (error) {
    console.error("[process/convert] route failure", error);
    const message = getErrorMessage(error);

    if (/GOOGLE_GENERATIVE_AI_API_KEY|GEMINI_API_KEY/.test(message)) {
      return NextResponse.json(
        {
          error:
            "AI assistance is not configured on this server, so prose cannot be normalised. Paste the procedure in the structured format (attribute lines, a numbered step table, an output list) to convert it without AI.",
          code: "AI_NOT_CONFIGURED",
          detail: message,
          issues: structured.issues,
        },
        { status: 503 }
      );
    }

    if (isQuotaExceededError(message)) {
      const retryAfterSeconds = parseRetryAfterSeconds(message);
      return NextResponse.json(
        {
          error:
            "The AI provider quota is temporarily exhausted. Paste the procedure in the structured format to convert it without AI.",
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

    return NextResponse.json({ error: message, code: "PROCESS_CONVERT_FAILED" }, { status: 500 });
  }
}

function buildPrompt(body: z.infer<typeof requestSchema>, moduleName: string) {
  return [
    `Module: ${moduleName}`,
    body.procedureRef ? `Procedure reference: ${body.procedureRef}` : "",
    "",
    "SOP procedure text:",
    body.text,
  ]
    .filter(Boolean)
    .join("\n");
}
