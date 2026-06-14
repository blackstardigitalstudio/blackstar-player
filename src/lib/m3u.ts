import type { Category, LoadedContent, MediaItem, MediaKind } from './types';

const ATTR = /([\w-]+)="([^"]*)"/g;

function parseAttrs(line: string): Record<string, string> {
  const out: Record<string, string> = {};
  let m: RegExpExecArray | null;
  ATTR.lastIndex = 0;
  while ((m = ATTR.exec(line))) out[m[1].toLowerCase()] = m[2];
  return out;
}

const SERIES_TAG = /\b(s\d{1,2})\s?[ex]\s?(\d{1,3})\b|\b(\d{1,2})x(\d{1,3})\b/i;
const VOD_HINT = /\/(movie|movies|vod|film)\//i;
const SERIES_HINT = /\/(series|serie|tv[\s_-]?show)/i;

function classify(group: string, name: string, url: string): MediaKind {
  const g = group.toLowerCase();
  if (SERIES_HINT.test(url) || /serie|series|stagione|season/.test(g)) return 'series';
  if (SERIES_TAG.test(name)) return 'series';
  if (VOD_HINT.test(url) || /\b(film|movie|cinema|vod)\b/.test(g)) return 'movie';
  // file extension heuristic: VOD usually .mp4/.mkv, live usually .ts/.m3u8 or no ext
  if (/\.(mp4|mkv|avi)(\?|$)/i.test(url)) return 'movie';
  return 'live';
}

/** Strip "S01E02"-style tags to derive a series base title. */
export function seriesBaseName(name: string): string {
  return name
    .replace(SERIES_TAG, '')
    .replace(/[\s._-]+$/g, '')
    .replace(/\(?\b(19|20)\d{2}\b\)?$/, '')
    .trim() || name;
}

export function parseM3U(raw: string): LoadedContent {
  const text = raw.replace(/\r/g, '');
  const lines = text.split('\n');
  const live: MediaItem[] = [];
  const movies: MediaItem[] = [];
  const series: MediaItem[] = [];
  const seriesSeen = new Map<string, MediaItem>();
  const cats = new Map<string, Category>();

  let pending: Partial<MediaItem> | null = null;
  let liveCounter = 1;

  const addCat = (name: string, kind: MediaKind) => {
    if (!name) return undefined;
    const id = `${kind}:${name}`;
    if (!cats.has(id)) cats.set(id, { id, name, kind });
    return id;
  };

  for (let raw0 of lines) {
    const line = raw0.trim();
    if (!line) continue;
    if (line.startsWith('#EXTINF')) {
      const attrs = parseAttrs(line);
      const comma = line.lastIndexOf(',');
      const title = comma >= 0 ? line.slice(comma + 1).trim() : attrs['tvg-name'] || 'Senza nome';
      pending = {
        name: title,
        logo: attrs['tvg-logo'] || undefined,
        tvgId: attrs['tvg-id'] || undefined,
        group: attrs['group-title'] || undefined,
      };
    } else if (line.startsWith('#EXTGRP')) {
      const g = line.split(':')[1]?.trim();
      if (pending && g) pending.group = g;
    } else if (line.startsWith('#')) {
      continue;
    } else if (pending) {
      const url = line;
      const group = pending.group || '';
      const name = pending.name || 'Senza nome';
      const kind = classify(group, name, url);
      const categoryId = addCat(group, kind);
      const base: MediaItem = {
        id: `${kind}:${url}`,
        kind,
        name,
        url,
        logo: pending.logo,
        tvgId: pending.tvgId,
        group,
        categoryId,
        categoryName: group || undefined,
      };
      if (kind === 'live') {
        base.number = liveCounter++;
        live.push(base);
      } else if (kind === 'movie') {
        movies.push(base);
      } else {
        // collapse episodes into one series entry; keep first as representative
        const key = `series:${seriesBaseName(name)}:${group}`;
        if (!seriesSeen.has(key)) {
          const s: MediaItem = { ...base, id: key, name: seriesBaseName(name), url: undefined };
          seriesSeen.set(key, s);
          series.push(s);
        }
        // attach raw episode url list for later resolution
        const s = seriesSeen.get(key)!;
        (s as any)._eps = (s as any)._eps || [];
        (s as any)._eps.push({ name, url });
      }
      pending = null;
    }
  }

  return {
    live,
    movies,
    series,
    categories: Array.from(cats.values()),
    loadedAt: Date.now(),
  };
}

/** Resolve episodes for an M3U series item (parsed from the collapsed _eps list). */
export function m3uEpisodes(item: MediaItem) {
  const raw: { name: string; url: string }[] = (item as any)._eps || [];
  return raw.map((e, i) => {
    const m = e.name.match(SERIES_TAG);
    const season = m ? Number(m[1] ? m[1].replace(/\D/g, '') : m[3]) || 1 : 1;
    const episode = m ? Number(m[2] || m[4]) || i + 1 : i + 1;
    return {
      id: `${item.id}:${i}`,
      title: e.name,
      season,
      episode,
      url: e.url,
    };
  });
}
