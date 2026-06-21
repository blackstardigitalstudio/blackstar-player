import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Rail } from '@/components/Rail';
import { Empty, Txt } from '@/components/ui';
import { Focusable } from '@/tv/Focusable';
import { useStore } from '@/store/useStore';
import { usePlayback } from '@/lib/playback';
import { normalize, relatedItems, searchItems } from '@/lib/search';
import { useT } from '@/i18n';
import type { MediaItem } from '@/lib/types';
import { colors, font, radius, spacing } from '@/theme/tokens';

export default function Search() {
  const t = useT();
  const play = usePlayback();
  const content = useStore((s) => s.content);
  const [q, setQ] = useState('');
  const [dq, setDq] = useState(''); // debounced query — keeps typing smooth on huge lists
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setDq(q), 220);
    return () => clearTimeout(id);
  }, [q]);

  const pool = useMemo(() => [...content.movies, ...content.series, ...content.live], [content]);
  const scored = useMemo(() => searchItems(dq, pool, 200), [dq, pool]);
  const results = useMemo(() => scored.map((r) => r.item).slice(0, 60), [scored]);
  const suggestions = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const r of scored) {
      const k = normalize(r.item.name);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(r.item.name);
      if (out.length >= 8) break;
    }
    return out;
  }, [scored]);
  const related = useMemo(() => (scored[0] ? relatedItems(scored[0].item, pool) : []), [scored, pool]);

  const go = (item: MediaItem) => play.open(item);
  const ready = q.trim().length >= 2;
  const hasContent = pool.length > 0;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={22} color={colors.textMuted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder={t('search.ph')}
          placeholderTextColor={colors.textFaint}
          autoCorrect={false}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.input, focused && { borderColor: colors.borderFocus }]}
        />
        {q ? (
          <Focusable onSelect={() => setQ('')} style={styles.clear} focusStyle={{ borderColor: colors.borderFocus }}>
            <Ionicons name="close" size={18} color={colors.textMuted} />
          </Focusable>
        ) : null}
      </View>

      {!hasContent ? (
        <Empty icon="albums-outline" title={t('search.needPlaylist')} />
      ) : !ready ? (
        <Empty icon="search-outline" title={t('search.min2')} hint={t('search.min2Hint')} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }} keyboardShouldPersistTaps="handled">
          {suggestions.length > 0 ? (
            <View style={styles.suggestRow}>
              {suggestions.map((s) => (
                <Focusable key={s} onSelect={() => setQ(s)} style={styles.suggest} focusStyle={styles.suggestFocus}>
                  {(f) => (
                    <Txt variant="small" color={f ? colors.text : colors.textMuted} numberOfLines={1}>
                      {s}
                    </Txt>
                  )}
                </Focusable>
              ))}
            </View>
          ) : null}

          {results.length === 0 ? (
            <Empty icon="sad-outline" title={t('search.noResults', { q })} />
          ) : (
            <>
              <Rail title={t('search.results', { n: results.length })} items={results} onSelect={go} variant="poster" />
              <Rail title={t('search.related')} items={related} onSelect={go} variant="poster" />
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.text,
    fontSize: font.h3,
  },
  clear: { padding: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  suggestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  suggest: {
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    maxWidth: 280,
  },
  suggestFocus: { borderColor: colors.borderFocus, backgroundColor: colors.surfaceHi },
});
