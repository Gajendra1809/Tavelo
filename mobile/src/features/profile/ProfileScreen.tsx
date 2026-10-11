import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { Screen } from '@/components/Screen';
import { UserAvatar } from '@/components/UserAvatar';
import { useAuth } from '@/features/auth/AuthProvider';
import { useHealthCheck } from '@/hooks/useHealthCheck';
import { isLoopbackUrl, readApiConfig } from '@/lib/config';
import { colors, spacing, surfaceCard, typography } from '@/theme';
import { HealthResult } from '../home/HealthResult';

export function ProfileScreen() {
  const { user, logout } = useAuth();
  const config = readApiConfig();
  const { state, check } = useHealthCheck();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function signOut() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
      setConfirmLogout(false);
    }
  }

  return (
    <Screen>
      <Text style={styles.title}>Profile</Text>
      <View style={styles.profileCard}>
        <UserAvatar name={user?.name ?? 'Traveler'} size="lg" />
        <View style={styles.profileCopy}>
          <Text style={styles.cardTitle}>{user?.name ?? 'Your account'}</Text>
          <Text style={styles.url}>{user?.email ?? 'Signed in'}</Text>
          <Text style={styles.photoHint}>Default photo until you upload one in a future update.</Text>
        </View>
      </View>
      <View style={styles.card}>
        <SecondaryButton label="Invitations" onPress={() => router.push('/invitations' as Href)} />
        <SecondaryButton
          label={loggingOut ? 'Signing out…' : 'Log out'}
          onPress={() => setConfirmLogout(true)}
          disabled={loggingOut}
        />
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>API connection</Text>
        {'error' in config ? (
          <ErrorState title="Configuration needed" message={config.error} />
        ) : (
          <>
            <Text selectable style={styles.url}>
              {config.baseUrl}
            </Text>
            {isLoopbackUrl(config.baseUrl) ? (
              <Text style={styles.hint}>
                This URL points at this computer. A phone needs your computer’s LAN address
                instead.
              </Text>
            ) : null}
            <PrimaryButton
              label={state.status === 'idle' ? 'Check connection' : 'Check again'}
              loading={state.status === 'loading'}
              onPress={() => void check()}
            />
            {state.status === 'idle' ? (
              <EmptyState
                title="No check yet"
                message="Run a connection check to see whether the API and database are reachable."
              />
            ) : null}
            {state.status === 'loading' ? <LoadingState message="Contacting the API…" /> : null}
            {state.status === 'error' ? <ErrorState message={state.message} /> : null}
            {state.status === 'success' ? <HealthResult report={state.report} /> : null}
          </>
        )}
      </View>
      <ConfirmDialog
        visible={confirmLogout}
        title="Log out?"
        message="You will need to sign in again to see your trips."
        confirmLabel="Log out"
        cancelLabel="Stay"
        onCancel={() => setConfirmLogout(false)}
        onConfirm={() => void signOut()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.title,
    fontSize: 32,
    color: colors.ink,
  },
  profileCard: {
    ...surfaceCard,
    padding: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  profileCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  card: {
    ...surfaceCard,
    padding: spacing.xl,
    gap: spacing.md,
  },
  cardTitle: {
    ...typography.cardTitle,
    color: colors.ink,
  },
  url: {
    ...typography.body,
    fontSize: 14,
    color: colors.ink,
  },
  hint: {
    ...typography.body,
    fontSize: 14,
    color: colors.warning,
  },
  photoHint: {
    ...typography.body,
    fontSize: 13,
    color: colors.muted,
  },
});
