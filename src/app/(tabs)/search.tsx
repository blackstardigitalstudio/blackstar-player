import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { FocusScrollView } from '@/tv/FocusScroll';
import { Rail } from '@/components/Rail';
import { Empty, Txt } from '@/components/ui';
import { Focusable } from '@/tv/Focusable';
import { usePlayback } from '@/lib/playback';
import { useVisibleContent } from '@/lib/content';
import { normalize, relatedItems, searchItems } from '@/lib/search';
import { itemsInCategory } from '@/lib/recommend';
import { useT } from '@/i18n';
import type { MediaItem } from '@/lib/types';
import { colors, font, radius, spacing } from '@/theme/tokens';

export default function Search() {
  const t = useT();
  const play = usePlayback();
  const content = useVisibleContent();
  const [q, setQ] = useState('');
  const [dq, setDq] = useState(''); // debounced query — keeps typing smooth on huge lists
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

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
  const genre = scored[0]?.item.categoryName || scored[0]?.item.group;
  const moreFromGenre = useMemo(
    () => (genre ? itemsInCategory(pool, genre, new Set(results.map((r) => r.id))) : []),
    [genre, pool, results],
  );

  const go = (item: MediaItem) => play.open(item);
  const ready = q.trim().length >= 2;
  const hasContent = pool.length > 0;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={22} color={colors.textMuted} />
        <Focusable
          autoFocus
          onSelect={() => inputRef.current?.focus()}
          onFocus={() => inputRef.current?.focus()}
          style={{ flex: 1 }}
          focusStyle={{}}
        >
          {(ring, focusSelf) => (
            <TextInput
              ref={inputRef}
              value={q}
              onChangeText={setQ}
              placeholder={t('search.ph')}
              placeholderTextColor={colors.textFaint}
              autoCorrect={false}
              onFocus={() => {
                setFocused(true);
                focusSelf();
              }}
              onBlur={() => setFocused(false)}
              style={[styles.input, (focused || ring) && { borderColor: colors.borderFocus }]}
            />
          )}
        </Focusable>
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
        <FocusScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
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
              {genre ? <Rail title={t('search.more', { cat: genre })} items={moreFromGenre} onSelect={go} variant="poster" /> : null}
              <Rail title={t('search.related')} items={related} onSelect={go} variant="poster" />
            </>
          )}
        </FocusScrollView>
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
