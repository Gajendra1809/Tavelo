import { useFocusEffect, useNavigation } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Atmosphere } from '@/components/Atmosphere';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Skeleton } from '@/components/Skeleton';
import { useAuth } from '@/features/auth/AuthProvider';
import { MemoryGridTile } from '@/features/memories/MemoryGridTile';
import { MemoryViewerOverlay } from '@/features/memories/MemoryViewerOverlay';
import { useTripFromCache } from '@/hooks/useTripFromCache';
import { filterMemoryItems, memoryCache } from '@/lib/cache/memoryCache';
import { ApiError } from '@/lib/apiClient';
import { logAppError, userFacingMessage } from '@/lib/errorReport';
import { downloadTripMemoryItems } from '@/services/memoryDownload';
import { resolveLocalByteSize } from '@/services/storageUpload';
import {
  deleteTripMemory,
  listTripMemories,
  memoryMimeFromUri,
  updateMemoryCaption,
  uploadTripMemory,
} from '@/services/memoryService';
import { colors, radius, spacing, surfaceCard, typography } from '@/theme';
import type { MemoryFilter, TripMemoryItem } from '@/types/memory';

type UploadQueueItem = {
  id: string;
  label: string;
  status: 'pending' | 'uploading' | 'done' | 'failed';
  error?: string;
  errorDetails?: string;
};

type TripMemoriesScreenProps = {
  tripId: string;
};

const FILTERS: MemoryFilter[] = ['all', 'image', 'video'];
const GRID_GAP = 2;

