import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { FormField } from '@/components/FormField';
import { UserAvatar } from '@/components/UserAvatar';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { ApiError } from '@/lib/apiClient';
import { searchUsers } from '@/services/userService';
import { inviteToTripByUserId } from '@/services/invitationService';
import type { SentInvitation } from '@/types/invitation';
import type { UserSearchHit } from '@/types/user';
import { colors, radius, spacing, typography } from '@/theme';

type TripMemberSearchProps = {
  tripId: string;
  currentUserId: string;
  memberUserIds: string[];
  pendingInviteeIds: string[];
  onInvited: (invitation: SentInvitation) => void;
};

export function TripMemberSearch({
  tripId,
  currentUserId,
  memberUserIds,
  pendingInviteeIds,
  onInvited,
}: TripMemberSearchProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<UserSearchHit[]>([]);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const debouncedQuery = useDebouncedValue(query.trim(), 350);
  const requestId = useRef(0);

  const excluded = useMemo(() => {
    const ids = new Set(memberUserIds);
    ids.add(currentUserId);
    for (const id of pendingInviteeIds) {
      ids.add(id);
    }
    return ids;
  }, [memberUserIds, currentUserId, pendingInviteeIds]);

  useEffect(() => {
    const q = debouncedQuery;
    if (q.length < 2) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }

    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    void searchUsers(q)
      .then(({ users }) => {
        if (requestId.current !== id) {
          return;
        }
        setResults(users.filter((user) => !excluded.has(user.id)));
        setLoading(false);
      })
      .catch((failure) => {
        if (requestId.current !== id) {
          return;
        }
        setResults([]);
        setLoading(false);
        setError(
          failure instanceof ApiError ? failure.message : 'Could not search for people. Try again.',
        );
      });
  }, [debouncedQuery, excluded]);

  async function invite(user: UserSearchHit) {
    if (invitingId) {
      return;
    }
    setInvitingId(user.id);
    setError(null);
    try {
      const invitation = await inviteToTripByUserId(tripId, user.id);
      onInvited(invitation);
      setQuery('');
      setResults([]);
    } catch (failure) {
      setError(
        failure instanceof ApiError ? failure.message : 'Could not send the invitation.',
      );
    } finally {
      setInvitingId(null);
    }
  }

  const showEmpty =
    debouncedQuery.length >= 2 && !loading && !error && results.length === 0;

  return (
    <View style={styles.wrap}>
      <FormField
        label="Add someone"
        value={query}
        onChangeText={(value) => {
          setQuery(value);
          setError(null);
        }}
        placeholder="Search by name, username, or email"
        autoCapitalize="none"
        autoComplete="off"
      />
      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Searching…</Text>
        </View>
      ) : null}
      {error ? (
        <ErrorState
          title="Search failed"
          message={error}
          onRetry={() => {
            requestId.current += 1;
            const q = debouncedQuery;
            if (q.length < 2) {
              return;
            }
            setLoading(true);
            setError(null);
            void searchUsers(q)
              .then(({ users }) => {
                setResults(users.filter((user) => !excluded.has(user.id)));
                setLoading(false);
              })
              .catch((failure) => {
                setLoading(false);
                setError(
                  failure instanceof ApiError
                    ? failure.message
                    : 'Could not search for people. Try again.',
                );
              });
          }}
        />
      ) : null}
      {showEmpty ? (
        <EmptyState
          title="No matches"
          message="Try another name, @username, or email address."
          illustration="travel"
        />
      ) : null}
      {results.length > 0 ? (
        <View style={styles.list}>
          {results.map((user) => (
            <Pressable
              key={user.id}
              accessibilityRole="button"
              accessibilityLabel={`Invite ${user.name}`}
              disabled={invitingId === user.id}
              onPress={() => void invite(user)}
              style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
            >
              <UserAvatar
                name={user.name}
                uri={user.avatarUrl}
                cacheKey={`avatar:${user.id}`}
                size="md"
              />
              <View style={styles.copy}>
                <Text numberOfLines={1} style={styles.name}>
                  {user.name}
                </Text>
                {user.username ? (
                  <Text numberOfLines={1} style={styles.username}>
                    @{user.username}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.action}>
                {invitingId === user.id ? 'Inviting…' : 'Invite'}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  loadingText: {
    ...typography.body,
    fontSize: 14,
    color: colors.muted,
  },
  list: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 56,
    backgroundColor: colors.surface,
  },
  rowPressed: {
    backgroundColor: colors.seafoam,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...typography.body,
    color: colors.ink,
  },
  username: {
    ...typography.body,
    fontSize: 13,
    color: colors.muted,
  },
  action: {
    ...typography.label,
    color: colors.primary,
  },
});
