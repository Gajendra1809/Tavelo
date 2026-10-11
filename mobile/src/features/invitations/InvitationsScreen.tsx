import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { SecondaryButton } from '@/components/SecondaryButton';
import { Skeleton } from '@/components/Skeleton';
import { UserAvatar } from '@/components/UserAvatar';
import { ApiError } from '@/lib/apiClient';
import {
  acceptInvitation,
  declineInvitation,
  listReceivedInvitations,
} from '@/services/invitationService';
import type { ReceivedInvitation } from '@/types/invitation';
import { colors, spacing, surfaceCard, typography } from '@/theme';

export function InvitationsScreen() {
  const [invitations, setInvitations] = useState<ReceivedInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listReceivedInvitations();
      setInvitations(result.invitations);
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : 'Could not load invitations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function respond(id: string, action: 'accept' | 'decline') {
    if (busyId) {
      return;
    }
    setBusyId(id);
    setActionError(null);
    try {
      if (action === 'accept') {
        await acceptInvitation(id);
      } else {
        await declineInvitation(id);
      }
      setInvitations((current) => current.filter((invitation) => invitation.id !== id));
    } catch (respondError) {
      setActionError(
        respondError instanceof ApiError ? respondError.message : 'Could not update the invitation.',
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <Text style={styles.title}>Invitations</Text>
      {loading ? <Skeleton height={120} /> : null}
      {!loading && error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {!loading && !error && invitations.length === 0 ? (
        <EmptyState
          title="No invitations"
          message="When someone invites you to a trip, it will show up here."
          illustration="travel"
        />
      ) : null}
      {invitations.map((invitation) => (
        <View key={invitation.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <UserAvatar name={invitation.inviter.name} size="sm" />
            <View style={styles.cardHeaderCopy}>
              <Text style={styles.name}>{invitation.trip.name}</Text>
              <Text style={styles.meta}>{invitation.trip.destination}</Text>
              <Text style={styles.meta}>Invited by {invitation.inviter.name}</Text>
            </View>
          </View>
          <View style={styles.actions}>
            <SecondaryButton
              label="Decline"
              onPress={() => void respond(invitation.id, 'decline')}
              disabled={busyId !== null}
              style={styles.action}
            />
            <PrimaryButton
              label="Accept"
              onPress={() => void respond(invitation.id, 'accept')}
              loading={busyId === invitation.id}
              disabled={busyId !== null}
              style={styles.action}
            />
          </View>
        </View>
      ))}
      {actionError ? <ErrorState title="Could not update" message={actionError} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.title,
    fontSize: 32,
    color: colors.ink,
  },
  card: {
    ...surfaceCard,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  cardHeaderCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  name: {
    ...typography.cardTitle,
    color: colors.ink,
  },
  meta: {
    ...typography.body,
    color: colors.muted,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  action: {
    flex: 1,
  },
});
