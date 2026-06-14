import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Browser } from '@/components/Browser';
import { useStore } from '@/store/useStore';
import { openItem } from '@/lib/nav';

export default function Movies() {
  const router = useRouter();
  const content = useStore((s) => s.content);
  return (
    <View style={{ flex: 1 }}>
      <Browser
        title="Film"
        items={content.movies}
        categories={content.categories}
        kind="movie"
        variant="poster"
        onSelect={(i) => openItem(router, i)}
      />
    </View>
  );
}
