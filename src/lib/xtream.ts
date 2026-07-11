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
  if (!hosts.length) throw new Error('Inserisci almeno un DNS server.');
  let lastError: Error | null = null;
  let authedFallback: { content: LoadedContent; host: string } | null = null;
  for (const host of hosts) {
    try {
      await xtreamLogin({ ...c, host }); // throws with the real reason (auth / HTTP)
      const content = await loadXtream({ ...c, host }, liveExt);
      // Prefer a host that returned content, but remember one that at least
      // authenticated — login succeeding with an empty catalog must NOT read as
      // "login failed"; the user gets in and can refresh.
      if (content.live.length || content.movies.length || content.series.length) {
        return { content, host };
      }
      if (!authedFallback) authedFallback = { content, host };
    } catch (e: any) {
      const msg = e?.message || String(e);
      // Include the host that failed so the user (and support) can see exactly
      // what was tried — the #1 cause of "impossibile raggiungere" is a mistyped
      // DNS/port.
      lastError = new Error(`${msg}\n(${normalizeHost(host)})`);
      // try next DNS
    }
  }
  if (authedFallback) return authedFallback;
  // Surface the real reason (invalid credentials, HTTP error, timeout) so the
  // user knows what to fix — not a vague "impossibile".
  throw lastError || new Error('Nessun DNS funzionante con queste credenziali.');
}

export function normalizeHost(input: string): string {
  let h = (input || '').trim().replace(/\s+/g, '');
  if (!h) return h;
  if (!/^https?:\/\//i.test(h)) h = 'http://' + h;
  // Keep ONLY scheme + host + port. This way, whether the user types
  // "dns.xyz:8080", "http://dns.xyz:8080/", or even pastes the whole
  // "http://dns.xyz:8080/get.php?username=...", we always hit
  // "http://dns.xyz:8080/player_api.php" correctly.
  try {
    const u = new URL(h);
    return `${u.protocol}//${u.host}`;
  } catch {
    return h.replace(/\/+$/, '');
  }
}

/**
 * Fetch text with a hard timeout that covers the ENTIRE exchange — connect,
 * headers AND body. The old version cleared the timer as soon as headers
 * arrived, so a host that returned "200 OK" then stalled the body hung forever
 * and the multi-DNS failover never advanced. The abort stays armed until the
 * body is fully read.
 */
// Most Xtream/IPTV panels whitelist the standard okhttp user-agent (used by
// TiviMate, IPTV Smarters, etc.) and REJECT unknown ones — a custom UA was a
// common cause of "login failed". Use the widely-accepted one.
export const IPTV_UA = 'okhttp/4.9.3';

export async function fetchTextTimeout(
  url: string,
  ms = 8000,
  headers: Record<string, string> = { 'User-Agent': IPTV_UA },
): Promise<{ ok: boolean; status: number; text: string }> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    const text = await res.text(); // still under the timeout
    return { ok: res.ok, status: res.status, text };
  } catch (e: any) {
    // Turn raw fetch failures into a message the user can act on.
    if (e?.name === 'AbortError') throw new Error('Timeout: il server non risponde (DNS lento o errato).');
    throw new Error('Impossibile raggiungere il server. Controlla il DNS/indirizzo e la connessione.');
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
  const { ok, status, text } = await fetchTextTimeout(url);
  if (!ok) throw new Error(`Server Xtream: HTTP ${status}`);
  if (!text) return [] as unknown as T;
  try {
    return JSON.parse(text) as T;
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
  const { ok, status, text } = await fetchTextTimeout(url);
  if (!ok) throw new Error(`Connessione fallita (HTTP ${status}). Controlla il DNS server.`);
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {}
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
    ...liveCats.map((x) => ({ id: `live:${x.category_id}`, name: String(x.category_name || '—'), kind: 'live' as const })),
    ...vodCats.map((x) => ({ id: `movie:${x.category_id}`, name: String(x.category_name || '—'), kind: 'movie' as const })),
    ...serCats.map((x) => ({ id: `series:${x.category_id}`, name: String(x.category_name || '—'), kind: 'series' as const })),
  ];
  // O(1) category-name lookup (was O(items × categories) → seconds on huge lists).
  const catMap = new Map(categories.map((c2) => [c2.id, c2.name]));
  const catName = (kind: string, id: any) => (id != null ? catMap.get(`${kind}:${id}`) : undefined);

  // Track real failures separately from empty results so a partial outage (Live
  // up, VOD/Series down) is not cached as a complete catalog for hours.
  let partial = false;
  const call = async (action: string) => {
    try {
      return await api<any[]>(c, action);
    } catch {
      partial = true;
      return [] as any[];
    }
  };
  const [liveRaw, vodRaw, serRaw] = await Promise.all([
    call('get_live_streams'),
    call('get_vod_streams'),
    call('get_series'),
  ]);

  const live: MediaItem[] = liveRaw.map((x, i) => ({
    id: `live:${x.stream_id}`,
    kind: 'live',
    name: String(x.name || 'Senza nome'),
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
    name: String(x.name || 'Senza nome'),
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
    name: String(x.name || 'Senza nome'),
    logo: x.cover || x.cover_big || x.stream_icon || undefined,
    seriesId: String(x.series_id),
    plot: x.plot || undefined,
    rating: x.rating || undefined,
    year: x.year || x.releaseDate || undefined,
    categoryId: x.category_id ? `series:${x.category_id}` : undefined,
    categoryName: catName('series', x.category_id),
  }));

  return { live, movies, series, categories, loadedAt: Date.now(), partial };
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
// Decode a binary (latin1) string as UTF-8 — replaces the deprecated escape()
// trick so accented IT/ES program titles render correctly instead of mojibake.
function utf8Decode(bin: string): string {
  let out = '';
  let i = 0;
  const n = bin.length;
  while (i < n) {
    const c = bin.charCodeAt(i++) & 0xff;
    if (c < 0x80) {
      out += String.fromCharCode(c);
    } else if (c >= 0xc0 && c < 0xe0) {
      const c2 = bin.charCodeAt(i++) & 0x3f;
      out += String.fromCharCode(((c & 0x1f) << 6) | c2);
    } else if (c >= 0xe0 && c < 0xf0) {
      const c2 = bin.charCodeAt(i++) & 0x3f;
      const c3 = bin.charCodeAt(i++) & 0x3f;
      out += String.fromCharCode(((c & 0x0f) << 12) | (c2 << 6) | c3);
    } else if (c >= 0xf0) {
      const c2 = bin.charCodeAt(i++) & 0x3f;
      const c3 = bin.charCodeAt(i++) & 0x3f;
      const c4 = bin.charCodeAt(i++) & 0x3f;
      let cp = ((c & 0x07) << 18) | (c2 << 12) | (c3 << 6) | c4;
      cp -= 0x10000;
      out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
    } else {
      out += String.fromCharCode(c);
    }
  }
  return out;
}
function decodeEpg(s: string): string {
  if (!s) return '';
  try {
    return utf8Decode(atobPoly(s));
  } catch {
    return s;
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
