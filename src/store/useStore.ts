import { create } from 'zustand';
import { parseM3U } from '@/lib/m3u';
import { loadXtream, loadXtreamFailover } from '@/lib/xtream';
import {
  KEYS,
  cacheContent,
  clearAllContentCache,
  getJSON,
  loadCachedContent,
  remove,
  setJSON,
} from '@/lib/storage';
import type { LoadedContent, MediaItem, ProgressEntry, SourceConfig } from '@/lib/types';

export interface Settings {
  liveExt: 'ts' | 'm3u8';
  autoStartLastChannel: boolean;
  survivalMode: boolean;
  aspectMode: 'contain' | 'cover' | 'fill';
  showChannelNumbers: boolean;
  bannerText: string;
  autoCleanupHours: number;
  confirmExit: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  liveExt: 'ts',
  autoStartLastChannel: true,
  survivalMode: true,
  aspectMode: 'contain',
  showChannelNumbers: true,
  bannerText: 'Blackstar Player',
  autoCleanupHours: 6,
  confirmExit: true,
};

const EMPTY: LoadedContent = { live: [], movies: [], series: [], categories: [], loadedAt: 0 };

interface State {
  hydrated: boolean;
  sources: SourceConfig[];
  activeId: string | null;
  content: LoadedContent;
  loading: boolean;
  error: string | null;
  favorites: MediaItem[];
  recents: MediaItem[];
  progress: Record<string, ProgressEntry>;
  lastLiveId: string | null;
  settings: Settings;

  hydrate: () => Promise<void>;
  addSource: (s: SourceConfig, content?: LoadedContent) => Promise<void>;
  removeSource: (id: string) => Promise<void>;
  setActive: (id: string) => Promise<void>;
  refresh: (force?: boolean) => Promise<void>;
  toggleFavorite: (item: MediaItem) => Promise<void>;
  isFavorite: (id: string) => boolean;
  addRecent: (item: MediaItem) => Promise<void>;
  setLastLive: (id: string) => Promise<void>;
  clearRecents: () => Promise<void>;
  clearCache: () => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  saveProgress: (entry: Omit<ProgressEntry, 'updatedAt'>) => Promise<void>;
  getProgress: (key: string) => ProgressEntry | undefined;
  continueWatching: () => ProgressEntry[];
  clearProgress: () => Promise<void>;
}

