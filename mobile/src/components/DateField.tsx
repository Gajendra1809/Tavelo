import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { createElement, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDateInput, formatDisplayDate, parseDateInput } from '@/lib/dates';
import { colors, radius, spacing, typography } from '@/theme';

type DateFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  minimumDate?: string;
};

export function DateField({ label, value, onChange, error, minimumDate }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseDateInput(value) : new Date();

  function handleChange(event: DateTimePickerEvent, next?: Date) {
    if (Platform.OS !== 'ios') {
      setOpen(false);
    }
    if (event.type === 'dismissed' || !next) {
      return;
    }
    onChange(formatDateInput(next));
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {Platform.OS === 'web'
        ? createElement('input', {
            type: 'date',
            value,
            min: minimumDate,
            'aria-label': label,
            onChange: (event: { target: { value: string } }) => onChange(event.target.value),
            style: webInputStyle(Boolean(error)),
          })
        : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={() => setOpen(true)}
            style={[styles.input, error ? styles.invalid : null]}
          >
            <Text style={value ? styles.value : styles.placeholder}>
              {value ? formatDisplayDate(value) : 'Choose a date'}
            </Text>
          </Pressable>
        )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {open && Platform.OS !== 'web' ? (
        <View>
          <DateTimePicker
            value={selected}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={minimumDate ? parseDateInput(minimumDate) : undefined}
            onChange={handleChange}
          />
          {Platform.OS === 'ios' ? (
            <Pressable accessibilityRole="button" onPress={() => setOpen(false)}>
              <Text style={styles.done}>Done</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function webInputStyle(invalid: boolean): Record<string, string | number> {
  return {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: invalid ? colors.danger : colors.line,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontSize: 16,
    paddingLeft: spacing.lg,
    paddingRight: spacing.lg,
    fontFamily: 'inherit',
  };
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.sm,
  },
  label: {
    ...typography.label,
    color: colors.ink,
  },
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  invalid: {
    borderColor: colors.danger,
  },
  value: {
    ...typography.body,
    color: colors.ink,
  },
  placeholder: {
    ...typography.body,
    color: colors.muted,
  },
  error: {
    ...typography.body,
    fontSize: 14,
    color: colors.danger,
  },
  done: {
    ...typography.label,
    color: colors.primary,
    textAlign: 'right',
    paddingVertical: spacing.sm,
  },
});
