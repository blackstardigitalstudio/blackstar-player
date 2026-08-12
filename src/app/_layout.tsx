import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RemoteProvider } from '@/tv/RemoteProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { UpdateGate } from '@/components/UpdateGate';
import { useStore } from '@/store/useStore';
import { colors } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => {});

const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.bgElevated, primary: colors.accent },
};

export default function RootLayout() {
  const hydrate = useStore((s) => s.hydrate);
  const hydrated = useStore((s) => s.hydrated);

  useEffect(() => {
    hydrate().catch(() => {});
  }, [hydrate]);

  useEffect(() => {
    if (hydrated) SplashScreen.hideAsync().catch(() => {});
  }, [hydrated]);

  // Safety net: never leave the native splash up if hydration somehow never
  // reports back — on a TV a frozen logo is indistinguishable from a dead box.
  useEffect(() => {
    const t = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 6000);
    return () => clearTimeout(t);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <ThemeProvider value={navTheme}>
          <RemoteProvider>
            <StatusBar style="light" />
            <ErrorBoundary>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.bg },
                  animation: 'fade',
                }}
              >
                <Stack.Screen name="index" />
                <Stack.Screen name="onboarding" />
                <Stack.Screen name="profiles" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="player" />
                <Stack.Screen name="series/[id]" />
                <Stack.Screen name="categories" />
                <Stack.Screen name="vpn" />
              </Stack>
            </ErrorBoundary>
            <UpdateGate />
          </RemoteProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
