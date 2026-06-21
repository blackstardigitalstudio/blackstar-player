import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ContinueRail } from '@/components/ContinueRail';
import { Rail } from '@/components/Rail';
import { Empty, GhostButton, Spinner, Txt } from '@/components/ui';
import { useKeyHandler } from '@/tv/RemoteProvider';
import { useStore } from '@/store/useStore';
import { usePlayback } from '@/lib/playback';
import { useVisibleContent } from '@/lib/content';
import { recommendFromRecents } from '@/lib/search';
import { useT } from '@/i18n';
import type { MediaItem } from '@/lib/types';
import { colors, radius, spacing } from '@/theme/tokens';

export default function Home() {
  const t = useT();
  const play = usePlayback();
  const content = useVisibleContent();
  const loading = useStore((s) => s.loading);
  const error = useStore((s) => s.error);
  const recents = useStore((s) => s.recents);
  const favorites = useStore((s) => s.favorites);
  const progress = useStore((s) => s.progress);
  const sources = useStore((s) => s.sources);
  const activeId = useStore((s) => s.activeId);
  const refresh = useStore((s) => s.refresh);
  const showNumbers = useStore((s) => s.settings.showChannelNumbers);

  const activeName = sources.find((s) => s.id === activeId)?.name ?? '';
  const pool = useMemo(() => [...content.movies, ...content.series, ...content.live], [content]);
  const recommended = useMemo(() => recommendFromRecents(recents, pool), [recents, pool]);
  const continueList = useMemo(
    () => Object.values(progress).filter((p) => p.position > 5).sort((a, b) => b.updatedAt - a.updatedAt),
    [progress],
  );

  const [typed, setTyped] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const jumpToNumber = useCallback(
    (num: string) => {
      const n = Number(num);
      const ch = content.live.find((c) => c.number === n);
      setTyped('');
      if (ch) play.open(ch);
    },
    [content.live, play],
  );

  useKeyHandler(
    (key) => {
      if (key.startsWith('digit:')) {
        const d = key.split(':')[1];
        const next = (typed + d).slice(0, 4);
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

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <View>
          <Txt variant="h2">{t('home.hi')}</Txt>
          <Txt variant="small">{activeName ? t('home.activeProfile', { name: activeName }) : t('home.noProfile')}</Txt>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {showNumbers && content.live.length > 0 ? (
            <View style={styles.hint}>
              <Ionicons name="keypad" size={16} color={colors.textMuted} />
              <Txt variant="tiny">{t('home.zapHint')}</Txt>
            </View>
          ) : null}
          <GhostButton label={t('common.refresh')} icon="refresh" onPress={() => refresh(true)} />
        </View>
      </View>

      {loading && !hasAny ? (
        <Spinner label={t('home.loadingList')} />
      ) : !hasAny ? (
        <Empty
          icon="cloud-offline-outline"
          title={error ? t('home.cantLoad') : t('home.emptyList')}
          hint={error ?? t('home.emptyHint')}
        />
      ) : (
        <ScrollView contentContainerStyle={{ paddingTop: spacing.sm, paddingBottom: spacing.xxl }}>
          <ContinueRail
            entries={continueList}
            onSelect={(e) => play.playEntry(e.url, e.title, { key: e.key, poster: e.poster, resumeAt: e.position })}
          />
          <Rail title={t('home.recommended')} items={recommended} onSelect={go} variant="poster" />
          <Rail title={t('home.favorites')} items={favorites} onSelect={go} variant="poster" />
          <Rail title={t('home.liveChannels')} items={content.live.slice(0, 24)} onSelect={go} variant="tile" />
          <Rail title={t('home.movies')} items={content.movies.slice(0, 24)} onSelect={go} variant="poster" />
          <Rail title={t('home.series')} items={content.series.slice(0, 24)} onSelect={go} variant="poster" />
        </ScrollView>
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
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
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
