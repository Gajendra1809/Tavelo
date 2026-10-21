import { useFocusEffect, useNavigation } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BottomFormSheet } from '@/components/BottomFormSheet';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { DateField } from '@/components/DateField';
import { FormField } from '@/components/FormField';
import { LocationField } from '@/components/LocationField';
import { DirectionsLink } from '@/features/location/components/DirectionsLink';
import { canOpenMaps } from '@/features/location/placeDisplay';
import { resolvePlace } from '@/features/location/placeHelpers';
import { TimeField } from '@/components/TimeField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { Skeleton } from '@/components/Skeleton';
import { activityCache } from '@/lib/cache/activityCache';
import { ApiError } from '@/lib/apiClient';
import {
  enumerateDateRange,
  formatActivityTime,
  formatDayTab,
  isClockTime,
  normalizeOptionalTime,
  todayDateInput,
} from '@/lib/dates';
import {
  createActivity,
  deleteActivity,
  listActivities,
  updateActivity,
} from '@/services/itineraryService';
import type { ActivityFormValues, ItineraryActivity } from '@/types/itinerary';
import { colors, radius, spacing, surfaceCard, typography } from '@/theme';

type Props = {
  tripId: string;
  startDate: string;
  endDate: string;
};

const emptyForm = (date: string): ActivityFormValues => ({
  title: '',
  location: '',
  place: null,
  date,
  startTime: '',
  endTime: '',
  notes: '',
});

