import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import {
  enablePushAlerts,
  pushAlertsAvailable,
  readPushPermission,
  syncPushTokenIfGranted,
} from '@/features/notifications/pushRegistration';
import { colors, spacing, surfaceCard, typography } from '@/theme';

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

  if (permission === 'unavailable') {
    return null;
  }

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      const next = await enablePushAlerts();
      setPermission(next === 'granted' ? 'granted' : 'denied');
      if (next === 'denied') {
        setError('Android did not allow alerts. You can turn them on in system settings.');
      }
    } catch {
      setError('Could not register this phone. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Trip alerts</Text>
      <Text style={styles.body}>
        Get a phone alert for invitations, chat, polls, bookings, and expenses. Tavelo does not
        alert you about your own changes.
      </Text>
      {permission === 'granted' ? (
        <Text style={styles.on}>Alerts are on for this phone.</Text>
      ) : null}
      {permission === 'undetermined' ? (
        <PrimaryButton label={busy ? 'Turning on…' : 'Turn on alerts'} loading={busy} onPress={() => void enable()} />
      ) : null}
      {permission === 'denied' ? (
        <SecondaryButton label="Open system settings" onPress={() => void Linking.openSettings()} />
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...surfaceCard,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  title: {
    ...typography.cardTitle,
    color: colors.ink,
  },
  body: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
  },
  on: {
    ...typography.label,
    color: colors.primary,
  },
  error: {
    ...typography.body,
    fontSize: 13,
    color: colors.danger,
  },
});
