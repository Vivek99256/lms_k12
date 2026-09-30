import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveAiBaseUrl } from "@/app/components/utils/api_url";

/**
 * The "no, I'm fine" half of the stuck-user popup — a thin, no-template pass-through
 * to `POST {LARAVEL}/api/ai/assistance/tickets`. No model is called here, so unlike
 * `stuck-assist` there is no template to name; this route exists only so the browser
 * never talks to the Laravel host directly, matching every other AI call in this app.
 */

export const runtime = "nodejs";
export const maxDuration = 30;

const requestSchema = z.object({
  module: z.string().max(80).nullable().optional(),
  pageTitle: z.string().max(200).nullable().optional(),
  pagePath: z.string().max(300).nullable().optional(),
  idleSeconds: z.number().int().min(0).max(86400),
  context: z.record(z.string(), z.unknown()).nullable().optional(),
  /** A `data:image/png;base64,...` URI, or omitted if the capture failed. */
  screenshot: z.string().max(8_000_000).nullable().optional(),
  userName: z.string().max(150).nullable().optional(),
});

export async function POST(request: Request) {
  let body: z.infer<typeof requestSchema>;

  try {
    body = requestSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: "The assistance-ticket request was not valid.",
        code: "AI_ASSISTANCE_TICKET_INVALID",
        detail: error instanceof z.ZodError ? z.prettifyError(error) : String(error),
      },
      { status: 422 }
    );
  }

  const authorization = request.headers.get("authorization");

  if (!authorization) {
    return NextResponse.json(
      { error: "Sign in to raise an assistance ticket.", code: "AI_ASSISTANCE_TICKET_UNAUTHENTICATED" },
      { status: 401 }
    );
  }

  const baseUrl = resolveAiBaseUrl();

  if (!baseUrl) {
    return NextResponse.json(
      { error: "The AI API base URL is not configured.", code: "AI_ASSISTANCE_TICKET_NO_BASE_URL" },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(`${baseUrl}/api/ai/assistance/tickets`, {
      method: "POST",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: authorization,
      },
      body: JSON.stringify({
        module: body.module ?? null,
        page_title: body.pageTitle ?? null,
        page_path: body.pagePath ?? null,
        idle_seconds: body.idleSeconds,
        context: body.context ?? null,
        screenshot: body.screenshot ?? null,
        user_name: body.userName ?? null,
      }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok || payload?.success === false) {
      return NextResponse.json(
        { error: payload?.message || `The AI runtime returned ${response.status}.`, code: "AI_ASSISTANCE_TICKET_RUNTIME_FAILED" },
        { status: response.status >= 400 ? response.status : 502 }
      );
    }

    return NextResponse.json({ id: payload?.data?.id ?? null });
  } catch (error) {
    // The message can name internal hosts (a fetch failure); keep it in the server log.
    console.error("[ai/assistance-tickets] route failure", error);
    return NextResponse.json(
      { error: "Could not raise the assistance ticket.", code: "AI_ASSISTANCE_TICKET_FAILED" },
      { status: 500 }
    );
  }
}
