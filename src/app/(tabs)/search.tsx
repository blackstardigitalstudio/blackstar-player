import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Rail } from '@/components/Rail';
import { Empty, Txt } from '@/components/ui';
import { Focusable } from '@/tv/Focusable';
import { useStore } from '@/store/useStore';
import { openItem } from '@/lib/nav';
import { relatedItems, searchItems, suggestTitles } from '@/lib/search';
import type { MediaItem } from '@/lib/types';
import { colors, font, radius, spacing } from '@/theme/tokens';

export default function Search() {
  const router = useRouter();
  const content = useStore((s) => s.content);
  const [q, setQ] = useState('');
  const [focused, setFocused] = useState(false);

  const pool = useMemo(() => [...content.movies, ...content.series, ...content.live], [content]);
  const results = useMemo(() => searchItems(q, pool).map((r) => r.item), [q, pool]);
  const suggestions = useMemo(() => suggestTitles(q, pool), [q, pool]);
  const related = useMemo(() => (results[0] ? relatedItems(results[0], pool) : []), [results, pool]);

  const go = (item: MediaItem) => openItem(router, item);
  const ready = q.trim().length >= 2;
  const hasContent = pool.length > 0;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={22} color={colors.textMuted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Cerca film, serie o canali…"
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
        <Empty icon="albums-outline" title="Aggiungi una playlist per iniziare a cercare" />
      ) : !ready ? (
        <Empty icon="search-outline" title="Digita almeno 2 caratteri" hint="Suggerimenti e titoli correlati appariranno mentre scrivi." />
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
            <Empty icon="sad-outline" title={`Nessun risultato per “${q}”`} />
          ) : (
            <>
              <Rail title={`Risultati (${results.length})`} items={results} onSelect={go} variant="poster" />
              <Rail title="Titoli correlati" items={related} onSelect={go} variant="poster" />
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
