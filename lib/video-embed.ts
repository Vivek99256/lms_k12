/**
 * Turn a video URL into something that will actually play in the page.
 *
 * PAL's reteach step can now serve two very different kinds of video: an mp4
 * uploaded to the school's own storage, and a YouTube link found for a concept
 * the school has no video for. They need different elements — a file plays in
 * <video src>, a YouTube watch URL does not and renders as a black box — and
 * the caller cannot tell which is which from the `format` field alone, since
 * both are format `video`.
 *
 * So this answers one question: is there an embeddable player URL for this,
 * and if not, is it at least a real media file?
 */

export type VideoEmbed = {
  /** URL to put in an <iframe src>. */
  src: string;
  /** Accessible name for the frame. */
  title: string;
  /** Where "open this in its own tab" should point. */
  externalUrl: string;
  provider: 'youtube' | 'vimeo';
};

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * Seconds to start at, from either `t` or `start`. YouTube accepts `1h2m3s`
 * as well as a plain number of seconds.
 */
function startSeconds(url: URL): number | null {
  const raw = url.searchParams.get('t') ?? url.searchParams.get('start');
  if (!raw) return null;

  if (/^\d+$/.test(raw)) {
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  const match = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
  if (!match || !match.slice(1).some(Boolean)) return null;

  const [h, m, s] = match.slice(1).map((v) => (v ? parseInt(v, 10) : 0));
  const total = h * 3600 + m * 60 + s;
  return total > 0 ? total : null;
}

function youtubeId(url: URL): string | null {
  const host = url.hostname.replace(/^(www\.|m\.)/, '');

  if (host === 'youtu.be') {
    return url.pathname.slice(1).split('/')[0] || null;
  }

  if (host !== 'youtube.com' && host !== 'youtube-nocookie.com') {
    return null;
  }

  if (url.pathname === '/watch') return url.searchParams.get('v');

  for (const prefix of ['/embed/', '/shorts/', '/v/', '/live/']) {
    if (url.pathname.startsWith(prefix)) {
      return url.pathname.slice(prefix.length).split('/')[0] || null;
    }
  }

  return null;
}

/**
 * An embeddable player URL, or null when this is not something we can frame.
 *
 * youtube-nocookie is used deliberately: this plays to school students, and it
 * avoids setting tracking cookies before the video is started. `rel=0` no
 * longer disables related videos — it only restricts them to the same channel
 * — so it narrows the exit rather than closing it.
 */
export function toEmbedUrl(raw: string | null | undefined): VideoEmbed | null {
  const value = (raw ?? '').trim();
  if (!value) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

  const id = youtubeId(url);
  if (id && YOUTUBE_ID.test(id)) {
    const params = new URLSearchParams({ rel: '0', modestbranding: '1', playsinline: '1' });
    const start = startSeconds(url);
    if (start !== null) params.set('start', String(start));

    return {
      src: `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`,
      title: 'YouTube video player',
      externalUrl: `https://www.youtube.com/watch?v=${id}`,
      provider: 'youtube',
    };
  }

  const vimeoHost = url.hostname.replace(/^(www\.|player\.)/, '');
  if (vimeoHost === 'vimeo.com') {
    const vimeoId = url.pathname.replace(/^\/(video\/)?/, '').split('/')[0];
    if (/^\d+$/.test(vimeoId)) {
      return {
        src: `https://player.vimeo.com/video/${vimeoId}`,
        title: 'Vimeo video player',
        externalUrl: `https://vimeo.com/${vimeoId}`,
        provider: 'vimeo',
      };
    }
  }

  return null;
}

/** Extensions the browser can play directly in a <video> element. */
const MEDIA_FILE = /\.(mp4|webm|ogg|ogv|m4v|mov)(\?|#|$)/i;

export function isDirectMediaFile(raw: string | null | undefined): boolean {
  return MEDIA_FILE.test((raw ?? '').trim());
}

/**
 * Whether a URL looks like a file at all.
 *
 * Guards the fallback branch: a `format: 'video'` payload whose URL has no
 * recognisable extension is far more likely to be a page about a video than a
 * video, and <video src> on a web page is the black box this module exists to
 * prevent. Better to hand the student a link they can follow.
 */
export function looksLikeFile(raw: string | null | undefined): boolean {
  const value = (raw ?? '').trim();
  if (!value) return false;

  try {
    return /\.[A-Za-z0-9]{2,5}(\?|#|$)/.test(new URL(value).pathname);
  } catch {
    return /\.[A-Za-z0-9]{2,5}(\?|#|$)/.test(value);
  }
}
