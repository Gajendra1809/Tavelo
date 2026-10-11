import mongoose from 'mongoose';
import { UserModel } from '../auth/user.model';
import { requireTripMember } from '../trips/trip.service';
import { dateOnlyToUtc, toDateOnly } from '../trips/trip.mapper';
import type { TripDocument } from '../trips/trip.model';
import { AppError } from '../../utils/AppError';
import { ExpenseModel } from './expense.model';
import { SettlementModel } from './settlement.model';
import {
  computeBalances,
  maxSettlementMinor,
  splitEqualMinor,
  suggestSettlements,
  validateCustomShares,
  type MemberBalance,
  type SettlementSuggestion,
} from './finance';
import type { CreateExpenseInput, CreateSettlementInput, UpdateExpenseInput } from './expense.schema';

export type ExpenseShareResponse = { userId: string; amountMinor: number; name: string };

export type ExpenseResponse = {
  id: string;
  tripId: string;
  description: string;
  amountMinor: number;
  currency: string;
  category: string;
  paidBy: { id: string; name: string };
  expenseDate: string;
  splitMethod: 'equal' | 'custom';
  shares: ExpenseShareResponse[];
  createdBy: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
};

export type SettlementResponse = {
  id: string;
  tripId: string;
  payer: { id: string; name: string };
  recipient: { id: string; name: string };
  amountMinor: number;
  currency: string;
  status: 'recorded' | 'cancelled';
  note: string;
  createdBy: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
};

export type BalancesResponse = {
  balances: (MemberBalance & { name: string })[];
  totalsByCurrency: { currency: string; spentMinor: number }[];
};

export async function listExpenses(userId: string, tripId: string): Promise<ExpenseResponse[]> {
  const trip = await requireTripMember(userId, tripId);
  const expenses = await ExpenseModel.find({ tripId: trip._id }).sort({ expenseDate: -1, createdAt: -1 });
  return mapExpenses(expenses);
}

export async function getExpense(userId: string, tripId: string, expenseId: string): Promise<ExpenseResponse> {
  await requireTripMember(userId, tripId);
  const expense = await findExpenseDocument(tripId, expenseId);
  return (await mapExpenses([expense]))[0]!;
}

export async function createExpense(
  userId: string,
  tripId: string,
  input: CreateExpenseInput,
): Promise<ExpenseResponse> {
  const trip = await requireTripMember(userId, tripId);
  assertExpenseDateWithinTrip(trip, input.expenseDate);
  const memberIds = tripMemberIds(trip);
  assertMember(memberIds, input.paidBy, 'The payer must be on this trip.');

  const currency = input.currency ?? 'INR';
  const shares = buildShares(input, memberIds);

  const expense = await ExpenseModel.create({
    tripId: trip._id,
    description: input.description,
    amountMinor: input.amountMinor,
    currency,
    category: input.category,
    paidBy: input.paidBy,
    expenseDate: dateOnlyToUtc(input.expenseDate),
    splitMethod: input.splitMethod,
    shares: shares.map((share) => ({ userId: share.userId, amountMinor: share.amountMinor })),
    createdBy: userId,
  });
  return (await mapExpenses([expense]))[0]!;
}

export async function updateExpense(
  userId: string,
  tripId: string,
  expenseId: string,
  input: UpdateExpenseInput,
): Promise<ExpenseResponse> {
  const trip = await requireTripMember(userId, tripId);
  const expense = await findExpenseDocument(tripId, expenseId);
  assertCanMutateExpense(userId, trip, expense);
  await assertExpenseLedgerUnlocked(trip._id);

  const memberIds = tripMemberIds(trip);
  const nextAmount = input.amountMinor ?? expense.amountMinor;
  const nextCurrency = input.currency ?? expense.currency;
  const nextSplitMethod = input.splitMethod ?? expense.splitMethod;
  const nextPaidBy = input.paidBy ?? expense.paidBy.toString();
  const nextDate = input.expenseDate ?? toDateOnly(expense.expenseDate);

  assertExpenseDateWithinTrip(trip, nextDate);
  assertMember(memberIds, nextPaidBy, 'The payer must be on this trip.');

  const shareInput =
    nextSplitMethod === 'equal'
      ? {
          splitMethod: 'equal' as const,
          amountMinor: nextAmount,
          participantIds:
            input.participantIds ??
            expense.shares.map((share) => share.userId.toString()),
        }
      : {
          splitMethod: 'custom' as const,
          amountMinor: nextAmount,
          shares:
            input.shares ??
            expense.shares.map((share) => ({
              userId: share.userId.toString(),
              amountMinor: share.amountMinor,
            })),
        };

  const shares = buildShares(shareInput, memberIds);

  if (input.description !== undefined) {
    expense.description = input.description;
  }
  expense.amountMinor = nextAmount;
  expense.currency = nextCurrency;
  expense.category = input.category ?? expense.category;
  expense.paidBy = new mongoose.Types.ObjectId(nextPaidBy);
  expense.expenseDate = dateOnlyToUtc(nextDate);
  expense.splitMethod = nextSplitMethod;
  expense.shares = shares.map((share) => ({
    userId: new mongoose.Types.ObjectId(share.userId),
    amountMinor: share.amountMinor,
  }));

  await expense.save();
  return (await mapExpenses([expense]))[0]!;
}

