import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { FormField } from '@/components/FormField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { SecondaryButton } from '@/components/SecondaryButton';
import { Skeleton } from '@/components/Skeleton';
import { UserAvatar } from '@/components/UserAvatar';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTripFromCache } from '@/hooks/useTripFromCache';
import { expenseCache, type ExpenseBundle } from '@/lib/cache/expenseCache';
import { ApiError } from '@/lib/apiClient';
import { formatDisplayDate, todayDateInput } from '@/lib/dates';
import { categoryLabel, formatMinor, netBalanceLabel, parseMajorToMinor } from '@/lib/money';
import {
  cancelSettlement,
  createExpense,
  deleteExpense,
  getBalances,
  getSettlementSuggestions,
  listExpenses,
  listSettlements,
  recordSettlement,
} from '@/services/expenseService';
import { getTrip } from '@/services/tripService';
import type { SettlementSuggestion, TripExpense, TripSettlement } from '@/types/expense';
import { colors, radius, spacing, surfaceCard, typography } from '@/theme';

const categories = ['food', 'transport', 'lodging', 'activities', 'shopping', 'other'] as const;

export function TripExpensesScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const tripId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { user } = useAuth();

  const { trip, refresh: refreshTrip } = useTripFromCache(tripId);
  const cachedBundle = tripId ? expenseCache.get(tripId) : null;
  const [expenses, setExpenses] = useState<TripExpense[]>(() => cachedBundle?.expenses ?? []);
  const [balances, setBalances] = useState<Awaited<ReturnType<typeof getBalances>> | null>(
    () => cachedBundle?.balances ?? null,
  );
  const [suggestions, setSuggestions] = useState<SettlementSuggestion[]>(
    () => cachedBundle?.suggestions ?? [],
  );
  const [settlements, setSettlements] = useState<TripSettlement[]>(
    () => cachedBundle?.settlements ?? [],
  );
  const [loading, setLoading] = useState(
    () => Boolean(tripId && !cachedBundle && !expenseCache.isFresh(tripId ?? '')),
  );
  const [error, setError] = useState<string | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TripExpense | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<(typeof categories)[number]>('food');
  const [expenseDate, setExpenseDate] = useState(todayDateInput());
  const [paidBy, setPaidBy] = useState('');
  const [splitMethod, setSplitMethod] = useState<'equal' | 'custom'>('equal');
  const [participants, setParticipants] = useState<string[]>([]);
  const [customShares, setCustomShares] = useState<Record<string, string>>({});

  const members = useMemo(
    () => trip?.members.map((member) => ({ id: member.userId, name: member.name })) ?? [],
    [trip],
  );

  const myBalance = balances?.balances.find(
    (row) => row.userId === user?.id && row.currency === 'INR',
  );

  const applyBundle = useCallback(
    (bundle: ExpenseBundle) => {
      setExpenses(bundle.expenses);
      setBalances(bundle.balances);
      setSuggestions(bundle.suggestions);
      setSettlements(bundle.settlements);
      const memberIds = bundle.trip.members.map((member) => member.userId);
      setParticipants(memberIds);
      setPaidBy((current) => current || user?.id || bundle.trip.creatorId || memberIds[0] || '');
      setExpenseDate((current) =>
        current >= bundle.trip.startDate && current <= bundle.trip.endDate
          ? current
          : bundle.trip.startDate,
      );
    },
    [user?.id],
  );

  const loadExpenses = useCallback(
    async (options?: { force?: boolean }) => {
      if (!tripId) {
        setError('This trip link is missing an id.');
        setLoading(false);
        return;
      }
      const force = options?.force ?? false;
      const cached = expenseCache.get(tripId);
      if (!force && expenseCache.isFresh(tripId) && cached) {
        applyBundle(cached);
        setLoading(false);
        setError(null);
        return;
      }
      if (!cached) {
        setLoading(true);
      }
      setError(null);
      try {
        const loadedTrip = trip ?? (await getTrip(tripId));
        const [expenseList, balanceView, suggestionView, settlementList] = await Promise.all([
          listExpenses(tripId),
          getBalances(tripId),
          getSettlementSuggestions(tripId),
          listSettlements(tripId),
        ]);
        const bundle: ExpenseBundle = {
          trip: loadedTrip,
          expenses: expenseList.expenses,
          balances: balanceView,
          suggestions: suggestionView.suggestions,
          settlements: settlementList.settlements,
        };
        expenseCache.set(tripId, bundle);
        applyBundle(bundle);
      } catch (loadError) {
        setError(loadError instanceof ApiError ? loadError.message : 'Could not load expenses.');
      } finally {
        setLoading(false);
      }
    },
    [applyBundle, trip, tripId],
  );

  useFocusEffect(
    useCallback(() => {
      void refreshTrip();
      void loadExpenses();
    }, [loadExpenses, refreshTrip]),
  );

  async function reloadAfterMutation() {
    if (!tripId) {
      return;
    }
    expenseCache.invalidate(tripId);
    await loadExpenses({ force: true });
  }

  function openForm() {
    setDescription('');
    setAmount('');
    setCategory('food');
    setSplitMethod('equal');
    setFormError(null);
    setCustomShares(Object.fromEntries(members.map((member) => [member.id, ''])));
    setFormVisible(true);
  }

  function toggleParticipant(userId: string) {
    setParticipants((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
    );
  }

  async function submitExpense() {
    const amountMinor = parseMajorToMinor(amount);
    if (!description.trim()) {
      setFormError('Enter a description.');
      return;
    }
    if (amountMinor === null) {
      setFormError('Enter a valid amount in rupees.');
      return;
    }
    if (!paidBy || participants.length === 0) {
      setFormError('Choose who paid and at least one participant.');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const body =
        splitMethod === 'equal'
          ? {
              description: description.trim(),
              amountMinor,
              currency: 'INR',
              category,
              paidBy,
              expenseDate,
              splitMethod: 'equal' as const,
              participantIds: participants,
            }
          : {
              description: description.trim(),
              amountMinor,
              currency: 'INR',
              category,
              paidBy,
              expenseDate,
              splitMethod: 'custom' as const,
              shares: participants.map((userId) => {
                const shareMinor = parseMajorToMinor(customShares[userId] ?? '');
                if (shareMinor === null) {
                  throw new ApiError('Enter a valid share for every participant.', 'VALIDATION_ERROR');
                }
                return { userId, amountMinor: shareMinor };
              }),
            };
      await createExpense(tripId!, body);
      setFormVisible(false);
      await reloadAfterMutation();
    } catch (saveError) {
      setFormError(saveError instanceof ApiError ? saveError.message : 'Could not save the expense.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || !tripId) {
      return;
    }
    try {
      await deleteExpense(tripId, deleteTarget.id);
      setDeleteTarget(null);
      await reloadAfterMutation();
    } catch (deleteError) {
      setError(deleteError instanceof ApiError ? deleteError.message : 'Could not delete the expense.');
      setDeleteTarget(null);
    }
  }

  async function recordSuggested(suggestion: SettlementSuggestion) {
    if (!tripId) {
      return;
    }
    try {
      await recordSettlement(tripId, {
        payerId: suggestion.fromUserId,
        recipientId: suggestion.toUserId,
        amountMinor: suggestion.amountMinor,
        currency: suggestion.currency,
      });
      await reloadAfterMutation();
    } catch (recordError) {
      setError(recordError instanceof ApiError ? recordError.message : 'Could not record the settlement.');
    }
  }

  async function cancelRecorded(settlement: TripSettlement) {
    if (!tripId || settlement.status !== 'recorded') {
      return;
    }
    try {
      await cancelSettlement(tripId, settlement.id);
      await reloadAfterMutation();
    } catch (cancelError) {
      setError(cancelError instanceof ApiError ? cancelError.message : 'Could not cancel the settlement.');
    }
  }

  function canManageExpense(expense: TripExpense): boolean {
    if (!user || !trip) {
      return false;
    }
    return expense.createdBy.id === user.id || trip.creatorId === user.id;
  }

  if (loading && !trip) {
    return (
      <Screen edges={['left', 'right', 'bottom']}>
        <Skeleton height={120} />
        <Skeleton height={88} />
      </Screen>
    );
  }

  if (error && !trip) {
    return (
      <Screen edges={['left', 'right', 'bottom']}>
        <ErrorState message={error} onRetry={() => void loadExpenses({ force: true })} />
      </Screen>
    );
  }

  const totalInr = balances?.totalsByCurrency.find((row) => row.currency === 'INR')?.spentMinor ?? 0;

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{trip?.title ?? trip?.name ?? 'Trip expenses'}</Text>
          <Text style={styles.subtitle}>Shared ledger for this trip</Text>
        </View>
        <SecondaryButton label="Add expense" onPress={openForm} />
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Total spent (INR)</Text>
        <Text style={styles.summaryValue}>{formatMinor(totalInr)}</Text>
        {user && myBalance ? (
          <Text style={styles.balanceLine}>{netBalanceLabel(myBalance.netMinor, user.id, user.id)}</Text>
        ) : null}
      </View>

      {error ? (
        <ErrorState message={error} onRetry={() => void loadExpenses({ force: true })} />
      ) : null}

      <Text style={styles.sectionLabel}>Expenses</Text>
      {expenses.length === 0 ? (
        <EmptyState
          title="No expenses yet"
          message="Add the first shared cost. Amounts are stored in paise so totals stay exact."
          illustration="travel"
        />
      ) : (
        expenses.map((expense) => (
          <View key={expense.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.expenseTitle}>{expense.description}</Text>
              <Text style={styles.expenseAmount}>{formatMinor(expense.amountMinor, expense.currency)}</Text>
            </View>
            <Text style={styles.meta}>
              {categoryLabel(expense.category)} · Paid by {expense.paidBy.name} ·{' '}
              {formatDisplayDate(expense.expenseDate)}
            </Text>
            {canManageExpense(expense) ? (
              <Pressable accessibilityRole="button" onPress={() => setDeleteTarget(expense)}>
                <Text style={styles.deleteLabel}>Delete</Text>
              </Pressable>
            ) : null}
          </View>
        ))
      )}

      <Text style={styles.sectionLabel}>Balances</Text>
      {(balances?.balances.filter((row) => row.currency === 'INR') ?? []).map((row) => (
        <View key={`${row.userId}-${row.currency}`} style={styles.card}>
          <View style={styles.balanceRow}>
            <UserAvatar name={row.name} uri={row.avatarUrl} size="sm" />
            <View style={styles.balanceCopy}>
              <Text style={styles.memberName}>{row.name}</Text>
              <Text style={styles.meta}>
                Paid {formatMinor(row.paidMinor)} · Share {formatMinor(row.shareMinor)}
              </Text>
              <Text style={styles.balanceLine}>
                {user ? netBalanceLabel(row.netMinor, user.id, row.userId) : formatMinor(row.netMinor)}
              </Text>
            </View>
          </View>
        </View>
      ))}

      <Text style={styles.sectionLabel}>Suggested settlements</Text>
      {suggestions.length === 0 ? (
        <Text style={styles.meta}>Everyone is settled for now.</Text>
      ) : (
        suggestions.map((suggestion) => {
          const canRecord =
            user != null &&
            (user.id === suggestion.fromUserId || user.id === suggestion.toUserId);
          return (
            <View
              key={`${suggestion.fromUserId}-${suggestion.toUserId}-${suggestion.amountMinor}`}
              style={styles.card}
            >
              <Text style={styles.meta}>
                {suggestion.fromName} pays {suggestion.toName}
              </Text>
              <Text style={styles.expenseAmount}>
                {formatMinor(suggestion.amountMinor, suggestion.currency)}
              </Text>
              {canRecord ? (
                <SecondaryButton label="Record payment" onPress={() => void recordSuggested(suggestion)} />
              ) : (
                <Text style={styles.meta}>Only the payer or recipient can record this payment.</Text>
              )}
            </View>
          );
        })
      )}

      <Text style={styles.sectionLabel}>Recorded settlements</Text>
      {settlements.length === 0 ? (
        <Text style={styles.meta}>No payments recorded in the app yet.</Text>
      ) : (
        settlements.map((settlement) => (
          <View key={settlement.id} style={styles.card}>
            <Text style={styles.meta}>
              {settlement.payer.name} → {settlement.recipient.name}
            </Text>
            <Text style={styles.expenseAmount}>
              {formatMinor(settlement.amountMinor, settlement.currency)}
              {settlement.status === 'cancelled' ? ' · Cancelled' : ''}
            </Text>
            {settlement.status === 'recorded' &&
            (settlement.createdBy.id === user?.id || trip?.creatorId === user?.id) ? (
              <Pressable accessibilityRole="button" onPress={() => void cancelRecorded(settlement)}>
                <Text style={styles.deleteLabel}>Cancel settlement</Text>
              </Pressable>
            ) : null}
          </View>
        ))
      )}

      <Modal visible={formVisible} animationType="slide" transparent onRequestClose={() => setFormVisible(false)}>
        <View style={styles.modalBackdrop}>
          <ScrollView contentContainerStyle={styles.modalCard}>
            <Text style={styles.modalTitle}>Add expense</Text>
            <FormField label="Description" value={description} onChangeText={setDescription} placeholder="Dinner" />
            <FormField
              label="Amount (INR)"
              value={amount}
              onChangeText={setAmount}
              placeholder="1250.00"
              keyboardType="decimal-pad"
            />
            <FormField
              label="Date"
              value={expenseDate}
              onChangeText={setExpenseDate}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
            />
            <Text style={styles.fieldLabel}>Category</Text>
            <View style={styles.chipRow}>
              {categories.map((item) => (
                <Pressable
                  key={item}
                  onPress={() => setCategory(item)}
                  style={[styles.chip, category === item ? styles.chipActive : null]}
                >
                  <Text style={[styles.chipLabel, category === item ? styles.chipLabelActive : null]}>
                    {categoryLabel(item)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.fieldLabel}>Paid by</Text>
            <View style={styles.chipRow}>
              {members.map((member) => (
                <Pressable
                  key={member.id}
                  onPress={() => setPaidBy(member.id)}
                  style={[styles.chip, paidBy === member.id ? styles.chipActive : null]}
                >
                  <Text style={[styles.chipLabel, paidBy === member.id ? styles.chipLabelActive : null]}>
                    {member.name}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.splitRow}>
              <SecondaryButton
                label="Split equally"
                onPress={() => setSplitMethod('equal')}
                style={splitMethod === 'equal' ? styles.splitActive : undefined}
              />
              <SecondaryButton
                label="Custom split"
                onPress={() => setSplitMethod('custom')}
                style={splitMethod === 'custom' ? styles.splitActive : undefined}
              />
            </View>
            <Text style={styles.fieldLabel}>Participants</Text>
            <View style={styles.chipRow}>
              {members.map((member) => (
                <Pressable
                  key={member.id}
                  onPress={() => toggleParticipant(member.id)}
                  style={[styles.chip, participants.includes(member.id) ? styles.chipActive : null]}
                >
                  <Text
                    style={[styles.chipLabel, participants.includes(member.id) ? styles.chipLabelActive : null]}
                  >
                    {member.name}
                  </Text>
                </Pressable>
              ))}
            </View>
            {splitMethod === 'custom'
              ? participants.map((userId) => {
                  const member = members.find((row) => row.id === userId);
                  return (
                    <FormField
                      key={userId}
                      label={`Share for ${member?.name ?? 'member'} (INR)`}
                      value={customShares[userId] ?? ''}
                      onChangeText={(value) =>
                        setCustomShares((current) => ({ ...current, [userId]: value }))
                      }
                      placeholder="0.00"
                      keyboardType="decimal-pad"
                    />
                  );
                })
              : null}
            {formError ? <ErrorState title="Could not save" message={formError} /> : null}
            <PrimaryButton label="Save expense" onPress={() => void submitExpense()} loading={saving} disabled={saving} />
            <SecondaryButton label="Cancel" onPress={() => setFormVisible(false)} disabled={saving} />
          </ScrollView>
        </View>
      </Modal>

      <ConfirmDialog
        visible={deleteTarget !== null}
        title="Delete this expense?"
        message="It will be removed from the shared ledger."
        confirmLabel="Delete"
        cancelLabel="Keep"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  headerCopy: { flex: 1 },
  title: { ...typography.title, fontSize: 28, color: colors.ink },
  subtitle: { ...typography.body, color: colors.muted },
  summaryCard: { ...surfaceCard, padding: spacing.xl, gap: spacing.xs, marginBottom: spacing.md },
  summaryLabel: { ...typography.label, color: colors.muted },
  summaryValue: { ...typography.title, fontSize: 28, color: colors.primary },
  balanceLine: { ...typography.body, color: colors.ink, fontWeight: '600' },
  balanceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  balanceCopy: { flex: 1, gap: spacing.xs },
  sectionLabel: { ...typography.label, color: colors.ink, marginTop: spacing.md, marginBottom: spacing.sm },
  card: { ...surfaceCard, padding: spacing.lg, gap: spacing.xs, marginBottom: spacing.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  expenseTitle: { ...typography.cardTitle, color: colors.ink, flex: 1 },
  expenseAmount: { ...typography.label, color: colors.primary },
  meta: { ...typography.body, color: colors.muted },
  memberName: { ...typography.cardTitle, color: colors.ink },
  deleteLabel: { ...typography.label, color: colors.danger, marginTop: spacing.xs },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(30, 41, 59, 0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl, gap: spacing.sm },
  modalTitle: { ...typography.title, fontSize: 22, color: colors.ink, marginBottom: spacing.sm },
  fieldLabel: { ...typography.label, color: colors.ink, marginTop: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { borderRadius: radius.xl, borderWidth: 1, borderColor: colors.line, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  chipActive: { backgroundColor: colors.seafoam, borderColor: colors.primary },
  chipLabel: { ...typography.body, fontSize: 13, color: colors.muted },
  chipLabelActive: { color: colors.primary, fontWeight: '600' },
  splitRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  splitActive: { borderColor: colors.primary, borderWidth: 1, borderRadius: radius.md },
});
