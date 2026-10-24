import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { BottomFormSheet } from '@/components/BottomFormSheet';
import { DateField } from '@/components/DateField';
import { FormField } from '@/components/FormField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors, radius, spacing, typography } from '@/theme';
import {
  POLL_CATEGORIES,
  POLL_CATEGORY_LABELS,
  type CreatePollBody,
  type PollCategory,
} from '@/types/poll';

type CreatePollSheetProps = {
  visible: boolean;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (body: CreatePollBody) => void;
};

const PRESETS: { category: PollCategory; question: string; options: string[] }[] = [
  { category: 'destination', question: 'Where should we go?', options: ['', ''] },
  { category: 'hotel', question: 'Which hotel should we book?', options: ['', ''] },
  { category: 'restaurant', question: 'Where should we eat?', options: ['', ''] },
  { category: 'activity', question: 'Which activity should we do?', options: ['', ''] },
  { category: 'transport', question: 'How should we get there?', options: ['Flight', 'Train'] },
  { category: 'dates', question: 'Which dates work?', options: ['', ''] },
  { category: 'other', question: '', options: ['', ''] },
];

export function CreatePollSheet({
  visible,
  submitting,
  error,
  onClose,
  onSubmit,
}: CreatePollSheetProps) {
  const [category, setCategory] = useState<PollCategory>('hotel');
  const [question, setQuestion] = useState('Which hotel should we book?');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multiple, setMultiple] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [allowAddOptions, setAllowAddOptions] = useState(false);
  const [deadline, setDeadline] = useState('');

  function applyPreset(next: PollCategory) {
    const preset = PRESETS.find((item) => item.category === next) ?? PRESETS[6]!;
    setCategory(next);
    if (preset.question) {
      setQuestion(preset.question);
    }
    if (preset.options.some((item) => item.length > 0)) {
      setOptions(preset.options);
    }
  }

  function submit() {
    const cleaned = options.map((item) => item.trim()).filter((item) => item.length > 0);
    onSubmit({
      question: question.trim(),
      description: description.trim() || undefined,
      category,
      voteType: multiple ? 'multiple' : 'single',
      anonymous,
      allowAddOptions,
      deadlineAt: deadline ? `${deadline}T23:59:59.000Z` : null,
      options: cleaned.map((label) => ({ label })),
    });
  }

  return (
    <BottomFormSheet
      visible={visible}
      onClose={onClose}
      title="New poll"
      keyboardScrollToEnd
    >
      <Text style={styles.hint}>Pick a preset, then edit the question and options.</Text>
      <View style={styles.presets}>
        {POLL_CATEGORIES.map((item) => (
          <Pressable
            key={item}
            accessibilityRole="button"
            accessibilityState={{ selected: category === item }}
            onPress={() => applyPreset(item)}
            style={[styles.preset, category === item ? styles.presetActive : null]}
          >
            <Text style={[styles.presetLabel, category === item ? styles.presetLabelActive : null]}>
              {POLL_CATEGORY_LABELS[item]}
            </Text>
          </Pressable>
        ))}
      </View>
      <FormField
        label="Question"
        value={question}
        onChangeText={setQuestion}
        placeholder="Which hotel should we book?"
        maxLength={160}
      />
      <FormField
        label="Context (optional)"
        value={description}
        onChangeText={setDescription}
        placeholder="Share a note for the group"
        multiline
        maxLength={500}
      />
      {options.map((option, index) => (
        <View key={`option-${index}`} style={styles.optionRow}>
          <View style={styles.optionField}>
            <FormField
              label={`Option ${index + 1}`}
              value={option}
              onChangeText={(value) =>
                setOptions((current) => current.map((item, itemIndex) => (itemIndex === index ? value : item)))
              }
              placeholder="Add a choice"
              maxLength={120}
            />
          </View>
          {options.length > 2 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove option ${index + 1}`}
              onPress={() => setOptions((current) => current.filter((_, itemIndex) => itemIndex !== index))}
              style={styles.remove}
            >
              <Text style={styles.removeLabel}>Remove</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
      {options.length < 10 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setOptions((current) => [...current, ''])}
          style={styles.addOption}
        >
          <Text style={styles.addOptionLabel}>Add option</Text>
        </Pressable>
      ) : null}
      <ToggleRow label="Allow more than one choice" value={multiple} onValueChange={setMultiple} />
      <ToggleRow label="Hide who voted" value={anonymous} onValueChange={setAnonymous} />
      <ToggleRow
        label="Let members add options"
        value={allowAddOptions}
        onValueChange={setAllowAddOptions}
      />
      <DateField
        label="Voting deadline (optional)"
        value={deadline}
        onChange={setDeadline}
        allowClear
        placeholder="No deadline"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton label="Create poll" onPress={submit} loading={submitting} />
    </BottomFormSheet>
  );
}

function ToggleRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.toggle}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.line, true: colors.seafoam }}
        thumbColor={value ? colors.primary : colors.muted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hint: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
  },
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  preset: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.seafoam,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetActive: {
    backgroundColor: colors.primary,
  },
  presetLabel: {
    ...typography.label,
    fontSize: 13,
    color: colors.primary,
  },
  presetLabelActive: {
    color: colors.onPrimary,
  },
  optionRow: {
    gap: spacing.xs,
  },
  optionField: {
    flex: 1,
  },
  remove: {
    minHeight: 40,
    alignSelf: 'flex-start',
    justifyContent: 'center',
  },
  removeLabel: {
    ...typography.label,
    color: colors.danger,
  },
  addOption: {
    minHeight: 44,
    justifyContent: 'center',
  },
  addOptionLabel: {
    ...typography.label,
    color: colors.primary,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    gap: spacing.md,
  },
  toggleLabel: {
    ...typography.body,
    color: colors.ink,
    flex: 1,
  },
  error: {
    ...typography.body,
    color: colors.danger,
  },
});
