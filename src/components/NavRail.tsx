import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Focusable } from '@/tv/Focusable';
import { colors, font, radius, spacing } from '@/theme/tokens';
import { Txt } from './ui';

const ITEMS = [
  { key: 'home', label: 'Home', icon: 'home', path: '/(tabs)/home' },
  { key: 'live', label: 'Live TV', icon: 'tv', path: '/(tabs)/live' },
  { key: 'movies', label: 'Film', icon: 'film', path: '/(tabs)/movies' },
  { key: 'series', label: 'Serie TV', icon: 'albums', path: '/(tabs)/series' },
  { key: 'search', label: 'Cerca', icon: 'search', path: '/(tabs)/search' },
  { key: 'settings', label: 'Impostazioni', icon: 'settings', path: '/(tabs)/settings' },
] as const;

export function NavRail() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View style={styles.rail}>
      <View style={styles.brand}>
        <Ionicons name="star" size={26} color={colors.accent} />
      </View>
      {ITEMS.map((it) => {
        const active = pathname.includes(it.key);
        return (
          <Focusable
            key={it.key}
            focusKey={`nav-${it.key}`}
            onSelect={() => router.replace(it.path as any)}
            style={styles.item}
            focusStyle={styles.itemFocus}
          >
            {(focused) => (
              <View style={[styles.itemInner, active && styles.itemActive]}>
                <Ionicons
                  name={it.icon as any}
                  size={24}
                  color={active || focused ? colors.accent : colors.textMuted}
                />
                <Txt
                  variant="small"
                  style={{
                    color: active || focused ? colors.text : colors.textMuted,
                    fontWeight: active ? font.weightBold : font.weightReg,
                  }}
                >
                  {it.label}
                </Txt>
              </View>
            )}
          </Focusable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    width: 184,
    backgroundColor: colors.bgElevated,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingVertical: spacing.lg,
    gap: 4,
  },
  brand: { alignItems: 'center', marginBottom: spacing.lg },
  item: { marginHorizontal: spacing.sm, borderRadius: radius.md },
  itemFocus: { backgroundColor: colors.surfaceHi },
  itemInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  itemActive: { backgroundColor: colors.surface },
});
