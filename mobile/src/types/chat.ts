export type ChatPerson = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

export type ChatMessage = {
  id: string;
  tripId: string;
  kind: 'text' | 'poll';
  body: string;
  deleted: boolean;
  pollId: string | null;
  sender: ChatPerson;
  createdAt: string;
  clientNonce: string | null;
  mine: boolean;
};

export type ChatReadReceipt = {
  userId: string;
  name: string;
  lastReadMessageId: string;
  lastReadAt: string;
};

export type ChatMessagesPage = {
  messages: ChatMessage[];
  olderCursor: string | null;
  newerCursor: string | null;
  reads: ChatReadReceipt[];
  typing: ChatPerson[];
  viewerLastReadMessageId?: string | null;
};

export type LocalMessageStatus = 'sending' | 'sent' | 'failed';

export type ChatListItem = ChatMessage & {
  status?: LocalMessageStatus;
};
