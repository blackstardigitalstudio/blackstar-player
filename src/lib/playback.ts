import * as IntentLauncher from 'expo-intent-launcher';
import { useRouter } from 'expo-router';
import { Platform } from 'react-native';
import { useStore } from '@/store/useStore';
import { playUrl } from '@/lib/nav';
import { rebuildLiveUrl } from '@/lib/xtream';
import type { MediaItem } from '@/lib/types';

const PKG: Record<string, string> = {
  mxplayer: 'com.mxtech.videoplayer.ad',
  vlc: 'org.videolan.vlc',
};

const FLAG_NEW_TASK = 0x10000000;

/** Launch the stream in an external Android player. Returns false if not possible. */
export async function launchExternal(url: string, mode: string): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const tryLaunch = (pkg?: string) =>
    IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: url,
      type: 'video/*',
      flags: FLAG_NEW_TASK,
      ...(pkg ? { packageName: pkg } : {}),
    });
  try {
    await tryLaunch(PKG[mode]); // for 'ask' this is undefined → system chooser/default
    return true;
  } catch {
    // chosen app not installed → fall back to system default/chooser
    if (PKG[mode]) {
      try {
        await tryLaunch(undefined);
        return true;
      } catch {}
    }
    return false;
  }
}

/** Unified playback entry point honoring the selected player (internal/external). */
export function usePlayback() {
  const router = useRouter();
  const mode = useStore((s) => s.settings.playerMode);
  const liveExt = useStore((s) => s.settings.liveExt);
  const sources = useStore((s) => s.sources);
  const activeId = useStore((s) => s.activeId);
  const addRecent = useStore((s) => s.addRecent);
  const source = sources.find((s) => s.id === activeId);

  const resolveUrl = (item: MediaItem): string | undefined => {
    if (item.kind === 'live' && source?.type === 'xtream' && item.streamId) {
      return rebuildLiveUrl(source, item.streamId, liveExt);
    }
    return item.url;
  };

  const open = async (item: MediaItem) => {
    if (item.kind === 'series') {
      router.push({ pathname: '/series/[id]', params: { id: item.id } });
      return;
    }
    if (mode !== 'internal' && Platform.OS === 'android') {
      const url = resolveUrl(item);
      if (url) {
        addRecent({ ...item });
        if (await launchExternal(url, mode)) return;
      }
    }
    router.push({ pathname: '/player', params: { id: item.id } });
  };

  const playEntry = async (
    url: string,
    title: string,
    opts?: { key?: string; poster?: string; resumeAt?: number },
  ) => {
    if (mode !== 'internal' && Platform.OS === 'android') {
      if (await launchExternal(url, mode)) return;
    }
    playUrl(router, url, title, opts);
  };

  return { open, playEntry };
}
