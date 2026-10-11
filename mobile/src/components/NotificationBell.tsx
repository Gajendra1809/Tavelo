import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useNotificationUnreadCount } from '@/hooks/useNotificationUnreadCount';
import { colors, spacing } from '@/theme';

function badgeLabel(count: number): string {
  if (count <= 0) {
    return '';
  }
  if (count > 99) {
    return '99+';
  }
  return String(count);
}

export function NotificationBell() {
  const { count } = useNotificationUnreadCount();
  const label = badgeLabel(count);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? `${count} unread notifications` : 'Notifications'}
      hitSlop={8}
      onPress={() => router.push('/notifications')}
      style={({ pressed }) => [styles.hit, pressed && styles.pressed]}
    >
      <SymbolView name={{ android: 'notifications', web: 'notifications' }} size={24} tintColor={colors.ink} />
      {label ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{label}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    padding: spacing.xs,
    position: 'relative',
  },
  pressed: {
    opacity: 0.75,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: colors.surface,
    fontWeight: '700',
    fontSize: 10,
  },
});
