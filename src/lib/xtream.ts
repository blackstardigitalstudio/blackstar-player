import type { Category, Episode, LoadedContent, MediaItem, Season, SourceConfig } from './types';

/** Ordered, de-duplicated list of DNS hosts to try (active host first). */
export function candidateHosts(c: SourceConfig): string[] {
  const all = (c.hosts && c.hosts.length ? c.hosts : c.host ? [c.host] : [])
    .map((h) => normalizeHost(h))
    .filter(Boolean);
  const active = c.host ? normalizeHost(c.host) : '';
  const ordered = active ? [active, ...all.filter((h) => h !== active)] : all;
  return Array.from(new Set(ordered));
}

/** Probe each DNS host and return the first that authenticates. */
export async function pickWorkingHost(c: SourceConfig): Promise<{ host: string; name: string }> {
  const hosts = candidateHosts(c);
  if (!hosts.length) throw new Error('Inserisci almeno un DNS server.');
  for (const host of hosts) {
    try {
      const info = await xtreamLogin({ ...c, host });
      return { host, name: info.name };
    } catch {
      // try next DNS
    }
  }
  throw new Error('Nessun DNS funzionante con queste credenziali.');
}

/** Load content, switching DNS host until one works. Returns the working host. */
export async function loadXtreamFailover(
  c: SourceConfig,
  liveExt = 'ts',
): Promise<{ content: LoadedContent; host: string }> {
  const hosts = candidateHosts(c);
  for (const host of hosts) {
    try {
      await xtreamLogin({ ...c, host });
      const content = await loadXtream({ ...c, host }, liveExt);
      // Only accept a host that actually returned content; otherwise try next.
      if (content.live.length || content.movies.length || content.series.length) {
        return { content, host };
      }
    } catch {
      // try next DNS
    }
  }
  throw new Error('Impossibile caricare la lista: nessun DNS risponde.');
}

