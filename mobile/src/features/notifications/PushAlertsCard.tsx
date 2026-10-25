import { useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  enablePushAlerts,
  pushAlertsAvailable,
  readPushPermission,
  syncPushTokenIfGranted,
} from '@/features/notifications/pushRegistration';
import { colors, radius, spacing, typography } from '@/theme';

type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unavailable' | 'loading';

export function PushAlertsCard() {
  const [permission, setPermission] = useState<PermissionState>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!pushAlertsAvailable()) {
      setPermission('unavailable');
      return;
    }
    setPermission(await readPushPermission());
    await syncPushTokenIfGranted().catch(() => undefined);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  if (!pushAlertsAvailable() || permission === 'unavailable') {
    return null;
  }

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      const next = await enablePushAlerts();
      setPermission(next === 'granted' ? 'granted' : 'denied');
      if (next === 'denied') {
        setError('Android did not allow alerts.');
      }
    } catch {
      setError('Could not register this phone.');
    } finally {
      setBusy(false);
    }
  }

  const status =
    permission === 'loading' || busy
      ? '…'
      : permission === 'granted'
        ? 'On'
        : permission === 'denied'
          ? 'Settings'
          : 'Turn on';
  const actionable = permission === 'undetermined' || permission === 'denied';

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Trip alerts"
        accessibilityState={{ disabled: !actionable || busy }}
        disabled={!actionable || busy}
        onPress={() => {
          if (permission === 'denied') {
            void Linking.openSettings();
            return;
          }
          void enable();
        }}
        style={({ pressed }) => [styles.row, pressed && actionable ? styles.pressed : null]}
      >
        <View style={styles.icon}>
          <SymbolView
            name={{ android: 'notifications', ios: 'bell', web: 'notifications' }}
            size={18}
            tintColor={colors.primary}
          />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>Trip alerts</Text>
          <Text style={styles.subtitle}>Invites, chat, and trip changes</Text>
        </View>
        <Text style={[styles.status, permission === 'granted' ? styles.statusOn : null]}>{status}</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  pressed: {
    backgroundColor: colors.seafoam,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.seafoam,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.label,
    color: colors.ink,
  },
  subtitle: {
    ...typography.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted,
  },
  status: {
    ...typography.label,
    color: colors.primary,
  },
  statusOn: {
    color: colors.muted,
  },
  error: {
    ...typography.body,
    fontSize: 13,
    color: colors.danger,
    marginTop: spacing.xs,
    marginLeft: spacing.lg,
  },
});
