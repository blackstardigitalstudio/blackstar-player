import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Browser } from '@/components/Browser';
import { useStore } from '@/store/useStore';
import { openItem } from '@/lib/nav';

export default function Series() {
  const router = useRouter();
  const content = useStore((s) => s.content);
  return (
    <View style={{ flex: 1 }}>
      <Browser
        title="Serie TV"
        items={content.series}
        categories={content.categories}
        kind="series"
        variant="poster"
        onSelect={(i) => openItem(router, i)}
      />
    </View>
  );
}
