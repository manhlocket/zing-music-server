import fs from 'fs/promises';
import path from 'path';
import { scoreMatch } from '../utils.js';

const MUSIC_DIR = path.join(process.cwd(), 'public', 'music');
const CATALOG_PATH = path.join(MUSIC_DIR, 'catalog.json');

export async function loadLocalCatalog(req) {
  try {
    const raw = await fs.readFile(CATALOG_PATH, 'utf8');
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.map((item, idx) => ({
      id: item.id || `local-${idx}`,
      title: item.title || item.file || `Local song ${idx + 1}`,
      artist: item.artist || 'Local',
      file: item.file,
      url: item.url,
      keywords: item.keywords || [],
      source: 'local'
    })) : [];
  } catch {
    return [];
  }
}

export async function searchLocal(query, req, limit = 10) {
  const catalog = await loadLocalCatalog(req);
  return catalog
    .map(item => ({ ...item, score: scoreMatch(query, item) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export async function getLocalById(id, req) {
  const catalog = await loadLocalCatalog(req);
  return catalog.find(item => item.id === id);
}
