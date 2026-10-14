/**
 * Child-process probe for `api-url.test.ts`.
 *
 * `api_url.tsx` computes its constants once, when it is first imported, so the only reliable way
 * to observe it under a different environment is a fresh process. The parent sets `process.env`,
 * passes the hostname (or "none" for a server) and a JSON list of session hosts to resolve, and
 * reads one JSON line back.
 */
import { installBrowser } from './browser-env';

const hostname = process.argv[2] ?? 'localhost';
const hints = JSON.parse(process.argv[3] ?? '[]') as Array<string | null | undefined>;

if (hostname !== 'none') installBrowser({ hostname });

console.error = () => undefined; // the module logs when no base URL is configured

async function main(): Promise<void> {
  const mod = await import('../../../app/components/utils/api_url');

  process.stdout.write(
    JSON.stringify({
      API_BASE_URL: mod.API_BASE_URL,
      AI_API_BASE_URL: mod.AI_API_BASE_URL,
      AI_API_BASE_URL_OVERRIDE: mod.AI_API_BASE_URL_OVERRIDE,
      resolved: hints.map((hint) => mod.resolveAiBaseUrl(hint)),
    }),
  );
}

void main();
