/**
 * Test-only helpers for the AI characterization tests.
 *
 * The code under test reads `window`, `localStorage`, `sessionStorage` and `fetch` as bare
 * globals, so Node needs stand-ins for them. These are in-memory fakes of the platform, not
 * fixtures of application data: every value a test stores is spelled out in that test, and
 * every assertion is about what the production code did with it.
 */

export class MemoryStorage {
  private readonly map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }
}

type Globals = {
  window?: unknown;
  localStorage?: unknown;
  sessionStorage?: unknown;
  fetch?: unknown;
};

const KEYS = ['window', 'localStorage', 'sessionStorage', 'fetch'] as const;

/** Saves the named globals, runs `install`, and returns a function that puts everything back. */
function swap(install: (g: Globals) => void): () => void {
  const g = globalThis as unknown as Globals;
  const had = new Map<string, boolean>();
  const old = new Map<string, unknown>();

  for (const key of KEYS) {
    had.set(key, key in g);
    old.set(key, g[key]);
  }

  install(g);

  return () => {
    for (const key of KEYS) {
      if (had.get(key)) g[key] = old.get(key);
      else delete g[key];
    }
  };
}

export interface BrowserOptions {
  hostname?: string;
  /** Raw string values for `localStorage`. JSON records must be stringified by the test. */
  local?: Record<string, string>;
  session?: Record<string, string>;
}

/** A browser-shaped environment. Call the returned function to restore the real globals. */
export function installBrowser(options: BrowserOptions = {}): () => void {
  return swap((g) => {
    const local = new MemoryStorage();
    const session = new MemoryStorage();
    for (const [key, value] of Object.entries(options.local ?? {})) local.setItem(key, value);
    for (const [key, value] of Object.entries(options.session ?? {})) session.setItem(key, value);
    g.window = { location: { hostname: options.hostname ?? 'localhost' } };
    g.localStorage = local;
    g.sessionStorage = session;
  });
}

/** A server-shaped environment: no `window`, no storage. */
export function installServer(): () => void {
  return swap((g) => {
    delete g.window;
    delete g.localStorage;
    delete g.sessionStorage;
  });
}

export interface RecordedCall {
  url: string;
  init: {
    method?: string;
    headers?: Record<string, string> | Headers;
    body?: unknown;
    cache?: string;
  };
}

export interface FetchStub {
  calls: RecordedCall[];
  restore: () => void;
}

export interface FakeResponse {
  status?: number;
  body?: string;
  headers?: Record<string, string>;
}

/** Replaces global `fetch`. Every call is recorded; `respond` decides the answer. */
export function stubFetch(respond: (call: RecordedCall) => FakeResponse | Promise<FakeResponse>): FetchStub {
  const calls: RecordedCall[] = [];
  const restore = swap((g) => {
    g.fetch = async (input: unknown, init: RecordedCall['init'] = {}) => {
      const call: RecordedCall = { url: String(input), init };
      calls.push(call);
      const { status = 200, body = '{"success":true,"message":"","data":null}', headers } = await respond(call);
      return new Response(body, { status, headers });
    };
  });

  return { calls, restore };
}

/** Headers as a plain, case-preserving record, whichever shape the code passed. */
export function headersOf(call: RecordedCall): Record<string, string> {
  const raw = call.init.headers;
  if (!raw) return {};
  if (raw instanceof Headers) {
    const out: Record<string, string> = {};
    raw.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  return { ...raw };
}

export const okEnvelope = (data: unknown): FakeResponse => ({
  status: 200,
  body: JSON.stringify({ success: true, message: 'ok', data }),
});
