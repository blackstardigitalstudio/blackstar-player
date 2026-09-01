import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, BackHandler, StyleSheet, View } from 'react-native';
import { FocusScrollView } from '@/tv/FocusScroll';
import { ContinueRail } from '@/components/ContinueRail';
import { Rail } from '@/components/Rail';
import { Empty, Spinner, Txt } from '@/components/ui';
import { Focusable } from '@/tv/Focusable';
import { useKeyHandler } from '@/tv/RemoteProvider';
import { useStore } from '@/store/useStore';
import { usePlayback } from '@/lib/playback';
import { useVisibleContent } from '@/lib/content';
import { recommendFromRecents } from '@/lib/search';
import { becauseYouWatched, itemsInCategory, topCategories } from '@/lib/recommend';
import { useT } from '@/i18n';
import type { MediaItem } from '@/lib/types';
import { colors, radius, spacing } from '@/theme/tokens';

// Fires the auto-start-last-channel at most once per app launch (module scope).
let autoStartedThisLaunch = false;

export default function Home() {
  const t = useT();
  const router = useRouter();
  const play = usePlayback();
  const content = useVisibleContent();
  const loading = useStore((s) => s.loading);
  const error = useStore((s) => s.error);
  const recents = useStore((s) => s.recents);
  const favorites = useStore((s) => s.favorites);
  const progress = useStore((s) => s.progress);
  const taste = useStore((s) => s.taste);
  const bannerText = useStore((s) => s.settings.bannerText);
  const autoStart = useStore((s) => s.settings.autoStartLastChannel);
  const lastLiveId = useStore((s) => s.lastLiveId);
  const confirmExit = useStore((s) => s.settings.confirmExit);

  // Ask before exiting the app from Home (only while Home is focused). Elsewhere
  // BACK just navigates back.
  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        if (!confirmExit) return false; // let the OS close the app
        Alert.alert('Blackstar Player', t('exit.confirm'), [
          { text: t('pin.cancel'), style: 'cancel' },
          { text: t('exit.yes'), style: 'destructive', onPress: () => BackHandler.exitApp() },
        ]);
        return true; // consume back
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [confirmExit, t]),
  );

  // Recommendations pool = VOD only (movies+series), capped, so the taste engine
  // never tokenizes a 10k-channel live list on the render path (was a real hitch).
  const pool = useMemo(() => [...content.movies, ...content.series].slice(0, 2500), [content.movies, content.series]);
  const recommended = useMemo(() => recommendFromRecents(recents, pool), [recents, pool]);
  const continueList = useMemo(
    () => Object.values(progress).filter((p) => p.position > 5).sort((a, b) => b.updatedAt - a.updatedAt),
    [progress],
  );
  const watchedIds = useMemo(() => new Set(recents.map((r) => r.id)), [recents]);
  const bywRows = useMemo(() => becauseYouWatched(recents, pool), [recents, pool]);
  const tasteRows = useMemo(
    () =>
      topCategories(taste, 3)
        .map((cat) => ({ cat, items: itemsInCategory(pool, cat, watchedIds) }))
        .filter((r) => r.items.length >= 4),
    [taste, pool, watchedIds],
  );

  // Number-bar zapping (TV).
  const [typed, setTyped] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jumpToNumber = useCallback(
    (num: string) => {
      const ch = content.live.find((c) => c.number === Number(num));
      setTyped('');
      if (ch) play.open(ch);
    },
    [content.live, play],
  );
  useKeyHandler(
    (key) => {
      if (key.startsWith('digit:')) {
        const next = (typed + key.split(':')[1]).slice(0, 4);
        setTyped(next);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => jumpToNumber(next), 1600);
        return true;
      }
      if (key === 'select' && typed) {
        if (timer.current) clearTimeout(timer.current);
        jumpToNumber(typed);
        return true;
      }
      return false;
    },
    [typed, jumpToNumber],
  );

  const go = (item: MediaItem) => play.open(item);
  const hasAny = content.live.length + content.movies.length + content.series.length > 0;

  // Auto-start the last live channel once per app launch (opt-in). Fires only when
  // content is loaded and the channel still exists; the player's Back returns here.
  useEffect(() => {
    if (autoStartedThisLaunch) return;
    if (!autoStart || !lastLiveId || !content.live.length) return;
    const ch = content.live.find((c) => c.id === lastLiveId);
    if (ch) {
      autoStartedThisLaunch = true;
      play.open(ch);
    }
  }, [autoStart, lastLiveId, content.live, play]);

  return (
    <View style={{ flex: 1 }}>
      {/* No "Aggiorna" button up here any more: it reloaded the channel list (which
          the app already refreshes on its own, and Impostazioni → "Aggiorna lista
          ora" does on demand, with a confirmation), it gave no feedback, and being
          the first focusable it stole the opening focus from the content. */}
      <View style={styles.header}>
        <Txt variant="h2" numberOfLines={1}>{bannerText || 'Blackstar'}</Txt>
      </View>

      {loading && !hasAny ? (
        <Spinner label={t('home.loadingList')} />
      ) : !hasAny ? (
        <Empty
          icon="cloud-offline-outline"
          title={error ? t('home.cantLoad') : t('home.emptyList')}
          hint={error ?? t('home.emptyHint')}
          // No list yet → send them straight to add one. On error → let them retry.
          action={
            error
              ? { label: t('common.refresh'), icon: 'refresh', onPress: () => useStore.getState().refresh(true) }
              : { label: t('set.addProfile'), icon: 'add', onPress: () => router.push('/onboarding') }
          }
        />
      ) : (
        <FocusScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
          {/* No section tiles here on purpose: the side menu already switches
              between Live / Film / Serie / Cerca, so repeating them as big tiles
              was the same choice twice, right where the eye lands first. Home is
              now what you were watching and what to watch next. */}
          {/* Recommendations (kept) */}
          <ContinueRail
            entries={continueList}
            onSelect={(e) => play.playEntry(e.url, e.title, { key: e.key, poster: e.poster, resumeAt: e.position })}
          />
          {favorites.length ? <Rail title={t('home.favorites')} items={favorites} onSelect={go} variant="poster" /> : null}
          {bywRows.map((r) => (
            <Rail key={`byw-${r.seed.id}`} title={t('home.becauseWatched', { name: r.seed.name })} items={r.items} onSelect={go} variant="poster" />
          ))}
          {tasteRows.map((r) => (
            <Rail key={`cat-${r.cat}`} title={t('home.becauseLike', { cat: r.cat })} items={r.items} onSelect={go} variant="poster" />
          ))}
          <Rail title={t('home.recommended')} items={recommended} onSelect={go} variant="poster" />
        </FocusScrollView>
      )}

      {typed ? (
        <View style={styles.zap}>
          <Ionicons name="tv" size={28} color={colors.accent} />
          <Txt variant="display" color={colors.text}>
            {typed}
          </Txt>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  zap: {
    position: 'absolute',
    top: spacing.xl,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: 'rgba(10,10,15,0.94)',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.accent,
  },
});
