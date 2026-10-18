import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { CoverMark } from '@/components/CoverMark';
import { SegmentTabs } from '@/components/SegmentTabs';
import { UserAvatar } from '@/components/UserAvatar';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { SecondaryButton } from '@/components/SecondaryButton';
import { Skeleton } from '@/components/Skeleton';
import { useAuth } from '@/features/auth/AuthProvider';
import { ApiError } from '@/lib/apiClient';
import { formatDateRange, formatTripLength } from '@/lib/dates';
import {
  cancelInvitation,
  listSentInvitations,
  removeMember,
} from '@/services/invitationService';
import { TripMemberSearch } from '@/features/trips/TripMemberSearch';
import { useTripFromCache } from '@/hooks/useTripFromCache';
import { expenseCache } from '@/lib/cache/expenseCache';
import { memoryCache } from '@/lib/cache/memoryCache';
import { tripCache } from '@/lib/cache/tripCache';
import { deleteTrip } from '@/services/tripService';
import type { SentInvitation } from '@/types/invitation';
import type { Trip } from '@/types/trip';
import { TripItinerarySection } from '@/features/trips/TripItinerarySection';
import { LocationInlineSummary } from '@/features/location/components/LocationInlineSummary';
import { resolvePlace } from '@/features/location/placeHelpers';
import { colors, radius, spacing, surfaceCard, typography } from '@/theme';

const DETAIL_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'itinerary', label: 'Itinerary' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'memories', label: 'Memories' },
] as const;

type DetailTab = (typeof DETAIL_TABS)[number]['id'];

