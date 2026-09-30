/**
 * Which backend hosts a server route may call on a user's behalf.
 *
 * The browser tells several routes where its Laravel backend is (the
 * `x-laravel-base-url` header, a `baseUrl` field) because the login response
 * records it as `host_name`. Trusting that value as-is let any caller aim the
 * server — and the user's bearer token — at a host of their choosing: an
 * attacker-run "permissions" endpoint that approves everything, an internal
 * address, a cloud metadata service.
 *
 * So a client-supplied base URL is honoured only when its origin is one this
 * deployment is configured for. Anything else falls back to the configured
 * default, which is where a legitimate session points anyway (`host_name` is the
 * backend's own APP_URL), so existing sessions keep working.
 *
 * Trusted origins come from the env vars that already name backends, plus
 * `TRUSTED_BACKEND_ORIGINS` (comma-separated; `https://*.example.com` matches
 * subdomains) for deployments that serve users from more than one backend.
 */

const BACKEND_ENV_VARS = [
  'NEXT_PUBLIC_API_BASE_URL_PROD',
  'NEXT_PUBLIC_API_BASE_URL_DEV',
  'NEXT_PUBLIC_ERP_BASE_URL',
  'NEXT_PUBLIC_AI_BASE_URL',
  'NEXT_PUBLIC_BRAIN_API_BASE_URL',
  'AI_UPSTREAM_BASE_URL',
] as const;

function normalizeBase(value: string | null | undefined): string {
  return (value || '').trim().replace(/\/+$/, '');
}

function originOf(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (url.username || url.password) return null;
    return url.origin.toLowerCase();
  } catch {
    return null;
  }
}

interface TrustedOrigins {
  exact: Set<string>;
  /** `https://*.example.com` entries, stored as [protocol, ".example.com"]. */
  wildcards: Array<[string, string]>;
}

function readTrustedOrigins(): TrustedOrigins {
  const exact = new Set<string>();
  const wildcards: Array<[string, string]> = [];

  for (const name of BACKEND_ENV_VARS) {
    const origin = originOf(normalizeBase(process.env[name]));
    if (origin) exact.add(origin);
  }

  for (const raw of (process.env.TRUSTED_BACKEND_ORIGINS || '').split(',')) {
    const entry = raw.trim().toLowerCase().replace(/\/+$/, '');
    if (!entry) continue;
    const wildcard = /^(https?):\/\/\*(\.[a-z0-9.-]+)$/.exec(entry);
    if (wildcard) {
      wildcards.push([`${wildcard[1]}:`, wildcard[2]]);
      continue;
    }
    const origin = originOf(entry);
    if (origin) exact.add(origin);
  }

  return { exact, wildcards };
}

/** True when `url` points at a backend origin this deployment is configured for. */
export function isTrustedBackendUrl(url: string | null | undefined): boolean {
  const candidate = normalizeBase(url);
  if (!candidate) return false;
  const origin = originOf(candidate);
  if (!origin) return false;

  const trusted = readTrustedOrigins();
  if (trusted.exact.has(origin)) return true;

  const { protocol, hostname } = new URL(candidate);
  return trusted.wildcards.some(
    ([wildProtocol, suffix]) => protocol === wildProtocol && hostname.toLowerCase().endsWith(suffix),
  );
}

/** The configured backend for this build: PROD in production, DEV otherwise. */
export function defaultBackendBaseUrl(): string {
  const production = normalizeBase(process.env.NEXT_PUBLIC_API_BASE_URL_PROD);
  const development = normalizeBase(process.env.NEXT_PUBLIC_API_BASE_URL_DEV);
  return process.env.NODE_ENV === 'production' ? production || development : development || production;
}

/**
 * The base URL a server route should call: the client's value when it is a
 * trusted backend, otherwise `fallback`. Never returns an untrusted host.
 */
export function resolveBackendBaseUrl(
  candidate: string | null | undefined,
  fallback: string = defaultBackendBaseUrl(),
): string {
  const normalized = normalizeBase(candidate);
  if (normalized && isTrustedBackendUrl(normalized)) return normalized;
  return normalizeBase(fallback);
}
