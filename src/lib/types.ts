/** Unified content model shared by M3U and Xtream sources. */

export type MediaKind = 'live' | 'movie' | 'series';

export interface Category {
  id: string;
  name: string;
  kind: MediaKind;
}

export interface MediaItem {
  /** Stable unique id within a source. */
  id: string;
  kind: MediaKind;
  name: string;
  logo?: string;
  /** Direct playable url. For series this is empty (resolved per-episode). */
  url?: string;
  categoryId?: string;
  categoryName?: string;
  /** Optional metadata. */
  group?: string;
  tvgId?: string; // EPG channel id
  number?: number; // channel number for zapping
  rating?: string;
  year?: string;
  plot?: string;
  /** Xtream-only ids used to resolve series episodes lazily. */
  seriesId?: string;
  streamId?: string;
  containerExt?: string;
}

export interface Episode {
  id: string;
  title: string;
  season: number;
  episode: number;
  url: string;
  plot?: string;
  duration?: string;
  still?: string;
}

export interface Season {
  season: number;
  episodes: Episode[];
}

export type SourceType = 'm3u' | 'xtream';

export interface SourceConfig {
  id: string;
  type: SourceType;
  name: string;
  createdAt: number;
  // M3U
  m3uUrl?: string;
  // Xtream (the three factors: username, password, DNS host)
  host?: string; // active/working DNS host, e.g. http://my.dns.host:8080
  /** Extra DNS hosts (failover) for the same credentials. */
  hosts?: string[];
  username?: string;
  password?: string;
  /** EPG url (optional, m3u). */
  epgUrl?: string;
}

/** A user profile (Netflix-style): own favorites, history, recommendations. */
export interface Profile {
  id: string;
  name: string;
  color: string; // avatar color
  createdAt: number;
}

/** Saved playback position for resume ("Continua a guardare"). */
export interface ProgressEntry {
  key: string;
  kind: 'movie' | 'episode';
  title: string;
  poster?: string;
  /** Exact playable url to resume from. */
  url: string;
  position: number; // seconds
  duration: number; // seconds
  updatedAt: number;
}

export interface LoadedContent {
  live: MediaItem[];
  movies: MediaItem[];
  series: MediaItem[];
  categories: Category[];
  loadedAt: number;
  /** True when some endpoints failed (not just empty) → cache briefly, retry soon. */
  partial?: boolean;
}