export async function deleteExpense(userId: string, tripId: string, expenseId: string): Promise<void> {
  const trip = await requireTripMember(userId, tripId);
  const expense = await findExpenseDocument(tripId, expenseId);
  assertCanMutateExpense(userId, trip, expense);
  await assertExpenseLedgerUnlocked(trip._id);
  await expense.deleteOne();
}

export async function getBalances(userId: string, tripId: string): Promise<BalancesResponse> {
  const trip = await requireTripMember(userId, tripId);
  const { balances, totalsByCurrency } = await loadBalanceViews(trip._id);
  const names = await loadNames([...new Set(balances.map((row) => row.userId))]);
  return {
    balances: balances.map((row) => ({ ...row, name: names.get(row.userId) ?? 'Former member' })),
    totalsByCurrency,
  };
}

export async function getSettlementSuggestions(
  userId: string,
  tripId: string,
): Promise<{ suggestions: (SettlementSuggestion & { fromName: string; toName: string })[] }> {
  const trip = await requireTripMember(userId, tripId);
  const { balances } = await loadBalanceViews(trip._id);
  const suggestions = suggestSettlements(balances);
  const names = await loadNames([
    ...new Set(suggestions.flatMap((row) => [row.fromUserId, row.toUserId])),
  ]);
  return {
    suggestions: suggestions.map((row) => ({
      ...row,
      fromName: names.get(row.fromUserId) ?? 'Former member',
      toName: names.get(row.toUserId) ?? 'Former member',
    })),
  };
}

export async function listSettlements(userId: string, tripId: string): Promise<SettlementResponse[]> {
  const trip = await requireTripMember(userId, tripId);
  const settlements = await SettlementModel.find({ tripId: trip._id }).sort({ createdAt: -1 });
  return mapSettlements(settlements);
}

export async function recordSettlement(
  userId: string,
  tripId: string,
  input: CreateSettlementInput,
): Promise<SettlementResponse> {
  const trip = await requireTripMember(userId, tripId);
  const memberIds = tripMemberIds(trip);
  assertMember(memberIds, input.payerId, 'The payer must be on this trip.');
  assertMember(memberIds, input.recipientId, 'The recipient must be on this trip.');
  if (input.payerId !== userId && input.recipientId !== userId) {
    throw new AppError(
      403,
      'FORBIDDEN',
      'Only the payer or the recipient can record this settlement.',
    );
  }

  const currency = input.currency ?? 'INR';
  const { balances } = await loadBalanceViews(trip._id);
  const allowed = maxSettlementMinor(balances, input.payerId, input.recipientId, currency);
  if (allowed <= 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'This settlement does not match an outstanding balance.');
  }
  if (input.amountMinor > allowed) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      `This payment cannot exceed ${allowed} minor units for the current balance.`,
    );
  }

  const settlement = await SettlementModel.create({
    tripId: trip._id,
    payerId: input.payerId,
    recipientId: input.recipientId,
    amountMinor: input.amountMinor,
    currency,
    note: input.note ?? '',
    createdBy: userId,
    status: 'recorded',
  });
  return (await mapSettlements([settlement]))[0]!;
}

export async function cancelSettlement(
  userId: string,
  tripId: string,
  settlementId: string,
): Promise<SettlementResponse> {
  const trip = await requireTripMember(userId, tripId);
  const settlement = await findSettlementDocument(tripId, settlementId);
  if (settlement.status === 'cancelled') {
    throw new AppError(409, 'CONFLICT', 'This settlement is already cancelled.');
  }
  const isOwner = trip.ownerId.toString() === userId;
  const isCreator = settlement.createdBy.toString() === userId;
  if (!isOwner && !isCreator) {
    throw new AppError(403, 'FORBIDDEN', 'You cannot cancel this settlement.');
  }
  settlement.status = 'cancelled';
  await settlement.save();
  return (await mapSettlements([settlement]))[0]!;
}

