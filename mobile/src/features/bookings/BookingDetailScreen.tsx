import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ErrorState } from '@/components/ErrorState';
import { Screen } from '@/components/Screen';
import { SecondaryButton } from '@/components/SecondaryButton';
import { Skeleton } from '@/components/Skeleton';
import { UserAvatar } from '@/components/UserAvatar';
import { useAuth } from '@/features/auth/AuthProvider';
import { categoryLabel } from '@/features/bookings/bookingLabels';
import { useTripFromCache } from '@/hooks/useTripFromCache';
import { formatDisplayDate, formatDateRange } from '@/lib/dates';
import { ApiError } from '@/lib/apiClient';
import { logAppError, userFacingMessage } from '@/lib/errorReport';
import { promptBookingAttachmentSource } from '@/features/bookings/promptBookingAttachmentSource';
import {
  deleteBookingAttachment,
  deleteTripBooking,
  getTripBooking,
  pickBookingFileFromDocuments,
  pickBookingImageFromLibrary,
  uploadBookingAttachment,
} from '@/services/bookingService';
import type { TripBooking } from '@/types/booking';
import { LocationInlineSummary } from '@/features/location/components/LocationInlineSummary';
import { resolvePlace } from '@/features/location/placeHelpers';
import { colors, spacing, surfaceCard, typography } from '@/theme';

type Props = {
  tripId: string;
  bookingId: string;
};

