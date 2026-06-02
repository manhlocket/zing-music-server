const DEFAULT_TIMEOUT_MS = Number(process.env.API_TIMEOUT_MS || 9000);

const COIN_ID_MAP = {
  btc: 'bitcoin', bitcoin: 'bitcoin',
  eth: 'ethereum', ethereum: 'ethereum',
  bnb: 'binancecoin', sol: 'solana', solana: 'solana',
  xrp: 'ripple', doge: 'dogecoin', dogecoin: 'dogecoin',
  ton: 'the-open-network', ada: 'cardano', cardano: 'cardano',
  usdt: 'tether', usdc: 'usd-coin'
};

const WEATHER_CODE_VI = {
  0: 'Trời quang', 1: 'Ít mây', 2: 'Mây rải rác', 3: 'Nhiều mây',
  45: 'Sương mù', 48: 'Sương mù đóng băng',
  51: 'Mưa phùn nhẹ', 53: 'Mưa phùn vừa', 55: 'Mưa phùn dày',
  61: 'Mưa nhỏ', 63: 'Mưa vừa', 65: 'Mưa to',
  71: 'Tuyết nhẹ', 73: 'Tuyết vừa', 75: 'Tuyết dày',
  80: 'Mưa rào nhẹ', 81: 'Mưa rào vừa', 82: 'Mưa rào mạnh',
  95: 'Dông', 96: 'Dông kèm mưa đá nhẹ', 99: 'Dông kèm mưa đá mạnh'
};

export function listTools(req) {
  const base = `${req.protocol}://${req.get('host')}`;
  return {
    ok: true,
    name: 'Xiaozhi Tools API',
    endpoints: [
      `${base}/api/gold?type=SJL1L10`,
      `${base}/api/lottery/xsmb`,
      `${base}/api/weather?city=Hanoi`,
      `${base}/api/coin?symbol=BTC`,
      `${base}/api/news?category=thoi-su&limit=5`,
      `${base}/api/speak?q=gia%20vang`,
      `${base}/api/assistant?q=thoi%20tiet%20ha%20noi`
    ],
    env: {
      GOLD_API_BASE: process.env.GOLD_API_BASE || 'https://www.vang.today',
      COINGECKO_API_BASE: process.env.COINGECKO_API_BASE || 'https://api.coingecko.com/api/v3',
      LOTTERY_RSS_URL: process.env.LOTTERY_RSS_URL || 'https://xskt.com.vn/rss-feed/mien-bac-xsmb.rss',
      NEWS_RSS_BASE: process.env.NEWS_RSS_BASE || 'VnExpress RSS defaults'
    }
  };
}

export async function getGold(type = 'SJL1L10') {
  const safeType = String(type || 'SJL1L10').trim().toUpperCase();
  const base = (process.env.GOLD_API_BASE || 'https://www.vang.today').replace(/\/$/, '');
  const url = `${base}/api/prices?type=${encodeURIComponent(safeType)}`;
  const data = await fetchJson(url);
  return {
    ok: true,
    source: 'vang.today',
    type: safeType,
    updated_at: data?.updated_at || data?.updatedAt || data?.time || new Date().toISOString(),
    raw: data,
    text: summarizeGold(data, safeType)
  };
}

function summarizeGold(data, type) {
  const rows = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : Array.isArray(data?.prices) ? data.prices : [];
  const first = rows.find(x => String(x?.type || x?.code || '').toUpperCase() === type) || rows[0] || data;
  const name = first?.name || first?.type || first?.code || type;
  const buy = first?.buy || first?.buyPrice || first?.bid || first?.mua || first?.purchase;
  const sell = first?.sell || first?.sellPrice || first?.ask || first?.ban || first?.selling;
  if (buy || sell) return `Giá vàng ${name}: mua vào ${formatNumber(buy)}, bán ra ${formatNumber(sell)}.`;
  return `Đã lấy dữ liệu giá vàng loại ${type}, nhưng định dạng nguồn có thể đã thay đổi. Xem trường raw.`;
}