export async function deleteExpensesForTrip(tripId: mongoose.Types.ObjectId): Promise<void> {
  await ExpenseModel.deleteMany({ tripId });
  await SettlementModel.deleteMany({ tripId });
}

function buildShares(
  input:
    | CreateExpenseInput
    | {
        splitMethod: 'equal';
        amountMinor: number;
        participantIds: string[];
      }
    | {
        splitMethod: 'custom';
        amountMinor: number;
        shares: { userId: string; amountMinor: number }[];
      },
  memberIds: Set<string>,
): { userId: string; amountMinor: number }[] {
  if (input.splitMethod === 'equal') {
    for (const participantId of input.participantIds) {
      assertMember(memberIds, participantId, 'Every participant must be on this trip.');
    }
    try {
      return splitEqualMinor(input.amountMinor, input.participantIds);
    } catch (error) {
      throw new AppError(400, 'VALIDATION_ERROR', messageFrom(error));
    }
  }

  for (const share of input.shares) {
    assertMember(memberIds, share.userId, 'Every participant must be on this trip.');
  }
  try {
    return validateCustomShares(input.amountMinor, input.shares);
  } catch (error) {
    throw new AppError(400, 'VALIDATION_ERROR', messageFrom(error));
  }
}

async function loadBalanceViews(tripId: mongoose.Types.ObjectId) {
  const expenses = await ExpenseModel.find({ tripId }).lean();
  const settlements = await SettlementModel.find({ tripId }).lean();
  const ledgerExpenses = expenses.map((expense) => ({
    id: expense._id.toString(),
    amountMinor: expense.amountMinor,
    currency: expense.currency,
    paidBy: expense.paidBy.toString(),
    shares: expense.shares.map((share) => ({
      userId: share.userId.toString(),
      amountMinor: share.amountMinor,
    })),
  }));
  const ledgerSettlements = settlements.map((settlement) => ({
    id: settlement._id.toString(),
    currency: settlement.currency,
    payerId: settlement.payerId.toString(),
    recipientId: settlement.recipientId.toString(),
    amountMinor: settlement.amountMinor,
    status: settlement.status as 'recorded' | 'cancelled',
  }));
  const balances = computeBalances(ledgerExpenses, ledgerSettlements);
  const totalsByCurrency = [...groupSpent(expenses).entries()]
    .map(([currency, spentMinor]) => ({ currency, spentMinor }))
    .sort((left, right) => left.currency.localeCompare(right.currency));
  return { balances, totalsByCurrency };
}

function groupSpent(expenses: { currency: string; amountMinor: number }[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const expense of expenses) {
    totals.set(expense.currency, (totals.get(expense.currency) ?? 0) + expense.amountMinor);
  }
  return totals;
}

function tripMemberIds(trip: TripDocument): Set<string> {
  const ids = new Set<string>();
  ids.add(trip.ownerId.toString());
  for (const member of trip.members ?? []) {
    ids.add(member.userId.toString());
  }
  return ids;
}

function assertMember(memberIds: Set<string>, userId: string, message: string): void {
  if (!memberIds.has(userId)) {
    throw new AppError(400, 'VALIDATION_ERROR', message);
  }
}

function assertExpenseDateWithinTrip(trip: TripDocument, date: string): void {
  const start = toDateOnly(trip.startDate);
  const end = toDateOnly(trip.endDate);
  if (date < start || date > end) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Expense date must fall within the trip dates.');
  }
}

function assertCanMutateExpense(
  userId: string,
  trip: TripDocument,
  expense: { createdBy: { toString(): string } },
): void {
  const isOwner = trip.ownerId.toString() === userId;
  const isCreator = expense.createdBy.toString() === userId;
  if (!isOwner && !isCreator) {
    throw new AppError(403, 'FORBIDDEN', 'You cannot change this expense.');
  }
}

async function assertExpenseLedgerUnlocked(tripId: mongoose.Types.ObjectId): Promise<void> {
  const active = await SettlementModel.exists({ tripId, status: 'recorded' });
  if (active) {
    throw new AppError(
      409,
      'CONFLICT',
      'Cancel recorded settlements before changing expenses on this trip.',
    );
  }
}

