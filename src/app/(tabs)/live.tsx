import { View } from 'react-native';
import { Browser } from '@/components/Browser';
import { useStore } from '@/store/useStore';
import { usePlayback } from '@/lib/playback';
import { useT } from '@/i18n';

export default function Live() {
  const t = useT();
  const play = usePlayback();
  const content = useStore((s) => s.content);
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
