import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomFormSheet } from '@/components/BottomFormSheet';
import { FormField } from '@/components/FormField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SearchField } from '@/components/SearchField';
import { SecondaryButton } from '@/components/SecondaryButton';
import { LocationMapPreview } from '@/features/location/components/LocationMapPreview';
import { LocationStatusBadge } from '@/features/location/components/LocationStatusBadge';
import { createManualPlace, searchHitToPlace } from '@/features/location/placeHelpers';
import { placePrimaryLine, placeSecondaryLine } from '@/features/location/placeDisplay';
import { ApiError } from '@/lib/apiClient';
import { searchPlaces } from '@/services/placeSearchService';
import type { PlaceSearchHit, TaveloPlace } from '@/types/place';
import { colors, radius, spacing, typography } from '@/theme';

type Step = 'search' | 'confirm' | 'manual';

type LocationPickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (place: TaveloPlace | null) => void;
  initialPlace?: TaveloPlace | null;
  allowClear?: boolean;
  /** Bump when opening so form state resets without an effect. */
  sessionKey: number;
};

type BodyProps = Omit<LocationPickerSheetProps, 'visible' | 'sessionKey'>;

export function LocationPickerSheet({
  visible,
  onClose,
  sessionKey,
  ...bodyProps
}: LocationPickerSheetProps) {
  return (
    <BottomFormSheet visible={visible} onClose={onClose} title="Choose location">
      {visible ? (
        <LocationPickerBody key={sessionKey} onClose={onClose} {...bodyProps} />
      ) : null}
    </BottomFormSheet>
  );
}

function LocationPickerBody({
  onClose,
  onConfirm,
  initialPlace,
  allowClear = false,
}: BodyProps) {
  const [step, setStep] = useState<Step>('search');
  const [query, setQuery] = useState(initialPlace?.name ?? '');
  const [results, setResults] = useState<PlaceSearchHit[]>([]);
  const [lastFetchedQuery, setLastFetchedQuery] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [attribution, setAttribution] = useState<string | null>(null);
  const [pending, setPending] = useState<TaveloPlace | null>(null);
  const [manualName, setManualName] = useState(
    initialPlace?.source === 'manual' ? initialPlace.name : '',
  );
  const [manualAddress, setManualAddress] = useState(initialPlace?.formattedAddress ?? '');

  const trimmedQuery = query.trim();
  const searchActive = step === 'search' && trimmedQuery.length >= 2;

  useEffect(() => {
    if (!searchActive) {
      return;
    }
    let cancelled = false;
    const queryForFetch = trimmedQuery;
    const handle = setTimeout(() => {
      void searchPlaces(queryForFetch)
        .then((response) => {
          if (!cancelled) {
            setResults(response.results);
            setAttribution(response.attribution);
            setLastFetchedQuery(queryForFetch);
            setSearchError(null);
          }
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            setResults([]);
            setLastFetchedQuery(queryForFetch);
            setSearchError(
              err instanceof ApiError
                ? err.message
                : err instanceof Error
                  ? err.message
                  : 'Place search failed.',
            );
          }
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [searchActive, trimmedQuery]);

  const displayResults = searchActive && lastFetchedQuery === trimmedQuery ? results : [];
  const showLoading = searchActive && lastFetchedQuery !== trimmedQuery;
  const displayAttribution =
    searchActive && lastFetchedQuery === trimmedQuery ? attribution : null;
  const displayError = searchActive && lastFetchedQuery === trimmedQuery ? searchError : null;

  function closeAll() {
    onClose();
  }

  function selectResult(result: PlaceSearchHit) {
    setPending(searchHitToPlace(result));
    setStep('confirm');
  }

  function confirmSelection() {
    if (!pending) {
      return;
    }
    onConfirm(pending);
    closeAll();
  }

  function confirmManual() {
    const name = manualName.trim();
    if (!name) {
      return;
    }
    onConfirm(createManualPlace(name, manualAddress.trim() || undefined));
    closeAll();
  }

  return (
    <>
      {step === 'search' ? (
        <View style={styles.stack}>
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder="Search places or destinations"
            accessibilityLabel="Search places or destinations"
          />
          {showLoading ? (
            <View style={styles.centerRow}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.hint}>Searching places…</Text>
            </View>
          ) : null}
          {displayError ? <Text style={styles.error}>{displayError}</Text> : null}
          {!showLoading && !displayError && searchActive && displayResults.length === 0 ? (
            <Text style={styles.hint}>No matches found. Try another spelling or enter manually.</Text>
          ) : null}
          {displayResults.map((item) => (
            <Pressable
              key={item.placeId}
              accessibilityRole="button"
              onPress={() => selectResult(item)}
              style={({ pressed }) => [styles.resultRow, pressed ? styles.pressed : null]}
            >
              <Text style={styles.resultName}>{item.name}</Text>
              <Text style={styles.resultAddress} numberOfLines={3}>
                {item.formattedAddress}
              </Text>
            </Pressable>
          ))}
          {displayAttribution ? <Text style={styles.attribution}>{displayAttribution}</Text> : null}
          <SecondaryButton
            label="Enter location manually"
            onPress={() => {
              setManualName(query.trim());
              setStep('manual');
            }}
          />
          {allowClear && initialPlace ? (
            <SecondaryButton
              label="Remove location"
              onPress={() => {
                onConfirm(null);
                closeAll();
              }}
            />
          ) : null}
        </View>
      ) : null}

      {step === 'confirm' && pending ? (
        <View style={styles.stack}>
          <LocationStatusBadge place={pending} />
          <Text style={styles.confirmName}>{placePrimaryLine(pending)}</Text>
          {placeSecondaryLine(pending) ? (
            <Text style={styles.confirmAddress}>{placeSecondaryLine(pending)}</Text>
          ) : null}
          <LocationMapPreview place={pending} />
          <PrimaryButton label="Confirm selection" onPress={confirmSelection} />
          <SecondaryButton label="Back to search" onPress={() => setStep('search')} />
        </View>
      ) : null}

      {step === 'manual' ? (
        <View style={styles.stack}>
          <Text style={styles.manualNote}>
            Manual locations are saved without verified coordinates. You can still open directions using
            the name or address.
          </Text>
          <FormField
            label="Place name"
            value={manualName}
            onChangeText={setManualName}
            placeholder="e.g. Cousin’s farmhouse"
          />
          <FormField
            label="Address (optional)"
            value={manualAddress}
            onChangeText={setManualAddress}
            placeholder="Street, city, or notes"
            multiline
          />
          <PrimaryButton label="Use this location" onPress={confirmManual} disabled={!manualName.trim()} />
          <SecondaryButton label="Back to search" onPress={() => setStep('search')} />
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  centerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  hint: {
    ...typography.body,
    fontSize: 14,
    color: colors.muted,
  },
  error: {
    ...typography.body,
    fontSize: 14,
    color: colors.danger,
  },
  attribution: {
    ...typography.label,
    fontSize: 11,
    color: colors.muted,
    textAlign: 'center',
  },
  resultRow: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.xs,
  },
  pressed: {
    opacity: 0.9,
    borderColor: colors.primary,
  },
  resultName: {
    ...typography.cardTitle,
    color: colors.ink,
  },
  resultAddress: {
    ...typography.body,
    fontSize: 13,
    color: colors.muted,
  },
  confirmName: {
    ...typography.title,
    fontSize: 22,
    color: colors.ink,
  },
  confirmAddress: {
    ...typography.body,
    color: colors.muted,
  },
  manualNote: {
    ...typography.body,
    fontSize: 14,
    color: colors.warning,
  },
});
