import { NextRequest, NextResponse } from "next/server";
import { searchDocs } from "@/lib/docs/docs-service";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const version = searchParams.get("version") || "2.0.0";
  const query = searchParams.get("q") || "";

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = searchDocs(version, query);
    return NextResponse.json({ results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Search failed" }, { status: 500 });
  }
}

