import { Slot } from 'expo-router';
import { View } from 'react-native';
import { NavRail } from '@/components/NavRail';
import { colors } from '@/theme/tokens';

export default function TabsLayout() {
  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.bg }}>
      <NavRail />
      <View style={{ flex: 1 }}>
        <Slot />
      </View>
    </View>
  );
}