export function TripItinerarySection({ tripId, startDate, endDate }: Props) {
  const navigation = useNavigation();
  const days = useMemo(() => enumerateDateRange(startDate, endDate), [startDate, endDate]);
  const defaultDay = useMemo(() => {
    const today = todayDateInput();
    if (today >= startDate && today <= endDate) {
      return today;
    }
    return days[0] ?? startDate;
  }, [days, endDate, startDate]);

  const [selectedDay, setSelectedDay] = useState(defaultDay);
  const activeDay = days.includes(selectedDay) ? selectedDay : defaultDay;
  const [activities, setActivities] = useState<ItineraryActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [formValues, setFormValues] = useState<ActivityFormValues>(() => emptyForm(defaultDay));
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ActivityFormValues, string>>>(
    {},
  );
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ItineraryActivity | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ItineraryActivity | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadForDay = useCallback(
    async (day: string, options?: { force?: boolean }) => {
      const force = options?.force ?? false;
      const cached = activityCache.get(tripId, day);
      if (!force && activityCache.isFresh(tripId, day) && cached) {
        setActivities(cached);
        setLoading(false);
        setError(null);
        return;
      }
      if (!cached?.length) {
        setLoading(true);
      }
      setError(null);
      try {
        const result = await listActivities(tripId, day);
        activityCache.set(tripId, day, result.activities);
        setActivities(result.activities);
      } catch (loadError) {
        setActivities([]);
        setError(loadError instanceof ApiError ? loadError.message : 'Could not load the itinerary.');
      } finally {
        setLoading(false);
      }
    },
    [tripId],
  );

  useFocusEffect(
    useCallback(() => {
      void loadForDay(activeDay);
    }, [activeDay, loadForDay]),
  );

  function selectDay(day: string) {
    setSelectedDay(day);
    void loadForDay(day);
  }

  function closeForm() {
    setFormVisible(false);
    setEditing(null);
    setFormErrors({});
    setFormError(null);
  }

  function openCreate() {
    setEditing(null);
    setFormValues(emptyForm(activeDay));
    setFormErrors({});
    setFormError(null);
    setFormVisible(true);
  }

  function openEdit(activity: ItineraryActivity) {
    setEditing(activity);
    setFormValues({
      title: activity.title,
      location: activity.location ?? '',
      place: activity.place ?? null,
      date: activity.date,
      startTime: activity.startTime ?? '',
      endTime: activity.endTime ?? '',
      notes: activity.notes ?? '',
    });
    setFormErrors({});
    setFormError(null);
    setFormVisible(true);
  }

  useEffect(() => {
    if (!formVisible) {
      return;
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      closeForm();
      return true;
    });
    return () => subscription.remove();
  }, [formVisible]);

  useEffect(() => {
    if (!formVisible) {
      return;
    }
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      event.preventDefault();
      closeForm();
    });
    return unsubscribe;
  }, [formVisible, navigation]);

  function validateForm(values: ActivityFormValues): Partial<Record<keyof ActivityFormValues, string>> {
    const next: Partial<Record<keyof ActivityFormValues, string>> = {};
    if (!values.title.trim()) {
      next.title = 'Enter a title.';
    }
    if (!values.date) {
      next.date = 'Choose a date.';
    } else if (values.date < startDate || values.date > endDate) {
      next.date = 'Date must fall within the trip.';
    }
    const start = normalizeOptionalTime(values.startTime);
    const end = normalizeOptionalTime(values.endTime);
    if (start && !isClockTime(start)) {
      next.startTime = 'Choose a valid start time.';
    }
    if (end && !isClockTime(end)) {
      next.endTime = 'Choose a valid end time.';
    }
    if (start && end && end < start) {
      next.endTime = 'End time must be on or after the start time.';
    }
    return next;
  }

  async function submitForm() {
    const nextErrors = validateForm(formValues);
    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSaving(true);
    setFormError(null);
    const payload = {
      title: formValues.title.trim(),
      location: formValues.location.trim() ? formValues.location.trim() : null,
      place: formValues.place,
      date: formValues.date,
      startTime: normalizeOptionalTime(formValues.startTime),
      endTime: normalizeOptionalTime(formValues.endTime),
      notes: formValues.notes.trim(),
    };

    try {
      if (editing) {
        await updateActivity(tripId, editing.id, payload);
      } else {
        await createActivity(tripId, payload);
      }
      closeForm();
      activityCache.invalidateDay(tripId, payload.date);
      if (payload.date !== activeDay) {
        activityCache.invalidateDay(tripId, activeDay);
        setSelectedDay(payload.date);
        await loadForDay(payload.date, { force: true });
      } else {
        await loadForDay(activeDay, { force: true });
      }
    } catch (saveError) {
      setFormError(
        saveError instanceof ApiError ? saveError.message : 'Could not save this activity.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) {
      return;
    }
    setDeleting(true);
    try {
      await deleteActivity(tripId, deleteTarget.id);
      setDeleteTarget(null);
      activityCache.invalidateDay(tripId, activeDay);
      await loadForDay(activeDay, { force: true });
    } catch (deleteError) {
      setError(
        deleteError instanceof ApiError ? deleteError.message : 'Could not delete this activity.',
      );
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>Itinerary</Text>
        <SecondaryButton label="Add activity" onPress={openCreate} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
        {days.map((day) => {
          const active = day === activeDay;
          return (
            <Pressable
              key={day}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => selectDay(day)}
              style={[styles.dayChip, active ? styles.dayChipActive : null]}
            >
              <Text style={[styles.dayChipLabel, active ? styles.dayChipLabelActive : null]}>
                {formatDayTab(day)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {loading ? <Skeleton height={96} /> : null}
      {!loading && error ? <ErrorState message={error} onRetry={() => void loadForDay(activeDay)} /> : null}
      {!loading && !error && activities.length === 0 ? (
        <EmptyState
          title="Nothing planned"
          message="Add an activity for this day. Times are optional for flexible plans."
          illustration="travel"
        />
      ) : null}
      {!loading && !error
        ? activities.map((activity) => {
            const mapsPlace = resolvePlace(activity.place, activity.location);
            return (
            <View key={activity.id} style={styles.activityRow}>
              <View style={styles.rail} />
              <View style={styles.activityCopy}>
                <Text style={styles.activityTime}>{formatActivityTime(activity.startTime, activity.endTime)}</Text>
                <Text style={styles.activityTitle}>{activity.title}</Text>
                {activity.location ? (
                  <Text style={styles.activityMeta}>{activity.location}</Text>
                ) : null}
                {mapsPlace && canOpenMaps(mapsPlace) ? (
                  <DirectionsLink place={mapsPlace} />
                ) : null}
                {activity.notes ? <Text style={styles.activityNotes}>{activity.notes}</Text> : null}
                <View style={styles.activityActions}>
                  <Pressable accessibilityRole="button" onPress={() => openEdit(activity)} style={styles.textAction}>
                    <Text style={styles.editLabel}>Edit</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setDeleteTarget(activity)}
                    style={styles.textAction}
                  >
                    <Text style={styles.deleteLabel}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          );
          })
        : null}

      <BottomFormSheet
        visible={formVisible}
        onClose={closeForm}
        title={editing ? 'Edit activity' : 'Add activity'}
      >
                <FormField
                  label="Title"
                  value={formValues.title}
                  onChangeText={(value) => {
                    setFormValues((current) => ({ ...current, title: value }));
                    setFormErrors((current) => ({ ...current, title: undefined }));
                  }}
                  error={formErrors.title}
                  placeholder="Fort walk"
                />
                <LocationField
                  label="Location"
                  place={formValues.place}
                  onPlaceChange={(place) =>
                    setFormValues((current) => ({
                      ...current,
                      place,
                      location: place?.name ?? '',
                    }))
                  }
                  placeholder="Search or enter a place"
                />
                <DateField
                  label="Date"
                  value={formValues.date}
                  onChange={(value) => {
                    setFormValues((current) => ({ ...current, date: value }));
                    setFormErrors((current) => ({ ...current, date: undefined }));
                  }}
                  error={formErrors.date}
                  minimumDate={startDate}
                  maximumDate={endDate}
                />
                <TimeField
                  label="Start time"
                  value={formValues.startTime}
                  onChange={(value) => {
                    setFormValues((current) => ({ ...current, startTime: value }));
                    setFormErrors((current) => ({ ...current, startTime: undefined, endTime: undefined }));
                  }}
                  error={formErrors.startTime}
                  placeholder="Optional"
                  allowClear
                />
                <TimeField
                  label="End time"
                  value={formValues.endTime}
                  onChange={(value) => {
                    setFormValues((current) => ({ ...current, endTime: value }));
                    setFormErrors((current) => ({ ...current, endTime: undefined }));
                  }}
                  error={formErrors.endTime}
                  placeholder="Optional"
                  allowClear
                />
                <FormField
                  label="Notes"
                  value={formValues.notes}
                  onChangeText={(value) => setFormValues((current) => ({ ...current, notes: value }))}
                  placeholder="Optional details"
                  multiline
                />
                {formError ? <ErrorState title="Could not save" message={formError} /> : null}
                <View style={styles.modalActions}>
                  <SecondaryButton label="Cancel" onPress={closeForm} disabled={saving} />
                  <PrimaryButton
                    label={editing ? 'Save changes' : 'Add activity'}
                    onPress={() => void submitForm()}
                    loading={saving}
                    disabled={saving}
                  />
                </View>
      </BottomFormSheet>

      <ConfirmDialog
        visible={deleteTarget !== null}
        title="Delete this activity?"
        message="It will be removed from the shared itinerary."
        confirmLabel="Delete"
        cancelLabel="Keep"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...surfaceCard,
    padding: spacing.xl,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.ink,
  },
  dayRow: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  dayChip: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  dayChipActive: {
    backgroundColor: colors.seafoam,
    borderColor: colors.primary,
  },
  dayChipLabel: {
    ...typography.body,
    fontSize: 13,
    color: colors.muted,
  },
  dayChipLabelActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  activityRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  rail: {
    width: 3,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    opacity: 0.35,
    alignSelf: 'stretch',
  },
  activityCopy: {
    flex: 1,
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  activityTime: {
    ...typography.label,
    color: colors.primary,
  },
  activityTitle: {
    ...typography.cardTitle,
    color: colors.ink,
  },
  activityMeta: {
    ...typography.body,
    color: colors.muted,
  },
  activityNotes: {
    ...typography.body,
    color: colors.ink,
  },
  activityActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  textAction: {
    minHeight: 36,
    justifyContent: 'center',
  },
  editLabel: {
    ...typography.label,
    color: colors.primary,
  },
  deleteLabel: {
    ...typography.label,
    color: colors.danger,
  },
  modalActions: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
});