export function TripDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { user } = useAuth();
  const deletingRef = useRef(false);
  const { trip, loading, error, errorStatus, refresh } = useTripFromCache(id);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sentInvites, setSentInvites] = useState<SentInvitation[]>([]);
  const [membershipError, setMembershipError] = useState<string | null>(null);
  const [confirmMember, setConfirmMember] = useState<
    { kind: 'cancel'; invitation: SentInvitation } | { kind: 'remove'; userId: string; name: string } | null
  >(null);
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');

  const loadInvites = useCallback(async () => {
    if (!trip || !user || trip.creatorId !== user.id) {
      setSentInvites([]);
      return;
    }
    try {
      const sent = await listSentInvitations(trip.id);
      setSentInvites(sent.invitations.filter((invitation) => invitation.status === 'pending'));
    } catch {
      setSentInvites([]);
    }
  }, [trip, user]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  useEffect(() => {
    void loadInvites();
  }, [loadInvites]);

  async function confirmRemoval() {
    if (!trip || deletingRef.current) {
      return;
    }
    deletingRef.current = true;
    setDeleting(true);
    setActionError(null);
    setConfirmDelete(false);
    try {
      await deleteTrip(trip.id);
      tripCache.invalidateTrip(trip.id);
      tripCache.invalidateList();
      memoryCache.invalidate(trip.id);
      router.replace('/trips' as Href);
    } catch (deleteError) {
      deletingRef.current = false;
      setDeleting(false);
      setActionError(
        deleteError instanceof ApiError
          ? deleteError.message
          : 'Could not delete this trip. Try again.',
      );
    }
  }

  async function confirmMembershipAction() {
    if (!trip || !confirmMember) {
      return;
    }
    const action = confirmMember;
    setConfirmMember(null);
    setMembershipError(null);
    try {
      if (action.kind === 'cancel') {
        await cancelInvitation(trip.id, action.invitation.id);
        setSentInvites((current) => current.filter((item) => item.id !== action.invitation.id));
      } else {
        await removeMember(trip.id, action.userId);
        if (trip) {
          const next: Trip = {
            ...trip,
            members: trip.members.filter((member) => member.userId !== action.userId),
          };
          tripCache.setTrip(next);
          expenseCache.invalidate(trip.id);
        }
      }
    } catch (membershipFailure) {
      setMembershipError(
        membershipFailure instanceof ApiError
          ? membershipFailure.message
          : 'Could not update the people on this trip.',
      );
    }
  }

  if (loading && !trip) {
    return (
      <Screen edges={['left', 'right', 'bottom']}>
        <Skeleton height={180} />
        <Skeleton height={88} />
        <Skeleton height={72} />
      </Screen>
    );
  }

  if (error || !trip) {
    const missing = errorStatus === 404;
    return (
      <Screen edges={['left', 'right', 'bottom']}>
        <ErrorState
          title={missing ? 'Trip not found' : 'Could not load trip'}
          message={error ?? 'Trip not found.'}
          onRetry={missing ? undefined : () => void refresh({ force: true })}
        />
      </Screen>
    );
  }

  const title = trip.title || trip.name;
  const canManage = Boolean(user && trip.creatorId && user.id === trip.creatorId);
  const duration = formatTripLength(trip.startDate, trip.endDate);
  const members = trip.members ?? [];

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <CoverMark
        uri={trip.coverImageUrl}
        cacheKey={`trip-cover:${trip.id}`}
        label={trip.destination}
        style={styles.cover}
        textStyle={styles.coverText}
      />
      <View style={styles.card}>
        <Text style={styles.destination}>{trip.destination}</Text>
        <LocationInlineSummary
          hideName
          place={resolvePlace(trip.destinationPlace ?? null, trip.destination)}
        />
        <Text style={styles.name}>{title}</Text>
        <Text style={styles.dates}>{formatDateRange(trip.startDate, trip.endDate)}</Text>
        {duration ? (
          <View style={styles.pill}>
            <Text style={styles.duration}>{duration}</Text>
          </View>
        ) : null}
      </View>
      <SegmentTabs tabs={[...DETAIL_TABS]} active={activeTab} onChange={setActiveTab} />

      {activeTab === 'overview' ? (
        <>
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Description</Text>
            {trip.description ? (
              <Text style={styles.description}>{trip.description}</Text>
            ) : (
              <Text style={styles.muted}>No description added.</Text>
            )}
          </View>
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>People</Text>
            {trip.creator ? (
              <Text style={styles.creator}>Created by {trip.creator.name}</Text>
            ) : (
              <Text style={styles.muted}>Creator details are unavailable.</Text>
            )}
            {members.length > 0 ? (
              <View style={styles.memberList}>
                {members.map((member) => (
                  <View key={`${member.userId}-${member.role}`} style={styles.memberRow}>
                    <UserAvatar
                      name={member.name}
                      uri={member.avatarUrl}
                      cacheKey={`avatar:${member.userId}`}
                      size="md"
                    />
                    <View style={styles.memberCopy}>
                      <Text numberOfLines={1} style={styles.memberName}>
                        {member.name}
                      </Text>
                      <Text style={styles.role}>{member.role === 'owner' ? 'Owner' : 'Member'}</Text>
                    </View>
                    {canManage && member.role !== 'owner' ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${member.name}`}
                        onPress={() =>
                          setConfirmMember({ kind: 'remove', userId: member.userId, name: member.name })
                        }
                        style={styles.textAction}
                      >
                        <Text style={styles.textActionLabel}>Remove</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : (
              <EmptyState
                title="No people yet"
                message="Invite someone with a Tavelo account to join this trip."
                illustration="travel"
              />
            )}
            {canManage && user ? (
              <>
                <TripMemberSearch
                  tripId={trip.id}
                  currentUserId={user.id}
                  memberUserIds={members.map((member) => member.userId)}
                  pendingInviteeIds={sentInvites.map((invitation) => invitation.invitee.id)}
                  onInvited={(invitation) => {
                    setSentInvites((current) => [
                      invitation,
                      ...current.filter((item) => item.id !== invitation.id),
                    ]);
                  }}
                />
                {sentInvites.length > 0 ? (
                  <Text style={styles.sectionLabel}>Pending invitations</Text>
                ) : null}
                {sentInvites.map((invitation) => (
                  <View key={invitation.id} style={styles.memberRow}>
                    <View style={styles.memberCopy}>
                      <Text numberOfLines={1} style={styles.memberName}>
                        {invitation.invitee.name}
                      </Text>
                      {invitation.invitee.username ? (
                        <Text style={styles.role}>@{invitation.invitee.username}</Text>
                      ) : (
                        <Text style={styles.role}>{invitation.invitee.email}</Text>
                      )}
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Cancel invitation to ${invitation.invitee.name}`}
                      onPress={() => setConfirmMember({ kind: 'cancel', invitation })}
                      style={styles.textAction}
                    >
                      <Text style={styles.textActionLabel}>Cancel</Text>
                    </Pressable>
                  </View>
                ))}
              </>
            ) : null}
            {membershipError ? (
              <ErrorState title="Could not update people" message={membershipError} />
            ) : null}
          </View>
          {canManage ? (
            <View style={styles.actions}>
              <SecondaryButton
                label="Edit trip"
                onPress={() => router.push(`/trip/${trip.id}/edit` as Href)}
                disabled={deleting}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: deleting, busy: deleting }}
                disabled={deleting}
                onPress={() => setConfirmDelete(true)}
                style={({ pressed }) => [
                  styles.deleteButton,
                  pressed && !deleting ? styles.deletePressed : null,
                ]}
              >
                <Text style={styles.deleteLabel}>{deleting ? 'Deleting…' : 'Delete trip'}</Text>
              </Pressable>
            </View>
          ) : null}
          {actionError ? <ErrorState title="Could not delete" message={actionError} /> : null}
        </>
      ) : null}

      {activeTab === 'itinerary' ? (
        <TripItinerarySection
          key={trip.id}
          tripId={trip.id}
          startDate={trip.startDate}
          endDate={trip.endDate}
        />
      ) : null}

      {activeTab === 'bookings' ? (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Bookings</Text>
          <Text style={styles.muted}>
            Keep hotel, train, flight, and ticket confirmations in one shared place for the group.
          </Text>
          <PrimaryButton
            label="Open bookings"
            onPress={() => router.push(`/trip/${trip.id}/bookings` as Href)}
          />
        </View>
      ) : null}

      {activeTab === 'expenses' ? (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Expenses</Text>
          <Text style={styles.muted}>
            Track shared costs, who owes whom, and record settlements with the group.
          </Text>
          <PrimaryButton
            label="Open expense ledger"
            onPress={() => router.push(`/trip/${trip.id}/expenses` as Href)}
          />
        </View>
      ) : null}

      {activeTab === 'memories' ? (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Memories</Text>
          <Text style={styles.muted}>Share photos and videos with everyone on this trip.</Text>
          <PrimaryButton
            label="Open trip gallery"
            onPress={() => router.push(`/trip/${trip.id}/memories` as Href)}
          />
        </View>
      ) : null}
      <ConfirmDialog
        visible={confirmDelete}
        title="Delete this trip?"
        message="This removes the trip from your list. It cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Keep trip"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void confirmRemoval()}
      />
      <ConfirmDialog
        visible={confirmMember !== null}
        title={confirmMember?.kind === 'remove' ? 'Remove this person?' : 'Cancel this invitation?'}
        message={
          confirmMember?.kind === 'remove'
            ? `${confirmMember.name} will no longer see this trip.`
            : confirmMember?.kind === 'cancel'
              ? `The invitation to ${confirmMember.invitation.invitee.name} will be withdrawn.`
              : ''
        }
        confirmLabel={confirmMember?.kind === 'remove' ? 'Remove' : 'Cancel invitation'}
        cancelLabel="Keep"
        onCancel={() => setConfirmMember(null)}
        onConfirm={() => void confirmMembershipAction()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cover: {
    height: 220,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  coverText: {
    fontSize: 40,
  },
  card: {
    ...surfaceCard,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  pill: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    backgroundColor: colors.seafoam,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  destination: {
    ...typography.title,
    fontSize: 32,
    color: colors.ink,
  },
  name: {
    ...typography.cardTitle,
    color: colors.ink,
  },
  dates: {
    ...typography.body,
    color: colors.muted,
  },
  duration: {
    ...typography.label,
    color: colors.primary,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.ink,
  },
  description: {
    ...typography.body,
    color: colors.ink,
  },
  muted: {
    ...typography.body,
    color: colors.muted,
  },
  creator: {
    ...typography.body,
    color: colors.ink,
  },
  memberList: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
  },
  memberCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  role: {
    ...typography.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted,
  },
  textAction: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  textActionLabel: {
    ...typography.label,
    color: colors.danger,
  },
  memberName: {
    ...typography.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.ink,
    textAlign: 'left',
  },
  actions: {
    gap: spacing.md,
  },
  deleteButton: {
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSurface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  deletePressed: {
    opacity: 0.85,
  },
  deleteLabel: {
    ...typography.label,
    color: colors.danger,
  },
});
