export type SentInvitation = {
  id: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
  respondedAt: string | null;
  invitee: { id: string; name: string; email: string; username: string | null };
};

export type ReceivedInvitation = {
  id: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
  trip: { id: string; name: string; destination: string };
  inviter: { id: string; name: string; avatarUrl: string | null };
};
