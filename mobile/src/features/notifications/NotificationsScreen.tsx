import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { SecondaryButton } from '@/components/SecondaryButton';
import { Skeleton } from '@/components/Skeleton';
import { UserAvatar } from '@/components/UserAvatar';
import { navigateFromNotification } from '@/features/notifications/notificationNavigation';
import { setNotificationUnreadCount, useNotificationUnreadCount } from '@/hooks/useNotificationUnreadCount';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import { ApiError } from '@/lib/apiClient';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/services/notificationService';
import type { AppNotification } from '@/types/notification';
import { colors, spacing, surfaceCard, typography } from '@/theme';

export function NotificationsScreen() {
  const { refresh: refreshUnread } = useNotificationUnreadCount();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await listNotifications({ limit: 30 });
      setItems(page.notifications);
      setNextCursor(page.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) {
      return;
    }
    setLoadingMore(true);
    try {
      const page = await listNotifications({ limit: 30, cursor: nextCursor });
      setItems((current) => [...current, ...page.notifications]);
      setNextCursor(page.nextCursor);
    } catch {
      // Keep existing list.
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, nextCursor]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  async function onMarkAllRead() {
    setBusy(true);
    try {
      await markAllNotificationsRead();
      setItems((current) => current.map((row) => ({ ...row, readAt: row.readAt ?? new Date().toISOString() })));
      setNotificationUnreadCount(0);
      await refreshUnread();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not mark notifications as read.');
    } finally {
      setBusy(false);
    }
  }

  async function onPressItem(item: AppNotification) {
    if (!item.readAt) {
      try {
        const updated = await markNotificationRead(item.id);
        setItems((current) =>
          current.map((row) => (row.id === item.id ? { ...row, readAt: updated.readAt } : row)),
        );
        await refreshUnread();
      } catch {
        // Still navigate.
      }
    }
    await navigateFromNotification(item);
  }

  if (loading) {
    return (
      <View style={styles.pad}>
        <Skeleton height={72} />
        <Skeleton height={72} />
        <Skeleton height={72} />
      </View>
    );
  }

  if (error && items.length === 0) {
    return <ErrorState message={error} onRetry={() => void loadInitial()} />;
  }

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        <SecondaryButton
          label={busy ? 'Updating…' : 'Mark all as read'}
          disabled={busy || items.every((row) => row.readAt)}
          onPress={() => void onMarkAllRead()}
        />
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          <EmptyState
            title="No notifications yet"
            message="When someone invites you or updates shared trip details, you'll see it here."
            illustration="travel"
          />
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footer}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => void onPressItem(item)}
            style={({ pressed }) => [
              styles.row,
              !item.readAt && styles.unread,
              pressed && styles.pressed,
            ]}
          >
            <UserAvatar
              name={item.actor.name}
              uri={item.actor.avatarUrl}
              cacheKey={`avatar:${item.actor.id}`}
              size="sm"
            />
            <View style={styles.copy}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.message}>{item.message}</Text>
              {item.trip ? <Text style={styles.meta}>{item.trip.name}</Text> : null}
              <Text style={styles.meta}>{formatRelativeTime(item.createdAt)}</Text>
            </View>
          </Pressable>
        )}
      />
      {error && items.length > 0 ? (
        <ErrorState message={error} onRetry={() => void loadInitial()} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  pad: { padding: spacing.xl, gap: spacing.md },
  toolbar: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
  },
  list: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  row: {
    ...surfaceCard,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    alignItems: 'flex-start',
  },
  unread: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  pressed: { opacity: 0.92 },
  copy: { flex: 1, gap: spacing.xs },
  title: { ...typography.label, color: colors.ink },
  message: { ...typography.body, color: colors.ink, fontSize: 15 },
  meta: { fontSize: 13, color: colors.muted },
  footer: { paddingVertical: spacing.lg },
});
