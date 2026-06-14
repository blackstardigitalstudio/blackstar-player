import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LoadedContent } from './types';

export const KEYS = {
  sources: 'bs.sources',
  activeSource: 'bs.activeSourceId',
  favorites: 'bs.favorites',
  recents: 'bs.recents',
  settings: 'bs.settings',
  content: (sourceId: string) => `bs.content.${sourceId}`,
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
    // ignore quota errors; content cache is best-effort
  }
}

export async function remove(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {}
}

/** Content cache is large; store stripped of internal episode arrays to stay light. */
export async function cacheContent(sourceId: string, content: LoadedContent) {
  await setJSON(KEYS.content(sourceId), content);
}

export async function loadCachedContent(sourceId: string): Promise<LoadedContent | null> {
  return getJSON<LoadedContent | null>(KEYS.content(sourceId), null);
}

/** Remove every cached content blob (used by the "clear cache" setting). */
export async function clearAllContentCache() {
  const keys = await AsyncStorage.getAllKeys();
  const targets = keys.filter((k) => k.startsWith('bs.content.'));
  if (targets.length) await AsyncStorage.multiRemove(targets);
}
