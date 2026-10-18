import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LocationPickerSheet } from '@/features/location/components/LocationPickerSheet';
import { placePrimaryLine, placeSecondaryLine } from '@/features/location/placeDisplay';
import type { TaveloPlace } from '@/types/place';
import { colors, radius, spacing, typography } from '@/theme';

type LocationFieldProps = {
  label: string;
  place: TaveloPlace | null;
  onPlaceChange: (place: TaveloPlace | null) => void;
  error?: string;
  placeholder?: string;
};

export function LocationField({
  label,
  place,
  onPlaceChange,
  error,
  placeholder = 'Search places or destinations',
}: LocationFieldProps) {
  const [open, setOpen] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => {
          setSessionKey((key) => key + 1);
          setOpen(true);
        }}
        style={[styles.trigger, error ? styles.invalid : null]}
      >
        <SymbolView
          name={{ android: 'location_on', web: 'location_on' }}
          size={20}
          tintColor={place ? colors.primary : colors.muted}
          style={styles.icon}
        />
        <View style={styles.copy}>
          {place ? (
            <>
              <Text style={styles.value}>{placePrimaryLine(place)}</Text>
              {placeSecondaryLine(place) ? (
                <Text style={styles.hint} numberOfLines={2}>
                  {placeSecondaryLine(place)}
                </Text>
              ) : null}
            </>
          ) : (
            <Text style={styles.placeholder}>{placeholder}</Text>
          )}
        </View>
        <SymbolView
          name={{ android: 'chevron_right', web: 'chevron_right' }}
          size={18}
          tintColor={colors.muted}
        />
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <LocationPickerSheet
        sessionKey={sessionKey}
        visible={open}
        onClose={() => setOpen(false)}
        allowClear={Boolean(place)}
        onConfirm={(next) => {
          onPlaceChange(next);
          setOpen(false);
        }}
        initialPlace={place}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.xs,
  },
  label: {
    ...typography.label,
    color: colors.ink,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 52,
  },
  invalid: {
    borderColor: colors.danger,
  },
  icon: {
    marginTop: 2,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  value: {
    ...typography.body,
    color: colors.ink,
    fontWeight: '600',
  },
  hint: {
    ...typography.body,
    fontSize: 13,
    color: colors.muted,
  },
  placeholder: {
    ...typography.body,
    color: colors.muted,
  },
  error: {
    ...typography.body,
    fontSize: 13,
    color: colors.danger,
  },
});
