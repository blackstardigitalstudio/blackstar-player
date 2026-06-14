import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Empty, GhostButton, Screen, Spinner, Txt } from '@/components/ui';
import { Focusable } from '@/tv/Focusable';
import { useStore } from '@/store/useStore';
import { m3uEpisodes } from '@/lib/m3u';
import { loadSeriesInfo } from '@/lib/xtream';
import { playUrl } from '@/lib/nav';
import type { Season } from '@/lib/types';
import { colors, radius, spacing } from '@/theme/tokens';

export default function SeriesDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const content = useStore((s) => s.content);
  const sources = useStore((s) => s.sources);
  const activeId = useStore((s) => s.activeId);
  const addRecent = useStore((s) => s.addRecent);

  const item = useMemo(() => content.series.find((x) => x.id === id), [content.series, id]);
  const source = sources.find((s) => s.id === activeId);

  const [seasons, setSeasons] = useState<Season[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!item) return;
      try {
        if (item.seriesId && source?.type === 'xtream') {
          const data = await loadSeriesInfo(source, item.seriesId);
          if (alive) setSeasons(data);
        } else {
          const eps = m3uEpisodes(item);
          const bySeason = new Map<number, typeof eps>();
          eps.forEach((e) => {
            const arr = bySeason.get(e.season) || [];
            arr.push(e);
            bySeason.set(e.season, arr);
          });
          const list: Season[] = Array.from(bySeason.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([season, episodes]) => ({ season, episodes }));
          if (alive) setSeasons(list);
        }
      } catch (e: any) {
        if (alive) setError(e?.message || 'Impossibile caricare gli episodi.');
      }
    })();
    return () => {
      alive = false;
    };
  }, [item, source]);

  if (!item) {
    return (
      <Screen>
        <Empty title="Serie non trovata" />
      </Screen>
    );
  }

  const season = seasons?.[sel];

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        <View style={{ marginBottom: spacing.md }}>
          <GhostButton label="Indietro" icon="arrow-back" onPress={() => router.back()} />
        </View>

        <View style={styles.head}>
          <View style={styles.cover}>
            {item.logo ? (
              <Image source={{ uri: item.logo }} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : (
              <Ionicons name="albums" size={48} color={colors.textFaint} />
            )}
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Txt variant="h1">{item.name}</Txt>
            {item.year ? <Txt variant="small">{item.year}</Txt> : null}
            {item.plot ? (
              <Txt variant="small" numberOfLines={5} style={{ marginTop: 4 }}>
                {item.plot}
              </Txt>
            ) : null}
          </View>
        </View>

        {error ? (
          <Empty title="Errore" hint={error} />
        ) : !seasons ? (
          <Spinner label="Caricamento episodi…" />
        ) : seasons.length === 0 ? (
          <Empty title="Nessun episodio trovato" />
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}>
              {seasons.map((s, i) => (
                <Focusable key={s.season} onSelect={() => setSel(i)} style={[styles.chip, i === sel && styles.chipActive]} focusStyle={styles.chipFocus}>
                  {(f) => (
                    <Txt variant="small" color={i === sel || f ? colors.text : colors.textMuted}>
                      Stagione {s.season}
                    </Txt>
                  )}
                </Focusable>
              ))}
            </ScrollView>

            <View style={{ gap: spacing.sm }}>
              {season?.episodes.map((ep) => (
                <Focusable
                  key={ep.id}
                  onSelect={() => {
                    addRecent({ ...item });
                    playUrl(router, ep.url, `${item.name} · S${ep.season}E${ep.episode}`);
                  }}
                  style={styles.ep}
                  focusStyle={styles.epFocus}
                >
                  {(f) => (
                    <View style={styles.epInner}>
                      <View style={styles.epNum}>
                        <Txt variant="small" color={colors.text}>
                          {ep.episode}
                        </Txt>
                      </View>
                      <Txt variant="body" style={{ flex: 1 }} numberOfLines={1}>
                        {ep.title}
                      </Txt>
                      <Ionicons name="play-circle" size={26} color={f ? colors.accent : colors.textMuted} />
                    </View>
                  )}
                </Focusable>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', gap: spacing.lg, marginBottom: spacing.md },
  cover: {
    width: 150,
    height: 220,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.accent, backgroundColor: colors.surfaceHi },
  chipFocus: { borderColor: colors.borderFocus },
  ep: { backgroundColor: colors.bgElevated, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  epFocus: { borderColor: colors.borderFocus, backgroundColor: colors.surfaceHi },
  epInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  epNum: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
