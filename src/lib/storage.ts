import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FS from 'expo-file-system/legacy';
import type { LoadedContent } from './types';

export const KEYS = {
  sources: 'bs.sources',
  activeSource: 'bs.activeSourceId',
  settings: 'bs.settings',
  profiles: 'bs.profiles',
  activeProfile: 'bs.activeProfileId',
  lastLive: 'bs.lastLiveId',
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
const DOCS = FS.documentDirectory || '';
function contentUri(sourceId: string) {
  return `${DOCS}${CONTENT_PREFIX}${sourceId}.json`;
}

export async function cacheContent(sourceId: string, content: LoadedContent) {
  try {
    // Async write → the multi-MB disk I/O runs off the JS thread (no ANR on
    // low-end boxes writing a huge catalog).
    await FS.writeAsStringAsync(contentUri(sourceId), JSON.stringify(content));
  } catch {
    // best-effort cache
  }
}

/**
 * Hard ceiling for the cached catalog. Reading the file means holding the whole
 * JSON text AND the parsed objects in memory at once: past a few tens of MB a
 * TV box (which has far less RAM than a phone) is killed by the OS before it can
 * show anything — a native OOM, no JS error to catch, just a black screen at
 * every launch. Providers grow their lists over time, so a catalog that opened
 * fine for months can cross the line one day and then fail forever. Over the
 * limit we drop the cache and reload from the provider instead.
 */
const MAX_CACHE_BYTES = 24 * 1024 * 1024;

export async function loadCachedContent(sourceId: string): Promise<LoadedContent | null> {
  const uri = contentUri(sourceId);
  try {
    const info = await FS.getInfoAsync(uri);
    if (!info.exists) return null;
    if (typeof info.size === 'number' && info.size > MAX_CACHE_BYTES) {
      console.warn(`[Blackstar] cached catalog too big (${info.size} bytes) — dropped`);
      await FS.deleteAsync(uri, { idempotent: true }).catch(() => {});
      return null;
    }
    const txt = await FS.readAsStringAsync(uri);
    return txt ? (JSON.parse(txt) as LoadedContent) : null;
  } catch (e) {
    // A corrupt/half-written file would fail on every launch: bin it.
    console.warn('[Blackstar] cached catalog unreadable — dropped:', e);
    await FS.deleteAsync(uri, { idempotent: true }).catch(() => {});
    return null;
  }
}

export async function removeContentCache(sourceId: string) {
  try {
    await FS.deleteAsync(contentUri(sourceId), { idempotent: true });
  } catch {}
}

export async function clearAllContentCache() {
  try {
    if (!DOCS) return;
    const names = await FS.readDirectoryAsync(DOCS);
    await Promise.all(
      names
        .filter((n) => n.startsWith(CONTENT_PREFIX))
        .map((n) => FS.deleteAsync(`${DOCS}${n}`, { idempotent: true }).catch(() => {})),
    );
  } catch {}
}
