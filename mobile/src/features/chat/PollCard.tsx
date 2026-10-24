import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';
import { POLL_CATEGORY_LABELS, type TripPoll } from '@/types/poll';

type PollCardProps = {
  poll: TripPoll;
  compact?: boolean;
  voting?: boolean;
  onVote: (optionId: string) => void;
  onOpen?: () => void;
};

export function PollCard({ poll, compact = false, voting = false, onVote, onOpen }: PollCardProps) {
  const statusLabel =
    poll.status === 'open' ? 'Open' : poll.status === 'expired' ? 'Expired' : 'Closed';
  const resultLabel =
    poll.status === 'open'
      ? `${poll.votedCount} of ${poll.memberCount} voted`
      : poll.result.kind === 'winner'
        ? 'Winner decided'
        : poll.result.kind === 'tie'
          ? 'Tied — no automatic winner'
          : 'No votes';

  return (
    <View style={[styles.card, compact ? styles.compact : null]}>
      <View style={styles.top}>
        <Text style={styles.category}>{POLL_CATEGORY_LABELS[poll.category]}</Text>
        <Text style={[styles.status, poll.status === 'open' ? styles.open : styles.closed]}>
          {statusLabel}
        </Text>
      </View>
      <Text style={styles.question}>{poll.question}</Text>
      {poll.description && !compact ? <Text style={styles.description}>{poll.description}</Text> : null}
      <View style={styles.options}>
        {poll.options.map((option) => {
          const selected = poll.ownOptionIds.includes(option.id);
          const winning = poll.result.optionIds.includes(option.id) && poll.result.kind !== 'none';
          return (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled: !poll.canVote || voting }}
              accessibilityLabel={`${option.label}, ${option.voteCount} votes`}
              disabled={!poll.canVote || voting}
              onPress={() => onVote(option.id)}
              style={[
                styles.option,
                selected ? styles.optionSelected : null,
                winning && poll.status !== 'open' ? styles.optionWinning : null,
              ]}
            >
              <View style={styles.optionCopy}>
                <Text style={styles.optionLabel}>{option.label}</Text>
                {option.linkUrl ? <Text style={styles.optionMeta}>Has a link</Text> : null}
              </View>
              <Text style={styles.optionCount}>
                {option.voteCount} · {option.percent}%
              </Text>
              <View
                style={[
                  styles.bar,
                  { width: `${Math.max(option.percent, selected ? 8 : 0)}%` as `${number}%` },
                ]}
              />
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.participation}>{resultLabel}</Text>
      {poll.deadlineAt && poll.status === 'open' ? (
        <Text style={styles.deadline}>Closes {formatDeadline(poll.deadlineAt)}</Text>
      ) : null}
      {onOpen ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open full poll"
          onPress={onOpen}
          style={styles.openFull}
        >
          <Text style={styles.openFullLabel}>Open poll</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function formatDeadline(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.ivory,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: spacing.sm,
  },
  compact: {
    minWidth: 240,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  category: {
    ...typography.eyebrow,
    color: colors.primary,
    fontSize: 11,
  },
  status: {
    ...typography.label,
    fontSize: 12,
  },
  open: {
    color: colors.success,
  },
  closed: {
    color: colors.muted,
  },
  question: {
    ...typography.cardTitle,
    color: colors.ink,
    fontSize: 16,
  },
  description: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
  },
  options: {
    gap: spacing.sm,
  },
  option: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  optionSelected: {
    borderColor: colors.primary,
  },
  optionWinning: {
    borderColor: colors.success,
  },
  optionCopy: {
    flex: 1,
    zIndex: 1,
  },
  optionLabel: {
    ...typography.label,
    color: colors.ink,
  },
  optionMeta: {
    ...typography.body,
    fontSize: 12,
    lineHeight: 16,
    color: colors.muted,
  },
  optionCount: {
    ...typography.label,
    fontSize: 12,
    color: colors.muted,
    zIndex: 1,
  },
  bar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.seafoam,
  },
  participation: {
    ...typography.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted,
  },
  deadline: {
    ...typography.body,
    fontSize: 12,
    lineHeight: 16,
    color: colors.warning,
  },
  openFull: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openFullLabel: {
    ...typography.label,
    color: colors.primary,
  },
});
