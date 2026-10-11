import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DateField } from '@/components/DateField';
import { FormField } from '@/components/FormField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { SecondaryButton } from '@/components/SecondaryButton';
import { ErrorState } from '@/components/ErrorState';
import { categoryLabel } from '@/features/bookings/bookingLabels';
import { useTripFromCache } from '@/hooks/useTripFromCache';
import { ApiError } from '@/lib/apiClient';
import { logAppError, userFacingMessage } from '@/lib/errorReport';
import { todayDateInput } from '@/lib/dates';
import { promptBookingAttachmentSource } from '@/features/bookings/promptBookingAttachmentSource';
import {
  createTripBooking,
  getTripBooking,
  pickBookingFileFromDocuments,
  pickBookingImageFromLibrary,
  updateTripBooking,
  uploadBookingAttachment,
} from '@/services/bookingService';
import { BOOKING_CATEGORIES, type BookingCategory } from '@/types/booking';
import { colors, spacing, typography } from '@/theme';

type Props = {
  tripId: string;
  bookingId?: string;
};

export function BookingFormScreen({ tripId, bookingId }: Props) {
  const isEdit = Boolean(bookingId);
  const { trip } = useTripFromCache(tripId);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<BookingCategory>('hotel');
  const [provider, setProvider] = useState('');
  const [startDate, setStartDate] = useState(trip?.startDate ?? todayDateInput());
  const [endDate, setEndDate] = useState('');
  const [location, setLocation] = useState('');
  const [route, setRoute] = useState('');
  const [bookingReference, setBookingReference] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | undefined>();
  const [pendingFiles, setPendingFiles] = useState<
    { uri: string; mimeType: string; size: number; name: string }[]
  >([]);

  useEffect(() => {
    if (!bookingId) {
      if (trip?.startDate) {
        setStartDate(trip.startDate);
      }
      return;
    }
    void (async () => {
      try {
        const booking = await getTripBooking(tripId, bookingId);
        setTitle(booking.title);
        setCategory(booking.category);
        setProvider(booking.provider);
        setStartDate(booking.startDate);
        setEndDate(booking.endDate ?? '');
        setLocation(booking.location);
        setRoute(booking.route);
        setBookingReference(booking.bookingReference);
        setNotes(booking.notes);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not load the booking.');
      } finally {
        setLoading(false);
      }
    })();
  }, [bookingId, trip?.startDate, tripId]);

  const showRoute = category === 'train' || category === 'flight' || category === 'bus' || category === 'cab';
  const showLocation = category === 'hotel' || category === 'activity' || category === 'other';

  async function pickFile() {
    try {
      const source = await promptBookingAttachmentSource();
      if (!source) {
        return;
      }
      const picked =
        source === 'gallery'
          ? await pickBookingImageFromLibrary()
          : await pickBookingFileFromDocuments();
      if (picked) {
        setPendingFiles((current) => [...current, picked]);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not pick a file.');
    }
  }

  async function submit() {
    if (!title.trim()) {
      setError('Enter a booking title.');
      return;
    }
    setSaving(true);
    setError(null);
    setErrorDetails(undefined);
    try {
      const body = {
        title: title.trim(),
        category,
        provider: provider.trim(),
        startDate,
        endDate: endDate.trim() || undefined,
        location: showLocation ? location.trim() : '',
        route: showRoute ? route.trim() : '',
        bookingReference: bookingReference.trim(),
        notes: notes.trim(),
      };
      const saved = isEdit && bookingId
        ? await updateTripBooking(tripId, bookingId, body)
        : await createTripBooking(tripId, body);

      for (const file of pendingFiles) {
        await uploadBookingAttachment({
          tripId,
          bookingId: saved.id,
          uri: file.uri,
          contentType: file.mimeType,
          byteSize: file.size,
          originalFilename: file.name,
        });
      }
      router.replace(`/trip/${tripId}/bookings/${saved.id}` as import('expo-router').Href);
    } catch (err) {
      setError(userFacingMessage(err, 'Could not save the booking.'));
      setErrorDetails(logAppError('booking create/save with attachments', err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Screen>
        <Text style={styles.loading}>Loading…</Text>
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <PrimaryButton
          label={saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create booking'}
          loading={saving}
          disabled={saving}
          onPress={() => void submit()}
        />
      }
    >
      <View style={styles.form}>
        <FormField label="Title" value={title} onChangeText={setTitle} placeholder="Rajanvansh Hotel" />
        <Text style={styles.label}>Category</Text>
        <View style={styles.categoryRow}>
          {BOOKING_CATEGORIES.map((value) => (
            <SecondaryButton
              key={value}
              label={categoryLabel[value]}
              onPress={() => setCategory(value)}
              style={category === value ? styles.categoryActive : undefined}
            />
          ))}
        </View>
        <FormField label="Provider" value={provider} onChangeText={setProvider} placeholder="Airline, hotel, IRCTC…" />
        <DateField
          label="Start date"
          value={startDate}
          onChange={setStartDate}
          minimumDate={trip?.startDate}
          maximumDate={trip?.endDate}
        />
        <DateField
          label="End date (optional)"
          value={endDate}
          onChange={setEndDate}
          minimumDate={startDate || trip?.startDate}
          maximumDate={trip?.endDate}
          placeholder="Same day or checkout"
          allowClear
        />
        {showLocation ? (
          <FormField label="Location" value={location} onChangeText={setLocation} placeholder="City or address" />
        ) : null}
        {showRoute ? (
          <FormField label="Route" value={route} onChangeText={setRoute} placeholder="Bhopal → Indore" />
        ) : null}
        <FormField
          label="Booking reference"
          value={bookingReference}
          onChangeText={setBookingReference}
          placeholder="PNR, confirmation #"
        />
        <FormField label="Notes" value={notes} onChangeText={setNotes} multiline placeholder="Optional details" />
        <SecondaryButton label="Add document (PDF or image)" onPress={() => void pickFile()} />
        {pendingFiles.map((file) => (
          <Text key={file.uri} style={styles.pendingFile}>
            {file.name} ({Math.round(file.size / 1024)} KB)
          </Text>
        ))}
        {error ? <ErrorState message={error} details={errorDetails} title="Could not save booking" /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  label: { ...typography.label, color: colors.ink },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  categoryActive: { borderColor: colors.primary },
  pendingFile: { ...typography.body, fontSize: 13, color: colors.muted },
  loading: { ...typography.body, color: colors.muted, padding: spacing.xl },
});
