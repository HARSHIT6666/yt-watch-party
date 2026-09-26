const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export function extractVideoId(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const input = value.trim();
  if (VIDEO_ID.test(input)) return input;
  try {
    const url = new URL(input);
    if (url.hostname === 'youtu.be') return url.pathname.slice(1).split('/')[0].match(VIDEO_ID)?.[0] ?? null;
    if (url.hostname.endsWith('youtube.com')) {
      const candidate = url.searchParams.get('v') || url.pathname.match(/\/(?:embed|shorts|v)\/([^/?]+)/)?.[1];
      return candidate && VIDEO_ID.test(candidate) ? candidate : null;
    }
  } catch { return null; }
  return null;
}
