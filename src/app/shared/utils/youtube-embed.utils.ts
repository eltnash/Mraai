export interface ParsedYoutubeEmbed {
  videoId: string;
  sourceUrl: string;
  embedUrl: string;
  thumbnailUrl: string;
}

const EMBED_BASE = 'https://www.youtube-nocookie.com/embed/';

/** Accepts watch URLs, short links, embed URLs, or full iframe embed snippets. */
function normalizeYoutubeInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return trimmed;
  }

  const iframeSrc = trimmed.match(/<iframe[^>]*\ssrc=["']([^"']+)["']/i)?.[1];
  if (iframeSrc) {
    return iframeSrc;
  }

  const quotedSrc = trimmed.match(/\bsrc=["'](https?:\/\/[^"']+)["']/i)?.[1];
  if (quotedSrc && /youtube|youtu\.be/i.test(quotedSrc)) {
    return quotedSrc;
  }

  return trimmed;
}

function videoIdFromPathname(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] === 'embed' || segments[0] === 'shorts' || segments[0] === 'live') {
    return segments[1] ?? null;
  }
  return segments[0] ?? null;
}

export function parseYoutubeUrl(raw: string): ParsedYoutubeEmbed | null {
  const normalized = normalizeYoutubeInput(raw);
  if (!normalized) {
    return null;
  }

  let videoId: string | null = null;

  try {
    const url = new URL(normalized.includes('://') ? normalized : `https://${normalized}`);
    const host = url.hostname.replace(/^www\./, '');

    if (host === 'youtu.be') {
      videoId = videoIdFromPathname(url.pathname);
    } else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      if (url.pathname === '/watch') {
        videoId = url.searchParams.get('v');
      } else {
        videoId = videoIdFromPathname(url.pathname);
      }
    }
  } catch {
    return null;
  }

  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return null;
  }

  const sourceUrl = `https://www.youtube.com/watch?v=${videoId}`;
  return {
    videoId,
    sourceUrl,
    embedUrl: `${EMBED_BASE}${videoId}`,
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
  };
}

export function youtubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}
