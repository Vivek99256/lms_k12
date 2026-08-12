import type { ProjectContext } from "@shared/conversational-ai-core";

type JsonRecord = Record<string, unknown>;

function buildHeaders(context: ProjectContext) {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(context.token ? { Authorization: `Bearer ${context.token}` } : {}),
    ...(context.cookieHeader ? { Cookie: context.cookieHeader } : {}),
    ...(context.referer ? { Referer: context.referer } : {}),
  };
}

export async function callBackendMcpTool(
  context: ProjectContext,
  tool: string,
  args: Record<string, unknown>,
  confirmationToken?: string
) {
  if (!context.baseUrl) {
    throw new Error("LMS backend base URL is not configured.");
  }

  const response = await fetch(`${context.baseUrl.replace(/\/$/, "")}/api/mcp/tools/call`, {
    method: "POST",
    headers: buildHeaders(context),
    body: JSON.stringify({
      tool,
      arguments: args,
      confirmation_token: confirmationToken,
      meta: {
        institute_id: context.subInstituteId ? Number(context.subInstituteId) : undefined,
        academic_year: context.syear ? Number(context.syear) : undefined,
        term_id: context.termId ? Number(context.termId) : undefined,
      },
    }),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as JsonRecord;
  if (!response.ok || payload.success === false) {
    throw new Error(
      typeof payload.message === "string"
        ? payload.message
        : `MCP request failed (${response.status}).`
    );
  }

  const data =
    payload.data && typeof payload.data === "object"
      ? (payload.data as JsonRecord)
      : {};

  return data.result && typeof data.result === "object"
    ? (data.result as JsonRecord)
    : {};
}
