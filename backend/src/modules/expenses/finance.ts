export type ShareInput = { userId: string; amountMinor: number };

export type ExpenseLedgerInput = {
  id: string;
  amountMinor: number;
  currency: string;
  paidBy: string;
  shares: ShareInput[];
};

export type SettlementLedgerInput = {
  id: string;
  currency: string;
  payerId: string;
  recipientId: string;
  amountMinor: number;
  status: 'recorded' | 'cancelled';
};

export type MemberBalance = {
  userId: string;
  currency: string;
  paidMinor: number;
  shareMinor: number;
  netMinor: number;
};

export type SettlementSuggestion = {
  fromUserId: string;
  toUserId: string;
  amountMinor: number;
  currency: string;
};

/** Equal split with remainder distributed one paise at a time in stable userId order. */
export function splitEqualMinor(amountMinor: number, participantIds: string[]): ShareInput[] {
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    throw new Error('Amount must be a positive integer in minor units.');
  }
  const participants = [...new Set(participantIds)].sort();
  if (participants.length === 0) {
    throw new Error('At least one participant is required.');
  }
  const base = Math.floor(amountMinor / participants.length);
  let remainder = amountMinor - base * participants.length;
  return participants.map((userId) => {
    const extra = remainder > 0 ? 1 : 0;
    if (remainder > 0) {
      remainder -= 1;
    }
    return { userId, amountMinor: base + extra };
  });
}

export function validateCustomShares(amountMinor: number, shares: ShareInput[]): ShareInput[] {
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    throw new Error('Amount must be a positive integer in minor units.');
  }
  const normalized = new Map<string, number>();
  for (const share of shares) {
    if (!share.userId) {
      throw new Error('Each share needs a participant.');
    }
    if (!Number.isInteger(share.amountMinor) || share.amountMinor < 0) {
      throw new Error('Shares must be whole minor units of zero or more.');
    }
    if (normalized.has(share.userId)) {
      throw new Error('Each participant can appear only once.');
    }
    normalized.set(share.userId, share.amountMinor);
  }
  const total = [...normalized.values()].reduce((sum, value) => sum + value, 0);
  if (total !== amountMinor) {
    throw new Error('Shares must add up to the expense amount exactly.');
  }
  return [...normalized.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([userId, amount]) => ({ userId, amountMinor: amount }));
}

export function computeBalances(
  expenses: ExpenseLedgerInput[],
  settlements: SettlementLedgerInput[],
): MemberBalance[] {
  const byUserCurrency = new Map<string, { paid: number; share: number }>();

  const key = (userId: string, currency: string) => `${userId}\0${currency}`;

  for (const expense of expenses) {
    const paid = byUserCurrency.get(key(expense.paidBy, expense.currency)) ?? { paid: 0, share: 0 };
    paid.paid += expense.amountMinor;
    byUserCurrency.set(key(expense.paidBy, expense.currency), paid);

    for (const share of expense.shares) {
      const row = byUserCurrency.get(key(share.userId, expense.currency)) ?? { paid: 0, share: 0 };
      row.share += share.amountMinor;
      byUserCurrency.set(key(share.userId, expense.currency), row);
    }
  }

  for (const settlement of settlements) {
    if (settlement.status !== 'recorded') {
      continue;
    }
    const payer = byUserCurrency.get(key(settlement.payerId, settlement.currency)) ?? { paid: 0, share: 0 };
    payer.paid += settlement.amountMinor;
    byUserCurrency.set(key(settlement.payerId, settlement.currency), payer);

    const recipient =
      byUserCurrency.get(key(settlement.recipientId, settlement.currency)) ?? { paid: 0, share: 0 };
    recipient.share += settlement.amountMinor;
    byUserCurrency.set(key(settlement.recipientId, settlement.currency), recipient);
  }

  const balances: MemberBalance[] = [];
  for (const [compound, row] of byUserCurrency.entries()) {
    const [userId, currency] = compound.split('\0');
    balances.push({
      userId,
      currency,
      paidMinor: row.paid,
      shareMinor: row.share,
      netMinor: row.paid - row.share,
    });
  }

  balances.sort((left, right) => {
    const currencyCompare = left.currency.localeCompare(right.currency);
    if (currencyCompare !== 0) {
      return currencyCompare;
    }
    return left.userId.localeCompare(right.userId);
  });

  return balances;
}

/** Greedy settlement suggestions; stable ordering by user id. */
export function suggestSettlements(balances: MemberBalance[]): SettlementSuggestion[] {
  const suggestions: SettlementSuggestion[] = [];
  const buckets = new Map<string, Map<string, number>>();

  for (const row of balances) {
    if (row.netMinor === 0) {
      continue;
    }
    const currencyMap = buckets.get(row.currency) ?? new Map<string, number>();
    currencyMap.set(row.userId, row.netMinor);
    buckets.set(row.currency, currencyMap);
  }

  for (const [currency, members] of [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const debtors = [...members.entries()]
      .filter(([, net]) => net < 0)
      .sort(([a], [b]) => a.localeCompare(b));
    const creditors = [...members.entries()]
      .filter(([, net]) => net > 0)
      .sort(([a], [b]) => a.localeCompare(b));

    let i = 0;
    let j = 0;
    while (i < debtors.length && j < creditors.length) {
      const [debtorId, debtorNet] = debtors[i]!;
      const [creditorId, creditorNet] = creditors[j]!;
      const amountMinor = Math.min(-debtorNet, creditorNet);
      if (amountMinor <= 0) {
        break;
      }
      if (debtorId === creditorId) {
        j += 1;
        continue;
      }
      suggestions.push({ fromUserId: debtorId, toUserId: creditorId, amountMinor, currency });
      debtors[i] = [debtorId, debtorNet + amountMinor];
      creditors[j] = [creditorId, creditorNet - amountMinor];
      if (debtors[i]![1] === 0) {
        i += 1;
      }
      if (creditors[j]![1] === 0) {
        j += 1;
      }
    }
  }

  return suggestions;
}

export function maxSettlementMinor(
  balances: MemberBalance[],
  payerId: string,
  recipientId: string,
  currency: string,
): number {
  if (payerId === recipientId) {
    return 0;
  }
  const payer = balances.find((row) => row.userId === payerId && row.currency === currency);
  const recipient = balances.find((row) => row.userId === recipientId && row.currency === currency);
  if (!payer || !recipient || payer.netMinor >= 0 || recipient.netMinor <= 0) {
    return 0;
  }
  return Math.min(-payer.netMinor, recipient.netMinor);
}
