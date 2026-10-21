import { useEffect, useRef, useState, type RefObject } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BottomFormSheet } from '@/components/BottomFormSheet';
import { FormField } from '@/components/FormField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SearchField } from '@/components/SearchField';
import { SecondaryButton } from '@/components/SecondaryButton';
import { LocationMapPreview } from '@/features/location/components/LocationMapPreview';
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
  onPresented?: () => void;
  initialPlace?: TaveloPlace | null;
  allowClear?: boolean;
  /** Bump when opening so form state resets without an effect. */
  sessionKey: number;
};

type BodyProps = Omit<LocationPickerSheetProps, 'visible' | 'sessionKey'> & {
  sheetScrollRef: RefObject<ScrollView | null>;
  onStepChange: (keyboardScrollToEnd: boolean) => void;
};

export function LocationPickerSheet({
  visible,
  onClose,
  onPresented,
  sessionKey,
  ...bodyProps
}: LocationPickerSheetProps) {
  const [contentReady, setContentReady] = useState(false);
  const [keyboardScrollToEnd, setKeyboardScrollToEnd] = useState(false);
  const sheetScrollRef = useRef<ScrollView>(null);
  const presentedRef = useRef(false);
  const onPresentedRef = useRef(onPresented);

  useEffect(() => {
    onPresentedRef.current = onPresented;
  }, [onPresented]);

  function handleClose() {
    setContentReady(false);
    setKeyboardScrollToEnd(false);
    presentedRef.current = false;
    onClose();
  }

  function markPresented() {
    if (presentedRef.current) {
      return;
    }
    presentedRef.current = true;
    setContentReady(true);
    onPresentedRef.current?.();
  }

  function handleShow() {
    markPresented();
  }

  useEffect(() => {
    if (!visible) {
      presentedRef.current = false;
      return;
    }
    presentedRef.current = false;
    const fallback = setTimeout(() => {
      if (presentedRef.current) {
        return;
      }
      presentedRef.current = true;
      setContentReady(true);
      onPresentedRef.current?.();
    }, 500);
    return () => clearTimeout(fallback);
  }, [visible, sessionKey]);

  return (
    <BottomFormSheet
      visible={visible}
      onClose={handleClose}
      title="Choose location"
      onShow={handleShow}
      keyboardScrollToEnd={keyboardScrollToEnd}
      scrollRef={sheetScrollRef}
    >
      {visible && contentReady ? (
        <LocationPickerBody
          key={sessionKey}
          onClose={handleClose}
          sheetScrollRef={sheetScrollRef}
          onStepChange={setKeyboardScrollToEnd}
          {...bodyProps}
        />
      ) : visible ? (
        <View style={styles.boot}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.bootText}>Loading search…</Text>
        </View>
      ) : null}
    </BottomFormSheet>
  );
}

function LocationPickerBody({
  onClose,
  onConfirm,
  initialPlace,
  allowClear = false,
  sheetScrollRef,
  onStepChange,
}: BodyProps) {
  const [step, setStep] = useState<Step>('search');

  useEffect(() => {
    onStepChange(step === 'manual');
  }, [onStepChange, step]);

  function scrollSheetToEnd() {
    requestAnimationFrame(() => {
      sheetScrollRef.current?.scrollToEnd({ animated: true });
    });
  }
  const [query, setQuery] = useState('');
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
          {initialPlace ? (
            <View style={styles.currentBanner}>
              <Text style={styles.currentLabel}>Current location</Text>
              <Text style={styles.currentValue}>{placePrimaryLine(initialPlace)}</Text>
            </View>
          ) : null}
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder="Search places or destinations"
            accessibilityLabel="Search places or destinations"
            autoFocus
          />
          {!searchActive && !trimmedQuery ? (
            <Text style={styles.hint}>Type at least 2 characters to search.</Text>
          ) : null}
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
            Manual locations are saved as text only. Pick a place from search if you want a map preview or
            Open in Maps on the trip.
          </Text>
          <FormField
            label="Place name"
            value={manualName}
            onChangeText={setManualName}
            placeholder="e.g. Cousin’s farmhouse"
            autoFocus
            onFocus={scrollSheetToEnd}
          />
          <FormField
            label="Address (optional)"
            value={manualAddress}
            onChangeText={setManualAddress}
            placeholder="Street, city, or notes"
            multiline
            onFocus={scrollSheetToEnd}
          />
          <PrimaryButton label="Use this location" onPress={confirmManual} disabled={!manualName.trim()} />
          <SecondaryButton label="Back to search" onPress={() => setStep('search')} />
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  boot: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  bootText: {
    ...typography.body,
    fontSize: 14,
    color: colors.muted,
  },
  stack: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  currentBanner: {
    backgroundColor: colors.seafoam,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  currentLabel: {
    ...typography.label,
    fontSize: 11,
    color: colors.muted,
  },
  currentValue: {
    ...typography.body,
    color: colors.ink,
    fontWeight: '600',
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
