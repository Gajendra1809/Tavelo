import { TRIPS_PATH } from '@/constants/api';
import { apiRequest } from '@/lib/apiClient';
import type { GroupPackingItem, PackingList, PersonalPackingItem } from '@/types/packing';

function tripPackingPath(tripId: string, suffix: string): string {
  return `${TRIPS_PATH}/${encodeURIComponent(tripId)}/packing/${suffix}`;
}

export function listGroupPacking(tripId: string): Promise<PackingList<GroupPackingItem>> {
  return apiRequest<PackingList<GroupPackingItem>>(tripPackingPath(tripId, 'group'));
}

export function createGroupPacking(
  tripId: string,
  body: { name: string; ownerId?: string | null },
): Promise<GroupPackingItem> {
  return apiRequest<GroupPackingItem>(tripPackingPath(tripId, 'group'), {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateGroupPacking(
  tripId: string,
  itemId: string,
  body: { name?: string; packed?: boolean; ownerId?: string | null },
): Promise<GroupPackingItem> {
  return apiRequest<GroupPackingItem>(
    `${tripPackingPath(tripId, 'group')}/${encodeURIComponent(itemId)}`,
    { method: 'PATCH', body: JSON.stringify(body) },
  );
}

export function deleteGroupPacking(tripId: string, itemId: string): Promise<{ deleted: boolean }> {
  return apiRequest<{ deleted: boolean }>(
    `${tripPackingPath(tripId, 'group')}/${encodeURIComponent(itemId)}`,
    { method: 'DELETE' },
  );
}

export function listPersonalPacking(tripId: string): Promise<PackingList<PersonalPackingItem>> {
  return apiRequest<PackingList<PersonalPackingItem>>(tripPackingPath(tripId, 'mine'));
}

export function createPersonalPacking(tripId: string, body: { name: string }): Promise<PersonalPackingItem> {
  return apiRequest<PersonalPackingItem>(tripPackingPath(tripId, 'mine'), {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updatePersonalPacking(
  tripId: string,
  itemId: string,
  body: { name?: string; packed?: boolean },
): Promise<PersonalPackingItem> {
  return apiRequest<PersonalPackingItem>(
    `${tripPackingPath(tripId, 'mine')}/${encodeURIComponent(itemId)}`,
    { method: 'PATCH', body: JSON.stringify(body) },
  );
}

export function deletePersonalPacking(tripId: string, itemId: string): Promise<{ deleted: boolean }> {
  return apiRequest<{ deleted: boolean }>(
    `${tripPackingPath(tripId, 'mine')}/${encodeURIComponent(itemId)}`,
    { method: 'DELETE' },
  );
}
