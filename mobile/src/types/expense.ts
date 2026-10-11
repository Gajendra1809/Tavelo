export type TripExpense = {
  id: string;
  tripId: string;
  description: string;
  amountMinor: number;
  currency: string;
  category: string;
  paidBy: { id: string; name: string };
  expenseDate: string;
  splitMethod: 'equal' | 'custom';
  shares: { userId: string; amountMinor: number; name: string }[];
  createdBy: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
};

export type MemberBalanceRow = {
  userId: string;
  currency: string;
  paidMinor: number;
  shareMinor: number;
  netMinor: number;
  name: string;
  avatarUrl: string | null;
};

export type SettlementSuggestion = {
  fromUserId: string;
  toUserId: string;
  amountMinor: number;
  currency: string;
  fromName: string;
  toName: string;
};

export type TripSettlement = {
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
