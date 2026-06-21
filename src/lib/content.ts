import { useMemo } from 'react';
import { useStore } from '@/store/useStore';
import type { LoadedContent, MediaItem } from './types';

// Conservative match to avoid false positives (no "hot"/"sex" substrings).
const ADULT_RE = /(adult|adulti|xxx|porn|\+18|18\+|vietato ai minori|para adultos|für erwachsene)/i;

export function isAdultText(s?: string) {
  return !!s && ADULT_RE.test(s);
}

function adultItem(i: MediaItem) {
  return isAdultText(i.categoryName) || isAdultText(i.group) || isAdultText(i.name);
}

/** Content with adult items hidden when parental control is on and not unlocked. */
export function useVisibleContent(): LoadedContent {
  const content = useStore((s) => s.content);
  const enabled = useStore((s) => s.settings.parentalEnabled);
  const unlocked = useStore((s) => s.unlocked);
  return useMemo(() => {
    if (!enabled || unlocked) return content;
    return {
      ...content,
      live: content.live.filter((i) => !adultItem(i)),
      movies: content.movies.filter((i) => !adultItem(i)),
      series: content.series.filter((i) => !adultItem(i)),
      categories: content.categories.filter((c) => !isAdultText(c.name)),
    };
  }, [content, enabled, unlocked]);
}
