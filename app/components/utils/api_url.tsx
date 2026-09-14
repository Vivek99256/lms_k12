// utils/api.ts (or config/api.ts)

// Determine if we are in a development environment
// process.env.NODE_ENV is set by Next.js itself:
// 'development' for `npm run dev`
// 'production' for `npm run build` and `npm run start`
// const isDevelopment = process.env.NODE_ENV === 'development';

// // Conditionally set the API base URL
// export const API_BASE_URL: string = isDevelopment
//   ? process.env.NEXT_PUBLIC_API_BASE_URL_DEV! // '!' asserts non-null/undefined
//   : process.env.NEXT_PUBLIC_API_BASE_URL_PROD!; // '!' asserts non-null/undefined

// // Optional: Add a runtime check for robustness
// if (!API_BASE_URL) {
//   console.error("Error: API_BASE_URL is not defined. Check your .env.local file and ensure the environment variables are set correctly.");
//   // Depending on your application's needs, you might throw an error or set a fallback here.
// }
// Check if the current host is NOT a local development environment
const isProductionEnvironment = () => {
  if (typeof window === 'undefined') {
    // Server-side - use NODE_ENV as fallback
    return process.env.NODE_ENV === 'production';
  }

  // Client-side - check hostname
  const hostname = window.location.hostname;
  return !(
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.') || // Common local network IP
    hostname.startsWith('10.0.') ||    // Common local network IP
    hostname.endsWith('.local') ||     // .local domains
    hostname.endsWith('.test') ||      // Test environments
    /^172\.(1[6-9]|2[0-9]|3[0-1])/.test(hostname) // 172.16-31 IP range
  );
};

function normalizeApiBaseUrl(value: string | undefined) {
  return (value || '').trim().replace(/\/$/, '');
}

// Conditionally set the API base URL
export const API_BASE_URL: string = isProductionEnvironment()
  ? normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL_PROD)
  : normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL_DEV);

// Runtime validation
if (!API_BASE_URL) {
  console.error("API_BASE_URL is not defined. Please check your environment variables.");
  // Optionally provide a fallback URL or throw an error
  // throw new Error("API_BASE_URL is not configured");
}

/**
 * Where the AI backend lives, when that is not where the rest of the ERP lives.
 *
 * The assistant, the MCP server and the twelve-stage lifecycle are all served by the
 * Laravel application in `next_lms_erp`. In a single-host deployment that is the same
 * origin as every other API call and this resolves to `API_BASE_URL`, which is why it
 * is a fallback rather than a required variable.
 *
 * It exists because those can legitimately be two different hosts, and when they are,
 * the failure is silent and confusing: the AI host answers every other request
 * perfectly while returning its own 404 *page* for `/api/ai/*`, so the panel shows a
 * transport error rather than "this host does not run that backend". Setting this
 * moves the whole AI surface — panel, reports, MCP tools — to the right origin without
 * moving anything else.
 *
 * `AI_UPSTREAM_BASE_URL` is the server-only counterpart used by the SSE proxy route,
 * for deployments where the browser-facing and server-to-server URLs differ.
 */
export const AI_API_BASE_URL: string =
  normalizeApiBaseUrl(process.env.NEXT_PUBLIC_AI_BASE_URL) || API_BASE_URL;

/**
 * The AI host when it has been named explicitly, and an empty string otherwise.
 *
 * Kept separate from `AI_API_BASE_URL` above because the two answer different
 * questions. That one asks "where should an AI call go?" and always produces an
 * answer. This one asks "has anybody *said* where the AI backend lives?", and the
 * difference matters at exactly one point — `resolveAiBaseUrl()` below.
 */
export const AI_API_BASE_URL_OVERRIDE: string = normalizeApiBaseUrl(
  process.env.NEXT_PUBLIC_AI_BASE_URL
);

/**
 * Where one AI call should go, given whatever host the login recorded.
 *
 * Every AI client reads a `baseUrl` off the session — `userData.host_name`, saved at
 * login — and used it ahead of anything configured. On a single-host deployment that
 * is correct and invisible. On a split deployment it is the bug: `host_name` names the
 * ERP, the ERP does not serve `/api/ai/*`, and its 404 comes back as an HTML page, so
 * the panel reports "the intelligence API returned a non-JSON response" and renders
 * nothing. It worked locally for the same reason it failed live — locally the two
 * hosts happen to be one.
 *
 * So an explicitly named AI host wins over the session's. It is the more specific
 * statement of the two: `host_name` says where this user logged in, while
 * `NEXT_PUBLIC_AI_BASE_URL` says where the AI backend actually runs, and only the
 * second is a claim about the AI backend at all.
 *
 * With nothing configured the session still wins, so single-host deployments — local
 * development included — behave exactly as they did before.
 */
export function resolveAiBaseUrl(sessionBaseUrl?: string | null): string {
  return (
    AI_API_BASE_URL_OVERRIDE ||
    normalizeApiBaseUrl(sessionBaseUrl ?? undefined) ||
    API_BASE_URL
  );
}
