import { createKeyedTTLStore } from '@/lib/cache/createTTLStore';
import type { GroupPackingItem, PackingList, PersonalPackingItem } from '@/types/packing';

export const PACKING_TTL_MS = 60_000;

const groupStore = createKeyedTTLStore<PackingList<GroupPackingItem>>();
const personalStore = createKeyedTTLStore<PackingList<PersonalPackingItem>>();

export const packingCache = {
  getGroup(tripId: string): PackingList<GroupPackingItem> | null {
    return groupStore.get(tripId);
  },
  setGroup(tripId: string, list: PackingList<GroupPackingItem>): void {
    groupStore.set(tripId, list);
  },
  isGroupFresh(tripId: string): boolean {
    return groupStore.isFresh(tripId, PACKING_TTL_MS);
  },
  getPersonal(tripId: string): PackingList<PersonalPackingItem> | null {
    return personalStore.get(tripId);
  },
  setPersonal(tripId: string, list: PackingList<PersonalPackingItem>): void {
    personalStore.set(tripId, list);
  },
  isPersonalFresh(tripId: string): boolean {
    return personalStore.isFresh(tripId, PACKING_TTL_MS);
  },
  invalidate(tripId: string): void {
    groupStore.invalidate(tripId);
    personalStore.invalidate(tripId);
  },
};
