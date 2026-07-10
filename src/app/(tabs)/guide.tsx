import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { Empty, Txt } from '@/components/ui';
import { Focusable } from '@/tv/Focusable';
import { FocusList } from '@/tv/FocusList';
import { useVisibleContent } from '@/lib/content';
import { usePlayback } from '@/lib/playback';
import { useStore } from '@/store/useStore';
import { getShortEpg, type EpgItem } from '@/lib/xtream';
import { useT } from '@/i18n';
import type { MediaItem, SourceConfig } from '@/lib/types';
import { colors, radius, spacing } from '@/theme/tokens';

const ROW_H = 84;
const HEADER_H = 40;
const CHAN_W = 132;
const PX_PER_HOUR = 360;
const HOURS = 6;
const TIMELINE_W = HOURS * PX_PER_HOUR;

const epgCache = new Map<string, EpgItem[]>();

function hhmm(ts: number) {
  const d = new Date(ts * 1000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function TimeHeader({ startSec, nowX }: { startSec: number; nowX: number }) {
  const ticks = [];
  for (let i = 0; i <= HOURS * 2; i++) {
    const x = (i * PX_PER_HOUR) / 2;
    ticks.push(
      <View key={i} style={[styles.tick, { left: x }]}>
        <Txt variant="tiny" color={colors.textMuted}>
          {hhmm(startSec + i * 1800)}
        </Txt>
      </View>,
    );
  }
  return (
    <View style={[styles.header, { width: TIMELINE_W }]}>
      {ticks}
      {nowX >= 0 && nowX <= TIMELINE_W ? <View style={[styles.nowDot, { left: nowX - 4 }]} /> : null}
    </View>
  );
}

function ProgramRow({ channel, source, startSec, onPlay }: { channel: MediaItem; source?: SourceConfig; startSec: number; onPlay: () => void }) {
  const t = useT();
  const [epg, setEpg] = useState<EpgItem[]>(() => (channel.streamId ? epgCache.get(channel.streamId) ?? [] : []));

  useEffect(() => {
    let alive = true;
    const id = channel.streamId;
    if (source?.type === 'xtream' && id && !epgCache.has(id)) {
      getShortEpg(source, id, 12).then((list) => {
        epgCache.set(id, list);
        if (alive) setEpg(list);
      });
    }
    return () => {
      alive = false;
    };
  }, [channel.streamId, source]);

  const nowSec = Date.now() / 1000;
  const endWindow = startSec + HOURS * 3600;
  const blocks = epg.filter((p) => p.endTs > startSec && p.startTs < endWindow);

  return (
    <View style={[styles.progRow, { width: TIMELINE_W }]}>
      {blocks.length === 0 ? (
        <Focusable onSelect={onPlay} style={[styles.block, { left: 0, width: TIMELINE_W - 4 }]} focusStyle={styles.blockFocus}>
          <Txt variant="tiny" color={colors.textFaint}>
            {t('guide.noProgram')}
          </Txt>
        </Focusable>
      ) : (
        blocks.map((p, i) => {
          const left = Math.max(0, ((p.startTs - startSec) / 3600) * PX_PER_HOUR);
          const right = Math.min(TIMELINE_W, ((p.endTs - startSec) / 3600) * PX_PER_HOUR);
          const live = p.startTs <= nowSec && p.endTs > nowSec;
          return (
            <Focusable key={i} onSelect={onPlay} style={[styles.block, { left, width: Math.max(56, right - left - 4) }, live && styles.blockLive]} focusStyle={styles.blockFocus}>
              {(f) => (
                <View>
                  <Txt variant="tiny" color={live ? colors.accent : colors.textFaint}>
                    {hhmm(p.startTs)}
                  </Txt>
                  <Txt variant="small" numberOfLines={1} color={f || live ? colors.text : colors.textMuted}>
                    {p.title}
                  </Txt>
                </View>
              )}
            </Focusable>
          );
        })
      )}
    </View>
  );
}

function ChannelCell({ channel, onPlay }: { channel: MediaItem; onPlay: () => void }) {
  return (
    <Focusable onSelect={onPlay} style={styles.chanCell} focusStyle={styles.chanFocus}>
      {(f) => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {channel.logo ? (
            <Image source={{ uri: channel.logo }} style={styles.logo} contentFit="contain" recyclingKey={channel.id} cachePolicy="memory-disk" />
          ) : (
            <Ionicons name="tv" size={22} color={colors.textFaint} />
          )}
          <Txt variant="small" numberOfLines={2} color={f ? colors.text : colors.textMuted} style={{ flex: 1 }}>
            {channel.number ? `${channel.number}. ` : ''}
            {channel.name}
          </Txt>
        </View>
      )}
    </Focusable>
  );
}

export default function Guide() {
  const t = useT();
  const play = usePlayback();
  const content = useVisibleContent();
  const sources = useStore((s) => s.sources);
  const activeId = useStore((s) => s.activeId);
  const source = sources.find((s) => s.id === activeId);

  const [gridH, setGridH] = useState(0);
  const leftRef = useRef<FlatList>(null);
  const rightRef = useRef<FlatList>(null);
  const syncing = useRef(false);

  const startSec = useMemo(() => Math.floor(Date.now() / 1000 / 1800) * 1800, []);
  const nowX = ((Date.now() / 1000 - startSec) / 3600) * PX_PER_HOUR;

  const sync = (target: React.RefObject<FlatList | null>, y: number) => {
    if (syncing.current) return;
    syncing.current = true;
    target.current?.scrollToOffset({ offset: y, animated: false });
    requestAnimationFrame(() => {
      syncing.current = false;
    });
  };

  if (!content.live.length) {
    return <Empty icon="grid-outline" title={t('guide.title')} hint={t('guide.noChannels')} />;
  }

  const listH = Math.max(0, gridH - HEADER_H);

  return (
    <View style={{ flex: 1 }}>
      <Txt variant="h2" style={{ padding: spacing.lg, paddingBottom: spacing.sm }}>
        {t('guide.title')}
        {source?.type !== 'xtream' ? <Txt variant="small">{`   ·   ${t('guide.onlyXtream')}`}</Txt> : null}
      </Txt>

      <View style={{ flex: 1, flexDirection: 'row' }} onLayout={(e) => setGridH(e.nativeEvent.layout.height)}>
        {/* Fixed channel column */}
        <View style={{ width: CHAN_W }}>
          <View style={{ height: HEADER_H, borderBottomWidth: 1, borderBottomColor: colors.border }} />
          <FocusList
            ref={leftRef}
            data={content.live}
            keyExtractor={(c: MediaItem) => c.id}
            style={{ height: listH }}
            onScroll={(e: any) => sync(rightRef, e.nativeEvent.contentOffset.y)}
            showsVerticalScrollIndicator={false}
            getItemLayout={(_: any, index: number) => ({ length: ROW_H, offset: ROW_H * index, index })}
            renderItem={({ item }: { item: MediaItem }) => (
              <View style={styles.chanRow}>
                <ChannelCell channel={item} onPlay={() => play.open(item)} />
              </View>
            )}
          />
        </View>

        {/* Scrollable timeline */}
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View style={{ width: TIMELINE_W, height: gridH }}>
            <TimeHeader startSec={startSec} nowX={nowX} />
            <FocusList
              ref={rightRef}
              data={content.live}
              keyExtractor={(c: MediaItem) => c.id}
              style={{ height: listH }}
              onScroll={(e: any) => sync(leftRef, e.nativeEvent.contentOffset.y)}
              showsVerticalScrollIndicator={false}
              getItemLayout={(_: any, index: number) => ({ length: ROW_H, offset: ROW_H * index, index })}
              renderItem={({ item }: { item: MediaItem }) => <ProgramRow channel={item} source={source} startSec={startSec} onPlay={() => play.open(item)} />}
            />
            {nowX >= 0 && nowX <= TIMELINE_W ? <View pointerEvents="none" style={[styles.nowLine, { left: nowX, height: listH, top: HEADER_H }]} /> : null}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { height: HEADER_H, borderBottomWidth: 1, borderBottomColor: colors.border },
  tick: { position: 'absolute', top: 10, left: 0, paddingLeft: 4, borderLeftWidth: 1, borderLeftColor: colors.border, height: HEADER_H - 10, justifyContent: 'flex-start' },
  nowDot: { position: 'absolute', top: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  chanRow: { height: ROW_H, borderBottomWidth: 1, borderBottomColor: colors.border, justifyContent: 'center', paddingHorizontal: 8 },
  chanCell: { flex: 1, justifyContent: 'center', paddingVertical: 4 },
  chanFocus: { backgroundColor: colors.surfaceHi, borderRadius: radius.sm },
  logo: { width: 34, height: 34 },
  progRow: { height: ROW_H, borderBottomWidth: 1, borderBottomColor: colors.border },
  block: {
    position: 'absolute',
    top: 8,
    height: ROW_H - 16,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    justifyContent: 'center',
    gap: 2,
  },
  blockLive: { borderColor: colors.accent },
  blockFocus: { borderColor: colors.borderFocus, backgroundColor: colors.surfaceHi },
  nowLine: { position: 'absolute', width: 2, backgroundColor: colors.accent, opacity: 0.8 },
});
