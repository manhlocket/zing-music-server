// Adapter an toàn: server này KHÔNG tự bẻ khóa hay vượt DRM.
// Nếu bạn đã có API hợp lệ như nvhung9/mp3-api hoặc server riêng, đặt env ZING_API_BASE/NCT_API_BASE/SOUNDCLOUD_API_BASE.
// Ví dụ ZING_API_BASE=https://your-zing-api.onrender.com

async function fetchJson(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function normalizeResult(raw, sourceName) {
  const id = raw.id || raw.encodeId || raw.songId || raw.sid || raw.key;
  const title = raw.title || raw.name || raw.song || 'Unknown title';
  const artist = raw.artist || raw.artistsNames || raw.singer || raw.author || sourceName;
  const streamUrl = raw.streamUrl || raw.url || raw.link || raw.audio || raw.src;
  if (!id && !streamUrl) return null;
  return {
    id: `${sourceName}:${id || Buffer.from(streamUrl).toString('base64url').slice(0, 24)}`,
    upstreamId: id,
    title,
    artist,
    source: sourceName,
    streamUrl,
    raw
  };
}

async function searchGeneric(base, sourceName, query, limit) {
  if (!base) return [];
  const cleanBase = base.replace(/\/$/, '');
  const urls = [
    `${cleanBase}/music/search?q=${encodeURIComponent(query)}&limit=${limit}`,
    `${cleanBase}/api/search?q=${encodeURIComponent(query)}&limit=${limit}`,
    `${cleanBase}/search?q=${encodeURIComponent(query)}&limit=${limit}`
  ];
  for (const url of urls) {
    try {
      const data = await fetchJson(url);
      const arr = data.items || data.data || data.results || data.songs || (Array.isArray(data) ? data : []);
      if (Array.isArray(arr) && arr.length) {
        return arr.map(x => normalizeResult(x, sourceName)).filter(Boolean).slice(0, limit);
      }
    } catch (_) {}
  }
  return [];
}

export async function searchUpstreams(query, limit = 10) {
  const all = [];
  const configs = [
    ['zing', process.env.ZING_API_BASE],
    ['nct', process.env.NCT_API_BASE],
    ['soundcloud', process.env.SOUNDCLOUD_API_BASE]
  ];
  for (const [name, base] of configs) {
    const results = await searchGeneric(base, name, query, limit);
    all.push(...results);
  }
  return all.slice(0, limit);
}

export async function resolveUpstream(item) {
  if (item.streamUrl) return item.streamUrl;
  const [sourceName, upstreamId] = String(item.id || '').split(':');
  const baseMap = {
    zing: process.env.ZING_API_BASE,
    nct: process.env.NCT_API_BASE,
    soundcloud: process.env.SOUNDCLOUD_API_BASE
  };
  const base = baseMap[sourceName]?.replace(/\/$/, '');
  if (!base || !upstreamId) return null;

  const urls = [
    `${base}/music/play?id=${encodeURIComponent(upstreamId)}`,
    `${base}/api/song?id=${encodeURIComponent(upstreamId)}`,
    `${base}/api/song/stream?id=${encodeURIComponent(upstreamId)}`,
    `${base}/song?id=${encodeURIComponent(upstreamId)}`
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { method: 'GET', redirect: 'manual' });
      const loc = res.headers.get('location');
      if (loc) return loc;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('audio') || contentType.includes('mpeg')) return url;
      if (contentType.includes('json')) {
        const data = await res.json();
        const direct = data.url || data.streamUrl || data.audio || data.src || data.data?.url || data.data?.streamUrl;
        if (direct) return direct;
      }
    } catch (_) {}
  }
  return null;
}
