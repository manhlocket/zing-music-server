import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { absoluteUrl, cleanId, isProbablyAudioUrl } from './src/utils.js';
import { searchLocal, getLocalById } from './src/sources/local.js';
import { searchUpstreams, resolveUpstream } from './src/sources/upstream.js';
import { listTools, getGold, getWeather, getCoin, getLotteryXSMB, getNews, answerToolQuery } from './src/tools.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 5555;
const memoryResults = new Map();

app.use(cors());
app.use(morgan('tiny'));
app.use(express.json({ limit: '2mb' }));
app.use('/music-files', express.static(path.join(__dirname, 'public', 'music'), {
  setHeaders(res) {
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=3600');
  }
}));

app.get('/', (req, res) => {
  res.json({
    ok: true,
    name: 'Xiaozhi Music Server',
    endpoints: [
      '/health',
      '/music/search?q=lac%20troi',
      '/music/play?q=lac%20troi',
      '/music/stream/:id',
      '/music/proxy?url=https://example.com/song.mp3',
      '/api/tools',
      '/api/gold?type=SJL1L10',
      '/api/lottery/xsmb',
      '/api/weather?city=Hanoi',
      '/api/coin?symbol=BTC',
      '/api/news?category=tin-moi',
      '/api/assistant?q=gia%20vang'
    ],
    note: 'Use direct MP3/local library/your legal upstream API. No demo wake-up fallback.'
  });
});

app.get('/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString(), port: PORT });
});

app.get('/debug/music-sources', asyncRoute(async (req, res) => {
  const local = await searchLocal('demo test lac troi', req, 10);
  res.json({
    ok: true,
    hasZingApiBase: Boolean(process.env.ZING_API_BASE),
    hasNctApiBase: Boolean(process.env.NCT_API_BASE),
    hasSoundCloudApiBase: Boolean(process.env.SOUNDCLOUD_API_BASE),
    publicBaseUrl: process.env.PUBLIC_BASE_URL || null,
    localCountForDebugQuery: local.length,
    message: 'Nếu tất cả has...ApiBase là false và chưa thêm MP3 vào public/music/catalog.json thì /music/play sẽ không có nhạc thật.'
  });
}));


function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

app.get('/api/tools', (req, res) => res.json(listTools(req)));

app.get('/api/gold', asyncRoute(async (req, res) => {
  const data = await getGold(req.query.type || 'SJL1L10');
  res.json(data);
}));

app.get('/api/lottery/xsmb', asyncRoute(async (req, res) => {
  const data = await getLotteryXSMB();
  res.json(data);
}));

app.get('/api/weather', asyncRoute(async (req, res) => {
  const data = await getWeather(req.query.city || req.query.q || 'Hanoi');
  res.json(data);
}));

app.get('/api/coin', asyncRoute(async (req, res) => {
  const data = await getCoin(req.query.symbol || req.query.id || 'BTC', req.query.vs || 'usd,vnd');
  res.json(data);
}));

app.get('/api/news', asyncRoute(async (req, res) => {
  const data = await getNews(req.query.category || 'tin-moi', req.query.limit || 5);
  res.json(data);
}));

app.get('/api/speak', asyncRoute(async (req, res) => {
  const data = await answerToolQuery(req.query.q || '');
  res.json({ ok: data.ok !== false, text: data.text || data.error || 'Không có dữ liệu', data });
}));

app.get('/api/assistant', asyncRoute(async (req, res) => {
  const data = await answerToolQuery(req.query.q || '');
  res.json({ ok: data.ok !== false, intent_result: data, reply: data.text || data.error || 'Không có dữ liệu' });
}));

app.get('/music/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const limit = Math.min(Number(req.query.limit || 10), 30);
  if (!q) return res.status(400).json({ ok: false, error: 'Missing q' });

  const local = await searchLocal(q, req, limit);
  const upstream = await searchUpstreams(q, limit);
  const items = [...local, ...upstream].slice(0, limit).map(item => {
    memoryResults.set(item.id, item);
    const stream = absoluteUrl(req, `/music/stream/${encodeURIComponent(item.id)}`);
    return {
      id: item.id,
      title: item.title,
      artist: item.artist,
      source: item.source,
      stream,
      url: stream
    };
  });

  res.json({ ok: true, q, count: items.length, items });
});

