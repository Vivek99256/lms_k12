import { resolveAiBaseUrl } from '@/app/components/utils/api_url';
import { readSessionToken } from '@/lib/security/session-token';

/**
 * SERVER ONLY. A text completion through the Laravel backend's AI Providers.
 *
 * This server holds no AI provider key. Where a route used to call DeepSeek, OpenRouter or Gemini
 * with a key from this repo's `.env`, it now asks the backend, as the signed-in user, to complete
 * under a named AI module. The backend decides — from the configuration saved in AI Providers —
 * which provider, model and credential to use, in that module's priority order, with fallback, and
 * records the usage. Nothing here can name a provider, and no credential ever comes back.
 */

export type CompletionModule = 'recruitment_ai' | 'knowledge_sop';

export interface Completion {
  text: string;
  provider: string | null;
  model: string | null;
}

export class BackendCompletionError extends Error {
  /** `not_configured` — an administrator has to set the module up; `quota`; or `failed`. */
  readonly kind: 'not_configured' | 'quota' | 'failed';
  readonly status: number;
  readonly retryAfterSeconds?: number;

  constructor(message: string, kind: 'not_configured' | 'quota' | 'failed', status: number, retryAfterSeconds?: number) {
    super(message);
    this.name = 'BackendCompletionError';
    this.kind = kind;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export async function completeViaBackend(
  request: Request,
  input: {
    module: CompletionModule;
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
    json?: boolean;
    maxTokens?: number;
    temperature?: number;
  }
): Promise<Completion> {
  const token = readSessionToken(request);
  const baseUrl = resolveAiBaseUrl();

  if (!token || !baseUrl) {
    throw new BackendCompletionError('The AI backend is not reachable from this server.', 'failed', 503);
  }

  const response = await fetch(`${baseUrl}/api/ai/complete`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      module: input.module,
      messages: input.messages,
      json: input.json ?? false,
      max_tokens: input.maxTokens,
      temperature: input.temperature,
    }),
  });

  const payload = (await response.json().catch(() => null)) as {
    success?: boolean;
    message?: string;
    data?: { text?: string; provider?: string | null; model?: string | null };
    errors?: { reason?: string; retry_after?: number } | null;
  } | null;

  if (!response.ok || payload?.success === false) {
    const message = payload?.message || `The AI backend returned ${response.status}.`;

    if (response.status === 503 && payload?.errors?.reason) {
      throw new BackendCompletionError(message, 'not_configured', 503);
    }
    if (response.status === 429) {
      throw new BackendCompletionError(message, 'quota', 429, payload?.errors?.retry_after);
    }

    throw new BackendCompletionError(message, 'failed', response.status);
  }

  const text = payload?.data?.text;

  if (typeof text !== 'string' || !text.trim()) {
    throw new BackendCompletionError('The AI backend returned no content.', 'failed', 502);
  }

  return { text, provider: payload?.data?.provider ?? null, model: payload?.data?.model ?? null };
}
