import { NextResponse } from 'next/server';

import { API_BASE_URL, AI_API_BASE_URL } from '@/app/components/utils/api_url';
import { isAllowedAssetUrl } from '@/lib/question-paper/images';

/**
 * One question figure, re-served from this origin.
 *
 * A question paper PDF is rasterised in the browser, and a canvas can only be
 * read back if every pixel on it came from somewhere the page is allowed to
 * read. A figure served by the extraction host without CORS headers therefore
 * cannot go into the PDF at all from the browser alone -- it comes out as a
 * blank gap where the diagram should be.
 *
 * This route closes that gap: the bytes arrive from this origin, so the canvas
 * stays clean. It is a fallback, not the normal path -- the export tries a
 * direct CORS fetch first and only comes here when that is refused.
 *
 * WHY THE ALLOW-LIST
 *
 * A route that fetches a url a caller names is a server-side request forgery
 * primitive: whatever this server can reach, a caller could then read. So the
 * url must resolve to an origin this deployment already talks to -- the ERP,
 * the AI host, or a host named in `QUESTION_ASSET_ORIGINS`. Anything else is
 * refused rather than fetched.
 *
 * It also never forwards credentials. Question figures are static assets; a
 * proxy that carried the caller's token would let a url decide where that
 * token goes.
 */

export const runtime = 'nodejs';

/** Bounded so a figure cannot be used to pull something large through. */
const MAX_BYTES = 8 * 1024 * 1024;

/** Hops a figure url may redirect through, each re-checked against the allow-list. */
const MAX_REDIRECTS = 3;

const IMAGE_CONTENT_TYPE_RE = /^image\/(png|jpe?g|gif|webp|svg\+xml)$/i;

/**
 * The origins a figure may be fetched from.
 *
 * Both ERP base urls are listed, not just the active one. `API_BASE_URL`
 * resolves to the dev host while running `next dev`, but question HTML written
 * by the rich-text editor stores absolute urls against whichever host the
 * author was on — `https://erp.triz.co.in/lms_editor_upload/...` — so a
 * developer would otherwise be unable to print any paper whose questions carry
 * an editor-uploaded image. Both are this app's own hosts either way.
 *
 * Figures extracted from a PDF live somewhere else again (an object store, on
 * its own CDN domain), and that host is not named anywhere else in this app,
 * so `QUESTION_ASSET_ORIGINS` — comma separated — is how a deployment adds it.
 * Server-side only: this list is a security boundary and has no business being
 * readable, or settable, in the browser.
 */
function allowedOrigins(): string[] {
  const configured = (process.env.QUESTION_ASSET_ORIGINS || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  return [
    API_BASE_URL,
    AI_API_BASE_URL,
    (process.env.NEXT_PUBLIC_API_BASE_URL_DEV || '').trim(),
    (process.env.NEXT_PUBLIC_API_BASE_URL_PROD || '').trim(),
    ...configured,
  ].filter(Boolean);
}

export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get('url')?.trim() ?? '';

  if (!url) {
    return NextResponse.json({ error: 'A figure url is required.' }, { status: 422 });
  }

  if (!isAllowedAssetUrl(url, allowedOrigins())) {
    return NextResponse.json(
      {
        error: 'That figure is not served by a host this deployment is configured to read.',
        code: 'QUESTION_ASSET_HOST_NOT_ALLOWED',
      },
      { status: 403 }
    );
  }

  try {
    // Redirects are followed by hand so every hop is held to the same allow-list;
    // `redirect: 'follow'` would let an open redirect on an allowed host lead anywhere.
    let upstream: Response | null = null;
    let target = url;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      upstream = await fetch(target, {
        // No Authorization, no Cookie: see the note above.
        headers: { Accept: 'image/*' },
        cache: 'no-store',
        redirect: 'manual',
      });
      const location = upstream.status >= 300 && upstream.status < 400 ? upstream.headers.get('location') : null;
      if (!location) break;
      const next = new URL(location, target).toString();
      if (!isAllowedAssetUrl(next, allowedOrigins())) {
        return NextResponse.json(
          { error: 'That figure redirects to a host this deployment is not configured to read.', code: 'QUESTION_ASSET_HOST_NOT_ALLOWED' },
          { status: 403 }
        );
      }
      target = next;
      upstream = null;
    }
    if (!upstream) {
      return NextResponse.json({ error: 'That figure redirected too many times.' }, { status: 502 });
    }

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `The figure host returned ${upstream.status}.` },
        { status: 502 }
      );
    }

    const contentType = (upstream.headers.get('content-type') || '').split(';')[0].trim();

    // An asset url that answers with HTML is the host's 404 page, not a figure.
    // Passing it on would put a picture of an error page on the exam paper.
    if (!IMAGE_CONTENT_TYPE_RE.test(contentType)) {
      return NextResponse.json(
        { error: `That figure url returned ${contentType || 'an unknown type'}, not an image.` },
        { status: 502 }
      );
    }

    const declaredLength = Number(upstream.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BYTES) {
      return NextResponse.json({ error: 'That figure is too large to print.' }, { status: 502 });
    }

    const bytes = await upstream.arrayBuffer();

    if (bytes.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: 'That figure is too large to print.' }, { status: 502 });
    }

    return new Response(bytes, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(bytes.byteLength),
        // Figures are immutable once extracted, and one export can ask for the
        // same diagram on several questions.
        'Cache-Control': 'private, max-age=3600',
        // An SVG can carry script. Served from this origin, opening it directly would
        // run that script here; this policy keeps it a picture (it still draws in <img>).
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    // Fetch errors can name internal hosts; keep them in the server log.
    console.error('[question-paper/asset] fetch failed', error);
    return NextResponse.json({ error: 'The figure could not be fetched.' }, { status: 502 });
  }
}