async function findExpenseDocument(tripId: string, expenseId: string) {
  if (!mongoose.isValidObjectId(expenseId)) {
    throw new AppError(404, 'NOT_FOUND', 'Expense not found.');
  }
  const expense = await ExpenseModel.findById(expenseId);
  if (!expense || expense.tripId.toString() !== tripId) {
    throw new AppError(404, 'NOT_FOUND', 'Expense not found.');
  }
  return expense;
}

async function findSettlementDocument(tripId: string, settlementId: string) {
  if (!mongoose.isValidObjectId(settlementId)) {
    throw new AppError(404, 'NOT_FOUND', 'Settlement not found.');
  }
  const settlement = await SettlementModel.findById(settlementId);
  if (!settlement || settlement.tripId.toString() !== tripId) {
    throw new AppError(404, 'NOT_FOUND', 'Settlement not found.');
  }
  return settlement;
}

async function mapExpenses(
  expenses: {
    _id: { toString(): string };
    tripId: { toString(): string };
    description: string;
    amountMinor: number;
    currency: string;
    category: string;
    paidBy: { toString(): string };
    expenseDate: Date;
    splitMethod: 'equal' | 'custom';
    shares: { userId: { toString(): string }; amountMinor: number }[];
    createdBy: { toString(): string };
    createdAt: Date;
    updatedAt: Date;
  }[],
): Promise<ExpenseResponse[]> {
  const ids = new Set<string>();
  for (const expense of expenses) {
    ids.add(expense.paidBy.toString());
    ids.add(expense.createdBy.toString());
    for (const share of expense.shares) {
      ids.add(share.userId.toString());
    }
  }
  const names = await loadNames([...ids]);
  return expenses.map((expense) => ({
    id: expense._id.toString(),
    tripId: expense.tripId.toString(),
    description: expense.description,
    amountMinor: expense.amountMinor,
    currency: expense.currency,
    category: expense.category,
    paidBy: {
      id: expense.paidBy.toString(),
      name: names.get(expense.paidBy.toString()) ?? 'Former member',
    },
    expenseDate: toDateOnly(expense.expenseDate),
    splitMethod: expense.splitMethod,
    shares: expense.shares.map((share) => ({
      userId: share.userId.toString(),
      amountMinor: share.amountMinor,
      name: names.get(share.userId.toString()) ?? 'Former member',
    })),
    createdBy: {
      id: expense.createdBy.toString(),
      name: names.get(expense.createdBy.toString()) ?? 'Traveler',
    },
    createdAt: expense.createdAt.toISOString(),
    updatedAt: expense.updatedAt.toISOString(),
  }));
}

async function mapSettlements(
  settlements: {
    _id: { toString(): string };
    tripId: { toString(): string };
    payerId: { toString(): string };
    recipientId: { toString(): string };
    amountMinor: number;
    currency: string;
    status: 'recorded' | 'cancelled';
    note?: string;
    createdBy: { toString(): string };
    createdAt: Date;
    updatedAt: Date;
  }[],
): Promise<SettlementResponse[]> {
  const ids = new Set<string>();
  for (const settlement of settlements) {
    ids.add(settlement.payerId.toString());
    ids.add(settlement.recipientId.toString());
    ids.add(settlement.createdBy.toString());
  }
  const names = await loadNames([...ids]);
  return settlements.map((settlement) => ({
    id: settlement._id.toString(),
    tripId: settlement.tripId.toString(),
    payer: {
      id: settlement.payerId.toString(),
      name: names.get(settlement.payerId.toString()) ?? 'Former member',
    },
    recipient: {
      id: settlement.recipientId.toString(),
      name: names.get(settlement.recipientId.toString()) ?? 'Former member',
    },
    amountMinor: settlement.amountMinor,
    currency: settlement.currency,
    status: settlement.status,
    note: settlement.note ?? '',
    createdBy: {
      id: settlement.createdBy.toString(),
      name: names.get(settlement.createdBy.toString()) ?? 'Traveler',
    },
    createdAt: settlement.createdAt.toISOString(),
    updatedAt: settlement.updatedAt.toISOString(),
  }));
}

async function loadNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id) => mongoose.isValidObjectId(id)))];
  if (unique.length === 0) {
    return new Map();
  }
  const users = await UserModel.find({ _id: { $in: unique } }).select('name').lean();
  return new Map(users.map((user) => [user._id.toString(), user.name]));
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : 'Invalid expense split.';
}
