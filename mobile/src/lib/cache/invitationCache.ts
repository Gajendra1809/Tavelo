import { createTTLStore } from '@/lib/cache/createTTLStore';
import type { ReceivedInvitation } from '@/types/invitation';

export const INVITATION_LIST_TTL_MS = 60_000;

const received = createTTLStore<ReceivedInvitation[]>(null);

export const invitationCache = {
  get(): ReceivedInvitation[] | null {
    return received.get();
  },
  set(items: ReceivedInvitation[]): void {
    received.set(items);
  },
  isFresh(): boolean {
    return received.isFresh(INVITATION_LIST_TTL_MS);
  },
  invalidate(): void {
    received.invalidate();
  },
};
