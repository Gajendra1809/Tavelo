import { createKeyedTTLStore } from '@/lib/cache/createTTLStore';
import type { MemberBalanceRow, SettlementSuggestion, TripExpense, TripSettlement } from '@/types/expense';
import type { Trip } from '@/types/trip';

export const EXPENSE_BUNDLE_TTL_MS = 60_000;

export type ExpenseBundle = {
  trip: Trip;
  expenses: TripExpense[];
  balances: { balances: MemberBalanceRow[]; totalsByCurrency: { currency: string; spentMinor: number }[] };
  suggestions: SettlementSuggestion[];
  settlements: TripSettlement[];
};

const byTripId = createKeyedTTLStore<ExpenseBundle>();

export const expenseCache = {
  get(tripId: string): ExpenseBundle | null {
    return byTripId.get(tripId);
  },
  set(tripId: string, bundle: ExpenseBundle): void {
    byTripId.set(tripId, bundle);
  },
  isFresh(tripId: string): boolean {
    return byTripId.isFresh(tripId, EXPENSE_BUNDLE_TTL_MS);
  },
  invalidate(tripId: string): void {
    byTripId.invalidate(tripId);
  },
};
