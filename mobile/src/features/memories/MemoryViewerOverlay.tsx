import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CachedImage } from '@/components/CachedImage';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { UserAvatar } from '@/components/UserAvatar';
import { colors, spacing, typography } from '@/theme';
import type { TripMemoryItem } from '@/types/memory';

type MemoryViewerOverlayProps = {
  items: TripMemoryItem[];
  index: number;
  canEdit: boolean;
  canDelete: boolean;
  busy?: boolean;
  onClose: () => void;
  onIndexChange: (index: number) => void;
  onSaveCaption: (caption: string) => void;
  onDelete: () => void;
  onDownload: () => void;
  downloading?: boolean;
};

export function MemoryViewerOverlay({
  items,
  index,
  canEdit,
  canDelete,
  busy = false,
  onClose,
  onIndexChange,
  onSaveCaption,
  onDelete,
  onDownload,
  downloading = false,
}: MemoryViewerOverlayProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<TripMemoryItem>>(null);
  const item = items[index] ?? null;

  const [draftCaption, setDraftCaption] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setDraftCaption(item?.caption ?? '');
    setEditing(false);
  }, [item?.id, item?.caption]);

  useEffect(() => {
    if (index >= 0 && index < items.length) {
      listRef.current?.scrollToIndex({ index, animated: false });
    }
  }, [index, items.length]);

  const onScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(event.nativeEvent.contentOffset.x / width);
      if (next >= 0 && next < items.length && next !== index) {
        onIndexChange(next);
      }
    },
    [index, items.length, onIndexChange, width],
  );

  const goPrev = useCallback(() => {
    if (index <= 0) {
      return;
    }
    const next = index - 1;
    onIndexChange(next);
    listRef.current?.scrollToIndex({ index: next, animated: true });
  }, [index, onIndexChange]);

  const goNext = useCallback(() => {
    if (index >= items.length - 1) {
      return;
    }
    const next = index + 1;
    onIndexChange(next);
    listRef.current?.scrollToIndex({ index: next, animated: true });
  }, [index, items.length, onIndexChange]);

  const renderPage = useCallback(
    ({ item: pageItem, index: pageIndex }: ListRenderItemInfo<TripMemoryItem>) => (
      <MemoryViewerPage
        item={pageItem}
        width={width}
        mediaHeight={Math.min(height * 0.52, 480)}
        isActive={pageIndex === index}
      />
    ),
    [height, index, width],
  );

  if (!item) {
    return null;
  }

  const atStart = index <= 0;
  const atEnd = index >= items.length - 1;

  return (
    <View style={styles.overlay} accessibilityViewIsModal>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.xs }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close viewer"
          hitSlop={12}
          onPress={onClose}
          style={styles.iconButton}
        >
          <SymbolView
            name={{ android: 'arrow_back', web: 'arrow_back' }}
            size={24}
            tintColor={colors.onPrimary}
          />
        </Pressable>
        <Text style={styles.counter}>
          {index + 1} / {items.length}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Download"
          hitSlop={12}
          disabled={busy || downloading || !item.mediaUrl}
          onPress={onDownload}
          style={styles.iconButton}
        >
          <SymbolView
            name={{ android: 'download', web: 'download' }}
            size={24}
            tintColor={colors.onPrimary}
          />
        </Pressable>
      </View>

      <View style={styles.carouselWrap}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous"
          disabled={atStart}
          onPress={goPrev}
          style={[styles.sideNav, styles.sideNavLeft, atStart ? styles.sideNavDisabled : null]}
        >
          <SymbolView
            name={{ android: 'chevron_left', web: 'chevron_left' }}
            size={32}
            tintColor={colors.onPrimary}
          />
        </Pressable>

        <FlatList
          ref={listRef}
          data={items}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(row) => row.id}
          renderItem={renderPage}
          getItemLayout={(_, rowIndex) => ({
            length: width,
            offset: width * rowIndex,
            index: rowIndex,
          })}
          initialScrollIndex={index}
          onMomentumScrollEnd={onScrollEnd}
          onScrollToIndexFailed={() => {
            listRef.current?.scrollToOffset({ offset: width * index, animated: false });
          }}
          style={styles.carousel}
          windowSize={3}
          initialNumToRender={1}
          maxToRenderPerBatch={2}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next"
          disabled={atEnd}
          onPress={goNext}
          style={[styles.sideNav, styles.sideNavRight, atEnd ? styles.sideNavDisabled : null]}
        >
          <SymbolView
            name={{ android: 'chevron_right', web: 'chevron_right' }}
            size={32}
            tintColor={colors.onPrimary}
          />
        </Pressable>
      </View>

      <ScrollView
        style={styles.metaScroll}
        contentContainerStyle={[styles.metaContent, { paddingBottom: insets.bottom + spacing.lg }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.metaRow}>
          <UserAvatar
            name={item.uploader.name}
            uri={item.uploader.avatarUrl}
            cacheKey={`avatar:${item.uploader.id}`}
            size="sm"
          />
          <View style={styles.metaCopy}>
            <Text style={styles.uploader}>{item.uploader.name}</Text>
            <Text style={styles.date}>
              {new Date(item.createdAt).toLocaleDateString()}
              {item.capturedAt ? ` · Taken ${item.capturedAt}` : ''}
            </Text>
          </View>
        </View>
        {editing ? (
          <>
            <TextInput
              value={draftCaption}
              onChangeText={setDraftCaption}
              placeholder="Add a caption"
              multiline
              style={styles.captionInput}
              placeholderTextColor={colors.muted}
            />
            <PrimaryButton
              label={busy ? 'Saving…' : 'Save caption'}
              disabled={busy}
              onPress={() => onSaveCaption(draftCaption.trim())}
            />
            <SecondaryButton label="Cancel edit" disabled={busy} onPress={() => setEditing(false)} />
          </>
        ) : (
          <>
            {item.caption ? <Text style={styles.caption}>{item.caption}</Text> : null}
            {canEdit ? (
              <SecondaryButton
                label={item.caption ? 'Edit caption' : 'Add caption'}
                disabled={busy}
                onPress={() => setEditing(true)}
              />
            ) : null}
            <SecondaryButton
              label={downloading ? 'Saving…' : 'Save to device'}
              disabled={busy || downloading || !item.mediaUrl}
              onPress={onDownload}
            />
          </>
        )}
        {canDelete ? (
          <Pressable accessibilityRole="button" disabled={busy} onPress={onDelete} style={styles.delete}>
            <Text style={styles.deleteLabel}>{busy ? 'Working…' : 'Delete memory'}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

function MemoryViewerPage({
  item,
  width,
  mediaHeight,
  isActive,
}: {
  item: TripMemoryItem;
  width: number;
  mediaHeight: number;
  isActive: boolean;
}) {
  return (
    <View style={[styles.page, { width }]}>
      <View style={[styles.mediaFrame, { width, height: mediaHeight }]}>
        {item.mediaType === 'video' && item.mediaUrl ? (
          <MemoryVideoPlayer uri={item.mediaUrl} play={isActive} />
        ) : item.mediaUrl ? (
          <CachedImage
            uri={item.mediaUrl}
            cacheKey={item.objectKey ?? item.id}
            style={styles.photo}
            contentFit="contain"
          />
        ) : (
          <View style={styles.missing}>
            <Text style={styles.missingText}>This memory is unavailable right now.</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function MemoryVideoPlayer({ uri, play }: { uri: string; play: boolean }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = false;
  });

  useEffect(() => {
    if (play) {
      player.play();
    } else {
      player.pause();
    }
  }, [play, player]);

  return <VideoView player={player} style={styles.video} nativeControls contentFit="contain" />;
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 20,
    backgroundColor: '#0f172a',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    ...typography.label,
    color: colors.onPrimary,
    flex: 1,
    textAlign: 'center',
  },
  carouselWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  carousel: {
    flexGrow: 0,
  },
  page: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaFrame: {
    overflow: 'hidden',
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  missingText: {
    ...typography.body,
    color: colors.onPrimary,
    textAlign: 'center',
  },
  sideNav: {
    position: 'absolute',
    top: '40%',
    zIndex: 2,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideNavLeft: {
    left: spacing.xs,
  },
  sideNavRight: {
    right: spacing.xs,
  },
  sideNavDisabled: {
    opacity: 0.25,
  },
  metaScroll: {
    maxHeight: '38%',
    backgroundColor: colors.ivory,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  metaContent: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  metaCopy: {
    flex: 1,
    gap: 2,
  },
  uploader: {
    ...typography.cardTitle,
    color: colors.ink,
  },
  date: {
    ...typography.body,
    fontSize: 13,
    color: colors.muted,
  },
  caption: {
    ...typography.body,
    color: colors.ink,
  },
  captionInput: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: spacing.md,
    minHeight: 88,
    backgroundColor: colors.surface,
    color: colors.ink,
    textAlignVertical: 'top',
  },
  delete: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
  },
  deleteLabel: {
    ...typography.label,
    color: colors.danger,
  },
});
