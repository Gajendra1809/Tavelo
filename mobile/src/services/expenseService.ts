import { TRIPS_PATH } from '@/constants/api';
import { apiRequest } from '@/lib/apiClient';
import type { MemberBalanceRow, SettlementSuggestion, TripExpense, TripSettlement } from '@/types/expense';

export function listExpenses(tripId: string): Promise<{ expenses: TripExpense[] }> {
  return apiRequest<{ expenses: TripExpense[] }>(`${TRIPS_PATH}/${encodeURIComponent(tripId)}/expenses`);
}

export function createExpense(tripId: string, body: unknown): Promise<TripExpense> {
  return apiRequest<TripExpense>(`${TRIPS_PATH}/${encodeURIComponent(tripId)}/expenses`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateExpense(tripId: string, expenseId: string, body: unknown): Promise<TripExpense> {
  return apiRequest<TripExpense>(
    `${TRIPS_PATH}/${encodeURIComponent(tripId)}/expenses/${encodeURIComponent(expenseId)}`,
    { method: 'PATCH', body: JSON.stringify(body) },
  );
}

export function deleteExpense(tripId: string, expenseId: string): Promise<{ deleted: boolean }> {
  return apiRequest<{ deleted: boolean }>(
    `${TRIPS_PATH}/${encodeURIComponent(tripId)}/expenses/${encodeURIComponent(expenseId)}`,
    { method: 'DELETE' },
  );
}

export function getBalances(tripId: string): Promise<{
  balances: MemberBalanceRow[];
  totalsByCurrency: { currency: string; spentMinor: number }[];
}> {
  return apiRequest(`${TRIPS_PATH}/${encodeURIComponent(tripId)}/expenses/balances`);
}

export function getSettlementSuggestions(tripId: string): Promise<{ suggestions: SettlementSuggestion[] }> {
  return apiRequest(`${TRIPS_PATH}/${encodeURIComponent(tripId)}/expenses/settlement-suggestions`);
}

export function listSettlements(tripId: string): Promise<{ settlements: TripSettlement[] }> {
  return apiRequest(`${TRIPS_PATH}/${encodeURIComponent(tripId)}/settlements`);
}

export function recordSettlement(tripId: string, body: unknown): Promise<TripSettlement> {
  return apiRequest<TripSettlement>(`${TRIPS_PATH}/${encodeURIComponent(tripId)}/settlements`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function cancelSettlement(tripId: string, settlementId: string): Promise<TripSettlement> {
  return apiRequest<TripSettlement>(
    `${TRIPS_PATH}/${encodeURIComponent(tripId)}/settlements/${encodeURIComponent(settlementId)}`,
    { method: 'DELETE' },
  );
}
