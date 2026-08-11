import { NextResponse } from "next/server";
import { listMcpTools } from "@/lib/ai/mcp-client";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const toolsPayload = await listMcpTools({
      token: request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim(),
      baseUrl: searchParams.get("baseUrl"),
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