export async function getWeather(city = 'Hanoi') {
  const q = String(city || 'Hanoi').trim();
  const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=vi&format=json`;
  const geo = await fetchJson(geoUrl);
  const place = geo?.results?.[0];
  if (!place) throw new Error(`Không tìm thấy thành phố: ${q}`);

  const vars = 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m';
  const daily = 'temperature_2m_max,temperature_2m_min,precipitation_probability_max';
  const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=${vars}&daily=${daily}&timezone=auto&forecast_days=3`;
  const weather = await fetchJson(forecastUrl);
  const current = weather.current || {};
  const code = current.weather_code;
  const text = `Thời tiết ${place.name}: ${WEATHER_CODE_VI[code] || 'không rõ'}, ${current.temperature_2m}°C, cảm giác như ${current.apparent_temperature}°C, độ ẩm ${current.relative_humidity_2m}%, gió ${current.wind_speed_10m} km/h.`;
  return { ok: true, source: 'open-meteo', city: place.name, country: place.country, latitude: place.latitude, longitude: place.longitude, current, daily: weather.daily, text };
}

export async function getCoin(symbol = 'BTC', vs = 'usd,vnd') {
  const key = String(symbol || 'BTC').trim().toLowerCase();
  const id = COIN_ID_MAP[key] || key;
  const currencies = String(vs || 'usd,vnd').toLowerCase().replace(/[^a-z,]/g, '') || 'usd,vnd';
  const base = (process.env.COINGECKO_API_BASE || 'https://api.coingecko.com/api/v3').replace(/\/$/, '');
  const url = `${base}/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=${encodeURIComponent(currencies)}&include_24hr_change=true&include_last_updated_at=true`;
  const data = await fetchJson(url, optionalHeaders({ 'x-cg-demo-api-key': process.env.COINGECKO_API_KEY }));
  const item = data?.[id];
  if (!item) throw new Error(`Không tìm thấy coin: ${symbol}`);
  const parts = currencies.split(',').map(c => `${c.toUpperCase()} ${formatNumber(item[c])}`).join(', ');
  const change = item.usd_24h_change != null ? `, 24h ${Number(item.usd_24h_change).toFixed(2)}%` : '';
  return { ok: true, source: 'coingecko', id, symbol: key.toUpperCase(), price: item, text: `${key.toUpperCase()} hiện khoảng ${parts}${change}.` };
}

export async function getLotteryXSMB() {
  const custom = process.env.LOTTERY_API_URL;
  if (custom) {
    const data = await fetchJson(custom);
    return { ok: true, source: custom, raw: data, text: summarizeLottery(data) };
  }

  const rssUrl = process.env.LOTTERY_RSS_URL || 'https://xskt.com.vn/rss-feed/mien-bac-xsmb.rss';
  const xml = await fetchText(rssUrl);
  const items = parseRssItems(xml);
  const first = items[0];
  if (!first) throw new Error('Không đọc được RSS XSMB');
  return {
    ok: true,
    source: rssUrl,
    title: first.title,
    link: first.link,
    published_at: first.pubDate,
    description: stripHtml(first.description).replace(/\s+/g, ' ').trim(),
    text: stripHtml(`${first.title}. ${first.description}`).replace(/\s+/g, ' ').trim()
  };
}

function summarizeLottery(data) {
  const db = data?.special || data?.db || data?.gdb || data?.data?.special || data?.data?.db;
  if (db) return `Kết quả XSMB: giải đặc biệt ${db}.`;
  return 'Đã lấy dữ liệu xổ số, xem trường raw vì định dạng nguồn khác nhau.';
}

