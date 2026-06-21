import { View } from 'react-native';
import { Browser } from '@/components/Browser';
import { usePlayback } from '@/lib/playback';
import { useVisibleContent } from '@/lib/content';
import { useT } from '@/i18n';

export default function Series() {
  const t = useT();
  const play = usePlayback();
  const content = useVisibleContent();
  return (
    <View style={{ flex: 1 }}>
      <Browser
        title={t('title.series')}
        items={content.series}
        categories={content.categories}
        kind="series"
        variant="poster"
        onSelect={(i) => play.open(i)}
      />
    </View>
  );
}
