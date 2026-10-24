import { createKeyedTTLStore } from '@/lib/cache/createTTLStore';
import type { ChatListItem, ChatMessagesPage } from '@/types/chat';
import type { TripPoll } from '@/types/poll';

export const CHAT_TTL_MS = 15_000;

type ChatSnapshot = {
  messages: ChatListItem[];
  olderCursor: string | null;
  newerCursor: string | null;
  typingNames: string[];
  polls: TripPoll[];
};

const store = createKeyedTTLStore<ChatSnapshot>();

export const chatCache = {
  get(tripId: string): ChatSnapshot | null {
    return store.get(tripId);
  },
  set(tripId: string, value: ChatSnapshot): void {
    store.set(tripId, value);
  },
  isFresh(tripId: string): boolean {
    return store.isFresh(tripId, CHAT_TTL_MS);
  },
  invalidate(tripId: string): void {
    store.invalidate(tripId);
  },
};

export function pageToSnapshot(
  page: ChatMessagesPage,
  polls: TripPoll[],
  previous?: ChatSnapshot | null,
): ChatSnapshot {
  return {
    messages: mergeMessages(previous?.messages ?? [], page.messages),
    olderCursor: page.olderCursor ?? previous?.olderCursor ?? null,
    newerCursor: page.newerCursor ?? previous?.newerCursor ?? null,
    typingNames: page.typing.map((person) => person.name),
    polls,
  };
}

function mergeMessages(current: ChatListItem[], incoming: ChatListItem[]): ChatListItem[] {
  const byId = new Map<string, ChatListItem>();
  for (const item of current) {
    byId.set(item.id, item);
  }
  for (const item of incoming) {
    byId.set(item.id, { ...item, status: 'sent' });
  }
  return [...byId.values()].sort((left, right) => {
    if (left.createdAt === right.createdAt) {
      return left.id.localeCompare(right.id);
    }
    return left.createdAt < right.createdAt ? -1 : 1;
  });
}
