import { NextResponse } from "next/server";
import { getMcpHealth } from "@/lib/ai/mcp-client";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const payload = await getMcpHealth({
      token: request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim(),
    });

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to reach the MCP health endpoint.",
      },
      { status: 500 }
    );
  }
}
