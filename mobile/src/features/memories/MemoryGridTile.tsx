import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { CachedImage } from '@/components/CachedImage';
import { useVideoThumbnailUri } from '@/features/memories/useVideoThumbnailUri';
import { colors } from '@/theme';
import type { TripMemoryItem } from '@/types/memory';

type MemoryGridTileProps = {
  item: TripMemoryItem;
  size: number;
  onPress: () => void;
  onLongPress?: () => void;
  selectionMode?: boolean;
  selected?: boolean;
};

export function MemoryGridTile({
  item,
  size,
  onPress,
  onLongPress,
  selectionMode = false,
  selected = false,
}: MemoryGridTileProps) {
  const remoteVideoSource = item.mediaType === 'video' ? (item.mediaUrl ?? item.thumbnailUrl) : null;
  const generatedThumb = useVideoThumbnailUri(
    item.mediaType === 'video' && !item.thumbnailUrl ? remoteVideoSource : null,
  );
  const preview =
    item.mediaType === 'image'
      ? (item.thumbnailUrl ?? item.mediaUrl)
      : (item.thumbnailUrl ?? generatedThumb);

  const loadingVideoThumb = item.mediaType === 'video' && !preview;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.caption || item.mediaType}
      accessibilityState={{ selected: selectionMode ? selected : undefined }}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.tile,
        { width: size, height: size },
        selected ? styles.tileSelected : null,
        pressed ? styles.pressed : null,
      ]}
    >
      {preview ? (
        <CachedImage
          uri={preview}
          cacheKey={item.thumbnailObjectKey ?? item.objectKey ?? item.id}
          style={styles.image}
        />
      ) : loadingVideoThumb ? (
        <View style={styles.placeholder}>
          <ActivityIndicator color={colors.primary} size="small" />
        </View>
      ) : (
        <View style={styles.placeholder} />
      )}
      {selectionMode ? (
        <View style={[styles.selectBadge, selected ? styles.selectBadgeOn : null]}>
          {selected ? (
            <SymbolView
              name={{ android: 'check', web: 'check' }}
              size={18}
              tintColor={colors.onPrimary}
            />
          ) : null}
        </View>
      ) : null}
      {item.mediaType === 'video' ? (
        <>
          <View style={styles.videoShade} pointerEvents="none" />
          <View style={styles.playBadge} pointerEvents="none">
            <SymbolView
              name={{ android: 'play_arrow', web: 'play_arrow' }}
              size={26}
              tintColor={colors.onPrimary}
            />
          </View>
        </>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    overflow: 'hidden',
    backgroundColor: colors.line,
  },
  pressed: {
    opacity: 0.94,
  },
  tileSelected: {
    borderWidth: 3,
    borderColor: colors.primary,
  },
  selectBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.onPrimary,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  selectBadgeOn: {
    backgroundColor: colors.primary,
    borderColor: colors.onPrimary,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e293b',
  },
  videoShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.18)',
  },
  playBadge: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -22,
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
});