export async function getNews(category = 'thoi-su', limit = 5) {
  const map = {
    'thoi-su': 'https://vnexpress.net/rss/thoi-su.rss',
    'the-gioi': 'https://vnexpress.net/rss/the-gioi.rss',
    'kinh-doanh': 'https://vnexpress.net/rss/kinh-doanh.rss',
    'cong-nghe': 'https://vnexpress.net/rss/so-hoa.rss',
    'giai-tri': 'https://vnexpress.net/rss/giai-tri.rss',
    'suc-khoe': 'https://vnexpress.net/rss/suc-khoe.rss',
    'giao-duc': 'https://vnexpress.net/rss/giao-duc.rss',
    'tin-moi': 'https://vnexpress.net/rss/tin-moi-nhat.rss'
  };
  const rssUrl = process.env.NEWS_RSS_URL || map[String(category || 'thoi-su')] || map['thoi-su'];
  const xml = await fetchText(rssUrl);
  const items = parseRssItems(xml).slice(0, Math.min(Number(limit || 5), 20)).map(item => ({
    title: item.title,
    link: item.link,
    published_at: item.pubDate,
    description: stripHtml(item.description).replace(/\s+/g, ' ').trim()
  }));
  return { ok: true, source: rssUrl, category, count: items.length, items, text: items.map((x, i) => `${i + 1}. ${x.title}`).join(' ') };
}

export async function answerToolQuery(q) {
  const text = removeVietnameseTones(String(q || '').toLowerCase());
  if (/gia vang|vang|sjc|doji|pnj/.test(text)) return await getGold(text.includes('doji') ? 'DOHNL' : 'SJL1L10');
  if (/xsmb|xo so|xổ số|so xo|mien bac/.test(text)) return await getLotteryXSMB();
  if (/thoi tiet|weather|nhiet do|mua gio/.test(text)) {
    const city = extractCity(q) || 'Hanoi';
    return await getWeather(city);
  }
  if (/btc|bitcoin|eth|ethereum|coin|crypto|ti gia coin|gia coin/.test(text)) {
    const symbol = (String(q).match(/\b(BTC|ETH|BNB|SOL|XRP|DOGE|TON|ADA|USDT|USDC)\b/i)?.[1]) || 'BTC';
    return await getCoin(symbol);
  }
  if (/tin tuc|news|bao|thoi su|cong nghe/.test(text)) return await getNews(text.includes('cong nghe') ? 'cong-nghe' : 'tin-moi', 5);
  return { ok: false, error: 'Chưa hiểu câu hỏi. Hỗ trợ: giá vàng, XSMB, thời tiết, coin, tin tức.' };
}

function extractCity(q) {
  const s = String(q || '');
  const m = s.match(/(?:ở|tai|tại|city=|weather in)\s+([^,?.!]+)/i);
  return m?.[1]?.trim();
}

async function fetchJson(url, headers = {}) {
  const text = await fetchText(url, headers);
  try { return JSON.parse(text); } catch { throw new Error(`Nguồn không trả JSON hợp lệ: ${url}`); }
}

async function fetchText(url, headers = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 XiaozhiTools/1.0', 'Accept': '*/*', ...headers },
      signal: controller.signal,
      redirect: 'follow'
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} từ ${url}`);
    return await res.text();
  } finally { clearTimeout(timer); }
}

function parseRssItems(xml) {
  return [...String(xml).matchAll(/<item[\s\S]*?<\/item>/gi)].map(m => {
    const item = m[0];
    return {
      title: decodeXml(pickTag(item, 'title')),
      link: decodeXml(pickTag(item, 'link')),
      pubDate: decodeXml(pickTag(item, 'pubDate')),
      description: decodeXml(pickTag(item, 'description'))
    };
  });
}

function pickTag(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = String(xml).match(re);
  return match ? match[1].replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim() : '';
}

function stripHtml(s) { return String(s || '').replace(/<[^>]+>/g, ' '); }
function decodeXml(s) {
  return String(s || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}
function formatNumber(v) {
  if (v == null || v === '') return 'không rõ';
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(n)) return String(v);
  return new Intl.NumberFormat('vi-VN').format(n);
}
function optionalHeaders(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([,v]) => v));
}
function removeVietnameseTones(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
}
