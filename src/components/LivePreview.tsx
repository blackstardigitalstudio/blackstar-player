import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, AppState, StyleSheet, View } from 'react-native';
import { useT } from '@/i18n';
import { rebuildLiveUrl } from '@/lib/xtream';
import { useStore } from '@/store/useStore';
import type { MediaItem } from '@/lib/types';
import { colors, radius, spacing } from '@/theme/tokens';
import { Txt } from './ui';

/**
 * Small live preview beside the channel grid: land on a channel with the D-pad
 * and after a beat you SEE it, without leaving the list.
 *
 * Four things make this safe on a box rather than a nice idea that breaks:
 *
 *  1. DEBOUNCE. Scrolling a 2000-channel list would otherwise open (and drop) a
 *     stream per keypress. Nothing starts until the focus has RESTED.
 *  2. ONE stream at a time, RELEASED the moment this stops being the top screen
 *     (you opened the full player) or the app goes to the background. IPTV
 *     panels usually allow a single connection: a preview left running would
 *     make the real player fail with "max connections" — the same trap already
 *     documented for background playback.
 *  3. The focused channel lives in a MODULE-level signal, not in Browser state.
 *     Putting it in state would re-render the whole grid on every D-pad step —
 *     today only the card that gains focus re-renders, and it must stay that way.
 *  4. Nothing inside is focusable, so the remote can never get stuck in here.
 *
 * Made in Italy.
 */

export const PREVIEW_W = 300;

const SETTLE_MS = 900;

// --- focused-channel signal (see note 3) ------------------------------------
let current: MediaItem | null = null;
const subscribers = new Set<() => void>();

/** Called by the grid when the D-pad lands on a card. Cheap: no React state. */
export function setPreviewChannel(item: MediaItem | null) {
  if (current === item) return;
  current = item;
  subscribers.forEach((fn) => fn());
}

function usePreviewChannel(): MediaItem | null {
  return useSyncExternalStore(
    (cb) => {
      subscribers.add(cb);
      return () => {
        subscribers.delete(cb);
      };
    },
    () => current,
    () => current,
  );
}

export function LivePreview() {
  const t = useT();
  const item = usePreviewChannel();
  const sources = useStore((s) => s.sources);
  const activeId = useStore((s) => s.activeId);
  const liveExt = useStore((s) => s.settings.liveExt);
  const aspectMode = useStore((s) => s.settings.aspectMode);
  const source = sources.find((s) => s.id === activeId);

  // The channel the focus has RESTED on (not merely passed over).
  const [settled, setSettled] = useState<MediaItem | null>(null);
  // False while this is not the top screen / the app is backgrounded → no stream.
  const [awake, setAwake] = useState(true);
  const [state, setState] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle');

  const player = useVideoPlayer(null, (p) => {
    p.loop = false;
  });

  useEffect(() => {
    if (!item) {
      setSettled(null);
      return;
    }
    const timer = setTimeout(() => setSettled(item), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [item]);

  // Give the stream back whenever this is not the visible, foreground screen.
  useFocusEffect(
    useCallback(() => {
      setAwake(true);
      return () => setAwake(false);
    }, []),
  );
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setAwake(s === 'active'));
    return () => sub.remove();
  }, []);

  const url =
    settled && source?.type === 'xtream' && settled.streamId
      ? rebuildLiveUrl(source, settled.streamId, liveExt)
      : settled?.url;

  // Load / release. Every path goes through here, so there is exactly ONE place
  // that could ever leave a connection open.
  const loaded = useRef<string | null>(null);
  useEffect(() => {
    const target = awake ? url ?? null : null;
    if (target === loaded.current) return;
    loaded.current = target;
    try {
      if (!target) {
        player.replace(null);
        setState('idle');
        return;
      }
      setState('loading');
      player.replace({ uri: target, contentType: /\.m3u8(\?|$)/i.test(target) ? 'hls' : 'auto' });
      player.play();
    } catch {
      setState('error');
    }
  }, [url, awake, player]);

  // Release on unmount too (leaving the Live tab), not only on blur.
  useEffect(
    () => () => {
      try {
        player.replace(null);
      } catch {}
    },
    [player],
  );

  useEffect(() => {
    const sub = player.addListener('statusChange', ({ status }) => {
      // 'playing' is set by onFirstFrameRender, not here: readyToPlay only means
      // enough data arrived, not that a picture reached the screen.
      if (status === 'loading') setState('loading');
      else if (status === 'error') setState('error');
    });
    return () => sub.remove();
  }, [player]);

  const name = settled?.name ?? item?.name ?? '';

  return (
    <View style={styles.panel} pointerEvents="none">
      <View style={styles.screen}>
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit={aspectMode}
          nativeControls={false}
          // A SurfaceView is punched THROUGH the app window: it ignores the
          // parent's rounded corners and clipping, and does not layer reliably
          // against the rest of the UI — which is fine for a full-screen player
          // and wrong for a small panel sitting beside a scrolling grid. The docs
          // name textureView as the fix for exactly this case.
          surfaceType="textureView"
          // Status can say readyToPlay while nothing has actually been drawn yet.
          // The first real frame is the only honest signal that it is working.
          onFirstFrameRender={() => setState('playing')}
        />
        {state !== 'playing' ? (
          <View style={styles.overlay}>
            {state === 'error' ? (
              <>
                <Ionicons name="cloud-offline" size={26} color={colors.textMuted} />
                <Txt variant="tiny" color={colors.textMuted} style={styles.overlayTxt}>
                  {t('prev.failed')}
                </Txt>
              </>
            ) : state === 'loading' ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <>
                <Ionicons name="eye-outline" size={26} color={colors.textFaint} />
                <Txt variant="tiny" color={colors.textFaint} style={styles.overlayTxt}>
                  {t('prev.idle')}
                </Txt>
              </>
            )}
          </View>
        ) : null}
      </View>

      <Txt variant="small" numberOfLines={2} style={{ fontWeight: '700', marginTop: spacing.sm }}>
        {name}
      </Txt>
      <Txt variant="tiny" color={colors.textMuted} style={{ marginTop: 4 }}>
        {t('prev.hint')}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { width: PREVIEW_W, paddingRight: spacing.lg, paddingTop: spacing.md },
  screen: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.black,
    borderWidth: 1,
    borderColor: colors.border,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.bgElevated,
  },
  overlayTxt: { textAlign: 'center', paddingHorizontal: spacing.sm },
});
