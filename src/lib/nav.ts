import type { useRouter } from 'expo-router';
import type { MediaItem } from './types';

type Router = ReturnType<typeof useRouter>;

/** Route a media item to the right destination (player or series detail). */
export function openItem(router: Router, item: MediaItem) {
  if (item.kind === 'series') {
    router.push({ pathname: '/series/[id]', params: { id: item.id } });
  } else {
    router.push({ pathname: '/player', params: { id: item.id } });
  }
}

export function playUrl(
  router: Router,
  url: string,
  title: string,
  opts?: { key?: string; poster?: string; resumeAt?: number },
) {
  router.push({
    pathname: '/player',
    params: {
      url,
      title,
      ...(opts?.key ? { key: opts.key } : {}),
      ...(opts?.poster ? { poster: opts.poster } : {}),
      ...(opts?.resumeAt && opts.resumeAt > 0 ? { resumeAt: String(Math.floor(opts.resumeAt)) } : {}),
    },
  });
}
