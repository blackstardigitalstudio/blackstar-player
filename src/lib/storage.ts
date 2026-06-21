import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import type { LoadedContent } from './types';

export const KEYS = {
  sources: 'bs.sources',
  activeSource: 'bs.activeSourceId',
  settings: 'bs.settings',
  profiles: 'bs.profiles',
  activeProfile: 'bs.activeProfileId',
  // per-profile data
  fav: (p: string) => `bs.fav.${p}`,
  recents: (p: string) => `bs.recents.${p}`,
  progress: (p: string) => `bs.progress.${p}`,
  taste: (p: string) => `bs.taste.${p}`,
};

export async function getJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function setJSON(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota errors for small data
  }
}

export async function remove(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {}
}

/**
 * Content can be huge (tens of thousands of items), so it is cached on the
 * filesystem (no AsyncStorage size limit) for instant reopen without a reload.
 */
const CONTENT_PREFIX = 'bs-content-';
function contentFile(sourceId: string) {
  return new File(Paths.document, `${CONTENT_PREFIX}${sourceId}.json`);
}

export async function cacheContent(sourceId: string, content: LoadedContent) {
  try {
    const f = contentFile(sourceId);
    if (f.exists) f.delete();
    f.create();
    f.write(JSON.stringify(content));
  } catch {
    // best-effort cache
  }
}

export async function loadCachedContent(sourceId: string): Promise<LoadedContent | null> {
  try {
    const f = contentFile(sourceId);
    if (!f.exists) return null;
    const txt = await f.text();
    return txt ? (JSON.parse(txt) as LoadedContent) : null;
  } catch {
    return null;
  }
}

export async function removeContentCache(sourceId: string) {
  try {
    const f = contentFile(sourceId);
    if (f.exists) f.delete();
  } catch {}
}

export async function clearAllContentCache() {
  try {
    const dir = new Directory(Paths.document);
    for (const item of dir.list()) {
      if (item.name.startsWith(CONTENT_PREFIX)) {
        try {
          item.delete();
        } catch {}
      }
    }
  } catch {}
}