export const useStore = create<State>((set, get) => ({
  hydrated: false,
  sources: [],
  activeId: null,
  content: EMPTY,
  loading: false,
  error: null,
  favorites: [],
  recents: [],
  progress: {},
  lastLiveId: null,
  settings: DEFAULT_SETTINGS,

  hydrate: async () => {
    const [sources, activeId, favorites, recents, progress, settings] = await Promise.all([
      getJSON<SourceConfig[]>(KEYS.sources, []),
      getJSON<string | null>(KEYS.activeSource, null),
      getJSON<MediaItem[]>(KEYS.favorites, []),
      getJSON<MediaItem[]>(KEYS.recents, []),
      getJSON<Record<string, ProgressEntry>>(KEYS.progress, {}),
      getJSON<Settings>(KEYS.settings, DEFAULT_SETTINGS),
    ]);
    const active = activeId && sources.find((s) => s.id === activeId) ? activeId : sources[0]?.id ?? null;
    set({
      sources,
      activeId: active,
      favorites,
      recents,
      progress,
      settings: { ...DEFAULT_SETTINGS, ...settings },
      hydrated: true,
    });
    if (active) {
      const cached = await loadCachedContent(active);
      if (cached) set({ content: cached });
      get().refresh(false);
    }
  },

  addSource: async (s, content) => {
    const sources = [...get().sources.filter((x) => x.id !== s.id), s];
    await setJSON(KEYS.sources, sources);
    await setJSON(KEYS.activeSource, s.id);
    set({ sources, activeId: s.id, content: content ?? EMPTY, error: null });
    if (content) await cacheContent(s.id, content);
    else await get().refresh(true);
  },

  removeSource: async (id) => {
    const sources = get().sources.filter((s) => s.id !== id);
    await setJSON(KEYS.sources, sources);
    await remove(KEYS.content(id));
    const activeId = get().activeId === id ? sources[0]?.id ?? null : get().activeId;
    await setJSON(KEYS.activeSource, activeId);
    set({ sources, activeId, content: EMPTY });
    if (activeId) await get().refresh(false);
  },

  setActive: async (id) => {
    if (id === get().activeId) return;
    await setJSON(KEYS.activeSource, id);
    set({ activeId: id, content: EMPTY, error: null });
    const cached = await loadCachedContent(id);
    if (cached) set({ content: cached });
    await get().refresh(false);
  },

  refresh: async (force = true) => {
    const { activeId, sources, settings, content } = get();
    if (!activeId) return;
    const src = sources.find((s) => s.id === activeId);
    if (!src) return;
    // skip network if cache is fresh enough and not forced
    const ageMs = Date.now() - content.loadedAt;
    if (!force && content.loadedAt && ageMs < settings.autoCleanupHours * 3600_000) return;
    set({ loading: true, error: null });
    try {
      let loaded: LoadedContent;
      if (src.type === 'm3u') {
        const res = await fetch(src.m3uUrl || '', { headers: { 'User-Agent': 'BlackstarPlayer' } });
        if (!res.ok) throw new Error(`Errore caricamento lista (HTTP ${res.status})`);
        loaded = parseM3U(await res.text());
      } else {
        // try each DNS host until one works (failover)
        const { content, host } = await loadXtreamFailover(src, settings.liveExt);
        loaded = content;
        if (host && host !== src.host) {
          const updated = get().sources.map((s) => (s.id === src.id ? { ...s, host } : s));
          await setJSON(KEYS.sources, updated);
          set({ sources: updated });
        }
      }
      set({ content: loaded, loading: false });
      await cacheContent(activeId, loaded);
    } catch (e: any) {
      set({ loading: false, error: e?.message || 'Impossibile caricare la lista' });
    }
  },

  toggleFavorite: async (item) => {
    const exists = get().favorites.some((f) => f.id === item.id);
    const favorites = exists
      ? get().favorites.filter((f) => f.id !== item.id)
      : [{ ...item, _eps: undefined } as MediaItem, ...get().favorites];
    set({ favorites });
    await setJSON(KEYS.favorites, favorites);
  },

  isFavorite: (id) => get().favorites.some((f) => f.id === id),

  addRecent: async (item) => {
    const recents = [item, ...get().recents.filter((r) => r.id !== item.id)].slice(0, 40);
    set({ recents });
    await setJSON(KEYS.recents, recents);
  },

  setLastLive: async (id) => {
    set({ lastLiveId: id });
  },

  clearRecents: async () => {
    set({ recents: [] });
    await setJSON(KEYS.recents, []);
  },

  clearCache: async () => {
    await clearAllContentCache();
    set({ content: EMPTY });
    await get().refresh(true);
  },

  updateSettings: async (patch) => {
    const settings = { ...get().settings, ...patch };
    set({ settings });
    await setJSON(KEYS.settings, settings);
  },

  saveProgress: async (entry) => {
    if (!entry.key || !entry.url || !(entry.position > 0)) return;
    const progress = { ...get().progress };
    const ratio = entry.duration > 0 ? entry.position / entry.duration : 0;
    // consider it watched once near the end → drop from "continue watching"
    if (entry.duration > 0 && ratio >= 0.95) {
      delete progress[entry.key];
    } else {
      progress[entry.key] = { ...entry, updatedAt: Date.now() };
    }
    set({ progress });
    await setJSON(KEYS.progress, progress);
  },

  getProgress: (key) => get().progress[key],

  continueWatching: () =>
    Object.values(get().progress)
      .filter((p) => p.position > 5)
      .sort((a, b) => b.updatedAt - a.updatedAt),

  clearProgress: async () => {
    set({ progress: {} });
    await setJSON(KEYS.progress, {});
  },
}));
