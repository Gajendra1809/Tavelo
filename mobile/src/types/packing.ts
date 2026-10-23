export type PackingPerson = {
  id: string;
  name: string;
};

export type GroupPackingItem = {
  id: string;
  tripId: string;
  name: string;
  packed: boolean;
  owner: PackingPerson | null;
  createdBy: PackingPerson;
  createdAt: string;
  updatedAt: string;
};

export type PersonalPackingItem = {
  id: string;
  tripId: string;
  name: string;
  packed: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PackingList<T> = {
  items: T[];
  packedCount: number;
  total: number;
};

export function packingListFromItems<T extends { packed: boolean }>(items: T[]): PackingList<T> {
  return {
    items,
    packedCount: items.filter((item) => item.packed).length,
    total: items.length,
  };
}

export function packingProgressLabel(packedCount: number, total: number): string {
  if (total === 0) {
    return 'Nothing packed yet';
  }
  const remaining = total - packedCount;
  if (remaining === 0) {
    return `${packedCount} of ${total} packed`;
  }
  return `${packedCount} of ${total} packed · ${remaining} remaining`;
}
