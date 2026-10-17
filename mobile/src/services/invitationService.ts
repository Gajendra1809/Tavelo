import { INVITATIONS_PATH, TRIPS_PATH } from '@/constants/api';
import { apiRequest } from '@/lib/apiClient';
import type { ReceivedInvitation, SentInvitation } from '@/types/invitation';

export function listReceivedInvitations(): Promise<{ invitations: ReceivedInvitation[] }> {
  return apiRequest<{ invitations: ReceivedInvitation[] }>(INVITATIONS_PATH);
}

export function acceptInvitation(id: string): Promise<ReceivedInvitation> {
  return apiRequest<ReceivedInvitation>(`${INVITATIONS_PATH}/${encodeURIComponent(id)}/accept`, {
    method: 'POST',
  });
}

export function declineInvitation(id: string): Promise<ReceivedInvitation> {
  return apiRequest<ReceivedInvitation>(`${INVITATIONS_PATH}/${encodeURIComponent(id)}/decline`, {
    method: 'POST',
  });
}

export function listSentInvitations(tripId: string): Promise<{ invitations: SentInvitation[] }> {
  return apiRequest<{ invitations: SentInvitation[] }>(
    `${TRIPS_PATH}/${encodeURIComponent(tripId)}/invitations`,
  );
}

export function inviteToTripByUserId(tripId: string, userId: string): Promise<SentInvitation> {
  return apiRequest<SentInvitation>(`${TRIPS_PATH}/${encodeURIComponent(tripId)}/invitations`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
}

export function cancelInvitation(tripId: string, invitationId: string): Promise<{ cancelled: boolean }> {
  return apiRequest<{ cancelled: boolean }>(
    `${TRIPS_PATH}/${encodeURIComponent(tripId)}/invitations/${encodeURIComponent(invitationId)}`,
    { method: 'DELETE' },
  );
}

export function removeMember(tripId: string, userId: string): Promise<{ removed: boolean }> {
  return apiRequest<{ removed: boolean }>(
    `${TRIPS_PATH}/${encodeURIComponent(tripId)}/members/${encodeURIComponent(userId)}`,
    { method: 'DELETE' },
  );
}
