import { View } from 'react-native';
import { Browser } from '@/components/Browser';
import { useStore } from '@/store/useStore';
import { usePlayback } from '@/lib/playback';
import { useT } from '@/i18n';

export default function Movies() {
  const t = useT();
  const play = usePlayback();
  const content = useStore((s) => s.content);
  return (
    <View style={{ flex: 1 }}>
      <Browser
        title={t('title.movies')}
        items={content.movies}
        categories={content.categories}
        kind="movie"
        variant="poster"
        onSelect={(i) => play.open(i)}
      />
    </View>
  );
}
