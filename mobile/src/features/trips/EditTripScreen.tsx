import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ErrorState } from '@/components/ErrorState';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { Skeleton } from '@/components/Skeleton';
import { useAuth } from '@/features/auth/AuthProvider';
import { ApiError } from '@/lib/apiClient';
import { getTrip, updateTrip } from '@/services/tripService';
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
  const [initial, setInitial] = useState<TripFormValues>(emptyTripForm);
  const [values, setValues] = useState<TripFormValues>(emptyTripForm);
  const [errors, setErrors] = useState<TripFormErrors>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadStatus, setLoadStatus] = useState<number | undefined>(undefined);
  const [forbidden, setForbidden] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!id) {
        setLoadError('This trip link is missing an id.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setLoadError(null);
      setLoadStatus(undefined);
      setForbidden(false);
      try {
        const trip = await getTrip(id);
        if (!active) {
          return;
        }
        if (!user || !trip.creatorId || user.id !== trip.creatorId) {
          setForbidden(true);
          return;
        }
        const next = {
          name: trip.name,
          destination: trip.destination,
          startDate: trip.startDate,
          endDate: trip.endDate,
          description: trip.description ?? '',
        };
        setInitial(next);
        setValues(next);
      } catch (error) {
        if (!active) {
          return;
        }
        if (error instanceof ApiError) {
          setLoadError(error.message);
          setLoadStatus(error.status);
        } else {
          setLoadError('Could not load this trip. Try again.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [id, reloadKey, user]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (allowLeave.current || loading || forbidden || !isTripFormChanged(values, initial) || saving) {
        return;
      }
      event.preventDefault();
      setConfirmLeave(true);
    });
    return unsubscribe;
  }, [forbidden, initial, loading, navigation, saving, values]);

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
        startDate: values.startDate,
        endDate: values.endDate,
        description: values.description.trim(),
      });
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

  if (loading) {
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
          onRetry={loadStatus === 404 ? undefined : () => setReloadKey((current) => current + 1)}
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
      <TripFormFields values={values} errors={errors} onChange={update} />
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
