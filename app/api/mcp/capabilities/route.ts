import { NextResponse } from "next/server";
import { listMcpTools } from "@/lib/ai/mcp-client";
import { isTrustedBackendUrl } from "@/lib/security/trusted-backend";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedBaseUrl = searchParams.get("baseUrl");
    // SSRF guard: this baseUrl comes straight from the query string, so only a
    // configured backend may be named; anything else falls back to the default.
    const baseUrl = requestedBaseUrl && isTrustedBackendUrl(requestedBaseUrl) ? requestedBaseUrl : null;
    const toolsPayload = await listMcpTools({
      token: request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim(),
      baseUrl,
    });
    const payloadData =
      toolsPayload.data && typeof toolsPayload.data === "object"
        ? (toolsPayload.data as { tools?: Array<Record<string, unknown>> })
        : undefined;
    const tools = Array.isArray(payloadData?.tools)
      ? payloadData.tools
      : [];

    return NextResponse.json({
      tools: tools.map((tool: Record<string, unknown>) => ({
        name: typeof tool.name === "string" ? tool.name : "unknown",
        description:
          typeof tool.description === "string"
            ? tool.description
            : "",
        annotations:
          typeof tool.annotations === "object" && tool.annotations !== null
            ? tool.annotations
            : {},
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to discover MCP capabilities.",
      },
      { status: 500 }
    );
  }
}
