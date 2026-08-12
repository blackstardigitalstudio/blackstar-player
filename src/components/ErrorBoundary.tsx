import { Component, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { translate } from '@/i18n';
import { FocusLayer } from '@/tv/RemoteProvider';
import { useStore } from '@/store/useStore';
import { colors, radius, spacing } from '@/theme/tokens';
import { BrandMark, GhostButton, PrimaryButton, Txt } from './ui';

interface Props {
  children: ReactNode;
}

interface S {
  error: Error | null;
  /** Bumped on retry to remount the whole tree from scratch. */
  attempt: number;
}

/**
 * Last line of defence. Without this, any render error in a screen kills the
 * process on a release build: on a TV the user is left with a black screen and
 * a remote that does nothing, with nothing to report back. Here the same error
 * shows a readable screen with two exits — try again, or drop the saved catalog
 * and reload it from the provider (the usual culprit when it "worked until
 * yesterday": a stale or oversized cached list).
 *
 * The fallback lives in its own FocusLayer so the D-pad lands on the buttons
 * instead of chasing the focusables of the screen that just died.
 *
 * Nothing is sent anywhere; the detail is on screen for support and in logcat.
 * Made in Italy.
 */
export class ErrorBoundary extends Component<Props, S> {
  state: S = { error: null, attempt: 0 };

  static getDerivedStateFromError(error: Error): Partial<S> {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[Blackstar] render error:', error?.message, error?.stack);
  }

  private t = (key: string) => {
    try {
      return translate(useStore.getState().settings.language, key);
    } catch {
      return translate('it', key);
    }
  };

  private retry = () => this.setState((s) => ({ error: null, attempt: s.attempt + 1 }));

  private reset = async () => {
    // Drop the cached catalog: it is reloaded from the provider on the next render.
    try {
      await useStore.getState().clearCache();
    } catch {}
    this.retry();
  };

  render() {
    const { error, attempt } = this.state;
    if (!error) {
      return (
        <View key={attempt} style={styles.flex}>
          {this.props.children}
        </View>
      );
    }

    return (
      <View style={styles.screen}>
        <FocusLayer>
          <ScrollView contentContainerStyle={styles.content}>
            <BrandMark size={38} />
            <Txt variant="h2" style={{ marginTop: spacing.xl, textAlign: 'center' }}>
              {this.t('err.title')}
            </Txt>
            <Txt variant="body" color={colors.textMuted} style={styles.body}>
              {this.t('err.body')}
            </Txt>

            <View style={styles.actions}>
              <PrimaryButton label={this.t('err.retry')} icon="refresh-outline" onPress={this.retry} autoFocus />
              <GhostButton label={this.t('err.reset')} icon="trash-outline" onPress={this.reset} />
            </View>

            <View style={styles.detail}>
              <Txt variant="tiny" color={colors.textFaint}>
                {this.t('err.detail')}
              </Txt>
              <Txt variant="tiny" color={colors.textMuted} style={{ marginTop: 4 }}>
                {String(error?.message || error)}
              </Txt>
            </View>
          </ScrollView>
        </FocusLayer>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  body: { marginTop: spacing.md, textAlign: 'center', maxWidth: 620 },
  actions: { marginTop: spacing.xl, gap: spacing.md, alignItems: 'center' },
  detail: {
    marginTop: spacing.xl,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    maxWidth: 680,
  },
});
