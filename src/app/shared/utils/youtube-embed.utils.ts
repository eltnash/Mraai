export interface ParsedYoutubeEmbed {
  videoId: string;
  sourceUrl: string;
  embedUrl: string;
  thumbnailUrl: string;
}

const EMBED_BASE = 'https://www.youtube-nocookie.com/embed/';

export function parseYoutubeUrl(raw: string): ParsedYoutubeEmbed | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  let videoId: string | null = null;

  try {
    const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
    const host = url.hostname.replace(/^www\./, '');

    if (host === 'youtu.be') {
      videoId = url.pathname.split('/').filter(Boolean)[0] ?? null;
    } else if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (url.pathname === '/watch') {
        videoId = url.searchParams.get('v');
      } else if (url.pathname.startsWith('/embed/')) {
        videoId = url.pathname.split('/')[2] ?? null;
      } else if (url.pathname.startsWith('/shorts/')) {
        videoId = url.pathname.split('/')[2] ?? null;
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
