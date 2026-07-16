import { View } from 'react-native';
import { Browser } from '@/components/Browser';
import { usePlayback } from '@/lib/playback';
import { useVisibleContent } from '@/lib/content';
import { useT } from '@/i18n';

export default function Movies() {
  const t = useT();
  const play = usePlayback();
  const content = useVisibleContent();
  return (
    <View style={{ flex: 1 }}>
      <Browser
        title={t('title.movies')}
        items={content.movies}
        categories={content.categories}
        kind="movie"
        variant="poster"
        folders
        onSelect={(i) => play.open(i)}
        onResume={(e) => play.playEntry(e.url, e.title, { key: e.key, poster: e.poster, resumeAt: e.position })}
      />
    </View>
  );
}
