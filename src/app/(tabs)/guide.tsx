import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { Empty, Txt } from '@/components/ui';
import { Focusable } from '@/tv/Focusable';
import { useVisibleContent } from '@/lib/content';
import { usePlayback } from '@/lib/playback';
import { useStore } from '@/store/useStore';
import { getShortEpg, type EpgItem } from '@/lib/xtream';
import { useT } from '@/i18n';
import type { MediaItem, SourceConfig } from '@/lib/types';
import { colors, radius, spacing } from '@/theme/tokens';

const ROW_H = 120;
const epgCache = new Map<string, EpgItem[]>();

function hhmm(ts: number) {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function GuideRow({ channel, source, onPlay }: { channel: MediaItem; source?: SourceConfig; onPlay: () => void }) {
  const t = useT();
  const [epg, setEpg] = useState<EpgItem[]>(() => (channel.streamId ? epgCache.get(channel.streamId) ?? [] : []));

  useEffect(() => {
    let alive = true;
    const id = channel.streamId;
    if (source?.type === 'xtream' && id && !epgCache.has(id)) {
      getShortEpg(source, id, 6).then((list) => {
        epgCache.set(id, list);
        if (alive) setEpg(list);
      });
    }
    return () => {
      alive = false;
    };
  }, [channel.streamId, source]);

  const nowSec = Date.now() / 1000;

  return (
    <View style={styles.row}>
      <Focusable onSelect={onPlay} style={styles.chanCell} focusStyle={styles.chanFocus}>
        {(f) => (
          <View style={{ alignItems: 'center', gap: 4 }}>
            {channel.logo ? (
              <Image source={{ uri: channel.logo }} style={styles.logo} contentFit="contain" />
            ) : (
              <Ionicons name="tv" size={28} color={colors.textFaint} />
            )}
            <Txt variant="tiny" numberOfLines={1} color={f ? colors.text : colors.textMuted}>
              {channel.number ? `${channel.number}. ` : ''}
              {channel.name}
            </Txt>
          </View>
        )}
      </Focusable>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.lg }}>
        {epg.length === 0 ? (
          <View style={styles.progEmpty}>
            <Txt variant="tiny">{t('guide.noProgram')}</Txt>
          </View>
        ) : (
          epg.map((p, i) => {
            const live = p.startTs <= nowSec && p.endTs > nowSec;
            return (
              <Focusable key={i} onSelect={onPlay} style={[styles.prog, live && styles.progLive]} focusStyle={styles.progFocus}>
                {(f) => (
                  <View>
                    <Txt variant="tiny" color={live ? colors.accent : colors.textFaint}>
                      {hhmm(p.startTs)}–{hhmm(p.endTs)}
                    </Txt>
                    <Txt variant="small" numberOfLines={2} color={f || live ? colors.text : colors.textMuted}>
                      {p.title}
                    </Txt>
                  </View>
                )}
              </Focusable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

export default function Guide() {
  const t = useT();
  const play = usePlayback();
  const content = useVisibleContent();
  const sources = useStore((s) => s.sources);
  const activeId = useStore((s) => s.activeId);
  const source = sources.find((s) => s.id === activeId);

  if (!content.live.length) {
    return <Empty icon="grid-outline" title={t('guide.title')} hint={t('guide.onlyXtream')} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <Txt variant="h2" style={{ padding: spacing.lg, paddingBottom: spacing.sm }}>
        {t('guide.title')}
      </Txt>
      {source?.type !== 'xtream' ? (
        <Txt variant="small" style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>
          {t('guide.onlyXtream')}
        </Txt>
      ) : null}
      <FlatList
        data={content.live}
        keyExtractor={(c) => c.id}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
        getItemLayout={(_, index) => ({ length: ROW_H, offset: ROW_H * index, index })}
        renderItem={({ item }) => <GuideRow channel={item} source={source} onPlay={() => play.open(item)} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { height: ROW_H, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingLeft: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  chanCell: { width: 130, height: ROW_H - 20, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', padding: 6 },
  chanFocus: { borderWidth: 2, borderColor: colors.borderFocus },
  logo: { width: 70, height: 46 },
  prog: { width: 180, height: ROW_H - 28, borderRadius: radius.md, backgroundColor: colors.bgElevated, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, justifyContent: 'center', gap: 4 },
  progLive: { borderColor: colors.accent },
  progFocus: { borderColor: colors.borderFocus, backgroundColor: colors.surfaceHi },
  progEmpty: { width: 180, height: ROW_H - 28, borderRadius: radius.md, backgroundColor: colors.bgElevated, alignItems: 'center', justifyContent: 'center' },
});
