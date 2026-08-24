import { NextResponse } from "next/server";
import { callMcpTool } from "@/lib/ai/mcp-client";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      tool?: string;
      arguments?: Record<string, unknown>;
      confirmationToken?: string;
      meta?: {
        instituteId?: string | number | null;
        academicYear?: string | number | null;
        termId?: string | number | null;
      };
      baseUrl?: string;
    };

    if (!body.tool) {
      return NextResponse.json(
        { error: "tool is required." },
        { status: 400 }
      );
    }

    const payload = await callMcpTool(
      {
        token: request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim(),
        baseUrl: body.baseUrl,
        meta: body.meta,
      },
      {
        tool: body.tool,
        arguments: body.arguments,
        confirmationToken: body.confirmationToken,
      }
    );

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to execute the MCP tool.",
      },
      { status: 500 }
    );
  }
}
