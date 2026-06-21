import { useStore } from '@/store/useStore';
import { translate, type Lang } from './strings';

/** Hook returning a translator bound to the current language. */
export function useT() {
  const lang = useStore((s) => s.settings.language);
  return (key: string, params?: Record<string, string | number>) => translate(lang, key, params);
}

export type { Lang };
export { translate };
