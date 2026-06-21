import type { MediaItem } from './types';
import { relatedItems } from './search';

/** Categories the user watches most, highest first. */
export function topCategories(taste: Record<string, number>, n = 4): string[] {
  return Object.entries(taste)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([c]) => c);
}

export function itemsInCategory(pool: MediaItem[], categoryName: string, exclude: Set<string>, n = 20): MediaItem[] {
  const out: MediaItem[] = [];
  for (const i of pool) {
    if ((i.categoryName === categoryName || i.group === categoryName) && !exclude.has(i.id)) {
      out.push(i);
      if (out.length >= n) break;
    }
  }
  return out;
}

/** "Because you watched X" rows from recent items. */
export function becauseYouWatched(recents: MediaItem[], pool: MediaItem[], max = 2): { seed: MediaItem; items: MediaItem[] }[] {
  const rows: { seed: MediaItem; items: MediaItem[] }[] = [];
  const seen = new Set(recents.map((r) => r.id));
  for (const r of recents.slice(0, max)) {
    if (r.kind === 'live') continue;
    const items = relatedItems(r, pool, 16).filter((x) => !seen.has(x.id));
    if (items.length >= 4) rows.push({ seed: r, items });
  }
  return rows;
}
