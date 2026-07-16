import { Slot, usePathname, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { BackHandler, TVFocusGuideView, View } from 'react-native';
import { NavRail } from '@/components/NavRail';
import { colors } from '@/theme/tokens';

export default function TabsLayout() {
  const pathname = usePathname();
  const router = useRouter();

  // BACK must never close the app from a sub-tab. On any tab other than Home it
  // returns to Home; on Home it defers to Home's own handler (exit confirmation)
  // or the OS. This is the fix for "mi butta fuori": before, BACK on Live/Film/
  // Impostazioni popped the single (tabs) entry and killed the app.
  useEffect(() => {
    const onBack = () => {
      if (!pathname.includes('home')) {
        router.replace('/(tabs)/home');
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [pathname, router]);

  return (
    // TV overscan safe margin: cheap TVs crop the outer ~5%, so keep all focusable
    // content (NavRail icons on the left, grid cards on the right, top row) off the
    // physical panel edges. One wrapper protects every tab screen.
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.bg, paddingVertical: 18, paddingHorizontal: 24 }}>
      <NavRail />
      {/* autoFocus: pressing RIGHT from the side menu lands the D-pad on a REAL
          element in the content (and remembers where you were). */}
      <TVFocusGuideView autoFocus style={{ flex: 1 }}>
        <Slot />
      </TVFocusGuideView>
    </View>
  );
}