export function TripMemoriesScreen({ tripId }: TripMemoriesScreenProps) {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const columns = width >= 900 ? 4 : 3;
  const tileSize = Math.floor((width - GRID_GAP * (columns - 1)) / columns);

  const { trip: cachedTrip, refresh: refreshTrip } = useTripFromCache(tripId);
  const tripName = cachedTrip?.name ?? '';
  const ownerId = cachedTrip?.creatorId ?? null;

  const [items, setItems] = useState<TripMemoryItem[]>(() => memoryCache.get(tripId)?.items ?? []);
  const [filter, setFilter] = useState<MemoryFilter>('all');
  const [counts, setCounts] = useState(() => {
    const snapshot = memoryCache.get(tripId);
    return {
      total: snapshot?.total ?? 0,
      photoCount: snapshot?.photoCount ?? 0,
      videoCount: snapshot?.videoCount ?? 0,
    };
  });
  const [nextCursor, setNextCursor] = useState<string | null>(
    () => memoryCache.get(tripId)?.nextCursor ?? null,
  );
  const [loading, setLoading] = useState(() => !memoryCache.isFresh(tripId) && items.length === 0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const navigation = useNavigation();
  const [viewerBusy, setViewerBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [viewerDownloadBusy, setViewerDownloadBusy] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  const visibleItems = useMemo(() => filterMemoryItems(items, filter), [filter, items]);
  const selectedItems = useMemo(
    () => visibleItems.filter((row) => selectedIds.has(row.id)),
    [selectedIds, visibleItems],
  );

  const uploading = uploadQueue.some((row) => row.status === 'uploading' || row.status === 'pending');

  const loadInitial = useCallback(
    async (options?: { force?: boolean }) => {
      if (!tripId) {
        setError('This trip link is missing an id.');
        setLoading(false);
        return;
      }
      const force = options?.force ?? false;
      const snapshot = memoryCache.get(tripId);
      if (!force && memoryCache.isFresh(tripId) && snapshot) {
        setItems(snapshot.items);
        setNextCursor(snapshot.nextCursor);
        setCounts({
          total: snapshot.total,
          photoCount: snapshot.photoCount,
          videoCount: snapshot.videoCount,
        });
        setLoading(false);
        void refreshTrip();
        return;
      }
      if (!snapshot?.items.length) {
        setLoading(true);
      }
      setError(null);
      try {
        void refreshTrip();
        const page = await listTripMemories(tripId, { filter: 'all', limit: 24 });
        const nextCounts = {
          total: page.total,
          photoCount: page.photoCount,
          videoCount: page.videoCount,
        };
        memoryCache.set(tripId, {
          items: page.items,
          nextCursor: page.nextCursor,
          ...nextCounts,
        });
        setCounts(nextCounts);
        setNextCursor(page.nextCursor);
        setItems(page.items);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not load memories.');
      } finally {
        setLoading(false);
      }
    },
    [refreshTrip, tripId],
  );

  useFocusEffect(
    useCallback(() => {
      void loadInitial();
    }, [loadInitial]),
  );

  const loadMore = useCallback(async () => {
    if (!tripId || !nextCursor || loadingMore) {
      return;
    }
    setLoadingMore(true);
    try {
      const page = await listTripMemories(tripId, { filter: 'all', limit: 24, cursor: nextCursor });
      setNextCursor(page.nextCursor);
      setItems((current) => {
        const merged = [...current, ...page.items];
        memoryCache.set(tripId, {
          items: merged,
          nextCursor: page.nextCursor,
          total: counts.total,
          photoCount: counts.photoCount,
          videoCount: counts.videoCount,
        });
        return merged;
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load more memories.');
    } finally {
      setLoadingMore(false);
    }
  }, [counts.photoCount, counts.total, counts.videoCount, loadingMore, nextCursor, tripId]);

  async function pickAndUpload() {
    if (uploading) {
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo library access is required to add memories.');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      quality: 1,
    });
    if (picked.canceled || picked.assets.length === 0) {
      return;
    }

    for (const asset of picked.assets) {
      const queueId = `${Date.now()}-${asset.assetId ?? asset.uri}`;
      setUploadQueue((current) => [
        ...current,
        { id: queueId, label: asset.fileName ?? 'Memory', status: 'pending' },
      ]);
      const contentType = asset.mimeType ?? memoryMimeFromUri(asset.uri);
      const byteSize = await resolveLocalByteSize(asset.uri, asset.fileSize ?? 0);
      if (byteSize <= 0) {
        setUploadQueue((current) =>
          current.map((row) =>
            row.id === queueId
              ? {
                  ...row,
                  status: 'failed',
                  error: 'Could not read the selected file size.',
                  errorDetails: logAppError('trip memory upload', new Error('byteSize=0')),
                }
              : row,
          ),
        );
        continue;
      }
      try {
        setUploadQueue((current) =>
          current.map((row) => (row.id === queueId ? { ...row, status: 'uploading' } : row)),
        );
        const created = await uploadTripMemory({
          tripId,
          uri: asset.uri,
          contentType,
          byteSize,
          originalFilename: asset.fileName ?? undefined,
        });
        setItems((current) => {
          const merged = [created, ...current];
          memoryCache.prependItem(tripId, created);
          return merged;
        });
        setCounts((current) => ({
          total: current.total + 1,
          photoCount: current.photoCount + (created.mediaType === 'image' ? 1 : 0),
          videoCount: current.videoCount + (created.mediaType === 'video' ? 1 : 0),
        }));
        setUploadQueue((current) =>
          current.map((row) => (row.id === queueId ? { ...row, status: 'done' } : row)),
        );
      } catch (err) {
        const message = userFacingMessage(err, 'Upload failed.');
        const errorDetails = logAppError('trip memory upload', err);
        setUploadQueue((current) =>
          current.map((row) =>
            row.id === queueId ? { ...row, status: 'failed', error: message, errorDetails } : row,
          ),
        );
      }
    }
    setUploadQueue((current) => current.filter((row) => row.status === 'failed').slice(-3));
  }

  const viewerItem =
    viewerIndex !== null && viewerIndex >= 0 && viewerIndex < visibleItems.length
      ? visibleItems[viewerIndex]
      : null;

  useEffect(() => {
    navigation.setOptions({
      headerShown: viewerIndex === null && !selectionMode,
    });
  }, [navigation, selectionMode, viewerIndex]);

  useEffect(() => {
    if (viewerIndex === null) {
      return;
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      closeViewer();
      return true;
    });
    return () => subscription.remove();
  }, [viewerIndex]);

  useEffect(() => {
    if (!selectionMode) {
      return;
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      exitSelectionMode();
      return true;
    });
    return () => subscription.remove();
  }, [selectionMode]);

  useEffect(() => {
    if (viewerIndex !== null && viewerIndex >= visibleItems.length) {
      setViewerIndex(visibleItems.length > 0 ? visibleItems.length - 1 : null);
    }
  }, [visibleItems.length, viewerIndex]);

  const viewerPermissions = useMemo(() => {
    if (!viewerItem || !user) {
      return { canEdit: false, canDelete: false };
    }
    const isUploader = viewerItem.uploader.id === user.id;
    const isOwner = ownerId === user.id;
    return { canEdit: isUploader || isOwner, canDelete: isUploader || isOwner };
  }, [ownerId, user, viewerItem]);

  function openViewer(item: TripMemoryItem) {
    const idx = visibleItems.findIndex((row) => row.id === item.id);
    if (idx >= 0) {
      setViewerIndex(idx);
    }
  }

  function closeViewer() {
    setViewerIndex(null);
  }

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function enterSelectionWith(item: TripMemoryItem) {
    setSelectionMode(true);
    setSelectedIds(new Set([item.id]));
  }

  function handleTilePress(item: TripMemoryItem) {
    if (selectionMode) {
      toggleSelected(item.id);
      return;
    }
    openViewer(item);
  }

  async function runDownload(targets: TripMemoryItem[]) {
    if (targets.length === 0 || downloadBusy) {
      return;
    }
    setDownloadBusy(true);
    setDownloadNotice(null);
    try {
      const result = await downloadTripMemoryItems(targets);
      setDownloadNotice(result.message);
    } finally {
      setDownloadBusy(false);
    }
  }

  async function downloadCurrentViewerItem() {
    if (!viewerItem) {
      return;
    }
    setViewerDownloadBusy(true);
    setDownloadNotice(null);
    try {
      const result = await downloadTripMemoryItems([viewerItem]);
      setDownloadNotice(result.message);
    } finally {
      setViewerDownloadBusy(false);
    }
  }

  async function downloadSelected() {
    await runDownload(selectedItems);
    if (selectedItems.length > 0) {
      exitSelectionMode();
    }
  }

  function selectAllVisible() {
    setSelectionMode(true);
    setSelectedIds(new Set(visibleItems.map((row) => row.id)));
  }

  async function saveCaption(caption: string) {
    if (!viewerItem) {
      return;
    }
    setViewerBusy(true);
    try {
      const updated = await updateMemoryCaption(tripId, viewerItem.id, caption);
      setItems((current) => current.map((row) => (row.id === updated.id ? updated : row)));
      memoryCache.patchItem(tripId, updated);
      // viewerItem stays in sync via visibleItems + viewerIndex
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the caption.');
    } finally {
      setViewerBusy(false);
    }
  }

  async function confirmRemoval() {
    if (!viewerItem) {
      return;
    }
    setViewerBusy(true);
    try {
      await deleteTripMemory(tripId, viewerItem.id);
      const deletedId = viewerItem.id;
      setItems((current) => {
        const nextItems = current.filter((row) => row.id !== deletedId);
        memoryCache.removeItem(tripId, deletedId, viewerItem.mediaType);
        const nextVisible = filterMemoryItems(nextItems, filter);
        setViewerIndex((currentIndex) => {
          if (currentIndex === null) {
            return null;
          }
          if (nextVisible.length === 0) {
            return null;
          }
          return Math.min(currentIndex, nextVisible.length - 1);
        });
        return nextItems;
      });
      setCounts((current) => ({
        total: Math.max(0, current.total - 1),
        photoCount: Math.max(0, current.photoCount - (viewerItem.mediaType === 'image' ? 1 : 0)),
        videoCount: Math.max(0, current.videoCount - (viewerItem.mediaType === 'video' ? 1 : 0)),
      }));
      setConfirmDelete(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete this memory.');
    } finally {
      setViewerBusy(false);
    }
  }

  const listHeader = (
    <View style={styles.headerBlock}>
      <View style={styles.headerCard}>
        <Text style={styles.tripName}>{tripName || 'Trip memories'}</Text>
        <Text style={styles.summary}>
          {counts.total} items · {counts.photoCount} photos · {counts.videoCount} videos
        </Text>
        <PrimaryButton
          label={uploading ? 'Uploading…' : 'Add photos or videos'}
          loading={uploading}
          disabled={uploading}
          onPress={() => void pickAndUpload()}
        />
        {uploadQueue.length > 0 ? (
          <View style={styles.queue}>
            {uploadQueue.map((row) => (
              <View key={row.id} style={styles.queueRow}>
                <Text style={styles.queueLine}>
                  {row.label}: {row.status}
                  {row.error ? ` — ${row.error}` : ''}
                </Text>
                {row.status === 'failed' && row.errorDetails ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void Clipboard.setStringAsync(row.errorDetails ?? '')}
                  >
                    <Text style={styles.queueCopy}>Copy error details</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}
      </View>
      <View style={styles.filtersRow}>
        <View style={styles.filters}>
          {FILTERS.map((value) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              onPress={() => setFilter(value)}
              style={[styles.filterChip, filter === value ? styles.filterChipActive : null]}
            >
              <Text style={[styles.filterLabel, filter === value ? styles.filterLabelActive : null]}>
                {value === 'all' ? 'All' : value === 'image' ? 'Photos' : 'Videos'}
              </Text>
            </Pressable>
          ))}
        </View>
        {visibleItems.length > 0 ? (
          selectionMode ? (
            <View style={styles.selectActions}>
              <Pressable accessibilityRole="button" onPress={() => void selectAllVisible()}>
                <Text style={styles.selectActionLabel}>All</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={exitSelectionMode}>
                <Text style={styles.selectActionLabel}>Cancel</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable accessibilityRole="button" onPress={() => setSelectionMode(true)}>
              <Text style={styles.selectActionLabel}>Select</Text>
            </Pressable>
          )
        ) : null}
      </View>
      {downloadNotice ? <Text style={styles.downloadNotice}>{downloadNotice}</Text> : null}
      {error ? <ErrorState message={error} onRetry={() => void loadInitial({ force: true })} /> : null}
      {visibleItems.length === 0 && !loading && !error ? (
        <EmptyState
          title={items.length === 0 ? 'No memories yet' : 'No items in this filter'}
          message={
            items.length === 0
              ? 'Share the first photo or video from this trip with everyone on the trip.'
              : 'Try another filter or load more from the gallery.'
          }
          illustration="travel"
        />
      ) : null}
    </View>
  );

  if (loading && items.length === 0) {
    return (
      <View style={styles.root}>
        <Atmosphere />
        <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safe}>
          <View style={styles.headerBlock}>
            <Skeleton height={48} />
            <Skeleton height={120} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style={viewerIndex !== null ? 'light' : 'dark'} />
      <Atmosphere />
      <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safe}>
        <FlatList
          data={visibleItems}
          key={columns}
          numColumns={columns}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={listHeader}
          contentContainerStyle={[
            styles.listContent,
            selectionMode ? styles.listContentWithSelectionBar : null,
          ]}
          columnWrapperStyle={columns > 1 ? styles.gridRow : undefined}
          onEndReached={() => {
            if (nextCursor && !loadingMore) {
              void loadMore();
            }
          }}
          onEndReachedThreshold={0.35}
          ListFooterComponent={
            nextCursor ? (
              loadingMore ? (
                <ActivityIndicator color={colors.primary} style={styles.moreSpinner} />
              ) : (
                <View style={styles.loadMoreWrap}>
                  <PrimaryButton label="Load more" onPress={() => void loadMore()} />
                </View>
              )
            ) : null
          }
          renderItem={({ item }) => (
            <MemoryGridTile
              item={item}
              size={tileSize}
              selectionMode={selectionMode}
              selected={selectedIds.has(item.id)}
              onPress={() => handleTilePress(item)}
              onLongPress={() => enterSelectionWith(item)}
            />
          )}
        />
      </SafeAreaView>
      {selectionMode ? (
        <SafeAreaView edges={['bottom']} style={styles.selectionBar}>
          <Text style={styles.selectionCount}>
            {selectedIds.size} selected
          </Text>
          <PrimaryButton
            label={downloadBusy ? 'Saving…' : `Download (${selectedIds.size})`}
            loading={downloadBusy}
            disabled={downloadBusy || selectedIds.size === 0}
            onPress={() => void downloadSelected()}
          />
        </SafeAreaView>
      ) : null}
      {viewerIndex !== null && visibleItems.length > 0 ? (
        <MemoryViewerOverlay
          items={visibleItems}
          index={viewerIndex}
          canEdit={viewerPermissions.canEdit}
          canDelete={viewerPermissions.canDelete}
          busy={viewerBusy}
          onClose={closeViewer}
          onIndexChange={setViewerIndex}
          onSaveCaption={(caption) => void saveCaption(caption)}
          onDelete={() => setConfirmDelete(true)}
          onDownload={() => void downloadCurrentViewerItem()}
          downloading={viewerDownloadBusy}
        />
      ) : null}
      <ConfirmDialog
        visible={confirmDelete}
        title="Delete this memory?"
        message="This removes the file from the trip gallery for everyone."
        confirmLabel="Delete"
        cancelLabel="Keep"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void confirmRemoval()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.sky,
  },
  safe: {
    flex: 1,
  },
  listContent: {
    paddingBottom: spacing.xxl,
  },
  listContentWithSelectionBar: {
    paddingBottom: spacing.xxl + 88,
  },
  headerBlock: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  headerCard: {
    ...surfaceCard,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  tripName: {
    ...typography.title,
    fontSize: 24,
    color: colors.ink,
  },
  summary: {
    ...typography.body,
    color: colors.muted,
  },
  queue: {
    gap: 4,
  },
  queueRow: {
    gap: 2,
  },
  queueLine: {
    ...typography.body,
    fontSize: 13,
    color: colors.muted,
  },
  queueCopy: {
    ...typography.label,
    fontSize: 12,
    color: colors.primary,
  },
  filtersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    flex: 1,
  },
  selectActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  selectActionLabel: {
    ...typography.label,
    color: colors.primary,
  },
  downloadNotice: {
    ...typography.body,
    fontSize: 13,
    color: colors.success,
  },
  selectionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  selectionCount: {
    ...typography.label,
    color: colors.ink,
    minWidth: 88,
  },
  filterChip: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  filterChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.seafoam,
  },
  filterLabel: {
    ...typography.label,
    color: colors.muted,
  },
  filterLabelActive: {
    color: colors.primary,
  },
  gridRow: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
    paddingHorizontal: 0,
  },
  moreSpinner: {
    marginVertical: spacing.lg,
  },
  loadMoreWrap: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
});
