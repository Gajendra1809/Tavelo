import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { BottomFormSheet } from '@/components/BottomFormSheet';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { FormField } from '@/components/FormField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { Skeleton } from '@/components/Skeleton';
import { packingCache } from '@/lib/cache/packingCache';
import { ApiError } from '@/lib/apiClient';
import {
  createGroupPacking,
  createPersonalPacking,
  deleteGroupPacking,
  deletePersonalPacking,
  listGroupPacking,
  listPersonalPacking,
  updateGroupPacking,
  updatePersonalPacking,
} from '@/services/packingService';
import type { GroupPackingItem, PackingList, PersonalPackingItem } from '@/types/packing';
import { packingListFromItems, packingProgressLabel } from '@/types/packing';
import type { TripMember } from '@/types/trip';
import { colors, radius, spacing, surfaceCard, typography } from '@/theme';

type Props = {
  tripId: string;
  members: TripMember[];
};

type GroupForm = { name: string; ownerId: string | null };
type SheetState =
  | { kind: 'group'; item: GroupPackingItem | null }
  | { kind: 'personal'; item: PersonalPackingItem | null }
  | null;

const emptyGroupForm: GroupForm = { name: '', ownerId: null };

export function TripPackingSection({ tripId, members }: Props) {
  const requestSeq = useRef(0);
  const savingRef = useRef(false);
  const busyRef = useRef(new Set<string>());
  const [group, setGroup] = useState<PackingList<GroupPackingItem> | null>(
    () => packingCache.getGroup(tripId),
  );
  const [personal, setPersonal] = useState<PackingList<PersonalPackingItem> | null>(
    () => packingCache.getPersonal(tripId),
  );
  const [loading, setLoading] = useState(!group || !personal);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [groupForm, setGroupForm] = useState<GroupForm>(emptyGroupForm);
  const [personalName, setPersonalName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<
    { kind: 'group'; item: GroupPackingItem } | { kind: 'personal'; item: PersonalPackingItem } | null
  >(null);

  const load = useCallback(async (force: boolean) => {
    const seq = ++requestSeq.current;
    const cachedGroup = packingCache.getGroup(tripId);
    const cachedPersonal = packingCache.getPersonal(tripId);
    if (cachedGroup) {
      setGroup(cachedGroup);
    }
    if (cachedPersonal) {
      setPersonal(cachedPersonal);
    }
    if (!cachedGroup || !cachedPersonal) {
      setLoading(true);
    } else {
      setLoading(false);
    }
    if (force || !cachedGroup || !cachedPersonal) {
      setError(null);
    }
    try {
      const [nextGroup, nextPersonal] = await Promise.all([
        listGroupPacking(tripId),
        listPersonalPacking(tripId),
      ]);
      if (seq !== requestSeq.current) {
        return;
      }
      packingCache.setGroup(tripId, nextGroup);
      packingCache.setPersonal(tripId, nextPersonal);
      setGroup(nextGroup);
      setPersonal(nextPersonal);
      setError(null);
    } catch (loadError) {
      if (seq !== requestSeq.current) {
        return;
      }
      setError(loadError instanceof ApiError ? loadError.message : 'Could not load packing lists.');
    } finally {
      if (seq === requestSeq.current) {
        setLoading(false);
      }
    }
  }, [tripId]);

  useFocusEffect(
    useCallback(() => {
      void load(false);
    }, [load]),
  );

  function openGroupSheet(item: GroupPackingItem | null) {
    setFormError(null);
    setGroupForm(item ? { name: item.name, ownerId: item.owner?.id ?? null } : emptyGroupForm);
    setSheet({ kind: 'group', item });
  }

  function openPersonalSheet(item: PersonalPackingItem | null) {
    setFormError(null);
    setPersonalName(item?.name ?? '');
    setSheet({ kind: 'personal', item });
  }

  function closeSheet() {
    if (savingRef.current) {
      return;
    }
    setSheet(null);
    setFormError(null);
  }

  async function submitSheet() {
    if (savingRef.current || !sheet) {
      return;
    }
    if (sheet.kind === 'group') {
      const name = groupForm.name.trim();
      if (!name) {
        setFormError('Enter an item name.');
        return;
      }
      savingRef.current = true;
      setSaving(true);
      setFormError(null);
      try {
        if (sheet.item) {
          const updated = await updateGroupPacking(tripId, sheet.item.id, {
            name,
            ownerId: groupForm.ownerId,
          });
          applyGroupItem(updated);
        } else {
          const created = await createGroupPacking(tripId, {
            name,
            ownerId: groupForm.ownerId,
          });
          applyGroupItem(created);
        }
        setSheet(null);
      } catch (saveError) {
        setFormError(saveError instanceof ApiError ? saveError.message : 'Could not save this item.');
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
      return;
    }

    const name = personalName.trim();
    if (!name) {
      setFormError('Enter an item name.');
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setFormError(null);
    try {
      if (sheet.item) {
        const updated = await updatePersonalPacking(tripId, sheet.item.id, { name });
        applyPersonalItem(updated);
      } else {
        const created = await createPersonalPacking(tripId, { name });
        applyPersonalItem(created);
      }
      setSheet(null);
    } catch (saveError) {
      setFormError(saveError instanceof ApiError ? saveError.message : 'Could not save this item.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function noteLocalWrite() {
    requestSeq.current += 1;
  }

  function applyGroupItem(item: GroupPackingItem) {
    noteLocalWrite();
    setGroup((current) => {
      const items = current?.items ?? [];
      const exists = items.some((row) => row.id === item.id);
      const nextItems = exists
        ? items.map((row) => (row.id === item.id ? item : row))
        : [...items, item];
      const next = packingListFromItems(nextItems);
      packingCache.setGroup(tripId, next);
      return next;
    });
  }

  function applyPersonalItem(item: PersonalPackingItem) {
    noteLocalWrite();
    setPersonal((current) => {
      const items = current?.items ?? [];
      const exists = items.some((row) => row.id === item.id);
      const nextItems = exists
        ? items.map((row) => (row.id === item.id ? item : row))
        : [...items, item];
      const next = packingListFromItems(nextItems);
      packingCache.setPersonal(tripId, next);
      return next;
    });
  }

  function removeGroupItem(itemId: string) {
    noteLocalWrite();
    setGroup((current) => {
      const next = packingListFromItems((current?.items ?? []).filter((row) => row.id !== itemId));
      packingCache.setGroup(tripId, next);
      return next;
    });
  }

  function removePersonalItem(itemId: string) {
    noteLocalWrite();
    setPersonal((current) => {
      const next = packingListFromItems((current?.items ?? []).filter((row) => row.id !== itemId));
      packingCache.setPersonal(tripId, next);
      return next;
    });
  }

  async function toggleGroup(item: GroupPackingItem) {
    if (busyRef.current.has(item.id)) {
      return;
    }
    busyRef.current.add(item.id);
    setBusyIds(new Set(busyRef.current));
    try {
      const updated = await updateGroupPacking(tripId, item.id, { packed: !item.packed });
      applyGroupItem(updated);
    } catch {
      setError('Could not update that item. Try again.');
    } finally {
      busyRef.current.delete(item.id);
      setBusyIds(new Set(busyRef.current));
    }
  }

  async function togglePersonal(item: PersonalPackingItem) {
    if (busyRef.current.has(item.id)) {
      return;
    }
    busyRef.current.add(item.id);
    setBusyIds(new Set(busyRef.current));
    try {
      const updated = await updatePersonalPacking(tripId, item.id, { packed: !item.packed });
      applyPersonalItem(updated);
    } catch {
      setError('Could not update that item. Try again.');
    } finally {
      busyRef.current.delete(item.id);
      setBusyIds(new Set(busyRef.current));
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) {
      return;
    }
    const target = deleteTarget;
    setDeleteTarget(null);
    try {
      if (target.kind === 'group') {
        await deleteGroupPacking(tripId, target.item.id);
        removeGroupItem(target.item.id);
      } else {
        await deletePersonalPacking(tripId, target.item.id);
        removePersonalItem(target.item.id);
      }
    } catch (deleteError) {
      setError(
        deleteError instanceof ApiError ? deleteError.message : 'Could not delete that item.',
      );
    }
  }

  const groupItems = group?.items ?? [];
  const personalItems = personal?.items ?? [];
  const groupPacked = group?.packedCount ?? 0;
  const groupTotal = group?.total ?? 0;
  const personalPacked = personal?.packedCount ?? 0;
  const personalTotal = personal?.total ?? 0;
  const hasLists = group !== null && personal !== null;

  return (
    <View style={styles.stack}>
      <View style={styles.intro}>
        <Text style={styles.title}>Packing</Text>
        <Text style={styles.subtitle}>Make sure nothing gets left behind</Text>
        <Text style={styles.heroProgress}>{packingProgressLabel(groupPacked, groupTotal)}</Text>
      </View>

      {loading && !hasLists ? <Skeleton height={120} /> : null}
      {!loading && error ? <ErrorState message={error} onRetry={() => void load(true)} /> : null}

      {!loading && hasLists ? (
        <>
          <View style={styles.card}>
            <View style={styles.sectionHead}>
              <View style={styles.sectionCopy}>
                <Text style={styles.sectionLabel}>Group packing</Text>
                <Text style={styles.progress}>{packingProgressLabel(groupPacked, groupTotal)}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add group item"
                onPress={() => openGroupSheet(null)}
                style={styles.addHit}
              >
                <Text style={styles.addLabel}>Add</Text>
              </Pressable>
            </View>
            {groupItems.length === 0 ? (
              <EmptyState
                title="Nothing to pack together yet"
                message="Add the essentials everyone needs to share."
              />
            ) : (
              groupItems.map((item) => (
                <View key={item.id} style={styles.row}>
                  <PackingCheck
                    packed={item.packed}
                    busy={busyIds.has(item.id)}
                    label={item.name}
                    onPress={() => void toggleGroup(item)}
                  />
                  <View style={styles.rowCopy}>
                    <Text style={[styles.itemName, item.packed ? styles.itemPacked : null]}>
                      {item.name}
                    </Text>
                    <Text style={styles.owner}>{item.owner ? item.owner.name : 'Unassigned'}</Text>
                    <View style={styles.rowActions}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Edit ${item.name}`}
                        onPress={() => openGroupSheet(item)}
                      >
                        <Text style={styles.editLabel}>Edit</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Delete ${item.name}`}
                        onPress={() => setDeleteTarget({ kind: 'group', item })}
                      >
                        <Text style={styles.deleteLabel}>Delete</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHead}>
              <View style={styles.sectionCopy}>
                <View style={styles.privateRow}>
                  <SymbolView
                    name={{ android: 'lock', web: 'lock' }}
                    size={16}
                    tintColor={colors.muted}
                  />
                  <Text style={styles.sectionLabel}>My packing</Text>
                </View>
                <Text style={styles.privateHint}>Only visible to you</Text>
                <Text style={styles.progress}>
                  {packingProgressLabel(personalPacked, personalTotal)}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add personal item"
                onPress={() => openPersonalSheet(null)}
                style={styles.addHit}
              >
                <Text style={styles.addLabel}>Add</Text>
              </Pressable>
            </View>
            {personalItems.length === 0 ? (
              <EmptyState
                title="Your personal packing list starts here"
                message="Add the things you don't want to forget."
              />
            ) : (
              personalItems.map((item) => (
                <View key={item.id} style={styles.row}>
                  <PackingCheck
                    packed={item.packed}
                    busy={busyIds.has(item.id)}
                    label={item.name}
                    onPress={() => void togglePersonal(item)}
                  />
                  <View style={styles.rowCopy}>
                    <Text style={[styles.itemName, item.packed ? styles.itemPacked : null]}>
                      {item.name}
                    </Text>
                    <View style={styles.rowActions}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Edit ${item.name}`}
                        onPress={() => openPersonalSheet(item)}
                      >
                        <Text style={styles.editLabel}>Edit</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Delete ${item.name}`}
                        onPress={() => setDeleteTarget({ kind: 'personal', item })}
                      >
                        <Text style={styles.deleteLabel}>Delete</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        </>
      ) : null}

      <BottomFormSheet
        visible={sheet !== null}
        onClose={closeSheet}
        keyboardScrollToEnd={sheet?.kind === 'group'}
        title={
          sheet?.kind === 'personal'
            ? sheet.item
              ? 'Edit personal item'
              : 'Add personal item'
            : sheet?.item
              ? 'Edit group item'
              : 'Add group item'
        }
      >
        {sheet?.kind === 'group' ? (
          <>
            <FormField
              label="Item name"
              value={groupForm.name}
              onChangeText={(value) => setGroupForm((current) => ({ ...current, name: value }))}
              placeholder="Universal adapter"
              maxLength={120}
            />
            <Text style={styles.ownerLabel}>Brought by (optional)</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: groupForm.ownerId === null }}
              onPress={() => setGroupForm((current) => ({ ...current, ownerId: null }))}
              style={[
                styles.memberChip,
                groupForm.ownerId === null ? styles.memberChipActive : null,
              ]}
            >
              <Text
                style={[
                  styles.memberChipLabel,
                  groupForm.ownerId === null ? styles.memberChipLabelActive : null,
                ]}
              >
                Unassigned
              </Text>
            </Pressable>
            {members.map((member) => {
              const selected = groupForm.ownerId === member.userId;
              return (
                <Pressable
                  key={member.userId}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() =>
                    setGroupForm((current) => ({ ...current, ownerId: member.userId }))
                  }
                  style={[styles.memberChip, selected ? styles.memberChipActive : null]}
                >
                  <Text
                    style={[
                      styles.memberChipLabel,
                      selected ? styles.memberChipLabelActive : null,
                    ]}
                  >
                    {member.name}
                  </Text>
                </Pressable>
              );
            })}
          </>
        ) : (
          <FormField
            label="Item name"
            value={personalName}
            onChangeText={setPersonalName}
            placeholder="Passport"
            maxLength={120}
          />
        )}
        {formError ? <ErrorState title="Could not save" message={formError} /> : null}
        <View style={styles.modalActions}>
          <SecondaryButton label="Cancel" onPress={closeSheet} disabled={saving} />
          <PrimaryButton
            label={sheet?.item ? 'Save changes' : 'Add item'}
            onPress={() => void submitSheet()}
            loading={saving}
            disabled={saving}
          />
        </View>
      </BottomFormSheet>

      <ConfirmDialog
        visible={deleteTarget !== null}
        title="Remove this item?"
        message={
          deleteTarget?.kind === 'group'
            ? 'It will be removed from the shared packing list.'
            : 'It will be removed from your private packing list.'
        }
        confirmLabel="Delete"
        cancelLabel="Keep"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </View>
  );
}

function PackingCheck({
  packed,
  busy,
  label,
  onPress,
}: {
  packed: boolean;
  busy: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: packed, busy }}
      accessibilityLabel={label}
      disabled={busy}
      onPress={onPress}
      hitSlop={10}
      style={[styles.check, packed ? styles.checkOn : null, busy ? styles.checkBusy : null]}
    >
      {packed ? (
        <SymbolView
          name={{ android: 'check', web: 'check' }}
          size={16}
          tintColor={colors.onPrimary}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md,
  },
  intro: {
    gap: spacing.xs,
  },
  title: {
    ...typography.title,
    fontSize: 24,
    color: colors.ink,
  },
  subtitle: {
    ...typography.body,
    color: colors.muted,
  },
  heroProgress: {
    ...typography.label,
    color: colors.primary,
  },
  card: {
    ...surfaceCard,
    padding: spacing.xl,
    gap: spacing.md,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionCopy: {
    flex: 1,
    gap: 2,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.ink,
  },
  progress: {
    ...typography.body,
    fontSize: 13,
    color: colors.muted,
  },
  privateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  privateHint: {
    ...typography.body,
    fontSize: 13,
    color: colors.muted,
  },
  addHit: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  addLabel: {
    ...typography.label,
    color: colors.primary,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    ...typography.cardTitle,
    color: colors.ink,
  },
  itemPacked: {
    color: colors.muted,
    textDecorationLine: 'line-through',
  },
  owner: {
    ...typography.body,
    fontSize: 13,
    color: colors.muted,
  },
  rowActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  editLabel: {
    ...typography.label,
    color: colors.primary,
  },
  deleteLabel: {
    ...typography.label,
    color: colors.danger,
  },
  check: {
    width: 28,
    height: 28,
    marginTop: 2,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkBusy: {
    opacity: 0.6,
  },
  ownerLabel: {
    ...typography.label,
    color: colors.ink,
  },
  memberChip: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  memberChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.seafoam,
  },
  memberChipLabel: {
    ...typography.body,
    color: colors.muted,
  },
  memberChipLabelActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  modalActions: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
});