export function BookingDetailScreen({ tripId, bookingId }: Props) {
  const { user } = useAuth();
  const { trip } = useTripFromCache(tripId);
  const [booking, setBooking] = useState<TripBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionErrorDetails, setActionErrorDetails] = useState<string | undefined>();

  const canManage = useMemo(() => {
    if (!booking || !user || !trip) {
      return false;
    }
    return booking.createdBy.id === user.id || trip.creatorId === user.id;
  }, [booking, trip, user]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setBooking(await getTripBooking(tripId, bookingId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load this booking.');
    } finally {
      setLoading(false);
    }
  }, [bookingId, tripId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function attachDocument() {
    if (uploadBusy || !booking) {
      return;
    }
    try {
      const source = await promptBookingAttachmentSource();
      if (!source) {
        return;
      }
      const picked =
        source === 'gallery'
          ? await pickBookingImageFromLibrary()
          : await pickBookingFileFromDocuments();
      if (!picked) {
        return;
      }
      setUploadBusy(true);
      setActionError(null);
      setActionErrorDetails(undefined);
      const updated = await uploadBookingAttachment({
        tripId,
        bookingId: booking.id,
        uri: picked.uri,
        contentType: picked.mimeType,
        byteSize: picked.size,
        originalFilename: picked.name,
      });
      setBooking(updated);
    } catch (err) {
      setActionError(userFacingMessage(err, 'Could not upload the file.'));
      setActionErrorDetails(logAppError('booking attachment upload', err));
    } finally {
      setUploadBusy(false);
    }
  }

  async function removeAttachment(attachmentId: string) {
    if (!booking) {
      return;
    }
    try {
      setBooking(await deleteBookingAttachment(tripId, booking.id, attachmentId));
    } catch (err) {
      setActionError(userFacingMessage(err, 'Could not remove the file.'));
      setActionErrorDetails(logAppError('booking attachment delete', err));
    }
  }

  async function confirmRemoval() {
    setConfirmDelete(false);
    try {
      await deleteTripBooking(tripId, bookingId);
      router.back();
    } catch (err) {
      setActionError(userFacingMessage(err, 'Could not delete this booking.'));
      setActionErrorDetails(logAppError('booking delete', err));
    }
  }

  if (loading && !booking) {
    return (
      <Screen>
        <Skeleton height={48} />
        <Skeleton height={160} />
      </Screen>
    );
  }

  if (error || !booking) {
    return (
      <Screen>
        <ErrorState message={error ?? 'Booking not found.'} onRetry={() => void load()} />
      </Screen>
    );
  }

  const dates =
    booking.endDate && booking.endDate !== booking.startDate
      ? formatDateRange(booking.startDate, booking.endDate)
      : formatDisplayDate(booking.startDate);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>{booking.title}</Text>
          <Text style={styles.meta}>{categoryLabel[booking.category]}</Text>
          {booking.provider ? <Text style={styles.meta}>{booking.provider}</Text> : null}
          <Text style={styles.meta}>{dates}</Text>
          {booking.route ? <Text style={styles.meta}>{booking.route}</Text> : null}
          {booking.location || booking.place ? (
            <LocationInlineSummary
              place={resolvePlace(booking.place, booking.location)}
            />
          ) : null}
          {booking.bookingReference ? (
            <Text style={styles.ref}>Ref: {booking.bookingReference}</Text>
          ) : null}
          {booking.notes ? <Text style={styles.notes}>{booking.notes}</Text> : null}
          <View style={styles.creatorRow}>
            <UserAvatar
              name={booking.createdBy.name}
              uri={booking.createdBy.avatarUrl}
              cacheKey={`avatar:${booking.createdBy.id}`}
              size="sm"
            />
            <Text style={styles.meta}>Added by {booking.createdBy.name}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>Documents</Text>
          <SecondaryButton
            label={uploadBusy ? 'Uploading…' : 'Attach file'}
            disabled={uploadBusy}
            onPress={() => void attachDocument()}
          />
          {booking.attachments.length === 0 ? (
            <Text style={styles.meta}>No confirmations attached yet.</Text>
          ) : null}
          {booking.attachments.map((file) => (
            <View key={file.id} style={styles.fileRow}>
              {file.isImage && file.fileUrl ? (
                <Image source={{ uri: file.fileUrl }} style={styles.thumb} accessibilityIgnoresInvertColors />
              ) : (
                <View style={styles.pdfThumb}>
                  <Text style={styles.pdfLabel}>PDF</Text>
                </View>
              )}
              <View style={styles.fileCopy}>
                <Text style={styles.fileName}>{file.originalFilename || file.label || 'Document'}</Text>
                <Pressable
                  onPress={() => {
                    if (file.fileUrl) {
                      void Linking.openURL(file.fileUrl);
                    }
                  }}
                >
                  <Text style={styles.link}>Open / download</Text>
                </Pressable>
              </View>
              {canManage ? (
                <Pressable onPress={() => void removeAttachment(file.id)}>
                  <Text style={styles.remove}>Remove</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>

        {canManage ? (
          <View style={styles.actions}>
            <SecondaryButton
              label="Edit booking"
              onPress={() => router.push(`/trip/${tripId}/bookings/${bookingId}/edit` as Href)}
            />
            <Pressable onPress={() => setConfirmDelete(true)}>
              <Text style={styles.delete}>Delete booking</Text>
            </Pressable>
          </View>
        ) : null}
        {actionError ? (
          <ErrorState message={actionError} details={actionErrorDetails} title="Could not complete action" />
        ) : null}
      </ScrollView>
      <ConfirmDialog
        visible={confirmDelete}
        title="Delete this booking?"
        message="This removes the booking and its files for everyone on the trip."
        confirmLabel="Delete"
        cancelLabel="Keep"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void confirmRemoval()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, gap: spacing.md },
  card: { ...surfaceCard, padding: spacing.xl, gap: spacing.sm },
  title: { ...typography.title, fontSize: 22, color: colors.ink },
  meta: { ...typography.body, color: colors.muted },
  ref: { ...typography.label, color: colors.ink },
  notes: { ...typography.body, color: colors.ink },
  creatorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  section: { ...typography.cardTitle, color: colors.ink },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  thumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: colors.line },
  pdfThumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfLabel: { ...typography.label, color: colors.muted },
  fileCopy: { flex: 1, gap: 4 },
  fileName: { ...typography.body, color: colors.ink },
  link: { ...typography.label, color: colors.primary },
  remove: { ...typography.label, color: colors.danger },
  actions: { gap: spacing.md },
  delete: { ...typography.label, color: colors.danger, textAlign: 'center' },
});