export function normalizeHost(input: string): string {
  let h = input.trim();
  if (!h) return h;
  if (!/^https?:\/\//i.test(h)) h = 'http://' + h;
  return h.replace(/\/+$/, '');
}

/** fetch with a hard timeout so a dead DNS fails fast and failover can proceed. */
async function fetchT(url: string, ms = 8000): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { headers: { 'User-Agent': 'BlackstarPlayer' }, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

function apiBase(c: SourceConfig) {
  const host = normalizeHost(c.host || '');
  return `${host}/player_api.php?username=${encodeURIComponent(c.username || '')}&password=${encodeURIComponent(
    c.password || '',
  )}`;
}

async function api<T>(c: SourceConfig, action: string, extra = ''): Promise<T> {
  const url = `${apiBase(c)}&action=${action}${extra}`;
  const res = await fetchT(url);
  if (!res.ok) throw new Error(`Server Xtream: HTTP ${res.status}`);
  const txt = await res.text();
  if (!txt) return [] as unknown as T;
  try {
    return JSON.parse(txt) as T;
  } catch {
    throw new Error('Risposta non valida dal server Xtream');
  }
}

/** Verify the three factors. Throws a friendly error if login fails. */
export async function xtreamLogin(c: SourceConfig): Promise<{ name: string; expDate?: string }> {
  const host = normalizeHost(c.host || '');
  const url = `${host}/player_api.php?username=${encodeURIComponent(c.username || '')}&password=${encodeURIComponent(
    c.password || '',
  )}`;
  const res = await fetchT(url);
  if (!res.ok) throw new Error(`Connessione fallita (HTTP ${res.status}). Controlla il DNS server.`);
  const data = await res.json().catch(() => null);
  const auth = data?.user_info?.auth;
  if (!data || auth === 0 || auth === '0') {
    throw new Error('Username o password non validi.');
  }
  return {
    name: data.user_info?.username || c.username || 'Xtream',
    expDate: data.user_info?.exp_date,
  };
}

const liveUrl = (c: SourceConfig, id: string | number, ext = 'ts') =>
  `${normalizeHost(c.host || '')}/live/${encodeURIComponent(c.username || '')}/${encodeURIComponent(
    c.password || '',
  )}/${id}.${ext}`;

const movieUrl = (c: SourceConfig, id: string | number, ext = 'mp4') =>
  `${normalizeHost(c.host || '')}/movie/${encodeURIComponent(c.username || '')}/${encodeURIComponent(
    c.password || '',
  )}/${id}.${ext}`;

export const seriesEpUrl = (c: SourceConfig, id: string | number, ext = 'mp4') =>
  `${normalizeHost(c.host || '')}/series/${encodeURIComponent(c.username || '')}/${encodeURIComponent(
    c.password || '',
  )}/${id}.${ext}`;

/** Rebuild a live url with a different container (used by "survival mode"). */
export function rebuildLiveUrl(c: SourceConfig, streamId: string, ext: string) {
  return liveUrl(c, streamId, ext);
}

export async function loadXtream(c: SourceConfig, liveExt = 'ts'): Promise<LoadedContent> {
  const [liveCats, vodCats, serCats] = await Promise.all([
    api<any[]>(c, 'get_live_categories').catch(() => []),
    api<any[]>(c, 'get_vod_categories').catch(() => []),
    api<any[]>(c, 'get_series_categories').catch(() => []),
  ]);

  const categories: Category[] = [
    ...liveCats.map((x) => ({ id: `live:${x.category_id}`, name: x.category_name, kind: 'live' as const })),
    ...vodCats.map((x) => ({ id: `movie:${x.category_id}`, name: x.category_name, kind: 'movie' as const })),
    ...serCats.map((x) => ({ id: `series:${x.category_id}`, name: x.category_name, kind: 'series' as const })),
  ];
  const catName = (kind: string, id: any) =>
    categories.find((c2) => c2.id === `${kind}:${id}`)?.name;

  const [liveRaw, vodRaw, serRaw] = await Promise.all([
    api<any[]>(c, 'get_live_streams').catch(() => []),
    api<any[]>(c, 'get_vod_streams').catch(() => []),
    api<any[]>(c, 'get_series').catch(() => []),
  ]);

  const live: MediaItem[] = liveRaw.map((x, i) => ({
    id: `live:${x.stream_id}`,
    kind: 'live',
    name: x.name,
    logo: x.stream_icon || undefined,
    streamId: String(x.stream_id),
    url: liveUrl(c, x.stream_id, liveExt),
    number: Number(x.num) || i + 1,
    tvgId: x.epg_channel_id || undefined,
    categoryId: x.category_id ? `live:${x.category_id}` : undefined,
    categoryName: catName('live', x.category_id),
  }));

  const movies: MediaItem[] = vodRaw.map((x) => ({
    id: `movie:${x.stream_id}`,
    kind: 'movie',
    name: x.name,
    logo: x.stream_icon || x.cover || x.cover_big || x.movie_image || undefined,
    streamId: String(x.stream_id),
    containerExt: x.container_extension || 'mp4',
    url: movieUrl(c, x.stream_id, x.container_extension || 'mp4'),
    rating: x.rating || undefined,
    year: x.year || undefined,
    categoryId: x.category_id ? `movie:${x.category_id}` : undefined,
    categoryName: catName('movie', x.category_id),
  }));

  const series: MediaItem[] = serRaw.map((x) => ({
    id: `series:${x.series_id}`,
    kind: 'series',
    name: x.name,
    logo: x.cover || x.cover_big || x.stream_icon || undefined,
    seriesId: String(x.series_id),
    plot: x.plot || undefined,
    rating: x.rating || undefined,
    year: x.year || x.releaseDate || undefined,
    categoryId: x.category_id ? `series:${x.category_id}` : undefined,
    categoryName: catName('series', x.category_id),
  }));

  return { live, movies, series, categories, loadedAt: Date.now() };
}

/** Lazily resolve seasons/episodes for a series. */
export async function loadSeriesInfo(c: SourceConfig, seriesId: string): Promise<Season[]> {
  const data = await api<any>(c, 'get_series_info', `&series_id=${encodeURIComponent(seriesId)}`);
  const eps = data?.episodes || {};
  const seasons: Season[] = [];
  for (const key of Object.keys(eps).sort((a, b) => Number(a) - Number(b))) {
    const list: Episode[] = (eps[key] || []).map((e: any) => ({
      id: String(e.id),
      title: e.title || `Episodio ${e.episode_num}`,
      season: Number(key),
      episode: Number(e.episode_num) || 0,
      url: seriesEpUrl(c, e.id, e.container_extension || 'mp4'),
      plot: e.info?.plot,
      duration: e.info?.duration,
      still: e.info?.movie_image,
    }));
    seasons.push({ season: Number(key), episodes: list });
  }
  return seasons;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function atobPoly(input: string): string {
  const str = input.replace(/=+$/, '');
  let out = '';
  let bc = 0;
  let bs = 0;
  for (let i = 0; i < str.length; i++) {
    const c = B64.indexOf(str.charAt(i));
    if (c < 0) continue;
    bs = bc % 4 ? bs * 64 + c : c;
    if (bc++ % 4) out += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)));
  }
  return out;
}
function decodeEpg(s: string): string {
  if (!s) return '';
  try {
    return decodeURIComponent(escape(atobPoly(s)));
  } catch {
    try {
      return atobPoly(s);
    } catch {
      return s;
    }
  }
}

export interface EpgItem {
  title: string;
  description: string;
  startTs: number;
  endTs: number;
}

/** Short EPG (now + next programs) for a live stream. */
export async function getShortEpg(c: SourceConfig, streamId: string, limit = 4): Promise<EpgItem[]> {
  try {
    const data = await api<any>(c, 'get_short_epg', `&stream_id=${encodeURIComponent(streamId)}&limit=${limit}`);
    const list = data?.epg_listings || [];
    return list.map((e: any) => ({
      title: decodeEpg(e.title || ''),
      description: decodeEpg(e.description || ''),
      startTs: Number(e.start_timestamp) || 0,
      endTs: Number(e.stop_timestamp) || 0,
    }));
  } catch {
    return [];
  }
}
