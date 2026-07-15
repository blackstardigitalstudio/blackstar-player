import type { Category } from './types';

export type CatOrder = 'default' | 'alpha' | 'mostWatched' | 'manual';

/** Sort categories by the chosen mode, then float PINNED categories to the top. */
export function sortCategories(
  cats: Category[],
  order: CatOrder,
  taste: Record<string, number>,
  manual: string[],
  pins: string[] = [],
): Category[] {
  const arr = [...cats];
  let sorted: Category[];
  if (order === 'alpha') {
    sorted = arr.sort((a, b) => a.name.localeCompare(b.name));
  } else if (order === 'mostWatched') {
    sorted = arr.sort((a, b) => (taste[b.name] || 0) - (taste[a.name] || 0) || a.name.localeCompare(b.name));
  } else if (order === 'manual') {
    const pos = (id: string) => {
      const i = manual.indexOf(id);
      return i < 0 ? Number.MAX_SAFE_INTEGER : i;
    };
    sorted = arr.sort((a, b) => pos(a.id) - pos(b.id));
  } else {
    sorted = arr;
  }
  if (!pins.length) return sorted;
  // Pinned categories first (keeping their relative order), then the rest.
  const pinned = new Set(pins);
  return [...sorted.filter((c) => pinned.has(c.id)), ...sorted.filter((c) => !pinned.has(c.id))];
}
