import { NextResponse } from 'next/server';
import { buildCoverQueries, readCoverParams } from '@/lib/simulation-cover-query';
import { rateLimit } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/sim-cover?t=<title>&s=<subtitle>&c=<category>&g=<tags>&ch=<chapter>&su=<subject>
 *
 * A real stock photograph that fits a simulation / chapter / topic, for a card that has no cover of its own. The name is turned into search
 * phrases (lib/simulation-cover-query), Pixabay is asked for a landscape photo, and the browser is redirected to it. The API key stays on
 * the server (PIXABAY_API_KEY, deliberately not NEXT_PUBLIC_); the browser only ever sees the picture's address.
 *
 * Why a redirect and not a download: Pixabay's image host rate-limits scripted downloads (HTTP 429), and its terms allow showing its image
 * addresses directly for 24 hours. So the redirect is cached for 12 hours - inside that window - and the CDN answers repeat views itself.
 *
 * With no key, no match or any failure the answer is a 404, and the card draws its plain panel instead.
 */

const SEARCH_URL = 'https://pixabay.com/api/';
// Pixabay's image addresses are valid for 24 hours; stay well inside that.
const FOUND_CACHE = 'public, max-age=3600, s-maxage=43200';
const MISSING_CACHE = 'public, max-age=300, s-maxage=600';

interface PixabayHit {
  largeImageURL?: string;
  webformatURL?: string;
}

function missing(): NextResponse {
  return new NextResponse(null, { status: 404, headers: { 'Cache-Control': MISSING_CACHE } });
}

/** Only ever redirect to Pixabay's own hosts: the address comes out of a JSON answer, so it is checked, not trusted. */
function isPixabayImage(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'pixabay.com' || url.hostname.endsWith('.pixabay.com'));
  } catch {
    return false;
  }
}

async function firstPhoto(query: string, key: string): Promise<string | null> {
  const params = new URLSearchParams({
    key,
    q: query,
    image_type: 'photo',
    orientation: 'horizontal',
    min_width: '1280',
    min_height: '720',
    safesearch: 'true',
    order: 'popular',
    per_page: '8',
  });
  const res = await fetch(`${SEARCH_URL}?${params.toString()}`, { next: { revalidate: 43_200 }, signal: AbortSignal.timeout(8_000) });
  if (!res.ok) return null;
  const body = (await res.json()) as { hits?: PixabayHit[] };
  for (const hit of body.hits ?? []) {
    const url = hit.largeImageURL ?? hit.webformatURL;
    if (isPixabayImage(url)) return url;
  }
  return null;
}

export async function GET(request: Request) {
  const limited = rateLimit(request, 'sim-cover', { limit: 240, windowMs: 60_000 });
  if (limited) return limited;

  const key = process.env.PIXABAY_API_KEY?.trim();
  if (!key) {
    console.warn('[sim-cover] PIXABAY_API_KEY is not set; cards keep their plain panel.');
    return missing();
  }

  const ctx = readCoverParams(new URL(request.url).searchParams);
  if (!ctx.title && !ctx.chapter && !ctx.subtitle && !ctx.category && !(ctx.tags && ctx.tags.length)) return missing();

  try {
    for (const query of buildCoverQueries(ctx)) {
      const url = await firstPhoto(query, key);
      if (url) return NextResponse.redirect(url, { status: 302, headers: { 'Cache-Control': FOUND_CACHE } });
    }
  } catch (error) {
    // A search that fails is the same to the card as no picture: it draws its panel. Say why once, in the server log.
    console.warn(`[sim-cover] lookup failed: ${error instanceof Error ? error.message : String(error)}`.slice(0, 200));
  }
  return missing();
}
