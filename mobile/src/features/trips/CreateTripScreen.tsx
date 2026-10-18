import { router, useNavigation, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ErrorState } from '@/components/ErrorState';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { tripCache } from '@/lib/cache/tripCache';
import { ApiError } from '@/lib/apiClient';
import { createTrip } from '@/services/tripService';
import {
  emptyTripForm,
  isTripFormDirty,
  validateTripForm,
  type TripFormErrors,
  type TripFormValues,
} from './validateTripForm';
import type { TaveloPlace } from '@/types/place';
import { TripFormFields } from './TripFormFields';

export function CreateTripScreen() {
  const navigation = useNavigation();
  const allowLeave = useRef(false);
  const savingRef = useRef(false);
  const [values, setValues] = useState<TripFormValues>(emptyTripForm);
  const [destinationPlace, setDestinationPlace] = useState<TaveloPlace | null>(null);
  const [errors, setErrors] = useState<TripFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (allowLeave.current || !isTripFormDirty(values) || saving) {
        return;
      }
      event.preventDefault();
      setConfirmLeave(true);
    });
    return unsubscribe;
  }, [navigation, saving, values]);

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

  async function submit() {
    if (savingRef.current) {
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
      const trip = await createTrip({
        name: values.name.trim(),
        destination: values.destination.trim(),
        destinationPlace,
        startDate: values.startDate,
        endDate: values.endDate,
        description: values.description.trim(),
      });
      tripCache.setTrip(trip);
      tripCache.invalidateList();
      allowLeave.current = true;
      router.replace(`/trip/${trip.id}` as Href);
    } catch (error) {
      setSaveError(
        error instanceof ApiError ? error.message : 'Could not save the trip. Try again.',
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <Screen
      edges={['left', 'right', 'bottom']}
      footer={
        <PrimaryButton
          label="Save trip"
          onPress={() => void submit()}
          loading={saving}
          disabled={saving}
        />
      }
    >
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
        message="The trip details you entered will be discarded."
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
