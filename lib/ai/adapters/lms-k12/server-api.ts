import { API_BASE_URL } from "@/app/components/utils/api_url";
import type { ProjectContext } from "@shared/conversational-ai-core";

type JsonRecord = Record<string, unknown>;

function readJsonSafe(text: string) {
  if (!text.trim()) {
    return {};
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("Backend returned a non-JSON response.");
  }
}

function readStatus(payload: JsonRecord) {
  const raw = payload.status_code ?? payload.status ?? payload.success;
  if (typeof raw === "boolean") {
    return raw ? "1" : "0";
  }
  return raw == null ? "" : String(raw).trim().toLowerCase();
}

function isFailurePayload(payload: JsonRecord) {
  const status = readStatus(payload);
  if (!status) {
    return false;
  }

  return ["0", "2", "false", "error", "failed"].includes(status);
}

function buildHeaders(context: ProjectContext, contentType?: string): HeadersInit {
  return {
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
    ...(contentType ? { "Content-Type": contentType } : {}),
    ...(context.token ? { Authorization: `Bearer ${context.token}` } : {}),
    ...(context.cookieHeader ? { Cookie: context.cookieHeader } : {}),
    ...(context.referer ? { Referer: context.referer } : {}),
  };
}

function ensureBaseUrl(context: ProjectContext) {
  return (context.baseUrl || API_BASE_URL || "").replace(/\/$/, "");
}

export function buildTrustedQuery(context: ProjectContext) {
  const query = new URLSearchParams();
  query.set("type", "API");
  if (context.subInstituteId) {
    query.set("sub_institute_id", context.subInstituteId);
  }
  if (context.syear) {
    query.set("syear", context.syear);
  }
  if (context.userId) {
    query.set("user_id", context.userId);
  }
  if (context.termId) {
    query.set("term_id", context.termId);
  }
  if (context.profileId) {
    query.set("user_profile_id", context.profileId);
  }
  if (context.profileName) {
    query.set("user_profile_name", context.profileName);
  }
  if (context.clientId) {
    query.set("client_id", context.clientId);
  }
  if (context.token) {
    query.set("token", context.token);
  }

  return query;
}

export async function fetchLmsJson(
  context: ProjectContext,
  path: string,
  init?: RequestInit
) {
  const baseUrl = ensureBaseUrl(context);
  if (!baseUrl) {
    throw new Error("LMS backend base URL is not configured.");
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...buildHeaders(context, init?.body ? "application/json" : undefined),
      ...init?.headers,
    },
  });
  const payload = readJsonSafe(await response.text());

  if (!response.ok || isFailurePayload(payload)) {
    const message =
      typeof payload.message === "string"
        ? payload.message
        : `Backend request failed (${response.status}).`;
    throw new Error(message);
  }

  return payload;
}

export async function postProxyJson(
  context: ProjectContext,
  path: string,
  body: Record<string, unknown>
) {
  const query = buildTrustedQuery(context);
  return fetchLmsJson(context, `/api/${path}?${query.toString()}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function postLmsForm(
  context: ProjectContext,
  path: string,
  body: URLSearchParams
) {
  const response = await fetchLmsJson(context, path, {
    method: "POST",
    headers: buildHeaders(context, "application/x-www-form-urlencoded;charset=UTF-8"),
    body: body.toString(),
  });

  return response;
}
