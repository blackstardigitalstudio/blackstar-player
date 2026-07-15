import { create } from 'zustand';
import { getLocales } from 'expo-localization';
import type { Lang } from '@/i18n/strings';
import { parseM3U } from '@/lib/m3u';
import { fetchTextTimeout, loadXtreamFailover } from '@/lib/xtream';
import {
  KEYS,
  cacheContent,
  clearAllContentCache,
  getJSON,
  loadCachedContent,
  removeContentCache,
  setJSON,
} from '@/lib/storage';
import type { LoadedContent, MediaItem, Profile, ProgressEntry, SourceConfig } from '@/lib/types';

export type PlayerMode = 'internal' | 'ask' | 'mxplayer' | 'vlc';

export interface Settings {
  language: Lang;
  liveExt: 'ts' | 'm3u8';
  autoStartLastChannel: boolean;
  survivalMode: boolean;
  aspectMode: 'contain' | 'cover' | 'fill';
  showChannelNumbers: boolean;
  bannerText: string;
  autoCleanupHours: number;
  confirmExit: boolean;
  playerMode: PlayerMode;
  parentalEnabled: boolean;
  pin: string;
  categoryOrder: 'default' | 'alpha' | 'mostWatched' | 'manual';
  categoryManual: string[];
  /** Pinned category ids — always sorted to the TOP of the category list. */
  categoryPins: string[];
}

function deviceLang(): Lang {
  try {
    return getLocales()[0]?.languageCode === 'es' ? 'es' : 'it';
  } catch {
    return 'it';
  }
}

const DEFAULT_SETTINGS: Settings = {
  language: deviceLang(),
  liveExt: 'ts',
  autoStartLastChannel: true,
  survivalMode: true,
  aspectMode: 'contain',
  showChannelNumbers: true,
  bannerText: 'Blackstar Player',
  autoCleanupHours: 6,
  confirmExit: true,
  playerMode: 'internal',
  parentalEnabled: false,
  pin: '',
  categoryOrder: 'default',
  categoryManual: [],
  categoryPins: [],
};

export const PROFILE_COLORS = ['#A855F7', '#22D3EE', '#34D399', '#FBBF24', '#FB7185', '#60A5FA'];

const EMPTY: LoadedContent = { live: [], movies: [], series: [], categories: [], loadedAt: 0 };

interface State {
  hydrated: boolean;
  sources: SourceConfig[];
  activeId: string | null;
  content: LoadedContent;
  loading: boolean;
  error: string | null;

  profiles: Profile[];
  activeProfileId: string | null;
  favorites: MediaItem[];
  recents: MediaItem[];
  progress: Record<string, ProgressEntry>;
  taste: Record<string, number>;

  lastLiveId: string | null;
  settings: Settings;
  unlocked: boolean;
  /** Whether the user picked a profile this session (for the startup picker). */
  profileChosen: boolean;

  hydrate: () => Promise<void>;
  setUnlocked: (v: boolean) => void;

  addProfile: (name: string, color?: string) => Promise<void>;
  removeProfile: (id: string) => Promise<void>;
  setActiveProfile: (id: string) => Promise<void>;

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
  toggleCategoryPin: (id: string) => Promise<void>;
  saveProgress: (entry: Omit<ProgressEntry, 'updatedAt'>) => Promise<void>;
  getProgress: (key: string) => ProgressEntry | undefined;
  continueWatching: () => ProgressEntry[];
  clearProgress: () => Promise<void>;
}

async function loadProfileData(pid: string) {
  const [favorites, recents, progress, taste] = await Promise.all([
    getJSON<MediaItem[]>(KEYS.fav(pid), []),
    getJSON<MediaItem[]>(KEYS.recents(pid), []),
    getJSON<Record<string, ProgressEntry>>(KEYS.progress(pid), {}),
    getJSON<Record<string, number>>(KEYS.taste(pid), {}),
  ]);
  return { favorites, recents, progress, taste };
}

