import type { Category } from './types';

export type CatOrder = 'default' | 'alpha' | 'mostWatched' | 'manual';

/** Sort categories by the chosen mode. */
export function sortCategories(
  cats: Category[],
  order: CatOrder,
  taste: Record<string, number>,
  manual: string[],
): Category[] {
  const arr = [...cats];
  if (order === 'alpha') return arr.sort((a, b) => a.name.localeCompare(b.name));
  if (order === 'mostWatched') {
    return arr.sort((a, b) => (taste[b.name] || 0) - (taste[a.name] || 0) || a.name.localeCompare(b.name));
  }
  if (order === 'manual') {
    const pos = (id: string) => {
      const i = manual.indexOf(id);
      return i < 0 ? Number.MAX_SAFE_INTEGER : i;
    };
    return arr.sort((a, b) => pos(a.id) - pos(b.id));
  }
  return arr;
}
