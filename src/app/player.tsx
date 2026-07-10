import { Ionicons } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Txt } from '@/components/ui';
import { Focusable } from '@/tv/Focusable';
import { useKeyHandler } from '@/tv/RemoteProvider';
import { useStore } from '@/store/useStore';
import { getShortEpg, rebuildLiveUrl, type EpgItem } from '@/lib/xtream';
import { CastControls } from '@/components/CastControls';
import { useT } from '@/i18n';
import type { MediaItem, SourceConfig } from '@/lib/types';
import { colors, radius, spacing } from '@/theme/tokens';

function hhmm(ts: number) {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function buildSource(url: string) {
  const isHls = /\.m3u8(\?|$)/i.test(url);
  return { uri: url, contentType: isHls ? ('hls' as const) : ('auto' as const) };
}

function liveCandidates(item: MediaItem, source: SourceConfig | undefined, preferExt: string): string[] {
  if (source?.type === 'xtream' && item.streamId) {
    const order = preferExt === 'm3u8' ? ['m3u8', 'ts'] : ['ts', 'm3u8'];
    return order.map((ext) => rebuildLiveUrl(source, item.streamId!, ext));
  }
  return item.url ? [item.url] : [];
}

interface Current {
  title: string;
  candidates: string[];
  isLive: boolean;
  liveIndex: number;
  item?: MediaItem;
}

export default function Player() {
  useKeepAwake();
  const router = useRouter();
  const t = useT();
  const params = useLocalSearchParams<{ id?: string; url?: string; title?: string; key?: string; poster?: string; resumeAt?: string }>();
  const content = useStore((s) => s.content);
  const sources = useStore((s) => s.sources);
  const activeId = useStore((s) => s.activeId);
  const settings = useStore((s) => s.settings);
  const addRecent = useStore((s) => s.addRecent);
  const setLastLive = useStore((s) => s.setLastLive);
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const favorites = useStore((s) => s.favorites);
  const saveProgress = useStore((s) => s.saveProgress);
  const getProgress = useStore((s) => s.getProgress);

  const source = sources.find((s) => s.id === activeId);

  const initial = useMemo<Current>(() => {
    if (params.url) {
      return { title: params.title || t('pl.title'), candidates: [params.url], isLive: false, liveIndex: -1 };
    }
    const live = content.live.findIndex((x) => x.id === params.id);
    if (live >= 0) {
      const item = content.live[live];
      return { title: item.name, candidates: liveCandidates(item, source, settings.liveExt), isLive: true, liveIndex: live, item };
    }
    const movie = content.movies.find((x) => x.id === params.id);
    if (movie) return { title: movie.name, candidates: movie.url ? [movie.url] : [], isLive: false, liveIndex: -1, item: movie };
    return { title: t('pl.title'), candidates: [], isLive: false, liveIndex: -1 };
  }, [params.id, params.url, params.title, content, source, settings.liveExt]);

  const [cur, setCur] = useState<Current>(initial);
  const [error, setError] = useState<string | null>(null);
  const [buffering, setBuffering] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [overlay, setOverlay] = useState(true);
  const [epg, setEpg] = useState<EpgItem[]>([]);
  const attempt = useRef(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didSeek = useRef(false);

  const player = useVideoPlayer(cur.candidates[0] ? buildSource(cur.candidates[0]) : null, (p) => {
    p.play();
  });

  // No playable URL (missing stream) → show the error+retry+back card immediately
  // instead of an infinite spinner with no way out.
  useEffect(() => {
    if (!cur.candidates.length) {
      setBuffering(false);
      setError(t('pl.unavailable'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur.candidates.length]);

  // Resume context: movies & episodes remember the exact position ("Continua a guardare").
  const progressCtx = useMemo(() => {
    if (cur.isLive) return null;
    if (cur.item && cur.item.kind === 'movie') {
      return { key: cur.item.id, kind: 'movie' as const, title: cur.item.name, poster: cur.item.logo, url: cur.candidates[0] };
    }
    if (params.url) {
      return { key: params.key || params.url, kind: 'episode' as const, title: params.title || cur.title, poster: params.poster, url: params.url };
    }
    return null;
  }, [cur, params.url, params.key, params.title, params.poster]);

  const resumeAt = useMemo(() => {
    if (!progressCtx) return 0;
    const explicit = Number(params.resumeAt) || 0;
    return explicit > 0 ? explicit : getProgress(progressCtx.key)?.position || 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressCtx, params.resumeAt]);

  const switchTo = useCallback(
    (next: Current) => {
      attempt.current = 0;
      setError(null);
      setBuffering(true);
      setCur(next);
      if (next.candidates[0]) player.replace(buildSource(next.candidates[0]));
      if (next.item) addRecent({ ...next.item });
    },
    [player, addRecent],
  );

  // record initial item as recent
  useEffect(() => {
    if (initial.item) addRecent({ ...initial.item });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Remember the last live channel (for "auto-start last channel on open").
  useEffect(() => {
    if (cur.isLive && cur.item) setLastLive(cur.item.id);
  }, [cur.isLive, cur.item, setLastLive]);

  // status / error handling with survival-mode retry
  useEffect(() => {
    const sub = player.addListener('statusChange', ({ status, error: err }) => {
      if (status === 'readyToPlay') {
        setBuffering(false);
        setError(null);
        if (!didSeek.current && resumeAt > 2) {
          try {
            player.currentTime = resumeAt;
          } catch {}
          didSeek.current = true;
        }
      } else if (status === 'loading') {
        setBuffering(true);
      } else if (status === 'error') {
        const next = attempt.current + 1;
        if (settings.survivalMode && next < cur.candidates.length) {
          attempt.current = next;
          // Same item, new source → let the resume seek re-apply on the fallback.
          didSeek.current = false;
          player.replace(buildSource(cur.candidates[next]));
        } else {
          setBuffering(false);
          setError(err?.message || t('pl.unavailable'));
        }
      }
    });
    const psub = player.addListener('playingChange', ({ isPlaying }) => setPlaying(isPlaying));
    return () => {
      sub.remove();
      psub.remove();
    };
  }, [player, cur.candidates, settings.survivalMode, resumeAt]);

  // Persist the exact playback position every few seconds and on exit.
  useEffect(() => {
    if (!progressCtx) return;
    const save = () => {
      try {
        const pos = player.currentTime ?? 0;
        const dur = player.duration ?? 0;
        if (pos > 5) {
          saveProgress({
            key: progressCtx.key,
            kind: progressCtx.kind,
            title: progressCtx.title,
            poster: progressCtx.poster,
            url: progressCtx.url,
            position: pos,
            duration: dur,
          });
        }
      } catch {}
    };
    const id = setInterval(save, 5000);
    return () => {
      clearInterval(id);
      save();
    };
  }, [player, progressCtx, saveProgress]);

  const showOverlay = useCallback(() => {
    setOverlay(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setOverlay(false), 4500);
  }, []);

  useEffect(() => {
    showOverlay();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [showOverlay]);

  // EPG (now/next) for live channels on Xtream sources.
  useEffect(() => {
    let alive = true;
    setEpg([]);
    if (cur.isLive && source?.type === 'xtream' && cur.item?.streamId) {
      getShortEpg(source, cur.item.streamId).then((list) => {
        if (alive) setEpg(list);
      });
    }
    return () => {
      alive = false;
    };
  }, [cur.isLive, cur.item?.streamId, source]);

  const zap = useCallback(
    (dir: number) => {
      if (!cur.isLive || content.live.length === 0) return;
      const n = content.live.length;
      const idx = ((cur.liveIndex + dir) % n + n) % n;
      const item = content.live[idx];
      switchTo({ title: item.name, candidates: liveCandidates(item, source, settings.liveExt), isLive: true, liveIndex: idx, item });
    },
    [cur.isLive, cur.liveIndex, content.live, source, settings.liveExt, switchTo],
  );

  const togglePlay = useCallback(() => {
    if (player.playing) player.pause();
    else player.play();
    showOverlay();
  }, [player, showOverlay]);

  useKeyHandler(
    (key) => {
      // NB: do NOT handle 'back' here — the OS/expo-router already pops the
      // screen. Handling it again caused a double-back that exited the app.
      showOverlay();
      if (key === 'playpause') {
        togglePlay();
        return true;
      }
      if (cur.isLive && (key === 'channelup' || key === 'channeldown')) {
        zap(key === 'channelup' ? 1 : -1);
        return true;
      }
      return false;
    },
    [cur.isLive, zap, togglePlay, showOverlay],
  );

  const fav = cur.item ? favorites.some((f) => f.id === cur.item!.id) : false;
  const nowSec = Date.now() / 1000;
  const epgNow = epg.find((e) => e.startTs <= nowSec && e.endTs > nowSec) || epg[0];
  const epgNext = epg.find((e) => e.startTs > (epgNow?.startTs || 0));

  return (
    <View style={styles.root}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit={settings.aspectMode}
        nativeControls={false}
      />

      {/* tap anywhere to toggle overlay */}
      <Pressable style={StyleSheet.absoluteFill} onPress={showOverlay} />

      {buffering && !error ? (
        <View style={styles.center} pointerEvents="none">
          <ActivityIndicator size="large" color={colors.accent} />
          <Txt variant="small" style={{ marginTop: spacing.sm }}>
            {t('common.loading')}
          </Txt>
        </View>
      ) : null}

      {error ? (
        <View style={styles.center}>
          <Ionicons name="warning" size={48} color={colors.danger} />
          <Txt variant="h3" style={{ marginTop: spacing.sm }}>
            {error}
          </Txt>
          <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
            <CtrlButton icon="refresh" label={t('common.retry')} autoFocus onPress={() => switchTo({ ...cur })} />
            <CtrlButton icon="arrow-back" label={t('common.back')} onPress={() => router.back()} />
          </View>
        </View>
      ) : null}

      {overlay ? (
        <>
          <View style={styles.topBar} pointerEvents="box-none">
            <View style={{ flex: 1 }}>
              <Txt variant="h2" numberOfLines={1}>
                {cur.title}
              </Txt>
              {epgNow ? (
                <Txt variant="small" numberOfLines={1} style={{ marginTop: 2 }}>
                  <Txt variant="small" color={colors.accent}>
                    {t('epg.now')}:{' '}
                  </Txt>
                  {epgNow.title} {hhmm(epgNow.startTs)}–{hhmm(epgNow.endTs)}
                </Txt>
              ) : null}
              {epgNext ? (
                <Txt variant="tiny" numberOfLines={1}>
                  {t('epg.next')}: {epgNext.title} {hhmm(epgNext.startTs)}
                </Txt>
              ) : null}
            </View>
            {cur.isLive ? (
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Txt variant="tiny" color={colors.text}>
                  {t('pl.live')}
                </Txt>
              </View>
            ) : null}
          </View>

          <View style={styles.controls} pointerEvents="box-none">
            <CtrlButton icon="arrow-back" label={t('common.back')} onPress={() => router.back()} />
            {cur.isLive ? <CtrlButton icon="play-skip-back" label={t('pl.prev')} onPress={() => zap(-1)} /> : null}
            <CtrlButton icon={playing ? 'pause' : 'play'} label={playing ? t('pl.pause') : t('pl.play')} autoFocus onPress={togglePlay} />
            {cur.isLive ? <CtrlButton icon="play-skip-forward" label={t('pl.next')} onPress={() => zap(1)} /> : null}
            <CtrlButton
              icon="resize"
              label={t('pl.format')}
              onPress={() =>
                useStore.getState().updateSettings({
                  aspectMode: settings.aspectMode === 'contain' ? 'cover' : settings.aspectMode === 'cover' ? 'fill' : 'contain',
                })
              }
            />
            {cur.item ? (
              <CtrlButton
                icon={fav ? 'heart' : 'heart-outline'}
                iconColor={fav ? colors.danger : undefined}
                label={t('pl.favorite')}
                onPress={() => cur.item && toggleFavorite(cur.item)}
              />
            ) : null}
            <CastControls url={cur.candidates[0]} title={cur.title} />
          </View>
        </>
      ) : null}
    </View>
  );
}

function CtrlButton({ icon, label, onPress, autoFocus, iconColor }: { icon: any; label: string; onPress: () => void; autoFocus?: boolean; iconColor?: string }) {
  return (
    <Focusable onSelect={onPress} autoFocus={autoFocus} style={styles.ctrl} focusStyle={styles.ctrlFocus}>
      {(f) => (
        <View style={{ alignItems: 'center', gap: 4 }}>
          <Ionicons name={icon} size={26} color={iconColor ?? (f ? colors.white : colors.text)} />
          <Txt variant="tiny" color={f ? colors.text : colors.textMuted}>
            {label}
          </Txt>
        </View>
      )}
    </Focusable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    paddingTop: spacing.xl,
    backgroundColor: 'rgba(10,10,15,0.7)',
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    backgroundColor: 'rgba(10,10,15,0.7)',
  },
  ctrl: {
    minWidth: 78,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  ctrlFocus: { borderColor: colors.borderFocus, backgroundColor: colors.surfaceHi },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.danger,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.white },
});
