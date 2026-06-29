import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { Spinner } from '@/components/ui';
import { useStore } from '@/store/useStore';
import { readDeviceMode } from '@/lib/deviceMode';
import { colors } from '@/theme/tokens';

export default function Index() {
  const hydrated = useStore((s) => s.hydrated);
  const hasSource = useStore((s) => s.sources.length > 0);
  const multiProfile = useStore((s) => s.profiles.length > 1);
  const profileChosen = useStore((s) => s.profileChosen);

  // First launch: ask TV or Phone before anything else.
  if (readDeviceMode() === 'auto') return <Redirect href={'/device-setup' as any} />;

  if (!hydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Spinner />
      </View>
    );
  }
  if (!hasSource) return <Redirect href="/onboarding" />;
  if (multiProfile && !profileChosen) return <Redirect href="/profiles" />;
  return <Redirect href="/(tabs)/home" />;
}
