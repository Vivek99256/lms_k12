import { API_BASE_URL } from "@/app/components/utils/api_url";

type McpMeta = {
  instituteId?: string | number | null;
  academicYear?: string | number | null;
  termId?: string | number | null;
};

type McpClientContext = {
  token?: string | null;
  baseUrl?: string | null;
  meta?: McpMeta;
};

function normalizeBaseUrl(baseUrl?: string | null) {
  return (baseUrl || API_BASE_URL || "").trim().replace(/\/$/, "");
}

function buildHeaders(token?: string | null, extra?: HeadersInit) {
  return {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

function buildMeta(meta?: McpMeta) {
  return {
    institute_id:
      meta?.instituteId != null && `${meta.instituteId}`.trim()
        ? Number(meta.instituteId)
        : undefined,
    academic_year:
      meta?.academicYear != null && `${meta.academicYear}`.trim()
        ? Number(meta.academicYear)
        : undefined,
    term_id:
      meta?.termId != null && `${meta.termId}`.trim()
        ? Number(meta.termId)
        : undefined,
  };
}

async function readJson(response: Response) {
  const text = await response.text();
  if (!text.trim()) {
    return {};
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("MCP server returned a non-JSON response.");
  }
}

async function requestMcp(
  context: McpClientContext,
  path: string,
  init?: RequestInit
) {
  const baseUrl = normalizeBaseUrl(context.baseUrl);
  if (!baseUrl) {
    throw new Error("MCP backend base URL is not configured.");
  }

  const response = await fetch(`${baseUrl}/api/mcp${path}`, {
    ...init,
    cache: "no-store",
    headers: buildHeaders(context.token, init?.headers),
  });

  const payload = await readJson(response);

  if (!response.ok || payload.success === false) {
    const message =
      typeof payload.message === "string"
        ? payload.message
        : `MCP request failed (${response.status}).`;
    throw new Error(message);
  }

  return payload;
}

export async function getMcpHealth(context: McpClientContext) {
  return requestMcp(context, "/health");
}

export async function initializeMcp(context: McpClientContext) {
  return requestMcp(context, "/initialize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client: {
        name: "lms_k12_next_client",
        version: "1.0.0",
      },
      capabilities: {
        tools: true,
      },
      meta: buildMeta(context.meta),
    }),
  });
}

export async function listMcpTools(context: McpClientContext) {
  return requestMcp(context, "/tools");
}

export async function callMcpTool(
  context: McpClientContext,
  payload: {
    tool: string;
    arguments?: Record<string, unknown>;
    confirmationToken?: string;
  }
) {
  return requestMcp(context, "/tools/call", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tool: payload.tool,
      arguments: payload.arguments || {},
      confirmation_token: payload.confirmationToken,
      meta: buildMeta(context.meta),
    }),
  });
}
