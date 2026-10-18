import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EditableCover } from '@/components/EditableCover';
import { PhotoActionLinks } from '@/components/PhotoActionLinks';
import { ErrorState } from '@/components/ErrorState';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { Skeleton } from '@/components/Skeleton';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTripFromCache } from '@/hooks/useTripFromCache';
import { tripCache } from '@/lib/cache/tripCache';
import { ApiError } from '@/lib/apiClient';
import { logAppError, userFacingMessage } from '@/lib/errorReport';
import {
  deleteTripCover,
  mimeFromUri,
  uploadTripCoverFromUri,
} from '@/services/mediaService';
import { resolveLocalByteSize } from '@/services/storageUpload';
import { updateTrip } from '@/services/tripService';
import { colors, radius, spacing, typography } from '@/theme';
import type { TaveloPlace } from '@/types/place';
import { TripFormFields } from './TripFormFields';
import {
  emptyTripForm,
  isTripFormChanged,
  validateTripForm,
  type TripFormErrors,
  type TripFormValues,
} from './validateTripForm';

export function EditTripScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const navigation = useNavigation();
  const { user } = useAuth();
  const allowLeave = useRef(false);
  const savingRef = useRef(false);
  const hydratedRef = useRef(false);
  const [initial, setInitial] = useState<TripFormValues>(emptyTripForm);
  const [values, setValues] = useState<TripFormValues>(emptyTripForm);
  const [destinationPlace, setDestinationPlace] = useState<TaveloPlace | null>(null);
  const [initialDestinationPlace, setInitialDestinationPlace] = useState<TaveloPlace | null>(null);
  const [errors, setErrors] = useState<TripFormErrors>({});
  const { trip, loading, error: loadError, errorStatus: loadStatus, refresh } = useTripFromCache(id);
  const [forbidden, setForbidden] = useState(false);
  const [formReady, setFormReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverLabel, setCoverLabel] = useState('');
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  useEffect(() => {
    hydratedRef.current = false;
    setFormReady(false);
  }, [id]);

  useEffect(() => {
    if (!trip || !user || hydratedRef.current) {
      return;
    }
    if (!trip.creatorId || user.id !== trip.creatorId) {
      setForbidden(true);
      return;
    }
    setForbidden(false);
    const next = {
      name: trip.name,
      destination: trip.destination,
      startDate: trip.startDate,
      endDate: trip.endDate,
      description: trip.description ?? '',
    };
    setInitial(next);
    setValues(next);
    setDestinationPlace(trip.destinationPlace ?? null);
    setInitialDestinationPlace(trip.destinationPlace ?? null);
    setCoverUrl(trip.coverImageUrl);
    setCoverLabel(trip.destination);
    hydratedRef.current = true;
    setFormReady(true);
  }, [trip, user]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      const placeChanged =
        JSON.stringify(destinationPlace) !== JSON.stringify(initialDestinationPlace);
      if (
        allowLeave.current ||
        loading ||
        forbidden ||
        (!isTripFormChanged(values, initial) && !placeChanged) ||
        saving
      ) {
        return;
      }
      event.preventDefault();
      setConfirmLeave(true);
    });
    return unsubscribe;
  }, [
    destinationPlace,
    forbidden,
    initial,
    initialDestinationPlace,
    loading,
    navigation,
    saving,
    values,
  ]);

  function update(key: keyof TripFormValues, value: string) {
    setValues((current) => {
      const next = { ...current, [key]: value };
      if (key === 'startDate' && next.endDate && value > next.endDate) {
        next.endDate = value;
      }
      return next;
    });
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function changeCover() {
    if (!id || coverBusy) {
      return;
    }
    setCoverError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setCoverError('Photo library access is required to choose a cover image.');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (picked.canceled || !picked.assets[0]) {
      return;
    }
    const asset = picked.assets[0];
    const byteSize = await resolveLocalByteSize(asset.uri, asset.fileSize ?? 0);
    if (byteSize <= 0) {
      setCoverError('Could not read the selected image size.');
      return;
    }
    setCoverBusy(true);
    try {
      const contentType = asset.mimeType ?? mimeFromUri(asset.uri);
      const updated = await uploadTripCoverFromUri(id, asset.uri, contentType, byteSize);
      tripCache.setTrip(updated);
      tripCache.invalidateList();
      setCoverUrl(updated.coverImageUrl);
      setCoverLabel(updated.destination);
    } catch (error) {
      logAppError('trip cover upload', error);
      setCoverError(userFacingMessage(error, 'Could not update the trip cover.'));
    } finally {
      setCoverBusy(false);
    }
  }

  async function removeCover() {
    if (!id || coverBusy) {
      return;
    }
    setCoverError(null);
    setCoverBusy(true);
    try {
      const updated = await deleteTripCover(id);
      tripCache.setTrip(updated);
      tripCache.invalidateList();
      setCoverUrl(updated.coverImageUrl);
    } catch (error) {
      setCoverError(
        error instanceof ApiError ? error.message : 'Could not remove the trip cover.',
      );
    } finally {
      setCoverBusy(false);
    }
  }

  async function submit() {
    if (!id || savingRef.current) {
      return;
    }
    const nextErrors = validateTripForm(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      await updateTrip(id, {
        name: values.name.trim(),
        destination: values.destination.trim(),
        destinationPlace,
        startDate: values.startDate,
        endDate: values.endDate,
        description: values.description.trim(),
      });
      tripCache.invalidateTrip(id);
      tripCache.invalidateList();
      allowLeave.current = true;
      router.back();
    } catch (error) {
      setSaveError(
        error instanceof ApiError ? error.message : 'Could not save the trip. Try again.',
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  if (loading && !formReady) {
    return (
      <Screen edges={['left', 'right', 'bottom']}>
        <Skeleton height={64} />
        <Skeleton height={64} />
        <Skeleton height={64} />
      </Screen>
    );
  }

  if (forbidden) {
    return (
      <Screen edges={['left', 'right', 'bottom']}>
        <ErrorState
          title="Editing is unavailable"
          message="Only the trip creator can change this trip."
        />
      </Screen>
    );
  }

  if (loadError) {
    return (
      <Screen edges={['left', 'right', 'bottom']}>
        <ErrorState
          title={loadStatus === 404 ? 'Trip not found' : 'Could not load trip'}
          message={loadError}
          onRetry={loadStatus === 404 ? undefined : () => void refresh({ force: true })}
        />
      </Screen>
    );
  }

  return (
    <Screen
      edges={['left', 'right', 'bottom']}
      footer={
        <PrimaryButton
          label="Save changes"
          onPress={() => void submit()}
          loading={saving}
          disabled={saving}
        />
      }
    >
      <View style={styles.coverCard}>
        <Text style={styles.coverLabel}>Trip cover</Text>
        <EditableCover
          uri={coverUrl}
          label={coverLabel || values.destination}
          style={styles.cover}
          disabled={coverBusy || saving}
          onPress={() => void changeCover()}
        />
        <PhotoActionLinks
          busy={coverBusy}
          hasPhoto={Boolean(coverUrl)}
          changeLabel="Choose photo"
          removeLabel="Remove cover"
          onChange={() => void changeCover()}
          onRemove={() => void removeCover()}
        />
        {coverError ? <Text style={styles.coverError}>{coverError}</Text> : null}
      </View>
      <TripFormFields
        values={values}
        errors={errors}
        destinationPlace={destinationPlace}
        onChange={update}
        onDestinationPlaceChange={setDestinationPlace}
      />
      {saveError ? <ErrorState title="Could not save" message={saveError} /> : null}
      <ConfirmDialog
        visible={confirmLeave}
        title="Leave without saving?"
        message="The changes you entered will be discarded."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onCancel={() => setConfirmLeave(false)}
        onConfirm={() => {
          allowLeave.current = true;
          setConfirmLeave(false);
          router.back();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  coverCard: {
    gap: spacing.md,
  },
  coverLabel: {
    ...typography.label,
    color: colors.ink,
  },
  cover: {
    width: '100%',
    height: 160,
    borderRadius: radius.lg,
  },
  coverError: {
    ...typography.body,
    fontSize: 13,
    color: colors.danger,
  },
});
