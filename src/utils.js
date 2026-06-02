export function normalizeText(text = '') {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function scoreMatch(query, item) {
  const q = normalizeText(query);
  if (!q) return 0;
  const haystack = normalizeText([
    item.title,
    item.artist,
    item.source,
    ...(item.keywords || [])
  ].filter(Boolean).join(' '));
  if (!haystack) return 0;
  if (haystack === q) return 100;
  if (haystack.includes(q)) return 80;
  const words = q.split(' ').filter(Boolean);
  const hits = words.filter(w => haystack.includes(w)).length;
  return Math.round((hits / Math.max(words.length, 1)) * 60);
}

export function absoluteUrl(req, path) {
  const envBase = process.env.PUBLIC_BASE_URL?.replace(/\/$/, '');
  if (envBase) return `${envBase}${path}`;
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}${path}`;
}

export function cleanId(text = '') {
  return String(text).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
}

export function isProbablyAudioUrl(url = '') {
  try {
    const u = new URL(url);
    return ['http:', 'https:'].includes(u.protocol);
  } catch {
    return false;
  }
}
