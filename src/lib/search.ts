import type { MediaItem } from './types';

const STOP = new Set(['the', 'a', 'an', 'il', 'lo', 'la', 'i', 'gli', 'le', 'di', 'e', 'season', 'stagione', 'hd', 'fhd', 'sd', '4k', 'vip']);

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(s: string): string[] {
  return normalize(s)
    .split(' ')
    .filter((t) => t.length > 1 && !STOP.has(t));
}

function score(query: string, item: MediaItem): number {
  const n = normalize(item.name);
  const q = normalize(query);
  if (!q) return 0;
  if (n === q) return 1000;
  if (n.startsWith(q)) return 700 + Math.max(0, 60 - n.length);
  const words = n.split(' ');
  if (words.some((w) => w.startsWith(q))) return 500;
  if (n.includes(q)) return 300 + Math.max(0, 40 - n.indexOf(q));
  // token overlap (handles word order)
  const qt = tokens(query);
  const it = new Set(tokens(item.name));
  const overlap = qt.filter((t) => it.has(t)).length;
  if (overlap) return 120 * overlap;
  return 0;
}

export interface SearchResult {
  item: MediaItem;
  score: number;
}

export function searchItems(query: string, items: MediaItem[], limit = 60): SearchResult[] {
  const q = query.trim();
  if (q.length < 2) return [];
  const out: SearchResult[] = [];
  for (const item of items) {
    const s = score(q, item);
    if (s > 0) out.push({ item, score: s });
  }
  out.sort((a, b) => b.score - a.score || a.item.name.length - b.item.name.length);
  return out.slice(0, limit);
}

/** Autocomplete-style suggestions: distinct titles that match the typed prefix. */
export function suggestTitles(query: string, items: MediaItem[], limit = 8): string[] {
  const q = normalize(query);
  if (q.length < 2) return [];
  const seen = new Set<string>();
  const ranked = searchItems(query, items, 200);
  const out: string[] = [];
  for (const r of ranked) {
    const key = normalize(r.item.name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r.item.name);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Related-title recommendations for a given item.
 * Combines same-category items with shared-keyword titles (e.g. franchises).
 */
export function relatedItems(target: MediaItem, pool: MediaItem[], limit = 20): MediaItem[] {
  const tt = new Set(tokens(target.name));
  const scored: { item: MediaItem; s: number }[] = [];
  for (const item of pool) {
    if (item.id === target.id) continue;
    let s = 0;
    if (item.categoryId && item.categoryId === target.categoryId) s += 4;
    else if (item.categoryName && item.categoryName === target.categoryName) s += 3;
    if (item.kind === target.kind) s += 1;
    const overlap = tokens(item.name).filter((t) => tt.has(t)).length;
    s += overlap * 3;
    if (s > 0) scored.push({ item, s });
  }
  scored.sort((a, b) => b.s - a.s);
  return scored.slice(0, limit).map((x) => x.item);
}

/** "Because you watched"-style picks derived from recent items. */
export function recommendFromRecents(recents: MediaItem[], pool: MediaItem[], limit = 20): MediaItem[] {
  if (!recents.length) return [];
  const out: MediaItem[] = [];
  const seen = new Set(recents.map((r) => r.id));
  for (const r of recents.slice(0, 4)) {
    for (const rel of relatedItems(r, pool, 8)) {
      if (seen.has(rel.id)) continue;
      seen.add(rel.id);
      out.push(rel);
      if (out.length >= limit) return out;
    }
  }
  return out;
}
