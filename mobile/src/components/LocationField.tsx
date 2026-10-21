import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocationPickerOptional } from '@/features/location/LocationPickerHost';
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
  const pickerHost = useLocationPickerOptional();
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const [fallbackSessionKey, setFallbackSessionKey] = useState(0);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    if (!opening) {
      return;
    }
    const safety = setTimeout(() => setOpening(false), 12_000);
    return () => clearTimeout(safety);
  }, [opening]);

  function openPicker() {
    if (opening) {
      return;
    }
    setOpening(true);
    const finish = () => setOpening(false);

    if (pickerHost) {
      pickerHost.openLocationPicker({
        initialPlace: place,
        allowClear: Boolean(place),
        onPresented: finish,
        onConfirm: (next) => {
          onPlaceChange(next);
          finish();
        },
        onDismiss: finish,
      });
      return;
    }

    setFallbackSessionKey((key) => key + 1);
    setFallbackOpen(true);
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ busy: opening }}
        disabled={opening}
        onPress={openPicker}
        style={[styles.trigger, error ? styles.invalid : null, opening ? styles.opening : null]}
      >
        <SymbolView
          name={{ android: 'location_on', web: 'location_on' }}
          size={20}
          tintColor={place ? colors.primary : colors.muted}
          style={styles.icon}
        />
        <View style={styles.copy}>
          {opening ? (
            <View style={styles.openingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.openingText}>Opening location picker…</Text>
            </View>
          ) : place ? (
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
        {opening ? null : (
          <SymbolView
            name={{ android: 'chevron_right', web: 'chevron_right' }}
            size={18}
            tintColor={colors.muted}
          />
        )}
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!pickerHost ? (
        <LocationPickerSheet
          sessionKey={fallbackSessionKey}
          visible={fallbackOpen}
          onPresented={() => setOpening(false)}
          onClose={() => {
            setFallbackOpen(false);
            setOpening(false);
          }}
          allowClear={Boolean(place)}
          onConfirm={(next) => {
            onPlaceChange(next);
            setFallbackOpen(false);
            setOpening(false);
          }}
          initialPlace={place}
        />
      ) : null}
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
  opening: {
    borderColor: colors.primary,
    backgroundColor: colors.seafoam,
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
  openingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  openingText: {
    ...typography.body,
    fontSize: 14,
    color: colors.muted,
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
