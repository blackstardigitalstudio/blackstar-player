import { View } from 'react-native';
import { Browser } from '@/components/Browser';
import { usePlayback } from '@/lib/playback';
import { useVisibleContent } from '@/lib/content';
import { useT } from '@/i18n';

export default function Live() {
  const t = useT();
  const play = usePlayback();
  const content = useVisibleContent();
  return (
    <View style={{ flex: 1 }}>
      <Browser
        title={t('title.live')}
        items={content.live}
        categories={content.categories}
        kind="live"
        variant="tile"
        onSelect={(i) => play.open(i)}
      />
    </View>
  );
}
