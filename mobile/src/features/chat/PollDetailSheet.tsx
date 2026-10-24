import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text } from 'react-native';
import { BottomFormSheet } from '@/components/BottomFormSheet';
import { FormField } from '@/components/FormField';
import { SecondaryButton } from '@/components/SecondaryButton';
import { colors, spacing, typography } from '@/theme';
import { POLL_CATEGORY_LABELS, type TripPoll } from '@/types/poll';
import { isHttpsUrl } from '@/features/chat/messageLinks';
import { PollCard } from '@/features/chat/PollCard';

type PollDetailSheetProps = {
  visible: boolean;
  poll: TripPoll | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onVote: (optionId: string) => void;
  onClearVote: () => void;
  onAddOption: (label: string) => void;
  onClosePoll: () => void;
  onDeletePoll: () => void;
};

export function PollDetailSheet({
  visible,
  poll,
  busy,
  error,
  onClose,
  onVote,
  onClearVote,
  onAddOption,
  onClosePoll,
  onDeletePoll,
}: PollDetailSheetProps) {
  const [optionLabel, setOptionLabel] = useState('');

  if (!poll) {
    return null;
  }

  return (
    <BottomFormSheet visible={visible} onClose={onClose} title="Poll" keyboardScrollToEnd>
      <PollCard poll={poll} voting={busy} onVote={onVote} />
      {poll.ownOptionIds.length > 0 && poll.canVote ? (
        <SecondaryButton label="Remove my vote" onPress={onClearVote} disabled={busy} />
      ) : null}
      {!poll.anonymous
        ? poll.options.map((option) =>
            option.voters && option.voters.length > 0 ? (
              <Text key={`voters-${option.id}`} style={styles.voters}>
                {option.label}: {option.voters.map((voter) => voter.name).join(', ')}
              </Text>
            ) : null,
          )
        : null}
      {poll.options
        .filter((option) => option.linkUrl && isHttpsUrl(option.linkUrl))
        .map((option) => (
          <Pressable
            key={`link-${option.id}`}
            accessibilityRole="link"
            onPress={() => void Linking.openURL(option.linkUrl!)}
          >
            <Text style={styles.link}>{option.label} link</Text>
          </Pressable>
        ))}
      {poll.canAddOption ? (
        <>
          <FormField
            label="Add an option"
            value={optionLabel}
            onChangeText={setOptionLabel}
            placeholder="Another place"
            maxLength={120}
          />
          <SecondaryButton
            label="Add option"
            onPress={() => {
              onAddOption(optionLabel.trim());
              setOptionLabel('');
            }}
            disabled={busy || optionLabel.trim().length === 0}
          />
        </>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {poll.canClose ? <SecondaryButton label="Close poll" onPress={onClosePoll} disabled={busy} /> : null}
      {poll.canDelete ? (
        <Pressable accessibilityRole="button" onPress={onDeletePoll} style={styles.delete}>
          <Text style={styles.deleteLabel}>Delete poll</Text>
        </Pressable>
      ) : null}
      <Text style={styles.meta}>
        {POLL_CATEGORY_LABELS[poll.category]} · {poll.creator.name}
      </Text>
    </BottomFormSheet>
  );
}

const styles = StyleSheet.create({
  voters: {
    ...typography.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted,
  },
  link: {
    ...typography.label,
    color: colors.primary,
  },
  error: {
    ...typography.body,
    color: colors.danger,
  },
  delete: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteLabel: {
    ...typography.label,
    color: colors.danger,
  },
  meta: {
    ...typography.body,
    fontSize: 12,
    lineHeight: 16,
    color: colors.muted,
  },
});
