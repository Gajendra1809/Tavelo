import { TRIPS_PATH } from '@/constants/api';
import { apiRequest } from '@/lib/apiClient';
import type { ChatMessagesPage, ChatMessage } from '@/types/chat';

function chatBase(tripId: string): string {
  return `${TRIPS_PATH}/${encodeURIComponent(tripId)}/chat`;
}

export async function listTripMessages(
  tripId: string,
  options: { limit?: number; before?: string | null; after?: string | null } = {},
): Promise<ChatMessagesPage> {
  const params = new URLSearchParams();
  if (options.limit) {
    params.set('limit', String(options.limit));
  }
  if (options.before) {
    params.set('before', options.before);
  }
  if (options.after) {
    params.set('after', options.after);
  }
  const query = params.toString();
  return apiRequest<ChatMessagesPage>(`${chatBase(tripId)}/messages${query ? `?${query}` : ''}`);
}

export function sendTripMessage(
  tripId: string,
  body: string,
  clientNonce: string,
): Promise<ChatMessage> {
  return apiRequest<ChatMessage>(`${chatBase(tripId)}/messages`, {
    method: 'POST',
    body: JSON.stringify({ body, clientNonce }),
  });
}

export function deleteTripMessage(tripId: string, messageId: string): Promise<{ deleted: boolean }> {
  return apiRequest<{ deleted: boolean }>(
    `${chatBase(tripId)}/messages/${encodeURIComponent(messageId)}`,
    { method: 'DELETE' },
  );
}

export function markTripChatTyping(tripId: string): Promise<{ typing: boolean }> {
  return apiRequest<{ typing: boolean }>(`${chatBase(tripId)}/typing`, { method: 'POST' });
}
