import { Image } from 'expo-image';
import { StyleSheet, type ImageStyle, type StyleProp } from 'react-native';

type CachedImageProps = {
  uri: string;
  /** Stable storage id so rotated signed URLs still hit disk/memory cache. */
  cacheKey?: string | null;
  style?: StyleProp<ImageStyle>;
  accessibilityLabel?: string;
  contentFit?: 'cover' | 'contain' | 'fill';
  onError?: () => void;
};

export function CachedImage({
  uri,
  cacheKey,
  style,
  accessibilityLabel,
  contentFit = 'cover',
  onError,
}: CachedImageProps) {
  return (
    <Image
      accessibilityLabel={accessibilityLabel}
      source={{ uri, cacheKey: cacheKey ?? undefined }}
      style={[styles.image, style]}
      contentFit={contentFit}
      cachePolicy="memory-disk"
      recyclingKey={cacheKey ?? uri}
      onError={onError}
    />
  );
}

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: '100%',
  },
});
