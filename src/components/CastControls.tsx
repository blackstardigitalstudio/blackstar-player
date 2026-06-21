import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import CastContext, { CastState, useCastState, useRemoteMediaClient } from 'react-native-google-cast';
import { Focusable } from '@/tv/Focusable';
import { useT } from '@/i18n';
import { colors, radius, spacing } from '@/theme/tokens';
import { Txt } from './ui';

function contentType(url: string): string {
  if (/\.m3u8/i.test(url)) return 'application/x-mpegURL';
  if (/\.mp4/i.test(url)) return 'video/mp4';
  if (/\.mkv/i.test(url)) return 'video/x-matroska';
  if (/\.ts(\?|$)/i.test(url)) return 'application/x-mpegURL';
  return 'video/mp4';
}

/**
 * True Chromecast control (no native view → safe on the new architecture).
 * Connected → casts the current stream; otherwise opens the device picker.
 * Fully guarded so it never crashes on devices without Google Play Services.
 */
export function CastControls({ url, title }: { url?: string; title: string }) {
  const t = useT();
  const client = useRemoteMediaClient();
  const state = useCastState();
  const connected = state === CastState.CONNECTED;

  const cast = async () => {
    try {
      if (client && url) {
        await client.loadMedia({
          mediaInfo: { contentUrl: url, contentType: contentType(url), metadata: { type: 'generic', title } },
        });
      } else {
        await CastContext.showCastDialog();
      }
    } catch {
      // ignore (no devices / no Play Services)
    }
  };

  return (
    <Focusable onSelect={cast} style={styles.ctrl} focusStyle={styles.ctrlFocus}>
      {(f) => (
        <View style={{ alignItems: 'center', gap: 4 }}>
          <Ionicons name={connected ? 'tv' : 'tv-outline'} size={26} color={connected ? colors.accent : f ? colors.white : colors.text} />
          <Txt variant="tiny" color={f ? colors.text : colors.textMuted}>
            {t('pl.cast')}
          </Txt>
        </View>
      )}
    </Focusable>
  );
}

const styles = StyleSheet.create({
  ctrl: {
    minWidth: 78,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  ctrlFocus: { borderColor: colors.borderFocus, backgroundColor: colors.surfaceHi },
});
