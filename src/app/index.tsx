import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { Spinner } from '@/components/ui';
import { useStore } from '@/store/useStore';
import { colors } from '@/theme/tokens';

export default function Index() {
  const hydrated = useStore((s) => s.hydrated);
  const hasSource = useStore((s) => s.sources.length > 0);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Spinner />
      </View>
    );
  }
  return <Redirect href={hasSource ? '/(tabs)/home' : '/onboarding'} />;
}