export const useStore = create<State>((set, get) => ({
  hydrated: false,
  sources: [],
  activeId: null,
  content: EMPTY,
  loading: false,
  error: null,

  profiles: [],
  activeProfileId: null,
  favorites: [],
  recents: [],
  progress: {},
  taste: {},

  lastLiveId: null,
  settings: DEFAULT_SETTINGS,
  unlocked: false,
  profileChosen: false,

  setUnlocked: (v) => set({ unlocked: v }),

  hydrate: async () => {
    const [sources, activeId, settings, profilesRaw, activeProfileRaw] = await Promise.all([
      getJSON<SourceConfig[]>(KEYS.sources, []),
      getJSON<string | null>(KEYS.activeSource, null),
      getJSON<Settings>(KEYS.settings, DEFAULT_SETTINGS),
      getJSON<Profile[]>(KEYS.profiles, []),
      getJSON<string | null>(KEYS.activeProfile, null),
    ]);
    const lastLiveId = await getJSON<string | null>(KEYS.lastLive, null);

    // Ensure at least one profile exists.
    let profiles = profilesRaw;
    if (profiles.length === 0) {
      profiles = [{ id: `p_${Date.now()}`, name: 'Profilo 1', color: PROFILE_COLORS[0], createdAt: Date.now() }];
      await setJSON(KEYS.profiles, profiles);
    }
    const activeProfileId = activeProfileRaw && profiles.find((p) => p.id === activeProfileRaw) ? activeProfileRaw : profiles[0].id;
    await setJSON(KEYS.activeProfile, activeProfileId);

    const data = await loadProfileData(activeProfileId);
    const active = activeId && sources.find((s) => s.id === activeId) ? activeId : sources[0]?.id ?? null;

    set({
      sources,
      activeId: active,
      settings: { ...DEFAULT_SETTINGS, ...settings },
      profiles,
      activeProfileId,
      lastLiveId,
      ...data,
      hydrated: true,
    });

    if (active) {
      const cached = await loadCachedContent(active);
      if (cached) set({ content: cached });
      get().refresh(false);
    }
  },

  addProfile: async (name, color) => {
    const profile: Profile = {
      id: `p_${Date.now()}`,
      name: name.trim() || `Profilo ${get().profiles.length + 1}`,
      color: color || PROFILE_COLORS[get().profiles.length % PROFILE_COLORS.length],
      createdAt: Date.now(),
    };
    const profiles = [...get().profiles, profile];
    await setJSON(KEYS.profiles, profiles);
    set({ profiles });
    await get().setActiveProfile(profile.id);
  },

  removeProfile: async (id) => {
    let profiles = get().profiles.filter((p) => p.id !== id);
    if (profiles.length === 0) {
      profiles = [{ id: `p_${Date.now()}`, name: 'Profilo 1', color: PROFILE_COLORS[0], createdAt: Date.now() }];
    }
    await setJSON(KEYS.profiles, profiles);
    set({ profiles });
    if (get().activeProfileId === id) await get().setActiveProfile(profiles[0].id);
  },

  setActiveProfile: async (id) => {
    await setJSON(KEYS.activeProfile, id);
    const data = await loadProfileData(id);
    set({ activeProfileId: id, profileChosen: true, ...data });
  },

  addSource: async (s, content) => {
    // Upsert: edit keeps its position in the list, add appends.
    const exists = get().sources.some((x) => x.id === s.id);
    const sources = exists ? get().sources.map((x) => (x.id === s.id ? s : x)) : [...get().sources, s];
    await setJSON(KEYS.sources, sources);
    await setJSON(KEYS.activeSource, s.id);
    await removeContentCache(s.id);
    set({ sources, activeId: s.id, content: content ?? EMPTY, error: null });
    if (content) await cacheContent(s.id, content);
    else await get().refresh(true);
  },

  removeSource: async (id) => {
    const sources = get().sources.filter((s) => s.id !== id);
    await setJSON(KEYS.sources, sources);
    await removeContentCache(id);
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
    const ageMs = Date.now() - content.loadedAt;
    // A partially-loaded catalog (some endpoints failed) is only "fresh" for a
    // few minutes so we retry soon instead of being stuck on it for hours.
    const ttlMs = content.partial ? 5 * 60_000 : settings.autoCleanupHours * 3600_000;
    if (!force && content.loadedAt && ageMs < ttlMs) return;
    set({ loading: true, error: null });
    try {
      let loaded: LoadedContent;
      if (src.type === 'm3u') {
        const { ok, status, text } = await fetchTextTimeout(src.m3uUrl || '', 15000);
        if (!ok) throw new Error(`Errore caricamento lista (HTTP ${status})`);
        loaded = parseM3U(text);
      } else {
        const { content: c, host } = await loadXtreamFailover(src, settings.liveExt);
        loaded = c;
        if (host && host !== src.host) {
          const updated = get().sources.map((s) => (s.id === src.id ? { ...s, host } : s));
          await setJSON(KEYS.sources, updated);
          set({ sources: updated });
        }
      }
      // Race guard: if the user switched source while this was loading, discard.
      if (get().activeId !== activeId) return;
      set({ content: loaded, loading: false });
      await cacheContent(activeId, loaded);
    } catch (e: any) {
      if (get().activeId !== activeId) return;
      set({ loading: false, error: e?.message || 'Impossibile caricare la lista' });
    }
  },

  toggleFavorite: async (item) => {
    const pid = get().activeProfileId;
    if (!pid) return;
    const exists = get().favorites.some((f) => f.id === item.id);
    const favorites = exists
      ? get().favorites.filter((f) => f.id !== item.id)
      : [{ ...item, _eps: undefined } as MediaItem, ...get().favorites];
    set({ favorites });
    await setJSON(KEYS.fav(pid), favorites);
  },

  isFavorite: (id) => get().favorites.some((f) => f.id === id),

  addRecent: async (item) => {
    const pid = get().activeProfileId;
    if (!pid) return;
    // Strip the heavy episode list before persisting (kept only in the live catalog).
    const slim = { ...item, _eps: undefined } as MediaItem;
    const recents = [slim, ...get().recents.filter((r) => r.id !== item.id)].slice(0, 40);
    set({ recents });
    await setJSON(KEYS.recents(pid), recents);
    // learn taste from the item's category/genre
    const cat = item.categoryName || item.group;
    if (cat) {
      const taste = { ...get().taste, [cat]: (get().taste[cat] || 0) + 1 };
      set({ taste });
      await setJSON(KEYS.taste(pid), taste);
    }
  },

  setLastLive: async (id) => {
    set({ lastLiveId: id });
    await setJSON(KEYS.lastLive, id);
  },

  clearRecents: async () => {
    const pid = get().activeProfileId;
    set({ recents: [], taste: {} });
    if (pid) {
      await setJSON(KEYS.recents(pid), []);
      await setJSON(KEYS.taste(pid), {});
    }
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

  toggleCategoryPin: async (id) => {
    const cur = get().settings.categoryPins || [];
    const categoryPins = cur.includes(id) ? cur.filter((x) => x !== id) : [id, ...cur];
    const settings = { ...get().settings, categoryPins };
    set({ settings });
    await setJSON(KEYS.settings, settings);
  },

  saveProgress: async (entry) => {
    const pid = get().activeProfileId;
    if (!pid || !entry.key || !entry.url || !(entry.position > 0)) return;
    const progress = { ...get().progress };
    const ratio = entry.duration > 0 ? entry.position / entry.duration : 0;
    if (entry.duration > 0 && ratio >= 0.95) {
      delete progress[entry.key];
    } else {
      progress[entry.key] = { ...entry, updatedAt: Date.now() };
    }
    set({ progress });
    await setJSON(KEYS.progress(pid), progress);
  },

  getProgress: (key) => get().progress[key],

  continueWatching: () =>
    Object.values(get().progress)
      .filter((p) => p.position > 5)
      .sort((a, b) => b.updatedAt - a.updatedAt),

  clearProgress: async () => {
    const pid = get().activeProfileId;
    set({ progress: {} });
    if (pid) await setJSON(KEYS.progress(pid), {});
  },
}));