app.get('/music/play', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const direct = String(req.query.url || '').trim();

  if (direct) {
    if (!isProbablyAudioUrl(direct)) return res.status(400).json({ ok: false, error: 'Invalid url' });
    const url = absoluteUrl(req, `/music/proxy?url=${encodeURIComponent(direct)}`);
    return res.json({ ok: true, title: 'Direct URL', artist: 'URL', source: 'direct', url, stream: url });
  }

  if (!q) return res.status(400).json({ ok: false, error: 'Missing q or url' });

  const local = await searchLocal(q, req, 5);
  const upstream = await searchUpstreams(q, 5);
  const first = [...local, ...upstream][0];

  if (!first) {
    return res.status(404).json({
      ok: false,
      error: 'Không tìm thấy bài phù hợp. Server sẽ KHÔNG trả nhạc demo/wake-up thay thế.',
      q
    });
  }

  memoryResults.set(first.id, first);
  const url = absoluteUrl(req, `/music/stream/${encodeURIComponent(first.id)}`);
  res.json({
    ok: true,
    id: first.id,
    title: first.title,
    artist: first.artist,
    source: first.source,
    url,
    stream: url
  });
});

app.get('/music/stream/:id', async (req, res) => {
  const id = decodeURIComponent(req.params.id || '');
  let item = memoryResults.get(id) || await getLocalById(id, req);
  if (!item) return res.status(404).json({ ok: false, error: 'Song id not found. Search/play first.' });

  if (item.file) {
    const safeFile = path.basename(item.file);
    const filePath = path.join(__dirname, 'public', 'music', safeFile);
    try {
      await fs.access(filePath);
      return res.redirect(302, absoluteUrl(req, `/music-files/${encodeURIComponent(safeFile)}`));
    } catch {
      return res.status(404).json({ ok: false, error: `Local file missing: ${safeFile}` });
    }
  }

  let remote = item.url || item.streamUrl;
  if (!remote) remote = await resolveUpstream(item);
  if (!remote || !isProbablyAudioUrl(remote)) {
    return res.status(502).json({ ok: false, error: 'Upstream did not return a playable audio URL' });
  }
  return proxyAudio(req, res, remote);
});

app.get('/music/proxy', async (req, res) => {
  const url = String(req.query.url || '');
  if (!isProbablyAudioUrl(url)) return res.status(400).json({ ok: false, error: 'Invalid or missing url' });
  return proxyAudio(req, res, url);
});

async function proxyAudio(req, res, url) {
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 XiaozhiMusicServer/1.0',
      'Accept': '*/*'
    };
    if (req.headers.range) headers.Range = req.headers.range;

    const upstream = await fetch(url, { headers, redirect: 'follow' });
    if (!upstream.ok && upstream.status !== 206) {
      return res.status(502).json({ ok: false, error: `Upstream HTTP ${upstream.status}` });
    }

    const contentType = upstream.headers.get('content-type') || 'audio/mpeg';
    const contentLength = upstream.headers.get('content-length');
    const contentRange = upstream.headers.get('content-range');
    const acceptRanges = upstream.headers.get('accept-ranges') || 'bytes';

    res.status(upstream.status === 206 ? 206 : 200);
    res.setHeader('Content-Type', contentType.includes('audio') ? contentType : 'audio/mpeg');
    res.setHeader('Accept-Ranges', acceptRanges);
    res.setHeader('Cache-Control', 'no-store');
    if (contentLength) res.setHeader('Content-Length', contentLength);
    if (contentRange) res.setHeader('Content-Range', contentRange);

    if (!upstream.body) return res.end();
    const reader = upstream.body.getReader();
    req.on('close', () => reader.cancel().catch(() => {}));
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!res.write(Buffer.from(value))) {
        await new Promise(resolve => res.once('drain', resolve));
      }
    }
    res.end();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ ok: false, error: err.message || 'Proxy failed' });
    else res.end();
  }
}


app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ ok: false, error: err.message || 'Server error' });
});

app.listen(PORT, () => console.log(`Xiaozhi Music Server running on :${PORT}`));
